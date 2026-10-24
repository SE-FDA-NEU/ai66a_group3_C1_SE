"""S3-T08/T09: account-scoped recommendations and failure/recovery checks."""

from __future__ import annotations

import json
import re
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from app.db.database import Base
from app.db.models import (
    AuthSession,
    CatalogMovie,
    CatalogueRevision,
    CatalogueState,
    Genre,
    MovieGenre,
    UserGenrePreference,
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
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

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
        try:
            yield session
        finally:
            # Match production: read snapshots end with the request, not the test.
            session.rollback()

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
                "posterUrl": None,
                **({
                    "ratingAdjustment": 0,
                    "adjustedScore": candidate["popularityScore"],
                    "basis": "baseline",
                } if case["expectedResponse"]["data"]["mode"] == "personalised" else {}),
            }
        )
    saved_ids = set(case["savedGenreIds"])
    base_count = sum(
        bool(saved_ids.intersection(row["genreIds"]))
        for row in candidates.values()
    ) if saved_ids else 0
    if not base_count:
        base_count = sum(row["popularityScore"] is not None for row in candidates.values())
    expected_meta = case["expectedResponse"]["meta"] | {
        "page": 1,
        "total": base_count,
        "totalPages": (base_count + 9) // 10,
        "unfilteredTotal": base_count,
    }
    return {
        "data": case["expectedResponse"]["data"] | {"movies": movies},
        "meta": expected_meta,
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
        "page": 1,
        "total": 3,
        "totalPages": 1,
        "unfilteredTotal": 3,
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
            "page": 1,
            "total": 0,
            "totalPages": 0,
            "unfilteredTotal": 0,
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


def _committed_preference_rows(session: Session) -> list[tuple[str, int]]:
    """Read every account's committed rows without the request identity map."""

    with Session(session.get_bind()) as fresh:
        return [
            (user_id, genre_id)
            for user_id, genre_id in fresh.execute(
                select(UserGenrePreference.user_id, UserGenrePreference.genre_id)
                .order_by(UserGenrePreference.user_id, UserGenrePreference.genre_id)
            )
        ]


def test_t17_recommendation_detail_round_trip_preserves_database_preferences(
    database_session: Session,
) -> None:
    _seed_small_catalogue(database_session)
    http, user_id = _sign_in("t17-detail-return@example.com")
    _save_preferences(http, [1])
    rows_before = _committed_preference_rows(database_session)

    recommendations = http.get("/api/me/recommendations?limit=2")
    assert recommendations.status_code == 200
    movie_id = recommendations.json()["data"]["movies"][0]["id"]

    detail = http.get(f"/api/movies/{movie_id}")
    assert detail.status_code == 200
    assert detail.json()["data"]["movie"]["id"] == movie_id

    assert http.get("/api/me/preferences").json()["data"]["genres"] == [
        {"id": 1, "name": "Action"}
    ]
    assert _committed_preference_rows(database_session) == rows_before == [
        (user_id, 1)
    ]


def test_t18_detail_is_public_and_saved_preferences_survive_a_fresh_session(
    database_session: Session,
) -> None:
    revision_id = _seed_small_catalogue(database_session)
    detailed = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision_id,
        source="synthetic-test",
        source_id="detailed",
        title="Detailed Action",
        release_year=2025,
        overview="A movie with every detail field.",
        popularity_score=99.0,
    )
    replace_movie_genres(database_session, movie=detailed, genre_ids=[1])
    database_session.commit()

    email = "t18-detail-acceptance@example.com"
    http, user_id = _sign_in(email)
    _save_preferences(http, [1])
    recommendations = http.get("/api/me/recommendations?limit=2")
    assert recommendations.status_code == 200
    assert recommendations.json()["data"]["movies"][0]["id"] == detailed.id

    # A visitor with no session cookie can read the same movie (AC1).
    visitor = TestClient(app)
    detail = visitor.get(f"/api/movies/{detailed.id}")
    assert detail.status_code == 200
    movie = detail.json()["data"]["movie"]
    assert movie["title"] == "Detailed Action"
    assert movie["releaseYear"] == 2025
    assert movie["overview"] == "A movie with every detail field."
    assert movie["genres"] == [{"id": 1, "name": "Action"}]

    # An unknown ID opens no other movie (AC2).
    unknown = visitor.get("/api/movies/does-not-exist")
    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "MOVIE_NOT_FOUND"
    assert unknown.json()["error"]["message"] == "Movie not found"

    # A new session for the same account (a browser refresh or another device)
    # still sees the saved genres and the same recommendation list (AC4).
    refreshed = TestClient(app)
    login = refreshed.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200
    assert refreshed.get("/api/me/preferences").json()["data"]["genres"] == [
        {"id": 1, "name": "Action"}
    ]
    assert (
        refreshed.get("/api/me/recommendations?limit=2").json()["data"]
        == recommendations.json()["data"]
    )
    assert _committed_preference_rows(database_session) == [(user_id, 1)]


