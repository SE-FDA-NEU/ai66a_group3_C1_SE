"""Post-M3 pagination contract: complete-set counts, filtering, and revisions."""

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
from app.repositories.users import create_user
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def client() -> Iterator[tuple[TestClient, Session]]:
    engine = create_engine("sqlite+pysqlite:///:memory:",
                           connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    create_user(session, email="pagination@example.com", password="movie123")
    session.commit()
    app.dependency_overrides[get_db] = lambda: session
    with TestClient(app) as http:
        yield http, session
    app.dependency_overrides.clear()
    session.close()
    engine.dispose()


def seed(session: Session, count: int) -> str:
    revision = create_catalogue_revision(session, provider="test")
    for index in range(count):
        upsert_catalogue_movie(
            session, catalogue_revision_id=revision.id, source="test",
            source_id=f"{index}", title=f"Movie {index:03d}",
            popularity_score=float(count - index),
        )
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    return revision.id


@pytest.mark.parametrize("count", [0, 1, 10, 11, 25, 255])
def test_public_pages_cover_the_complete_ranked_set(client, count):
    http, session = client
    seed(session, count)
    for endpoint in ("/api/movies", "/api/movies/popular"):
        ids = []
        pages = (count + 9) // 10
        for page in range(1, pages + 1):
            body = http.get(endpoint, params={"page": page}).json()
            ids.extend(movie["id"] for movie in body["data"]["movies"])
            assert body["meta"]["total"] == count
            assert body["meta"]["totalPages"] == pages
            assert body["meta"]["count"] == min(10, count - (page - 1) * 10)
        assert len(ids) == len(set(ids)) == count
        beyond = http.get(endpoint, params={"page": pages + 1}).json()
        assert beyond["data"]["movies"] == []
        assert beyond["meta"]["total"] == count
        assert beyond["meta"]["page"] == pages + 1


def test_home_alphabetical_popular_finite_and_revision_change(client):
    http, session = client
    revision = create_catalogue_revision(session, provider="test")
    for source, title, popularity in (
        ("z", "Zulu", 95.0), ("a", "alpha", 5.0), ("n", "No score", None)
    ):
        upsert_catalogue_movie(session, catalogue_revision_id=revision.id,
                               source="test", source_id=source, title=title,
                               popularity_score=popularity)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    home = http.get("/api/movies").json()
    popular = http.get("/api/movies/popular").json()
    assert [movie["title"] for movie in home["data"]["movies"]] == [
        "alpha", "No score", "Zulu"
    ]
    assert [movie["title"] for movie in popular["data"]["movies"]] == [
        "Zulu", "alpha"
    ]
    assert home["meta"]["total"] == 3
    assert popular["meta"]["total"] == 2
    replacement = create_catalogue_revision(session, provider="test")
    activate_catalogue_revision(session, revision_id=replacement.id)
    session.commit()
    stale = http.get("/api/movies", params={"catalogueRevision": revision.id})
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "CATALOGUE_CHANGED"


def test_recommendation_filter_uses_all_candidates_before_page_slice(client):
    http, session = client
    upsert_genre(session, genre_id=12, name="Drama")
    upsert_genre(session, genre_id=28, name="Action")
    upsert_genre(session, genre_id=27, name="Horror")
    revision = create_catalogue_revision(session, provider="test")
    for index in range(35):
        movie = upsert_catalogue_movie(
            session, catalogue_revision_id=revision.id, source="test",
            source_id=str(index), title=f"Movie {index:02d}",
            popularity_score=float(35 - index))
        replace_movie_genres(session, movie=movie,
                             genre_ids=[12, 28] if index >= 23 else [12])
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    assert http.post("/api/auth/login", json={
        "email": "pagination@example.com", "password": "movie123"
    }).status_code == 200
    assert http.put("/api/me/preferences", json={"genreIds": [12]}).status_code == 200
    unfiltered = http.get("/api/me/recommendations").json()
    assert unfiltered["meta"]["total"] == 35
    assert all(not any(genre["id"] == 28 for genre in movie["genres"])
               for movie in unfiltered["data"]["movies"])
    first = http.get("/api/me/recommendations", params={"genreId": 28}).json()
    second = http.get("/api/me/recommendations", params={"genreId": 28, "page": 2}).json()
    assert (first["meta"]["total"], first["meta"]["unfilteredTotal"]) == (12, 35)
    assert (len(first["data"]["movies"]), len(second["data"]["movies"])) == (10, 2)
    assert first["data"]["personalised"] and second["data"]["personalised"]
    empty = http.get("/api/me/recommendations", params={"genreId": 27}).json()
    assert empty["meta"]["total"] == 0
    assert empty["meta"]["unfilteredTotal"] == 35
    assert empty["data"]["personalised"] and not empty["data"]["noMatch"]
    out_of_range = http.get("/api/me/recommendations", params={"page": 8}).json()
    assert out_of_range["data"]["movies"] == []
    assert out_of_range["data"]["personalised"]
    assert out_of_range["meta"]["total"] == 35
    assert http.get("/api/me/recommendations", params={"genreId": 999}).status_code == 400
