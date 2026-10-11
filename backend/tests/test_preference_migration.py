"""S3-T01: the migrated storage that keeps genre preferences per account."""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _alembic(database_url: str, *arguments: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *arguments],
        cwd=PROJECT_ROOT,
        env=os.environ | {"DATABASE_URL": database_url},
        check=False,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def migrated_database_url(tmp_path: Path) -> str:
    database_url = f"sqlite:///{(tmp_path / 'preferences.db').as_posix()}"
    completed = _alembic(database_url, "upgrade", "head")
    assert completed.returncode == 0, completed.stderr
    return database_url


@pytest.fixture
def engine(migrated_database_url: str) -> Iterator[Engine]:
    database_engine = create_engine(migrated_database_url)

    @event.listens_for(database_engine, "connect")
    def enforce_foreign_keys(dbapi_connection, _connection_record):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")

    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (id, email_normalized, password_hash, "
                    "created_at) VALUES ('user-a', 'a@example.com', 'x', "
                    "'2026-10-09 00:00:00'), ('user-b', 'b@example.com', 'x', "
                    "'2026-10-09 00:00:00')"
                )
            )
            connection.execute(
                text("INSERT INTO genres (id, name) VALUES (28, 'Action'), (35, 'Comedy')")
            )
        yield database_engine
    finally:
        database_engine.dispose()


def _preference_rows(engine: Engine) -> list[tuple[str, int]]:
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                "SELECT user_id, genre_id FROM user_genre_preferences "
                "ORDER BY user_id, genre_id"
            )
        )
        return [(row.user_id, row.genre_id) for row in rows]


def test_migration_creates_the_account_owned_preference_table(engine: Engine) -> None:
    inspector = inspect(engine)

    columns = {c["name"]: c for c in inspector.get_columns("user_genre_preferences")}
    assert set(columns) == {"user_id", "genre_id"}
    assert all(not column["nullable"] for column in columns.values())
    assert inspector.get_pk_constraint("user_genre_preferences")[
        "constrained_columns"
    ] == ["user_id", "genre_id"]

    foreign_keys = {
        fk["constrained_columns"][0]: (fk["referred_table"], fk["options"])
        for fk in inspector.get_foreign_keys("user_genre_preferences")
    }
    assert foreign_keys == {
        "user_id": ("users", {"ondelete": "CASCADE"}),
        "genre_id": ("genres", {"ondelete": "RESTRICT"}),
    }


def test_the_database_rejects_duplicate_and_orphan_preferences(engine: Engine) -> None:
    insert = text("INSERT INTO user_genre_preferences VALUES (:user_id, :genre_id)")
    with engine.begin() as connection:
        connection.execute(insert, {"user_id": "user-a", "genre_id": 28})

    for row in (
        {"user_id": "user-a", "genre_id": 28},  # same account, same genre
        {"user_id": "nobody", "genre_id": 28},  # unknown account
        {"user_id": "user-a", "genre_id": 999},  # unknown genre
    ):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(insert, row)

    assert _preference_rows(engine) == [("user-a", 28)]


def test_two_accounts_may_prefer_the_same_genre(engine: Engine) -> None:
    insert = text("INSERT INTO user_genre_preferences VALUES (:user_id, :genre_id)")
    with engine.begin() as connection:
        connection.execute(insert, {"user_id": "user-a", "genre_id": 28})
        connection.execute(insert, {"user_id": "user-b", "genre_id": 28})

    assert _preference_rows(engine) == [("user-a", 28), ("user-b", 28)]


def test_deleting_an_account_removes_only_its_own_preferences(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO user_genre_preferences VALUES "
                "('user-a', 28), ('user-a', 35), ('user-b', 28)"
            )
        )
        connection.execute(text("DELETE FROM users WHERE id = 'user-a'"))

    assert _preference_rows(engine) == [("user-b", 28)]


def test_a_preferred_genre_cannot_be_deleted(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(
            text("INSERT INTO user_genre_preferences VALUES ('user-a', 28)")
        )

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("DELETE FROM genres WHERE id = 28"))

    assert _preference_rows(engine) == [("user-a", 28)]


def test_downgrade_drops_only_the_preference_table(
    tmp_path: Path,
) -> None:
    database_url = (
        f"sqlite:///{(tmp_path / 'preferences_downgrade.db').as_posix()}"
    )

    upgraded = _alembic(
        database_url,
        "upgrade",
        "9d2f5a1c3b84",
    )
    assert upgraded.returncode == 0, upgraded.stderr

    downgraded = _alembic(
        database_url,
        "downgrade",
        "8c1e2f4a7b90",
    )
    assert downgraded.returncode == 0, downgraded.stderr

    engine = create_engine(database_url)

    try:
        tables = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()

    assert "user_genre_preferences" not in tables
    assert "users" in tables
    assert "catalog_movies" in tables
    assert "auth_sessions" in tables