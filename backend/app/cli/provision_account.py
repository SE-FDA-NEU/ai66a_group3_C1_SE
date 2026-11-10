"""Provision one app-only account on an explicitly identified PostgreSQL target."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Literal

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import create_database_engine
from app.db.models import User
from app.repositories.users import create_user
from app.security.passwords import normalize_email, verify_password


class ProvisioningError(ValueError):
    """A credential-free refusal to modify the selected target."""


def provision_account(
    database_url: str, *, expected_host: str, expected_database: str,
    operator: str, email: str, password: str,
) -> Literal["created", "already_exists"]:
    """Create a hashed app account, without replacing an existing credential."""
    url = make_url(database_url)
    if url.drivername != "postgresql+psycopg":
        raise ProvisioningError("A PostgreSQL psycopg target is required")
    if not expected_host or not expected_database or not operator.strip():
        raise ProvisioningError("Target host, database and operator are required")
    # SQLAlchemy merges URL query values into libpq connection parameters. A
    # query dbname, host or port can supersede the authority/path checked below.
    target_overrides = {"host", "hostaddr", "port", "dbname", "service", "servicefile"}
    if target_overrides.intersection(url.query):
        raise ProvisioningError("Target overrides in database URL are not allowed")
    if url.host != expected_host or url.database != expected_database:
        raise ProvisioningError("Configured database does not match the opted-in target")
    if not password:
        raise ProvisioningError("An application password is required")
    normalized_email = normalize_email(email)
    config = Config(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    head = ScriptDirectory.from_config(config).get_current_head()
    database_engine = create_database_engine(database_url)
    try:
        with Session(database_engine) as session, session.begin():
            if session.scalar(text("SELECT version_num FROM alembic_version")) != head:
                raise ProvisioningError("Apply all migrations before provisioning")
            existing = session.scalar(
                select(User).where(User.email_normalized == normalized_email)
            )
            if existing is not None:
                if not verify_password(password, existing.password_hash):
                    raise ProvisioningError(
                        "Account already exists with different credentials; no change made"
                    )
                return "already_exists"
            create_user(session, email=normalized_email, password=password)
        return "created"
    except IntegrityError as exc:
        # A simultaneous operator may have won the unique insert. Re-read in
        # a new transaction so identical requests remain idempotent.
        with Session(database_engine) as session:
            existing = session.scalar(
                select(User).where(User.email_normalized == normalized_email)
            )
            if existing is not None and verify_password(password, existing.password_hash):
                return "already_exists"
        raise ProvisioningError(
            "Account conflicts with existing data; no change made"
        ) from exc
    finally:
        database_engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database-url-env", default="DATABASE_URL")
    parser.add_argument("--expected-host", required=True)
    parser.add_argument("--expected-database", required=True)
    parser.add_argument("--operator", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password-env", required=True)
    args = parser.parse_args(argv)
    database_url = os.environ.get(args.database_url_env, "")
    password = os.environ.get(args.password_env, "")
    if not database_url or not password or args.password_env == args.database_url_env:
        sys.stderr.write("Provisioning refused: separate database and password environment values are required.\n")
        return 1
    try:
        result = provision_account(
            database_url, expected_host=args.expected_host,
            expected_database=args.expected_database, operator=args.operator,
            email=args.email, password=password,
        )
    except (ProvisioningError, TypeError, ValueError) as exc:
        sys.stderr.write(f"Provisioning refused: {exc}\n")
        return 1
    except SQLAlchemyError:
        sys.stderr.write("Provisioning failed: check target access and migrations.\n")
        return 1
    print(f"Application account: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
