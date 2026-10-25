"""T28 independent file-backed migration/import/API/account acceptance."""

from __future__ import annotations

import sqlite3
from contextlib import closing

import pytest
from app.catalogue import tmdb_import
from app.catalogue.m2_seed import seed_m2_catalogue
from app.db.models import CatalogMovie
from app.main import app, get_db
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from support.backdrop_acceptance import (
    MOVIES,
    PASSWORD,
    audit_enrichment,
    seed_database,
    snapshot,
)
from test_backdrop_storage import _alembic


@pytest.fixture
def database(tmp_path):
    path = tmp_path / "t28.db"
    _alembic(f"sqlite:///{path.as_posix()}", "upgrade", "b7e4c2d91f30")
    seed_database(path)
    before = snapshot(path)
    _alembic(f"sqlite:///{path.as_posix()}", "upgrade", "head")
    after = snapshot(path)
    assert {table: after[table] for table in before} == before
    assert after["user_movie_watchlist"] == []
    return path


def test_upgrade_enrichment_and_real_account_api_preserve_every_non_media_row(
    database, monkeypatch
):
    engine = create_engine(
        f"sqlite:///{database.as_posix()}", connect_args={"check_same_thread": False}
    )

    def session_dependency():
        with Session(engine) as session:
            yield session

    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = session_dependency
    try:
        with TestClient(app) as account_a, TestClient(app) as account_b:
            for user, client in (("a", account_a), ("b", account_b)):
                assert (
                    client.post(
                        "/api/auth/login",
                        json={
                            "email": f"t28-{user}@example.test",
                            "password": PASSWORD,
                        },
                        headers={"Origin": "http://testserver"},
                    ).status_code
                    == 200
                )
            before = snapshot(database)
            responses = {
                user: client.get("/api/me/recommendations").json()
                for user, client in (("a", account_a), ("b", account_b))
            }
            for scenario, updated in (
                ("valid", 2),
                ("valid", 0),
                ("missing", 0),
                ("invalid", 0),
                ("failure", None),
                ("clear", 2),
            ):
                result = audit_enrichment(database, scenario)
                assert result["result"] == "PASS"
                if updated is not None:
                    assert result["counts"]["updated_movie_count"] == updated
                    assert result["counts"]["fetched_movie_count"] == 3
                else:
                    assert result["requests"] == [101, 102]
                    assert result["rolledBack"]
                assert snapshot(database) == before
                for user, client in (("a", account_a), ("b", account_b)):
                    assert (
                        client.get("/api/me/recommendations").json() == responses[user]
                    )
            monkeypatch.setattr(
                "app.integrations.tmdb.TmdbClient._get_json",
                lambda *_a, **_k: pytest.fail("Runtime API fetched TMDb"),
            )
            for client, value in ((account_a, 5), (account_b, 2)):
                response = client.get(f"/api/me/ratings/{MOVIES['a']}")
                assert response.status_code == 200
                assert response.json()["data"]["rating"] == value
            assert (
                account_a.get("/api/movies/unknown-t28").json()["error"]["code"]
                == "MOVIE_NOT_FOUND"
            )
            assert account_a.get("/api/movies/unknown-t28").status_code == 404
            for movie_id in MOVIES.values():
                detail = account_a.get(f"/api/movies/{movie_id}")
                assert detail.status_code == 200
                assert detail.json()["data"]["movie"]["backdropUrl"] is None
                assert "backdrop_path" not in detail.json()["data"]["movie"]
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()


def test_database_failure_rolls_back_first_successful_media_write(
    database, monkeypatch
):
    original = tmdb_import.set_movie_backdrop_path
    calls = []

    def observe_write(session, **kwargs):
        calls.append(kwargs["movie_id"])
        return original(session, **kwargs)

    monkeypatch.setattr(tmdb_import, "set_movie_backdrop_path", observe_write)
    # Both first and second selected rows must change so the second flush fails.
    with closing(sqlite3.connect(database)) as db, db:
        db.execute("UPDATE catalog_movies SET backdrop_path='/previous.jpg'")
        db.execute(
            "CREATE TRIGGER t28_reject_second_write BEFORE UPDATE OF backdrop_path "
            "ON catalog_movies WHEN NEW.id='t28-movie-b' BEGIN "
            "SELECT RAISE(ABORT,'controlled T28 write failure'); END"
        )
    before = snapshot(database, media=True)
    with pytest.raises(IntegrityError):
        audit_enrichment(database)
    assert calls == [MOVIES["a"], MOVIES["b"]]
    assert snapshot(database, media=True) == before


def test_legacy_m2_fixture_has_nullable_media_after_real_migrations(
    tmp_path, monkeypatch
):
    path = tmp_path / "legacy.db"
    _alembic(f"sqlite:///{path.as_posix()}", "upgrade", "head")
    engine = create_engine(
        f"sqlite:///{path.as_posix()}", connect_args={"check_same_thread": False}
    )
    previous = app.dependency_overrides.copy()

    def legacy_session():
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = legacy_session
    monkeypatch.setattr(
        "app.integrations.tmdb.TmdbClient._get_json",
        lambda *_a, **_k: pytest.fail("Legacy fixture requested TMDb"),
    )
    try:
        with Session(engine) as session, session.begin():
            seed_m2_catalogue(session)
        with Session(engine) as session:
            movies = session.query(CatalogMovie).all()
            assert len(movies) == 12
            assert all(movie.backdrop_path is None for movie in movies)
        with TestClient(app) as client:
            listing = client.get("/api/movies")
            assert listing.status_code == 200
            for movie in listing.json()["data"]["movies"]:
                detail = client.get("/api/movies/" + movie["id"])
                assert detail.status_code == 200
                assert detail.json()["data"]["movie"]["backdropUrl"] is None
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)
        engine.dispose()
