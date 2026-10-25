"""Isolated file-SQLite migration, re-import and concurrent API acceptance."""

from __future__ import annotations

import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest
from app.db.database import create_database_engine
from app.db.models import UserMovieWatchlist
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    upsert_catalogue_movie,
)
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker
from support.reset_concurrency import ResetHarness, migrate_template

ROOT = Path(__file__).resolve().parents[2]
HEADERS = {"Origin": "http://testserver"}


def migrate(url: str, revision: str) -> None:
    run = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", revision],
        cwd=ROOT, env=os.environ | {"DATABASE_URL": url}, capture_output=True, text=True,
        check=False,
    )
    assert run.returncode == 0, run.stderr


def test_fresh_and_populated_upgrade_preserve_rows_and_reimport(tmp_path):
    fresh_url = f"sqlite:///{(tmp_path / 'fresh.db').as_posix()}"
    migrate(fresh_url, "head")
    fresh_engine = create_database_engine(fresh_url)
    assert "user_movie_watchlist" in inspect(fresh_engine).get_table_names()
    fresh_engine.dispose()

    url = f"sqlite:///{(tmp_path / 'populated.db').as_posix()}"
    migrate(url, "d8a4e6f20195")
    engine = create_database_engine(url)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO users (id,email_normalized,password_hash,created_at) VALUES ('a','a@example.com','x','2026-10-24'),('b','b@example.com','x','2026-10-24')"))
        conn.execute(text("INSERT INTO catalogue_revisions (id,provider,created_at,inserted_movie_count,updated_movie_count,rejected_movie_count) VALUES ('r','test','2026-10-24',1,0,0)"))
        conn.execute(text("INSERT INTO catalogue_state (id,active_revision_id,updated_at) VALUES (1,'r','2026-10-24')"))
        conn.execute(text("INSERT INTO catalog_movies (id,catalogue_revision_id,source,source_id,title,source_fetched_at,poster_path) VALUES ('m','r','test','1','One','2026-10-24','/one.jpg')"))
        conn.execute(text("INSERT INTO genres (id,name) VALUES (28,'Action')"))
        conn.execute(text("INSERT INTO user_genre_preferences (user_id,genre_id) VALUES ('a',28)"))
        conn.execute(text("INSERT INTO user_movie_ratings (id,user_id,movie_id,rating,created_at,updated_at) VALUES ('rating','a','m',5,'2026-10-24','2026-10-24')"))
        conn.execute(text("INSERT INTO auth_sessions (token_digest,user_id,created_at,expires_at) VALUES ('digest','a','2026-10-24','2027-10-24')"))
    engine.dispose()
    migrate(url, "head")
    engine = create_database_engine(url)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO user_movie_watchlist (id,user_id,movie_id,added_at) VALUES ('saved','a','m','2026-10-24 09:00:00')"))
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(text("INSERT INTO user_movie_watchlist (id,user_id,movie_id,added_at) VALUES ('duplicate','a','m','2026-10-24 10:00:00')"))
    with pytest.raises(IntegrityError), engine.begin() as conn:
        conn.execute(text("INSERT INTO user_movie_watchlist (id,user_id,movie_id,added_at) VALUES ('orphan','missing','m','2026-10-24 10:00:00')"))
    with Session(engine) as session:
        revision = create_catalogue_revision(session, provider="test")
        movie = upsert_catalogue_movie(session, catalogue_revision_id=revision.id,
                                       source="test", source_id="1", title="One refreshed")
        activate_catalogue_revision(session, revision_id=revision.id)
        session.commit()
        assert movie.id == "m"
    with engine.connect() as conn:
        assert conn.execute(text("SELECT poster_path FROM catalog_movies WHERE id='m'")).scalar_one() == "/one.jpg"
        assert conn.execute(text("SELECT user_id,movie_id FROM user_movie_watchlist")).one() == ("a", "m")
        assert conn.execute(text("SELECT rating FROM user_movie_ratings WHERE id='rating'")).scalar_one() == 5
        assert conn.execute(text("SELECT genre_id FROM user_genre_preferences WHERE user_id='a'")).scalar_one() == 28
        assert conn.execute(text("SELECT count(*) FROM auth_sessions WHERE user_id='a'")).scalar_one() == 1
        assert conn.execute(text("SELECT count(*) FROM users")).scalar_one() == 2
    engine.dispose()


