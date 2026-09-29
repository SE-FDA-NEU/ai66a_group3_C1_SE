from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
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
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    database_session = local_session()

    def override_get_db() -> Iterator[Session]:
        yield database_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app), database_session
    finally:
        app.dependency_overrides.clear()
        database_session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _seed_active_movies(database_session: Session, count: int) -> list[str]:
    revision = create_catalogue_revision(database_session, provider="seed")
    action_genre = upsert_genre(database_session, genre_id=28, name="Action")
    movie_ids = []
    for index in range(count):
        movie = upsert_catalogue_movie(
            database_session,
            catalogue_revision_id=revision.id,
            source="seed",
            source_id=f"movie-{index}",
            title=f"Movie {index:02d}",
            release_year=2000 + index,
            overview=f"Overview {index}",
            popularity_score=float(count - index),
        )
        replace_movie_genres(
            database_session, movie=movie, genre_ids=[action_genre.id]
        )
        movie_ids.append(movie.id)
    activate_catalogue_revision(database_session, revision_id=revision.id)
    database_session.commit()
    return movie_ids


def test_list_movies_defaults_to_ten_deterministic_items(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    movie_ids = _seed_active_movies(database_session, count=12)

    response = http.get("/api/movies")

    assert response.status_code == 200
    body = response.json()
    assert [movie["id"] for movie in body["data"]["movies"]] == movie_ids[:10]
    assert body["meta"] == {
        "count": 10,
        "limit": 10,
        "catalogueRevision": body["meta"]["catalogueRevision"],
    }
    assert body["data"]["movies"][0]["genres"] == [{"id": 28, "name": "Action"}]


def test_list_movies_limit_is_validated_between_one_and_ten(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _seed_active_movies(database_session, count=12)

    too_low = http.get("/api/movies?limit=0")
    too_high = http.get("/api/movies?limit=11")
    valid = http.get("/api/movies?limit=3")

    assert too_low.status_code == 400
    assert too_high.status_code == 400
    assert too_low.json()["error"]["code"] == "VALIDATION_ERROR"
    assert valid.status_code == 200
    assert len(valid.json()["data"]["movies"]) == 3


def test_list_movies_without_active_catalogue_is_unavailable(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client

    response = http.get("/api/movies")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"


def test_movie_detail_returns_genres_and_treats_missing_fields_as_null(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    revision = create_catalogue_revision(database_session, provider="seed")
    movie = upsert_catalogue_movie(
        database_session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="incomplete",
        title="Incomplete Movie",
        release_year=None,
        overview=None,
    )
    activate_catalogue_revision(database_session, revision_id=revision.id)
    database_session.commit()

    response = http.get(f"/api/movies/{movie.id}")

    assert response.status_code == 200
    detail = response.json()["data"]["movie"]
    assert detail["releaseYear"] is None
    assert detail["overview"] is None
    assert detail["genres"] == []


def test_unknown_movie_id_returns_404(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    _seed_active_movies(database_session, count=1)

    response = http.get("/api/movies/does-not-exist")

    assert response.status_code == 404
    assert response.json()["error"] == {
        "code": "MOVIE_NOT_FOUND",
        "message": "Movie not found",
        "requestId": response.json()["error"]["requestId"],
    }


def test_movie_detail_without_active_catalogue_is_unavailable(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client

    response = http.get("/api/movies/anything")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"
