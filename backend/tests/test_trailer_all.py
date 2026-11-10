"""Committed-batch and resume checks for full TMDb trailer enrichment."""

from collections import Counter
from datetime import UTC, datetime

import pytest
from app.catalogue import tmdb_import
from app.catalogue.tmdb_import import (
    TmdbTrailerAllDatabaseError,
    enrich_tmdb_trailers_all,
    import_tmdb_catalogue,
)
from app.cli import import_tmdb_catalogue as command
from app.db.database import Base
from app.db.models import (
    CatalogMovie,
    User,
    UserGenrePreference,
    UserMovieRating,
    UserMovieWatchlist,
)
from app.integrations.tmdb import TmdbAuthenticationError, TmdbImportError
from app.main import app, get_db
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker


class ManyMoviesGateway:
    def __init__(self, count):
        self.count = count
        self.calls = []
        self.fail_at = None
        self.failure = TmdbImportError("synthetic provider failure")
        self.interrupt_at = None

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def fetch_genres(self):
        return [{"id": 28, "name": "Action"}]

    def fetch_popular_movies(self, _page):
        return [{"id": movie_id, "title": f"Movie {movie_id}", "genre_ids": [28]}
                for movie_id in range(1000, 1000 + self.count)]

    def fetch_movie_videos(self, movie_id):
        self.calls.append(movie_id)
        if movie_id == self.interrupt_at:
            raise KeyboardInterrupt
        if movie_id == self.fail_at:
            raise self.failure
        if movie_id % 3:
            return {"results": [
                {"site": "YouTube", "key": "AbCdEf123_-", "type": "Teaser",
                 "official": True},
                {"site": "YouTube", "key": "AbCdEf123_-", "type": "Trailer",
                 "official": False},
            ]}
        return {"results": [{
            "site": "YouTube", "key": "AbCdEf123_-", "name": "Official trailer",
            "type": "Trailer", "official": True, "iso_639_1": "fr",
            "published_at": "2026-10-20T10:00:00Z",
        }]}


