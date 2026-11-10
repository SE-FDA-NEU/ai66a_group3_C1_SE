"""S4-T01: safe, additive poster projection and media-only persistence."""

from collections.abc import Iterator

import pytest
from app.catalogue.posters import poster_url, valid_poster_path
from app.catalogue.tmdb_import import enrich_tmdb_posters, import_tmdb_catalogue
from app.db.database import Base
from app.db.models import CatalogMovie
from app.integrations.tmdb import TmdbImportError
from app.main import app, get_db
from app.repositories.movies import to_movie_detail_dto, to_movie_summary_dto
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect, select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from test_backdrop_storage import _alembic, _seed_existing_data, _snapshot


def movie_with_poster(path: str | None) -> CatalogMovie:
    movie = CatalogMovie(
        id="poster-movie-a", catalogue_revision_id="revision-a", source="tmdb",
        source_id="1", title="Poster Alpha", release_year=2024,
        overview="An invented story.", popularity_score=80,
    )
    movie.poster_path = path
    return movie


def test_summary_projects_validated_poster_url() -> None:
    # RED: existing production mapper omits this field. No import/setup mutation.
    summary = to_movie_summary_dto(movie_with_poster("/posterA.jpg")).model_dump()
    assert summary.get("posterUrl") == "https://image.tmdb.org/t/p/w500/posterA.jpg"


def test_detail_projects_validated_poster_url() -> None:
    detail = to_movie_detail_dto(movie_with_poster("/posterA.jpg")).model_dump()
    assert detail.get("posterUrl") == "https://image.tmdb.org/t/p/w500/posterA.jpg"


@pytest.mark.parametrize(("path", "expected"), [
    ("/sceneA.jpg", "https://image.tmdb.org/t/p/w780/sceneA.jpg"),
    (None, None), ("", None), ("bad.jpg", None), ("/nested/x.jpg", None),
    ("//evil.invalid/a.jpg", None), ("/a.jpg?token=x", None),
    ("https://evil.invalid/a.jpg", None), (1, None),
])
def test_summary_projects_only_validated_backdrop_urls(path, expected) -> None:
    movie = movie_with_poster(None)
    movie.backdrop_path = path
    assert to_movie_summary_dto(movie).backdropUrl == expected


@pytest.mark.parametrize("path", [None, "", "bad.jpg", "//evil.invalid/x.jpg", "/../x.jpg",
                                    "/nested/x.jpg", "/x.jpg?q=1", "https://evil.invalid/x.jpg", 1])
def test_unsafe_missing_or_nested_paths_are_not_urls(path) -> None:
    assert not valid_poster_path(path)
    assert poster_url(path) is None
    assert to_movie_summary_dto(movie_with_poster(path)).posterUrl is None


def test_only_the_reviewed_size_is_allowed() -> None:
    assert poster_url("/posterA.jpg", size="original") is None
    assert poster_url("/posterA.jpg", size="../w500") is None


class Gateway:
    """Only the external provider is fake; importer/repository/API are real."""
    def __init__(self):
        self.calls = []
        self.details = {101: {"poster_path": "/newA.jpg"}, 102: {"poster_path": "/newB.jpg"}}
        self.fail_at = None
        self.movies = [
            {"id": 101, "title": "Alpha", "genre_ids": [28], "overview": "Synthetic adventure.", "popularity": 90, "poster_path": "/oldA.jpg"},
            {"id": 102, "title": "Beta", "genre_ids": [28], "overview": "Synthetic rescue.", "popularity": 80, "poster_path": "/oldB.jpg"},
        ]

    def fetch_genres(self):
        return [{"id": 28, "name": "Action"}]

    def fetch_popular_movies(self, page):
        self.calls.append(("popular", page))
        return self.movies

    def fetch_movie_details(self, movie_id):
        self.calls.append(("details", movie_id))
        if movie_id == self.fail_at:
            raise TmdbImportError("controlled provider failure")
        return self.details[movie_id]


@pytest.fixture
def sessions() -> Iterator[sessionmaker]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine)
    with factory() as session, session.begin():
        import_tmdb_catalogue(session, client=Gateway(), pages=1)
    try:
        yield factory
    finally:
        engine.dispose()


