"""S4-T16 / S03: production HTTP and migrated SQLite, offline and disposable.

No production imports occur during collection. C05 owns the shared default M4
discovery/fixtures; this scoped module already runs directly from the repo root.
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from uuid import UUID

import dotenv
import httpx
import pytest


@pytest.fixture
def details(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    with TemporaryDirectory(prefix="s03-case-", dir=tmp_path) as directory:
        yield from _details(Path(directory), monkeypatch)


def _details(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[SimpleNamespace]:
    database_url = f"sqlite:///{(tmp_path / 'details.db').as_posix()}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    monkeypatch.setenv("NLP_INDEX_PATH", str(tmp_path / "overview.json"))
    monkeypatch.setenv("TMDB_READ_ACCESS_TOKEN", "")
    monkeypatch.setenv("TMDB_NETWORK_DISABLED", "1")
    # Configure before importing the app/migrations, even when a developer .env exists.
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: False)

    def no_network(*args, **kwargs):
        raise AssertionError("S03 pytest must never connect to a live service")

    # Block real HTTP transports, not asyncio's Windows loopback wake-up socket.
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", no_network)
    monkeypatch.setattr(httpx.AsyncHTTPTransport, "handle_async_request", no_network)

    from alembic import command
    from alembic.config import Config
    from app.db import database
    from app.integrations.tmdb import TmdbClient
    from app.repositories.movies import (
        activate_catalogue_revision,
        create_catalogue_revision,
        replace_movie_genres,
        upsert_catalogue_movie,
        upsert_genre,
    )
    from fastapi.testclient import TestClient
    from sqlalchemy import text
    from sqlalchemy.orm import Session, sessionmaker

    root = Path(__file__).resolve().parents[1]
    command.upgrade(Config(str(root / "backend/alembic.ini")), "head")
    engine = database.create_database_engine(database_url)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    # Also isolate routes using the default engine rather than get_db (/health).
    monkeypatch.setattr(database, "engine", engine)
    monkeypatch.setattr(database, "SessionLocal", sessions)
    from app import main

    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "SessionLocal", sessions)
    monkeypatch.setattr(TmdbClient, "_get_json", no_network)

    def get_db():
        with sessions() as session:
            yield session

    previous_overrides = main.app.dependency_overrides.copy()
    main.app.dependency_overrides[main.get_db] = get_db
    try:
        with Session(engine) as session:
            assert session.scalar(text("PRAGMA foreign_keys")) == 1
            revision = create_catalogue_revision(session, provider="s4-t16-synthetic")
            for genre_id, name in ((28, "Action"), (35, "Comedy")):
                upsert_genre(session, genre_id=genre_id, name=name)
            movie_ids = []
            for number in range(12):
                movie = upsert_catalogue_movie(
                    session, catalogue_revision_id=revision.id,
                    source="s4-t16-synthetic", source_id=f"movie-{number}",
                    title=f"Fixture movie {number:02d}", release_year=2020,
                    overview="An astronaut rescue mission on the moon",
                    popularity_score=float(100 - number),
                )
                replace_movie_genres(session, movie=movie, genre_ids=[28, 35])
                movie_ids.append(movie.id)
            activate_catalogue_revision(session, revision_id=revision.id)
            revision_id = revision.id
            session.commit()
        with TestClient(main.app) as http:
            yield SimpleNamespace(http=http, engine=engine, sessions=sessions,
                                  movies=movie_ids, revision=revision_id, app=main.app)
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(previous_overrides)
        engine.dispose()


def test_TC_P0_S03_001_public_known_id(details):
    """TC-P0-S03-001: exact public production DTO from the active SQL row."""
    http, movie_id = details.http, details.movies[0]
    result = http.get(f"/api/movies/{movie_id}")
    assert result.status_code == 200
    movie = result.json()["data"]["movie"]
    assert str(UUID(movie["id"])) == movie_id
    assert movie["title"] == "Fixture movie 00"
    assert movie["releaseYear"] == 2020
    assert movie["overview"] == "An astronaut rescue mission on the moon"
    assert {genre["id"] for genre in movie["genres"]} == {28, 35}
    assert not {"rating", "userId", "rankingScore", "reason"}.intersection(movie)
    assert result.json()["meta"]["catalogueRevision"] == details.revision
    assert http.get("/health").status_code == 200


def test_TC_P0_S03_002_unknown_id_refused(details):
    """TC-P0-S03-002: a business 404, not an empty success or index fallback."""
    result = details.http.get("/api/movies/ffffffff-ffff-4fff-8fff-ffffffffffff")
    assert result.status_code == 404
    assert result.json()["error"]["code"] == "MOVIE_NOT_FOUND"
    assert "data" not in result.json()


@pytest.mark.parametrize("missing", ["year", "summary", "both"])
def test_TC_P0_S03_001_missing_optional_fields(details, missing):
    """TC-P0-S03-001: DTO nulls; rendered fallback is a separate React/browser check."""
    from app.db.models import CatalogMovie

    with details.sessions() as session:
        movie = session.get(CatalogMovie, details.movies[0])
        if missing in {"year", "both"}:
            movie.release_year = None
        if missing in {"summary", "both"}:
            movie.overview = None
        session.commit()
    result = details.http.get(f"/api/movies/{details.movies[0]}")
    assert result.status_code == 200
    movie = result.json()["data"]["movie"]
    assert movie["releaseYear"] == (None if missing in {"year", "both"} else 2020)
    assert movie["overview"] == (
        None if missing in {"summary", "both"}
        else "An astronaut rescue mission on the moon"
    )
    assert movie["title"] == "Fixture movie 00"
    assert len(movie["genres"]) == 2


def test_TC_P0_S03_003_catalogue_and_database_failures_are_distinct(details, monkeypatch):
    """TC-P0-S03-003: infrastructure errors must not masquerade as unknown IDs."""
    from app import main
    from app.db.models import CatalogueState
    from sqlalchemy import delete
    from sqlalchemy.exc import SQLAlchemyError

    with details.sessions() as session:
        session.execute(delete(CatalogueState))
        session.commit()
    result = details.http.get(f"/api/movies/{details.movies[0]}")
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"

    def broken(*args, **kwargs):
        raise SQLAlchemyError("synthetic read failure")

    monkeypatch.setattr(main, "get_active_catalogue_revision", broken)
    result = details.http.get(f"/api/movies/{details.movies[0]}")
    assert result.status_code == 503
    assert result.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


def test_TC_P0_S03_004_return_query_cannot_redirect_or_change_public_movie(details):
    """TC-P0-S03-004: API only; React must independently validate navigation state."""
    expected = details.http.get(f"/api/movies/{details.movies[0]}").json()
    for return_to in ("/popular?page=2", "https://outside.invalid/steal"):
        result = details.http.get(f"/api/movies/{details.movies[0]}",
                                  params={"returnTo": return_to})
        assert result.status_code == 200
        assert result.json() == expected
        assert "location" not in result.headers


def test_TC_P0_S03_005_detail_widgets_preserve_both_accounts_preferences(details):
    """TC-P0-S03-005: real sessions, account isolation and persisted preferences."""
    from app.recommendations.overview_index import rebuild_active_index
    from fastapi.testclient import TestClient

    with details.sessions() as session:
        rebuild_active_index(session)
    with TestClient(details.app) as a, TestClient(details.app) as b:
        for http, email, genre in ((a, "a@example.test", 28), (b, "b@example.test", 35)):
            credentials = {"email": email, "password": "Synthetic-t16-password"}
            assert http.post("/api/auth/register", json=credentials).status_code == 201
            assert http.post("/api/auth/login", json=credentials).status_code == 200
            assert http.put("/api/me/preferences", json={"genreIds": [genre]}).status_code == 200
        before_a = a.get("/api/me/preferences").json()
        before_b = b.get("/api/me/preferences").json()
        movie_id = details.movies[0]
        for http in (details.http, a, b):
            assert http.get(f"/api/movies/{movie_id}").status_code == 200
            assert http.get(f"/api/movies/{movie_id}/similar").status_code == 200
        assert a.put(f"/api/me/ratings/{movie_id}", json={"rating": 5}).status_code == 200
        assert a.put(f"/api/me/watchlist/{movie_id}").status_code == 200
        assert a.get("/api/me/recommendations", params={"page": 2, "genreId": 28}).status_code == 200
        assert a.get(f"/api/me/ratings/{movie_id}").json()["data"]["rating"] == 5
        assert b.get(f"/api/me/ratings/{movie_id}").json()["data"]["rating"] is None
        assert b.get(f"/api/me/watchlist/{movie_id}").json()["data"]["inWatchlist"] is False
        assert a.get("/api/me/preferences").json() == before_a
        assert b.get("/api/me/preferences").json() == before_b
        assert {item["id"] for item in before_a["data"]["genres"]} == {28}
        assert {item["id"] for item in before_b["data"]["genres"]} == {35}


def test_TC_P0_S03_006_membership_commit_allows_read_snapshot_cleanup(details):
    """TC-P0-S03-006: one ASGI loop, real SQLite reader/writer; no sleep/retry.

    A list's read snapshot is released by another coroutine when the membership
    writer reaches COMMIT. Blocking that event loop would prevent the release
    and turn an otherwise valid write into a busy-timeout 503.
    """
    from sqlalchemy import event

    credentials = {"email": "concurrent@example.test", "password": "Synthetic-t16-password"}
    assert details.http.post("/api/auth/register", json=credentials).status_code == 201
    assert details.http.post("/api/auth/login", json=credentials).status_code == 200

    def short_busy_timeout(connection, _record):
        connection.execute("PRAGMA busy_timeout=250")

    details.engine.dispose()
    event.listen(details.engine, "connect", short_busy_timeout)
    reader = details.engine.connect()
    reader.exec_driver_sql("BEGIN")
    reader.exec_driver_sql("SELECT id FROM catalog_movies").all()

    async def exercise():
        loop = asyncio.get_running_loop()
        at_commit = asyncio.Event()

        def committing(_connection):
            loop.call_soon_threadsafe(at_commit.set)

        async def release_reader():
            await at_commit.wait()
            reader.rollback()

        event.listen(details.engine, "commit", committing)
        try:
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=details.app),
                base_url="http://testserver", cookies=details.http.cookies,
            ) as http:
                result, _ = await asyncio.wait_for(asyncio.gather(
                    http.put(f"/api/me/watchlist/{details.movies[0]}"), release_reader(),
                ), timeout=10)
                assert result.status_code == 200, result.text
                assert result.json()["data"]["inWatchlist"] is True
        finally:
            event.remove(details.engine, "commit", committing)

    try:
        asyncio.run(exercise())
    finally:
        reader.close()
        event.remove(details.engine, "connect", short_busy_timeout)
