"""Offline acceptance checks for bounded, optional TMDb trailer enrichment."""

from collections.abc import Iterator

import pytest
from app.catalogue.tmdb_import import enrich_tmdb_trailers, import_tmdb_catalogue
from app.catalogue.trailers import select_trailer, youtube_url
from app.db.database import Base
from app.db.models import CatalogMovie
from app.integrations.tmdb import (
    TmdbAuthenticationError,
    TmdbImportError,
    TmdbPayloadError,
)
from app.main import app, get_db
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from test_backdrop_storage import _alembic, _seed_existing_data


def video(key="AbCdEf123_-", *, language="en", date="2026-10-20T10:00:00Z", **overrides):
    return {"site": "YouTube", "key": key, "name": "Official trailer", "type": "Trailer",
            "official": True, "iso_639_1": language, "published_at": date} | overrides


def test_selection_is_strict_and_stable_when_shuffled():
    entries = [video("bbbbbbbbbbb"), video("aaaaaaaaaaa"),
               video("zzzzzzzzzzz", language="fr", date="2027-01-01T00:00:00Z"),
               video("ccccccccccc", date=None),
               video("ddddddddddd", official=False), video("eeeeeeeeeee", type="Teaser"),
               video("fffffffffff", site="Vimeo"), video("not-valid"),
               video("ggggggggggg", date="2020-01-01T00:00:00Z")]
    assert select_trailer({"results": entries}).key == "aaaaaaaaaaa"
    assert select_trailer({"results": list(reversed(entries))}).key == "aaaaaaaaaaa"
    assert select_trailer({"results": [video("ccccccccccc", date=None),
                                          video("bbbbbbbbbbb", date="invalid")]}).key == "bbbbbbbbbbb"
    assert select_trailer({"results": [video("bbbbbbbbbbb", date="2026-10-20"),
                                          video("ccccccccccc", date="2020-01-01T00:00:00Z")]}).key == "ccccccccccc"
    assert select_trailer({"results": [video("not-valid"), video("aaaaaaaaaaa", official=False)]}) is None
    assert youtube_url("aaaaaaaaaaa") == "https://www.youtube.com/watch?v=aaaaaaaaaaa"
    assert youtube_url("https://evil.test") is None
    assert youtube_url("a&autoplay=1") is None


@pytest.mark.parametrize("payload", [{}, {"results": None}, {"results": {}},
                                     {"results": [None]}, {"results": [video(), "bad"]}])
def test_malformed_envelope_never_means_empty_success(payload):
    with pytest.raises(TmdbPayloadError):
        select_trailer(payload)


class Gateway:
    def __init__(self):
        self.calls = []
        self.videos = {101: {"results": [video()]}, 102: {"results": []}}
        self.fail_at = None
        self.failure = TmdbImportError("synthetic failure")

    def fetch_genres(self):
        return [{"id": 28, "name": "Action"}]

    def fetch_popular_movies(self, page):
        return [{"id": 101, "title": "Alpha", "genre_ids": [28]},
                {"id": 102, "title": "Beta", "genre_ids": [28]}]

    def fetch_movie_videos(self, movie_id):
        self.calls.append(movie_id)
        if movie_id == self.fail_at:
            raise self.failure
        return self.videos[movie_id]


@pytest.fixture
def database() -> Iterator[sessionmaker]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as session, session.begin():
        import_tmdb_catalogue(session, client=Gateway(), pages=1)
    try:
        yield factory
    finally:
        engine.dispose()


def rows(factory):
    with factory() as session:
        return list(session.scalars(select(CatalogMovie).order_by(CatalogMovie.source_id)))


def test_bounded_idempotent_success_clear_and_safe_details(database, monkeypatch):
    gateway = Gateway()
    before = [(m.id, m.title, m.catalogue_revision_id) for m in rows(database)]
    with database() as session, session.begin():
        result = enrich_tmdb_trailers(session, client=gateway, limit=1)
    assert (result.eligible_movie_count, result.fetched_movie_count, result.updated_movie_count) == (2, 1, 1)
    assert gateway.calls == [101]
    assert rows(database)[0].trailer_key == "AbCdEf123_-"
    with database() as session, session.begin():
        repeat = enrich_tmdb_trailers(session, client=gateway, limit=1)
    assert repeat.unchanged_movie_count == 1
    gateway.videos[101] = {"results": []}
    with database() as session, session.begin():
        cleared = enrich_tmdb_trailers(session, client=gateway, limit=1)
    assert cleared.cleared_movie_count == 1
    assert rows(database)[0].trailer_key is None
    assert rows(database)[0].trailer_status == "success"
    assert [(m.id, m.title, m.catalogue_revision_id) for m in rows(database)] == before

    gateway.videos[101] = {"results": [video()]}
    with database() as session, session.begin():
        enrich_tmdb_trailers(session, client=gateway, limit=1)

    def dependency():
        with database() as session:
            yield session

    def forbidden(*_args, **_kwargs):
        raise AssertionError("details must read SQLite only")

    monkeypatch.setattr("app.integrations.tmdb.TmdbClient.fetch_movie_videos", forbidden)
    old = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = dependency
    try:
        with TestClient(app) as client:
            detail = client.get(f"/api/movies/{before[0][0]}")
            assert detail.status_code == 200
            movie = detail.json()["data"]["movie"]
            assert movie == {
                "id": before[0][0], "title": "Alpha", "releaseYear": None,
                "genres": [{"id": 28, "name": "Action"}], "overview": None,
                "popularityScore": None, "voteAverage": None, "voteCount": None,
                "backdropUrl": None, "posterUrl": None,
                "trailer": {"site": "YouTube", "key": "AbCdEf123_-", "name": "Official trailer",
                            "type": "Trailer", "official": True, "language": "en",
                            "publishedAt": "2026-10-20T10:00:00Z",
                            "url": "https://www.youtube.com/watch?v=AbCdEf123_-"},
            }
            assert client.get(f"/api/movies/{before[1][0]}").json()["data"]["movie"]["trailer"] is None
            assert "trailer" not in client.get("/api/movies").json()["data"]["movies"][0]
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(old)


