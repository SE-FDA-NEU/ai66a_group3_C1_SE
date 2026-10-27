"""Offline API/SQLite acceptance for title-first and TF-IDF movie search."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie
from app.main import app, get_db
from app.recommendations.overview_index import cosine_similarity, rebuild_active_index
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    upsert_catalogue_movie,
)
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def search_client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, Session, Path]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False)()
    path = tmp_path / "overview-index.json"
    monkeypatch.setenv("NLP_INDEX_PATH", str(path))
    app.dependency_overrides[get_db] = lambda: session
    try:
        with TestClient(app) as http:
            yield http, session, path
    finally:
        app.dependency_overrides.clear()
        session.close()
        engine.dispose()


def seed_movies(session: Session, rows: list[tuple[str, str | None]]) -> list[str]:
    revision = create_catalogue_revision(session, provider="synthetic")
    ids = []
    for number, (title, overview) in enumerate(rows):
        movie = upsert_catalogue_movie(
            session, catalogue_revision_id=revision.id,
            source="synthetic", source_id=str(number),
            title=title, overview=overview, popularity_score=float(number),
        )
        ids.append(movie.id)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    return ids


@pytest.mark.parametrize("query", [None, "", " ", "a", " a ", " 🎬 "])
def test_search_rejects_queries_shorter_than_two_trimmed_characters(search_client, query):
    http, _, _ = search_client
    response = http.get("/api/movies/search", params={} if query is None else {"q": query})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["message"] == "Enter at least 2 characters"
    assert response.json()["error"]["requestId"].startswith("req_")


def test_title_hits_are_public_literal_case_insensitive_and_skip_missing_index(search_client):
    http, session, path = search_client
    inception, literal, wildcard, backslash = seed_movies(session, [
        ("Inception", "astronaut rescue moon"),
        ("100%_Real", "unrelated"),
        ("100xxReal", "unrelated"),
        (r"Path\_Name", None),
    ])
    assert not path.exists()
    response = http.get("/api/movies/search", params={"q": "  inCEPTION  "})
    assert response.status_code == 200
    assert [movie["id"] for movie in response.json()["data"]["movies"]] == [inception]
    assert set(response.json()) == {"data", "meta"}
    assert set(response.json()["data"]["movies"][0]) == {
        "id", "title", "releaseYear", "genres", "popularityScore", "posterUrl", "backdropUrl"
    }
    assert [movie["id"] for movie in http.get(
        "/api/movies/search", params={"q": "%_"}
    ).json()["data"]["movies"]] == [literal]
    assert [movie["id"] for movie in http.get(
        "/api/movies/search", params={"q": r"\_"}
    ).json()["data"]["movies"]] == [backslash]
    assert wildcard not in (literal, backslash)
    assert http.get("/api/movies/search").status_code == 400


@pytest.mark.parametrize(("field", "value"), [
    ("page", "0"), ("page", "10001"), ("page", "1.5"), ("page", "bad"),
    ("limit", "0"), ("limit", "11"), ("limit", "1.5"),
])
def test_search_rejects_invalid_pagination(search_client, field, value):
    http, _, _ = search_client
    response = http.get("/api/movies/search", params={"q": "match", field: value})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_all_search_pages_have_no_gaps_and_detect_snapshot_changes(search_client):
    http, session, path = search_client
    ids = seed_movies(session, [(f"Title {i:02d}", None) for i in range(27)])
    found = []
    for page in range(1, 5):
        response = http.get("/api/movies/search", params={"q": "TITLE", "page": page})
        assert response.status_code == 200
        body = response.json()
        found.extend(row["id"] for row in body["data"]["movies"])
        assert body["meta"]["total"] == 27
        assert body["meta"]["totalPages"] == 3
    assert found == ids and len(set(found)) == 27
    assert not path.exists()  # Out-of-range title pages must not invoke NLP fallback.
    stale = http.get("/api/movies/search", params={"q": "TITLE", "page": 2,
                                                   "catalogueRevision": "retired"})
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "CATALOGUE_CHANGED"


def test_description_cosine_order_is_global_across_all_pages(search_client):
    http, session, path = search_client
    ids = seed_movies(session, [(f"Film {i:02d}", "orbital rescue" if i % 2 else
                                "orbital rescue detective city") for i in range(25)] +
                      [("Unrelated", "cooking dinner")])
    index = rebuild_active_index(session, path)
    vector = index.transform_query("orbital rescue")
    expected = sorted(ids[:-1], key=lambda movie_id: (
        -cosine_similarity(vector, index.vector_for(movie_id)), ids.index(movie_id)))
    actual = []
    for page in (1, 2, 3):
        response = http.get("/api/movies/search", params={"q": "orbital rescue", "page": page})
        assert response.status_code == 200
        assert response.json()["meta"]["total"] == 25
        actual.extend(row["id"] for row in response.json()["data"]["movies"])
    assert actual == expected and len(set(actual)) == 25


def test_title_hits_take_precedence_and_paginate_the_full_set(search_client):
    http, session, path = search_client
    rows = [(f"Match {number:02d}", "astronaut rescue moon")
            for number in range(12)]
    ids = seed_movies(session, rows)
    assert not path.exists()
    response = http.get("/api/movies/search", params={"q": "MATCH"})
    assert response.status_code == 200
    found = response.json()["data"]["movies"]
    assert [movie["id"] for movie in found] == ids[:10]
    assert len({movie["id"] for movie in found}) == 10
    assert response.json()["meta"]["total"] == 12
    assert response.json()["meta"]["totalPages"] == 2
    next_page = http.get("/api/movies/search", params={
        "q": "MATCH" if not path.exists() else "orbital rescue", "page": 2,
        "catalogueRevision": response.json()["meta"]["catalogueRevision"],
    })
    assert next_page.status_code == 200
    assert [movie["id"] for movie in next_page.json()["data"]["movies"]] == ids[10:]
    assert next_page.json()["meta"]["count"] == 2


def test_title_ties_use_opaque_id_after_case_insensitive_title(search_client):
    http, session, _ = search_client
    revision = create_catalogue_revision(session, provider="synthetic")
    session.add_all([
        CatalogMovie(id="id-z", catalogue_revision_id=revision.id,
                     source="synthetic", source_id="1", title="Echo"),
        CatalogMovie(id="id-a", catalogue_revision_id=revision.id,
                     source="synthetic", source_id="2", title="echo"),
    ])
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()
    response = http.get("/api/movies/search", params={"q": "ECHO"})
    assert response.status_code == 200
    assert [movie["id"] for movie in response.json()["data"]["movies"]] == [
        "id-a", "id-z"
    ]


def test_title_search_casefolds_unicode_without_needing_index(search_client):
    http, session, path = search_client
    city, coffee = seed_movies(session, [
        ("Straße Nights", None), ("CAFÉ Film", None),
    ])
    assert not path.exists()
    assert [movie["id"] for movie in http.get(
        "/api/movies/search", params={"q": "STRASSE"}
    ).json()["data"]["movies"]] == [city]
    assert [movie["id"] for movie in http.get(
        "/api/movies/search", params={"q": "café"}
    ).json()["data"]["movies"]] == [coffee]


def test_description_search_real_cosine_orders_two_positive_rows(search_client, monkeypatch):
    http, session, path = search_client
    moon, city, unrelated = seed_movies(session, [
        ("Moon Rescue", "An astronaut rescue mission on the moon"),
        ("City Robot", "A detective investigates a rescue in the city"),
        ("Quiet Drama", "A family meets for dinner"),
    ])
    index = rebuild_active_index(session, path)
    vector = index.transform_query("astronaut rescue moon")
    scores = {movie_id: cosine_similarity(vector, index.vector_for(movie_id))
              for movie_id in (moon, city, unrelated)}
    assert scores[moon] > scores[city] > 0
    assert scores[unrelated] == 0
    print(f"Two-positive fixture cosine scores: {scores}")

    def forbidden_fit(_snapshot):
        raise AssertionError("search must load the fitted index, never refit")

    monkeypatch.setattr("app.recommendations.overview_index._fit", forbidden_fit)
    response = http.get("/api/movies/search", params={"q": "astronaut rescue moon"})
    assert response.status_code == 200
    assert [movie["id"] for movie in response.json()["data"]["movies"]] == [moon, city]
    assert unrelated not in [movie["id"] for movie in response.json()["data"]["movies"]]


def test_zero_scores_are_excluded_without_popular_fallback(search_client):
    http, session, path = search_client
    moon, city = seed_movies(session, [
        ("Moon Rescue", "An astronaut rescue mission on the moon"),
        ("City Robot", "A detective investigates a theft"),
    ])
    index = rebuild_active_index(session, path)
    vector = index.transform_query("astronaut rescue moon")
    assert cosine_similarity(vector, index.vector_for(moon)) > 0
    assert cosine_similarity(vector, index.vector_for(city)) == 0
    related = http.get("/api/movies/search", params={"q": "astronaut rescue moon"})
    assert [movie["id"] for movie in related.json()["data"]["movies"]] == [moon]
    assert city not in [movie["id"] for movie in related.json()["data"]["movies"]]
    unrelated = http.get("/api/movies/search", params={"q": "volcano jazz galaxy"})
    assert unrelated.status_code == 200
    assert unrelated.json()["data"] == {"movies": []}
    assert unrelated.json()["meta"]["total"] == 0


@pytest.mark.parametrize("query", ["%", "_", " % ", " _ "])
def test_single_literal_wildcards_obey_short_query_validation(search_client, query):
    http, session, _ = search_client
    seed_movies(session, [("Inception", "dream"), ("100%_Real", "dream")])
    response = http.get("/api/movies/search", params={"q": query})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Enter at least 2 characters"


@pytest.mark.parametrize("query", ["%%", "__", "in%", "in_"])
def test_valid_literal_wildcards_do_not_expand_to_unrelated_rows(search_client, query):
    http, session, path = search_client
    seed_movies(session, [("Inception", "dream"), ("Inside", "dream")])
    rebuild_active_index(session, path)
    response = http.get("/api/movies/search", params={"q": query})
    assert response.status_code == 200
    assert response.json()["data"] == {"movies": []}
    assert response.json()["meta"]["total"] == 0


def test_valid_empty_catalogue_returns_empty_success(search_client):
    http, session, path = search_client
    seed_movies(session, [])
    rebuild_active_index(session, path)
    response = http.get("/api/movies/search", params={"q": "astronaut rescue moon"})
    assert response.status_code == 200
    assert response.json()["data"] == {"movies": []}
    assert response.json()["meta"]["total"] == 0


def test_static_search_route_never_looks_up_a_movie_id(search_client, monkeypatch):
    http, session, _ = search_client
    seed_movies(session, [("Inception", "dream")])

    def forbidden_detail(*_args, **_kwargs):
        raise AssertionError("static search must not look up a movie ID")

    monkeypatch.setattr("app.main.get_active_movie_by_id", forbidden_detail)
    assert http.get("/api/movies/search", params={"q": "inception"}).status_code == 200
    assert http.get("/api/movies/search").status_code == 400


def test_index_failure_recovers_after_rebuild_using_same_query(search_client):
    http, session, path = search_client
    (moon,) = seed_movies(session, [("Moon Rescue", "astronaut rescue moon")])
    query = {"q": "astronaut rescue moon"}
    assert http.get("/api/movies/search", params=query).status_code == 503
    assert http.get("/api/movies/search", params={"q": "moon"}).status_code == 200
    rebuild_active_index(session, path)
    recovered = http.get("/api/movies/search", params=query)
    assert recovered.status_code == 200
    assert [row["id"] for row in recovered.json()["data"]["movies"]] == [moon]


def test_description_search_ranks_the_full_set_before_pagination(search_client):
    http, session, path = search_client
    ids = seed_movies(session, [
        (f"Film {number:02d}", "orbital rescue") for number in range(12)
    ])
    rebuild_active_index(session, path)
    response = http.get("/api/movies/search", params={"q": "orbital rescue"})
    assert response.status_code == 200
    found = response.json()["data"]["movies"]
    assert [movie["id"] for movie in found] == ids[:10]
    assert len({movie["id"] for movie in found}) == 10
    assert response.json()["meta"]["total"] == 12
    assert response.json()["meta"]["totalPages"] == 2
    next_page = http.get("/api/movies/search", params={
        "q": "MATCH" if not path.exists() else "orbital rescue", "page": 2,
        "catalogueRevision": response.json()["meta"]["catalogueRevision"],
    })
    assert next_page.status_code == 200
    assert [movie["id"] for movie in next_page.json()["data"]["movies"]] == ids[10:]
    assert next_page.json()["meta"]["count"] == 2


def test_empty_vocabulary_is_valid_but_missing_stale_or_corrupt_index_is_error(search_client):
    http, session, path = search_client
    (movie_id,) = seed_movies(session, [("Silent Film", "the and")])
    missing = http.get("/api/movies/search", params={"q": "astronaut rescue"})
    assert missing.status_code == 503
    assert missing.json()["error"]["code"] == "INDEX_UNAVAILABLE"
    assert missing.json()["error"]["message"] == "Search index is temporarily unavailable"
    assert missing.json()["error"]["requestId"].startswith("req_")

    rebuild_active_index(session, path)
    empty = http.get("/api/movies/search", params={"q": "astronaut rescue"})
    assert empty.status_code == 200
    assert empty.json()["data"] == {"movies": []}
    assert empty.json()["meta"]["total"] == 0

    session.get(CatalogMovie, movie_id).overview = "Changed overview"
    session.commit()
    stale = http.get("/api/movies/search", params={"q": "astronaut rescue"})
    assert stale.status_code == 503
    assert stale.json()["error"]["code"] == "INDEX_UNAVAILABLE"
    title = http.get("/api/movies/search", params={"q": "silent"})
    assert title.status_code == 200
    assert title.json()["data"]["movies"][0]["id"] == movie_id

    rebuild_active_index(session, path)
    raw = json.loads(path.read_text(encoding="utf-8"))
    raw["vectors"][0]["changed"] = 10
    path.write_text(json.dumps(raw), encoding="utf-8")
    corrupt = http.get("/api/movies/search", params={"q": "astronaut rescue"})
    assert corrupt.status_code == 503
    assert corrupt.json()["error"]["code"] == "INDEX_UNAVAILABLE"


def test_no_catalogue_and_database_failure_have_distinct_errors(search_client, monkeypatch):
    http, session, _ = search_client
    no_catalogue = http.get("/api/movies/search", params={"q": "inception"})
    assert no_catalogue.status_code == 503
    assert no_catalogue.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"
    seed_movies(session, [("Inception", "dream")])

    def failed_query(*_args, **_kwargs):
        raise SQLAlchemyError("synthetic DB failure")

    monkeypatch.setattr("app.main.search_active_movie_titles", failed_query)
    failure = http.get("/api/movies/search", params={"q": "inception"})
    assert failure.status_code == 503
    assert failure.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
