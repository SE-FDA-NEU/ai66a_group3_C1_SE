"""T20 verification of the integrated auth-to-catalogue handoff.

The flow runs against a database created from scratch by the real bootstrap
command (migrations plus the deterministic M2 seed), with one database session
per request: register, sign in, open the recommendation landing data, open a
movie detail, sign out, then prove the old session cannot be reused.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.models import AuthSession, User
from app.main import app, get_db
from app.security.sessions import SESSION_COOKIE
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
EMAIL = "handoff.viewer@example.com"
PASSWORD = "movie123"
HEADERS = {"Origin": "http://testserver"}


@pytest.fixture(scope="module")
def bootstrapped_template(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Run the real M2 bootstrap once on an empty path; tests copy the result."""

    template = tmp_path_factory.mktemp("handoff-template") / "app.db"
    completed = subprocess.run(
        [sys.executable, "-m", "app.cli.bootstrap_m2_catalogue"],
        cwd=PROJECT_ROOT,
        env=os.environ
        | {
            "DATABASE_URL": f"sqlite:///{template.as_posix()}",
            "TMDB_READ_ACCESS_TOKEN": "",
        },
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    assert "movies=12" in completed.stdout
    return template


@pytest.fixture
def database(
    bootstrapped_template: Path, tmp_path: Path
) -> Iterator[sessionmaker[Session]]:
    database_path = tmp_path / "handoff.db"
    shutil.copyfile(bootstrapped_template, database_path)
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )
    session_factory = sessionmaker(bind=engine, autoflush=False, autocommit=False)

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


def test_new_account_reaches_the_recommendation_landing_data(
    database: sessionmaker[Session],
) -> None:
    with TestClient(app) as http:
        # A visitor with no account cannot read the protected landing data.
        anonymous = http.get("/api/me/recommendations")
        assert anonymous.status_code == 401
        assert anonymous.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

        registered = http.post(
            "/api/auth/register", json={"email": EMAIL, "password": PASSWORD}
        )
        assert registered.status_code == 201
        assert SESSION_COOKIE not in http.cookies

        signed_in = http.post(
            "/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers=HEADERS,
        )
        assert signed_in.status_code == 200
        assert signed_in.json()["data"]["user"]["email"] == EMAIL
        assert http.cookies.get(SESSION_COOKIE)

        landing = http.get("/api/me/recommendations")

    assert landing.status_code == 200
    body = landing.json()
    # A brand-new account has no saved preferences, so it gets the shared
    # popularity list (cold start), clearly labelled as not personalised.
    assert body["data"]["mode"] == "popular"
    assert body["data"]["personalised"] is False
    assert body["data"]["noMatch"] is False
    assert body["meta"]["count"] == 10
    assert len(body["data"]["movies"]) == 10
    scores = [movie["popularityScore"] for movie in body["data"]["movies"]]
    assert scores == sorted(scores, reverse=True)

    with database() as session:
        assert session.scalar(select(func.count()).select_from(User)) == 1


def test_a_recommended_movie_opens_its_public_detail(
    database: sessionmaker[Session],
) -> None:
    with TestClient(app) as http:
        http.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
        http.post(
            "/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers=HEADERS,
        )
        recommended = http.get("/api/me/recommendations").json()["data"]["movies"]
        movie_id = recommended[0]["id"]

        detail = http.get(f"/api/movies/{movie_id}")

    assert detail.status_code == 200
    movie = detail.json()["data"]["movie"]
    assert movie["id"] == movie_id
    assert movie["title"] == recommended[0]["title"]
    assert movie["genres"]
    assert movie["overview"]

    # The same detail is public: it needs neither the session nor an account.
    with TestClient(app) as visitor:
        assert visitor.get(f"/api/movies/{movie_id}").status_code == 200
        assert visitor.get("/api/movies?limit=10").json()["meta"]["count"] == 10


def test_logout_forbids_reusing_the_old_session_on_authenticated_api(
    database: sessionmaker[Session],
) -> None:
    with TestClient(app) as http:
        http.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
        http.post(
            "/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers=HEADERS,
        )
        old_token = http.cookies.get(SESSION_COOKIE)
        assert old_token
        assert http.get("/api/auth/me").status_code == 200
        assert http.get("/api/me/recommendations").status_code == 200

        logout = http.post("/api/auth/logout", headers=HEADERS)
        assert logout.status_code == 204

        # The browser dropped the cookie, so the same client is signed out.
        assert http.get("/api/auth/me").status_code == 401
        assert http.get("/api/me/recommendations").status_code == 401

    # A client that replays the former cookie value still cannot get in,
    # because the session was revoked on the server, not just cleared locally.
    with TestClient(app) as replay:
        replay.cookies.set(SESSION_COOKIE, old_token)
        for path in ("/api/auth/me", "/api/me/recommendations"):
            rejected = replay.get(path)
            assert rejected.status_code == 401, path
            assert rejected.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

        # Public catalogue access is unaffected by the revoked session.
        assert replay.get("/api/movies?limit=10").status_code == 200

    with database() as session:
        stored = session.scalars(select(AuthSession)).all()
        assert len(stored) == 1
        assert stored[0].revoked_at is not None


def test_signing_in_again_after_logout_creates_a_fresh_session(
    database: sessionmaker[Session],
) -> None:
    with TestClient(app) as http:
        http.post("/api/auth/register", json={"email": EMAIL, "password": PASSWORD})
        http.post(
            "/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers=HEADERS,
        )
        first_token = http.cookies.get(SESSION_COOKIE)
        http.post("/api/auth/logout", headers=HEADERS)

        http.post(
            "/api/auth/login",
            json={"email": EMAIL, "password": PASSWORD},
            headers=HEADERS,
        )
        second_token = http.cookies.get(SESSION_COOKIE)

        assert second_token and second_token != first_token
        assert http.get("/api/me/recommendations").status_code == 200


# These Story S13/S5 criteria are deliberately not implemented in Sprint 2.
# They are listed as skipped tests so the pending scope shows up in every run
# instead of being silently dropped.
@pytest.mark.skip(reason="Pending S05a: rating write API is not implemented yet.")
def test_rating_write_requires_the_signed_in_account() -> None:
    raise AssertionError("pending")


@pytest.mark.skip(
    reason="Pending S02/S03: personalised recommendations and cross-account "
    "isolation of ratings need preferences and ratings first."
)
def test_two_accounts_receive_their_own_personalised_recommendations() -> None:
    raise AssertionError("pending")
