from __future__ import annotations

from collections.abc import Iterator, Mapping
from datetime import UTC, datetime
from typing import Any

import app.catalogue.tmdb_import as tmdb_import_module
import httpx
import pytest
from app.catalogue.tmdb_import import import_tmdb_catalogue
from app.db.database import Base
from app.db.models import CatalogMovie, CatalogueRevision, User
from app.integrations.tmdb import (
    TMDB_BASE_URL,
    TmdbAuthenticationError,
    TmdbClient,
    TmdbConfigurationError,
    TmdbImportError,
    TmdbPayloadError,
    TmdbRateLimitError,
)
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    get_active_catalogue_revision,
    get_movie_by_source_id,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


class FakeTmdbClient:
    """Deterministic provider boundary used to prove imports never hit TMDb."""

    def __init__(
        self,
        *,
        genres: list[Mapping[str, Any]] | None = None,
        popular_pages: dict[int, list[Mapping[str, Any]]] | None = None,
        details: dict[int, Mapping[str, Any]] | None = None,
        failure: Exception | None = None,
    ) -> None:
        self.genres = genres or []
        self.popular_pages = popular_pages or {1: []}
        self.details = details or {}
        self.failure = failure
        self.calls: list[str] = []

    def fetch_genres(self) -> list[Mapping[str, Any]]:
        self.calls.append("genres")
        self._raise_failure()
        return self.genres

    def fetch_popular_movies(self, page: int) -> list[Mapping[str, Any]]:
        self.calls.append(f"popular:{page}")
        self._raise_failure()
        return self.popular_pages.get(page, [])

    def fetch_movie_details(self, movie_id: int) -> Mapping[str, Any]:
        self.calls.append(f"details:{movie_id}")
        self._raise_failure()
        return self.details[movie_id]

    def _raise_failure(self) -> None:
        if self.failure is not None:
            raise self.failure


