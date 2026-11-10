"""Offline T04 acceptance: VN persistence, safe links, retries and recovery."""

import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta

import httpx
import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.catalogue.providers import (
    PROVIDER_GROUPS,
    select_regional_providers,
    watch_options_url,
)
from app.catalogue.tmdb_import import (
    TmdbProviderAllError,
    enrich_tmdb_providers_all,
)
from app.db.database import Base
from app.db.models import (
    AuthSession,
    CatalogMovie,
    MovieProviderCheck,
    MovieWatchProvider,
    User,
    UserGenrePreference,
    UserMovieRating,
    UserMovieWatchlist,
)
from app.integrations.tmdb import (
    TmdbAuthenticationError,
    TmdbClient,
    TmdbImportError,
    TmdbPayloadError,
    TmdbRetryDeferredError,
)
from app.main import app, get_db
from app.recommendations.overview_index import (
    active_corpus,
    load_active_index,
    rebuild_active_index,
)
from app.repositories.movies import get_active_movie_by_id, to_movie_detail_dto
from fastapi.testclient import TestClient
from sqlalchemy import event, func, inspect, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import sessionmaker
from test_backdrop_storage import ROOT, _alembic, _engine, _seed_existing_data
from test_trailer_enrichment import Gateway, rows
from test_trailer_enrichment import (
    database as database,  # noqa: PLC0414 -- reuse/export the offline fixture
)


def provider(identity=8, name="Synthetic Stream", logo="/provider.jpg"):
    return {"provider_id": identity, "provider_name": name, "logo_path": logo}


def payload(movie_id=101, *, region="US", link="default", **groups):
    regional = groups or {"flatrate": [provider()]}
    if link == "default":
        link = f"https://www.themoviedb.org/movie/{movie_id}/watch?locale={region}"
    if link is not None:
        regional["link"] = link
    return {"id": movie_id, "results": {region: regional}}


class ProviderGateway(Gateway):
    def fetch_movie_watch_providers(self, movie_id):
        self.calls.append(movie_id)
        if movie_id == self.fail_at:
            raise self.failure
        return payload(movie_id) if movie_id == 101 else {"id": movie_id, "results": {}}


@pytest.mark.parametrize("link", [
    "https://www.themoviedb.org/movie/101/watch?locale=US",
    "https://themoviedb.org/movie/101/watch?locale=US",
    "https://www.themoviedb.org:443/movie/101/watch?locale=US",
    "https://www.themoviedb.org/movie/101-a-movie-title/watch?locale=US",
])
def test_supplied_watch_page_contract(link):
    assert watch_options_url(link, 101) == link


@pytest.mark.parametrize("link", [
    None, "", "http://www.themoviedb.org/movie/101/watch?locale=US",
    "javascript:alert(1)", "https://netflix.com/movie/101/watch?locale=US",
    "https://www.themoviedb.org.attacker.test/movie/101/watch?locale=US",
    "https://fake.themoviedb.org/movie/101/watch?locale=US",
    "https://user@www.themoviedb.org/movie/101/watch?locale=US",
    "https://user:password@www.themoviedb.org/movie/101/watch?locale=US",
    "https://www.themoviedb.org:444/movie/101/watch?locale=US",
    "https://www.themoviedb.org:/movie/101/watch?locale=US",
    "https://www.themoviedb.org:bad/movie/101/watch?locale=US",
    "https://www.themoviedb.org/movie/102/watch?locale=US",
    "https://www.themoviedb.org/movie/101/watch?locale=GB",
    "https://www.themoviedb.org/movie/101/watch?locale=US&locale=GB",
    "https://www.themoviedb.org/movie/101/watch?locale=US&redirect=https://attacker.test",
    "https://www.themoviedb.org/movie/101/watch", "https://www.themoviedb.org/movie/101?locale=US",
    "https://www.themoviedb.org/movie/101/watch?watch_region=VN",
    "https://www.themoviedb.org/movie/101/../102/watch?locale=US",
    "https://www.themoviedb.org/movie/101/watch?locale=US#private",
    " https://www.themoviedb.org/movie/101/watch?locale=US",
    "https://www.themoviedb.org/movie/101/watch?locale=V\nN",
])
def test_invalid_or_other_region_links_are_null(link):
    assert watch_options_url(link, 101) is None


