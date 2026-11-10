"""Provision an opted-in app-only review account in the configured TMDb database."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Literal

from sqlalchemy import URL, create_engine, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import DATABASE_URL
from app.db.models import CatalogMovie
from app.repositories.movies import get_active_catalogue_revision
from app.repositories.users import create_user, get_user_by_email
from app.security.passwords import verify_password

# Public app-only demo credentials supplied by the PO. Never a production login.
REVIEW_EMAIL = "kietxuan@gmail.com"
REVIEW_PASSWORD = "123456789"


class ReviewSetupError(ValueError):
    """An actionable, credential-free refusal to alter an unsafe target."""


def create_review_account(database_url: str) -> Literal["created", "already_exists"]:
    """Create one account, or verify it without overwriting existing data."""

    url = make_url(database_url)
    if url.drivername not in {"sqlite", "sqlite+pysqlite"} or url.query:
        raise ReviewSetupError("Use the configured plain local SQLite database URL.")
    if not url.database or url.database == ":memory:":
        raise ReviewSetupError("Use an existing migrated SQLite database file.")
    database = Path(url.database).resolve()
    if not database.is_file():
        raise ReviewSetupError("Run the documented migrations and TMDb import first.")

    # Open the validated path, not another engine imported from developer config.
    engine = create_engine(URL.create("sqlite+pysqlite", database=str(database)))
    try:
        with Session(engine) as session, session.begin():
            if not session.execute(text("SELECT version_num FROM alembic_version")).scalar():
                raise ReviewSetupError("Apply the documented migrations first.")
            revision = get_active_catalogue_revision(session)
            if revision is None or revision.provider != "tmdb":
                raise ReviewSetupError("A successful active TMDb import is required first.")
            movie = session.scalar(
                select(CatalogMovie.id)
                .where(CatalogMovie.catalogue_revision_id == revision.id)
                .limit(1)
            )
            if movie is None:
                raise ReviewSetupError("The active TMDb catalogue contains no movies.")
            invalid_source = session.scalar(
                select(CatalogMovie.id)
                .where(
                    CatalogMovie.catalogue_revision_id == revision.id,
                    CatalogMovie.source != "tmdb",
                )
                .limit(1)
            )
            if invalid_source is not None:
                raise ReviewSetupError("The active catalogue contains non-TMDb movies.")
            user = get_user_by_email(session, email=REVIEW_EMAIL)
            if user is not None:
                if not verify_password(REVIEW_PASSWORD, user.password_hash):
                    raise ReviewSetupError(
                        "Existing demo email has a different password; nothing was "
                        "changed. Sign in using the existing password or contact the "
                        "account owner; this command never resets credentials."
                    )
                return "already_exists"
            create_user(session, email=REVIEW_EMAIL, password=REVIEW_PASSWORD)
        return "created"
    finally:
        engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--confirm-local-demo",
        action="store_true",
        required=True,
        help="Opt in to public app-only credentials in the configured local TMDb DB.",
    )
    parser.parse_args(argv)
    if os.getenv("APP_ENV", "").strip().lower() in {"production", "prod"}:
        sys.stderr.write("Review setup refused: never provision this account in production.\n")
        return 1
    try:
        result = create_review_account(DATABASE_URL)
    except ReviewSetupError as exc:
        sys.stderr.write(f"Review setup refused: {exc}\n")
        return 1
    except SQLAlchemyError:
        sys.stderr.write(
            "Review setup failed: verify migrations and the configured local database; "
            "no credentials or database error details are printed.\n"
        )
        return 1
    print(f"Local review account: {result}")
    print("Use the app-only demo credentials in docs/SETUP.md; never use them in production.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