def prepared_catalogue(tmp_path, count):
    engine = create_engine(f"sqlite:///{(tmp_path / 'catalogue.db').as_posix()}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    gateway = ManyMoviesGateway(count)
    with factory() as session, session.begin():
        import_tmdb_catalogue(session, client=gateway, pages=1)
    return engine, factory, gateway


def pending_count(factory):
    with factory() as session:
        return session.scalar(select(func.count()).select_from(CatalogMovie).where(
            CatalogMovie.trailer_attempted_at.is_(None)))


def test_cli_all_processes_1000_once_and_preserves_account_data(tmp_path, monkeypatch, capsys):
    engine, factory, gateway = prepared_catalogue(tmp_path, 1000)
    try:
        with factory() as session, session.begin():
            user = User(email_normalized="all@example.test", password_hash="synthetic-hash")
            session.add(user)
            session.flush()
            movie = session.scalar(select(CatalogMovie).where(CatalogMovie.source_id == "1001"))
            session.add_all([
                UserGenrePreference(user_id=user.id, genre_id=28),
                UserMovieRating(user_id=user.id, movie_id=movie.id, rating=4.0),
                UserMovieWatchlist(user_id=user.id, movie_id=movie.id),
            ])
        protected_tables = ("catalogue_state", "catalogue_revisions", "users",
                            "user_genre_preferences", "user_movie_ratings",
                            "user_movie_watchlist")
        with engine.connect() as connection:
            before = {name: connection.execute(text(f"SELECT * FROM {name}")).all()
                      for name in protected_tables}
            movie_ids = connection.execute(text("SELECT id, source_id FROM catalog_movies")).all()

        monkeypatch.setattr(command.TmdbClient, "from_environment", lambda: gateway)
        monkeypatch.setattr(command, "SessionLocal", factory)
        assert command.main(["--enrich-trailers", "--all"]) == 0
        output = capsys.readouterr().out
        assert "eligible=1000\nprocessed=1000\n" in output
        assert "with_trailer=333\nwithout_trailer=667\nfailed=0\nremaining=0\n" in output
        assert len(gateway.calls) == len(set(gateway.calls)) == 1000
        assert Counter(gateway.calls) == Counter(range(1000, 2000))
        assert pending_count(factory) == 0
        with engine.connect() as connection:
            assert {name: connection.execute(text(f"SELECT * FROM {name}")).all()
                    for name in protected_tables} == before
            assert connection.execute(text("SELECT id, source_id FROM catalog_movies")).all() == movie_ids

        def dependency():
            with factory() as session:
                yield session

        previous = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = dependency
        try:
            with TestClient(app) as client:
                with factory() as session:
                    no_trailer = session.scalar(select(CatalogMovie).where(
                        CatalogMovie.source_id == "1001"))
                    has_trailer = session.scalar(select(CatalogMovie).where(
                        CatalogMovie.source_id == "1002"))
                    no_id, yes_id = no_trailer.id, has_trailer.id
                assert client.get(f"/api/movies/{no_id}").json()["data"]["movie"]["trailer"] is None
                assert client.get(f"/api/movies/{yes_id}").json()["data"]["movie"]["trailer"]["language"] == "fr"
        finally:
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
    finally:
        engine.dispose()


def test_all_resumes_after_interruption_without_repeating_committed_movies(tmp_path):
    engine, factory, gateway = prepared_catalogue(tmp_path, 620)
    try:
        gateway.interrupt_at = 1300
        with pytest.raises(KeyboardInterrupt):
            enrich_tmdb_trailers_all(factory, client=gateway)
        assert pending_count(factory) == 320
        assert gateway.calls[:300] == list(range(1000, 1300))
        gateway.calls.clear()
        gateway.interrupt_at = None
        result = enrich_tmdb_trailers_all(factory, client=gateway)
        assert result.processed_movie_count == 320
        assert result.remaining_movie_count == 0
        assert gateway.calls == list(range(1300, 1620))
        assert pending_count(factory) == 0
    finally:
        engine.dispose()


def test_all_provider_failure_retains_trailer_and_is_not_retried(tmp_path):
    engine, factory, gateway = prepared_catalogue(tmp_path, 5)
    try:
        with factory() as session, session.begin():
            movie = session.scalar(select(CatalogMovie).where(CatalogMovie.source_id == "1002"))
            movie.trailer_site = "YouTube"
            movie.trailer_key = "OldTrailer1"
            movie.trailer_succeeded_at = datetime(2026, 10, 1, tzinfo=UTC)
        gateway.fail_at = 1002
        result = enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert result.processed_movie_count == 5
        assert result.failed_movie_count == 1
        assert result.remaining_movie_count == 0
        with factory() as session:
            movie = session.scalar(select(CatalogMovie).where(CatalogMovie.source_id == "1002"))
            assert movie.trailer_key == "OldTrailer1"
            assert movie.trailer_status == "stale"
        gateway.calls.clear()
        again = enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert again.processed_movie_count == 0
        assert gateway.calls == []
    finally:
        engine.dispose()


def test_all_authentication_stops_and_resume_skips_failed_attempt(tmp_path):
    engine, factory, gateway = prepared_catalogue(tmp_path, 5)
    try:
        gateway.fail_at = 1002
        gateway.failure = TmdbAuthenticationError("synthetic bad token")
        result = enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert result.authentication_stopped
        assert result.processed_movie_count == 3
        assert result.failed_movie_count == 1
        assert result.remaining_movie_count == 2
        assert gateway.calls == [1000, 1001, 1002]
        gateway.fail_at = None
        gateway.calls.clear()
        resumed = enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert resumed.processed_movie_count == 2
        assert gateway.calls == [1003, 1004]
    finally:
        engine.dispose()


def test_all_database_error_rolls_back_only_current_batch(tmp_path, monkeypatch):
    engine, factory, gateway = prepared_catalogue(tmp_path, 5)
    original = tmdb_import._set_movie_trailer
    calls = 0

    def fail_in_second_batch(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 3:
            raise SQLAlchemyError("synthetic database failure")
        return original(*args, **kwargs)

    try:
        monkeypatch.setattr(tmdb_import, "_set_movie_trailer", fail_in_second_batch)
        with pytest.raises(TmdbTrailerAllDatabaseError) as error:
            enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert error.value.partial_result.processed_movie_count == 2
        assert error.value.partial_result.remaining_movie_count == 3
        assert pending_count(factory) == 3
        with factory() as session:
            rows = list(session.scalars(select(CatalogMovie).order_by(CatalogMovie.source_id)))
            assert [movie.trailer_attempted_at is not None for movie in rows] == [
                True, True, False, False, False]
        monkeypatch.setattr(tmdb_import, "_set_movie_trailer", original)
        gateway.calls.clear()
        resumed = enrich_tmdb_trailers_all(factory, client=gateway, batch_size=2)
        assert resumed.processed_movie_count == 3
        assert gateway.calls == [1002, 1003, 1004]
    finally:
        engine.dispose()
