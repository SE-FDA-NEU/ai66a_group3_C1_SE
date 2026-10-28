"""S4-T05 independent API/SQLite regression for S05a and S05b.

The shared fixture migrates a new database and forbids provider HTTP. These
assertions exercise actual rating writes and subsequent recommendation reads.
"""

from __future__ import annotations

from sqlalchemy import event, func, select
from sqlalchemy.exc import OperationalError
from test_p0_acceptance import account, error, save


def ranking_catalogue(details):
    from app.repositories.movies import (
        activate_catalogue_revision,
        create_catalogue_revision,
        replace_movie_genres,
        upsert_catalogue_movie,
    )

    with details.sessions() as db:
        revision = create_catalogue_revision(db, provider="s4-t05-rank-synthetic")
        ids = {}
        for key, title, score, genres in (
            ("comedy", "Alpha Comedy", 80, [35]),
            ("action", "Zulu Action", 80, [28]),
            ("source", "Action Signal", 1, [28]),
        ):
            movie = upsert_catalogue_movie(
                db,
                catalogue_revision_id=revision.id,
                source="s4-t05-rank",
                source_id=key,
                title=title,
                popularity_score=score,
            )
            replace_movie_genres(db, movie=movie, genre_ids=genres)
            ids[key] = movie.id
        activate_catalogue_revision(db, revision_id=revision.id)
        db.commit()
    return ids


def recommendation(http):
    result = http.get("/api/me/recommendations")
    assert result.status_code == 200, result.text
    return result.json()


def by_id(body):
    return {movie["id"]: movie for movie in body["data"]["movies"]}


def test_s05a_saved_value_replaces_one_row_and_invalid_write_preserves_it(details):
    from app.db.models import UserMovieRating

    ids = ranking_catalogue(details)
    a = account(details)
    b = account(details, "b@example.test")
    path = f"/api/me/ratings/{ids['source']}"
    assert a.get(path).json()["data"]["rating"] is None
    assert b.get(path).json()["data"]["rating"] is None
    for rating in (5, 1, 3, 0.5):
        result = a.put(path, json={"rating": rating})
        assert result.status_code == 200
        assert result.json()["data"]["rating"] == rating
        assert a.get(path).json()["data"]["rating"] == rating
    for rating in (0, 6, 1.25, "5"):
        error(a.put(path, json={"rating": rating}), 400, "VALIDATION_ERROR")
        assert a.get(path).json()["data"]["rating"] == 0.5
    with details.sessions() as db:
        assert db.scalar(select(func.count()).select_from(UserMovieRating)) == 1
    assert b.get(path).json()["data"]["rating"] is None
    assert len(recommendation(b)["data"]["movies"]) == 3  # Ratings are optional.


def test_s05a_failed_update_has_no_success_and_retry_commits(details):
    ids = ranking_catalogue(details)
    a = account(details)
    path = f"/api/me/ratings/{ids['source']}"
    assert a.put(path, json={"rating": 3}).status_code == 200
    interrupted = []

    def block_update(_connection, _cursor, statement, parameters, _context, _many):
        if "UPDATE user_movie_ratings" in statement:
            interrupted.append(statement)
            raise OperationalError(
                statement, parameters, Exception("private save fault")
            )

    event.listen(details.engine, "before_cursor_execute", block_update)
    try:
        failed = error(a.put(path, json={"rating": 5}), 503, "SERVICE_UNAVAILABLE")
    finally:
        event.remove(details.engine, "before_cursor_execute", block_update)
    assert interrupted
    assert "private save fault" not in str(failed)
    assert a.get(path).json()["data"]["rating"] == 3
    assert a.put(path, json={"rating": 5}).status_code == 200
    assert a.get(path).json()["data"]["rating"] == 5


