"""S3-T08: account-scoped recommendation endpoint integration checks."""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.database import Base
from app.db.models import (
    AuthSession,
    CatalogMovie,
    CatalogueRevision,
    Genre,
    MovieGenre,
)
from app.integrations.tmdb import TmdbClient
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "recommendations_s3_t06.json"
PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}


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


def _fixture() -> dict[str, Any]:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def _seed_synthetic_catalogue(session: Session) -> dict[str, Any]:
    fixture = _fixture()
    session.add_all(
        Genre(id=genre["id"], name=genre["name"]) for genre in fixture["genres"]
    )
    revision = CatalogueRevision(
        id=fixture["catalogueRevision"],
        provider="synthetic-test",
    )
    session.add(revision)
    session.flush()

    unique_rows = {row["id"]: row for row in fixture["candidateRows"]}
    session.add_all(
        CatalogMovie(
            id=row["id"],
            catalogue_revision_id=revision.id,
            source="synthetic-test",
            source_id=row["id"],
            title=row["title"],
            release_year=row["releaseYear"],
            popularity_score=row["popularityScore"],
        )
        for row in unique_rows.values()
    )
    session.flush()
    session.add_all(
        MovieGenre(movie_id=row["id"], genre_id=genre_id)
        for row in unique_rows.values()
        for genre_id in row["genreIds"]
    )
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    return fixture


def _seed_small_catalogue(session: Session) -> str:
    for genre_id, name in ((1, "Action"), (2, "Comedy"), (3, "Archive")):
        upsert_genre(session, genre_id=genre_id, name=name)

    revision = create_catalogue_revision(session, provider="synthetic-test")
    for source_id, title, popularity, genre_ids in (
        ("action-high", "Action High", 10.0, [1]),
        ("action-zero", "Action Zero", 0.0, [1]),
        ("action-missing", "Action Missing", None, [1]),
        ("comedy", "Comedy", 90.0, [2]),
    ):
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=revision.id,
            source="synthetic-test",
            source_id=source_id,
            title=title,
            popularity_score=popularity,
        )
        replace_movie_genres(session, movie=movie, genre_ids=genre_ids)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    return revision.id


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


def _save_preferences(http: TestClient, genre_ids: list[int]) -> None:
    response = http.put(
        "/api/me/preferences",
        json={"genreIds": genre_ids},
        headers=HEADERS,
    )
    assert response.status_code == 200


def _expanded_expected_response(
    fixture: dict[str, Any], case_name: str
) -> dict[str, Any]:
    case = fixture["cases"][case_name]
    candidates = {row["id"]: row for row in fixture["candidateRows"]}
    genres = {genre["id"]: genre for genre in fixture["genres"]}
    movies = []
    for expected in case["expectedResponse"]["data"]["movies"]:
        candidate = candidates[expected["id"]]
        movies.append(
            {
                "id": candidate["id"],
                "title": candidate["title"],
                "releaseYear": candidate["releaseYear"],
                "genres": [genres[genre_id] for genre_id in candidate["genreIds"]],
                "popularityScore": candidate["popularityScore"],
                "reason": expected["reason"],
            }
        )
    return {
        "data": case["expectedResponse"]["data"] | {"movies": movies},
        "meta": case["expectedResponse"]["meta"],
    }


def _assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert body["error"]["message"] == message
    assert re.fullmatch(r"req_[0-9a-f]{32}", body["error"]["requestId"])


def test_personalised_response_matches_the_reviewed_synthetic_oracle(
    database_session: Session,
) -> None:
    fixture = _seed_synthetic_catalogue(database_session)
    http, _ = _sign_in("personalised@example.com")
    case = fixture["cases"]["personalisedTwoGenreIntersection"]
    _save_preferences(http, case["savedGenreIds"])

    response = http.get("/api/me/recommendations?limit=10")

    assert response.status_code == 200
    assert response.json() == _expanded_expected_response(
        fixture, "personalisedTwoGenreIntersection"
    )
    assert all(
        movie["reason"]["matchedGenres"] for movie in response.json()["data"]["movies"]
    )


@pytest.mark.parametrize(
    ("case_name", "expected_no_match"),
    (("popularColdStart", False), ("popularNoMatch", True)),
)
def test_popular_states_match_the_reviewed_synthetic_oracles(
    database_session: Session,
    case_name: str,
    expected_no_match: bool,
) -> None:
    fixture = _seed_synthetic_catalogue(database_session)
    http, _ = _sign_in(f"{case_name.lower()}@example.com")
    case = fixture["cases"][case_name]
    if case["savedGenreIds"]:
        _save_preferences(http, case["savedGenreIds"])

    response = http.get("/api/me/recommendations?limit=10")

    assert response.status_code == 200
    assert response.json() == _expanded_expected_response(fixture, case_name)
    assert response.json()["data"]["noMatch"] is expected_no_match
    assert all(
        movie["reason"] == {"matchedGenres": []}
        for movie in response.json()["data"]["movies"]
    )


