"""S3-T31: protected, atomic rating reads and writes."""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.db.database import Base
from app.db.models import AuthSession, UserMovieRating
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    upsert_catalogue_movie,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}
UNKNOWN_MOVIE_ID = "00000000-0000-0000-0000-000000000000"


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


@pytest.fixture
def movie_ids(database_session: Session) -> dict[str, str]:
    """Two movies in the active revision and one in a retired revision."""

    retired = create_catalogue_revision(database_session, provider="seed")
    old = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=retired.id,
        source="seed",
        source_id="retired",
        title="Retired",
    )
    active = create_catalogue_revision(database_session, provider="seed")
    first = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=active.id,
        source="seed",
        source_id="first",
        title="First",
        popularity_score=2.0,
    )
    second = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=active.id,
        source="seed",
        source_id="second",
        title="Second",
        popularity_score=1.0,
    )
    activate_catalogue_revision(database_session, revision_id=active.id)
    database_session.commit()
    return {"first": first.id, "second": second.id, "retired": old.id}


def _sign_in(email: str) -> tuple[TestClient, str]:
    http = TestClient(app)
    assert (
        http.post(
            "/api/auth/register", json={"email": email, "password": PASSWORD}
        ).status_code
        == 201
    )
    login = http.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200
    return http, login.json()["data"]["user"]["id"]


@pytest.fixture
def viewer(
    database_session: Session, movie_ids: dict[str, str]
) -> tuple[TestClient, str]:
    return _sign_in("viewer@example.com")


def _stored(session: Session, user_id: str, movie_id: str) -> list[int]:
    """Observe committed rows without using the request Session's identity map."""

    with Session(session.get_bind()) as fresh:
        return list(
            fresh.scalars(
                select(UserMovieRating.rating).where(
                    UserMovieRating.user_id == user_id,
                    UserMovieRating.movie_id == movie_id,
                )
            )
        )


def _row_count(session: Session) -> int:
    with Session(session.get_bind()) as fresh:
        return fresh.scalar(select(func.count()).select_from(UserMovieRating))


def _assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "requestId"}
    assert body["error"]["code"] == code
    assert body["error"]["message"] == message
    assert re.fullmatch(r"req_[0-9a-f]{32}", body["error"]["requestId"])


def _expire_or_revoke(session: Session, user_id: str, state: str) -> None:
    stored = session.scalar(select(AuthSession).where(AuthSession.user_id == user_id))
    assert stored is not None
    if state == "expired":
        stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    else:
        stored.revoked_at = datetime.now(UTC)
    session.commit()


# --- GET ------------------------------------------------------------------


def test_unrated_movie_returns_an_explicit_null_not_zero(
    viewer: tuple[TestClient, str], movie_ids: dict[str, str]
) -> None:
    http, _ = viewer

    response = http.get(f"/api/me/ratings/{movie_ids['first']}")

    assert response.status_code == 200
    assert response.json() == {
        "data": {"movieId": movie_ids["first"], "rating": None}
    }


def test_get_returns_only_the_current_accounts_rating(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
) -> None:
    http, _ = viewer
    other, _ = _sign_in("other@example.com")
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert other.put(path, json={"rating": 5}, headers=HEADERS).status_code == 200
    assert http.put(path, json={"rating": 2}, headers=HEADERS).status_code == 200

    assert http.get(path).json()["data"]["rating"] == 2
    assert other.get(path).json()["data"]["rating"] == 5
    # A rating on one movie never shows up on another movie.
    assert (
        http.get(f"/api/me/ratings/{movie_ids['second']}").json()["data"]["rating"]
        is None
    )


