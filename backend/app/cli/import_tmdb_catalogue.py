"""Run the required, server-only TMDb catalogue import."""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError

from app.catalogue.tmdb_import import (
    MAX_ENRICHMENT_MOVIES,
    enrich_tmdb_backdrops,
    import_tmdb_catalogue,
)
from app.db.database import SessionLocal
from app.integrations.tmdb import (
    DEFAULT_POPULAR_PAGES,
    MAX_POPULAR_PAGES,
    TmdbClient,
    TmdbImportError,
)


def main(argv: list[str] | None = None) -> int:
    """Import a bounded TMDb snapshot without exposing credentials."""

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--pages",
        type=int,
        choices=range(1, MAX_POPULAR_PAGES + 1),
        default=None,
        help="Popular pages to import (default: 1; 13 usually yields about 260 movies).",
    )
    parser.add_argument(
        "--enrich-backdrops",
        action="store_true",
        help="Update backdrop paths on existing active TMDb movies only.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        choices=range(1, MAX_ENRICHMENT_MOVIES + 1),
        default=None,
        help="Maximum movie-detail requests in enrichment mode (default: 300).",
    )
    args = parser.parse_args(argv)
    if args.enrich_backdrops and args.pages is not None:
        parser.error("--pages cannot be combined with --enrich-backdrops")
    if not args.enrich_backdrops and args.limit is not None:
        parser.error("--limit requires --enrich-backdrops")

    try:
        client = TmdbClient.from_environment()
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1

    try:
        with client, SessionLocal() as session, session.begin():
            if args.enrich_backdrops:
                result = enrich_tmdb_backdrops(
                    session,
                    client=client,
                    limit=args.limit or MAX_ENRICHMENT_MOVIES,
                )
            else:
                result = import_tmdb_catalogue(
                    session, client=client, pages=args.pages or DEFAULT_POPULAR_PAGES
                )
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1
    except SQLAlchemyError:
        sys.stderr.write("TMDb catalogue import failed: database write failed\n")
        return 1
    except ValueError:
        sys.stderr.write("TMDb catalogue import failed: catalogue validation failed\n")
        return 1

    if args.enrich_backdrops:
        print("TMDb backdrop enrichment complete")
        print(f"eligible={result.eligible_movie_count}")
        print(f"fetched={result.fetched_movie_count}")
        print(f"remaining={result.eligible_movie_count - result.fetched_movie_count}")
        print(f"updated={result.updated_movie_count}")
        print(f"cleared={result.cleared_movie_count}")
        print(f"unchanged={result.unchanged_movie_count}")
        print(f"missing={result.missing_movie_count}")
        print(f"invalid={result.invalid_movie_count}")
        return 0

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
