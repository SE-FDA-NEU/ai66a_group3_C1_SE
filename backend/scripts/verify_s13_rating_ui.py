"""Verify S13 rating protection/recovery in Chromium, FastAPI, and SQLite.

The verifier creates a migrated temporary database, deterministic catalogue,
synthetic accounts, and a temporary Chromium profile.  It never reads or
writes the configured development database and never needs a TMDb token.

Ports 8000 and 5173 must be free.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
from verify_s02_recommendations_ui import (
    BrowserPage,
    browser_websocket,
    require_free_port,
    seed_catalogue,
)
from verify_s09_popular_ui import (
    BACKEND_URL,
    FRONTEND_URL,
    PROJECT_ROOT,
    command_version,
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

FIXTURE_PATH = PROJECT_ROOT / "backend/tests/fixtures/recommendations_s3_t06.json"
PASSWORD = "t34-synthetic-password"
ACCOUNT_A_EMAIL = "t34-account-a@example.test"
ACCOUNT_B_EMAIL = "t34-account-b@example.test"
ACCOUNT_A_GENRES = [7103]  # Meadow: first recommendation is Amber Velocity.
ACCOUNT_B_GENRES = [7102]  # Tidal: first recommendation is Binary Picnic.
MOVIE_A = "10000000-0000-0000-0000-000000000001"
MOVIE_A_TITLE = "Amber Velocity"
MOVIE_B = "10000000-0000-0000-0000-000000000002"
MOVIE_B_TITLE = "Binary Picnic"
FAILURE_TRIGGER = "t34_fail_rating_update"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--browser", type=Path)
    return parser.parse_args()


def prepare_account(
    client: httpx.Client,
    *,
    email: str,
    genre_ids: list[int],
) -> str:
    registered = client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert registered.status_code == 201, registered.text
    user_id = registered.json()["data"]["user"]["id"]
    logged_in = client.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers={"Origin": BACKEND_URL},
    )
    assert logged_in.status_code == 200, logged_in.text
    saved = client.put(
        "/api/me/preferences",
        json={"genreIds": genre_ids},
        headers={"Origin": BACKEND_URL},
    )
    assert saved.status_code == 200, saved.text
    assert [genre["id"] for genre in saved.json()["data"]["genres"]] == genre_ids
    return user_id


def recommendation_ids(client: httpx.Client) -> list[str]:
    response = client.get("/api/me/recommendations?limit=10")
    assert response.status_code == 200, response.text
    return [movie["id"] for movie in response.json()["data"]["movies"]]


def database_snapshot(database_path: Path) -> dict[str, object]:
    with closing(sqlite3.connect(database_path)) as connection:
        connection.row_factory = sqlite3.Row
        ratings = [
            dict(row)
            for row in connection.execute(
                """SELECT u.email_normalized AS account, r.movie_id, r.rating
                   FROM user_movie_ratings r
                   JOIN users u ON u.id = r.user_id
                   ORDER BY u.email_normalized, r.movie_id"""
            )
        ]
        preferences = [
            dict(row)
            for row in connection.execute(
                """SELECT u.email_normalized AS account, p.genre_id
                   FROM user_genre_preferences p
                   JOIN users u ON u.id = p.user_id
                   ORDER BY u.email_normalized, p.genre_id"""
            )
        ]
        sessions = [
            dict(row)
            for row in connection.execute(
                """SELECT u.email_normalized AS account,
                          SUM(CASE WHEN s.revoked_at IS NULL
                                    AND datetime(s.expires_at) > datetime('now')
                                   THEN 1 ELSE 0 END) AS valid,
                          SUM(CASE WHEN s.revoked_at IS NULL
                                    AND datetime(s.expires_at) <= datetime('now')
                                   THEN 1 ELSE 0 END) AS expired,
                          SUM(CASE WHEN s.revoked_at IS NOT NULL THEN 1 ELSE 0 END)
                            AS revoked
                   FROM auth_sessions s
                   JOIN users u ON u.id = s.user_id
                   GROUP BY u.email_normalized
                   ORDER BY u.email_normalized"""
            )
        ]
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
    return {
        "ratings": ratings,
        "preferences": preferences,
        "sessionCounts": sessions,
        "integrityCheck": integrity,
    }


def account_rating(database_path: Path, user_id: str, movie_id: str) -> int | None:
    with closing(sqlite3.connect(database_path)) as connection:
        row = connection.execute(
            """SELECT rating FROM user_movie_ratings
               WHERE user_id = ? AND movie_id = ?""",
            (user_id, movie_id),
        ).fetchone()
    return None if row is None else row[0]


def account_preferences(database_path: Path, user_id: str) -> list[int]:
    with closing(sqlite3.connect(database_path)) as connection:
        return [
            row[0]
            for row in connection.execute(
                """SELECT genre_id FROM user_genre_preferences
                   WHERE user_id = ? ORDER BY genre_id""",
                (user_id,),
            )
        ]


def install_update_failure(database_path: Path) -> None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(
            f"""CREATE TRIGGER {FAILURE_TRIGGER}
                BEFORE UPDATE ON user_movie_ratings
                BEGIN
                  SELECT RAISE(ABORT, 'T34 injected update failure');
                END"""
        )


def remove_update_failure(database_path: Path) -> None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute(f"DROP TRIGGER IF EXISTS {FAILURE_TRIGGER}")


def make_sessions_invalid(
    database_path: Path,
    user_id: str,
    *,
    mode: str,
) -> int:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        if mode == "revoked":
            result = connection.execute(
                """UPDATE auth_sessions SET revoked_at = ?
                   WHERE user_id = ? AND revoked_at IS NULL""",
                (utc_timestamp(), user_id),
            )
        elif mode == "expired":
            expired_at = (datetime.now(UTC) - timedelta(days=1)).isoformat()
            result = connection.execute(
                """UPDATE auth_sessions SET expires_at = ?
                   WHERE user_id = ? AND revoked_at IS NULL""",
                (expired_at, user_id),
            )
        else:  # pragma: no cover - guarded by this verifier's own calls.
            raise ValueError(f"Unknown session mode: {mode}")
    assert result.rowcount > 0, f"No active session was made {mode}"
    return result.rowcount


class RatingBrowser(BrowserPage):
    """CDP page with deterministic controls and an in-page request audit."""

    def __init__(self, websocket_url: str):
        super().__init__(websocket_url)
        movie_path = json.dumps(f"/api/movies/{MOVIE_A}")
        source = f"""
          (() => {{
            const originalFetch = window.fetch.bind(window);
            const mode = new URL(window.location.href).searchParams
              .get('__t34Delay') || '';
            const state = {{
              mode,
              requests: [],
              pending: [],
              delayed: new Set(),
              released: []
            }};
            window.__t34 = {{
              state,
              release(key) {{
                const index = state.pending.findIndex(item => item.key === key);
                if (index < 0) return false;
                const [item] = state.pending.splice(index, 1);
                state.released.push(key);
                item.resolve();
                return true;
              }}
            }};
            window.fetch = async (input, init = {{}}) => {{
              const rawUrl = typeof input === 'string' ? input : input.url;
              const url = new URL(rawUrl, window.location.origin);
              const method = (init.method || 'GET').toUpperCase();
              const record = {{ method, path: url.pathname + url.search }};
              state.requests.push(record);
              try {{
                const response = await originalFetch(input, init);
                record.status = response.status;
                const key =
                  mode === 'account' && url.pathname === '/api/auth/me'
                    ? 'account'
                    : mode === 'movie' && url.pathname === {movie_path}
                      ? 'movie'
                      : '';
                if (key && !state.delayed.has(key)) {{
                  state.delayed.add(key);
                  await new Promise(resolve => state.pending.push({{ key, resolve }}));
                }}
                return response;
              }} catch (error) {{
                record.error = error instanceof Error ? error.name : 'fetch error';
                throw error;
              }}
            }};
          }})();
        """
        self.call("Page.addScriptToEvaluateOnNewDocument", {"source": source})

    def navigate_to(self, path: str) -> None:
        self.call("Page.navigate", {"url": f"{FRONTEND_URL}{path}"})

    def spa_navigate(self, path: str) -> None:
        encoded = json.dumps(path)
        changed = self.evaluate(
            f"""(() => {{
              history.pushState({{}}, '', {encoded});
              window.dispatchEvent(new PopStateEvent('popstate'));
              return location.pathname + location.search + location.hash;
            }})()"""
        )
        assert changed == path

    def snapshot(self) -> dict:
        return self.evaluate(
            """(() => ({
              url: location.href,
              path: location.pathname,
              search: location.search,
              hash: location.hash,
              mainText: document.querySelector('main')?.innerText || '',
              headerText: document.querySelector('.app-header')?.innerText || '',
              headings: [...document.querySelectorAll('h1, h2, h3')]
                .map(node => node.textContent.trim()),
              cards: [...document.querySelectorAll('article.movie-card')]
                .map(card => card.querySelector('h2')?.textContent.trim()),
              links: [...document.querySelectorAll('a')].map(node => ({
                text: node.textContent.trim(),
                ariaLabel: node.getAttribute('aria-label'),
                href: node.getAttribute('href')
              })),
              buttons: [...document.querySelectorAll('button')].map(node => ({
                text: node.textContent.trim(),
                disabled: node.disabled
              })),
              fields: [...document.querySelectorAll('input, select')].map(node => ({
                tag: node.tagName,
                type: node.type,
                checked: node.checked,
                id: node.id,
                name: node.name,
                value: node.value,
                disabled: node.disabled
              })),
              requests: window.__t34?.state?.requests || [],
              pending: (window.__t34?.state?.pending || []).map(item => item.key),
              released: window.__t34?.state?.released || []
            }))()"""
        )

    def wait_for(self, predicate, label: str, *, timeout: int = 20) -> dict:
        deadline = time.monotonic() + timeout
        last = None
        while time.monotonic() < deadline:
            try:
                last = self.snapshot()
                if last and predicate(last):
                    return last
            except RuntimeError:
                pass
            time.sleep(0.2)
        raise AssertionError(f"Timed out waiting for {label}; last state: {last}")

    def click_text(self, selector: str, text: str) -> None:
        clicked = self.evaluate(
            f"""(() => {{
              const expected = {json.dumps(text)};
              const node = [...document.querySelectorAll({json.dumps(selector)})]
                .find(candidate => candidate.textContent.trim() === expected);
              if (!node || node.disabled) return false;
              node.click();
              return true;
            }})()"""
        )
        assert clicked, f"No enabled {selector} with text {text!r}"

    def click_aria(self, label: str) -> None:
        clicked = self.evaluate(
            f"""(() => {{
              const expected = {json.dumps(label)};
              const node = [...document.querySelectorAll('[aria-label]')]
                .find(candidate => candidate.getAttribute('aria-label') === expected);
              if (!node) return false;
              node.click();
              return true;
            }})()"""
        )
        assert clicked, f"No element with aria-label {label!r}"

    def click_href(self, href: str) -> None:
        clicked = self.evaluate(
            f"""(() => {{
              const expected = {json.dumps(href)};
              const node = [...document.querySelectorAll('a')]
                .find(candidate => candidate.getAttribute('href') === expected);
              if (!node) return false;
              node.click();
              return true;
            }})()"""
        )
        assert clicked, f"No link with href {href!r}"

    def fill(self, selector: str, value: str) -> None:
        changed = self.evaluate(
            f"""(() => {{
              const node = document.querySelector({json.dumps(selector)});
              if (!(node instanceof HTMLInputElement)) return false;
              const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype, 'value'
              ).set;
              setter.call(node, {json.dumps(value)});
              node.dispatchEvent(new Event('input', {{ bubbles: true }}));
              node.dispatchEvent(new Event('change', {{ bubbles: true }}));
              return node.value === {json.dumps(value)};
            }})()"""
        )
        assert changed, f"Could not fill {selector}"

    def select_rating(self, value: int) -> None:
        changed = self.evaluate(
            f"""(() => {{
              const node = document.querySelector('.rating-form input[type="radio"][value="{value}"]');
              if (!(node instanceof HTMLInputElement) || node.matches(':disabled')) return false;
              node.click();
              return node.checked;
            }})()"""
        )
        assert changed, f"Could not select rating {value}"

    def release(self, key: str) -> None:
        released = self.evaluate(
            f"window.__t34?.release({json.dumps(key)}) || false"
        )
        assert released, f"No delayed {key} response was pending"


def login_in_browser(page: RatingBrowser, email: str) -> dict:
    page.wait_for(lambda state: state["path"] == "/login", "login page")
    intent = page.evaluate("window.history.state?.usr?.signInReturnTo || '/' ")
    destination = intent.split("?", 1)[0].split("#", 1)[0]
    if destination not in {"/preferences", "/recommendations", "/profile"}:
        destination = "/"
    page.fill("#email", email)
    page.fill("#password", PASSWORD)
    page.click_text("button", "Sign in")
    page.wait_for(
        lambda state: state["path"] == destination and email in state["headerText"],
        f"{email} authenticated landing",
    )
    # Explicit navigation replaces the historical automatic recommendation landing.
    page.click_href("/recommendations")
    return page.wait_for(
        lambda state: (
            state["path"] == "/recommendations"
            and "Recommendations" in state["headings"]
            and email in state["headerText"]
            and bool(state["cards"])
        ),
        f"{email} recommendations",
    )


def sign_out_to_login(page: RatingBrowser) -> None:
    page.spa_navigate("/recommendations")
    page.wait_for(
        lambda state: state["path"] == "/recommendations" and bool(state["cards"]),
        "recommendations before sign-out",
    )
    page.click_text("button", "Sign out")
    page.wait_for(lambda state: state["path"] == "/", "signed-out home")
    page.spa_navigate("/login")


def record_requests(records: list[dict], label: str, snapshot: dict) -> None:
    records.append({"phase": label, "requests": snapshot["requests"]})


def source_digest() -> str:
    paths = [
        Path(__file__),
        PROJECT_ROOT / "frontend/src/auth/AuthContext.tsx",
        PROJECT_ROOT / "frontend/src/components/MovieRating.tsx",
        PROJECT_ROOT / "frontend/src/pages/MovieDetailPage.tsx",
        PROJECT_ROOT / "frontend/src/pages/RecommendationsPage.tsx",
    ]
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.relative_to(PROJECT_ROOT).as_posix().encode())
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def write_result(
    output_path: Path,
    *,
    browser: Path,
    browser_product: str,
    final_database: dict[str, object],
    source_status: str,
) -> str:
    tree_state = "clean" if not source_status else "local changes present"
    result = "\n".join(
        [
            "S13 / T34 rating protection and recovery acceptance",
            f"run_at={datetime.now().astimezone().isoformat(timespec='seconds')}",
            f"base_commit={git_output('rev-parse', 'HEAD')}",
            f"working_tree={tree_state}",
            f"candidate_source_sha256={source_digest()}",
            f"python={sys.version.split()[0]}",
            f"node={command_version([node_command(), '--version'])}",
            f"browser_product={browser_product}",
            f"browser_executable={browser.resolve()}",
            "database=migrated temporary file-backed SQLite",
            "catalogue=reviewed S3-T06 deterministic fixture",
            "guest_public_detail=PASS",
            "guest_rating_action_login_without_private_mutation=PASS",
            "account_a_save_update_failure_retry=PASS",
            "account_a_b_rating_isolation=PASS",
            "delayed_account_response_isolation=PASS",
            "delayed_movie_response_isolation=PASS",
            "revoked_session_central_401=PASS",
            "expired_session_central_401=PASS",
            "zero_ratings_recommendations=PASS",
            "return_context_and_preferences=PASS",
            "recommendation_account_cache_isolation=PASS",
            f"database_integrity={final_database['integrityCheck']}",
            "independent_review=pending pull-request reviewer",
            "result=PASS",
            "",
        ]
    )
    output_path.write_text(result, encoding="utf-8")
    return result


def main() -> int:
    args = parse_args()
    # Capture source state before the evidence directory itself is created or
    # overwritten. A clean CI checkout can therefore identify its exact SHA.
    source_status = git_output("status", "--short")
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    browser_path = find_browser(args.browser)
    require_free_port(8000)
    require_free_port(5173)
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    backend_log = evidence_dir / "t34-backend-output.txt"
    frontend_log = evidence_dir / "t34-frontend-output.txt"
    browser_log = evidence_dir / "t34-browser-output.txt"
    result_output = evidence_dir / "t34-browser-run-output.txt"
    api_db_output = evidence_dir / "t34-api-db-evidence.json"
    browser_requests: list[dict] = []
    observations: dict[str, object] = {}
    browser_product = "unavailable"

    with tempfile.TemporaryDirectory(
        prefix="s13-t34-", ignore_cleanup_errors=True
    ) as temporary_directory:
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
            "--disable-dev-shm-usage",
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
            httpx.Client(base_url=BACKEND_URL, timeout=10) as guest_api,
            httpx.Client(base_url=BACKEND_URL, timeout=10) as account_a_api,
            httpx.Client(base_url=BACKEND_URL, timeout=10) as account_b_api,
        ):
            wait_for_url(f"{BACKEND_URL}/health", backend, backend_log)
            wait_for_url(FRONTEND_URL, frontend, frontend_log)

            public_detail = guest_api.get(f"/api/movies/{MOVIE_A}")
            assert public_detail.status_code == 200, public_detail.text
            guest_write = guest_api.put(
                f"/api/me/ratings/{MOVIE_A}",
                json={"rating": 5},
                headers={"Origin": BACKEND_URL},
            )
            assert guest_write.status_code == 401, guest_write.text

            account_a_id = prepare_account(
                account_a_api,
                email=ACCOUNT_A_EMAIL,
                genre_ids=ACCOUNT_A_GENRES,
            )
            account_b_id = prepare_account(
                account_b_api,
                email=ACCOUNT_B_EMAIL,
                genre_ids=ACCOUNT_B_GENRES,
            )
            recommendations_before_rating = recommendation_ids(account_a_api)
            assert recommendations_before_rating
            assert database_snapshot(database_path)["ratings"] == []

            page = RatingBrowser(browser_websocket(profile_path, browser))
            try:
                browser_product = page.call("Browser.getVersion")["product"]
                # Guest detail stays public. The rating CTA changes route only;
                # it does not issue a private rating read or write.
                page.navigate_to(f"/movies/{MOVIE_A}")
                guest = page.wait_for(
                    lambda state: (
                        MOVIE_A_TITLE in state["headings"]
                        and "Sign in to rate this movie" in state["mainText"]
                    ),
                    "guest public detail",
                )
                private_guest_requests = [
                    request
                    for request in guest["requests"]
                    if request["path"].startswith("/api/me/ratings/")
                ]
                assert private_guest_requests == []
                assert database_snapshot(database_path)["ratings"] == []
                page.screenshot(evidence_dir / "t34-01-guest-public-detail.png")
                page.click_text("a", "Sign in to rate this movie")
                page.wait_for(lambda state: state["path"] == "/login", "guest login CTA")
                assert database_snapshot(database_path)["ratings"] == []

                # Account A has recommendations before any rating. Open details
                # from a query/hash context and preserve it on the return link.
                a_recommendations = login_in_browser(page, ACCOUNT_A_EMAIL)
                assert a_recommendations["cards"][0] == MOVIE_A_TITLE
                assert account_rating(database_path, account_a_id, MOVIE_A) is None
                page.spa_navigate("/recommendations?source=t34#results")
                page.wait_for(lambda state: bool(state["cards"]), "A context list")
                page.click_aria(f"View details for {MOVIE_A_TITLE}")
                unrated = page.wait_for(
                    lambda state: (
                        state["path"] == f"/movies/{MOVIE_A}"
                        and "Not rated yet" in state["mainText"]
                    ),
                    "A unrated detail",
                )
                back_link = next(
                    link
                    for link in unrated["links"]
                    if link["href"] == "/recommendations?source=t34#results"
                )
                assert back_link["href"] == "/recommendations?source=t34#results"

                # A commits 3, an actual SQLite update failure preserves both
                # committed 3 and draft 5, then the same UI action retries to 5.
                page.select_rating(3)
                page.click_text("button", "Save rating")
                page.wait_for(
                    lambda state: (
                        "Your saved rating: 3/5" in state["mainText"]
                        and "Rating saved." in state["mainText"]
                    ),
                    "A saved rating 3",
                )
                assert account_rating(database_path, account_a_id, MOVIE_A) == 3
                page.select_rating(5)
                install_update_failure(database_path)
                try:
                    page.click_text("button", "Save rating")
                    failed = page.wait_for(
                        lambda state: (
                            "Your rating was not confirmed as saved" in state["mainText"]
                            and any(
                                button["text"] == "Retry save"
                                for button in state["buttons"]
                            )
                        ),
                        "failed update with retry",
                    )
                    selected_stars = [
                        field for field in failed["fields"]
                        if field["type"] == "radio" and field["checked"]
                    ]
                    assert len(selected_stars) == 1
                    assert selected_stars[0]["value"] == "5"
                    assert "Your saved rating: 3/5" in failed["mainText"]
                    assert account_rating(database_path, account_a_id, MOVIE_A) == 3
                    page.screenshot(evidence_dir / "t34-02-save-failure.png")
                finally:
                    remove_update_failure(database_path)

                page.click_text("button", "Retry save")
                page.wait_for(
                    lambda state: (
                        "Your saved rating: 5/5" in state["mainText"]
                        and "Rating saved." in state["mainText"]
                    ),
                    "A retry saved rating 5",
                )
                assert account_rating(database_path, account_a_id, MOVIE_A) == 5
                page.screenshot(evidence_dir / "t34-03-retry-committed.png")
                page.click_href("/recommendations?source=t34#results")
                returned = page.wait_for(
                    lambda state: (
                        state["path"] == "/recommendations"
                        and state["search"] == "?source=t34"
                        and state["hash"] == "#results"
                        and bool(state["cards"])
                    ),
                    "preserved recommendation context",
                )
                assert returned["cards"] == a_recommendations["cards"]
                assert account_preferences(database_path, account_a_id) == ACCOUNT_A_GENRES
                recommendations_after_rating = recommendation_ids(account_a_api)
                assert recommendations_after_rating == recommendations_before_rating
                record_requests(browser_requests, "guest-and-account-a", returned)

                # The same browser switches to B. B gets B's recommendation
                # response and an unrated control, never A's rating or list.
                sign_out_to_login(page)
                b_recommendations = login_in_browser(page, ACCOUNT_B_EMAIL)
                assert b_recommendations["cards"][0] == MOVIE_B_TITLE
                assert MOVIE_A_TITLE not in b_recommendations["cards"]
                assert b_recommendations["cards"] != a_recommendations["cards"]
                page.spa_navigate(f"/movies/{MOVIE_A}")
                b_unrated = page.wait_for(
                    lambda state: (
                        MOVIE_A_TITLE in state["headings"]
                        and "Not rated yet" in state["mainText"]
                    ),
                    "B does not see A rating",
                )
                assert "Your saved rating: 5/5" not in b_unrated["mainText"]
                page.select_rating(2)
                page.click_text("button", "Save rating")
                b_saved = page.wait_for(
                    lambda state: "Your saved rating: 2/5" in state["mainText"],
                    "B saved independent rating",
                )
                assert account_rating(database_path, account_a_id, MOVIE_A) == 5
                assert account_rating(database_path, account_b_id, MOVIE_A) == 2
                page.screenshot(evidence_dir / "t34-04-account-isolation.png")
                record_requests(browser_requests, "account-b-isolation", b_saved)

                # A real /auth/me response for A is held after it reaches the
                # browser. B signs in before release; the stale A response must
                # neither replace B nor restore A's private rating/cache.
                sign_out_to_login(page)
                login_in_browser(page, ACCOUNT_A_EMAIL)
                page.navigate_to(f"/movies/{MOVIE_A}?__t34Delay=account")
                delayed_account = page.wait_for(
                    lambda state: (
                        "account" in state["pending"]
                        and MOVIE_A_TITLE in state["headings"]
                    ),
                    "delayed account response",
                )
                assert "Checking sign-in status" in delayed_account["mainText"]
                page.spa_navigate("/login")
                b_after_switch = login_in_browser(page, ACCOUNT_B_EMAIL)
                assert b_after_switch["cards"][0] == MOVIE_B_TITLE
                page.release("account")
                stable_b = page.wait_for(
                    lambda state: (
                        "account" in state["released"]
                        and ACCOUNT_B_EMAIL in state["headerText"]
                        and bool(state["cards"])
                    ),
                    "B remains current after delayed A response",
                )
                time.sleep(0.4)
                stable_b = page.snapshot()
                assert ACCOUNT_A_EMAIL not in stable_b["mainText"] + stable_b["headerText"]
                assert stable_b["cards"][0] == MOVIE_B_TITLE
                page.spa_navigate(f"/movies/{MOVIE_A}")
                b_still_private = page.wait_for(
                    lambda state: "Your saved rating: 2/5" in state["mainText"],
                    "B rating after delayed account response",
                )
                assert "Your saved rating: 5/5" not in b_still_private["mainText"]
                page.screenshot(evidence_dir / "t34-05-delayed-account.png")
                record_requests(browser_requests, "delayed-account", b_still_private)

                # Hold A's movie response, move the SPA to B's movie, and then
                # release A. The old detail/rating widget must not reappear.
                page.navigate_to(f"/movies/{MOVIE_A}?__t34Delay=movie")
                page.wait_for(
                    lambda state: "movie" in state["pending"],
                    "delayed movie response",
                )
                page.spa_navigate(f"/movies/{MOVIE_B}")
                current_movie = page.wait_for(
                    lambda state: (
                        state["path"] == f"/movies/{MOVIE_B}"
                        and MOVIE_B_TITLE in state["headings"]
                        and "Not rated yet" in state["mainText"]
                    ),
                    "new movie before old response",
                )
                assert MOVIE_A_TITLE not in current_movie["headings"]
                page.release("movie")
                time.sleep(0.4)
                stable_movie = page.snapshot()
                assert MOVIE_B_TITLE in stable_movie["headings"]
                assert MOVIE_A_TITLE not in stable_movie["headings"]
                assert "Not rated yet" in stable_movie["mainText"]
                page.screenshot(evidence_dir / "t34-06-delayed-movie.png")
                record_requests(browser_requests, "delayed-movie", stable_movie)

                # Revocation and expiry each produce a real API 401. The rating
                # client invokes the central auth handler and routes to login;
                # neither failed write changes committed ratings.
                revoked_count = make_sessions_invalid(
                    database_path, account_b_id, mode="revoked"
                )
                page.select_rating(4)
                page.click_text("button", "Save rating")
                revoked = page.wait_for(
                    lambda state: state["path"] == "/login",
                    "revoked-session central 401 recovery",
                )
                assert account_rating(database_path, account_b_id, MOVIE_B) is None
                assert account_rating(database_path, account_b_id, MOVIE_A) == 2
                page.screenshot(evidence_dir / "t34-07-revoked-session.png")
                record_requests(browser_requests, "revoked-session", revoked)

                login_in_browser(page, ACCOUNT_A_EMAIL)
                page.spa_navigate(f"/movies/{MOVIE_A}")
                page.wait_for(
                    lambda state: "Your saved rating: 5/5" in state["mainText"],
                    "A restored before expiry",
                )
                expired_count = make_sessions_invalid(
                    database_path, account_a_id, mode="expired"
                )
                page.select_rating(4)
                page.click_text("button", "Save rating")
                expired = page.wait_for(
                    lambda state: state["path"] == "/login",
                    "expired-session central 401 recovery",
                )
                assert account_rating(database_path, account_a_id, MOVIE_A) == 5
                page.screenshot(evidence_dir / "t34-08-expired-session.png")
                record_requests(browser_requests, "expired-session", expired)

                observations = {
                    "guest": {
                        "publicDetailStatus": public_detail.status_code,
                        "privateWriteStatus": guest_write.status_code,
                        "privateBrowserRatingRequests": private_guest_requests,
                    },
                    "recommendations": {
                        "zeroRatingsAccountAIds": recommendations_before_rating,
                        "afterRatingAccountAIds": recommendations_after_rating,
                        "accountABrowserTitles": a_recommendations["cards"],
                        "accountBBrowserTitles": b_recommendations["cards"],
                    },
                    "failureRecovery": {
                        "committedBeforeFailure": 3,
                        "draftDuringFailure": 5,
                        "committedAfterRetry": 5,
                    },
                    "sessionsInvalidated": {
                        "revokedAccountB": revoked_count,
                        "expiredAccountA": expired_count,
                    },
                    "browserRequests": browser_requests,
                }
            finally:
                page.close()

        final_database = database_snapshot(database_path)
        expected_ratings = [
            {"account": ACCOUNT_A_EMAIL, "movie_id": MOVIE_A, "rating": 5},
            {"account": ACCOUNT_B_EMAIL, "movie_id": MOVIE_A, "rating": 2},
        ]
        assert final_database["ratings"] == expected_ratings
        assert final_database["preferences"] == [
            {"account": ACCOUNT_A_EMAIL, "genre_id": ACCOUNT_A_GENRES[0]},
            {"account": ACCOUNT_B_EMAIL, "genre_id": ACCOUNT_B_GENRES[0]},
        ]
        assert final_database["integrityCheck"] == "ok"
        api_db_output.write_text(
            json.dumps(
                {
                    "observations": observations,
                    "finalDatabase": final_database,
                },
                indent=2,
                sort_keys=True,
            )
            + "\n",
            encoding="utf-8",
        )
        remove_temporary_database(database_path)

    result = write_result(
        result_output,
        browser=browser_path,
        browser_product=browser_product,
        final_database=final_database,
        source_status=source_status,
    )
    print(result, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
