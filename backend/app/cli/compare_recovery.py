"""Compare a PostgreSQL source with an isolated restore without printing private rows."""

from __future__ import annotations

import argparse
import hashlib
import os
import sys
from collections import Counter
from datetime import date, datetime
from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

import app.db.models  # noqa: F401 -- register every model in standalone CLI processes
from app.db.database import Base, create_database_engine

CODE_HEADS = set(ScriptDirectory.from_config(Config(str(
    Path(__file__).resolve().parents[2] / "alembic.ini"
))).get_heads())
TARGET_OVERRIDE_KEYS = {"host", "hostaddr", "port", "dbname", "service", "servicefile"}


def _validate_url(raw: str, expected_database: str):
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg" or not url.host or not url.database:
        raise ValueError("A PostgreSQL psycopg host and database are required")
    if set(url.query) & TARGET_OVERRIDE_KEYS:
        raise ValueError("Connection target overrides are forbidden")
    if url.database != expected_database:
        raise ValueError("Database name differs from independently confirmed target")
    return url


def _encode_value(value: object) -> bytes:
    if value is None:
        rendered = "null"
    elif isinstance(value, (date, datetime)):
        rendered = value.isoformat()
    else:
        rendered = repr(value)
    return rendered.encode("utf-8")


def _table_fingerprint(session: Session, table) -> tuple[int, str]:
    digest = hashlib.sha256()
    count = 0
    for row in session.execute(select(table).order_by(*table.primary_key.columns)).yield_per(1000):
        for value in row:
            encoded = _encode_value(value)
            digest.update(len(encoded).to_bytes(8, "big"))
            digest.update(encoded)
        digest.update(b"\xff")
        count += 1
    return count, digest.hexdigest()


def _inspect(raw_url: str, expected_database: str):
    required_tables = {mapper.local_table.name for mapper in Base.registry.mappers}
    if not required_tables or not required_tables.issubset(Base.metadata.tables):
        raise ValueError("Application table metadata is empty or incomplete")
    engine = create_database_engine(raw_url)
    try:
        with Session(engine) as session:
            session.execute(text("SET TRANSACTION READ ONLY"))
            identity = session.execute(text("SELECT current_database(), current_user, "
                                            "current_setting('server_version_num')")).one()
            if identity[0] != expected_database or int(identity[2]) // 10000 != 18:
                raise ValueError("Effective target or PostgreSQL major differs from plan")
            heads = session.scalars(text("SELECT version_num FROM alembic_version")).all()
            if len(heads) != 1 or set(heads) != CODE_HEADS:
                raise ValueError("Database revision must equal exact code head")
            invalid_constraints = session.scalar(text(
                "SELECT count(*) FROM pg_constraint "
                "WHERE contype IN ('f','c') AND NOT convalidated"
            ))
            if invalid_constraints:
                raise ValueError("Unvalidated foreign key or check constraint")
            tables = {table.name: _table_fingerprint(session, table)
                      for table in Base.metadata.sorted_tables}
            checks = Counter(session.execute(text(
                "SELECT country, status, COALESCE(link_status, '<null>'), "
                "(watch_options_url IS NULL) FROM movie_provider_checks"
            )).all())
            providers = Counter(session.execute(text(
                "SELECT country, availability_type FROM movie_watch_providers"
            )).all())
            return heads[0], tables, checks, providers
    finally:
        engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-database", required=True)
    parser.add_argument("--target-database", required=True)
    args = parser.parse_args(argv)
    source_url = os.getenv("RECOVERY_SOURCE_URL")
    target_url = os.getenv("RECOVERY_TARGET_URL")
    if not source_url or not target_url:
        parser.error("RECOVERY_SOURCE_URL and RECOVERY_TARGET_URL must be set privately")
    try:
        source = _validate_url(source_url, args.source_database)
        target = _validate_url(target_url, args.target_database)
        if (source.host, source.port or 5432, source.database) == (
            target.host, target.port or 5432, target.database
        ):
            raise ValueError("Restore target must be a separate PostgreSQL database")
        source_result = _inspect(source_url, args.source_database)
        target_result = _inspect(target_url, args.target_database)
    except Exception as exc:  # noqa: BLE001 -- never print SQL, DSNs or account data
        print(f"comparison refused: {type(exc).__name__}", file=sys.stderr)
        return 2
    equal_tables = {name: source_result[1][name] == target_result[1][name]
                    for name in source_result[1]}
    equal_regions = source_result[2:] == target_result[2:]
    print(f"source_database={args.source_database} target_database={args.target_database}")
    print(f"source_head={source_result[0]} target_head={target_result[0]}")
    for name, equal in equal_tables.items():
        print(f"table={name} rows={source_result[1][name][0]} equal={str(equal).lower()}")
    print(f"region_status_and_link_states_equal={str(equal_regions).lower()}")
    return 0 if source_result[0] == target_result[0] and all(equal_tables.values()) and equal_regions else 1


if __name__ == "__main__":
    raise SystemExit(main())