def _is_failure_query(stage: str, statement: str) -> bool:
    """Select the actual SQLite query boundary to interrupt, not its result."""

    if stage == "catalogue":
        return "FROM catalogue_revisions JOIN catalogue_state" in statement
    if stage == "preferences":
        return "JOIN user_genre_preferences" in statement
    if stage == "matching":
        return "FROM catalog_movies JOIN catalogue_state" in statement and (
            "EXISTS" in statement
        )
    if stage == "popular":
        return "FROM catalog_movies JOIN catalogue_state" in statement and (
            "EXISTS" not in statement
        )
    if stage == "movie_genres":
        return "FROM movie_genres JOIN genres" in statement
    raise AssertionError(f"Unknown failure stage: {stage}")


@pytest.mark.parametrize(
    ("stage", "account_mode"),
    [
        (stage, account_mode)
        for stage in ("catalogue", "preferences", "matching", "popular", "movie_genres")
        for account_mode in ("personalised", "no_match", "cold_start")
        if not (stage == "matching" and account_mode == "cold_start")
        and not (stage == "popular" and account_mode == "personalised")
    ],
)
def test_t09_query_failure_is_not_empty_and_retry_restores_both_accounts(
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    stage: str,
    account_mode: str,
) -> None:
    """Fail real query execution, then retry with the same account and query."""

    _seed_small_catalogue(database_session)

    def fresh_request_db() -> Iterator[Session]:
        with Session(database_session.get_bind(), autoflush=False) as request_session:
            yield request_session

    # Model production cleanup: each request closes its own Session, including
    # failures. The fixture Session is used only for committed-row observation.
    monkeypatch.setitem(app.dependency_overrides, get_db, fresh_request_db)
    account_a, account_a_id = _sign_in("t09-a@example.com")
    account_b, account_b_id = _sign_in("t09-b@example.com")
    if account_mode != "cold_start":
        _save_preferences(account_a, [1] if account_mode == "personalised" else [3])
    _save_preferences(account_b, [2])
    assert account_a_id != account_b_id
    assert account_a.cookies.get("ams_session") != account_b.cookies.get("ams_session")

    def forbid_provider(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Failure or retry must not call TMDb")

    monkeypatch.setattr(TmdbClient, "_get_json", forbid_provider)

    path = "/api/me/recommendations?limit=2"
    baseline_a = account_a.get(path)
    baseline_b = account_b.get(path)
    preferences_a = account_a.get("/api/me/preferences")
    preferences_b = account_b.get("/api/me/preferences")
    assert baseline_a.status_code == baseline_b.status_code == 200
    assert preferences_a.status_code == preferences_b.status_code == 200
    assert baseline_a.json()["data"]["mode"] == (
        "personalised" if account_mode == "personalised" else "popular"
    )
    assert baseline_a.json()["data"]["noMatch"] is (account_mode == "no_match")
    assert baseline_a.json()["meta"]["limit"] == 2
    rows_before = _committed_preference_rows(database_session)
    assert any(user_id == account_b_id for user_id, _genre_id in rows_before)

    failed_queries: list[str] = []
    writes: list[str] = []

    def interrupt_query(_connection, _cursor, statement, parameters, _context, _many):
        if statement.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            writes.append(statement)
        if _is_failure_query(stage, statement):
            failed_queries.append(statement)
            raise OperationalError(
                statement, parameters, Exception("private-t09-db-detail")
            )

    engine = database_session.get_bind()
    event.listen(engine, "before_cursor_execute", interrupt_query)
    try:
        failed = account_a.get(path)
        failed_again = account_a.get(path)
    finally:
        event.remove(engine, "before_cursor_execute", interrupt_query)

    assert len(failed_queries) == 2, "Both failed requests must reach the injected query"
    assert not writes, "Recommendation failures must never write personalisation data"
    for response in (failed, failed_again):
        _assert_error(
            response,
            503,
            "SERVICE_UNAVAILABLE",
            "Service is temporarily unavailable",
        )
        assert set(response.json()["error"]) == {"code", "message", "requestId"}
        assert "private-t09-db-detail" not in response.text
        assert "SELECT" not in response.text
        assert "t09-a@example.com" not in response.text
        assert "t09-b@example.com" not in response.text
    assert failed.json()["error"]["requestId"] != failed_again.json()["error"]["requestId"]
    assert _committed_preference_rows(database_session) == rows_before

    # No sign-in, preference rewrite, or client replacement is needed to recover.
    recovered_a = account_a.get(path)
    recovered_b = account_b.get(path)
    assert recovered_a.status_code == recovered_b.status_code == 200
    assert recovered_a.json() == baseline_a.json()
    assert recovered_b.json() == baseline_b.json()
    assert account_a.get("/api/me/preferences").json() == preferences_a.json()
    assert account_b.get("/api/me/preferences").json() == preferences_b.json()
    assert _committed_preference_rows(database_session) == rows_before


def test_t09_missing_catalogue_preserves_preferences_and_recovers_after_activation(
    database_session: Session,
) -> None:
    revision_id = _seed_small_catalogue(database_session)
    account_a, _ = _sign_in("t09-missing-a@example.com")
    account_b, _ = _sign_in("t09-missing-b@example.com")
    _save_preferences(account_a, [1])
    _save_preferences(account_b, [2])
    path = "/api/me/recommendations?limit=2"
    baseline_a = account_a.get(path)
    baseline_b = account_b.get(path)
    assert baseline_a.status_code == baseline_b.status_code == 200
    rows_before = _committed_preference_rows(database_session)

    # Remove only the pointer in this isolated test database, not movies or users.
    database_session.execute(delete(CatalogueState))
    database_session.commit()
    for account in (account_a, account_b):
        unavailable = account.get(path)
        _assert_error(
            unavailable,
            503,
            "CATALOGUE_UNAVAILABLE",
            "Movie catalogue is unavailable",
        )
    assert _committed_preference_rows(database_session) == rows_before

    activate_catalogue_revision(database_session, revision_id=revision_id)
    database_session.commit()
    recovered_a = account_a.get(path)
    recovered_b = account_b.get(path)
    assert recovered_a.status_code == recovered_b.status_code == 200
    assert recovered_a.json() == baseline_a.json()
    assert recovered_b.json() == baseline_b.json()
    assert _committed_preference_rows(database_session) == rows_before


def test_t09_active_empty_catalogue_is_cold_start_success_not_a_source_error(
    database_session: Session,
) -> None:
    revision = create_catalogue_revision(database_session, provider="synthetic-test")
    activate_catalogue_revision(database_session, revision_id=revision.id)
    database_session.commit()
    http, _ = _sign_in("t09-empty@example.com")

    response = http.get("/api/me/recommendations?limit=2")

    assert response.status_code == 200
    assert response.json() == {
        "data": {
            "movies": [],
            "mode": "popular",
            "personalised": False,
            "noMatch": False,
        },
        "meta": {"count": 0, "limit": 2, "page": 1, "total": 0,
                 "totalPages": 0, "unfilteredTotal": 0,
                 "catalogueRevision": revision.id},
    }
    assert _committed_preference_rows(database_session) == []


@pytest.mark.parametrize(("rating", "sign"), [(1, -1), (5, 1)])
def test_t09_saved_ratings_change_only_current_account_scores_not_preferences(
    database_session: Session,
    rating: int,
    sign: int,
) -> None:
    _seed_small_catalogue(database_session)
    account_a, _ = _sign_in("t09-rating-a@example.com")
    account_b, _ = _sign_in("t09-rating-b@example.com")
    _save_preferences(account_a, [1])
    _save_preferences(account_b, [2])
    baseline_a = account_a.get("/api/me/recommendations")
    baseline_b = account_b.get("/api/me/recommendations")
    assert baseline_a.status_code == baseline_b.status_code == 200
    rows_before = _committed_preference_rows(database_session)
    movie_id = baseline_a.json()["data"]["movies"][0]["id"]
    rating_path = f"/api/me/ratings/{movie_id}"

    saved_b = account_b.put(rating_path, json={"rating": 3}, headers=HEADERS)
    saved_a = account_a.put(rating_path, json={"rating": rating}, headers=HEADERS)
    assert saved_a.status_code == saved_b.status_code == 200
    assert account_a.get(rating_path).json()["data"]["rating"] == rating
    assert account_b.get(rating_path).json()["data"]["rating"] == 3
    after_a = account_a.get("/api/me/recommendations")
    after_b = account_b.get("/api/me/recommendations")
    assert after_a.status_code == after_b.status_code == 200
    before_cards = baseline_a.json()["data"]["movies"]
    after_cards = after_a.json()["data"]["movies"]
    assert [movie["id"] for movie in after_cards] == [movie["id"] for movie in before_cards]
    assert [movie["popularityScore"] for movie in after_cards] == [
        movie["popularityScore"] for movie in before_cards
    ]
    assert all(movie["ratingAdjustment"] == sign for movie in after_cards)
    assert all(movie["basis"] == "rating_signals" for movie in after_cards)
    assert [movie["adjustedScore"] for movie in after_cards] == [
        movie["popularityScore"] + sign if movie["popularityScore"] is not None else None
        for movie in before_cards
    ]
    assert after_b.json() == baseline_b.json()
    assert _committed_preference_rows(database_session) == rows_before