def test_malformed_and_provider_failures_keep_last_success(database):
    gateway = Gateway()
    with database() as session, session.begin():
        enrich_tmdb_trailers(session, client=gateway, limit=1)
    succeeded = rows(database)[0].trailer_succeeded_at
    gateway.videos[101] = {"results": None}
    with database() as session, session.begin():
        result = enrich_tmdb_trailers(session, client=gateway, limit=1)
    movie = rows(database)[0]
    assert result.failed_movie_count == 1
    assert movie.trailer_key == "AbCdEf123_-" and movie.trailer_status == "stale"
    assert movie.trailer_succeeded_at == succeeded and movie.trailer_attempted_at is not None
    gateway.fail_at = 101
    with database() as session, session.begin():
        result = enrich_tmdb_trailers(session, client=gateway, limit=2)
    assert result.failed_movie_count == 1 and result.fetched_movie_count == 2
    assert rows(database)[0].trailer_key == "AbCdEf123_-"


def test_authentication_stops_before_next_movie(database):
    gateway = Gateway()
    gateway.fail_at = 101
    gateway.failure = TmdbAuthenticationError("synthetic auth failure")
    with database() as session, session.begin():
        result = enrich_tmdb_trailers(session, client=gateway, limit=2)
    assert result.authentication_stopped and result.fetched_movie_count == 1
    assert gateway.calls == [101]
    assert rows(database)[0].trailer_status == "error"


def test_database_failure_rolls_back_prior_trailer_writes(database, monkeypatch):
    from app.catalogue import tmdb_import
    original = tmdb_import._set_movie_trailer
    calls = 0

    def fail_second(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise SQLAlchemyError("synthetic write failure")
        return original(*args, **kwargs)

    monkeypatch.setattr(tmdb_import, "_set_movie_trailer", fail_second)
    with pytest.raises(SQLAlchemyError), database() as session, session.begin():
        enrich_tmdb_trailers(session, client=Gateway(), limit=2)
    assert calls == 2
    assert all(movie.trailer_key is None for movie in rows(database))


@pytest.mark.parametrize("limit", [0, 301, True, 1.5])
def test_budget_rejected_before_requests(database, limit):
    gateway = Gateway()
    with database() as session, pytest.raises(ValueError):
        enrich_tmdb_trailers(session, client=gateway, limit=limit)
    assert gateway.calls == []


def test_fresh_and_populated_upgrade_preserves_existing_rows(tmp_path):
    url = f"sqlite:///{(tmp_path / 'trailer-upgrade.db').as_posix()}"
    _alembic(url, "upgrade", "f2c7e4a91b60")
    engine = create_engine(url)
    try:
        _seed_existing_data(engine)
        with engine.connect() as connection:
            before = {table: connection.execute(text(f"SELECT * FROM {table}")).all()
                      for table in ("users", "user_genre_preferences", "user_movie_ratings",
                                    "catalog_movies", "catalogue_state")}
        _alembic(url, "upgrade", "head")
        with engine.connect() as connection:
            for table in ("users", "user_genre_preferences", "user_movie_ratings", "catalogue_state"):
                assert connection.execute(text(f"SELECT * FROM {table}")).all() == before[table]
            assert [tuple(row)[:len(before["catalog_movies"][0])]
                    for row in connection.execute(text("SELECT * FROM catalog_movies"))] == [tuple(row) for row in before["catalog_movies"]]
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
            assert "trailer_key" in {c["name"] for c in inspect(engine).get_columns("catalog_movies")}
    finally:
        engine.dispose()
    fresh_url = f"sqlite:///{(tmp_path / 'trailer-fresh.db').as_posix()}"
    _alembic(fresh_url, "upgrade", "head")
    fresh = create_engine(fresh_url)
    try:
        assert "trailer_status" in {c["name"] for c in inspect(fresh).get_columns("catalog_movies")}
    finally:
        fresh.dispose()
