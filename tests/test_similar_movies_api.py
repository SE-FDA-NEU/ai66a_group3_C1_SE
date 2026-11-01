"""S4-T07: shared-genre Similar ranking and its public API (synthetic, offline)."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, MovieGenre, User
from app.integrations.tmdb import TmdbClient
from app.main import app, get_db
from app.recommendations.overview_index import (
    IndexUnavailable,
    OverviewIndex,
    cosine_similarity,
    load_active_index,
    rebuild_active_index,
)
from app.recommendations.similar import SIMILAR_LIMIT, rank_similar_movies
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    upsert_genre,
)
from app.repositories.preferences import replace_user_preference_genres
from app.repositories.ratings import set_user_movie_rating
from app.repositories.users import create_user
from app.security.sessions import SESSION_COOKIE, create_session
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

ACTION, COMEDY, DRAMA = 1, 2, 3
SUMMARY_KEYS = {"id", "title", "releaseYear", "genres", "popularityScore", "posterUrl", "backdropUrl"}
INDEX_MESSAGE = "Search index is temporarily unavailable"

# (id, title, overview, popularity, genre ids). The source and A/B/C use an
# overview that makes the cosine order (A > B) differ from popularity order
# (C > B > A), so popularity alone cannot satisfy the expected sequence.
SOURCE = ("src", "Source", "astronaut rescue moon crew", 50.0, (ACTION,))
A = ("a", "Alpha", "astronaut rescue moon crew base", 10.0, (ACTION,))
B = ("b", "Bravo", "rescue ship crew", 90.0, (ACTION,))
C = ("c", "Charlie", None, 100.0, (ACTION,))


class Catalogue:
    def __init__(self, engine, index_path: Path) -> None:
        self.engine = engine
        self.index_path = index_path
        self.client = TestClient(app)

    def seed(self, *rows) -> None:
        with Session(self.engine) as session, session.begin():
            revision = create_catalogue_revision(session, provider="synthetic")
            for genre_id, name in ((ACTION, "Action"), (COMEDY, "Comedy"), (DRAMA, "Drama")):
                upsert_genre(session, genre_id=genre_id, name=name)
            for movie_id, title, overview, popularity, genres in rows:
                session.add(CatalogMovie(
                    id=movie_id, catalogue_revision_id=revision.id,
                    source="synthetic", source_id=f"tmdb-{movie_id}", title=title,
                    overview=overview, popularity_score=popularity,
                ))
                session.flush()
                session.add_all(
                    MovieGenre(movie_id=movie_id, genre_id=genre_id) for genre_id in genres
                )
            activate_catalogue_revision(session, revision_id=revision.id)

    def rebuild(self) -> None:
        with Session(self.engine) as session:
            rebuild_active_index(session, self.index_path)

    def update(self, movie_id: str, **fields) -> None:
        with Session(self.engine) as session, session.begin():
            movie = session.get(CatalogMovie, movie_id)
            for name, value in fields.items():
                setattr(movie, name, value)

    def similar(self, movie_id: str):
        return self.client.get(f"/api/movies/{movie_id}/similar")

    def ids(self, movie_id: str) -> list[str]:
        response = self.similar(movie_id)
        assert response.status_code == 200, response.text
        return [movie["id"] for movie in response.json()["data"]["movies"]]


@pytest.fixture
def catalogue(tmp_path, monkeypatch) -> Iterator[Catalogue]:
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'similar.db').as_posix()}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    index_path = tmp_path / "index.json"
    monkeypatch.setenv("NLP_INDEX_PATH", str(index_path))

    def override_get_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield Catalogue(engine, index_path)
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def _assert_index_error(response) -> None:
    assert response.status_code == 503, response.text
    error = response.json()["error"]
    assert error["code"] == "INDEX_UNAVAILABLE"
    assert error["message"] == INDEX_MESSAGE
    assert error["requestId"].startswith("req_")
    assert "data" not in response.json()
    assert "index.json" not in response.text and "Traceback" not in response.text


# --- ranking through the real route, real TF-IDF vectors -------------------


def test_usable_source_orders_cosine_then_appends_missing_text_candidate(catalogue):
    catalogue.seed(SOURCE, A, B, C)
    catalogue.rebuild()
    with Session(catalogue.engine) as session:
        index = load_active_index(session, catalogue.index_path)
    source_vector = index.vector_for("src")
    assert cosine_similarity(source_vector, index.vector_for("a")) > cosine_similarity(
        source_vector, index.vector_for("b")) > 0
    assert not index.has_usable_vector("c")

    assert catalogue.ids("src") == ["a", "b", "c"]


def test_missing_text_candidate_cannot_invert_relative_cosine_order(catalogue):
    catalogue.seed(SOURCE, A, B)
    catalogue.rebuild()
    assert catalogue.ids("src") == ["a", "b"]

    with Session(catalogue.engine) as session, session.begin():
        revision = session.get(CatalogMovie, "src").catalogue_revision_id
        session.add(CatalogMovie(
            id="c", catalogue_revision_id=revision, source="synthetic",
            source_id="tmdb-c", title="Charlie", overview="  ", popularity_score=100.0,
        ))
        session.flush()
        session.add(MovieGenre(movie_id="c", genre_id=ACTION))
    catalogue.rebuild()
    assert catalogue.ids("src") == ["a", "b", "c"]


@pytest.mark.parametrize("source_overview", [None, "", "   ", "the and of"])
def test_source_without_usable_vector_uses_popularity_title_id_for_all(
    catalogue, source_overview,
):
    catalogue.seed((*SOURCE[:2], source_overview, *SOURCE[3:]), A, B, C)
    catalogue.rebuild()
    assert catalogue.ids("src") == ["c", "b", "a"]


def test_usable_text_with_cosine_zero_precedes_missing_text(catalogue):
    unrelated = ("d", "Delta", "volcano jazz galaxy", 1.0, (ACTION,))
    catalogue.seed(SOURCE, A, B, C, unrelated)
    catalogue.rebuild()
    with Session(catalogue.engine) as session:
        index = load_active_index(session, catalogue.index_path)
    assert index.has_usable_vector("d")
    assert cosine_similarity(index.vector_for("src"), index.vector_for("d")) == 0

    assert catalogue.ids("src") == ["a", "b", "d", "c"]


def test_ties_use_popularity_with_null_last_then_title_then_id(catalogue):
    same = "astronaut rescue moon crew"
    catalogue.seed(
        SOURCE,
        ("x1", "Same", same, 50.0, (ACTION,)),
        ("x0", "Same", same, 50.0, (ACTION,)),
        ("x2", "Alpha tie", same, 50.0, (ACTION,)),
        ("x3", "No popularity", same, None, (ACTION,)),
        ("x4", "Most popular", same, 70.0, (ACTION,)),
        ("m1", "Missing B", None, None, (ACTION,)),
        ("m0", "Missing A", None, None, (ACTION,)),
        ("m2", "Missing popular", None, 5.0, (ACTION,)),
    )
    catalogue.rebuild()
    assert catalogue.ids("src") == ["x4", "x2", "x0", "x1", "x3"]

    # Dropping three overviews moves them behind the usable group, where the
    # same popularity/title/ID rule orders them ahead of m2 and the null ones.
    for movie_id in ("x4", "x2", "x0"):
        catalogue.update(movie_id, overview=None)
    catalogue.rebuild()
    assert catalogue.ids("src") == ["x1", "x3", "x4", "x2", "x0"]


def test_only_shared_genre_candidates_distinct_source_excluded_and_limited(catalogue):
    shared = "astronaut rescue moon"
    rows = [SOURCE[:4] + ((ACTION, COMEDY),)]
    rows += [(f"s{n}", f"Shared {n}", shared, float(n), (ACTION, COMEDY)) for n in range(7)]
    rows.append(("other", "Other genre", shared, 999.0, (DRAMA,)))
    rows.append(("nogenre", "No genre", shared, 998.0, ()))
    catalogue.seed(*rows)
    catalogue.rebuild()

    ids = catalogue.ids("src")
    assert len(ids) == SIMILAR_LIMIT == 5
    assert len(set(ids)) == 5
    assert "src" not in ids and "other" not in ids and "nogenre" not in ids
    # Two shared genres do not duplicate a candidate; identical cosine falls
    # back to descending popularity.
    assert ids == ["s6", "s5", "s4", "s3", "s2"]


def test_response_uses_public_summary_shape_and_opaque_ids(catalogue):
    catalogue.seed(SOURCE, A)
    catalogue.rebuild()
    response = catalogue.similar("src")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"data"} and set(body["data"]) == {"movies"}
    [movie] = body["data"]["movies"]
    assert set(movie) == SUMMARY_KEYS
    assert movie["id"] == "a" and movie["popularityScore"] == 10.0
    assert movie["genres"] == [{"id": ACTION, "name": "Action"}]
    assert "tmdb-a" not in response.text


# --- status codes and failure distinctions ---------------------------------


def test_unknown_source_is_404_even_when_the_index_is_missing(catalogue):
    catalogue.seed(SOURCE, A)
    response = catalogue.similar("missing-id")
    assert response.status_code == 404
    error = response.json()["error"]
    assert error["code"] == "MOVIE_NOT_FOUND" and error["requestId"].startswith("req_")


def test_movie_outside_the_active_revision_is_404(catalogue):
    catalogue.seed(SOURCE, A)
    catalogue.rebuild()
    with Session(catalogue.engine) as session, session.begin():
        revision = create_catalogue_revision(session, provider="synthetic")
        session.add(CatalogMovie(
            id="old", catalogue_revision_id=revision.id, source="synthetic",
            source_id="tmdb-old", title="Old", overview="astronaut rescue",
            popularity_score=1.0,
        ))
    assert catalogue.similar("old").status_code == 404


def test_no_active_catalogue_is_503_catalogue_unavailable(catalogue):
    response = catalogue.similar("src")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"


def test_source_without_eligible_candidates_is_successful_empty(catalogue):
    catalogue.seed(SOURCE, ("drama", "Drama", "astronaut rescue", 5.0, (DRAMA,)),
                   ("alone", "Alone", "astronaut", 1.0, (COMEDY,)),
                   ("bare", "Bare", "astronaut", 1.0, ()))
    catalogue.rebuild()
    for source in ("src", "bare"):
        response = catalogue.similar(source)
        assert response.status_code == 200
        assert response.json() == {"data": {"movies": []}}


def test_absent_stale_and_corrupt_index_are_errors_not_empty_or_fallback(catalogue):
    catalogue.seed(SOURCE, A, B, C)
    _assert_index_error(catalogue.similar("src"))

    catalogue.rebuild()
    assert catalogue.ids("src") == ["a", "b", "c"]

    catalogue.update("b", overview="Changed overview text")
    _assert_index_error(catalogue.similar("src"))
    catalogue.rebuild()
    assert catalogue.similar("src").status_code == 200

    raw = json.loads(catalogue.index_path.read_text(encoding="utf-8"))
    raw["vectors"][0]["astronaut"] = 900
    catalogue.index_path.write_text(json.dumps(raw), encoding="utf-8")
    _assert_index_error(catalogue.similar("src"))

    catalogue.index_path.write_text("{not-json", encoding="utf-8")
    _assert_index_error(catalogue.similar("src"))


def test_failed_index_is_503_even_when_the_source_has_no_overview(catalogue):
    catalogue.seed((*SOURCE[:2], None, *SOURCE[3:]), A, B, C)
    _assert_index_error(catalogue.similar("src"))
    catalogue.rebuild()
    assert catalogue.ids("src") == ["c", "b", "a"]


def test_media_only_update_keeps_the_index_ready(catalogue):
    catalogue.seed(SOURCE, A, B, C)
    catalogue.rebuild()
    catalogue.update("a", poster_path="/poster.jpg", backdrop_path="/backdrop.jpg")
    assert catalogue.ids("src") == ["a", "b", "c"]


# --- public contract -------------------------------------------------------


def test_route_is_registered_as_a_public_get_and_does_not_shadow_details(catalogue):
    paths = {
        (method, route.path)
        for route in app.routes if hasattr(route, "methods")
        for method in route.methods
    }
    assert ("GET", "/api/movies/{movie_id}/similar") in paths
    assert ("GET", "/api/movies/{movie_id}") in paths
    catalogue.seed(SOURCE, A)
    catalogue.rebuild()
    assert catalogue.client.get("/api/movies/src").status_code == 200
    assert catalogue.client.get("/api/movies/popular").status_code == 200


def test_response_is_identical_for_guest_and_signed_in_accounts(catalogue):
    catalogue.seed(SOURCE, A, B, C)
    catalogue.rebuild()
    guest = catalogue.similar("src")
    assert guest.status_code == 200

    with Session(catalogue.engine) as session, session.begin():
        account = create_user(session, email="reader@example.com", password="Correct-Horse-9")
        replace_user_preference_genres(session, user_id=account.id, genre_ids=[COMEDY])
        set_user_movie_rating(session, user_id=account.id, movie_id="b", rating=1)
        set_user_movie_rating(session, user_id=account.id, movie_id="a", rating=5)
        token = create_session(session, user=session.get(User, account.id))

    catalogue.client.cookies.set(SESSION_COOKIE, token)
    signed_in = catalogue.similar("src")
    assert signed_in.status_code == 200
    assert signed_in.json() == guest.json()
    text = guest.text
    for private in ("rating", "adjust", "basis", "reason", "reader@example.com"):
        assert private not in text


def test_similar_never_calls_the_network_or_tmdb(catalogue, monkeypatch):
    catalogue.seed(SOURCE, A, B, C)
    catalogue.rebuild()

    def forbidden(*_args, **_kwargs):
        raise AssertionError("Similar must read only the local database and index")

    monkeypatch.setattr(TmdbClient, "_get_json", forbidden)
    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", forbidden)
    assert catalogue.ids("src") == ["a", "b", "c"]


# --- pure comparator: exact score and tie boundaries -----------------------


def _movie(movie_id: str, title: str, popularity: float | None) -> CatalogMovie:
    return CatalogMovie(id=movie_id, title=title, popularity_score=popularity)


def _index(vectors: dict[str, dict[str, float]]) -> OverviewIndex:
    ids = tuple(vectors)
    return OverviewIndex(
        catalogue_revision="r", built_catalogue_revision="r", corpus_digest="d",
        config_fingerprint="c", document_count=sum(bool(v) for v in vectors.values()),
        movie_ids=ids, idf={}, vectors=tuple(vectors.values()),
        id_to_row={movie_id: row for row, movie_id in enumerate(ids)},
    )


def test_comparator_oracle_usable_source_is_a_b_c_and_missing_source_is_c_b_a():
    movies = [_movie("a", "A", 10.0), _movie("b", "B", 90.0), _movie("c", "C", 100.0)]
    # Cosines 0.8 and 0.4 for A and B against the unit source vector x.
    vectors = {
        "src": {"x": 1.0}, "a": {"x": 0.8, "y": 0.6}, "b": {"x": 0.4, "z": (1 - 0.16) ** 0.5},
        "c": {},
    }
    ranked = rank_similar_movies(_index(vectors), source=_movie("src", "S", 1.0), candidates=movies)
    assert [m.id for m in ranked] == ["a", "b", "c"]

    vectors["src"] = {}
    ranked = rank_similar_movies(_index(vectors), source=_movie("src", "S", 1.0), candidates=movies)
    assert [m.id for m in ranked] == ["c", "b", "a"]


def test_comparator_exact_ties_and_null_popularity_boundaries():
    vectors = {"src": {"x": 1.0}, **{k: {"x": 1.0} for k in ("p", "q", "r", "s", "t")}}
    candidates = [
        _movie("t", "Same", None),
        _movie("s", "Same", 5.0),
        _movie("r", "Same", 5.0),
        _movie("q", "Aardvark", 5.0),
        _movie("p", "Zulu", 6.0),
    ]
    ranked = rank_similar_movies(_index(vectors), source=_movie("src", "S", 0.0), candidates=candidates)
    assert [m.id for m in ranked] == ["p", "q", "r", "s", "t"]


def test_comparator_deduplicates_excludes_source_and_limits_after_grouping():
    vectors = {"src": {"x": 1.0}, "u1": {"x": 1.0}, "u2": {"x": 1.0}, "u3": {"x": 1.0},
               "u4": {"x": 1.0}, "m1": {}, "m2": {}}
    candidates = [_movie("src", "S", 99.0), _movie("m1", "M1", 99.0), _movie("m2", "M2", 98.0)]
    candidates += [_movie(f"u{n}", f"U{n}", float(n)) for n in (1, 2, 3, 4, 4, 1)]
    ranked = rank_similar_movies(_index(vectors), source=_movie("src", "S", 99.0), candidates=candidates)
    assert [m.id for m in ranked] == ["u4", "u3", "u2", "u1", "m1"]


def test_comparator_id_missing_from_index_is_an_index_error_not_missing_text():
    vectors = {"src": {"x": 1.0}, "a": {"x": 1.0}}
    with pytest.raises(IndexUnavailable):
        rank_similar_movies(_index(vectors), source=_movie("src", "S", 1.0),
                            candidates=[_movie("a", "A", 1.0), _movie("ghost", "G", 1.0)])
    with pytest.raises(IndexUnavailable):
        rank_similar_movies(_index({"a": {"x": 1.0}}), source=_movie("src", "S", 1.0),
                            candidates=[_movie("a", "A", 1.0)])
