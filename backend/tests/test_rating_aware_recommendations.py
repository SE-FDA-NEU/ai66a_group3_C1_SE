"""S4-T03 / S02: deterministic ranking through authenticated, offline SQLite reads."""

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, UserMovieRating
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
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

HEADERS = {"Origin": "http://testserver"}
PATH = "/api/me/recommendations"
PRIVATE_FIELDS = {"ratingAdjustment", "adjustedScore", "basis"}


@pytest.fixture
def database(tmp_path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Session]:
    engine = create_engine(
        f"sqlite+pysqlite:///{tmp_path / 'ranking.db'}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)

    def request_db():
        with Session(engine, autoflush=False) as session:
            yield session

    def forbid_network(*_args, **_kwargs):
        raise AssertionError("Ranking must use local data only")

    monkeypatch.setattr(TmdbClient, "_get_json", forbid_network)
    app.dependency_overrides[get_db] = request_db
    try:
        with Session(engine) as session:
            for gid in (1, 2, 3, 4):
                upsert_genre(session, genre_id=gid, name=f"Genre {gid}")
            revision = create_catalogue_revision(session, provider="synthetic-test")
            activate_catalogue_revision(session, revision_id=revision.id)
            session.commit()
            yield session
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def add_movie(database, title, score, genres):
    from app.repositories.movies import get_active_catalogue_revision

    revision = get_active_catalogue_revision(database)
    movie = upsert_catalogue_movie(
        database, catalogue_revision_id=revision.id, source="synthetic-test",
        source_id=title, title=title, popularity_score=score,
    )
    replace_movie_genres(database, movie=movie, genre_ids=genres)
    database.commit()
    return movie.id


def account(email="a@example.test", genres=(1, 2)):
    http = TestClient(app)
    assert http.post("/api/auth/register", json={
        "email": email, "password": "movie123",
    }).status_code == 201
    login = http.post("/api/auth/login", json={
        "email": email, "password": "movie123",
    }, headers=HEADERS)
    assert login.status_code == 200
    if genres:
        assert http.put("/api/me/preferences", json={"genreIds": list(genres)},
                        headers=HEADERS).status_code == 200
    return http, login.json()["data"]["user"]["id"]


def rate(http, movie_id, value):
    response = http.put(f"/api/me/ratings/{movie_id}", json={"rating": value},
                        headers=HEADERS)
    assert response.status_code == 200


def movies(http, query=""):
    response = http.get(PATH + query)
    assert response.status_code == 200, response.text
    return response.json()["data"]["movies"]


def seed_ties(database):
    add_movie(database, "Alpha Comedy", 80, [2])
    target = add_movie(database, "Zulu Action", 80, [1])
    source = add_movie(database, "Action Signal", 1, [1])
    return target, source


def test_five_star_related_rating_reorders_80_80(database):
    target, source = seed_ties(database)
    http, _ = account()
    assert [m["title"] for m in movies(http)][:2] == ["Alpha Comedy", "Zulu Action"]
    rate(http, source, 5)
    ranked = movies(http)
    # The RED assertion is real missing ordering, before checking additive fields.
    assert [m["title"] for m in ranked][:2] == ["Zulu Action", "Alpha Comedy"]
    assert ranked[0]["id"] == target
    assert ranked[0]["popularityScore"] == ranked[1]["popularityScore"] == 80
    assert {key: ranked[0][key] for key in PRIVATE_FIELDS} == {
        "ratingAdjustment": 1, "adjustedScore": 81, "basis": "rating_signals",
    }
    assert ranked[1]["adjustedScore"] == 80
    assert ranked[1]["ratingAdjustment"] == 0
    assert ranked[1]["basis"] == "baseline"


@pytest.mark.parametrize(("rating", "adjustment"), [(1, -1), (2, -1), (3, 0), (4, 1)])
def test_signs_neutral_and_current_saved_value(database, rating, adjustment):
    target, source = seed_ties(database)
    http, user_id = account()
    for value in (5, 5, rating, rating):
        rate(http, source, value)
    ranked = movies(http)
    row = next(m for m in ranked if m["id"] == target)
    assert row["ratingAdjustment"] == adjustment
    assert row["adjustedScore"] == 80 + adjustment
    assert row["basis"] == ("rating_signals" if adjustment else "baseline")
    assert ranked[0]["title"] == ("Zulu Action" if adjustment > 0 else "Alpha Comedy")
    with Session(database.get_bind()) as fresh:
        saved = list(fresh.scalars(select(UserMovieRating).where(
            UserMovieRating.user_id == user_id,
        )))
        assert len(saved) == 1 and saved[0].rating == rating
        assert fresh.get(CatalogMovie, target).popularity_score == 80


def test_neutral_90_80_handoff_keeps_baseline(database):
    import json
    from pathlib import Path

    fixture = json.loads((Path(__file__).parent / "fixtures" /
                          "s4_t02_ranking_handoff.json").read_text())["neutral90_80"]
    for row in fixture["candidates"]:
        add_movie(database, row["title"], row["popularityScore"], row["genreIds"])
    source = fixture["ratedSource"]
    source_id = add_movie(database, source["title"], source["popularityScore"],
                          source["genreIds"])
    http, _ = account()
    baseline = movies(http)
    rate(http, source_id, 3)
    assert movies(http) == baseline
    assert [m["title"] for m in baseline] == fixture["expectedOrderedTitles"]
    assert all(m["ratingAdjustment"] == 0 and m["basis"] == "baseline"
               for m in baseline)


def test_rank_whole_set_before_paging_and_view_filter(database):
    import json
    from pathlib import Path

    fixture = json.loads((Path(__file__).parent / "fixtures" /
                          "s4_t02_ranking_handoff.json").read_text())["wholeSet25"]
    for row in fixture["candidates"]:
        add_movie(database, row["title"], row["popularityScore"], row["genreIds"])
    source = fixture["ratedSource"]
    source_id = add_movie(database, source["title"], source["popularityScore"],
                          source["genreIds"])
    http, _ = account(genres=(1,))
    assert [m["title"] for m in movies(http)] == fixture["expectedBeforePage1"]
    rate(http, source_id, 5)
    pages = [http.get(PATH + f"?page={page}").json() for page in (1, 2, 3)]
    assert [[m["title"] for m in p["data"]["movies"]] for p in pages] == fixture[
        "expectedAfterPages"
    ]
    ids = [m["id"] for p in pages for m in p["data"]["movies"]]
    assert len(ids) == len(set(ids)) == 25
    assert source_id not in ids  # A highly rated ineligible source stays excluded.
    assert all(p["meta"]["total"] == p["meta"]["unfilteredTotal"] == 25 for p in pages)
    assert all(p["meta"]["totalPages"] == 3 for p in pages)
    filtered = http.get(PATH + "?genreId=2").json()
    assert [m["title"] for m in filtered["data"]["movies"]] == ["Target"]
    assert filtered["meta"]["total"] == 1
    assert filtered["meta"]["unfilteredTotal"] == 25
    assert movies(http, "?page=4") == []


def test_overlap_once_null_popularity_and_deterministic_ties(database):
    target = add_movie(database, "Shared", 80, [1, 2])
    source = add_movie(database, "Signal", 1, [1, 2])
    missing = add_movie(database, "A Missing", None, [1, 2])
    zero = add_movie(database, "Zero", 0, [3])
    same1 = add_movie(database, "Same", 80, [1])
    same2 = add_movie(database, "Same again", 80, [1])
    database.get(CatalogMovie, same2).title = "Same"
    database.commit()
    http, _ = account(genres=(1, 2, 3))
    rate(http, source, 5)
    ranked = movies(http)
    assert len(ranked) == len({m["id"] for m in ranked})
    assert [m["id"] for m in ranked if m["title"] == "Same"] == sorted([same1, same2])
    by_id = {m["id"]: m for m in ranked}
    assert by_id[target]["ratingAdjustment"] == 1
    assert by_id[source]["ratingAdjustment"] == 1  # Own rating also counts once.
    assert by_id[missing]["ratingAdjustment"] == 1
    assert by_id[missing]["popularityScore"] is None
    assert by_id[missing]["adjustedScore"] is None
    assert by_id[zero]["adjustedScore"] == 0
    assert ranked[-1]["id"] == missing


@pytest.mark.parametrize("stage", ["ratings", "catalogue", "preferences", "candidates", "auth"])
def test_only_rating_query_failure_degrades(database, stage):
    _, source = seed_ties(database)
    http, _ = account()
    rate(http, source, 5)
    failed = []

    def interrupt(_connection, _cursor, statement, parameters, _context, _many):
        matches = {
            "ratings": "FROM user_movie_ratings" in statement,
            "catalogue": "FROM catalogue_revisions JOIN catalogue_state" in statement,
            "preferences": "JOIN user_genre_preferences" in statement,
            "candidates": "FROM catalog_movies JOIN catalogue_state" in statement,
            "auth": "FROM auth_sessions" in statement,
        }
        if matches[stage]:
            failed.append(statement)
            raise OperationalError(statement, parameters, Exception("private db detail"))

    engine = database.get_bind()
    event.listen(engine, "before_cursor_execute", interrupt)
    try:
        response = http.get(PATH)
    finally:
        event.remove(engine, "before_cursor_execute", interrupt)
    assert failed, "The test must reach the actual failing query"
    assert "private db detail" not in response.text
    if stage == "ratings":
        assert response.status_code == 200
        ranked = response.json()["data"]["movies"]
        assert ranked[0]["title"] == "Alpha Comedy"
        assert all(m["ratingAdjustment"] == 0 and m["basis"] == "rating_unavailable"
                   and m["adjustedScore"] == m["popularityScore"] for m in ranked)
        assert movies(http)[0]["title"] == "Zulu Action"  # Next request retries.
    else:
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"


@pytest.mark.parametrize("genres", [(), (4,)])
def test_popular_fallbacks_keep_order_and_omit_private_scores(database, genres):
    _, source = seed_ties(database)
    http, _ = account(genres=genres)
    baseline = http.get(PATH).json()
    rate(http, source, 5)
    assert http.get(PATH).json() == baseline
    assert baseline["data"]["mode"] == "popular"
    assert baseline["data"]["personalised"] is False
    assert baseline["data"]["noMatch"] is bool(genres)
    assert [m["title"] for m in baseline["data"]["movies"]][:2] == [
        "Alpha Comedy", "Zulu Action",
    ]
    assert all(not PRIVATE_FIELDS.intersection(m) for m in baseline["data"]["movies"])


def test_account_isolation_reset_logout_switch_and_no_retargeting(database):
    _, source = seed_ties(database)
    a, a_id = account()
    b, b_id = account("b@example.test")
    rate(a, source, 5)
    rate(b, source, 1)
    assert movies(a)[0]["title"] == "Zulu Action"
    assert movies(b)[0]["title"] == "Alpha Comedy"
    retarget = a.request("GET", PATH + f"?userId={b_id}&accountId={b_id}",
                         headers={"X-User-Id": b_id, "X-Account-Id": b_id},
                         json={"userId": b_id})
    assert retarget.status_code == 200
    assert retarget.json()["data"]["movies"] == movies(a)
    before_b = movies(b)
    reset = a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS)
    assert reset.status_code == 200
    assert all(not PRIVATE_FIELDS.intersection(m) for m in movies(a))
    assert a.put("/api/me/preferences", json={"genreIds": [1, 2]},
                 headers=HEADERS).status_code == 200
    assert movies(a)[0]["title"] == "Alpha Comedy"
    assert all(m["basis"] == "baseline" for m in movies(a))
    assert movies(b) == before_b
    assert a.post("/api/auth/logout", headers=HEADERS).status_code == 204
    assert a.get(PATH).status_code == 401
    login = a.post("/api/auth/login", json={
        "email": "b@example.test", "password": "movie123",
    }, headers=HEADERS)
    assert login.status_code == 200 and login.json()["data"]["user"]["id"] != a_id
    assert movies(a) == before_b
    for cookies in ({}, {"ams_session": "invalid"}):
        visitor = TestClient(app, cookies=cookies)
        assert visitor.get(PATH).status_code == 401


def test_public_dtos_stay_free_of_private_fields(database):
    target, source = seed_ties(database)
    http, _ = account()
    rate(http, source, 5)
    visitor = TestClient(app)
    for path in ("/api/movies", "/api/movies/popular", f"/api/movies/{target}"):
        response = visitor.get(path)
        assert response.status_code == 200
        assert not any(f'"{key}"' in response.text for key in PRIVATE_FIELDS)
    # Search/Similar runtime belongs to other tasks; their shared public schemas
    # must remain free of private fields even before those routes are delivered.
    from app.schemas.movies import MovieDetailDto, MovieSummaryDto

    assert not PRIVATE_FIELDS.intersection(MovieSummaryDto.model_fields)
    assert not PRIVATE_FIELDS.intersection(MovieDetailDto.model_fields)