def test_two_simultaneous_puts_keep_first_timestamp_and_one_row(tmp_path):
    url = f"sqlite:///{(tmp_path / 'concurrent.db').as_posix()}"
    migrate(url, "head")
    engine = create_database_engine(url)
    factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override
    try:
        with factory() as session:
            revision = create_catalogue_revision(session, provider="test")
            movie = upsert_catalogue_movie(session, catalogue_revision_id=revision.id,
                                           source="test", source_id="1", title="One")
            activate_catalogue_revision(session, revision_id=revision.id)
            session.commit()
            movie_id = movie.id
        clients = [TestClient(app), TestClient(app)]
        assert clients[0].post("/api/auth/register", json={"email": "a@example.com", "password": "movie123"}).status_code == 201
        for client in clients:
            assert client.post("/api/auth/login", json={"email": "a@example.com", "password": "movie123"}, headers=HEADERS).status_code == 200
        gate = Barrier(2)

        def put(client):
            gate.wait()
            return client.put(f"/api/me/watchlist/{movie_id}", headers=HEADERS)

        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(put, clients))
        assert [response.status_code for response in responses] == [200, 200]
        assert responses[0].json() == responses[1].json()
        with factory() as session:
            assert session.scalar(select(func.count()).select_from(UserMovieWatchlist)) == 1
        other = TestClient(app)
        assert other.post("/api/auth/register", json={"email": "b@example.com", "password": "movie123"}).status_code == 201
        assert other.post("/api/auth/login", json={"email": "b@example.com", "password": "movie123"}, headers=HEADERS).status_code == 200
        assert other.put(f"/api/me/watchlist/{movie_id}", headers=HEADERS).status_code == 200
        assert clients[0].get("/api/me/watchlist").json()["meta"]["total"] == 1
        assert other.get("/api/me/watchlist").json()["meta"]["total"] == 1
        for client in clients:
            client.close()
        other.close()
        # A new engine and new cookie stores read the same persisted rows.
        engine.dispose()
        engine = create_database_engine(url)
        factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        for email in ("a@example.com", "b@example.com"):
            with TestClient(app) as later:
                assert later.post("/api/auth/login", json={"email": email, "password": "movie123"}, headers=HEADERS).status_code == 200
                assert later.get("/api/me/watchlist").json()["meta"]["total"] == 1
                assert later.get("/api/me/profile").json()["data"]["watchlistCount"] == 1
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_file_db_reset_failure_and_success_keep_both_watchlists(tmp_path):
    template = migrate_template(tmp_path / "template.db")
    with ResetHarness(template, tmp_path / "reset.db").installed() as harness:
        a, b = harness.client("a"), harness.client("b")
        path = "/api/me/watchlist/movie-a"
        assert a.put(path, headers=HEADERS).status_code == 200
        assert b.put(path, headers=HEADERS).status_code == 200
        assert harness.shared_rows() == harness.before_shared
        assert harness.personalisation() == ([28, 35, 878], [("movie-a", 5), ("movie-b", 2)])
        assert harness.personalisation("b") == ([18], [("movie-c", 3)])

        harness.fail_second_delete = True
        assert a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS).status_code == 503
        harness.fail_second_delete = False
        assert harness.personalisation() == ([28, 35, 878], [("movie-a", 5), ("movie-b", 2)])
        assert a.get("/api/me/profile").json()["data"]["watchlistCount"] == 1
        assert b.get("/api/me/profile").json()["data"]["watchlistCount"] == 1

        harness.fail_commit = True
        assert a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS).status_code == 503
        harness.fail_commit = False
        assert harness.personalisation() == ([28, 35, 878], [("movie-a", 5), ("movie-b", 2)])
        assert a.get(path).json()["data"]["inWatchlist"] is True
        assert b.get(path).json()["data"]["inWatchlist"] is True

        assert a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS).json() == {"data": {"reset": True}}
        assert harness.personalisation() == ([], [])
        assert harness.personalisation("b") == ([18], [("movie-c", 3)])
        assert a.get("/api/me/profile").json()["data"]["watchlistCount"] == 1
        assert b.get("/api/me/profile").json()["data"]["watchlistCount"] == 1


def test_profile_uses_one_snapshot_when_reset_commits_between_reads(tmp_path, monkeypatch):
    """A committed reset between genre and count queries cannot mix versions."""
    from app import main as main_module

    template = migrate_template(tmp_path / "profile-template.db")
    with ResetHarness(template, tmp_path / "profile-snapshot.db", journal="wal").installed() as harness:
        reader = harness.client("a")
        resetter = harness.client("a")
        assert reader.put("/api/me/watchlist/movie-a", headers=HEADERS).status_code == 200
        before = reader.get("/api/me/profile").json()["data"]
        assert len(before["genres"]) == 3
        assert before["ratingCount"] == 2
        assert before["watchlistCount"] == 1

        original = main_module.list_user_preference_genres
        reset_done = False

        def read_genres_then_reset(session, *, user_id):
            nonlocal reset_done
            genres = original(session, user_id=user_id)
            if user_id == "a" and not reset_done:
                reset_done = True
                response = resetter.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS)
                assert response.status_code == 200, response.json()
            return genres

        monkeypatch.setattr(main_module, "list_user_preference_genres", read_genres_then_reset)
        during = reader.get("/api/me/profile")
        assert during.status_code == 200
        assert reset_done
        assert during.json()["data"] == before

        after = reader.get("/api/me/profile").json()["data"]
        assert after == {"genres": [], "ratingCount": 0, "watchlistCount": 1}
