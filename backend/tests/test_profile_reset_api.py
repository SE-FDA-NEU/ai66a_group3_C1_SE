"""S3-T35: authenticated, atomic personalisation profile reset."""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.db.database import Base
from app.db.models import (
    AuthSession,
    CatalogMovie,
    CatalogueRevision,
    CatalogueState,
    Genre,
    MovieGenre,
    User,
    UserGenrePreference,
    UserMovieRating,
)
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from app.repositories.preferences import replace_user_preference_genres
from app.repositories.ratings import set_user_movie_rating
from fastapi.testclient import TestClient
from sqlalchemy import Engine, create_engine, event, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}
RESET_PATH = "/api/me/profile/reset"


@pytest.fixture
def database_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()

    def override_get_db() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _sign_in(email: str) -> tuple[TestClient, str]:
    http = TestClient(app)
    registered = http.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD},
    )
    assert registered.status_code == 201
    login = http.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200
    return http, login.json()["data"]["user"]["id"]


@pytest.fixture
def profile_state(
    database_session: Session,
) -> Iterator[dict[str, object]]:
    action = upsert_genre(database_session, genre_id=28, name="Action")
    comedy = upsert_genre(database_session, genre_id=35, name="Comedy")
    revision = create_catalogue_revision(database_session, provider="test")
    action_movie = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="test",
        source_id="action",
        title="Action Movie",
        popularity_score=10.0,
    )
    comedy_movie = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="test",
        source_id="comedy",
        title="Comedy Movie",
        popularity_score=5.0,
    )
    replace_movie_genres(
        database_session,
        movie=action_movie,
        genre_ids=[action.id],
    )
    replace_movie_genres(
        database_session,
        movie=comedy_movie,
        genre_ids=[comedy.id],
    )
    activate_catalogue_revision(database_session, revision_id=revision.id)
    database_session.commit()

    account_a, user_a = _sign_in("account-a@example.com")
    account_b, user_b = _sign_in("account-b@example.com")

    replace_user_preference_genres(
        database_session,
        user_id=user_a,
        genre_ids=[action.id],
    )
    replace_user_preference_genres(
        database_session,
        user_id=user_b,
        genre_ids=[comedy.id],
    )
    set_user_movie_rating(
        database_session,
        user_id=user_a,
        movie_id=action_movie.id,
        rating=5,
    )
    set_user_movie_rating(
        database_session,
        user_id=user_b,
        movie_id=comedy_movie.id,
        rating=2,
    )
    database_session.commit()

    try:
        yield {
            "account_a": account_a,
            "account_b": account_b,
            "user_a": user_a,
            "user_b": user_b,
            "action_movie": action_movie.id,
            "comedy_movie": comedy_movie.id,
        }
    finally:
        account_a.close()
        account_b.close()


def _personalisation_rows(
    session: Session,
    user_id: str,
) -> tuple[list[int], list[tuple[str, int]]]:
    with Session(session.get_bind()) as fresh:
        preferences = list(
            fresh.scalars(
                select(UserGenrePreference.genre_id)
                .where(UserGenrePreference.user_id == user_id)
                .order_by(UserGenrePreference.genre_id)
            )
        )
        ratings = list(
            fresh.execute(
                select(UserMovieRating.movie_id, UserMovieRating.rating)
                .where(UserMovieRating.user_id == user_id)
                .order_by(UserMovieRating.movie_id)
            )
        )
    return preferences, [(row.movie_id, row.rating) for row in ratings]


def _preserved_counts(session: Session) -> dict[str, int]:
    models = (
        User,
        AuthSession,
        CatalogueRevision,
        CatalogueState,
        CatalogMovie,
        Genre,
        MovieGenre,
    )
    with Session(session.get_bind()) as fresh:
        return {
            model.__tablename__: fresh.scalar(select(func.count()).select_from(model))
            for model in models
        }


def _assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "requestId"}
    assert body["error"]["code"] == code
    assert body["error"]["message"] == message
    assert re.fullmatch(r"req_[0-9a-f]{32}", body["error"]["requestId"])


def _lose_session(
    http: TestClient,
    session: Session,
    user_id: str,
    state: str,
) -> None:
    if state in {"missing", "invalid"}:
        http.cookies.clear()
        if state == "invalid":
            http.cookies.set("ams_session", "invalid-session")
        return

    stored = session.scalar(select(AuthSession).where(AuthSession.user_id == user_id))
    assert stored is not None
    if state == "expired":
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    else:
        stored.revoked_at = datetime.now(UTC)
    session.commit()


