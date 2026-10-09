"""S3-T01: genre catalogue and current-account preference reads."""

from __future__ import annotations

from collections.abc import Iterator

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
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}
ACTION = {"id": 28, "name": "Action"}
COMEDY = {"id": 35, "name": "Comedy"}
DRAMA = {"id": 18, "name": "Drama"}


@pytest.fixture
def database_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, autoflush=False, autocommit=False)()

    def override_get_db() -> Iterator[Session]:
        yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield session
    finally:
        app.dependency_overrides.clear()
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def _activate_catalogue(session: Session) -> None:
    """Activate a catalogue where Drama exists but only an inactive movie uses it."""

    for genre in (ACTION, COMEDY, DRAMA):
        upsert_genre(session, genre_id=genre["id"], name=genre["name"])

    old = create_catalogue_revision(session, provider="seed")
    retired = upsert_catalogue_movie(
        session,
        catalogue_revision_id=old.id,
        source="seed",
        source_id="retired",
        title="Retired",
    )
    replace_movie_genres(session, movie=retired, genre_ids=[DRAMA["id"]])

    active = create_catalogue_revision(session, provider="seed")
    for source_id, title, genre_ids in (
        ("one", "Alpha", [COMEDY["id"], ACTION["id"]]),
        ("two", "Beta", [ACTION["id"]]),
    ):
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=active.id,
            source="seed",
            source_id=source_id,
            title=title,
            popularity_score=1.0,
        )
        replace_movie_genres(session, movie=movie, genre_ids=genre_ids)
    activate_catalogue_revision(session, revision_id=active.id)
    session.commit()


def _sign_in(email: str) -> tuple[TestClient, str]:
    http = TestClient(app)
    registered = http.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert registered.status_code == 201
    login = http.post(
        "/api/auth/login",
        json={"email": email, "password": PASSWORD},
        headers=HEADERS,
    )
    assert login.status_code == 200
    return http, login.json()["data"]["user"]["id"]


def _save(session: Session, user_id: str, *genre_ids: int) -> None:
    session.add_all(
        UserGenrePreference(user_id=user_id, genre_id=genre_id)
        for genre_id in genre_ids
    )
    session.commit()


@pytest.mark.parametrize("path", ["/api/genres", "/api/me/preferences"])
def test_visitor_without_a_session_is_rejected(
    database_session: Session, path: str
) -> None:
    _activate_catalogue(database_session)

    response = TestClient(app).get(path)

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["error"]["message"] == "Authentication required"


@pytest.mark.parametrize("path", ["/api/genres", "/api/me/preferences"])
def test_revoked_session_is_rejected_before_any_read(
    database_session: Session, path: str
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("revoked@example.com")
    stale_cookie = dict(http.cookies)
    assert http.post("/api/auth/logout", headers=HEADERS).status_code == 204

    replay = TestClient(app, cookies=stale_cookie)

    assert replay.get(path).status_code == 401


def test_genres_lists_only_genres_used_by_the_active_catalogue(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("genres@example.com")

    response = http.get("/api/genres")

    assert response.status_code == 200
    # Sorted by name; Drama is excluded because only an inactive movie uses it.
    assert response.json() == {"data": {"genres": [ACTION, COMEDY]}}


def test_genres_without_an_active_catalogue_is_unavailable(
    database_session: Session,
) -> None:
    http, _ = _sign_in("nocatalogue@example.com")

    response = http.get("/api/genres")

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CATALOGUE_UNAVAILABLE"


def test_new_account_gets_an_empty_list_and_no_guest_identity(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    http, _ = _sign_in("fresh@example.com")

    response = http.get("/api/me/preferences")

    assert response.status_code == 200
    assert response.json() == {"data": {"genres": []}}
    assert database_session.scalar(select(func.count()).select_from(UserGenrePreference)) == 0


def test_known_account_reads_only_its_own_saved_genres(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    first, first_id = _sign_in("first@example.com")
    second, second_id = _sign_in("second@example.com")
    _save(database_session, first_id, COMEDY["id"], ACTION["id"])
    _save(database_session, second_id, DRAMA["id"])

    assert first.get("/api/me/preferences").json() == {
        "data": {"genres": [ACTION, COMEDY]}
    }
    assert second.get("/api/me/preferences").json() == {"data": {"genres": [DRAMA]}}


def test_client_supplied_identity_never_selects_the_account(
    database_session: Session,
) -> None:
    _activate_catalogue(database_session)
    viewer, viewer_id = _sign_in("viewer@example.com")
    _, other_id = _sign_in("other@example.com")
    _save(database_session, other_id, ACTION["id"])

    response = viewer.get(
        "/api/me/preferences",
        params={"userId": other_id, "user_id": other_id},
        headers={"X-User-Id": other_id},
    )

    assert viewer_id != other_id
    assert response.status_code == 200
    assert response.json() == {"data": {"genres": []}}
    assert set(response.json()["data"]) == {"genres"}
