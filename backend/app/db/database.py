import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[3]

load_dotenv(PROJECT_ROOT / ".env")


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./data/app.db",
)


SQLITE_BUSY_TIMEOUT_SECONDS = 5.0


def create_database_engine(
    database_url: str, *, sqlite_timeout_seconds: float = SQLITE_BUSY_TIMEOUT_SECONDS
) -> Engine:
    """Shared runtime/test engine policy; preserve the database's journal mode."""
    database_engine = create_engine(
        database_url,
        connect_args=(
            {"check_same_thread": False, "timeout": sqlite_timeout_seconds}
            if database_url.startswith("sqlite") else {}
        ),
    )
    if database_url.startswith("sqlite"):

        @event.listens_for(database_engine, "connect")
        def enable_sqlite_foreign_keys(dbapi_connection, _connection_record):
            """Make SQLite enforce the foreign keys declared by our migrations."""

            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    return database_engine


engine = create_database_engine(DATABASE_URL)


class Base(DeclarativeBase):
    """Base class shared by every application-owned database model."""


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)