def test_groups_deduplicate_without_collapsing_membership_and_link_is_independent():
    data = payload(**{group: [provider(), provider()] for group in PROVIDER_GROUPS},
                   link="https://attacker.test/movie/101")
    data["results"]["GB"] = {"flatrate": [provider(99, "US only")]}
    selected, link, link_status = select_regional_providers(data, 101)
    assert len(selected) == 5
    assert {row.group for row in selected} == set(PROVIDER_GROUPS)
    assert {row.provider_id for row in selected} == {8}
    assert link is None and link_status == "invalid"
    reordered = payload(**{group: [provider(8, "Z"), provider(8, "A")] for group in PROVIDER_GROUPS})
    first = select_regional_providers(reordered, 101)[0]
    for group in PROVIDER_GROUPS:
        reordered["results"]["US"][group].reverse()
    assert first == select_regional_providers(reordered, 101)[0]


@pytest.mark.parametrize("data", [
    {}, {"id": 102, "results": {}}, {"id": True, "results": {}},
    {"id": 101, "results": None}, {"id": 101, "results": {"US": None}},
    payload(flatrate=None), payload(flatrate=[None]),
    payload(flatrate=[provider(True)]), payload(flatrate=[provider(-1)]),
    payload(flatrate=[provider(name=" ")]),
])
def test_malformed_checks_are_failures_rather_than_empty_availability(data):
    with pytest.raises(TmdbPayloadError):
        select_regional_providers(data, 101)


@pytest.mark.parametrize("data,expected_status", [
    (payload(region="GB"), "missing"),
    ({"id": 101, "results": {}}, "missing"),
    (payload(flatrate=[], link=None), "missing"),
])
def test_no_vn_and_missing_links_do_not_borrow_other_countries(data, expected_status):
    selected, link, status = select_regional_providers(data, 101)
    assert selected == [] and link is None and status == expected_status


def test_empty_groups_can_have_a_valid_link_and_bad_logos_are_null():
    selected, link, status = select_regional_providers(payload(flatrate=[]), 101)
    assert selected == [] and link.endswith("locale=US") and status == "valid"
    selected, link, status = select_regional_providers(payload(link=None, flatrate=[provider(logo="https://evil.test/logo.jpg")]), 101)
    assert selected[0].logo_path is None
    assert link is None and status == "missing"


@pytest.mark.parametrize("statuses,expected_requests,expected_waits", [
    ([429, 503, 200], 3, [2.0, 2.0]),
    ([429, 429, 429], 3, [2.0, 2.0]),
    ([401], 1, []), ([404], 1, []),
])
def test_shared_adapter_uses_auth_and_bounded_retry(monkeypatch, statuses, expected_requests, expected_waits):
    calls, waits = [], []
    monkeypatch.setattr("app.integrations.tmdb.sleep", waits.append)

    def respond(request):
        calls.append(request)
        return httpx.Response(statuses[len(calls) - 1], json=payload(), headers={"Retry-After": "2"})

    with httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(respond)) as http:
        client = TmdbClient("synthetic-token", http_client=http)
        if statuses[-1] == 200:
            assert client.fetch_movie_watch_providers(101) == payload()
        else:
            with pytest.raises(TmdbImportError) as error:
                client.fetch_movie_watch_providers(101)
            assert "synthetic-token" not in str(error.value)
    assert len(calls) == expected_requests and waits == expected_waits
    assert client.request_count == expected_requests
    assert all(request.url.path == "/3/movie/101/watch/providers" for request in calls)
    assert all(request.headers["Authorization"] == "Bearer synthetic-token" for request in calls)


