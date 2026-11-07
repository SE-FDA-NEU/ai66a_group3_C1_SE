import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.engine import make_url
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
    url = make_url(database_url)
    is_sqlite = url.get_backend_name() == "sqlite"
    is_postgresql = url.get_backend_name() == "postgresql"
    if not (is_sqlite or is_postgresql):
        raise ValueError("Unsupported database dialect")
    if is_postgresql and url.drivername != "postgresql+psycopg":
        raise ValueError("PostgreSQL requires the psycopg driver")
    if is_postgresql:
        sslmode = url.query.get("sslmode", "verify-full")
        if os.getenv("APP_ENV", "").lower() in {"production", "prod"} and sslmode != "verify-full":
            raise ValueError("Production PostgreSQL requires verify-full TLS")
        url = url.update_query_dict({"sslmode": sslmode})
    database_engine = create_engine(
        url,
        connect_args=(
            {"check_same_thread": False, "timeout": sqlite_timeout_seconds}
            if is_sqlite else {}
        ),
        **({"pool_pre_ping": True, "pool_size": 5, "max_overflow": 5,
            "pool_timeout": 5, "pool_recycle": 1800,
            "isolation_level": "REPEATABLE READ"} if is_postgresql else {}),
    )
    if is_sqlite:

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
