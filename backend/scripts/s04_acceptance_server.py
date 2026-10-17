"""Test-only S04 HTTP harness; never imported by the production application.

Uses the parent runner's temporary SQLite DB. Controls change actual catalogue data or
delay already-computed ASGI responses; auth, routes, queries and JSON stay real.
Run only via run-s04-e2e.mjs, bound to loopback on a dedicated port.
"""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import subprocess
import sys
from contextlib import closing
from pathlib import Path

from verify_s09_popular_ui import run_migrations, sqlite_url, utc_timestamp

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "backend/tests/fixtures/s04_browser_acceptance.json"


def seed_database(path: Path, fixture: dict) -> None:
    now = utc_timestamp()
    with closing(sqlite3.connect(path)) as connection, connection:
        connection.execute("PRAGMA foreign_keys=ON")
        connection.executemany(
            "INSERT INTO genres (id, name) VALUES (?, ?)",
            [(genre["id"], genre["name"]) for genre in fixture["genres"]],
        )
        connection.executemany(
            """INSERT INTO catalogue_revisions
               (id, provider, created_at, inserted_movie_count,
                updated_movie_count, rejected_movie_count)
               VALUES (?, 's04-synthetic', ?, ?, 0, 0)""",
            [
                (fixture["revision"], now, len(fixture["movies"])),
                ("s04-empty", now, 0),
                ("s04-retired", now, 0),
            ],
        )
        # Reverse insertion order: B/C tie-breaking must come from SQL ordering.
        connection.executemany(
            """INSERT INTO catalog_movies
               (id, catalogue_revision_id, source, source_id, title,
                popularity_score, source_fetched_at)
               VALUES (?, ?, 's04-synthetic', ?, ?, ?, ?)""",
            [
                (
                    row["id"],
                    fixture["revision"],
                    row["id"],
                    row["title"],
                    row["popularity"],
                    now,
                )
                for row in reversed(fixture["movies"])
            ],
        )
        connection.executemany(
            "INSERT INTO movie_genres (movie_id, genre_id) VALUES (?, ?)",
            [
                (row["id"], genre)
                for row in fixture["movies"]
                for genre in row["genreIds"]
            ],
        )
        connection.execute(
            "INSERT INTO catalogue_state VALUES (1, ?, ?)", (fixture["revision"], now)
        )


