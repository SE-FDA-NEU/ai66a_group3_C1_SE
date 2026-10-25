"""S4-T12: local watchlist, profile summary and account isolation."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from app.db.models import CatalogueState, UserMovieWatchlist
from app.repositories.movies import upsert_catalogue_movie
from fastapi.testclient import TestClient
from sqlalchemy import event, select, update
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from test_profile_reset_api import HEADERS, _lose_session

pytest_plugins = ["test_profile_reset_api"]


def _client(state: dict[str, object], account: str) -> TestClient:
    client = state[account]
    assert isinstance(client, TestClient)
    return client


def _rows(session: Session, user_id: str) -> list[tuple[str, datetime]]:
    with Session(session.get_bind()) as fresh:
        return list(fresh.execute(select(UserMovieWatchlist.movie_id, UserMovieWatchlist.added_at)
                                  .where(UserMovieWatchlist.user_id == user_id)
                                  .order_by(UserMovieWatchlist.movie_id)))


def test_profile_summary_and_reset_preserve_both_watchlists(database_session, profile_state):
    state = profile_state
    a, b = _client(state, "account_a"), _client(state, "account_b")
    movie = state["action_movie"]
    assert a.put(f"/api/me/watchlist/{movie}", headers=HEADERS).status_code == 200
    assert b.put(f"/api/me/watchlist/{movie}", headers=HEADERS).status_code == 200
    assert a.get("/api/me/profile").json() == {"data": {
        "genres": [{"id": 28, "name": "Action"}, {"id": 35, "name": "Comedy"},
                   {"id": 878, "name": "Science Fiction"}],
        "ratingCount": 2, "watchlistCount": 1,
    }}
    assert b.get("/api/me/profile").json()["data"]["ratingCount"] == 1
    assert a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS).json() == {"data": {"reset": True}}
    assert a.get("/api/me/profile").json()["data"] == {
        "genres": [], "ratingCount": 0, "watchlistCount": 1,
    }
    assert b.get("/api/me/profile").json()["data"]["watchlistCount"] == 1
    assert a.get("/api/me/watchlist").json()["meta"]["total"] == 1
    assert b.get("/api/me/watchlist").json()["meta"]["total"] == 1


def test_add_remove_idempotent_and_account_scoped(database_session, profile_state):
    state = profile_state
    a, b = _client(state, "account_a"), _client(state, "account_b")
    movie = state["comedy_movie"]
    path = f"/api/me/watchlist/{movie}"
    assert a.get(path).json() == {"data": {"movieId": movie, "inWatchlist": False, "addedAt": None}}
    first = a.put(path, headers=HEADERS)
    assert first.status_code == 200
    assert first.json()["data"]["addedAt"].endswith("Z")
    assert a.put(path, headers=HEADERS).json() == first.json()
    assert len(_rows(database_session, state["user_a"])) == 1
    assert b.get(path).json()["data"]["inWatchlist"] is False
    assert b.put(path, headers=HEADERS).status_code == 200
    assert a.delete(path, headers=HEADERS).json() == {"data": {"movieId": movie, "inWatchlist": False}}
    assert a.delete(path, headers=HEADERS).status_code == 200
    assert b.get(path).json()["data"]["inWatchlist"] is True
    assert a.get("/api/me/watchlist").json()["data"]["movies"] == []


@pytest.mark.parametrize("suffix,method,body", [
    ("?userId=other", "put", None),
    ("?accountId=other", "get", None),
    ("", "put", {"userId": "other"}),
])
def test_forged_selectors_rejected_without_mutation(database_session, profile_state, suffix, method, body):
    state = profile_state
    a = _client(state, "account_a")
    path = f"/api/me/watchlist/{state['action_movie']}{suffix}"
    response = getattr(a, method)(path, headers=HEADERS, **({"json": body} if body else {}))
    assert response.status_code == 400
    assert a.get("/api/me/profile?userId=other").status_code == 400
    assert _rows(database_session, state["user_a"]) == []


@pytest.mark.parametrize("path", ["/api/me/profile", "/api/me/watchlist", "/api/me/watchlist/unknown"])
def test_unsigned_reads_return_401(path):
    from app.main import app
    with TestClient(app) as anonymous:
        assert anonymous.get(path).status_code == 401


@pytest.mark.parametrize("state", ["invalid", "expired", "revoked"])
def test_invalid_session_cannot_read_or_write_watchlist(database_session, profile_state, state):
    account = _client(profile_state, "account_a")
    user_id = profile_state["user_a"]
    movie_id = profile_state["action_movie"]
    _lose_session(account, database_session, user_id, state)
    assert account.get("/api/me/profile").status_code == 401
    assert account.get("/api/me/watchlist").status_code == 401
    assert account.get(f"/api/me/watchlist/{movie_id}").status_code == 401
    assert account.put(f"/api/me/watchlist/{movie_id}", headers=HEADERS).status_code == 401
    assert account.delete(f"/api/me/watchlist/{movie_id}", headers=HEADERS).status_code == 401
    assert _rows(database_session, user_id) == []


def test_invalid_paging_unknown_movie_and_origin(database_session, profile_state):
    state = profile_state
    a = _client(state, "account_a")
    for query in ("page=0", "page=10001", "limit=11", "limit=bad", "userId=other"):
        assert a.get(f"/api/me/watchlist?{query}").status_code == 400
    assert a.put("/api/me/watchlist/unknown", headers=HEADERS).status_code == 404
    assert a.delete("/api/me/watchlist/unknown", headers=HEADERS).status_code == 404
    assert a.put(f"/api/me/watchlist/{state['action_movie']}",
                 headers={"Origin": "https://attacker.example"}).status_code == 403
    assert _rows(database_session, state["user_a"]) == []


def test_list_order_paging_and_reset_failure_rollback(database_session, profile_state):
    state = profile_state
    a = _client(state, "account_a")
    revision = database_session.scalar(select(CatalogueState.active_revision_id))
    assert isinstance(revision, str)
    movie_ids = []
    for index in range(11):
        movie = upsert_catalogue_movie(database_session, catalogue_revision_id=revision,
                                       source="test", source_id=f"extra-{index}", title=f"Extra {index}")
        movie_ids.append(movie.id)
    database_session.commit()
    for movie_id in movie_ids:
        assert a.put(f"/api/me/watchlist/{movie_id}", headers=HEADERS).status_code == 200
    # Force a timestamp tie to verify the stable internal-ID tiebreaker.
    database_session.execute(update(UserMovieWatchlist).where(
        UserMovieWatchlist.user_id == state["user_a"]
    ).values(added_at=datetime(2026, 10, 24, 9, tzinfo=UTC)))
    database_session.commit()
    first = a.get("/api/me/watchlist?page=1&limit=10").json()
    second = a.get("/api/me/watchlist?page=2&limit=10").json()
    assert first["meta"]["total"] == 11
    assert first["meta"]["totalPages"] == 2
    assert len(first["data"]["movies"]) == 10
    assert len(second["data"]["movies"]) == 1
    assert [movie["id"] for movie in first["data"]["movies"] + second["data"]["movies"]] == sorted(movie_ids)
    assert a.get("/api/me/watchlist?page=3&limit=10").json()["data"]["movies"] == []
    assert a.get("/api/me/watchlist?catalogueRevision=stale").status_code == 409

    before = _rows(database_session, state["user_a"])
    engine = database_session.get_bind()

    def fail_rating_delete(_conn, _cursor, statement, _params, _context, _many):
        if statement.startswith("DELETE FROM user_movie_ratings"):
            raise OperationalError(statement, {}, Exception("injected"))

    event.listen(engine, "before_cursor_execute", fail_rating_delete)
    try:
        assert a.post("/api/me/profile/reset", json={"confirm": True}, headers=HEADERS).status_code == 503
    finally:
        event.remove(engine, "before_cursor_execute", fail_rating_delete)
    assert _rows(database_session, state["user_a"]) == before
    assert a.get("/api/me/profile").json()["data"]["ratingCount"] == 2


def test_watchlist_db_failure_does_not_claim_success(database_session, profile_state):
    state = profile_state
    a = _client(state, "account_a")
    path = f"/api/me/watchlist/{state['action_movie']}"
    engine = database_session.get_bind()

    def fail_insert(_conn, _cursor, statement, _params, _context, _many):
        if statement.startswith("INSERT INTO user_movie_watchlist"):
            raise OperationalError(statement, {}, Exception("injected"))

    event.listen(engine, "before_cursor_execute", fail_insert)
    try:
        response = a.put(path, headers=HEADERS)
    finally:
        event.remove(engine, "before_cursor_execute", fail_insert)
    assert response.status_code == 503
    assert _rows(database_session, state["user_a"]) == []
    assert a.get(path).json()["data"]["inWatchlist"] is False


def test_watchlist_commit_failure_rolls_back(database_session, profile_state, monkeypatch):
    state = profile_state
    a = _client(state, "account_a")
    path = f"/api/me/watchlist/{state['action_movie']}"

    def fail_commit():
        raise OperationalError("COMMIT", {}, Exception("injected"))

    monkeypatch.setattr(database_session, "commit", fail_commit)
    assert a.put(path, headers=HEADERS).status_code == 503
    assert _rows(database_session, state["user_a"]) == []
    assert a.get(path).json()["data"]["inWatchlist"] is False


def test_failed_delete_keeps_previous_membership(database_session, profile_state):
    state = profile_state
    a = _client(state, "account_a")
    path = f"/api/me/watchlist/{state['action_movie']}"
    assert a.put(path, headers=HEADERS).status_code == 200
    before = _rows(database_session, state["user_a"])
    engine = database_session.get_bind()

    def fail_delete(_conn, _cursor, statement, _params, _context, _many):
        if statement.startswith("DELETE FROM user_movie_watchlist"):
            raise OperationalError(statement, {}, Exception("injected"))

    event.listen(engine, "before_cursor_execute", fail_delete)
    try:
        assert a.delete(path, headers=HEADERS).status_code == 503
    finally:
        event.remove(engine, "before_cursor_execute", fail_delete)
    assert _rows(database_session, state["user_a"]) == before
    assert a.get(path).json()["data"]["inWatchlist"] is True
