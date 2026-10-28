"""Synthetic T28 data and audit helpers; never imported by production code."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from contextlib import closing
from pathlib import Path

import httpx
from app.catalogue.tmdb_import import enrich_tmdb_backdrops
from app.integrations.tmdb import TMDB_BASE_URL, TmdbClient, TmdbImportError
from app.recommendations.service import build_account_recommendations
from app.security.passwords import hash_password
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

PASSWORD = "t28-synthetic-password"
MOVIES = {"a": "t28-movie-a", "b": "t28-movie-b", "c": "t28-movie-c"}
REVISION = "t28-synthetic-tmdb"


def seed_database(path: Path, *, media: bool = True) -> None:
    """Also works at the pre-backdrop migration, without ORM schema shortcuts."""
    with closing(sqlite3.connect(path)) as db, db:
        db.execute("PRAGMA foreign_keys=ON")
        for user in ("a", "b"):
            db.execute(
                "INSERT INTO users VALUES (?,?,?,?)",
                (
                    f"t28-user-{user}",
                    f"t28-{user}@example.test",
                    hash_password(PASSWORD),
                    "2026-10-01",
                ),
            )
            db.execute(
                "INSERT INTO auth_sessions VALUES (?,?,?,?,NULL)",
                (user * 64, f"t28-user-{user}", "2026-10-01", "2099-10-01"),
            )
        db.executemany(
            "INSERT INTO genres VALUES (?,?)", [(28, "Action"), (18, "Drama")]
        )
        db.executemany(
            "INSERT INTO catalogue_revisions VALUES (?,?,?, ?,0,0)",
            [
                (REVISION, "tmdb", "2026-10-01", 3),
                ("t28-retired", "tmdb", "2026-09-01", 1),
            ],
        )
        for key, title, score, source_id in (
            ("a", "Backdrop Alpha", 90, "101"),
            ("b", "Backdrop Beta", 80, "102"),
            ("c", "Backdrop Gamma", 80, "103"),
            ("retired", "Retired fixture", 999, "104"),
        ):
            movie_id = MOVIES.get(key, "t28-retired-movie")
            db.execute(
                "INSERT INTO catalog_movies (id,catalogue_revision_id,source,source_id,"
                "title,release_year,overview,popularity_score,vote_average,vote_count,"
                "source_fetched_at) VALUES (?,?, 'tmdb',?,?,2026,?,?,7,100,?)",
                (
                    movie_id,
                    REVISION if key != "retired" else "t28-retired",
                    source_id,
                    title,
                    f"Entirely invented overview for {title}.",
                    score,
                    "2026-10-01",
                ),
            )
        db.executemany(
            "INSERT INTO movie_genres VALUES (?,?)",
            [
                (MOVIES["a"], 28),
                (MOVIES["b"], 28),
                (MOVIES["b"], 18),
                (MOVIES["c"], 18),
            ],
        )
        db.executemany(
            "INSERT INTO user_genre_preferences VALUES (?,?)",
            [("t28-user-a", 28), ("t28-user-a", 18), ("t28-user-b", 18)],
        )
        db.executemany(
            "INSERT INTO user_movie_ratings VALUES (?,?,?,?,?,?)",
            [
                (
                    "t28-rating-a",
                    "t28-user-a",
                    MOVIES["a"],
                    5,
                    "2026-10-01",
                    "2026-10-01",
                ),
                (
                    "t28-rating-b",
                    "t28-user-b",
                    MOVIES["a"],
                    2,
                    "2026-10-01",
                    "2026-10-01",
                ),
            ],
        )
        db.execute(
            "INSERT INTO catalogue_state VALUES (1,?,?)", (REVISION, "2026-10-01")
        )
        columns = [r[1] for r in db.execute("PRAGMA table_info(catalog_movies)")]
        if media and "backdrop_path" in columns:
            db.execute(
                "UPDATE catalog_movies SET backdrop_path='/t28-alpha.jpg' WHERE id=?",
                (MOVIES["a"],),
            )
            db.execute(
                "UPDATE catalog_movies SET backdrop_path='/t28-gamma.jpg' WHERE id=?",
                (MOVIES["c"],),
            )


def snapshot(path: Path, *, media: bool = False) -> dict:
    """All nine application tables; hashes/digests must not be published as rows."""
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
        result = {}
        for (table,) in db.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' "
            "AND name!='alembic_version' ORDER BY name"
        ):
            columns = [
                r[1]
                for r in db.execute(f'PRAGMA table_info("{table}")')
                if media or r[1] not in {"backdrop_path", "poster_path"}
            ]
            quoted = ",".join(f'"{column}"' for column in columns)
            result[table] = db.execute(
                f'SELECT {quoted} FROM "{table}" ORDER BY {quoted}'
            ).fetchall()
        return result


def digest(value: object) -> str:
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, default=str).encode()
    ).hexdigest()


def rankings(engine) -> dict:
    with Session(engine) as session:
        return {
            user: [
                # Backdrop presentation now appears in summary DTOs. Its URL
                # may change during enrichment; every ranking/ownership field
                # and the exact ordered movie IDs must still remain identical.
                movie.model_dump(exclude={"backdropUrl"})
                for movie in build_account_recommendations(
                    session, user_id=f"t28-user-{user}", limit=10
                ).movies
            ]
            for user in ("a", "b")
        }


def audit_enrichment(path: Path, scenario: str = "valid") -> dict:
    """Real gateway + SQL transaction, synthetic HTTP boundary, no live provider."""
    if scenario not in {"valid", "clear", "missing", "invalid", "failure"}:
        raise ValueError("Unknown synthetic enrichment scenario")
    before = snapshot(path)
    before_media = snapshot(path, media=True)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    calls = []

    def provider(request):
        source_id = int(request.url.path.rsplit("/", 1)[-1])
        calls.append(source_id)
        assert source_id in {101, 102, 103}, "Inactive movie must not be fetched"
        if scenario == "failure" and len(calls) == 2:
            return httpx.Response(429)
        if scenario == "missing":
            payload = {}
        elif scenario == "invalid":
            payload = {"backdrop_path": "https://untrusted.invalid/image.jpg"}
        elif scenario == "clear":
            payload = {"backdrop_path": None}
        elif scenario == "failure":
            payload = {"backdrop_path": "/t28-partial-must-rollback.jpg"}
        else:
            payload = {
                "backdrop_path": None
                if source_id == 102
                else f"/t28-enriched-{source_id}.jpg"
            }
        return httpx.Response(200, json=payload)

    try:
        before_ranking = rankings(engine)
        rolled_back = False
        counts = None
        with httpx.Client(
            base_url=TMDB_BASE_URL, transport=httpx.MockTransport(provider)
        ) as http:
            gateway = TmdbClient("t28-synthetic-credential", http_client=http)
            try:
                with Session(engine) as session, session.begin():
                    result = enrich_tmdb_backdrops(session, client=gateway)
                    counts = vars(result)
            except TmdbImportError:
                if scenario != "failure":
                    raise
                rolled_back = True
        assert snapshot(path) == before, "Non-media application rows changed"
        assert rankings(engine) == before_ranking, (
            "Account recommendation ordering/data changed"
        )
        if scenario in {"missing", "invalid", "failure"}:
            assert snapshot(path, media=True) == before_media
        assert rolled_back == (scenario == "failure")
        return {
            "scenario": scenario,
            "result": "PASS",
            "requests": calls,
            "counts": counts,
            "rolledBack": rolled_back,
            "nonMediaRowsPreserved": True,
            "rankingPreserved": True,
            "beforeNonMediaSha256": digest(before),
            "afterNonMediaSha256": digest(snapshot(path)),
            "rankingIds": {
                user: [movie["id"] for movie in rows]
                for user, rows in before_ranking.items()
            },
        }
    finally:
        engine.dispose()