def test_timeout_retry_is_bounded_and_retry_after_is_preserved(monkeypatch):
    from app.integrations.tmdb import _retry_delay

    calls, waits = [], []
    monkeypatch.setattr("app.integrations.tmdb.sleep", waits.append)

    def respond(request):
        calls.append(request)
        raise httpx.ReadTimeout("private-token and URL must not be echoed")

    with (
        httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(respond)) as http,
        pytest.raises(TmdbImportError, match="^TMDb request timed out$"),
    ):
        TmdbClient("synthetic-token", http_client=http).fetch_movie_watch_providers(101)
    assert len(calls) == 3 and waits == [1, 2]
    assert _retry_delay("99999", 0) == 99999
    assert _retry_delay("nonsense", 1) == 2
    assert _retry_delay("NaN", 1) == 2
    assert _retry_delay("Infinity", 1) == 2
    assert _retry_delay("Wed, 01 Jan 2020 00:00:00 GMT", 0) == 0


@pytest.mark.parametrize("retry_after", ["120", "date"])
def test_long_retry_after_defers_without_an_early_request(monkeypatch, retry_after):
    calls, waits = [], []
    monkeypatch.setattr("app.integrations.tmdb.sleep", waits.append)
    if retry_after == "date":
        from email.utils import format_datetime
        retry_after = format_datetime(datetime.now(UTC) + timedelta(seconds=120), usegmt=True)

    def respond(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": retry_after})

    with (
        httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(respond)) as http,
        pytest.raises(TmdbRetryDeferredError) as error,
    ):
        TmdbClient("synthetic-token", http_client=http).fetch_movie_watch_providers(101)
    assert 118 <= error.value.retry_after_seconds <= 120
    assert len(calls) == 1 and waits == []


def test_exhausted_rate_limit_defers_instead_of_calling_next_movie(monkeypatch):
    waits = []
    monkeypatch.setattr("app.integrations.tmdb.sleep", waits.append)
    with (
        httpx.Client(base_url="https://api.themoviedb.org/3", transport=httpx.MockTransport(
            lambda _request: httpx.Response(429, headers={"Retry-After": "2"}),
        )) as http,
        pytest.raises(TmdbRetryDeferredError) as error,
    ):
        TmdbClient("synthetic-token", http_client=http).fetch_movie_watch_providers(101)
    assert error.value.retry_after_seconds == 2 and waits == [2, 2]


def test_deferred_refresh_preserves_success_and_resumes(database):
    gateway = ProviderGateway()
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    first_id = rows(database)[0].id
    with database() as session:
        before = session.get(MovieProviderCheck, (first_id, "US"))
        previous = (before.checked_at, before.watch_options_url)
    gateway.calls.clear()
    gateway.fail_at, gateway.failure = 101, TmdbRetryDeferredError(120)
    result = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    assert gateway.calls == [101]
    assert result.retry_after_seconds == 120 and not result.authentication_stopped
    assert result.processed_movie_count == result.failed_movie_count == result.remaining_movie_count == 1
    with database() as session:
        after = session.get(MovieProviderCheck, (first_id, "US"))
        assert after.status == "stale"
        assert (after.checked_at, after.watch_options_url) == previous
        assert len(after.providers) == 1
    gateway.fail_at = None
    resumed = enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    assert resumed.processed_movie_count == 1 and resumed.already_checked_movie_count == 1
    assert resumed.failed_movie_count == resumed.remaining_movie_count == 0


def test_persistence_reruns_and_last_success_survives_failure(database):
    gateway = ProviderGateway()
    first = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, batch_size=1)
    assert (first.eligible_movie_count, first.processed_movie_count, first.remaining_movie_count) == (2, 2, 0)
    assert (first.with_data_movie_count, first.no_data_movie_count, first.failed_movie_count) == (1, 1, 0)
    assert (first.valid_link_movie_count, first.missing_link_movie_count, first.invalid_link_movie_count) == (1, 1, 0)
    resume = enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    assert resume.processed_movie_count == 0 and resume.already_checked_movie_count == 2
    assert gateway.calls == [101, 102]
    movie_id = rows(database)[0].id
    with database() as session:
        checked_at = session.get(MovieProviderCheck, (movie_id, "US")).checked_at
    gateway.fail_at = 101
    failed = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    assert failed.failed_movie_count == 1 and failed.no_data_movie_count == 1
    with database() as session:
        check = session.get(MovieProviderCheck, (movie_id, "US"))
        assert check.status == "stale" and check.checked_at == checked_at
        assert check.watch_options_url.endswith("/101/watch?locale=US")
        assert len(check.providers) == 1
    gateway.fail_at = None
    retry = enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    assert retry.processed_movie_count == 1 and retry.already_checked_movie_count == 1
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    with database() as session:
        assert session.scalar(select(func.count()).select_from(MovieWatchProvider)) == 1
        assert session.get(MovieProviderCheck, (movie_id, "US")).status == "success"


