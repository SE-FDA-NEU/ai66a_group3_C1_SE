from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.db.models import User
from app.main import app, get_db
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


def test_register_creates_account_with_eight_char_password(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client

    response = http.post(
        "/api/auth/register",
        json={"email": " NEWUSER@example.com ", "password": "movie123"},
    )

    assert response.status_code == 201
    user = response.json()["data"]["user"]
    assert set(user.keys()) == {"id", "email"}
    assert user["email"] == "newuser@example.com"
    assert "ams_session" not in response.cookies

    stored = database_session.scalar(select(User))
    assert stored is not None
    assert stored.email_normalized == "newuser@example.com"


def test_register_rejects_seven_char_password(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client

    response = http.post(
        "/api/auth/register",
        json={"email": "shortpw@example.com", "password": "movie12"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert database_session.scalar(select(User)) is None


def test_register_rejects_invalid_email_format(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client

    response = http.post(
        "/api/auth/register",
        json={"email": "not-an-email", "password": "movie123"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert database_session.scalar(select(User)) is None


def test_register_duplicate_email_conflicts_case_insensitively(
    client: tuple[TestClient, Session],
) -> None:
    http, database_session = client
    http.post(
        "/api/auth/register",
        json={"email": "viewer@example.com", "password": "movie123"},
    )

    response = http.post(
        "/api/auth/register",
        json={"email": "VIEWER@example.com", "password": "different1"},
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    assert response.json()["error"]["message"] == "This email is already registered"
    remaining = database_session.scalars(select(User)).all()
    assert len(remaining) == 1
