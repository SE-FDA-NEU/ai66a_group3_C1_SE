"""Run the optional, server-only TMDb catalogue import."""

from __future__ import annotations

import sys

from sqlalchemy.exc import SQLAlchemyError

from app.catalogue.tmdb_import import import_tmdb_catalogue
from app.db.database import SessionLocal
from app.integrations.tmdb import TmdbClient, TmdbImportError


def main() -> int:
    """Import a validated TMDb snapshot without exposing credentials."""

    try:
        client = TmdbClient.from_environment()
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1

    try:
        with client, SessionLocal() as session, session.begin():
            result = import_tmdb_catalogue(session, client=client)
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1
    except SQLAlchemyError:
        sys.stderr.write("TMDb catalogue import failed: database write failed\n")
        return 1

    print("TMDb catalogue import complete")
    print(f"active_revision={result.active_revision_id}")
    print(f"inserted={result.inserted_movie_count}")
    print(f"updated={result.updated_movie_count}")
    print(f"rejected={result.rejected_movie_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
