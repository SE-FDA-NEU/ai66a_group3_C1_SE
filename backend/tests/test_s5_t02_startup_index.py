"""Offline recovery proof for the disposable startup index and account rows."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import (
    AuthSession,
    CatalogMovie,
    Genre,
    User,
    UserGenrePreference,
    UserMovieRating,
    UserMovieWatchlist,
)
from app.main import app, get_db
from app.recommendations.overview_index import load_active_index, resolve_index_path
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker


def test_restart_rebuilds_missing_and_stale_index_without_touching_accounts(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine(f"sqlite:///{(tmp_path / 'app.db').as_posix()}")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    artifact = tmp_path / "writable" / "index.json"
    monkeypatch.setenv("NLP_INDEX_PATH", str(artifact))
    monkeypatch.setattr("app.main.SessionLocal", sessions)

    with sessions() as session, session.begin():
        revision = create_catalogue_revision(session, provider="tmdb")
        session.add(Genre(id=28, name="Action"))
        session.add_all([
            CatalogMovie(id="film-a", catalogue_revision_id=revision.id,
                         source="tmdb", source_id="101", title="Film A",
                         overview="Astronaut rescue in space"),
            CatalogMovie(id="film-b", catalogue_revision_id=revision.id,
                         source="tmdb", source_id="102", title="Film B",
                         overview="Space rescue mission"),
        ])
        session.add_all([
            User(id="account-a", email_normalized="a@example.invalid", password_hash="hash-a"),
            User(id="account-b", email_normalized="b@example.invalid", password_hash="hash-b"),
        ])
        session.flush()
        session.add_all([
            UserGenrePreference(user_id="account-a", genre_id=28),
            UserGenrePreference(user_id="account-b", genre_id=28),
            UserMovieRating(id="rating-a", user_id="account-a", movie_id="film-a", rating=3.5),
            UserMovieRating(id="rating-b", user_id="account-b", movie_id="film-b", rating=4.5),
            UserMovieWatchlist(id="watch-a", user_id="account-a", movie_id="film-b"),
            UserMovieWatchlist(id="watch-b", user_id="account-b", movie_id="film-a"),
            AuthSession(token_digest="a" * 64, user_id="account-a",
                        expires_at=datetime.now(UTC) + timedelta(days=1)),
            AuthSession(token_digest="b" * 64, user_id="account-b",
                        expires_at=datetime.now(UTC) + timedelta(days=1)),
        ])
        activate_catalogue_revision(session, revision_id=revision.id)

    def database_session():
        with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = database_session
    try:
        for cycle in range(3):
            if cycle == 1:
                artifact.unlink()  # Only the derived file is disposable.
            if cycle == 2:
                with sessions() as session, session.begin():
                    session.get(CatalogMovie, "film-a").overview = "A changed astronaut rescue"
            with TestClient(app) as http:
                assert artifact.is_file()
                search = http.get("/api/movies/search", params={"q": "astronaut"})
                assert search.status_code == 200
                assert search.json()["data"]["movies"][0]["id"] == "film-a"
                assert http.get("/api/movies/film-a/similar").status_code == 200
            with sessions() as session:
                index = load_active_index(session, artifact)
                assert index.movie_ids == ("film-a", "film-b")
                assert session.scalars(select(User.id).order_by(User.id)).all() == ["account-a", "account-b"]
                assert session.scalars(select(UserMovieRating.rating).order_by(UserMovieRating.id)).all() == [3.5, 4.5]
                assert session.scalars(select(UserMovieWatchlist.id).order_by(UserMovieWatchlist.id)).all() == ["watch-a", "watch-b"]
                assert session.scalars(select(UserGenrePreference.user_id).order_by(UserGenrePreference.user_id)).all() == ["account-a", "account-b"]
                assert session.scalars(select(AuthSession.user_id).order_by(AuthSession.user_id)).all() == ["account-a", "account-b"]
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def test_production_default_index_is_temporary(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.delenv("NLP_INDEX_PATH", raising=False)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setattr("app.recommendations.overview_index.tempfile.gettempdir", lambda: str(tmp_path))
    assert resolve_index_path() == tmp_path / "ai66a-overview-tfidf-v1.json"