def test_all_groups_persist_and_successful_empty_response_clears_previous(database, monkeypatch):
    gateway = ProviderGateway()
    monkeypatch.setattr(gateway, "fetch_movie_watch_providers", lambda movie_id: payload(
        movie_id, **{group: [provider(), provider()] for group in PROVIDER_GROUPS},
    ))
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    with database() as session:
        assert session.scalar(select(func.count()).select_from(MovieWatchProvider)) == 10
    monkeypatch.setattr(gateway, "fetch_movie_watch_providers", lambda movie_id: {"id": movie_id, "results": {}})
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    with database() as session:
        assert session.scalar(select(func.count()).select_from(MovieWatchProvider)) == 0
        assert all(check.status == "no_data" and check.watch_options_url is None
                   for check in session.scalars(select(MovieProviderCheck)))


def test_authentication_stop_then_resume_visits_more_than_300_movies(database):
    with database() as session, session.begin():
        revision_id = rows(database)[0].catalogue_revision_id
        session.add_all(CatalogMovie(
            id=f"movie-{identity}", source="tmdb", source_id=str(identity),
            catalogue_revision_id=revision_id, title=f"Movie {identity}",
        ) for identity in range(103, 404))
    gateway = ProviderGateway()
    gateway.fail_at, gateway.failure = 101, TmdbAuthenticationError("TMDb authentication failed")
    stopped = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, batch_size=2)
    assert stopped.authentication_stopped and stopped.processed_movie_count == 1
    assert stopped.failed_movie_count == 1 and stopped.remaining_movie_count == 302
    gateway.fail_at = None
    result = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, batch_size=100)
    assert result.eligible_movie_count == result.processed_movie_count == 303
    assert result.remaining_movie_count == result.failed_movie_count == 0
    assert len(set(gateway.calls)) == 303


@pytest.mark.parametrize("batch_size,committed", [(1, 1), (2, 0)])
def test_batch_database_failure_rolls_back_and_resumes(database, batch_size, committed):
    engine = database.kw["bind"]
    second_id = rows(database)[1].id

    def fail(_connection, _cursor, statement, parameters, _context, _many):
        if statement.startswith("INSERT INTO movie_provider_checks") and second_id in repr(parameters):
            raise SQLAlchemyError("private-database-url")

    event.listen(engine, "before_cursor_execute", fail)
    try:
        with pytest.raises(TmdbProviderAllError) as error:
            enrich_tmdb_providers_all(database, countries=("US",), client=ProviderGateway(), batch_size=batch_size)
        assert error.value.partial_result.processed_movie_count == committed
        assert error.value.partial_result.remaining_movie_count == 2 - committed
        assert "private" not in str(error.value)
    finally:
        event.remove(engine, "before_cursor_execute", fail)
    result = enrich_tmdb_providers_all(database, countries=("US",), client=ProviderGateway())
    assert result.processed_movie_count == 2 - committed
    assert result.already_checked_movie_count == committed


@pytest.mark.parametrize("link,entries,expected_status,expected_link", [
    (None, [provider()], "success", False),
    ("https://wrong.test", [provider()], "success", False),
    ("default", [], "no_data", True),
])
def test_provider_and_link_persistence_are_independent(database, monkeypatch, link, entries, expected_status, expected_link):
    gateway = ProviderGateway()
    monkeypatch.setattr(gateway, "fetch_movie_watch_providers", lambda movie_id: payload(
        movie_id, flatrate=entries, link=link,
    ))
    result = enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    assert result.processed_movie_count == 2 and result.failed_movie_count == 0
    with database() as session:
        for check in session.scalars(select(MovieProviderCheck)):
            assert check.status == expected_status
            assert bool(check.watch_options_url) is expected_link
            assert len(check.providers) == len(entries)