def state(factory) -> tuple:
    with factory() as session:
        movies = session.scalars(select(CatalogMovie).order_by(CatalogMovie.source_id)).all()
        core = [(m.id, m.catalogue_revision_id, m.title, m.overview, m.popularity_score,
                 m.source_fetched_at, m.backdrop_path, [g.id for g in m.genres]) for m in movies]
        return core, [m.poster_path for m in movies]


def test_import_projects_posters_without_per_movie_detail_calls(sessions) -> None:
    gateway = Gateway()
    with sessions() as session, session.begin():
        import_tmdb_catalogue(session, client=gateway, pages=1)
    assert gateway.calls == [("popular", 1)]
    assert state(sessions)[1] == ["/oldA.jpg", "/oldB.jpg"]


def test_enrichment_is_bounded_idempotent_and_preserves_all_core_text(sessions) -> None:
    before = state(sessions)[0]
    gateway = Gateway()
    with sessions() as session, session.begin():
        result = enrich_tmdb_posters(session, client=gateway, limit=1)
    assert result.eligible_movie_count == 2
    assert result.fetched_movie_count == result.updated_movie_count == 1
    assert gateway.calls == [("details", 101)]
    assert state(sessions) == (before, ["/newA.jpg", "/oldB.jpg"])
    with sessions() as session, session.begin():
        result = enrich_tmdb_posters(session, client=gateway, limit=1)
    assert result.updated_movie_count == 0
    assert result.unchanged_movie_count == 1


@pytest.mark.parametrize("payload,field", [({}, "missing_movie_count"), ({"poster_path": "https://evil.invalid/x.jpg"}, "invalid_movie_count")])
def test_missing_or_invalid_metadata_preserves_previous_poster(sessions, payload, field) -> None:
    before = state(sessions)
    gateway = Gateway()
    gateway.details[101] = payload
    with sessions() as session, session.begin():
        result = enrich_tmdb_posters(session, client=gateway, limit=1)
    assert getattr(result, field) == 1
    assert state(sessions) == before


def test_known_null_clears_only_the_poster(sessions) -> None:
    before = state(sessions)[0]
    gateway = Gateway()
    gateway.details[101] = {"poster_path": None}
    with sessions() as session, session.begin():
        result = enrich_tmdb_posters(session, client=gateway, limit=1)
    assert result.cleared_movie_count == 1
    assert state(sessions) == (before, [None, "/oldB.jpg"])


def test_partial_provider_failure_rolls_back_every_poster(sessions) -> None:
    before = state(sessions)
    gateway = Gateway()
    gateway.fail_at = 102
    with pytest.raises(TmdbImportError), sessions() as session, session.begin():
        enrich_tmdb_posters(session, client=gateway, limit=2)
    assert state(sessions) == before