def build_harness(path: Path, fixture: dict):
    from app.main import app as production_app
    from fastapi import FastAPI, HTTPException

    controls = FastAPI()
    gates: dict[str, dict] = {}
    capturing: str | None = None
    broken = False

    def gate_state(gate: dict) -> dict:
        return {key: value for key, value in gate.items() if key != "event"}

    @controls.get("/__acceptance/ready")
    def ready():
        with closing(sqlite3.connect(path)) as connection:
            migration = connection.execute(
                "SELECT version_num FROM alembic_version"
            ).fetchone()[0]
            catalogue = connection.execute(
                """SELECT r.provider, r.id, COUNT(m.id) FROM catalogue_state s
                   JOIN catalogue_revisions r ON r.id=s.active_revision_id
                   LEFT JOIN catalog_movies m ON m.catalogue_revision_id=r.id
                   GROUP BY r.id"""
            ).fetchone()
        return {
            "harness": "s04-temporary-db",
            "migrationVersion": migration,
            "catalogue": catalogue,
        }

    @controls.post("/__acceptance/scenario/{name}")
    def scenario(name: str):
        nonlocal broken
        if name not in {
            "ranked",
            "empty",
            "no-popularity",
            "db-failure",
            "no-match",
            "no-match-no-popularity",
        }:
            raise HTTPException(400, "Unknown fixture")
        with closing(sqlite3.connect(path)) as connection, connection:
            if broken:
                connection.execute(
                    "ALTER TABLE catalog_movies_unavailable RENAME TO catalog_movies"
                )
                broken = False
            connection.executemany(
                "UPDATE catalog_movies SET popularity_score = ? WHERE id = ?",
                [(row["popularity"], row["id"]) for row in fixture["movies"]],
            )
            connection.execute(
                "UPDATE catalog_movies SET catalogue_revision_id = ?",
                (fixture["revision"],),
            )
            connection.execute(
                "UPDATE catalogue_state SET active_revision_id = ? WHERE id = 1",
                ("s04-empty" if name == "empty" else fixture["revision"],),
            )
            if name in {"no-match", "no-match-no-popularity"}:
                # The genre was selectable when the editor opened. Retire its
                # only movie before saving: a genuine canonical-but-no-match
                # preference, as can happen after a catalogue refresh.
                connection.execute(
                    """UPDATE catalog_movies SET catalogue_revision_id = 's04-retired'
                       WHERE id IN (SELECT movie_id FROM movie_genres WHERE genre_id = 8103)"""
                )
            if name in {"no-popularity", "no-match-no-popularity"}:
                # Real SQLite rows exist, but none has a finite popularity score.
                connection.executemany(
                    "UPDATE catalog_movies SET popularity_score = ? WHERE id = ?",
                    [
                        ((None, float("inf"), -float("inf"))[i % 3], row["id"])
                        for i, row in enumerate(fixture["movies"])
                    ],
                )
            if name == "db-failure":
                connection.execute(
                    "ALTER TABLE catalog_movies RENAME TO catalog_movies_unavailable"
                )
                broken = True
            preferences = connection.execute(
                "SELECT user_id, genre_id FROM user_genre_preferences ORDER BY 1, 2"
            ).fetchall()
            table = "catalog_movies_unavailable" if broken else "catalog_movies"
            count, finite = connection.execute(
                f"""SELECT COUNT(*), SUM(CASE WHEN popularity_score IS NOT NULL
                    AND popularity_score > -1e999 AND popularity_score < 1e999
                    THEN 1 ELSE 0 END) FROM {table}
                    WHERE catalogue_revision_id =
                    (SELECT active_revision_id FROM catalogue_state WHERE id = 1)"""
            ).fetchone()
        return {
            "scenario": name,
            "preferences": preferences,
            "activeMovies": count,
            "finitePopularity": finite or 0,
        }

    @controls.post("/__acceptance/gates/{name}/{action}")
    async def control_gate(name: str, action: str):
        nonlocal capturing
        if action == "arm":
            if capturing is not None or name in gates:
                raise HTTPException(409, "Gate already exists or is capturing")
            gates[name] = {"event": asyncio.Event(), "responses": [], "completed": 0}
            capturing = name
        elif name not in gates:
            raise HTTPException(404, "Unknown gate")
        elif action == "seal":
            if capturing == name:
                capturing = None
        elif action == "release":
            gates[name]["event"].set()
        else:
            raise HTTPException(400, "Unknown gate action")
        return gate_state(gates[name])

    @controls.get("/__acceptance/gates/{name}")
    def inspect_gate(name: str):
        return gate_state(gates[name])

    @controls.post("/__acceptance/release-gates")
    async def release_gates():
        nonlocal capturing
        capturing = None
        for gate in gates.values():
            gate["event"].set()
        return {"released": len(gates)}

    class DelayRealRecommendations:
        async def __call__(self, scope, receive, send):
            name = capturing
            if (
                scope["type"] != "http"
                or scope["path"] != "/api/me/recommendations"
                or name is None
            ):
                return await production_app(scope, receive, send)
            messages = []

            async def capture(message):
                messages.append(message)

            await production_app(scope, receive, capture)
            gate = gates[name]
            gate["responses"].append(
                {
                    "status": next(
                        m["status"]
                        for m in messages
                        if m["type"] == "http.response.start"
                    ),
                    "body": json.loads(b"".join(m.get("body", b"") for m in messages)),
                }
            )
            # A deadline makes harness bugs fail instead of hanging the server.
            await asyncio.wait_for(gate["event"].wait(), timeout=45)
            for message in messages:
                await send(message)
            gate["completed"] += 1

    controls.mount("/", DelayRealRecommendations())
    return controls


def main() -> None:
    import uvicorn

    # Override configuration before importing any application module.
    directory = os.environ.get("S04_DATABASE_DIR")
    if not directory:
        raise RuntimeError("Run via npm --prefix frontend run test:s04:e2e")
    path = Path(directory) / "acceptance.db"
    os.environ["DATABASE_URL"] = sqlite_url(path)
    live = os.environ.get("S13_TMDB_SMOKE") == "1"
    accepted = os.environ.get("S13_TMDB_DATABASE")
    if accepted and not live:
        raise RuntimeError("S13_TMDB_DATABASE requires S13_TMDB_SMOKE=1")
    if accepted:
        # Preserve the accepted database and revision. All browser account writes
        # are confined to the runner-owned disposable backup, never the source.
        source_path = Path(accepted).resolve()
        with (
            closing(sqlite3.connect(source_path.as_uri() + "?mode=ro", uri=True))
            as source,
            closing(sqlite3.connect(path)) as target,
        ):
            provider = source.execute(
                "SELECT r.provider FROM catalogue_state s JOIN catalogue_revisions r "
                "ON r.id=s.active_revision_id WHERE s.id=1"
            ).fetchone()
            if provider != ("tmdb",):
                raise RuntimeError("Accepted source must have an active TMDb revision")
            source.backup(target)
        os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
    if not live:
        os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
    os.environ["SESSION_COOKIE_SECURE"] = "false"
    run_migrations(os.environ["DATABASE_URL"], dict(os.environ))
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    if live and not accepted:
        subprocess.run(
            [sys.executable, "-m", "app.cli.import_tmdb_catalogue", "--pages", "1"],
            cwd=ROOT,
            env={**os.environ, "PYTHONPATH": str(ROOT / "backend")},
            check=True,
        )
    elif not live:
        seed_database(path, fixture)
    sys.path.insert(0, str(ROOT / "backend"))
    from app.db.database import engine

    try:
        uvicorn.run(build_harness(path, fixture), host="127.0.0.1", port=8014)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