def test_malformed_refresh_preserves_last_good_check(database, monkeypatch):
    gateway = ProviderGateway()
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    movie_id = rows(database)[0].id
    with database() as session:
        check = session.get(MovieProviderCheck, (movie_id, "US"))
        previous = (check.checked_at, check.watch_options_url, check.link_status)
    monkeypatch.setattr(gateway, "fetch_movie_watch_providers", lambda movie_id: {"id": movie_id, "results": None})
    result = enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    assert result.failed_movie_count == 2
    with database() as session:
        check = session.get(MovieProviderCheck, (movie_id, "US"))
        assert check.status == "stale"
        assert (check.checked_at, check.watch_options_url, check.link_status) == previous
        assert len(check.providers) == 1


def test_details_switch_movies_and_never_fetch_tmdb(database, monkeypatch):
    def dependency():
        with database() as session:
            yield session

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Details must use local DB only")

    monkeypatch.setitem(app.dependency_overrides, get_db, dependency)
    monkeypatch.setattr(TmdbClient, "_get_json", forbidden)
    first_id, second_id = [movie.id for movie in rows(database)]
    with TestClient(app) as http:
        first = http.get(f"/api/movies/{first_id}").json()["data"]["movie"]
        assert first["providers"]["status"] == "not_checked" and first["watchOptionsUrl"] is None
        enrich_tmdb_providers_all(database, countries=("US",), client=ProviderGateway())
        first = http.get(f"/api/movies/{first_id}").json()["data"]["movie"]
        second = http.get(f"/api/movies/{second_id}").json()["data"]["movie"]
        assert first["providers"]["country"] == second["providers"]["country"] == "US"
        assert first["providers"]["status"] == "success"
        assert first["providers"]["groups"]["flatrate"] == [
            {"id": 8, "name": "Synthetic Stream", "logoUrl": "https://image.tmdb.org/t/p/w92/provider.jpg"},
        ]
        assert first["watchOptionsUrl"].endswith("/101/watch?locale=US")
        assert first["providers"]["attemptedAt"].endswith("Z") and first["providers"]["checkedAt"].endswith("Z")
        assert second["watchOptionsUrl"] is None and second["providers"]["status"] == "no_data"
        assert all(not group for group in second["providers"]["groups"].values())
        assert http.get(f"/api/movies/{first_id}").json()["data"]["movie"] == first
        assert http.get("/api/movies").status_code == 200
    with database() as session, session.begin():
        session.get(MovieProviderCheck, (first_id, "US")).watch_options_url = "https://evil.test"
    with database() as session:
        assert to_movie_detail_dto(get_active_movie_by_id(session, movie_id=first_id)).watchOptionsUrl is None


def _core_rows(factory):
    with factory() as session:
        return {table.name: session.execute(select(table).order_by(*table.primary_key.columns)).all()
                for table in Base.metadata.sorted_tables
                if table.name not in {"movie_provider_checks", "movie_watch_providers"}}


def test_provider_refresh_preserves_exact_accounts_media_identity_and_nlp(database, tmp_path):
    first_id, second_id = [movie.id for movie in rows(database)]
    with database() as session, session.begin():
        for name, movie_id in (("a", first_id), ("b", second_id)):
            session.add(User(id=name, email_normalized=f"{name}@example.test", password_hash="synthetic"))
            session.flush()
            session.add_all([
                UserGenrePreference(user_id=name, genre_id=28),
                UserMovieRating(id=f"rating-{name}", user_id=name, movie_id=movie_id, rating=3.5 if name == "a" else 4.5),
                UserMovieWatchlist(id=f"watch-{name}", user_id=name, movie_id=movie_id),
                AuthSession(token_digest=name * 64, user_id=name, expires_at=datetime.now(UTC) + timedelta(days=1)),
            ])
            movie = session.get(CatalogMovie, movie_id)
            movie.overview = f"Astronaut rescue mission {name}"
            movie.poster_path, movie.backdrop_path, movie.trailer_key = "/poster.jpg", "/backdrop.jpg", "AbCdEf123_-"
    artifact = tmp_path / "index.json"
    with database() as session:
        index = rebuild_active_index(session, artifact)
        corpus = active_corpus(session)
    before = _core_rows(database)
    gateway = ProviderGateway()
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway)
    gateway.fail_at = 101
    enrich_tmdb_providers_all(database, countries=("US",), client=gateway, refresh=True)
    assert _core_rows(database) == before
    with database() as session:
        assert active_corpus(session) == corpus
        assert load_active_index(session, artifact).corpus_digest == index.corpus_digest


