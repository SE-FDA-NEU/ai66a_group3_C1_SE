"""Independent verification of the S3-T31 rating API."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.models import UserMovieRating
from app.main import app, get_db
from app.security.sessions import SESSION_COOKIE
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]

PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}


@pytest.fixture(scope="module")
def migrated_template(
    tmp_path_factory: pytest.TempPathFactory,
) -> Path:
    """Create a real disposable database through the project's migrations."""

    database_path = (
        tmp_path_factory.mktemp("rating-verification-template")
        / "app.db"
    )

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "app.cli.bootstrap_m2_catalogue",
        ],
        cwd=PROJECT_ROOT,
        env=os.environ
        | {
            "DATABASE_URL": (
                f"sqlite:///{database_path.as_posix()}"
            ),
            "TMDB_READ_ACCESS_TOKEN": "",
        },
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr

    return database_path


@pytest.fixture
def database(
    migrated_template: Path,
    tmp_path: Path,
) -> Iterator[sessionmaker[Session]]:
    """Give every test its own migrated database."""

    database_path = tmp_path / "rating-verification.db"
    shutil.copyfile(migrated_template, database_path)

    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    def get_request_session() -> Iterator[Session]:
        request_session = session_factory()

        try:
            yield request_session
        finally:
            request_session.close()

    app.dependency_overrides[get_db] = get_request_session

    try:
        yield session_factory
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def _register_and_login(
    email: str,
) -> tuple[TestClient, str]:
    http = TestClient(app)

    registered = http.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": PASSWORD,
        },
    )
    assert registered.status_code == 201

    login = http.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": PASSWORD,
        },
        headers=HEADERS,
    )
    assert login.status_code == 200

    return http, login.json()["data"]["user"]["id"]


def _movie_id(http: TestClient) -> str:
    response = http.get("/api/movies?limit=1")

    assert response.status_code == 200

    movies = response.json()["data"]["movies"]
    assert movies

    return movies[0]["id"]


def _stored_ratings(
    session_factory: sessionmaker[Session],
    *,
    user_id: str,
    movie_id: str,
) -> list[int]:
    with session_factory() as session:
        return list(
            session.scalars(
                select(UserMovieRating.rating).where(
                    UserMovieRating.user_id == user_id,
                    UserMovieRating.movie_id == movie_id,
                )
            )
        )


def test_two_independent_sessions_do_not_share_ratings(
    database: sessionmaker[Session],
) -> None:
    account_a, user_a = _register_and_login(
        "rating-a@example.com"
    )
    account_b, user_b = _register_and_login(
        "rating-b@example.com"
    )

    movie_id = _movie_id(account_a)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        account_a.put(
            path,
            json={"rating": 2},
            headers=HEADERS,
        ).status_code
        == 200
    )

    assert (
        account_b.put(
            path,
            json={"rating": 5},
            headers=HEADERS,
        ).status_code
        == 200
    )

    response_a = account_a.get(path)
    response_b = account_b.get(path)

    assert response_a.json() == {
        "data": {
            "movieId": movie_id,
            "rating": 2,
        }
    }

    assert response_b.json() == {
        "data": {
            "movieId": movie_id,
            "rating": 5,
        }
    }

    assert _stored_ratings(
        database,
        user_id=user_a,
        movie_id=movie_id,
    ) == [2]

    assert _stored_ratings(
        database,
        user_id=user_b,
        movie_id=movie_id,
    ) == [5]


def test_saving_one_then_five_updates_exactly_one_row(
    database: sessionmaker[Session],
) -> None:
    http, user_id = _register_and_login(
        "rating-update@example.com"
    )

    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 1},
            headers=HEADERS,
        ).status_code
        == 200
    )

    response = http.put(
        path,
        json={"rating": 5},
        headers=HEADERS,
    )

    assert response.status_code == 200
    assert response.json()["data"]["rating"] == 5

    with database() as session:
        rows = session.scalar(
            select(func.count())
            .select_from(UserMovieRating)
            .where(
                UserMovieRating.user_id == user_id,
                UserMovieRating.movie_id == movie_id,
            )
        )

    assert rows == 1

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [5]


def test_logout_and_relogin_restores_latest_rating(
    database: sessionmaker[Session],
) -> None:
    email = "rating-relogin@example.com"

    http, _ = _register_and_login(email)
    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 5},
            headers=HEADERS,
        ).status_code
        == 200
    )

    assert (
        http.post(
            "/api/auth/logout",
            headers=HEADERS,
        ).status_code
        == 204
    )

    assert http.get(path).status_code == 401

    login = http.post(
        "/api/auth/login",
        json={
            "email": email,
            "password": PASSWORD,
        },
        headers=HEADERS,
    )

    assert login.status_code == 200

    restored = http.get(path)

    assert restored.status_code == 200
    assert restored.json()["data"]["rating"] == 5


@pytest.mark.parametrize(
    "payload",
    [
        {"rating": 0},
        {"rating": 6},
        {"rating": "5"},
        {"rating": 3.25},
        {"rating": True},
        {"rating": None},
        {},
        {"rating": 5, "userId": "forged"},
    ],
)
def test_invalid_payload_preserves_previous_rating(
    database: sessionmaker[Session],
    payload: object,
) -> None:
    http, user_id = _register_and_login(
        "rating-invalid@example.com"
    )

    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 4},
            headers=HEADERS,
        ).status_code
        == 200
    )

    rejected = http.put(
        path,
        json=payload,
        headers=HEADERS,
    )

    assert rejected.status_code == 400
    assert (
        rejected.json()["error"]["code"]
        == "VALIDATION_ERROR"
    )

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [4]