def test_s05b_save_to_rerank_exact_scores_and_account_isolation(details):
    from app.db.models import CatalogMovie, UserMovieRating

    ids = ranking_catalogue(details)
    a, b = account(details), account(details, "b@example.test")
    for http in (a, b):
        assert save(http, [28, 35]).status_code == 200
    original_b = recommendation(b)
    baseline = recommendation(a)
    assert [m["title"] for m in baseline["data"]["movies"][:2]] == [
        "Alpha Comedy",
        "Zulu Action",
    ]
    path = f"/api/me/ratings/{ids['source']}"
    for rating, expected_score, expected_first in (
        (5, 81, ids["action"]),
        (1, 79, ids["comedy"]),
        (3, 80, ids["comedy"]),
    ):
        assert a.put(path, json={"rating": rating}).status_code == 200
        result = recommendation(a)
        rows = by_id(result)
        assert result["data"]["movies"][0]["id"] == expected_first
        assert rows[ids["action"]]["adjustedScore"] == expected_score
        assert rows[ids["action"]]["ratingAdjustment"] == expected_score - 80
        assert rows[ids["action"]]["popularityScore"] == 80
        assert rows[ids["comedy"]]["adjustedScore"] == 80
        assert rows[ids["comedy"]]["basis"] == "baseline"
        assert rows[ids["action"]]["basis"] == (
            "baseline" if rating == 3 else "rating_signals"
        )
        assert recommendation(b) == original_b
    assert [
        genre["id"] for genre in a.get("/api/me/preferences").json()["data"]["genres"]
    ] == [28, 35]
    with details.sessions() as db:
        assert db.get(CatalogMovie, ids["action"]).popularity_score == 80
        assert db.scalar(select(func.count()).select_from(UserMovieRating)) == 1


def test_s05b_rating_query_failure_is_truthful_and_core_failure_is_error(details):
    ids = ranking_catalogue(details)
    a = account(details)
    assert save(a, [28, 35]).status_code == 200
    assert (
        a.put(f"/api/me/ratings/{ids['source']}", json={"rating": 5}).status_code == 200
    )
    seen = []

    def interrupt(_connection, _cursor, statement, parameters, _context, _many):
        if "FROM user_movie_ratings" in statement:
            seen.append(statement)
            raise OperationalError(
                statement, parameters, Exception("private rating fault")
            )

    event.listen(details.engine, "before_cursor_execute", interrupt)
    try:
        fallback = recommendation(a)
    finally:
        event.remove(details.engine, "before_cursor_execute", interrupt)
    assert seen
    assert [m["title"] for m in fallback["data"]["movies"][:2]] == [
        "Alpha Comedy",
        "Zulu Action",
    ]
    assert all(
        m["basis"] == "rating_unavailable"
        and m["adjustedScore"] == m["popularityScore"]
        for m in fallback["data"]["movies"]
    )
    assert recommendation(a)["data"]["movies"][0]["id"] == ids["action"]

    from app import main

    original = main.get_active_catalogue_revision

    def core_fault(*args, **kwargs):
        raise OperationalError("synthetic catalogue read", None, None)

    main.get_active_catalogue_revision = core_fault
    try:
        error(a.get("/api/me/recommendations"), 503, "SERVICE_UNAVAILABLE")
    finally:
        main.get_active_catalogue_revision = original


def test_s05b_reset_reselection_removes_old_signal_preserves_b(details):
    ids = ranking_catalogue(details)
    a, b = account(details), account(details, "b@example.test")
    for http in (a, b):
        assert save(http, [28, 35]).status_code == 200
    source = f"/api/me/ratings/{ids['source']}"
    assert a.put(source, json={"rating": 5}).status_code == 200
    assert b.put(source, json={"rating": 1}).status_code == 200
    before_b = recommendation(b)
    assert recommendation(a)["data"]["movies"][0]["id"] == ids["action"]
    assert a.post("/api/me/profile/reset", json={"confirm": True}).status_code == 200
    after_reset = recommendation(a)
    assert after_reset["data"]["mode"] == "popular"
    assert all("adjustedScore" not in item for item in after_reset["data"]["movies"])
    assert save(a, [28, 35]).status_code == 200
    assert by_id(recommendation(a))[ids["action"]]["basis"] == "baseline"
    assert recommendation(b) == before_b