def test_database_failure_rolls_back_previously_written_posters(sessions, monkeypatch) -> None:
    from app.catalogue import tmdb_import

    before = state(sessions)
    original = tmdb_import.set_movie_poster_path
    calls = 0

    def fail_second_write(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise SQLAlchemyError("synthetic second-write failure")
        return original(*args, **kwargs)

    monkeypatch.setattr(tmdb_import, "set_movie_poster_path", fail_second_write)
    with pytest.raises(SQLAlchemyError), sessions() as session, session.begin():
        enrich_tmdb_posters(session, client=Gateway(), limit=2)
    assert calls == 2
    assert state(sessions) == before


def test_backfill_preserves_accounts_ratings_preferences_backdrops_and_retired_movies(tmp_path) -> None:
    url = f"sqlite:///{(tmp_path / 'poster-preservation.db').as_posix()}"
    _alembic(url, "upgrade", "head")
    engine = create_engine(url)
    try:
        _seed_existing_data(engine)
        with engine.begin() as connection:
            connection.execute(text("UPDATE catalogue_revisions SET provider='tmdb'"))
            connection.execute(text("UPDATE catalog_movies SET source='tmdb', backdrop_path='/keep.jpg', poster_path='/previous.jpg'"))
        before = _snapshot(engine)
        factory = sessionmaker(bind=engine)
        with factory() as session, session.begin():
            result = enrich_tmdb_posters(session, client=Gateway(), limit=300)
        assert result.fetched_movie_count == result.updated_movie_count == 2
        # Every row in every non-media table/column is unchanged, not just counts.
        assert _snapshot(engine) == before
        with engine.connect() as connection:
            assert connection.execute(text("SELECT DISTINCT backdrop_path FROM catalog_movies")).scalars().all() == ["/keep.jpg"]
            assert dict(connection.execute(text("SELECT id, poster_path FROM catalog_movies")).all()) == {
                "movie-a": "/newA.jpg", "movie-b": "/newB.jpg", "retired-movie": "/previous.jpg",
            }
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    finally:
        engine.dispose()


@pytest.mark.parametrize("limit", [0, 301, True, 1.5])
def test_bad_budget_is_rejected_before_provider_io(sessions, limit) -> None:
    gateway = Gateway()
    with sessions() as session, pytest.raises(ValueError):
        enrich_tmdb_posters(session, client=gateway, limit=limit)
    assert gateway.calls == []


def test_reimport_missing_field_preserves_but_explicit_null_clears(sessions) -> None:
    gateway = Gateway()
    del gateway.movies[0]["poster_path"]
    gateway.movies[1]["poster_path"] = None
    ids = [row[0] for row in state(sessions)[0]]
    with sessions() as session, session.begin():
        import_tmdb_catalogue(session, client=gateway, pages=1)
    assert state(sessions)[1] == ["/oldA.jpg", None]
    assert [row[0] for row in state(sessions)[0]] == ids


def test_api_lists_and_detail_read_local_posters_without_provider(sessions, monkeypatch) -> None:
    def dependency():
        with sessions() as session:
            yield session

    def forbidden(*_args, **_kwargs):
        raise AssertionError("runtime must not call TMDb")

    monkeypatch.setattr("app.integrations.tmdb.TmdbClient.fetch_movie_details", forbidden)
    previous = app.dependency_overrides.copy()
    app.dependency_overrides[get_db] = dependency
    try:
        with TestClient(app) as client:
            for endpoint in ("/api/movies", "/api/movies/popular"):
                response = client.get(endpoint)
                assert response.status_code == 200
                assert response.json()["data"]["movies"][0]["posterUrl"].endswith("/oldA.jpg")
            movie_id = state(sessions)[0][0][0]
            detail = client.get(f"/api/movies/{movie_id}").json()["data"]["movie"]
            assert detail["posterUrl"].endswith("/oldA.jpg")
            assert "poster_path" not in detail
            assert client.get("/api/movies/unknown").status_code == 404
    finally:
        app.dependency_overrides.clear()
        app.dependency_overrides.update(previous)


def test_fresh_and_populated_upgrade_preserve_accounts_ratings_and_backdrops(tmp_path) -> None:
    path = tmp_path / "poster-upgrade.db"
    url = f"sqlite:///{path.as_posix()}"
    _alembic(url, "upgrade", "c6f8a2d4e901")
    engine = create_engine(url)
    try:
        _seed_existing_data(engine)
        with engine.begin() as connection:
            connection.execute(text("UPDATE catalog_movies SET backdrop_path='/retained.jpg'"))
        before = _snapshot(engine)
        # Compare only the poster migration; T12 tests later additive storage.
        _alembic(url, "upgrade", "d8a4e6f20195")
        assert _snapshot(engine) == before
        columns = {c["name"]: c for c in inspect(engine).get_columns("catalog_movies")}
        assert columns["poster_path"]["nullable"]
        with engine.connect() as connection:
            assert connection.execute(text("SELECT DISTINCT backdrop_path FROM catalog_movies")).scalars().all() == ["/retained.jpg"]
            assert connection.execute(text("SELECT DISTINCT poster_path FROM catalog_movies")).scalars().all() == [None]
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    finally:
        engine.dispose()
    fresh = f"sqlite:///{(tmp_path / 'poster-fresh.db').as_posix()}"
    _alembic(fresh, "upgrade", "head")
    engine = create_engine(fresh)
    try:
        assert "poster_path" in {c["name"] for c in inspect(engine).get_columns("catalog_movies")}
    finally:
        engine.dispose()