def test_confirmed_reset_is_account_scoped_and_preserves_shared_state(
    database_session: Session,
    profile_state: dict[str, object],
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    user_b = profile_state["user_b"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    assert isinstance(user_b, str)
    preserved_before = _preserved_counts(database_session)

    response = http.post(
        RESET_PATH,
        json={"confirm": True},
        params={"userId": user_b, "user_id": user_b},
        headers={**HEADERS, "X-User-Id": user_b},
    )

    assert response.status_code == 200
    assert response.json() == {"data": {"reset": True}}
    assert _personalisation_rows(database_session, user_a) == ([], [])
    assert _personalisation_rows(database_session, user_b) == (
        [35],
        [(profile_state["comedy_movie"], 2)],
    )
    assert _preserved_counts(database_session) == preserved_before
    assert http.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"confirm": False},
        {"confirm": 0},
        {"confirm": 1},
        {"confirm": "true"},
        {"confirm": None},
        {"confirm": []},
        {"confirm": True, "userId": "another-account"},
        {"confirm": True, "user_id": "another-account"},
        {"confirm": True, "email": "other@example.com"},
        [],
        True,
        None,
    ],
)
def test_invalid_confirmation_causes_no_mutation(
    database_session: Session,
    profile_state: dict[str, object],
    body: object,
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    user_b = profile_state["user_b"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    assert isinstance(user_b, str)
    before = (
        _personalisation_rows(database_session, user_a),
        _personalisation_rows(database_session, user_b),
    )

    response = http.post(RESET_PATH, json=body, headers=HEADERS)

    _assert_error(
        response,
        400,
        "VALIDATION_ERROR",
        "Please correct the highlighted fields",
    )
    assert (
        _personalisation_rows(database_session, user_a),
        _personalisation_rows(database_session, user_b),
    ) == before


@pytest.mark.parametrize("content", [b"{", b"", b"not json"])
def test_malformed_confirmation_causes_no_mutation(
    database_session: Session,
    profile_state: dict[str, object],
    content: bytes,
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    before = _personalisation_rows(database_session, user_a)

    response = http.post(
        RESET_PATH,
        content=content,
        headers={**HEADERS, "Content-Type": "application/json"},
    )

    _assert_error(
        response,
        400,
        "VALIDATION_ERROR",
        "Please correct the highlighted fields",
    )
    assert _personalisation_rows(database_session, user_a) == before


@pytest.mark.parametrize("state", ["missing", "invalid", "expired", "revoked"])
def test_invalid_session_cannot_reset_personalisation(
    database_session: Session,
    profile_state: dict[str, object],
    state: str,
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    before = _personalisation_rows(database_session, user_a)
    _lose_session(http, database_session, user_a, state)

    response = http.post(
        RESET_PATH,
        json={"confirm": True},
        headers=HEADERS,
    )

    _assert_error(
        response,
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication required",
    )
    assert _personalisation_rows(database_session, user_a) == before


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://attacker.example"},
        {"Origin": "null"},
        {"Sec-Fetch-Site": "cross-site"},
        {
            "Sec-Fetch-Site": "same-site",
            "Origin": "http://testserver",
        },
    ],
)
def test_forbidden_origin_causes_no_mutation(
    database_session: Session,
    profile_state: dict[str, object],
    headers: dict[str, str],
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    before = _personalisation_rows(database_session, user_a)

    response = http.post(
        RESET_PATH,
        json={"confirm": True},
        headers=headers,
    )

    _assert_error(
        response,
        403,
        "ORIGIN_NOT_ALLOWED",
        "Request origin is not allowed",
    )
    assert _personalisation_rows(database_session, user_a) == before


def test_failure_between_deletes_rolls_back_both_sets(
    database_session: Session,
    profile_state: dict[str, object],
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    before = _personalisation_rows(database_session, user_a)
    engine = database_session.get_bind()
    assert isinstance(engine, Engine)

    def fail_second_delete(
        _connection,
        _cursor,
        statement,
        _parameters,
        _context,
        _many,
    ) -> None:
        if statement.startswith("DELETE FROM user_movie_ratings"):
            raise OperationalError(
                statement,
                {},
                Exception("private-db-detail"),
            )

    event.listen(engine, "before_cursor_execute", fail_second_delete)
    try:
        response = http.post(
            RESET_PATH,
            json={"confirm": True},
            headers=HEADERS,
        )
    finally:
        event.remove(engine, "before_cursor_execute", fail_second_delete)

    _assert_error(
        response,
        503,
        "SERVICE_UNAVAILABLE",
        "Service is temporarily unavailable",
    )
    assert "private-db-detail" not in response.text
    assert _personalisation_rows(database_session, user_a) == before


def test_commit_failure_rolls_back_and_never_claims_success(
    database_session: Session,
    profile_state: dict[str, object],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http = profile_state["account_a"]
    user_a = profile_state["user_a"]
    assert isinstance(http, TestClient)
    assert isinstance(user_a, str)
    before = _personalisation_rows(database_session, user_a)

    def fail_commit() -> None:
        raise OperationalError(
            "COMMIT",
            {},
            Exception("private-db-detail"),
        )

    monkeypatch.setattr(database_session, "commit", fail_commit)

    response = http.post(
        RESET_PATH,
        json={"confirm": True},
        headers=HEADERS,
    )

    _assert_error(
        response,
        503,
        "SERVICE_UNAVAILABLE",
        "Service is temporarily unavailable",
    )
    assert "private-db-detail" not in response.text
    assert _personalisation_rows(database_session, user_a) == before


def test_recommendations_use_cold_start_state_after_reset(
    profile_state: dict[str, object],
) -> None:
    http = profile_state["account_a"]
    assert isinstance(http, TestClient)
    before = http.get("/api/me/recommendations")
    assert before.status_code == 200
    assert before.json()["data"]["mode"] == "personalised"
    assert before.json()["data"]["personalised"] is True

    reset = http.post(
        RESET_PATH,
        json={"confirm": True},
        headers=HEADERS,
    )
    after = http.get("/api/me/recommendations")

    assert reset.status_code == 200
    assert after.status_code == 200
    assert after.json()["data"]["mode"] == "popular"
    assert after.json()["data"]["personalised"] is False
    assert after.json()["data"]["noMatch"] is False
