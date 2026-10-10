"""S3-T01/T02: account-owned preference reads and atomic replacement."""

from __future__ import annotations

import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from app.db.database import Base
from app.db.models import AuthSession, UserGenrePreference
from app.integrations.tmdb import TmdbClient
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}
ACTION = {"id": 28, "name": "Action"}
COMEDY = {"id": 35, "name": "Comedy"}
DRAMA = {"id": 18, "name": "Drama"}


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


def _activate_catalogue(session: Session) -> None:
    """Activate a catalogue where Drama exists but only an inactive movie uses it."""

    for genre in (ACTION, COMEDY, DRAMA):
        upsert_genre(session, genre_id=genre["id"], name=genre["name"])

    old = create_catalogue_revision(session, provider="seed")
    retired = upsert_catalogue_movie(
        session,
        catalogue_revision_id=old.id,
        source="seed",
        source_id="retired",
        title="Retired",
    )
    replace_movie_genres(session, movie=retired, genre_ids=[DRAMA["id"]])

    active = create_catalogue_revision(session, provider="seed")
    for source_id, title, genre_ids in (
        ("one", "Alpha", [COMEDY["id"], ACTION["id"]]),
        ("two", "Beta", [ACTION["id"]]),
    ):
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=active.id,
            source="seed",
            source_id=source_id,
            title=title,
            popularity_score=1.0,
        )
        replace_movie_genres(session, movie=movie, genre_ids=genre_ids)
    activate_catalogue_revision(session, revision_id=active.id)
    session.commit()


def _sign_in(email: str) -> tuple[TestClient, str]:
    http = TestClient(app)
    registered = http.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert registered.status_code == 201
    login = http.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200
    return http, login.json()["data"]["user"]["id"]


def _save(session: Session, user_id: str, *genre_ids: int) -> None:
    session.add_all(
        UserGenrePreference(user_id=user_id, genre_id=genre_id)
        for genre_id in genre_ids
    )
    session.commit()


@pytest.mark.parametrize("path", ["/api/genres", "/api/me/preferences"])
def test_visitor_without_a_session_is_rejected(
    database_session: Session, path: str
) -> None:
    _activate_catalogue(database_session)

    response = TestClient(app).get(path)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["error"]["message"] == "Authentication required"