def test_personalised_missing_popularity_is_preserved_and_not_invented(
    database_session: Session,
) -> None:
    revision_id = _seed_small_catalogue(database_session)
    http, _ = _sign_in("missing-score@example.com")

    popular = http.get("/api/me/recommendations")
    _save_preferences(http, [1])
    personalised = http.get("/api/me/recommendations")

    assert popular.status_code == personalised.status_code == 200
    assert [movie["title"] for movie in popular.json()["data"]["movies"]] == [
        "Comedy",
        "Action High",
        "Action Zero",
    ]
    assert all(
        movie["popularityScore"] is not None
        for movie in popular.json()["data"]["movies"]
    )

    body = personalised.json()
    assert [movie["title"] for movie in body["data"]["movies"]] == [
        "Action High",
        "Action Zero",
        "Action Missing",
    ]
    assert [movie["popularityScore"] for movie in body["data"]["movies"]] == [
        10.0,
        0.0,
        None,
    ]
    assert body["meta"] == {
        "count": 3,
        "limit": 10,
        "catalogueRevision": revision_id,
    }
    assert all(
        movie["reason"]["matchedGenres"] == [{"id": 1, "name": "Action"}]
        for movie in body["data"]["movies"]
    )


def test_each_session_uses_only_its_account_preferences_despite_forged_identity(
    database_session: Session,
) -> None:
    _seed_small_catalogue(database_session)
    action_http, action_user_id = _sign_in("action@example.com")
    comedy_http, comedy_user_id = _sign_in("comedy@example.com")
    _save_preferences(action_http, [1])
    _save_preferences(comedy_http, [2])

    action_response = action_http.get(
        "/api/me/recommendations",
        params={"userId": comedy_user_id, "accountId": comedy_user_id},
        headers={"X-User-Id": comedy_user_id},
    )
    comedy_response = comedy_http.get(
        "/api/me/recommendations",
        params={"userId": action_user_id},
        headers={"X-User-Id": action_user_id},
    )

    assert action_user_id != comedy_user_id
    assert action_response.status_code == comedy_response.status_code == 200
    assert [movie["title"] for movie in action_response.json()["data"]["movies"]] == [
        "Action High",
        "Action Zero",
        "Action Missing",
    ]
    assert [movie["title"] for movie in comedy_response.json()["data"]["movies"]] == [
        "Comedy"
    ]
    assert all(
        genre["id"] == 1
        for movie in action_response.json()["data"]["movies"]
        for genre in movie["reason"]["matchedGenres"]
    )
    assert all(
        genre["id"] == 2
        for movie in comedy_response.json()["data"]["movies"]
        for genre in movie["reason"]["matchedGenres"]
    )


@pytest.mark.parametrize("session_state", ["missing", "invalid", "expired", "revoked"])
def test_missing_invalid_expired_and_revoked_sessions_are_rejected(
    database_session: Session,
    session_state: str,
) -> None:
    _seed_small_catalogue(database_session)
    http, user_id = _sign_in(f"{session_state}@example.com")
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

    response = http.get("/api/me/recommendations")

    _assert_error(
        response,
        401,
        "AUTHENTICATION_REQUIRED",
        "Authentication required",
    )


def test_no_match_with_no_usable_popular_alternative_is_a_valid_empty_success(
    database_session: Session,
) -> None:
    upsert_genre(database_session, genre_id=1, name="Action")
    upsert_genre(database_session, genre_id=2, name="Archive")
    revision = create_catalogue_revision(database_session, provider="synthetic-test")
    movie = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="synthetic-test",
        source_id="missing-score",
        title="Missing Score",
        popularity_score=None,
    )
    replace_movie_genres(database_session, movie=movie, genre_ids=[1])
    activate_catalogue_revision(database_session, revision_id=revision.id)
    database_session.commit()
    http, _ = _sign_in("empty-no-match@example.com")
    _save_preferences(http, [2])

    response = http.get("/api/me/recommendations")

    assert response.status_code == 200
    assert response.json() == {
        "data": {
            "movies": [],
            "mode": "popular",
            "personalised": False,
            "noMatch": True,
        },
        "meta": {
            "count": 0,
            "limit": 10,
            "catalogueRevision": revision.id,
        },
    }


def test_recommendations_read_only_local_sqlite_and_never_call_tmdb(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _seed_small_catalogue(database_session)
    http, _ = _sign_in("offline@example.com")
    _save_preferences(http, [1])

    def forbid_provider(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Recommendation requests must never call TMDb")

    monkeypatch.setattr(TmdbClient, "_get_json", forbid_provider)

    response = http.get("/api/me/recommendations?limit=2")

    assert response.status_code == 200
    assert response.json()["meta"]["count"] == 2
    assert response.json()["meta"]["limit"] == 2
