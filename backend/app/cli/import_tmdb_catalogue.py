"""Run the required, server-only TMDb catalogue import."""

from __future__ import annotations

import sys
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError

from app.catalogue.tmdb_import import import_tmdb_catalogue
from app.db.database import SessionLocal
from app.integrations.tmdb import TmdbClient, TmdbImportError


def main() -> int:
    """Import a bounded TMDb snapshot without exposing credentials."""

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
    except ValueError:
        sys.stderr.write("TMDb catalogue import failed: catalogue validation failed\n")
        return 1

    print("TMDb catalogue import complete")
    print("provider=tmdb")
    print(f"active_revision={result.active_revision_id}")
    print(f"inserted={result.inserted_movie_count}")
    print(f"updated={result.updated_movie_count}")
    print(f"rejected={result.rejected_movie_count}")
    print(f"movies={result.movie_count}")
    print(f"associated_genres={result.associated_genre_count}")
    print(f"finite_popularity_movies={result.finite_popularity_movie_count}")
    print(f"source_fetched_at={_utc_timestamp(result.source_fetched_at)}")
    print(f"imported_at={_utc_timestamp(result.imported_at)}")
    print(f"sample_source_ids={','.join(result.sample_source_ids)}")
    return 0


def _utc_timestamp(value: datetime) -> str:
    """Render import provenance in a locale-independent UTC form."""

    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