@pytest.mark.parametrize("path", ["/api/genres", "/api/me/preferences"])
def test_revoked_session_is_rejected_before_any_read(
    database_session: Session, path: str
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("revoked@example.com")
    stale_cookie = dict(http.cookies)
    assert http.post("/api/auth/logout", headers=HEADERS).status_code == 204

    replay = TestClient(app, cookies=stale_cookie)

    assert replay.get(path).status_code == 401


def test_genres_lists_only_genres_used_by_the_active_catalogue(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("genres@example.com")

    response = http.get("/api/genres")

    assert response.status_code == 200
    # Sorted by name; Drama is excluded because only an inactive movie uses it.
    assert response.json() == {"data": {"genres": [ACTION, COMEDY]}}


def test_genres_without_an_active_catalogue_is_unavailable(
    database_session: Session,
) -> None:
    http, _ = _sign_in("nocatalogue@example.com")

    response = http.get("/api/genres")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"


def test_new_account_gets_an_empty_list_and_no_guest_identity(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("fresh@example.com")

    response = http.get("/api/me/preferences")

    assert response.status_code == 200
    assert response.json() == {"data": {"genres": []}}
    assert (
        database_session.scalar(select(func.count()).select_from(UserGenrePreference))
        == 0
    )


def test_known_account_reads_only_its_own_saved_genres(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    first, first_id = _sign_in("first@example.com")
    second, second_id = _sign_in("second@example.com")
    _save(database_session, first_id, COMEDY["id"], ACTION["id"])
    _save(database_session, second_id, DRAMA["id"])

    assert first.get("/api/me/preferences").json() == {
        "data": {"genres": [ACTION, COMEDY]}
    }
    assert second.get("/api/me/preferences").json() == {"data": {"genres": [DRAMA]}}


def test_client_supplied_identity_never_selects_the_account(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    viewer, viewer_id = _sign_in("viewer@example.com")
    _, other_id = _sign_in("other@example.com")
    _save(database_session, other_id, ACTION["id"])

    response = viewer.get(
        "/api/me/preferences",
        params={"userId": other_id, "user_id": other_id},
        headers={"X-User-Id": other_id},
    )

    assert viewer_id != other_id
    assert response.status_code == 200
    assert response.json() == {"data": {"genres": []}}
    assert set(response.json()["data"]) == {"genres"}


@pytest.fixture
def preference_viewer(database_session: Session) -> tuple[TestClient, str]:
    _activate_catalogue(database_session)
    for genre_id, name in ((12, "Fantasy"), (27, "Horror")):
        upsert_genre(database_session, genre_id=genre_id, name=name)
    database_session.commit()
    http, user_id = _sign_in("replace@example.com")
    _save(database_session, user_id, ACTION["id"], COMEDY["id"])
    return http, user_id


def _fresh_preference_ids(session: Session, user_id: str) -> list[int]:
    """Observe committed rows without using the request Session's identity map."""
    with Session(session.get_bind()) as fresh:
        return list(
            fresh.scalars(
                select(UserGenrePreference.genre_id)
                .where(UserGenrePreference.user_id == user_id)
                .order_by(UserGenrePreference.genre_id)
            )
        )


def _assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message", "requestId"}
    assert body["error"]["code"] == code
    assert body["error"]["message"] == message
    assert re.fullmatch(r"req_[0-9a-f]{32}", body["error"]["requestId"])


@pytest.mark.parametrize("genre_ids", [[28], [27, 35, 12, 28, 18]])
def test_put_accepts_one_and_five_and_returns_committed_sorted_genres(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    genre_ids: list[int],
) -> None:
    http, user_id = preference_viewer
    response = http.put(
        "/api/me/preferences", json={"genreIds": genre_ids}, headers=HEADERS
    )

    assert response.status_code == 200
    expected_genres = sorted(
        [
            genre
            for genre in (
                ACTION,
                COMEDY,
                DRAMA,
                {"id": 12, "name": "Fantasy"},
                {"id": 27, "name": "Horror"},
            )
            if genre["id"] in genre_ids
        ],
        key=lambda genre: (genre["name"], genre["id"]),
    )
    assert response.json() == {"data": {"genres": expected_genres}}
    assert _fresh_preference_ids(database_session, user_id) == sorted(genre_ids)
    assert http.get("/api/me/preferences").json() == response.json()


@pytest.mark.parametrize(
    "payload",
    [
        {"genreIds": []},
        {"genreIds": [28, 35, 18, 12, 27, 99]},
        {"genreIds": [28, 28]},
        {"genreIds": ["28"]},
        {"genreIds": [28.0]},
        {"genreIds": [True]},
        {"genreIds": [None]},
        {"genreIds": [28, "35"]},
        {"genreIds": None},
        {"genreIds": 28},
        {"genreIds": "28"},
        {"genreIds": {"id": 28}},
        {},
        [28],
        {"genreIds": [28], "userId": "other-account"},
        {"genreIds": [28], "unexpected": True},
    ],
)
def test_invalid_put_body_preserves_the_previous_selection(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    payload,
) -> None:
    http, user_id = preference_viewer
    response = http.put("/api/me/preferences", json=payload, headers=HEADERS)

    _assert_error(
        response, 400, "VALIDATION_ERROR", "Please correct the highlighted fields"
    )
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]


@pytest.mark.parametrize("content", [None, '{"genreIds":', "null"])
def test_missing_or_malformed_put_body_preserves_the_previous_selection(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    content: str | None,
) -> None:
    http, user_id = preference_viewer
    response = http.put(
        "/api/me/preferences",
        content=content,
        headers=HEADERS | {"Content-Type": "application/json"},
    )

    _assert_error(
        response, 400, "VALIDATION_ERROR", "Please correct the highlighted fields"
    )
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]


@pytest.mark.parametrize(
    "genre_ids", [[999], [28, 999], [0], [-1], [2**63], [-(2**63) - 1]]
)
def test_unknown_canonical_genre_is_rejected_before_deleting_preferences(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    genre_ids: list[int],
) -> None:
    http, user_id = preference_viewer
    response = http.put(
        "/api/me/preferences", json={"genreIds": genre_ids}, headers=HEADERS
    )

    _assert_error(response, 404, "GENRE_NOT_FOUND", "Genre not found")
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]


def test_put_replaces_instead_of_appending_and_repeated_save_has_no_duplicates(
    database_session: Session, preference_viewer: tuple[TestClient, str]
) -> None:
    http, user_id = preference_viewer
    for _ in range(2):
        response = http.put(
            "/api/me/preferences", json={"genreIds": [18]}, headers=HEADERS
        )
        assert response.status_code == 200
        assert response.json() == {"data": {"genres": [DRAMA]}}
        assert _fresh_preference_ids(database_session, user_id) == [18]


def test_put_only_changes_the_session_account_despite_forged_query_and_header(
    database_session: Session, preference_viewer: tuple[TestClient, str]
) -> None:
    viewer, viewer_id = preference_viewer
    other, other_id = _sign_in("other-writer@example.com")
    _save(database_session, other_id, COMEDY["id"])

    response = viewer.put(
        "/api/me/preferences",
        json={"genreIds": [18]},
        params={"userId": other_id, "user_id": other_id},
        headers=HEADERS | {"X-User-Id": other_id},
    )

    assert response.status_code == 200
    assert _fresh_preference_ids(database_session, viewer_id) == [18]
    assert _fresh_preference_ids(database_session, other_id) == [35]
    assert other.get("/api/me/preferences").json() == {"data": {"genres": [COMEDY]}}


@pytest.mark.parametrize("session_state", ["missing", "invalid", "expired", "revoked"])
def test_put_requires_a_valid_session_and_never_changes_preferences(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    session_state: str,
) -> None:
    http, user_id = preference_viewer
    if session_state in {"missing", "invalid"}:
        http.cookies.clear()
        if session_state == "invalid":
            http.cookies.set("ams_session", "invalid-session")
    else:
        stored = database_session.scalar(
            select(AuthSession).where(AuthSession.user_id == user_id)
        )
        assert stored is not None
        if session_state == "expired":
            stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        else:
            stored.revoked_at = datetime.now(UTC)
        database_session.commit()

    response = http.put("/api/me/preferences", json={"genreIds": [18]}, headers=HEADERS)

    _assert_error(response, 401, "AUTHENTICATION_REQUIRED", "Authentication required")
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": "https://other.example"},
        {"Origin": "null"},
        {"Sec-Fetch-Site": "cross-site"},
        {"Sec-Fetch-Site": "same-site", "Origin": "http://testserver"},
    ],
)
def test_cross_origin_put_is_rejected_before_writes(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    headers: dict[str, str],
) -> None:
    http, user_id = preference_viewer
    response = http.put("/api/me/preferences", json={"genreIds": [18]}, headers=headers)

    _assert_error(response, 403, "ORIGIN_NOT_ALLOWED", "Request origin is not allowed")
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]


