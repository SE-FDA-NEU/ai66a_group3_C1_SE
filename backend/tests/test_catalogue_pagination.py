"""Post-M3 pagination contract: complete-set counts, filtering, and revisions."""

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    list_active_movies,
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


@pytest.mark.parametrize("genre_id", ["0", "abc", "2147483648", "9223372036854775808"])
def test_recommendation_genre_id_rejects_invalid_or_overflowing_values(client, genre_id):
    http, session = client
    seed(session, 1)
    assert http.post("/api/auth/login", json={
        "email": "pagination@example.com", "password": "movie123"
    }).status_code == 200
    response = http.get("/api/me/recommendations", params={"genreId": genre_id})
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == "genreId must be an integer from 1 to 2147483647"
    assert error["requestId"].startswith("req_")


def test_largest_allowed_genre_id_is_checked_as_unknown_without_overflow(client):
    http, session = client
    seed(session, 1)
    assert http.post("/api/auth/login", json={
        "email": "pagination@example.com", "password": "movie123"
    }).status_code == 200
    response = http.get("/api/me/recommendations", params={"genreId": "2147483647"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "GENRE_NOT_FOUND"


@pytest.mark.parametrize("count", [0, 1, 10, 11, 25, 255])
def test_home_title_desc_sorts_the_whole_catalogue_before_paging(client, count):
    http, session = client
    revision = seed(session, count)
    collected = []
    for page in range(1, max(1, (count + 9) // 10) + 1):
        response = http.get("/api/movies", params={
            "sort": "title_desc", "page": page, "catalogueRevision": revision,
        })
        assert response.status_code == 200
        body = response.json()
        collected.extend(body["data"]["movies"])
        assert body["meta"]["total"] == body["meta"]["unfilteredTotal"] == count
        assert body["meta"]["totalPages"] == (count + 9) // 10
        assert body["meta"]["page"] == page
        assert body["meta"]["count"] == len(body["data"]["movies"])
        assert body["meta"]["catalogueRevision"] == revision
    assert [movie["title"] for movie in collected] == [
        f"Movie {index:03d}" for index in reversed(range(count))
    ]
    assert len({movie["id"] for movie in collected}) == count


def test_home_sort_does_not_change_popular_order_or_revision_validation(client):
    http, session = client
    revision = seed(session, 25)
    popular = http.get("/api/movies/popular").json()
    descending = http.get("/api/movies", params={"sort": "title_desc"}).json()
    ascending = http.get("/api/movies", params={"sort": "title_asc"}).json()
    assert descending["data"]["movies"][0]["title"] == "Movie 024"
    assert ascending == http.get("/api/movies").json()
    assert http.get("/api/movies/popular").json() == popular
    replacement = create_catalogue_revision(session, provider="test")
    activate_catalogue_revision(session, revision_id=replacement.id)
    session.commit()
    stale = http.get("/api/movies", params={
        "sort": "title_desc", "catalogueRevision": revision,
    })
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "CATALOGUE_CHANGED"


def test_home_sort_has_deterministic_case_and_duplicate_title_ties(client):
    http, session = client
    revision = create_catalogue_revision(session, provider="test")
    for index, title in enumerate(("alpha", "Alpha", "Zulu", "Alpha"), start=1):
        movie = upsert_catalogue_movie(
            session, catalogue_revision_id=revision.id, source="test",
            source_id=str(index), title=title, popularity_score=None,
        )
        movie.id = f"00000000-0000-0000-0000-{index:012d}"
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    rows = http.get("/api/movies", params={"sort": "title_desc"}).json()["data"]["movies"]
    assert [row["title"] for row in rows] == ["Zulu", "alpha", "Alpha", "Alpha"]
    assert [row["id"] for row in rows[-2:]] == [
        "00000000-0000-0000-0000-000000000002",
        "00000000-0000-0000-0000-000000000004",
    ]
    assert all(row["popularityScore"] is None for row in rows)


@pytest.mark.parametrize("sort", ["title", "popularity", "TITLE_DESC", "", "title_desc; DROP TABLE catalog_movies"])
def test_home_sort_rejects_unsupported_values_without_changing_data(client, sort):
    http, session = client
    seed(session, 1)
    response = http.get("/api/movies", params={"sort": sort})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert http.get("/api/movies").json()["meta"]["total"] == 1


def test_home_repository_rejects_an_unknown_sort(client):
    _, session = client
    with pytest.raises(ValueError, match="sort"):
        list_active_movies(session, limit=10, sort="unknown")