def test_migration_fresh_current_constraints_and_single_head(tmp_path):
    scripts = ScriptDirectory.from_config(Config(str(ROOT / "backend/alembic.ini")))
    assert scripts.get_heads() == ["d9a6f2c1e508"]
    assert scripts.get_revision("d9a6f2c1e508").down_revision == "b8e4d2c96f10"
    assert scripts.get_revision("b8e4d2c96f10").down_revision == "a3d1f8b72c44"
    for populated in (False, True):
        url = f"sqlite:///{tmp_path / ('populated.db' if populated else 'fresh.db')}"
        _alembic(url, "upgrade", "a3d1f8b72c44")
        engine = _engine(url)
        try:
            if populated:
                _seed_existing_data(engine)
            factory = sessionmaker(engine)
            # New provider tables do not exist yet; snapshot only the existing tables.
            with engine.connect() as connection:
                before = {name: connection.execute(text(f'SELECT * FROM "{name}"')).all()
                          for name in inspect(engine).get_table_names() if name != "alembic_version"}
            _alembic(url, "upgrade", "head")
            with engine.connect() as connection:
                for name, expected in before.items():
                    assert connection.execute(text(f'SELECT * FROM "{name}"')).all() == expected
                assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
            _alembic(url, "check")
            assert {"movie_provider_checks", "movie_watch_providers"} <= set(inspect(engine).get_table_names())
            if populated:
                with factory() as session, session.begin():
                    session.add(MovieProviderCheck(movie_id="movie-a", country="VN", status="success",
                                                  attempted_at=datetime.now(UTC), checked_at=datetime.now(UTC)))
                    session.flush()
                    for group in ("rent", "buy"):
                        session.add(MovieWatchProvider(movie_id="movie-a", country="VN", availability_type=group,
                                                       provider_id=8, name="Synthetic"))
                with pytest.raises(IntegrityError), factory() as session, session.begin():
                    session.add(MovieWatchProvider(movie_id="movie-a", country="VN", availability_type="rent",
                                                   provider_id=8, name="Duplicate"))
                with pytest.raises(IntegrityError), factory() as session, session.begin():
                    session.add(MovieProviderCheck(movie_id="missing", country="VN", status="success",
                                                  attempted_at=datetime.now(UTC)))
                with pytest.raises(IntegrityError), factory() as session, session.begin():
                    session.add(MovieProviderCheck(movie_id="movie-b", country="CA", status="success",
                                                  attempted_at=datetime.now(UTC)))
            _alembic(url, "downgrade", "a3d1f8b72c44")
            assert "movie_provider_checks" not in inspect(engine).get_table_names()
            _alembic(url, "upgrade", "head")
        finally:
            engine.dispose()


def test_provider_migration_compiles_for_postgresql_without_connecting():
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade",
         "a3d1f8b72c44:head", "--sql"],
        cwd=ROOT, env=os.environ | {
            "DATABASE_URL": "postgresql+psycopg://app@db.example.test/disposable",
            "TMDB_READ_ACCESS_TOKEN": "", "TMDB_NETWORK_DISABLED": "1",
        }, capture_output=True, text=True, timeout=30, check=False,
    )
    assert result.returncode == 0, result.stderr
    assert "CREATE TABLE movie_provider_checks" in result.stdout
    assert "CREATE TABLE movie_watch_providers" in result.stdout
    assert "country IN ('VN', 'US', 'GB', 'SG')" in result.stdout
    assert "FOREIGN KEY(movie_id, country) REFERENCES movie_provider_checks (movie_id, country) ON DELETE CASCADE" in result.stdout
