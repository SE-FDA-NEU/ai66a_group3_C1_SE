"""Country isolation, shared fetching and applied-schema compatibility."""

import os
import subprocess
import sys
from datetime import UTC, datetime

import pytest
from app.catalogue.providers import (
    SUPPORTED_COUNTRIES,
    select_regional_providers,
    watch_options_url,
)
from app.catalogue.tmdb_import import enrich_tmdb_providers_all
from app.db.models import MovieProviderCheck, MovieWatchProvider
from app.integrations.tmdb import TmdbRetryDeferredError
from app.main import app, get_db
from fastapi.testclient import TestClient
from sqlalchemy import func, select, text
from sqlalchemy.orm import sessionmaker
from test_backdrop_storage import ROOT, _alembic, _engine, _seed_existing_data
from test_provider_enrichment import payload, provider
from test_trailer_enrichment import database as database  # noqa: PLC0414
from test_trailer_enrichment import rows


def regional_payload(movie_id):
    return {"id": movie_id, "results": {
        country: payload(movie_id, region=country, flatrate=[provider(index, country)])["results"][country]
        for index, country in enumerate(SUPPORTED_COUNTRIES, 1)
    }}


class Gateway:
    def __init__(self):
        self.calls = []
        self.bad_country = None
        self.defer = False

    def fetch_movie_watch_providers(self, movie_id):
        self.calls.append(movie_id)
        if self.defer:
            raise TmdbRetryDeferredError(120)
        data = regional_payload(movie_id)
        if self.bad_country:
            data["results"][self.bad_country]["flatrate"] = None
        return data


@pytest.mark.parametrize("country", SUPPORTED_COUNTRIES)
def test_selection_and_url_require_the_requested_country(country):
    selected, link, status = select_regional_providers(regional_payload(101), 101, country)
    assert [row.name for row in selected] == [country]
    assert status == "valid" and link.endswith("locale=" + country)
    other = "GB" if country == "US" else "US"
    assert watch_options_url(link, 101, other) is None
    assert watch_options_url(link, 102, country) is None


def test_shared_fetch_and_independent_region_resume(database):
    gateway = Gateway()
    first = enrich_tmdb_providers_all(database, client=gateway)
    assert gateway.calls == [101, 102]
    assert first.movie_fetch_count == first.http_request_count == first.processed_movie_count == 2
    assert [region.country for region in first.regions] == list(SUPPORTED_COUNTRIES)
    assert all(region.processed_movie_count == region.valid_link_movie_count == 2 for region in first.regions)
    assert sum(region.processed_movie_count for region in first.regions) == 6
    first_id = rows(database)[0].id
    with database() as session, session.begin():
        checks = session.scalars(select(MovieProviderCheck)).all()
        unchanged = {(check.movie_id, check.country): (check.attempted_at, check.checked_at)
                     for check in checks if (check.movie_id, check.country) != (first_id, "GB")}
        session.get(MovieProviderCheck, (first_id, "GB")).status = "stale"
    gateway.calls.clear()
    resumed = enrich_tmdb_providers_all(database, client=gateway)
    assert gateway.calls == [101]
    assert resumed.processed_movie_count == 1 and resumed.already_checked_movie_count == 1
    assert {r.country: r.processed_movie_count for r in resumed.regions} == {"US": 0, "GB": 1, "SG": 0}
    with database() as session:
        for key, times in unchanged.items():
            check = session.get(MovieProviderCheck, key)
            assert (check.attempted_at, check.checked_at) == times
        assert session.scalar(select(func.count()).select_from(MovieWatchProvider)) == 6
    noop = enrich_tmdb_providers_all(database, client=gateway)
    assert noop.processed_movie_count == noop.movie_fetch_count == noop.http_request_count == 0
    assert noop.already_checked_movie_count == 2


def test_malformed_region_does_not_discard_other_regions(database):
    gateway = Gateway()
    gateway.bad_country = "GB"
    result = enrich_tmdb_providers_all(database, client=gateway)
    assert result.failed_movie_count == 2
    assert {r.country: r.failed_movie_count for r in result.regions} == {"US": 0, "GB": 2, "SG": 0}
    with database() as session:
        for movie in rows(database):
            assert session.get(MovieProviderCheck, (movie.id, "GB")).status == "error"
            assert session.get(MovieProviderCheck, (movie.id, "US")).status == "success"
    gateway.bad_country = None
    repaired = enrich_tmdb_providers_all(database, client=gateway)
    assert repaired.failed_movie_count == 0
    assert {r.country: r.processed_movie_count for r in repaired.regions} == {"US": 0, "GB": 2, "SG": 0}


