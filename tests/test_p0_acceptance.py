"""M4 P0 contract checks against migrated, disposable SQLite and real routes.

The S03 fixture blocks provider HTTP, ignores developer .env and migrates a fresh
database for every case. IDs match docs/testing.md section 2.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

PASSWORD = "Synthetic-t16-password"
PREFERENCES = "/api/me/preferences"
RECOMMENDATIONS = "/api/me/recommendations"


def account(details, email="a@example.test"):
    http = TestClient(details.app)
    credentials = {"email": email, "password": PASSWORD}
    assert http.post("/api/auth/register", json=credentials).status_code == 201
    assert http.post("/api/auth/login", json=credentials).status_code == 200
    return http


def save(http, genres):
    return http.put(PREFERENCES, json={"genreIds": genres})


def selected(http):
    response = http.get(PREFERENCES)
    assert response.status_code == 200
    return [genre["id"] for genre in response.json()["data"]["genres"]]


def add_genres(details, ids):
    from app.db.models import CatalogMovie
    from app.repositories.movies import replace_movie_genres, upsert_genre

    with details.sessions() as db:
        for genre_id in ids:
            upsert_genre(db, genre_id=genre_id, name=f"Genre {genre_id}")
        movie = db.get(CatalogMovie, details.movies[0])
        replace_movie_genres(db, movie=movie, genre_ids=[28, 35, *ids])
        db.commit()


def add_movies(details, count, genre_ids=(28,), *, prefix="Extra", null_last=False):
    from app.repositories.movies import replace_movie_genres, upsert_catalogue_movie

    result = []
    with details.sessions() as db:
        for number in range(count):
            movie = upsert_catalogue_movie(
                db,
                catalogue_revision_id=details.revision,
                source="s4-t05-synthetic",
                source_id=f"{prefix}-{number}",
                title=f"{prefix} {number:02d}",
                popularity_score=(
                    None if null_last and number == count - 1 else float(70 - number)
                ),
            )
            replace_movie_genres(db, movie=movie, genre_ids=list(genre_ids))
            result.append(movie.id)
        db.commit()
    return result


def error(response, status, code):
    assert response.status_code == status, response.text
    body = response.json()
    assert body["error"]["code"] == code
    assert "data" not in body
    return body


def movies(response):
    assert response.status_code == 200, response.text
    return response.json()["data"]["movies"]


def test_TC_P0_S01_001_canonical_genres_and_empty_selection(details):
    a = account(details)
    assert {item["id"] for item in a.get("/api/genres").json()["data"]["genres"]} == {
        28,
        35,
    }
    assert selected(a) == []


def test_TC_P0_S01_002_zero_preserves_previous_rows(details):
    a = account(details)
    assert save(a, [28, 35]).status_code == 200
    error(save(a, []), 400, "VALIDATION_ERROR")
    assert selected(a) == [28, 35]


@pytest.mark.parametrize(
    "count",
    [1, 2, 4, 5],
    ids=[
        "TC-P0-S01-003",
        "TC-P0-S01-004",
        "TC-P0-S01-005",
        "TC-P0-S01-006",
    ],
)
def test_TC_P0_S01_003_004_005_006_exact_selection_boundaries(details, count):
    from app.db.models import UserGenrePreference

    add_genres(details, [10, 11, 12])
    a = account(details)
    b = account(details, "b@example.test")
    assert save(b, [35]).status_code == 200
    requested = [28, 35, 10, 11, 12][:count]
    response = save(a, list(reversed(requested)))
    assert response.status_code == 200, response.text
    assert selected(a) == requested
    assert [genre["id"] for genre in response.json()["data"]["genres"]] == requested
    assert selected(b) == [35]
    with details.sessions() as db:
        assert (
            db.scalar(select(func.count()).select_from(UserGenrePreference))
            == count + 1
        )


def test_TC_P0_S01_007_invalid_sets_preserve_previous_selection(details):
    add_genres(details, [10, 11, 12, 13])
    a = account(details)
    assert save(a, [28, 35]).status_code == 200
    for invalid in ([28, 35, 10, 11, 12, 13], [28, 28], [True], ["28"]):
        error(save(a, invalid), 400, "VALIDATION_ERROR")
        assert selected(a) == [28, 35]


def test_TC_P0_S01_008_guest_forgery_and_origin_leave_accounts_intact(details):
    a, b = account(details), account(details, "b@example.test")
    assert save(a, [28]).status_code == 200
    assert save(b, [35]).status_code == 200
    error(
        details.http.put(PREFERENCES, json={"genreIds": [35]}),
        401,
        "AUTHENTICATION_REQUIRED",
    )
    error(
        a.put(PREFERENCES, json={"genreIds": [35], "userId": "forged"}),
        400,
        "VALIDATION_ERROR",
    )
    error(
        a.put(
            PREFERENCES,
            json={"genreIds": [35]},
            headers={"Origin": "https://evil.invalid"},
        ),
        403,
        "ORIGIN_NOT_ALLOWED",
    )
    assert selected(a) == [28]
    assert selected(b) == [35]


def test_TC_P0_S02_001_full_set_paging_has_25_distinct_movies(details):
    add_movies(details, 13)
    a = account(details)
    assert save(a, [28]).status_code == 200
    pages = [a.get(RECOMMENDATIONS, params={"page": page}) for page in (1, 2, 3)]
    ids = [item["id"] for response in pages for item in movies(response)]
    assert [len(movies(response)) for response in pages] == [10, 10, 5]
    assert len(ids) == len(set(ids)) == 25
    assert all(response.json()["meta"]["total"] == 25 for response in pages)
    assert all(response.json()["meta"]["totalPages"] == 3 for response in pages)


def test_TC_P0_S02_002_rating_free_order_and_reasons(details):
    a = account(details)
    assert save(a, [28]).status_code == 200
    result = movies(a.get(RECOMMENDATIONS))
    assert [item["popularityScore"] for item in result] == sorted(
        [item["popularityScore"] for item in result], reverse=True
    )
    assert all(
        {genre["id"] for genre in item["reason"]["matchedGenres"]} == {28}
        for item in result
    )
    assert all(item["basis"] == "baseline" for item in result)


def test_TC_P0_S02_003_no_match_uses_unboosted_popular(details):
    from app.repositories.movies import upsert_genre

    with details.sessions() as db:
        upsert_genre(db, genre_id=99, name="No active match")
        db.commit()
    a = account(details)
    assert save(a, [99]).status_code == 200
    body = a.get(RECOMMENDATIONS).json()
    assert body["data"]["mode"] == "popular"
    assert body["data"]["personalised"] is False
    assert body["data"]["noMatch"] is True
    assert all("adjustedScore" not in item for item in body["data"]["movies"])
    assert selected(a) == [99]


def test_TC_P0_S02_004_guest_and_expired_cookie_are_private(details):
    from app.db.models import AuthSession

    error(details.http.get(RECOMMENDATIONS), 401, "AUTHENTICATION_REQUIRED")
    a = account(details)
    with details.sessions() as db:
        session = db.scalars(select(AuthSession)).one()
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    error(a.get(RECOMMENDATIONS), 401, "AUTHENTICATION_REQUIRED")


def test_TC_P0_S02_005_core_failure_then_retry_preserves_preferences(
    details, monkeypatch
):
    from app import main
    from sqlalchemy.exc import OperationalError

    a = account(details)
    assert save(a, [28]).status_code == 200
    original = main.get_active_catalogue_revision

    def unavailable(*args, **kwargs):
        raise OperationalError("synthetic read", None, None)

    monkeypatch.setattr(main, "get_active_catalogue_revision", unavailable)
    failed = error(a.get(RECOMMENDATIONS), 503, "SERVICE_UNAVAILABLE")
    assert failed["error"]["requestId"]
    monkeypatch.setattr(main, "get_active_catalogue_revision", original)
    assert len(movies(a.get(RECOMMENDATIONS))) == 10
    assert selected(a) == [28]


def test_TC_P0_S02_006_filter_after_whole_set_ranking(details):
    add_movies(details, 23, genre_ids=(28,))
    a = account(details)
    assert save(a, [28]).status_code == 200
    first = a.get(RECOMMENDATIONS, params={"genreId": 35, "page": 1})
    second = a.get(RECOMMENDATIONS, params={"genreId": 35, "page": 2})
    assert [len(movies(first)), len(movies(second))] == [10, 2]
    assert first.json()["meta"]["total"] == second.json()["meta"]["total"] == 12
    assert first.json()["meta"]["unfilteredTotal"] == 35
    assert (
        len({item["id"] for response in (first, second) for item in movies(response)})
        == 12
    )
    assert selected(a) == [28]
    for genre_id in (0, 2147483648):
        error(
            a.get(RECOMMENDATIONS, params={"genreId": genre_id}),
            400,
            "VALIDATION_ERROR",
        )
    error(
        a.get(RECOMMENDATIONS, params={"genreId": 2147483647}), 400, "GENRE_NOT_FOUND"
    )


def test_TC_P0_S04_001_public_catalogue_pages_include_null_popularity(details):
    extra = add_movies(details, 13, null_last=True)
    pages = [
        details.http.get("/api/movies", params={"page": page}) for page in (1, 2, 3)
    ]
    items = [item for response in pages for item in movies(response)]
    assert [len(movies(response)) for response in pages] == [10, 10, 5]
    assert len({item["id"] for item in items}) == 25
    assert [item["title"] for item in items] == sorted(item["title"] for item in items)
    assert any(
        item["id"] == extra[-1] and item["popularityScore"] is None for item in items
    )
    assert pages[0].json()["meta"]["totalPages"] == 3


def test_TC_P0_S04_002_cold_start_has_no_personal_score(details):
    from app.repositories.movies import (
        activate_catalogue_revision,
        create_catalogue_revision,
        upsert_catalogue_movie,
    )

    with details.sessions() as db:
        revision = create_catalogue_revision(db, provider="cold-start-synthetic")
        for title, score in (("A", 90), ("C", 80), ("B", 80), ("Missing", None)):
            upsert_catalogue_movie(
                db,
                catalogue_revision_id=revision.id,
                source="cold-start-synthetic",
                source_id=title,
                title=title,
                popularity_score=score,
            )
        activate_catalogue_revision(db, revision_id=revision.id)
        db.commit()
    a = account(details)
    body = a.get(RECOMMENDATIONS).json()
    assert body["data"]["mode"] == "popular"
    assert body["data"]["personalised"] is False
    assert body["data"]["noMatch"] is False
    items = body["data"]["movies"]
    assert [item["title"] for item in items] == ["A", "B", "C"]
    assert [item["popularityScore"] for item in items] == [90, 80, 80]
    assert all("adjustedScore" not in item for item in items)


def test_TC_P0_S04_003_limit_9_and_10_keep_full_total(details):
    add_movies(details, 13)
    for limit in (9, 10):
        response = details.http.get("/api/movies", params={"limit": limit})
        assert len(movies(response)) == limit
        assert response.json()["meta"]["total"] == 25


def test_TC_P0_S04_004_limit_and_page_refusals(details):
    for params in (
        {"limit": 0},
        {"limit": 11},
        {"page": 0},
        {"page": 10001},
        {"page": "bad"},
    ):
        error(details.http.get("/api/movies", params=params), 400, "VALIDATION_ERROR")
    assert movies(details.http.get("/api/movies", params={"page": 10000})) == []


def test_TC_P0_S04_005_empty_active_versus_missing_revision(details):
    from app.db.models import CatalogueState
    from app.repositories.movies import (
        activate_catalogue_revision,
        create_catalogue_revision,
    )

    with details.sessions() as db:
        revision = create_catalogue_revision(db, provider="empty-synthetic")
        activate_catalogue_revision(db, revision_id=revision.id)
        db.commit()
    response = details.http.get("/api/movies")
    assert movies(response) == []
    assert response.json()["meta"]["total"] == 0
    with details.sessions() as db:
        db.execute(delete(CatalogueState))
        db.commit()
    error(details.http.get("/api/movies"), 503, "CATALOGUE_UNAVAILABLE")


def test_TC_P0_S04_006_stale_catalogue_revision_is_409(details):
    from app.repositories.movies import (
        activate_catalogue_revision,
        create_catalogue_revision,
    )

    old = details.http.get("/api/movies").json()["meta"]["catalogueRevision"]
    with details.sessions() as db:
        revision = create_catalogue_revision(db, provider="new-synthetic")
        activate_catalogue_revision(db, revision_id=revision.id)
        db.commit()
        new_revision_id = revision.id
    assert old != new_revision_id
    error(
        details.http.get("/api/movies", params={"page": 2, "catalogueRevision": old}),
        409,
        "CATALOGUE_CHANGED",
    )


def test_TC_P0_S12_001_eight_char_normalized_hashed_registration(details):
    from app.db.models import User

    result = details.http.post(
        "/api/auth/register",
        json={"email": "  MIXED@Example.Test ", "password": "12345678"},
    )
    assert result.status_code == 201, result.text
    user = result.json()["data"]["user"]
    assert user["email"] == "mixed@example.test"
    assert not {"password", "passwordHash"}.intersection(user)
    assert "set-cookie" not in result.headers
    with details.sessions() as db:
        row = db.scalars(select(User)).one()
        assert row.email_normalized == "mixed@example.test"
        assert row.password_hash.startswith("$argon2id$")
        assert row.password_hash != "12345678"


def test_TC_P0_S12_002_seven_char_password_has_no_row(details):
    from app.db.models import User

    error(
        details.http.post(
            "/api/auth/register",
            json={"email": "a@example.test", "password": "1234567"},
        ),
        400,
        "VALIDATION_ERROR",
    )
    with details.sessions() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0


def test_TC_P0_S12_003_nine_char_password_has_safe_dto(details):
    response = details.http.post(
        "/api/auth/register", json={"email": "a@example.test", "password": "123456789"}
    )
    assert response.status_code == 201
    assert not {"password", "passwordHash"}.intersection(
        response.json()["data"]["user"]
    )


def test_TC_P0_S12_004_duplicate_normalized_email_is_conflict(details):
    from app.db.models import User

    assert (
        details.http.post(
            "/api/auth/register", json={"email": "a@example.test", "password": PASSWORD}
        ).status_code
        == 201
    )
    response = error(
        details.http.post(
            "/api/auth/register",
            json={"email": " A@EXAMPLE.TEST ", "password": PASSWORD},
        ),
        409,
        "EMAIL_ALREADY_REGISTERED",
    )
    assert response["error"]["message"] == "This email is already registered"
    with details.sessions() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 1


def test_TC_P0_S12_005_invalid_email_and_storage_failure_create_no_account(
    details, monkeypatch
):
    from app import main
    from app.db.models import User
    from sqlalchemy.exc import OperationalError

    error(
        details.http.post(
            "/api/auth/register", json={"email": "invalid", "password": PASSWORD}
        ),
        400,
        "VALIDATION_ERROR",
    )

    def unavailable(*args, **kwargs):
        raise OperationalError(
            "synthetic account write", None, Exception("private failure")
        )

    monkeypatch.setattr(main, "create_user", unavailable)
    failed = error(
        details.http.post(
            "/api/auth/register", json={"email": "a@example.test", "password": PASSWORD}
        ),
        503,
        "SERVICE_UNAVAILABLE",
    )
    assert "private failure" not in str(failed)
    with details.sessions() as db:
        assert db.scalar(select(func.count()).select_from(User)) == 0


def test_TC_P0_S13_001_login_me_cookie_and_safe_user(details):
    a = account(details)
    response = a.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["data"]["user"]["email"] == "a@example.test"
    assert not {"password", "passwordHash", "token"}.intersection(
        response.json()["data"]["user"]
    )
    assert "session" in str(a.cookies).lower()


def test_TC_P0_S13_002_wrong_and_unknown_credentials_same_public_error(details):
    account(details)
    for email, password in (
        ("a@example.test", "incorrect"),
        ("unknown@example.test", PASSWORD),
    ):
        body = error(
            details.http.post(
                "/api/auth/login", json={"email": email, "password": password}
            ),
            401,
            "INVALID_CREDENTIALS",
        )
        assert body["error"]["message"] == "Email or password is incorrect"


def test_TC_P0_S13_003_logout_replay_and_later_login_restore_data(details):
    a = account(details)
    assert save(a, [28]).status_code == 200
    assert (
        a.put(f"/api/me/ratings/{details.movies[0]}", json={"rating": 5}).status_code
        == 200
    )
    old_cookies = dict(a.cookies)
    assert a.post("/api/auth/logout").status_code == 204
    replay = TestClient(details.app)
    replay.cookies.update(old_cookies)
    error(replay.get(PREFERENCES), 401, "AUTHENTICATION_REQUIRED")
    assert (
        a.post(
            "/api/auth/login", json={"email": "a@example.test", "password": PASSWORD}
        ).status_code
        == 200
    )
    assert selected(a) == [28]
    assert a.get(f"/api/me/ratings/{details.movies[0]}").json()["data"]["rating"] == 5


def test_TC_P0_S13_004_missing_expired_and_revoked_sessions_refused(details):
    from app.db.models import AuthSession

    error(details.http.get(PREFERENCES), 401, "AUTHENTICATION_REQUIRED")
    a = account(details)
    with details.sessions() as db:
        session = db.scalars(select(AuthSession)).one()
        session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    error(a.get(PREFERENCES), 401, "AUTHENTICATION_REQUIRED")
    assert (
        a.post(
            "/api/auth/login", json={"email": "a@example.test", "password": PASSWORD}
        ).status_code
        == 200
    )
    assert a.post("/api/auth/logout").status_code == 204
    error(a.get(PREFERENCES), 401, "AUTHENTICATION_REQUIRED")


def test_TC_P0_S13_005_account_isolation_and_forged_identity(details):
    a, b = account(details), account(details, "b@example.test")
    assert save(a, [28]).status_code == 200
    assert save(b, [35]).status_code == 200
    movie_id = details.movies[0]
    assert a.put(f"/api/me/ratings/{movie_id}", json={"rating": 5}).status_code == 200
    error(
        b.put(PREFERENCES, json={"genreIds": [28], "userId": "a"}),
        400,
        "VALIDATION_ERROR",
    )
    assert selected(a) == [28]
    assert selected(b) == [35]
    assert b.get(f"/api/me/ratings/{movie_id}").json()["data"]["rating"] is None


def test_TC_P0_S13_006_cross_origin_auth_and_write_refused(details):
    a = account(details)
    assert save(a, [28]).status_code == 200
    foreign = {"Origin": "https://evil.invalid"}
    error(
        a.post(
            "/api/auth/login",
            json={"email": "a@example.test", "password": PASSWORD},
            headers=foreign,
        ),
        403,
        "ORIGIN_NOT_ALLOWED",
    )
    error(a.post("/api/auth/logout", headers=foreign), 403, "ORIGIN_NOT_ALLOWED")
    error(
        a.put(PREFERENCES, json={"genreIds": [35]}, headers=foreign),
        403,
        "ORIGIN_NOT_ALLOWED",
    )
    assert selected(a) == [28]
