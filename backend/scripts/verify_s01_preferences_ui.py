"""Verify Story #17 in Chrome against an already imported TMDb SQLite database.

Use a disposable database: this journey creates two accounts and preferences.
The script starts the real API and Vite UI, then begins at the first screen.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import sys
import tempfile
import time
from contextlib import closing
from pathlib import Path

from verify_s02_recommendations_ui import (
    BrowserPage,
    browser_websocket,
    require_free_port,
)
from verify_s09_popular_ui import (
    BACKEND_URL,
    FRONTEND_URL,
    PROJECT_ROOT,
    find_browser,
    git_output,
    node_command,
    running_process,
    sqlite_url,
    utc_timestamp,
    wait_for_url,
)

PASSWORD = "t22-browser-password"


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--browser", type=Path)
    return parser.parse_args()


def database_state(path: Path) -> tuple[str, int, int]:
    with closing(sqlite3.connect(path)) as db:
        row = db.execute(
            """SELECT r.provider,
                      (SELECT COUNT(*) FROM catalog_movies m
                       WHERE m.catalogue_revision_id = r.id),
                      (SELECT COUNT(DISTINCT mg.genre_id) FROM movie_genres mg
                       JOIN catalog_movies m ON m.id = mg.movie_id
                       WHERE m.catalogue_revision_id = r.id)
               FROM catalogue_state s JOIN catalogue_revisions r
               ON r.id = s.active_revision_id WHERE s.id = 1"""
        ).fetchone()
    if row is None or row[0] != "tmdb" or row[1] < 1 or row[2] < 6:
        raise RuntimeError("Need an active TMDb import with at least six genres")
    return row


def saved(path: Path, email: str) -> list[int]:
    with closing(sqlite3.connect(path)) as db:
        return [
            row[0]
            for row in db.execute(
                """SELECT p.genre_id FROM user_genre_preferences p
                   JOIN users u ON u.id = p.user_id
                   WHERE u.email_normalized = ? ORDER BY p.genre_id""",
                (email,),
            )
        ]


class JourneyPage(BrowserPage):
    def navigate_home(self) -> None:
        self.call("Page.navigate", {"url": f"{FRONTEND_URL}/"})

    def snapshot(self) -> dict:
        return self.evaluate(
            """(() => ({
              path: location.pathname,
              heading: document.querySelector('main h1')?.textContent.trim(),
              links: [...document.querySelectorAll('a')].map(x => x.textContent.trim()),
              buttons: [...document.querySelectorAll('button')].map(x => x.textContent.trim()),
              alerts: [...document.querySelectorAll('[role="alert"]')]
                .map(x => x.textContent.trim()),
              selected: [...document.querySelectorAll('.genre-option input:checked')]
                .map(x => x.closest('label')?.textContent.trim()),
              available: [...document.querySelectorAll('.genre-option input')]
                .map(x => x.closest('label')?.textContent.trim()),
              count: document.querySelector('#genre-selection-count')?.textContent.trim(),
              recommendationHeading: document.querySelector('.recommendations-card h2')
                ?.textContent.trim(),
              cards: document.querySelectorAll('article.movie-card').length
            }))()"""
        )

    def click(self, selector: str, label: str) -> None:
        clicked = self.evaluate(
            f"""(() => {{
              const item = [...document.querySelectorAll({json.dumps(selector)})]
                .find(x => x.textContent.trim() === {json.dumps(label)});
              if (!item) return false;
              item.click(); return true;
            }})()"""
        )
        assert clicked, f"Visible control missing: {selector} {label}"

    def set_field(self, selector: str, value: str) -> None:
        changed = self.evaluate(
            f"""(() => {{
              const item = document.querySelector({json.dumps(selector)});
              if (!item) return false;
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
                .set.call(item, {json.dumps(value)});
              item.dispatchEvent(new Event('input', {{bubbles: true}}));
              return true;
            }})()"""
        )
        assert changed, f"Input missing: {selector}"

    def toggle_genre(self, name: str) -> None:
        toggled = self.evaluate(
            f"""(() => {{
              const label = [...document.querySelectorAll('.genre-option')]
                .find(x => x.textContent.trim() === {json.dumps(name)});
              if (!label) return false;
              label.querySelector('input').click(); return true;
            }})()"""
        )
        assert toggled, f"Genre missing: {name}"

    def api_put(self, ids: list[int]) -> dict:
        return self.evaluate(
            f"""(async () => {{
              const response = await fetch('/api/me/preferences', {{
                method: 'PUT', credentials: 'include',
                headers: {{'Content-Type': 'application/json'}},
                body: JSON.stringify({{'genreIds': {json.dumps(ids)}}})
              }});
              return {{status: response.status, body: await response.json()}};
            }})()"""
        )

    def api_genres(self) -> list[dict]:
        return self.evaluate(
            "(async () => (await (await fetch('/api/genres', {credentials: 'include'})).json()).data.genres)()"
        )

    def register_and_sign_in(self, email: str) -> None:
        self.click("a", "Create an account")
        self.wait_for(lambda s: s["path"] == "/register", "registration")
        self.set_field("#register-email", email)
        self.set_field("#register-password", PASSWORD)
        self.click("button", "Create account")
        self.wait_for(lambda s: s["path"] == "/login", "login after registration")
        self.set_field("#email", email)
        self.set_field("#password", PASSWORD)
        self.click("button", "Sign in")
        self.wait_for(
            lambda s: s["path"] == "/recommendations", "signed-in recommendations"
        )

    def return_to_preferences(self) -> dict:
        self.click("a", "Change my genres")
        return self.wait_for(
            lambda s: s["path"] == "/preferences" and len(s["available"]) >= 6,
            "saved preference picker",
        )


def main() -> int:
    args = arguments()
    database = args.database.resolve()
    evidence = args.evidence_dir.resolve()
    evidence.mkdir(parents=True, exist_ok=True)
    provider, movie_count, genre_count = database_state(database)
    browser = find_browser(args.browser)
    require_free_port(8000)
    require_free_port(5173)
    suffix = str(int(time.time()))
    account_a = f"t22-a-{suffix}@example.test"
    account_b = f"t22-b-{suffix}@example.test"
    environment = os.environ | {
        "DATABASE_URL": sqlite_url(database),
        "TMDB_READ_ACCESS_TOKEN": "",
    }
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
    with tempfile.TemporaryDirectory(prefix="s01-t22-") as temporary:
        profile = Path(temporary) / "browser-profile"
        browser_command = [
            str(browser),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--remote-allow-origins=*",
            "--remote-debugging-port=0",
            "--window-size=1440,1000",
            f"--user-data-dir={profile}",
            "about:blank",
        ]
        backend_log = evidence / "t22-backend-output.txt"
        frontend_log = evidence / "t22-frontend-output.txt"
        browser_log = evidence / "t22-browser-output.txt"
        with (
            running_process(
                backend_command, environment=environment, output_path=backend_log
            ) as backend,
            running_process(
                frontend_command, environment=environment, output_path=frontend_log
            ) as frontend,
            running_process(
                browser_command, environment=environment, output_path=browser_log
            ) as chrome,
        ):
            wait_for_url(f"{BACKEND_URL}/health", backend, backend_log)
            wait_for_url(FRONTEND_URL, frontend, frontend_log)
            page = JourneyPage(browser_websocket(profile, chrome))
            try:
                page.navigate_home()
                page.wait_for(
                    lambda s: s["path"] == "/" and "Start" in s["links"], "first screen"
                )
                assert "pick up to 5 favourite genres" in page.evaluate(
                    "document.body.textContent"
                )
                page.click("a", "Start")
                page.wait_for(lambda s: s["path"] == "/login", "protected Start login")
                page.register_and_sign_in(account_a)
                page.click("a", "Browse the catalogue")
                page.wait_for(lambda s: s["path"] == "/", "home after sign in")
                page.click("a", "Start")
                picker = page.wait_for(
                    lambda s: s["path"] == "/preferences" and len(s["available"]) >= 6,
                    "catalogue-backed genres",
                )
                assert picker["count"] == "0 of 5 selected"
                names = picker["available"][:6]
                page.screenshot(evidence / "t22-start-preferences.png")

                page.click("button", "Save preferences")
                empty = page.wait_for(
                    lambda s: any(
                        "Select at least one genre" in a for a in s["alerts"]
                    ),
                    "zero-choice validation",
                )
                assert (
                    empty["path"] == "/preferences" and saved(database, account_a) == []
                )
                page.screenshot(evidence / "t22-zero-rejected.png")

                page.toggle_genre(names[0])
                page.click("button", "Save preferences")
                page.wait_for(
                    lambda s: (
                        s["path"] == "/recommendations"
                        and s["recommendationHeading"] == "Recommended for you"
                        and s["cards"] > 0
                    ),
                    "one-genre recommendations",
                )
                assert len(saved(database, account_a)) == 1
                page.screenshot(evidence / "t22-one-saved-recommendations.png")
                one_genre = saved(database, account_a)
                returned = page.return_to_preferences()
                assert returned["selected"] == names[:1]
                page.screenshot(evidence / "t22-one-restored.png")

                page.toggle_genre(names[0])
                page.click("button", "Save preferences")
                page.wait_for(
                    lambda s: any(
                        "Select at least one genre" in a for a in s["alerts"]
                    ),
                    "invalid replacement guidance",
                )
                assert saved(database, account_a) == one_genre
                assert page.api_put([])["status"] == 400
                assert saved(database, account_a) == one_genre

                for name in names[:5]:
                    page.toggle_genre(name)
                assert page.snapshot()["count"] == "5 of 5 selected"
                page.toggle_genre(names[5])
                limited = page.snapshot()
                assert any(
                    "You can select up to 5 genres" in a for a in limited["alerts"]
                )
                assert (
                    limited["selected"] == names[:5]
                    and limited["count"] == "5 of 5 selected"
                )
                page.screenshot(evidence / "t22-sixth-rejected.png")
                page.click("button", "Save preferences")
                page.wait_for(
                    lambda s: (
                        s["path"] == "/recommendations"
                        and s["recommendationHeading"] == "Recommended for you"
                        and s["cards"] > 0
                    ),
                    "five-genre recommendations",
                )
                five_genres = saved(database, account_a)
                assert len(five_genres) == 5
                sixth_id = next(
                    genre["id"]
                    for genre in page.api_genres()
                    if genre["id"] not in five_genres
                )
                sixth_response = page.api_put(five_genres + [sixth_id])
                assert sixth_response["status"] == 400
                assert sixth_response["body"]["error"]["code"] == "VALIDATION_ERROR"
                assert saved(database, account_a) == five_genres
                page.screenshot(evidence / "t22-five-saved-recommendations.png")
                returned = page.return_to_preferences()
                assert returned["selected"] == names[:5]

                page.toggle_genre(names[0])
                page.toggle_genre(names[5])
                draft = page.snapshot()["selected"]
                page.call("Network.setBlockedURLs", {"urls": ["*api/me/preferences*"]})
                page.click("button", "Save preferences")
                failed = page.wait_for(
                    lambda s: any("try again" in a for a in s["alerts"]),
                    "save request failure",
                )
                assert failed["path"] == "/preferences" and failed["selected"] == draft
                assert saved(database, account_a) == five_genres
                page.screenshot(evidence / "t22-draft-retry.png")
                page.call("Network.setBlockedURLs", {"urls": []})
                page.click("button", "Save preferences")
                page.wait_for(
                    lambda s: (
                        s["path"] == "/recommendations"
                        and s["recommendationHeading"] == "Recommended for you"
                        and s["cards"] > 0
                    ),
                    "recovered save",
                )
                recovered = saved(database, account_a)
                assert len(recovered) == 5 and recovered != five_genres

                page.click("button", "Sign out")
                page.wait_for(lambda s: s["path"] == "/", "sign out A")
                page.click("a", "Start")
                page.wait_for(lambda s: s["path"] == "/login", "Start for B")
                page.register_and_sign_in(account_b)
                second = page.return_to_preferences()
                assert second["selected"] == [] and saved(database, account_b) == []
                page.screenshot(evidence / "t22-account-b-empty.png")
                page.toggle_genre(names[1])
                page.click("button", "Save preferences")
                page.wait_for(lambda s: s["path"] == "/recommendations", "B save")
                assert len(saved(database, account_b)) == 1
                assert saved(database, account_a) == recovered
                page.screenshot(evidence / "t22-account-b.png")
            finally:
                page.close()

    result = "\n".join(
        [
            "S01 / T22 real-browser, database-backed acceptance",
            f"run_at={utc_timestamp()}",
            f"tested_sha={git_output('rev-parse', 'HEAD')}",
            f"browser={browser.resolve()}",
            f"catalogue_provider={provider}; active_movies={movie_count}; active_genres={genre_count}",
            "AC1=PASS; first-screen Start reaches authenticated catalogue genres",
            "AC2=PASS; one and five save to SQLite and open recommendations",
            "AC3=PASS; zero choices show correction and preserve saved state",
            "AC4=PASS; sixth choice shows limit and preserves first five",
            "AC5=PASS; saved choices restore; second account starts empty",
            "request_failure=PASS; editable draft kept and visible Save retry succeeds",
            "server_validation=PASS; zero and sixth IDs rejected without overwriting saved rows",
            "result=PASS",
            "",
        ]
    )
    (evidence / "t22-browser-run-output.txt").write_text(result, encoding="utf-8")
    print(result, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