def test_unknown_movie_preserves_existing_rows(
    database: sessionmaker[Session],
) -> None:
    http, user_id = _register_and_login(
        "rating-unknown@example.com"
    )

    movie_id = _movie_id(http)

    assert (
        http.put(
            f"/api/me/ratings/{movie_id}",
            json={"rating": 4},
            headers=HEADERS,
        ).status_code
        == 200
    )

    unknown = (
        "00000000-0000-0000-0000-000000000000"
    )

    rejected = http.put(
        f"/api/me/ratings/{unknown}",
        json={"rating": 1},
        headers=HEADERS,
    )

    assert rejected.status_code == 404
    assert (
        rejected.json()["error"]["code"]
        == "MOVIE_NOT_FOUND"
    )

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [4]


def test_repository_failure_rolls_back_previous_rating(
    database: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import app.main as main_module

    http, user_id = _register_and_login(
        "rating-repository-failure@example.com"
    )

    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 4},
            headers=HEADERS,
        ).status_code
        == 200
    )

    original = main_module.set_user_movie_rating

    def fail_after_write(
        session: Session,
        *,
        user_id: str,
        movie_id: str,
        rating: int,
    ):
        original(
            session,
            user_id=user_id,
            movie_id=movie_id,
            rating=rating,
        )

        raise OperationalError(
            "UPDATE user_movie_ratings",
            {},
            Exception("verification failure"),
        )

    monkeypatch.setattr(
        main_module,
        "set_user_movie_rating",
        fail_after_write,
    )

    failed = http.put(
        path,
        json={"rating": 1},
        headers=HEADERS,
    )

    assert failed.status_code == 503
    assert (
        failed.json()["error"]["code"]
        == "SERVICE_UNAVAILABLE"
    )

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [4]


def test_commit_failure_rolls_back_previous_rating(
    database: sessionmaker[Session],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    http, user_id = _register_and_login(
        "rating-commit-failure@example.com"
    )

    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 4},
            headers=HEADERS,
        ).status_code
        == 200
    )

    def fail_commit(_session: Session) -> None:
        raise OperationalError(
            "COMMIT",
            {},
            Exception("verification failure"),
        )

    monkeypatch.setattr(
        Session,
        "commit",
        fail_commit,
    )

    failed = http.put(
        path,
        json={"rating": 1},
        headers=HEADERS,
    )

    assert failed.status_code == 503
    assert (
        failed.json()["error"]["code"]
        == "SERVICE_UNAVAILABLE"
    )

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [4]


def test_revoked_session_cannot_read_or_write(
    database: sessionmaker[Session],
) -> None:
    http, user_id = _register_and_login(
        "rating-revoked@example.com"
    )

    movie_id = _movie_id(http)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        http.put(
            path,
            json={"rating": 3},
            headers=HEADERS,
        ).status_code
        == 200
    )

    old_cookie = http.cookies.get(SESSION_COOKIE)
    assert old_cookie

    assert (
        http.post(
            "/api/auth/logout",
            headers=HEADERS,
        ).status_code
        == 204
    )

    replay = TestClient(app)
    replay.cookies.set(
        SESSION_COOKIE,
        old_cookie,
    )

    assert replay.get(path).status_code == 401

    rejected_write = replay.put(
        path,
        json={"rating": 5},
        headers=HEADERS,
    )

    assert rejected_write.status_code == 401

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [3]


def test_forged_identifiers_cannot_read_or_update_other_account(
    database: sessionmaker[Session],
) -> None:
    attacker, attacker_id = _register_and_login(
        "rating-attacker@example.com"
    )
    victim, victim_id = _register_and_login(
        "rating-victim@example.com"
    )

    movie_id = _movie_id(attacker)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        victim.put(
            path,
            json={"rating": 5},
            headers=HEADERS,
        ).status_code
        == 200
    )

    read = attacker.get(
        path,
        params={
            "userId": victim_id,
            "user_id": victim_id,
        },
        headers={"X-User-Id": victim_id},
    )

    assert read.status_code == 200
    assert read.json()["data"]["rating"] is None

    write = attacker.put(
        path,
        json={"rating": 1},
        params={
            "userId": victim_id,
            "user_id": victim_id,
        },
        headers={
            **HEADERS,
            "X-User-Id": victim_id,
        },
    )

    assert write.status_code == 200
    assert write.json()["data"]["rating"] == 1

    assert _stored_ratings(
        database,
        user_id=attacker_id,
        movie_id=movie_id,
    ) == [1]

    assert _stored_ratings(
        database,
        user_id=victim_id,
        movie_id=movie_id,
    ) == [5]

def test_missing_session_cannot_read_or_write(
    database: sessionmaker[Session],
) -> None:
    owner, user_id = _register_and_login(
        "rating-owner@example.com"
    )

    movie_id = _movie_id(owner)
    path = f"/api/me/ratings/{movie_id}"

    assert (
        owner.put(
            path,
            json={"rating": 4},
            headers=HEADERS,
        ).status_code
        == 200
    )

    anonymous = TestClient(app)

    assert anonymous.get(path).status_code == 401

    write = anonymous.put(
        path,
        json={"rating": 1},
        headers=HEADERS,
    )

    assert write.status_code == 401

    assert _stored_ratings(
        database,
        user_id=user_id,
        movie_id=movie_id,
    ) == [4]