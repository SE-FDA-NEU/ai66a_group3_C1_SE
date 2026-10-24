"""S4 #22: synthetic API oracle for current-account rating signals."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import UserGenrePreference
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

HEADERS = {"Origin": "http://testserver"}


@pytest.fixture
def local_api(tmp_path: Path) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    """Use a fresh on-disk SQLite database for each API assertion."""

    engine = create_engine(
        f"sqlite+pysqlite:///{(tmp_path / 'ranking.db').as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def request_db() -> Iterator[Session]:
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = request_db
    with TestClient(app) as http:
        try:
            yield http, factory
        finally:
            app.dependency_overrides.clear()
    engine.dispose()


def _seed_two_candidates(factory: sessionmaker[Session]) -> dict[str, str]:
    with factory() as session:
        upsert_genre(session, genre_id=1, name="Action")
        upsert_genre(session, genre_id=2, name="Comedy")
        revision = create_catalogue_revision(session, provider="synthetic-test")
        movie_ids: dict[str, str] = {}
        for name, score, genres in (
            ("Zulu Action", 80.0, [1]),
            ("Alpha Comedy", 80.0, [2]),
            ("Action Signal", 1.0, [1]),
        ):
            movie = upsert_catalogue_movie(
                session,
                catalogue_revision_id=revision.id,
                source="synthetic-test",
                source_id=name,
                title=name,
                popularity_score=score,
            )
            replace_movie_genres(session, movie=movie, genre_ids=genres)
            movie_ids[name] = movie.id
        activate_catalogue_revision(session, revision_id=revision.id)
        session.commit()
    return movie_ids


def _sign_in(http: TestClient, email: str) -> str:
    registered = http.post(
        "/api/auth/register", json={"email": email, "password": "movie123"}
    )
    assert registered.status_code == 201
    signed_in = http.post(
        "/api/auth/login",
        json={"email": email, "password": "movie123"},
        headers=HEADERS,
    )
    assert signed_in.status_code == 200
    return signed_in.json()["data"]["user"]["id"]


def _seed_catalogue(
    factory: sessionmaker[Session],
    rows: list[tuple[str, float | None, list[int]]],
) -> dict[str, str]:
    with factory() as session:
        for genre_id, name in ((1, "Action"), (2, "Comedy"), (3, "Archive")):
            upsert_genre(session, genre_id=genre_id, name=name)
        revision = create_catalogue_revision(session, provider="synthetic-test")
        movie_ids = {}
        for name, score, genres in rows:
            movie = upsert_catalogue_movie(
                session,
                catalogue_revision_id=revision.id,
                source="synthetic-test",
                source_id=name,
                title=name,
                popularity_score=score,
            )
            replace_movie_genres(session, movie=movie, genre_ids=genres)
            movie_ids[name] = movie.id
        activate_catalogue_revision(session, revision_id=revision.id)
        session.commit()
    return movie_ids


def _save_preferences(http: TestClient, genres: list[int]) -> None:
    assert http.put(
        "/api/me/preferences", json={"genreIds": genres}, headers=HEADERS
    ).status_code == 200


def _save_rating(http: TestClient, movie_id: str, value: int) -> None:
    assert http.put(
        f"/api/me/ratings/{movie_id}", json={"rating": value}, headers=HEADERS
    ).status_code == 200


def _cards(response) -> dict[str, dict]:
    assert response.status_code == 200
    return {movie["title"]: movie for movie in response.json()["data"]["movies"]}


@pytest.mark.parametrize(
    ("rating", "adjustment", "first_title"),
    [
        (1, -1, "Alpha Comedy"),
        (2, -1, "Alpha Comedy"),
        (3, 0, "Alpha Comedy"),
        (4, 1, "Zulu Action"),
        (5, 1, "Zulu Action"),
    ],
)
def test_saved_rating_sign_changes_80_80_candidate_order(
    local_api: tuple[TestClient, sessionmaker[Session]],
    rating: int,
    adjustment: int,
    first_title: str,
) -> None:
    http, factory = local_api
    movie_ids = _seed_two_candidates(factory)
    _sign_in(http, f"rating-{rating}@example.com")
    assert http.put(
        "/api/me/preferences", json={"genreIds": [1, 2]}, headers=HEADERS
    ).status_code == 200
    assert http.put(
        f"/api/me/ratings/{movie_ids['Action Signal']}",
        json={"rating": rating},
        headers=HEADERS,
    ).status_code == 200

    response = http.get("/api/me/recommendations")
    assert response.status_code == 200
    movies = response.json()["data"]["movies"]
    cards = {movie["title"]: movie for movie in movies}
    assert movies[0]["title"] == first_title
    assert cards["Zulu Action"]["popularityScore"] == 80.0
    assert cards["Alpha Comedy"]["popularityScore"] == 80.0
    assert cards["Zulu Action"]["ratingAdjustment"] == adjustment
    assert cards["Zulu Action"]["adjustedScore"] == 80.0 + adjustment
    assert cards["Alpha Comedy"]["ratingAdjustment"] == 0
    assert cards["Alpha Comedy"]["adjustedScore"] == 80.0
    assert cards["Zulu Action"]["basis"] == (
        "rating_signals" if adjustment else "baseline"
    )


def test_90_80_neutral_and_no_ratings_preserve_baseline_order(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    movie_ids = _seed_catalogue(factory, [
        ("Zulu Action", 90.0, [1]),
        ("Alpha Comedy", 80.0, [2]),
        ("Action Signal", 1.0, [1]),
    ])
    _sign_in(http, "neutral@example.com")
    _save_preferences(http, [1, 2])
    before = http.get("/api/me/recommendations")
    _save_rating(http, movie_ids["Action Signal"], 3)
    after = http.get("/api/me/recommendations")
    assert [movie["title"] for movie in before.json()["data"]["movies"]] == [
        movie["title"] for movie in after.json()["data"]["movies"]
    ]
    assert _cards(before)["Zulu Action"]["adjustedScore"] == 90.0
    assert _cards(after)["Zulu Action"]["ratingAdjustment"] == 0
    assert _cards(after)["Zulu Action"]["basis"] == "baseline"


def test_shared_genres_count_once_updates_replace_sign_and_accounts_are_isolated(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http_a, factory = local_api
    ids = _seed_catalogue(factory, [
        ("Both Candidate", 90.0, [1, 2]),
        ("Action Candidate", 80.0, [1]),
        ("Comedy Candidate", 80.0, [2]),
        ("Both Signal", 1.0, [1, 2]),
        ("Action Signal", 1.0, [1]),
    ])
    user_a = _sign_in(http_a, "signals-a@example.com")
    http_b = TestClient(app)
    user_b = _sign_in(http_b, "signals-b@example.com")
    assert user_a != user_b
    _save_preferences(http_a, [1, 2])
    _save_preferences(http_b, [1, 2])
    _save_rating(http_a, ids["Both Signal"], 5)
    _save_rating(http_a, ids["Action Signal"], 1)

    a = _cards(http_a.get("/api/me/recommendations", params={"userId": user_b}))
    b = _cards(http_b.get("/api/me/recommendations", params={"userId": user_a}))
    assert a["Both Candidate"]["ratingAdjustment"] == 0
    assert a["Action Candidate"]["ratingAdjustment"] == 0
    assert a["Comedy Candidate"]["ratingAdjustment"] == 1
    assert b["Both Candidate"]["ratingAdjustment"] == 0
    assert b["Comedy Candidate"]["ratingAdjustment"] == 0

    _save_rating(http_a, ids["Both Signal"], 1)
    updated = _cards(http_a.get("/api/me/recommendations"))
    assert updated["Both Candidate"]["ratingAdjustment"] == -2
    assert updated["Action Candidate"]["ratingAdjustment"] == -2
    assert updated["Comedy Candidate"]["ratingAdjustment"] == -1
    assert updated["Both Candidate"]["adjustedScore"] == 88.0
    assert _cards(http_b.get("/api/me/recommendations"))["Both Candidate"][
        "adjustedScore"
    ] == 90.0
    http_b.close()


def test_rank_complete_base_before_filter_and_page_all_25_candidates(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    rows = [
        (f"Action {index:02d}", float(101 - index), [1])
        for index in range(1, 25)
    ]
    rows.extend([
        ("Target", 90.5, [1, 2]),
        ("Comedy Signal", 1.0, [2]),
    ])
    ids = _seed_catalogue(factory, rows)
    _sign_in(http, "paging@example.com")
    _save_preferences(http, [1])
    before = http.get("/api/me/recommendations")
    assert "Target" not in [movie["title"] for movie in before.json()["data"]["movies"]]
    _save_rating(http, ids["Comedy Signal"], 5)

    pages = [http.get(f"/api/me/recommendations?page={page}&limit=10") for page in (1, 2, 3)]
    titles = [movie["title"] for response in pages for movie in response.json()["data"]["movies"]]
    assert [len(response.json()["data"]["movies"]) for response in pages] == [10, 10, 5]
    assert len(titles) == len(set(titles)) == 25
    assert "Target" in [movie["title"] for movie in pages[0].json()["data"]["movies"]]
    assert all(response.json()["meta"]["total"] == 25 for response in pages)
    assert all(response.json()["meta"]["totalPages"] == 3 for response in pages)
    filtered = http.get("/api/me/recommendations?genreId=2")
    assert [movie["title"] for movie in filtered.json()["data"]["movies"]] == ["Target"]
    assert filtered.json()["meta"]["total"] == 1
    assert filtered.json()["meta"]["unfilteredTotal"] == 25


def test_null_popularity_remains_null_even_with_rating_signal(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    ids = _seed_catalogue(factory, [
        ("Finite Comedy", 80.0, [2]),
        ("Missing Action", None, [1]),
        ("Action Signal", 1.0, [1]),
    ])
    _sign_in(http, "null@example.com")
    _save_preferences(http, [1, 2])
    _save_rating(http, ids["Action Signal"], 5)
    response = http.get("/api/me/recommendations")
    cards = _cards(response)
    assert response.json()["data"]["movies"][-1]["title"] == "Missing Action"
    assert cards["Missing Action"]["popularityScore"] is None
    assert cards["Missing Action"]["ratingAdjustment"] == 1
    assert cards["Missing Action"]["adjustedScore"] is None
    assert cards["Missing Action"]["basis"] == "rating_signals"


def test_rating_query_failure_is_truthful_baseline_and_retry_recovers(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    ids = _seed_two_candidates(factory)
    user_id = _sign_in(http, "rating-failure@example.com")
    _save_preferences(http, [1, 2])
    _save_rating(http, ids["Action Signal"], 5)
    boosted = http.get("/api/me/recommendations")
    assert boosted.json()["data"]["movies"][0]["title"] == "Zulu Action"

    with factory() as session:
        saved_genres = list(session.scalars(select(UserGenrePreference.genre_id).where(
            UserGenrePreference.user_id == user_id
        )))
    engine = factory.kw["bind"]
    attempts = []

    def fail_rating_query(_connection, _cursor, statement, parameters, _context, _many):
        if "FROM user_movie_ratings JOIN movie_genres" in statement:
            attempts.append(statement)
            raise OperationalError(statement, parameters, Exception("private-rating-db-detail"))

    event.listen(engine, "before_cursor_execute", fail_rating_query)
    try:
        degraded = http.get("/api/me/recommendations")
    finally:
        event.remove(engine, "before_cursor_execute", fail_rating_query)
    assert len(attempts) == 1
    cards = _cards(degraded)
    assert degraded.json()["data"]["movies"][0]["title"] == "Alpha Comedy"
    assert all(card["basis"] == "rating_unavailable" for card in cards.values())
    assert all(card["ratingAdjustment"] == 0 for card in cards.values())
    assert cards["Zulu Action"]["adjustedScore"] == 80.0
    assert "private-rating-db-detail" not in degraded.text
    with factory() as session:
        assert list(session.scalars(select(UserGenrePreference.genre_id).where(
            UserGenrePreference.user_id == user_id
        ))) == saved_genres
    assert http.get("/api/me/recommendations").json() == boosted.json()


def test_popular_fallback_has_no_personal_scores_even_when_account_rated(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    ids = _seed_catalogue(factory, [
        ("Action", 80.0, [1]),
        ("Comedy", 90.0, [2]),
    ])
    _sign_in(http, "fallback@example.com")
    _save_rating(http, ids["Action"], 5)
    for genres, no_match in (([], False), ([3], True)):
        if genres:
            _save_preferences(http, genres)
        response = http.get("/api/me/recommendations")
        assert response.status_code == 200
        assert response.json()["data"]["mode"] == "popular"
        assert response.json()["data"]["noMatch"] is no_match
        assert [movie["title"] for movie in response.json()["data"]["movies"]] == [
            "Comedy", "Action"
        ]
        assert all(
            not {"ratingAdjustment", "adjustedScore", "basis"}.intersection(movie)
            for movie in response.json()["data"]["movies"]
        )


def test_equal_adjusted_score_uses_title_then_internal_id(
    local_api: tuple[TestClient, sessionmaker[Session]],
) -> None:
    http, factory = local_api
    with factory() as session:
        upsert_genre(session, genre_id=1, name="Action")
        revision = create_catalogue_revision(session, provider="synthetic-test")
        ids = (
            "00000000-0000-0000-0000-000000000002",
            "00000000-0000-0000-0000-000000000001",
        )
        for source_id, movie_id in zip(("higher", "lower"), ids, strict=True):
            movie = upsert_catalogue_movie(
                session, catalogue_revision_id=revision.id,
                source="synthetic-test", source_id=source_id,
                title="Same title", popularity_score=80.0,
            )
            movie.id = movie_id
            replace_movie_genres(session, movie=movie, genre_ids=[1])
        activate_catalogue_revision(session, revision_id=revision.id)
        session.commit()
    _sign_in(http, "tie@example.com")
    _save_preferences(http, [1])
    response = http.get("/api/me/recommendations")
    assert [movie["id"] for movie in response.json()["data"]["movies"]] == [
        ids[1], ids[0]
    ]
    assert all(movie["basis"] == "baseline" for movie in response.json()["data"]["movies"])
