"""Synthetic, migrated T16 fixtures shared by API and cross-runtime tests."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path

from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EXPECTED_TITLES = ["Action Z", "Comedy C", "Action A", "Comedy A", "Comedy B"]
SYNTHETIC_MOVIES = [
    ("action-z", "Action Z", 100, 28),
    ("comedy-c", "Comedy C", 90, 35),
    ("action-a", "Action A", 80, 28),
    ("comedy-a", "Comedy A", 70, 35),
    ("comedy-b", "Comedy B", 60, 35),
    # The option must exist in the catalogue, but not in A's recommendation set.
    ("horror", "Outside snapshot", 50, 27),
]


def migrate_database(path: Path) -> None:
    """Apply real migrations without reading a live token or seeding M2 data."""
    result = subprocess.run(
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
        env=os.environ
        | {
            "DATABASE_URL": f"sqlite:///{path.as_posix()}",
            "TMDB_READ_ACCESS_TOKEN": "",
            "PYTHONUTF8": "1",
        },
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError("T16 isolated database migration failed")


def preference_rows(path: Path) -> list[tuple[str, int]]:
    """Read committed rows through a new, explicitly read-only connection."""
    with sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True) as connection:
        return connection.execute(
            "SELECT user_id, genre_id FROM user_genre_preferences ORDER BY user_id, genre_id"
        ).fetchall()


@dataclass
class FilterScenario:
    database_path: Path
    account_a: TestClient
    account_b: TestClient
    user_a: str
    user_b: str


@contextmanager
def filter_scenario(path: Path, *, rating_ties: bool = False) -> Iterator[FilterScenario]:
    """Seed six synthetic movies and two accounts, not a developer database."""
    engine = create_engine(
        f"sqlite:///{path.as_posix()}", connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    sessions = sessionmaker(bind=engine, autoflush=False)

    def request_session():
        with sessions() as session:
            yield session

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = request_session
    account_a = TestClient(app)
    account_b = TestClient(app)
    try:
        with sessions() as session, session.begin():
            revision = create_catalogue_revision(session, provider="synthetic-t16")
            for genre_id, name in [(28, "Action"), (35, "Comedy"), (27, "Horror")]:
                upsert_genre(session, genre_id=genre_id, name=name)
            for source_id, title, popularity, genre_id in SYNTHETIC_MOVIES:
                movie = upsert_catalogue_movie(
                    session,
                    catalogue_revision_id=revision.id,
                    source="synthetic-t16",
                    source_id=source_id,
                    title=title,
                    # Preserve the five-title oracle while allowing one committed
                    # rating to move Action Z across Comedy C's score of 90.
                    popularity_score=90 if rating_ties and source_id == "action-z" else popularity,
                )
                replace_movie_genres(session, movie=movie, genre_ids=[genre_id])
            activate_catalogue_revision(session, revision_id=revision.id)

        users = []
        for http, email, genres in [
            (account_a, "synthetic-a@example.com", [28, 35]),
            (account_b, "synthetic-b@example.com", [27]),
        ]:
            response = http.post(
                "/api/auth/register", json={"email": email, "password": "movie123"}
            )
            assert response.status_code == 201
            response = http.post(
                "/api/auth/login",
                json={"email": email, "password": "movie123"},
                headers={"Origin": "http://testserver"},
            )
            assert response.status_code == 200
            users.append(response.json()["data"]["user"]["id"])
            response = http.put(
                "/api/me/preferences",
                json={"genreIds": genres},
                headers={"Origin": "http://testserver"},
            )
            assert response.status_code == 200
        yield FilterScenario(path, account_a, account_b, users[0], users[1])
    finally:
        account_a.close()
        account_b.close()
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()
