from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

import pytest
from app.db.database import Base
from app.db.models import AuthSession
from app.main import app, get_db
from app.repositories.users import create_user, get_user_by_email
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
    create_user(
        database_session, email="other@example.com", password="other-pass"
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
    body = response.json()
    assert set(body) == {"data"}
    assert set(body["data"]) == {"user"}
    assert set(body["data"]["user"]) == {"id", "email"}
    assert body["data"]["user"]["email"] == "viewer@example.com"
    assert "password" not in response.text.lower()
    assert "session" not in response.text.lower()
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
    assert unknown.json()["error"]["message"] == "Email or password is incorrect"
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

    logout = http.post("/api/auth/logout")
    assert logout.status_code == 204
    assert "ams_session=\"\"" in logout.headers["set-cookie"]
    assert "Max-Age=0" in logout.headers["set-cookie"]
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


def test_missing_session_returns_safe_authentication_error(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client

    response = http.get("/api/auth/me")

    assert response.status_code == 401
    assert set(response.json()["error"]) == {"code", "message", "requestId"}
    assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert response.json()["error"]["message"] == "Authentication required"


def test_client_user_id_cannot_override_the_session_account(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    login = http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "movie123"},
    )
    viewer_id = login.json()["data"]["user"]["id"]
    other = get_user_by_email(database_session, email="other@example.com")
    assert other is not None

    me = http.get(
        f"/api/auth/me?user_id={other.id}",
        headers={"X-User-Id": other.id},
    )

    assert me.status_code == 200
    assert me.json()["data"]["user"]["id"] == viewer_id
    assert me.json()["data"]["user"]["id"] != other.id

    login_with_user_id = http.post(
        "/api/auth/login",
        json={
            "email": "viewer@example.com",
            "password": "movie123",
            "user_id": other.id,
        },
    )
    assert login_with_user_id.status_code == 400
    assert login_with_user_id.json()["error"]["code"] == "VALIDATION_ERROR"


def test_cross_origin_login_is_rejected_before_session_creation(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client

    response = http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "movie123"},
        headers={
            "Origin": "https://attacker.example",
            "Sec-Fetch-Site": "cross-site",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_NOT_ALLOWED"
    assert response.json()["error"]["message"] == "Request origin is not allowed"
    assert database_session.scalar(select(AuthSession)) is None


def test_same_origin_fetch_metadata_allows_the_vite_proxy(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client

    response = http.post(
        "/api/auth/login",
        json={"email": "viewer@example.com", "password": "movie123"},
        headers={
            "Origin": "http://localhost:5173",
            "Sec-Fetch-Site": "same-origin",
        },
    )

    assert response.status_code == 200
    assert response.cookies.get("ams_session")


def test_cross_origin_logout_cannot_revoke_the_current_session(
    client: tuple[TestClient, Session],
) -> None:
    http, _ = client
    assert (
        http.post(
            "/api/auth/login",
            json={"email": "viewer@example.com", "password": "movie123"},
            headers={"Origin": "http://testserver"},
        ).status_code
        == 200
    )

    response = http.post(
        "/api/auth/logout",
        headers={
            "Origin": "https://attacker.example",
            "Sec-Fetch-Site": "same-site",
        },
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "ORIGIN_NOT_ALLOWED"
    assert http.get("/api/auth/me").status_code == 200