def test_same_origin_fetch_metadata_accepts_the_vite_proxy(
    preference_viewer: tuple[TestClient, str],
) -> None:
    http, _ = preference_viewer
    response = http.put(
        "/api/me/preferences",
        json={"genreIds": [18]},
        headers={"Sec-Fetch-Site": "same-origin", "Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200


@pytest.mark.parametrize("failure_stage", ["insert", "commit"])
def test_failed_replacement_rolls_back_deletion_and_preserves_both_accounts(
    database_session: Session,
    preference_viewer: tuple[TestClient, str],
    monkeypatch: pytest.MonkeyPatch,
    failure_stage: str,
) -> None:
    http, user_id = preference_viewer
    _, other_id = _sign_in("rollback-other@example.com")
    _save(database_session, other_id, DRAMA["id"])
    write_stages = []

    def inspect_write(_connection, _cursor, statement, _parameters, _context, _many):
        if statement.startswith("DELETE FROM user_genre_preferences"):
            write_stages.append("delete")
        if statement.startswith("INSERT INTO user_genre_preferences"):
            write_stages.append("insert")
            if failure_stage == "insert":
                raise OperationalError(statement, {}, Exception("private-db-detail"))

    def fail_commit():
        write_stages.append("commit")
        raise OperationalError("COMMIT", {}, Exception("private-db-detail"))

    engine = database_session.get_bind()
    event.listen(engine, "before_cursor_execute", inspect_write)
    if failure_stage == "commit":
        monkeypatch.setattr(database_session, "commit", fail_commit)
    try:
        response = http.put(
            "/api/me/preferences", json={"genreIds": [18]}, headers=HEADERS
        )
    finally:
        event.remove(engine, "before_cursor_execute", inspect_write)

    _assert_error(
        response, 503, "SERVICE_UNAVAILABLE", "Service is temporarily unavailable"
    )
    assert "private-db-detail" not in response.text
    assert write_stages == (
        ["delete", "insert"]
        if failure_stage == "insert"
        else ["delete", "insert", "commit"]
    )
    assert _fresh_preference_ids(database_session, user_id) == [28, 35]
    assert _fresh_preference_ids(database_session, other_id) == [18]
    assert http.get("/api/me/preferences").json() == {
        "data": {"genres": [ACTION, COMEDY]}
    }


def test_put_and_get_use_only_local_canonical_genres_without_provider_access(
    preference_viewer: tuple[TestClient, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    def forbid_provider(*_args, **_kwargs):
        raise AssertionError("Preference requests must never call TMDb")

    monkeypatch.setattr(TmdbClient, "_get_json", forbid_provider)
    http, _ = preference_viewer
    response = http.put("/api/me/preferences", json={"genreIds": [18]}, headers=HEADERS)
    assert response.status_code == 200
    assert http.get("/api/me/preferences").json() == {"data": {"genres": [DRAMA]}}