@pytest.mark.parametrize("state", ["missing", "invalid", "expired", "revoked"])
@pytest.mark.parametrize("method", ["get", "put"])
def test_missing_expired_or_revoked_session_gets_401_and_nothing_changes(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    method: str,
    state: str,
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert http.put(path, json={"rating": 3}, headers=HEADERS).status_code == 200
    if state in {"missing", "invalid"}:
        http.cookies.clear()
        if state == "invalid":
            http.cookies.set("ams_session", "invalid-session")
    else:
        _expire_or_revoke(database_session, user_id, state)

    response = (
        http.get(path)
        if method == "get"
        else http.put(path, json={"rating": 5}, headers=HEADERS)
    )

    _assert_error(response, 401, "AUTHENTICATION_REQUIRED", "Authentication required")
    assert _stored(database_session, user_id, movie_ids["first"]) == [3]


def test_unauthenticated_invalid_payload_is_401_not_400(
    movie_ids: dict[str, str],
) -> None:
    response = TestClient(app).put(
        f"/api/me/ratings/{movie_ids['first']}",
        json={"rating": 99},
        headers=HEADERS,
    )

    _assert_error(response, 401, "AUTHENTICATION_REQUIRED", "Authentication required")


@pytest.mark.parametrize("method", ["get", "put"])
@pytest.mark.parametrize("movie", [UNKNOWN_MOVIE_ID, "retired"])
def test_unknown_or_inactive_movie_is_404_and_creates_no_rating(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    method: str,
    movie: str,
) -> None:
    http, _ = viewer
    path = f"/api/me/ratings/{movie_ids.get(movie, movie)}"

    response = (
        http.get(path)
        if method == "get"
        else http.put(path, json={"rating": 4}, headers=HEADERS)
    )

    _assert_error(response, 404, "MOVIE_NOT_FOUND", "Movie not found")
    assert _row_count(database_session) == 0


# --- PUT ------------------------------------------------------------------


@pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
def test_put_returns_the_committed_rating_for_every_valid_value(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    rating: int,
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"

    response = http.put(path, json={"rating": rating}, headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {
        "data": {"movieId": movie_ids["first"], "rating": rating}
    }
    assert _stored(database_session, user_id, movie_ids["first"]) == [rating]
    assert http.get(path).json()["data"]["rating"] == rating


def test_repeated_saves_update_one_row(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"

    for rating in (1, 5, 5, 3):
        assert (
            http.put(path, json={"rating": rating}, headers=HEADERS).status_code == 200
        )

    assert _stored(database_session, user_id, movie_ids["first"]) == [3]
    assert _row_count(database_session) == 1


@pytest.mark.parametrize(
    "body",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": -1},
        {"rating": 3.5},
        {"rating": 4.0},
        {"rating": "5"},
        {"rating": True},
        {"rating": False},
        {"rating": None},
        {"rating": [5]},
        {},
        {"rating": 5, "userId": "someone-else"},
        {"rating": 5, "user_id": "someone-else"},
        {"rating": 5, "email": "other@example.com"},
        [5],
        "5",
        5,
        None,
    ],
)
def test_invalid_payload_is_rejected_and_preserves_the_previous_rating(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    body,
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert http.put(path, json={"rating": 4}, headers=HEADERS).status_code == 200

    response = http.put(path, json=body, headers=HEADERS)

    _assert_error(
        response, 400, "VALIDATION_ERROR", "Please correct the highlighted fields"
    )
    assert _stored(database_session, user_id, movie_ids["first"]) == [4]


@pytest.mark.parametrize("content", [b"{", b"", b"not json", b'{"rating": 5'])
def test_malformed_json_is_rejected_and_preserves_the_previous_rating(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    content: bytes,
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert http.put(path, json={"rating": 2}, headers=HEADERS).status_code == 200

    response = http.put(
        path,
        content=content,
        headers={**HEADERS, "Content-Type": "application/json"},
    )

    _assert_error(
        response, 400, "VALIDATION_ERROR", "Please correct the highlighted fields"
    )
    assert _stored(database_session, user_id, movie_ids["first"]) == [2]


def test_forged_identity_never_retargets_another_account(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
) -> None:
    http, user_id = viewer
    other, other_id = _sign_in("victim@example.com")
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert other.put(path, json={"rating": 5}, headers=HEADERS).status_code == 200

    response = http.put(
        path,
        json={"rating": 1},
        params={"userId": other_id, "user_id": other_id},
        headers={**HEADERS, "X-User-Id": other_id},
    )

    assert response.status_code == 200
    assert _stored(database_session, user_id, movie_ids["first"]) == [1]
    assert _stored(database_session, other_id, movie_ids["first"]) == [5]


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://other.example"},
        {"Origin": "null"},
        {"Sec-Fetch-Site": "cross-site"},
        {"Sec-Fetch-Site": "same-site", "Origin": "http://testserver"},
    ],
)
def test_cross_origin_put_is_rejected_before_any_write(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    headers: dict[str, str],
) -> None:
    http, user_id = viewer
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert http.put(path, json={"rating": 4}, headers=HEADERS).status_code == 200

    response = http.put(path, json={"rating": 1}, headers=headers)

    _assert_error(response, 403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed")
    assert _stored(database_session, user_id, movie_ids["first"]) == [4]


def test_same_origin_fetch_metadata_accepts_the_vite_proxy(
    viewer: tuple[TestClient, str], movie_ids: dict[str, str]
) -> None:
    http, _ = viewer

    response = http.put(
        f"/api/me/ratings/{movie_ids['first']}",
        json={"rating": 2},
        headers={"Sec-Fetch-Site": "same-origin", "Origin": "http://localhost:5173"},
    )

    assert response.status_code == 200


@pytest.mark.parametrize("failure_stage", ["write", "commit"])
def test_failed_save_rolls_back_and_preserves_the_previous_rating(
    database_session: Session,
    viewer: tuple[TestClient, str],
    movie_ids: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    failure_stage: str,
) -> None:
    http, user_id = viewer
    other, other_id = _sign_in("bystander@example.com")
    path = f"/api/me/ratings/{movie_ids['first']}"
    assert http.put(path, json={"rating": 4}, headers=HEADERS).status_code == 200
    assert other.put(path, json={"rating": 5}, headers=HEADERS).status_code == 200

    def fail_write(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("UPDATE user_movie_ratings"):
            raise OperationalError(statement, {}, Exception("private-db-detail"))

    def fail_commit():
        raise OperationalError("COMMIT", {}, Exception("private-db-detail"))

    engine = database_session.get_bind()
    if failure_stage == "write":
        event.listen(engine, "before_cursor_execute", fail_write)
    else:
        monkeypatch.setattr(database_session, "commit", fail_commit)
    try:
        response = http.put(path, json={"rating": 1}, headers=HEADERS)
    finally:
        if failure_stage == "write":
            event.remove(engine, "before_cursor_execute", fail_write)

    _assert_error(
        response, 503, "SERVICE_UNAVAILABLE", "Service is temporarily unavailable"
    )
    assert "private-db-detail" not in response.text
    assert _stored(database_session, user_id, movie_ids["first"]) == [4]
    assert _stored(database_session, other_id, movie_ids["first"]) == [5]
    assert http.get(path).json()["data"]["rating"] == 4
