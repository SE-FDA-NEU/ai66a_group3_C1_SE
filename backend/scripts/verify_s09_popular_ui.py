"""Exercise S09's three acceptance criteria through the running UI.

The verifier creates a migrated, file-backed SQLite database in a temporary
directory, starts the real FastAPI and Vite services, and uses an installed
Chromium browser to render ``/popular``. It never reads or changes the normal
development database.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
from collections.abc import Iterator
from contextlib import closing, contextmanager
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import URLError
from urllib.request import urlopen
from uuid import uuid4

PROJECT_ROOT = Path(__file__).resolve().parents[2]
BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"
EMPTY_MESSAGE = "Popular movies are not available yet"

POPULAR_FIXTURE = [
    ("Alpha 95", 95.0),
    ("Beta 80", 80.0),
    ("Candidate 03", 75.0),
    ("Candidate 04", 70.0),
    ("Candidate 05", 65.0),
    ("Candidate 06", 60.0),
    ("Candidate 07", 55.0),
    ("Candidate 08", 50.0),
    ("Candidate 09", 45.0),
    ("Candidate 10", 40.0),
    ("Excluded 11", 35.0),
]
EXPECTED_TOP_TEN = [title for title, _score in POPULAR_FIXTURE[:10]]


class PopularPageParser(HTMLParser):
    """Collect movie-card and status-panel headings from rendered HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.movie_titles: list[str] = []
        self.status_headings: list[str] = []
        self._article_depth = 0
        self._status_depth = 0
        self._article_heading: list[str] | None = None
        self._status_heading: list[str] | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = set((attributes.get("class") or "").split())

        if self._article_depth:
            self._article_depth += 1
            if tag == "h2":
                self._article_heading = []
        elif tag == "article" and "movie-card" in classes:
            self._article_depth = 1

        if self._status_depth:
            self._status_depth += 1
            if tag == "h2":
                self._status_heading = []
        elif tag == "section" and "status-panel" in classes:
            self._status_depth = 1

    def handle_data(self, data: str) -> None:
        if self._article_heading is not None:
            self._article_heading.append(data)
        if self._status_heading is not None:
            self._status_heading.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "h2" and self._article_heading is not None:
            self.movie_titles.append("".join(self._article_heading).strip())
            self._article_heading = None
        if tag == "h2" and self._status_heading is not None:
            self.status_headings.append("".join(self._status_heading).strip())
            self._status_heading = None

        if self._article_depth:
            self._article_depth -= 1
        if self._status_depth:
            self._status_depth -= 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--evidence-dir",
        type=Path,
        required=True,
        help="Directory that receives screenshots and command output.",
    )
    parser.add_argument(
        "--browser",
        type=Path,
        help="Optional explicit path to Chrome, Chromium, or Edge.",
    )
    return parser.parse_args()


def sqlite_url(database_path: Path) -> str:
    return f"sqlite:///{database_path.resolve().as_posix()}"


def run_migrations(database_url: str, environment: dict[str, str]) -> None:
    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "backend/alembic.ini",
            "upgrade",
            "head",
        ],
        cwd=PROJECT_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Alembic migration failed:\n{completed.stdout}\n{completed.stderr}"
        )


def utc_timestamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def seed_database(database_path: Path) -> tuple[str, str]:
    """Insert deterministic acceptance fixtures into the migrated database."""

    popular_revision_id = str(uuid4())
    empty_revision_id = str(uuid4())
    created_at = utc_timestamp()

    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executemany(
            """
            INSERT INTO catalogue_revisions (
                id,
                provider,
                created_at,
                inserted_movie_count,
                updated_movie_count,
                rejected_movie_count
            ) VALUES (?, ?, ?, ?, 0, 0)
            """,
            [
                (
                    popular_revision_id,
                    "t21-acceptance",
                    created_at,
                    len(POPULAR_FIXTURE),
                ),
                (
                    empty_revision_id,
                    "t21-empty-acceptance",
                    created_at,
                    2,
                ),
            ],
        )
        connection.executemany(
            """
            INSERT INTO catalog_movies (
                id,
                catalogue_revision_id,
                source,
                source_id,
                title,
                release_year,
                overview,
                popularity_score,
                vote_average,
                vote_count,
                source_fetched_at
            ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, ?)
            """,
            [
                (
                    str(uuid4()),
                    popular_revision_id,
                    "t21-acceptance",
                    f"popular-{index:02d}",
                    title,
                    2026,
                    score,
                    created_at,
                )
                for index, (title, score) in enumerate(POPULAR_FIXTURE, start=1)
            ],
        )
        connection.executemany(
            """
            INSERT INTO catalog_movies (
                id,
                catalogue_revision_id,
                source,
                source_id,
                title,
                release_year,
                overview,
                popularity_score,
                vote_average,
                vote_count,
                source_fetched_at
            ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?)
            """,
            [
                (
                    str(uuid4()),
                    empty_revision_id,
                    "t21-empty-acceptance",
                    f"missing-popularity-{index}",
                    f"Missing popularity {index}",
                    created_at,
                )
                for index in range(1, 3)
            ],
        )
        connection.execute(
            """
            INSERT INTO catalogue_state (id, active_revision_id, updated_at)
            VALUES (1, ?, ?)
            """,
            (popular_revision_id, created_at),
        )

    return popular_revision_id, empty_revision_id