@pytest.fixture
def database() -> Iterator[sessionmaker[Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    try:
        yield sessions
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_missing_token_is_rejected_without_echoing_it() -> None:
    with pytest.raises(TmdbConfigurationError) as error:
        TmdbClient.from_environment({"TMDB_READ_ACCESS_TOKEN": "   "})

    assert str(error.value) == (
        "TMDb import requires TMDB_READ_ACCESS_TOKEN in the root .env "
        "or server environment"
    )
    assert "token-value" not in str(error.value)


@pytest.mark.parametrize(
    ("status_code", "error_type", "message"),
    [
        (401, TmdbAuthenticationError, "TMDb authentication failed"),
        (429, TmdbRateLimitError, "TMDb rate limit reached"),
    ],
)
def test_client_maps_provider_statuses_without_exposing_token(
    status_code: int, error_type: type[TmdbImportError], message: str
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(status_code)

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url=TMDB_BASE_URL
    )
    client = TmdbClient("test-token", http_client=http_client)
    try:
        with pytest.raises(error_type) as error:
            client.fetch_genres()
    finally:
        http_client.close()

    assert str(error.value) == message
    assert "test-token" not in str(error.value)
    assert requests[0].headers["Authorization"] == "Bearer test-token"
    assert requests[0].headers["Accept"] == "application/json"


def test_client_maps_timeout_without_exposing_token() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("simulated provider timeout")

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url=TMDB_BASE_URL
    )
    client = TmdbClient("test-token", http_client=http_client)
    try:
        with pytest.raises(TmdbImportError) as error:
            client.fetch_genres()
    finally:
        http_client.close()

    assert str(error.value) == "TMDb request timed out"
    assert "test-token" not in str(error.value)


def test_client_maps_network_or_dns_failure_to_safe_guidance() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("simulated DNS failure")

    http_client = httpx.Client(
        transport=httpx.MockTransport(handler), base_url=TMDB_BASE_URL
    )
    client = TmdbClient("test-token", http_client=http_client)
    try:
        with pytest.raises(TmdbImportError) as error:
            client.fetch_genres()
    finally:
        http_client.close()

    assert str(error.value) == (
        "TMDb request failed; check network/DNS access to api.themoviedb.org"
    )
    assert "test-token" not in str(error.value)


@pytest.mark.parametrize(
    "failure",
    [
        TmdbAuthenticationError("TMDb authentication failed"),
        TmdbRateLimitError("TMDb rate limit reached"),
        TmdbImportError("TMDb request timed out"),
    ],
)
def test_provider_failure_keeps_previous_active_catalogue(
    database: sessionmaker[Session], failure: TmdbImportError
) -> None:
    previous_revision_id, _ = _seed_active_catalogue(database)
    client = FakeTmdbClient(failure=failure)

    with database() as session, pytest.raises(TmdbImportError), session.begin():
        import_tmdb_catalogue(session, client=client)

    with database() as session:
        active_revision = get_active_catalogue_revision(session)
        revisions = list(session.scalars(select(CatalogueRevision)))
        assert active_revision is not None
        assert active_revision.id == previous_revision_id
        assert len(revisions) == 1


def test_failure_on_a_fresh_database_creates_no_catalogue_data(
    database: sessionmaker[Session],
) -> None:
    client = FakeTmdbClient(
        failure=TmdbAuthenticationError("TMDb authentication failed")
    )

    with database() as session, pytest.raises(TmdbAuthenticationError), session.begin():
        import_tmdb_catalogue(session, client=client)

    with database() as session:
        assert get_active_catalogue_revision(session) is None
        assert list(session.scalars(select(CatalogueRevision))) == []
        assert list(session.scalars(select(CatalogMovie))) == []


def test_provider_failure_preserves_tmdb_snapshot_and_existing_account(
    database: sessionmaker[Session],
) -> None:
    with database() as session, session.begin():
        result = import_tmdb_catalogue(session, client=_valid_tmdb_client())
        session.add(
            User(
                id="account-that-must-survive",
                email_normalized="survives@example.com",
                password_hash="not-a-real-password",
            )
        )

    with database() as session:
        before = get_movie_by_source_id(session, source="tmdb", source_id="101")
        assert before is not None
        before_movie_id = before.id

    failed_client = FakeTmdbClient(
        failure=TmdbAuthenticationError("TMDb authentication failed")
    )
    with (
        database() as session,
        pytest.raises(TmdbAuthenticationError),
        session.begin(),
    ):
        import_tmdb_catalogue(session, client=failed_client)

    with database() as session:
        active = get_active_catalogue_revision(session)
        retained_movie = get_movie_by_source_id(
            session, source="tmdb", source_id="101"
        )
        retained_account = session.get(User, "account-that-must-survive")

        assert active is not None
        assert active.id == result.active_revision_id
        assert retained_movie is not None
        assert retained_movie.id == before_movie_id
        assert retained_account is not None
        assert retained_account.email_normalized == "survives@example.com"


def test_empty_usable_snapshot_keeps_previous_active_catalogue(
    database: sessionmaker[Session],
) -> None:
    previous_revision_id, _ = _seed_active_catalogue(database)
    client = FakeTmdbClient(
        genres=[{"id": 28, "name": "Action"}],
        popular_pages={1: [{"id": 101, "title": "", "genre_ids": [28]}]},
    )

    with (
        database() as session,
        pytest.raises(TmdbPayloadError, match="(?i)usable movies"),
        session.begin(),
    ):
        import_tmdb_catalogue(session, client=client)

    with database() as session:
        active_revision = get_active_catalogue_revision(session)
        assert active_revision is not None
        assert active_revision.id == previous_revision_id


def test_successful_import_records_counts_and_maps_provider_fields(
    database: sessionmaker[Session],
) -> None:
    client = _valid_tmdb_client()
    fetched_at = datetime(2026, 10, 1, 9, 30, tzinfo=UTC)

    with database() as session, session.begin():
        result = import_tmdb_catalogue(
            session,
            client=client,
            fetched_at=fetched_at,
        )
        revision = session.get(CatalogueRevision, result.active_revision_id)
        assert revision is not None
        assert revision.provider == "tmdb"
        assert revision.inserted_movie_count == 2
        assert revision.updated_movie_count == 0
        assert revision.rejected_movie_count == 2
        assert result.movie_count == 2
        assert result.associated_genre_count == 2
        assert result.finite_popularity_movie_count == 1
        assert result.source_fetched_at == fetched_at
        assert result.imported_at.tzinfo is not None
        assert result.sample_source_ids == ("101", "202")

    with database() as session:
        active_revision = get_active_catalogue_revision(session)
        first_movie = get_movie_by_source_id(
            session, source="tmdb", source_id="101"
        )
        incomplete_movie = get_movie_by_source_id(
            session, source="tmdb", source_id="202"
        )
        assert active_revision is not None
        assert active_revision.id == result.active_revision_id
        assert first_movie is not None
        assert first_movie.title == "First TMDb movie"
        assert first_movie.release_year == 2025
        assert first_movie.overview == "A real provider overview."
        assert first_movie.popularity_score == 81.5
        assert first_movie.vote_average == 7.4
        assert first_movie.vote_count == 120
        # SQLite returns this timezone-aware SQLAlchemy field without its UTC
        # offset, so attach UTC before comparing the persisted instant.
        assert first_movie.source_fetched_at.replace(tzinfo=UTC) == fetched_at
        assert [genre.id for genre in first_movie.genres] == [28]
        assert incomplete_movie is not None
        assert incomplete_movie.release_year is None
        assert incomplete_movie.overview is None
        assert incomplete_movie.popularity_score is None
        assert incomplete_movie.vote_average is None
        assert incomplete_movie.vote_count is None
        assert [genre.id for genre in incomplete_movie.genres] == [18]

    assert client.calls == ["genres", "popular:1", "details:202"]


def test_reimport_updates_existing_tmdb_movies_without_changing_internal_ids(
    database: sessionmaker[Session],
) -> None:
    first_client = _valid_tmdb_client()
    with database() as session, session.begin():
        first_result = import_tmdb_catalogue(session, client=first_client)

    with database() as session:
        first_movie = get_movie_by_source_id(session, source="tmdb", source_id="101")
        assert first_movie is not None
        first_internal_id = first_movie.id

    second_client = _valid_tmdb_client(title="Updated TMDb movie")
    with database() as session, session.begin():
        second_result = import_tmdb_catalogue(session, client=second_client)
        assert second_result.active_revision_id != first_result.active_revision_id
        assert second_result.inserted_movie_count == 0
        assert second_result.updated_movie_count == 2
        assert second_result.rejected_movie_count == 2

    with database() as session:
        updated_movie = get_movie_by_source_id(
            session, source="tmdb", source_id="101"
        )
        active_revision = get_active_catalogue_revision(session)
        assert updated_movie is not None
        assert updated_movie.id == first_internal_id
        assert updated_movie.title == "Updated TMDb movie"
        assert active_revision is not None
        assert active_revision.id == second_result.active_revision_id


def test_database_failure_rolls_back_candidate_and_preserves_existing_tmdb_data(
    database: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    with database() as session, session.begin():
        first_result = import_tmdb_catalogue(session, client=_valid_tmdb_client())
        session.add(
            User(
                id="account-unchanged-after-db-failure",
                email_normalized="db-failure@example.com",
                password_hash="not-a-real-password",
            )
        )

    def fail_catalogue_write(*_args: object, **_kwargs: object) -> None:
        raise SQLAlchemyError("simulated write failure")

    monkeypatch.setattr(
        tmdb_import_module,
        "upsert_catalogue_movie",
        fail_catalogue_write,
    )

    with (
        database() as session,
        pytest.raises(SQLAlchemyError),
        session.begin(),
    ):
        import_tmdb_catalogue(session, client=_valid_tmdb_client("Changed title"))

    with database() as session:
        active = get_active_catalogue_revision(session)
        retained_movie = get_movie_by_source_id(
            session, source="tmdb", source_id="101"
        )
        retained_account = session.get(User, "account-unchanged-after-db-failure")
        revisions = list(session.scalars(select(CatalogueRevision)))

        assert active is not None
        assert active.id == first_result.active_revision_id
        assert [revision.id for revision in revisions] == [first_result.active_revision_id]
        assert retained_movie is not None
        assert retained_movie.title == "First TMDb movie"
        assert retained_account is not None


def test_public_movie_routes_do_not_trigger_network_or_import(
    database: sessionmaker[Session], monkeypatch: pytest.MonkeyPatch
) -> None:
    _, movie_id = _seed_active_catalogue(database)

    def fail_network(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("normal movie requests must not call TMDb")

    monkeypatch.setattr(TmdbClient, "_get_json", fail_network)
    with database() as database_session:
        def override_get_db() -> Iterator[Session]:
            yield database_session

        app.dependency_overrides[get_db] = override_get_db
        try:
            http = TestClient(app)
            list_response = http.get("/api/movies")
            popular_response = http.get("/api/movies/popular")
            detail_response = http.get(f"/api/movies/{movie_id}")
        finally:
            app.dependency_overrides.clear()

    assert list_response.status_code == 200
    assert popular_response.status_code == 200
    assert detail_response.status_code == 200


def _seed_active_catalogue(database: sessionmaker[Session]) -> tuple[str, str]:
    with database() as session, session.begin():
        revision = create_catalogue_revision(session, provider="local-test")
        upsert_genre(session, genre_id=28, name="Action")
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=revision.id,
            source="local-test",
            source_id="old-movie",
            title="Previously active movie",
            popularity_score=1.0,
        )
        replace_movie_genres(session, movie=movie, genre_ids=[28])
        activate_catalogue_revision(session, revision_id=revision.id)
        return revision.id, movie.id


def _valid_tmdb_client(title: str = "First TMDb movie") -> FakeTmdbClient:
    return FakeTmdbClient(
        genres=[
            {"id": 28, "name": "Action"},
            {"id": 18, "name": "Drama"},
        ],
        popular_pages={
            1: [
                {
                    "id": 101,
                    "title": title,
                    "genre_ids": [28],
                    "release_date": "2025-03-04",
                    "overview": "A real provider overview.",
                    "popularity": 81.5,
                    "vote_average": 7.4,
                    "vote_count": 120,
                },
                {
                    "id": 202,
                    "title": "Details fallback movie",
                    "release_date": "not-a-date",
                    "overview": "",
                    "popularity": float("nan"),
                    "vote_average": float("inf"),
                    "vote_count": -1,
                },
                {"id": 303, "title": "", "genre_ids": [28]},
                {
                    "id": 101,
                    "title": "Duplicate provider record",
                    "genre_ids": [28],
                },
            ]
        },
        details={202: {"genres": [{"id": 18, "name": "Drama"}]}},
    )
