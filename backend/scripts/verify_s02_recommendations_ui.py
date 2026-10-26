"""Verify S02 through a migrated SQLite database, real API, and Chromium UI.

The catalogue comes from the reviewed S3-T06 synthetic oracle. The script
creates a temporary database and browser profile; it never touches the normal
development database or uses a provider token. Ports 8000 and 5173 must be free.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
from contextlib import closing
from http.client import HTTPException
from pathlib import Path
from urllib.request import urlopen

import httpx
from verify_s09_popular_ui import (
    BACKEND_URL,
    FRONTEND_URL,
    PROJECT_ROOT,
    find_browser,
    git_output,
    node_command,
    remove_temporary_database,
    run_migrations,
    running_process,
    sqlite_url,
    utc_timestamp,
    wait_for_url,
)
from websockets.sync.client import connect

FIXTURE_PATH = PROJECT_ROOT / "backend/tests/fixtures/recommendations_s3_t06.json"
PASSWORD = "s02-t12-synthetic-password"
ACCOUNT_EMAIL = "s02-t12@example.test"
MATCH_CASE = "personalisedTwoGenreIntersection"
NO_MATCH_CASE = "popularNoMatch"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--browser", type=Path)
    return parser.parse_args()


def require_free_port(port: int) -> None:
    """Never send synthetic account writes to an existing local application."""

    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            probe.bind(("127.0.0.1", port))
    except OSError as error:
        raise RuntimeError(
            f"Port {port} is unavailable; stop that service before T12"
        ) from error


def seed_catalogue(database_path: Path, fixture: dict) -> None:
    """Load the exact reviewed T06 candidates, collapsing its duplicate row."""

    candidates = {row["id"]: row for row in fixture["candidateRows"]}
    revision_id = fixture["catalogueRevision"]
    now = utc_timestamp()
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executemany(
            "INSERT INTO genres (id, name) VALUES (?, ?)",
            [(genre["id"], genre["name"]) for genre in fixture["genres"]],
        )
        connection.execute(
            """INSERT INTO catalogue_revisions
               (id, provider, created_at, inserted_movie_count,
                updated_movie_count, rejected_movie_count)
               VALUES (?, 't12-acceptance', ?, ?, 0, 0)""",
            (revision_id, now, len(candidates)),
        )
        connection.executemany(
            """INSERT INTO catalog_movies
               (id, catalogue_revision_id, source, source_id, title,
                release_year, overview, popularity_score, vote_average,
                vote_count, source_fetched_at)
               VALUES (?, ?, 't12-acceptance', ?, ?, ?, NULL, ?, NULL, NULL, ?)""",
            [
                (
                    row["id"],
                    revision_id,
                    row["id"],
                    row["title"],
                    row["releaseYear"],
                    row["popularityScore"],
                    now,
                )
                for row in candidates.values()
            ],
        )
        connection.executemany(
            "INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
            [
                (row["id"], genre_id)
                for row in candidates.values()
                for genre_id in row["genreIds"]
            ],
        )
        connection.execute(
            """INSERT INTO catalogue_state (id, active_revision_id, updated_at)
               VALUES (1, ?, ?)""",
            (revision_id, now),
        )


def active_catalogue(database_path: Path, revision_id: str | None) -> None:
    """Induce a real 503 by removing the pointer, or restore that same source."""

    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("DELETE FROM catalogue_state WHERE id = 1")
        if revision_id is not None:
            connection.execute(
                """INSERT INTO catalogue_state
                   (id, active_revision_id, updated_at) VALUES (1, ?, ?)""",
                (revision_id, utc_timestamp()),
            )


def saved_genres(database_path: Path, user_id: str) -> list[int]:
    with closing(sqlite3.connect(database_path)) as connection:
        return [
            row[0]
            for row in connection.execute(
                """SELECT genre_id FROM user_genre_preferences
                   WHERE user_id = ? ORDER BY genre_id""",
                (user_id,),
            )
        ]


def revoke_session(database_path: Path, user_id: str) -> None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        updated = connection.execute(
            """UPDATE auth_sessions SET revoked_at = ?
               WHERE user_id = ? AND revoked_at IS NULL""",
            (utc_timestamp(), user_id),
        )
        assert updated.rowcount == 1


def register_and_login(client: httpx.Client) -> tuple[str, str]:
    registered = client.post(
        "/api/auth/register",
        json={"email": ACCOUNT_EMAIL, "password": PASSWORD},
    )
    assert registered.status_code == 201, registered.text
    logged_in = client.post(
        "/api/auth/login",
        json={"email": ACCOUNT_EMAIL, "password": PASSWORD},
        headers={"Origin": BACKEND_URL},
    )
    assert logged_in.status_code == 200, logged_in.text
    token = client.cookies.get("ams_session")
    assert token, "Login did not issue ams_session"
    return logged_in.json()["data"]["user"]["id"], token


def save_preferences(client: httpx.Client, genre_ids: list[int]) -> None:
    response = client.put(
        "/api/me/preferences",
        json={"genreIds": genre_ids},
        headers={"Origin": BACKEND_URL},
    )
    assert response.status_code == 200, response.text


def assert_oracle(response: httpx.Response, fixture: dict, case_name: str) -> list:
    """Compare the real API to the reviewed fixture, not to a mock response."""

    assert response.status_code == 200, response.text
    body = response.json()
    expected = fixture["cases"][case_name]["expectedResponse"]
    expected_data = expected["data"]
    actual_data = body["data"]
    assert {key: actual_data[key] for key in ("mode", "personalised", "noMatch")} == {
        key: expected_data[key] for key in ("mode", "personalised", "noMatch")
    }
    expected_movies = expected_data["movies"]
    actual_movies = actual_data["movies"]
    assert len(actual_movies) == len(expected_movies) == 10
    assert len({movie["id"] for movie in actual_movies}) == 10
    assert [movie["id"] for movie in actual_movies] == [
        movie["id"] for movie in expected_movies
    ]
    for actual, oracle in zip(actual_movies, expected_movies, strict=True):
        assert actual["reason"] == oracle["reason"]
    assert body["meta"] == expected["meta"]
    return actual_movies


class BrowserPage:
    """Small synchronous Chrome DevTools client for one real page."""

    def __init__(self, websocket_url: str):
        self._context = connect(websocket_url, origin=FRONTEND_URL)
        self._connection = self._context.__enter__()
        self._next_id = 0
        self.call("Page.enable")
        self.call("Runtime.enable")
        self.call("Network.enable")

    def close(self) -> None:
        self._context.__exit__(None, None, None)

    def call(self, method: str, params: dict | None = None) -> dict:
        self._next_id += 1
        message_id = self._next_id
        self._connection.send(
            json.dumps({"id": message_id, "method": method, "params": params or {}})
        )
        while True:
            message = json.loads(self._connection.recv(timeout=15))
            if message.get("id") != message_id:
                continue
            if "error" in message:
                raise RuntimeError(f"CDP {method} failed: {message['error']}")
            return message["result"]

    def evaluate(self, expression: str):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in result:
            raise RuntimeError(
                f"Browser expression failed: {result['exceptionDetails']}"
            )
        return result["result"].get("value")

    def navigate(self) -> None:
        self.call("Page.navigate", {"url": f"{FRONTEND_URL}/recommendations"})

    def snapshot(self) -> dict:
        return self.evaluate(
            """(() => ({
              path: location.pathname,
              headings: [...document.querySelectorAll('h2, h3')]
                .map(node => node.textContent.trim()),
              cards: [...document.querySelectorAll('article.movie-card')].map(card => ({
                title: card.querySelector('h2')?.textContent.trim(),
                href: card.querySelector('a.movie-card__link')?.getAttribute('href'),
                genres: card.querySelector('p.muted')?.textContent.trim(),
                reason: card.querySelector('.movie-reason')?.textContent.trim() || ''
              })),
              buttons: [...document.querySelectorAll('button')]
                .map(node => node.textContent.trim()),
              links: [...document.querySelectorAll('a')]
                .map(node => node.textContent.trim()),
              alerts: [...document.querySelectorAll('[role="alert"]')]
                .map(node => node.textContent.trim())
            }))()"""
        )

    def wait_for(self, predicate, label: str) -> dict:
        deadline = time.monotonic() + 20
        last = None
        while time.monotonic() < deadline:
            try:
                last = self.snapshot()
                if last and predicate(last):
                    return last
            except RuntimeError:
                pass  # Navigation may briefly destroy the JavaScript context.
            time.sleep(0.25)
        raise AssertionError(f"Timed out waiting for {label}; last state: {last}")

    def click_retry(self) -> None:
        clicked = self.evaluate(
            """(() => {
              const button = [...document.querySelectorAll('button')]
                .find(node => node.textContent.trim() === 'Retry');
              if (!button) return false;
              button.click();
              return true;
            })()"""
        )
        assert clicked, "The browser has no visible Retry button"

    def screenshot(self, output_path: Path) -> None:
        result = self.call("Page.captureScreenshot", {"format": "png"})
        output_path.write_bytes(base64.b64decode(result["data"]))


def browser_websocket(profile_path: Path, browser: subprocess.Popen) -> str:
    """Wait for an actual page target, tolerating partial Chromium startup.

    DevToolsActivePort can appear before its HTTP endpoint or page target is
    ready. Retry transport/partial-response failures within the same deadline;
    never retry failed application assertions or accept an absent page.
    """
    port_file = profile_path / "DevToolsActivePort"
    deadline = time.monotonic() + 30
    last_error = None
    while time.monotonic() < deadline:
        if browser.poll() is not None:
            raise RuntimeError(f"Chromium exited with {browser.returncode}")
        try:
            if port_file.is_file():
                lines = port_file.read_text(encoding="utf-8").splitlines()
                if lines:
                    port = int(lines[0])
                    if not 1 <= port <= 65535:
                        raise ValueError("DevTools port is not valid yet")
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        break
                    with urlopen(
                        f"http://127.0.0.1:{port}/json/list", timeout=min(2, remaining)
                    ) as reply:
                        pages = json.load(reply)
                    if isinstance(pages, list):
                        for page in pages:
                            if not isinstance(page, dict) or page.get("type") != "page":
                                continue
                            websocket = page.get("webSocketDebuggerUrl")
                            if isinstance(websocket, str) and websocket.startswith(("ws://", "wss://")):
                                return websocket
        except (OSError, ValueError, HTTPException) as error:
            last_error = error
        remaining = deadline - time.monotonic()
        if remaining > 0:
            time.sleep(min(0.25, remaining))
    raise TimeoutError("Chromium did not open its DevTools page within 30 seconds") from last_error


def assert_cards(snapshot: dict, movies: list, fixture: dict, *, reasons: bool) -> None:
    assert len(snapshot["cards"]) == len(movies) == 10, snapshot
    candidates = {row["id"]: row for row in fixture["candidateRows"]}
    genres = {genre["id"]: genre["name"] for genre in fixture["genres"]}
    for card, movie in zip(snapshot["cards"], movies, strict=True):
        row = candidates[movie["id"]]
        assert card["href"] == f"/movies/{movie['id']}"
        assert card["title"] == row["title"]
        for genre_id in row["genreIds"]:
            assert genres[genre_id] in card["genres"]
        matched = movie["reason"]["matchedGenres"]
        if reasons:
            assert matched
            assert card["reason"].startswith("Matches your genres:")
            for genre in matched:
                assert genre["name"] in card["reason"]
        else:
            assert not matched and not card["reason"]


def main() -> int:
    args = parse_args()
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    browser_path = find_browser(args.browser)
    require_free_port(8000)
    require_free_port(5173)
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    backend_log = evidence_dir / "t12-backend-output.txt"
    frontend_log = evidence_dir / "t12-frontend-output.txt"
    browser_log = evidence_dir / "t12-browser-output.txt"

    with tempfile.TemporaryDirectory(prefix="s02-t12-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        database_path = temporary_path / "acceptance.db"
        environment = os.environ | {
            "DATABASE_URL": sqlite_url(database_path),
            "TMDB_READ_ACCESS_TOKEN": "",
        }
        run_migrations(environment["DATABASE_URL"], environment)
        seed_catalogue(database_path, fixture)

        backend_command = [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--app-dir",
            "backend",
            "--host",
            "127.0.0.1",
            "--port",
            "8000",
        ]
        frontend_command = [
            node_command(),
            str(PROJECT_ROOT / "frontend/node_modules/vite/bin/vite.js"),
            str(PROJECT_ROOT / "frontend"),
            "--host",
            "127.0.0.1",
            "--port",
            "5173",
            "--strictPort",
        ]
        profile_path = temporary_path / "browser-profile"
        browser_command = [
            str(browser_path),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--remote-allow-origins=*",
            "--remote-debugging-port=0",
            "--window-size=1440,1000",
            f"--user-data-dir={profile_path}",
            "about:blank",
        ]

        with (
            running_process(
                backend_command, environment=environment, output_path=backend_log
            ) as backend,
            running_process(
                frontend_command, environment=environment, output_path=frontend_log
            ) as frontend,
            running_process(
                browser_command, environment=environment, output_path=browser_log
            ) as browser,
            httpx.Client(base_url=BACKEND_URL, timeout=10) as client,
        ):
            wait_for_url(f"{BACKEND_URL}/health", backend, backend_log)
            wait_for_url(FRONTEND_URL, frontend, frontend_log)
            user_id, token = register_and_login(client)
            assert saved_genres(database_path, user_id) == []
            page = BrowserPage(browser_websocket(profile_path, browser))
            try:
                page.call(
                    "Network.setCookie",
                    {"name": "ams_session", "value": token, "url": FRONTEND_URL},
                )

                # Match: real preference write, API oracle, and rendered cards.
                match_genres = fixture["cases"][MATCH_CASE]["savedGenreIds"]
                save_preferences(client, match_genres)
                assert saved_genres(database_path, user_id) == match_genres
                match_movies = assert_oracle(
                    client.get("/api/me/recommendations?limit=10"),
                    fixture,
                    MATCH_CASE,
                )
                page.navigate()
                matched = page.wait_for(
                    lambda state: (
                        state["path"] == "/recommendations"
                        and len(state["cards"]) == 10
                    ),
                    "personalised cards",
                )
                assert "Recommended for you" in matched["headings"]
                assert_cards(matched, match_movies, fixture, reasons=True)
                page.screenshot(evidence_dir / "t12-matched.png")

                # No-match: same user, real DB state, and visible actions.
                no_match_genres = fixture["cases"][NO_MATCH_CASE]["savedGenreIds"]
                save_preferences(client, no_match_genres)
                assert saved_genres(database_path, user_id) == no_match_genres
                alternatives = assert_oracle(
                    client.get("/api/me/recommendations?limit=10"),
                    fixture,
                    NO_MATCH_CASE,
                )
                page.navigate()
                no_match = page.wait_for(
                    lambda state: (
                        "No movies matched your favourite genres." in state["headings"]
                        and len(state["cards"]) == 10
                    ),
                    "no-match alternatives",
                )
                assert "Popular alternatives" in no_match["headings"]
                assert "Edit preferences" in no_match["links"]
                assert "Retry" in no_match["buttons"]
                assert_cards(no_match, alternatives, fixture, reasons=False)
                page.screenshot(evidence_dir / "t12-no-match.png")

                # Failure: remove only the active source pointer, not preferences.
                save_preferences(client, match_genres)
                before_failure = saved_genres(database_path, user_id)
                active_catalogue(database_path, None)
                failed_api = client.get("/api/me/recommendations?limit=10")
                assert failed_api.status_code == 503, failed_api.text
                assert failed_api.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"
                page.navigate()
                failed = page.wait_for(
                    lambda state: (
                        "Recommendations are unavailable" in state["headings"]
                    ),
                    "source-error state",
                )
                assert "Retry" in failed["buttons"]
                assert not failed["cards"]
                assert (
                    "No movies matched your favourite genres." not in failed["headings"]
                )
                assert saved_genres(database_path, user_id) == before_failure
                page.screenshot(evidence_dir / "t12-source-failure.png")

                # Restore the same catalogue and click the UI Retry control.
                active_catalogue(database_path, fixture["catalogueRevision"])
                recovered_movies = assert_oracle(
                    client.get("/api/me/recommendations?limit=10"),
                    fixture,
                    MATCH_CASE,
                )
                page.click_retry()
                recovered = page.wait_for(
                    lambda state: (
                        "Recommended for you" in state["headings"]
                        and len(state["cards"]) == 10
                    ),
                    "successful retry",
                )
                assert_cards(recovered, recovered_movies, fixture, reasons=True)
                assert saved_genres(database_path, user_id) == before_failure
                page.screenshot(evidence_dir / "t12-recovered.png")

                # A current-request 401 must sign out, not display the 503 UI.
                save_preferences(client, no_match_genres)
                page.navigate()
                page.wait_for(
                    lambda state: (
                        "No movies matched your favourite genres." in state["headings"]
                    ),
                    "pre-401 retry control",
                )
                revoke_session(database_path, user_id)
                assert client.get("/api/me/recommendations").status_code == 401
                page.click_retry()
                unauthorized = page.wait_for(
                    lambda state: state["path"] == "/login",
                    "401 redirect to login",
                )
                assert not unauthorized["cards"]
                assert "Recommendations are unavailable" not in unauthorized["headings"]
                page.screenshot(evidence_dir / "t12-401-login.png")
            finally:
                page.close()

        remove_temporary_database(database_path)

    result = "\n".join(
        [
            "S02 / T12 real-DB browser acceptance",
            f"run_at={utc_timestamp()}",
            f"base_commit={git_output('rev-parse', 'HEAD')}",
            f"browser={browser_path.resolve()}",
            "database=migrated temporary file-backed SQLite",
            f"fixture={FIXTURE_PATH.relative_to(PROJECT_ROOT)}",
            "match=PASS; 10 distinct genre-matching cards with reasons",
            "no_match=PASS; 10 popular alternatives and edit/retry controls",
            "source_503=PASS; error/retry visible and preferences unchanged",
            "retry=PASS; real API and UI recovered to personalised cards",
            "current_401=PASS; login redirect, not source-error UI",
            "result=PASS",
            "",
        ]
    )
    (evidence_dir / "t12-browser-run-output.txt").write_text(result, encoding="utf-8")
    print(result, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