def activate_revision(database_path: Path, revision_id: str) -> None:
    with closing(sqlite3.connect(database_path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute(
            """
                UPDATE catalogue_state
                SET active_revision_id = ?, updated_at = ?
                WHERE id = 1
                """,
            (revision_id, utc_timestamp()),
        )


def find_browser(explicit_browser: Path | None) -> Path:
    if explicit_browser is not None:
        browser = explicit_browser.resolve()
        if browser.is_file():
            return browser
        raise FileNotFoundError(f"Browser does not exist: {browser}")

    candidates = [
        shutil.which("google-chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise FileNotFoundError(
        "No Chromium browser found. Pass --browser with a Chrome, Chromium, "
        "or Edge executable."
    )


def command_version(command: list[str]) -> str:
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return (completed.stdout or completed.stderr).strip()


def node_command() -> str:
    command = shutil.which("node")
    if command is None:
        raise FileNotFoundError("Node.js is required to start the Vite UI")
    vite_entrypoint = PROJECT_ROOT / "frontend/node_modules/vite/bin/vite.js"
    if not vite_entrypoint.is_file():
        raise FileNotFoundError(
            "Vite is not installed. Run `npm --prefix frontend ci` first."
        )
    return command


@contextmanager
def running_process(
    command: list[str],
    *,
    environment: dict[str, str],
    output_path: Path,
) -> Iterator[subprocess.Popen[str]]:
    creation_flags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0
    with output_path.open("w", encoding="utf-8") as output:
        process = subprocess.Popen(
            command,
            cwd=PROJECT_ROOT,
            env=environment,
            stdout=output,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creation_flags,
        )
        try:
            yield process
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=10)


def wait_for_url(url: str, process: subprocess.Popen[str], output_path: Path) -> None:
    deadline = time.monotonic() + 30
    last_error = "service did not answer"
    while time.monotonic() < deadline:
        if process.poll() is not None:
            output = output_path.read_text(encoding="utf-8", errors="replace")
            raise RuntimeError(f"Service exited with {process.returncode}:\n{output}")
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, URLError) as error:
            last_error = str(error)
        time.sleep(0.25)
    raise TimeoutError(f"Timed out waiting for {url}: {last_error}")


def read_json(url: str) -> dict[str, object]:
    with urlopen(url, timeout=5) as response:
        return json.loads(response.read().decode("utf-8"))


def render_page(
    browser: Path,
    *,
    profile_path: Path,
    screenshot_path: Path,
) -> PopularPageParser:
    command = [
        str(browser),
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--hide-scrollbars",
        "--window-size=1440,1000",
        "--virtual-time-budget=5000",
        f"--user-data-dir={profile_path.resolve()}",
        f"--screenshot={screenshot_path.resolve()}",
        "--dump-dom",
        f"{FRONTEND_URL}/popular",
    ]
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=45,
    )
    if completed.returncode != 0:
        raise RuntimeError(
            f"Headless browser failed:\n{completed.stdout}\n{completed.stderr}"
        )
    if not screenshot_path.is_file():
        raise RuntimeError(f"Browser did not create {screenshot_path}")

    parsed = PopularPageParser()
    parsed.feed(completed.stdout)
    return parsed