def test_deferred_request_preserves_all_last_successes_and_counts_regions(database):
    gateway = Gateway()
    enrich_tmdb_providers_all(database, client=gateway)
    with database() as session:
        before = {(check.movie_id, check.country): (check.checked_at, check.watch_options_url)
                  for check in session.scalars(select(MovieProviderCheck))}
    gateway.defer = True
    failed = enrich_tmdb_providers_all(database, client=gateway, refresh=True)
    assert failed.retry_after_seconds == 120
    assert failed.processed_movie_count == failed.failed_movie_count == failed.remaining_movie_count == 1
    assert all(region.processed_movie_count == region.failed_movie_count == region.remaining_movie_count == 1
               for region in failed.regions)
    with database() as session:
        for key, values in before.items():
            check = session.get(MovieProviderCheck, key)
            assert (check.checked_at, check.watch_options_url) == values
        assert session.scalar(select(func.count()).select_from(MovieWatchProvider)) == 6


def test_details_default_validation_switching_and_legacy_isolation(database, monkeypatch):
    def dependency():
        with database() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, dependency)
    enrich_tmdb_providers_all(database, client=Gateway())
    movie_id = rows(database)[0].id
    with database() as session, session.begin():
        session.add(MovieProviderCheck(movie_id=movie_id, country="VN", status="success",
                    attempted_at=datetime.now(UTC), checked_at=datetime.now(UTC),
                    watch_options_url="https://www.themoviedb.org/movie/101/watch?locale=VN"))
    with TestClient(app) as http:
        assert http.get(f"/api/movies/{movie_id}").json()["data"]["movie"]["providers"]["country"] == "US"
        for country in ("SG", "US", "GB", "US"):
            data = http.get(f"/api/movies/{movie_id}?country={country}").json()["data"]["movie"]
            assert data["providers"]["country"] == country
            assert data["providers"]["groups"]["flatrate"][0]["name"] == country
            assert data["watchOptionsUrl"].endswith("locale=" + country)
        for country in ("VN", "CA", "us", ""):
            response = http.get(f"/api/movies/{movie_id}?country={country}")
            assert response.status_code == 400
            assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_follow_on_sqlite_migration_keeps_legacy_children_and_refuses_loss(tmp_path):
    url = f"sqlite:///{tmp_path / 'legacy.db'}"
    _alembic(url, "upgrade", "b8e4d2c96f10")
    engine = _engine(url)
    _seed_existing_data(engine)
    factory = sessionmaker(engine)
    try:
        with factory() as session, session.begin():
            session.add(MovieProviderCheck(movie_id="movie-a", country="VN", status="success",
                attempted_at=datetime.now(UTC), providers=[MovieWatchProvider(
                    movie_id="movie-a", country="VN", availability_type=group, provider_id=8, name="Legacy",
                ) for group in ("rent", "buy")]))
        _alembic(url, "upgrade", "head")
        _alembic(url, "check")
        with factory() as session, session.begin():
            assert len(session.get(MovieProviderCheck, ("movie-a", "VN")).providers) == 2
            session.add(MovieProviderCheck(movie_id="movie-a", country="US", status="no_data",
                                          attempted_at=datetime.now(UTC)))
        result = subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
                                 "downgrade", "b8e4d2c96f10"], cwd=ROOT,
                                env=os.environ | {"DATABASE_URL": url}, capture_output=True, text=True,
                                check=False, timeout=30)
        assert result.returncode != 0 and "Regional provider data must be preserved" in result.stderr
        with factory() as session, session.begin():
            assert session.get(MovieProviderCheck, ("movie-a", "US")) is not None
            session.delete(session.get(MovieProviderCheck, ("movie-a", "US")))
        _alembic(url, "downgrade", "b8e4d2c96f10")
        with factory() as session:
            assert len(session.get(MovieProviderCheck, ("movie-a", "VN")).providers) == 2
        with engine.connect() as connection:
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
    finally:
        engine.dispose()
