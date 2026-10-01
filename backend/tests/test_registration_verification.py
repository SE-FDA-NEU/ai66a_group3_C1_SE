"""T06 verification of S12 registration against a real migrated SQLite file.

These tests exercise POST /api/auth/register end to end with one database
session per request, as production does, instead of the shared in-memory
session used by the unit tests in test_registration.py.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier

import pytest
from app.db.models import User
from app.main import app, get_db
from app.security.passwords import verify_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REGISTER = "/api/auth/register"
VALIDATION_MESSAGE = "Please correct the highlighted fields"


@pytest.fixture(scope="module")
def migrated_template(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Run the real Alembic migrations once; each test gets a copy of the result."""

    template = tmp_path_factory.mktemp("registration-template") / "template.db"
    completed = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=PROJECT_ROOT,
        env=os.environ | {"DATABASE_URL": f"sqlite:///{template.as_posix()}"},
        check=False,
        capture_output=True,
        text=True,
    )
    assert completed.returncode == 0, completed.stderr
    return template


@pytest.fixture
def database(migrated_template: Path, tmp_path: Path) -> Iterator[sessionmaker[Session]]:
    database_path = tmp_path / "registration.db"
    shutil.copyfile(migrated_template, database_path)
    engine = create_engine(
        f"sqlite:///{database_path.as_posix()}", connect_args={"check_same_thread": False}
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


@pytest.fixture
def http(database: sessionmaker[Session]) -> TestClient:
    return TestClient(app)


def stored_users(database: sessionmaker[Session]) -> list[User]:
    with database() as session:
        return list(session.scalars(select(User)))


def test_valid_registration_persists_a_hashed_normalized_account(
    http: TestClient, database: sessionmaker[Session]
) -> None:
    response = http.post(
        REGISTER, json={"email": "  New.Viewer@Example.COM ", "password": "movie123"}
    )

    assert response.status_code == 201
    user = response.json()["data"]["user"]
    assert set(user) == {"id", "email"}
    assert user["email"] == "new.viewer@example.com"
    assert "movie123" not in response.text
    assert "password" not in response.text.lower()

    [account] = stored_users(database)
    assert account.id == user["id"]
    assert account.email_normalized == "new.viewer@example.com"
    assert account.password_hash != "movie123"
    assert account.password_hash.startswith("$argon2id$")
    assert verify_password("movie123", account.password_hash)


@pytest.mark.parametrize("password", ["12345678", "a" * 8, "pässwörd", "p" * 200])
def test_passwords_of_eight_or_more_characters_are_accepted(
    http: TestClient, password: str
) -> None:
    response = http.post(REGISTER, json={"email": "boundary@example.com", "password": password})

    assert response.status_code == 201


@pytest.mark.parametrize("password", ["", "1", "movie12", "       ", "pässwö"])
def test_passwords_under_eight_characters_are_rejected_without_an_account(
    http: TestClient, database: sessionmaker[Session], password: str
) -> None:
    response = http.post(REGISTER, json={"email": "short@example.com", "password": password})

    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert error["message"] == VALIDATION_MESSAGE
    assert stored_users(database) == []


@pytest.mark.parametrize(
    "email",
    ["", "   ", "plainaddress", "@example.com", "user@", "user@example", "us er@example.com", "a@@b.com"],
)
def test_invalid_emails_are_rejected_without_an_account(
    http: TestClient, database: sessionmaker[Session], email: str
) -> None:
    response = http.post(REGISTER, json={"email": email, "password": "movie123"})

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert stored_users(database) == []


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"email": "user@example.com"},
        {"password": "movie123"},
        {"email": None, "password": "movie123"},
        {"email": "user@example.com", "password": 12345678},
        {"email": "user@example.com", "password": "movie123", "id": "chosen-id"},
    ],
)
def test_missing_mistyped_or_extra_fields_are_rejected_without_an_account(
    http: TestClient, database: sessionmaker[Session], payload: dict[str, object]
) -> None:
    response = http.post(REGISTER, json=payload)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert stored_users(database) == []


def test_validation_error_does_not_echo_the_submitted_password(http: TestClient) -> None:
    response = http.post(REGISTER, json={"email": "bad", "password": "secret-pw"})

    assert response.status_code == 400
    assert "secret-pw" not in response.text


@pytest.mark.parametrize(
    "second_email",
    ["viewer@example.com", "VIEWER@EXAMPLE.COM", "Viewer@Example.com", "  viewer@example.com  "],
)
def test_duplicate_email_is_rejected_case_and_whitespace_insensitively(
    http: TestClient, database: sessionmaker[Session], second_email: str
) -> None:
    first = http.post(REGISTER, json={"email": "viewer@example.com", "password": "movie123"})
    assert first.status_code == 201

    second = http.post(REGISTER, json={"email": second_email, "password": "different-pw"})

    assert second.status_code == 409
    error = second.json()["error"]
    assert error["code"] == "EMAIL_ALREADY_REGISTERED"
    assert error["message"] == "This email is already registered"
    assert "different-pw" not in second.text

    [account] = stored_users(database)
    assert account.id == first.json()["data"]["user"]["id"]
    assert verify_password("movie123", account.password_hash)
    assert not verify_password("different-pw", account.password_hash)


def test_concurrent_duplicate_registrations_create_exactly_one_account(
    database: sessionmaker[Session],
) -> None:
    attempts = 8
    start_together = Barrier(attempts)

    def register(index: int) -> int:
        email = ["race@example.com", "RACE@example.com", " Race@Example.com "][index % 3]
        # Each worker owns its client; it is built before the barrier so setup
        # time does not spread out the simultaneous POSTs.
        with TestClient(app) as client:
            start_together.wait()
            return client.post(
                REGISTER, json={"email": email, "password": f"password-{index}"}
            ).status_code

    with ThreadPoolExecutor(max_workers=attempts) as pool:
        statuses = sorted(pool.map(register, range(attempts)))

    assert statuses == [201] + [409] * (attempts - 1)
    with database() as session:
        assert session.scalar(select(func.count()).select_from(User)) == 1


def test_registration_does_not_create_a_session(http: TestClient) -> None:
    response = http.post(REGISTER, json={"email": "nosession@example.com", "password": "movie123"})

    assert response.status_code == 201
    assert "set-cookie" not in response.headers
    assert http.get("/api/auth/me").status_code == 401