def git_output(*args: str) -> str:
    completed = subprocess.run(
        ["git", *args],
        cwd=PROJECT_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    return completed.stdout.strip() if completed.returncode == 0 else "unavailable"


def assert_api_titles(payload: dict[str, object], expected: list[str]) -> None:
    data = payload.get("data")
    if not isinstance(data, dict):
        raise TypeError(f"API response has no data object: {payload}")
    movies = data.get("movies")
    if not isinstance(movies, list):
        raise TypeError(f"API response has no movie list: {payload}")
    titles = [movie.get("title") for movie in movies if isinstance(movie, dict)]
    assert titles == expected, f"Unexpected API order: {titles}"


def remove_temporary_database(database_path: Path) -> None:
    """Wait for Windows to release the just-stopped server's SQLite handle."""

    for attempt in range(20):
        try:
            database_path.unlink()
            return
        except PermissionError:
            if attempt == 19:
                raise
            time.sleep(0.25)


def write_result(output_path: Path, browser: Path) -> str:
    status = git_output("status", "--short")
    tree_state = "clean" if not status else "local changes present"
    result = "\n".join(
        [
            "S09 / T21 real-DB UI acceptance",
            f"run_at={datetime.now().astimezone().isoformat(timespec='seconds')}",
            f"base_commit={git_output('rev-parse', 'HEAD')}",
            f"working_tree={tree_state}",
            f"python={sys.version.split()[0]}",
            f"node={command_version([node_command(), '--version'])}",
            f"browser_executable={browser.resolve()}",
            "database=migrated temporary file-backed SQLite",
            "guest_route=/popular",
            "request=/api/movies/popular?limit=10",
            "seeded_popular_movies=11",
            f"ui_titles={json.dumps(EXPECTED_TOP_TEN)}",
            "visible_cards=10",
            "excluded_title=Excluded 11",
            "ordering=Alpha 95 before Beta 80",
            f"empty_message={EMPTY_MESSAGE}",
            "empty_visible_cards=0",
            "result=PASS",
            "",
        ]
    )
    output_path.write_text(result, encoding="utf-8")
    return result


def main() -> int:
    args = parse_args()
    evidence_dir = args.evidence_dir.resolve()
    evidence_dir.mkdir(parents=True, exist_ok=True)
    browser = find_browser(args.browser)

    backend_output = evidence_dir / "t21-backend-output.txt"
    frontend_output = evidence_dir / "t21-frontend-output.txt"
    popular_screenshot = evidence_dir / "t21-popular-top-ten.png"
    empty_screenshot = evidence_dir / "t21-popular-empty-state.png"
    result_output = evidence_dir / "t21-browser-run-output.txt"

    with tempfile.TemporaryDirectory(prefix="s09-t21-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        database_path = temporary_path / "acceptance.db"
        database_url = sqlite_url(database_path)
        environment = os.environ | {
            "DATABASE_URL": database_url,
            "TMDB_READ_ACCESS_TOKEN": "",
        }
        run_migrations(database_url, environment)
        _popular_revision_id, empty_revision_id = seed_database(database_path)

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

        with (
            running_process(
                backend_command,
                environment=environment,
                output_path=backend_output,
            ) as backend,
            running_process(
                frontend_command,
                environment=environment,
                output_path=frontend_output,
            ) as frontend,
        ):
            wait_for_url(f"{BACKEND_URL}/health", backend, backend_output)
            wait_for_url(FRONTEND_URL, frontend, frontend_output)

            popular_api = read_json(f"{BACKEND_URL}/api/movies/popular?limit=10")
            assert_api_titles(popular_api, EXPECTED_TOP_TEN)

            popular_page = render_page(
                browser,
                profile_path=temporary_path / "popular-browser-profile",
                screenshot_path=popular_screenshot,
            )
            assert popular_page.movie_titles == EXPECTED_TOP_TEN, (
                f"Unexpected UI order: {popular_page.movie_titles}"
            )
            assert len(popular_page.movie_titles) == 10
            assert "Excluded 11" not in popular_page.movie_titles
            assert popular_page.movie_titles.index("Alpha 95") < (
                popular_page.movie_titles.index("Beta 80")
            )

            activate_revision(database_path, empty_revision_id)
            empty_api = read_json(f"{BACKEND_URL}/api/movies/popular?limit=10")
            assert_api_titles(empty_api, [])

            empty_page = render_page(
                browser,
                profile_path=temporary_path / "empty-browser-profile",
                screenshot_path=empty_screenshot,
            )
            assert empty_page.movie_titles == []
            assert empty_page.status_headings == [EMPTY_MESSAGE], (
                "Empty-state heading must match the Story wording exactly: "
                f"{empty_page.status_headings}"
            )

        remove_temporary_database(database_path)

    result = write_result(result_output, browser)
    print(result, end="")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
