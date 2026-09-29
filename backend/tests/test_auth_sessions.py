from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from app.db.database import Base
from app.db.models import AuthSession
from app.main import app, get_db
from app.repositories.users import create_user
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def client() -> Iterator[tuple[TestClient, Session]]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    database_session = local_session()
    create_user(
        database_session, email="viewer@example.com", password="movie123"
    )
    database_session.commit()

    def override_get_db() -> Iterator[Session]:
        yield database_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app), database_session
    finally:
        app.dependency_overrides.clear()
        database_session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_login_creates_opaque_cookie_and_me_resolves_server_user(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client

    response = http.post(
        "/api/auth/login",
        json={"email": " VIEWER@example.com ", "password": "movie123"},
    )

    assert response.status_code == 200
    assert response.json()["data"]["user"]["email"] == "viewer@example.com"
    cookie = response.cookies.get("ams_session")
    assert cookie
    assert "HttpOnly" in response.headers["set-cookie"]
    assert "SameSite=lax" in response.headers["set-cookie"]
    stored = database_session.scalar(select(AuthSession))
    assert stored is not None
    assert stored.token_digest != cookie

    me = http.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["data"]["user"]["email"] == "viewer@example.com"


def test_unknown_email_and_wrong_password_have_same_public_error(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client
    unknown = http.post(
        "/api/auth/login",
        json={"email": "missing@example.com", "password": "movie123"},
    )
    wrong = http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "wrong-pass"},
    )

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["error"]["code"] == wrong.json()["error"]["code"]
    assert unknown.json()["error"]["message"] == wrong.json()["error"]["message"]
    assert unknown.json()["error"]["requestId"] != wrong.json()["error"]["requestId"]


def test_logout_revokes_session_and_expired_or_invalid_cookie_is_unauthorized(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "movie123"},
    )
    cookie = http.cookies.get("ams_session")

    assert http.post("/api/auth/logout").status_code == 204
    assert http.get("/api/auth/me").status_code == 401

    # A manually supplied former value cannot bypass server-side revocation.
    http.cookies.set("ams_session", cookie)
    assert http.get("/api/auth/me").json()["error"]["code"] == (
        "AUTHENTICATION_REQUIRED"
    )
    assert database_session.scalar(select(AuthSession)).revoked_at is not None


def test_expired_session_is_unauthorized(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "movie123"},
    )
    stored = database_session.scalar(select(AuthSession))
    assert stored is not None
    stored.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    database_session.commit()

    response = http.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["error"]["requestId"].startswith("req_")


def test_unknown_cookie_is_unauthorized(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client
    http.cookies.set("ams_session", token_urlsafe(32))

    response = http.get("/api/auth/me")

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["error"]["requestId"].startswith("req_")
