from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    upsert_catalogue_movie,
)
from app.repositories.users import create_user
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def client() -> Iterator[tuple[TestClient, Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    local_session = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )
    database_session = local_session()

    create_user(
        database_session,
        email="viewer@example.com",
        password="movie123",
    )
    database_session.commit()

    def override_get_db() -> Iterator[Session]:
        yield database_session

    app.dependency_overrides[get_db] = override_get_db

    http = TestClient(app)

    try:
        yield http, database_session
    finally:
        http.close()
        app.dependency_overrides.clear()
        database_session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _login(http: TestClient) -> None:
    response = http.post(
        "/api/auth/login",
        json={
            "email": "viewer@example.com",
            "password": "movie123",
        },
    )

    assert response.status_code == 200


def test_popular_recommendations_rank_by_popularity_then_title_then_id(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _login(http)

    revision = create_catalogue_revision(
        database_session,
        provider="seed",
    )

    upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="c",
        title="Charlie",
        popularity_score=80.0,
    )

    upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="a",
        title="Alpha",
        popularity_score=90.0,
    )

    upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="b",
        title="Beta",
        popularity_score=80.0,
    )

    activate_catalogue_revision(
        database_session,
        revision_id=revision.id,
    )
    database_session.commit()

    response = http.get("/api/me/recommendations")

    assert response.status_code == 200

    body = response.json()

    assert [
        movie["title"]
        for movie in body["data"]["movies"]
    ] == [
        "Alpha",
        "Beta",
        "Charlie",
    ]

    assert body["data"]["mode"] == "popular"
    assert body["data"]["personalised"] is False
    assert body["data"]["noMatch"] is False


def test_popular_recommendations_use_id_as_final_tie_breaker(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _login(http)

    revision = create_catalogue_revision(
        database_session,
        provider="seed",
    )

    lower_id = "00000000-0000-0000-0000-000000000001"
    higher_id = "00000000-0000-0000-0000-000000000002"

    first = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="higher",
        title="Same title",
        popularity_score=80.0,
    )
    first.id = higher_id

    second = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="lower",
        title="Same title",
        popularity_score=80.0,
    )
    second.id = lower_id

    activate_catalogue_revision(
        database_session,
        revision_id=revision.id,
    )
    database_session.commit()

    response = http.get("/api/me/recommendations")

    assert response.status_code == 200

    ids = [
        movie["id"]
        for movie in response.json()["data"]["movies"]
    ]

    assert ids == [lower_id, higher_id]


def test_popular_recommendations_are_distinct_and_limited_to_ten(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _login(http)

    revision = create_catalogue_revision(
        database_session,
        provider="seed",
    )

    for index in range(12):
        upsert_catalogue_movie(
            database_session,
            catalogue_revision_id=revision.id,
            source="seed",
            source_id=f"movie-{index}",
            title=f"Movie {index:02d}",
            popularity_score=float(100 - index),
        )

    activate_catalogue_revision(
        database_session,
        revision_id=revision.id,
    )
    database_session.commit()

    response = http.get("/api/me/recommendations")

    assert response.status_code == 200

    movies = response.json()["data"]["movies"]
    movie_ids = [movie["id"] for movie in movies]

    assert len(movies) == 10
    assert len(set(movie_ids)) == 10
    assert response.json()["meta"]["count"] == 10
    assert response.json()["meta"]["limit"] == 10


def test_no_usable_popularity_returns_empty_recommendations(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _login(http)

    revision = create_catalogue_revision(
        database_session,
        provider="seed",
    )

    for index in range(3):
        upsert_catalogue_movie(
            database_session,
            catalogue_revision_id=revision.id,
            source="seed",
            source_id=f"unknown-{index}",
            title=f"Unknown popularity {index}",
            popularity_score=None,
        )

    activate_catalogue_revision(
        database_session,
        revision_id=revision.id,
    )
    database_session.commit()

    response = http.get("/api/me/recommendations")

    assert response.status_code == 200

    body = response.json()

    assert body["data"]["movies"] == []
    assert body["data"]["mode"] == "popular"
    assert body["data"]["personalised"] is False
    assert body["data"]["noMatch"] is False
    assert body["meta"]["count"] == 0


def test_recommendations_require_authentication(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client

    response = http.get("/api/me/recommendations")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == (
        "AUTHENTICATION_REQUIRED"
    )


def test_missing_active_catalogue_returns_catalogue_unavailable(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client
    _login(http)

    response = http.get("/api/me/recommendations")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == (
        "CATALOGUE_UNAVAILABLE"
    )


def test_recommendation_database_failure_returns_service_unavailable(
    client: tuple[TestClient, Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http, database_session = client
    _login(http)

    revision = create_catalogue_revision(
        database_session,
        provider="seed",
    )

    upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="movie",
        title="Movie",
        popularity_score=90.0,
    )

    activate_catalogue_revision(
        database_session,
        revision_id=revision.id,
    )
    database_session.commit()

    def _raise_database_error(
        *_args: object,
        **_kwargs: object,
    ) -> None:
        raise SQLAlchemyError("simulated database failure")

    monkeypatch.setattr(
        "app.main.list_popular_recommendation_movies",
        _raise_database_error,
    )

    response = http.get("/api/me/recommendations")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == (
        "SERVICE_UNAVAILABLE"
    )