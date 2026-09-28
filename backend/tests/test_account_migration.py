from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def migrated_database_url(tmp_path: Path) -> str:
    database_path = tmp_path / "account.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    environment = os.environ | {"DATABASE_URL": database_url}

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "backend/alembic.ini",
            "upgrade",
            "head",
        ],
        cwd=PROJECT_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr
    return database_url


def test_account_migration_creates_the_required_columns(
    migrated_database_url: str,
) -> None:
    engine = create_engine(migrated_database_url)
    try:
        account_columns = {
            column["name"] for column in inspect(engine).get_columns("users")
        }
        unique_constraints = {
            constraint["name"]
            for constraint in inspect(engine).get_unique_constraints("users")
        }
    finally:
        engine.dispose()

    assert account_columns == {"id", "email_normalized", "password_hash", "created_at"}
    assert "uq_users_email_normalized" in unique_constraints


def test_database_uniqueness_rejects_email_case_variants(
    migrated_database_url: str,
) -> None:
    engine = create_engine(migrated_database_url)
    insert_user = text(
        """
        INSERT INTO users (id, email_normalized, password_hash, created_at)
        VALUES (:id, :email, :password_hash, :created_at)
        """
    )

    try:
        with engine.begin() as connection:
            connection.execute(
                insert_user,
                {
                    "id": "first-user",
                    "email": "viewer@example.com",
                    "password_hash": "first-hash",
                    "created_at": "2026-09-28 00:00:00",
                },
            )

        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(
                insert_user,
                {
                    "id": "second-user",
                    "email": "VIEWER@example.com",
                    "password_hash": "second-hash",
                    "created_at": "2026-09-28 00:00:00",
                },
            )
    finally:
        engine.dispose()
