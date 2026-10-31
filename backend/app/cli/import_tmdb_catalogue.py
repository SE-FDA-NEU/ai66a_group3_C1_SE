"""Run the required, server-only TMDb catalogue import."""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError

from app.catalogue.tmdb_import import (
    MAX_ENRICHMENT_MOVIES,
    TmdbTrailerAllDatabaseError,
    TmdbTrailerAllResult,
    enrich_tmdb_backdrops,
    enrich_tmdb_posters,
    enrich_tmdb_trailers,
    enrich_tmdb_trailers_all,
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
        help="Popular pages to import (1-50; default: 50, up to about 1,000 raw movies).",
    )
    enrichment = parser.add_mutually_exclusive_group()
    enrichment.add_argument(
        "--enrich-backdrops",
        action="store_true",
        help="Update backdrop paths on existing active TMDb movies only.",
    )
    enrichment.add_argument(
        "--enrich-posters", action="store_true",
        help="Update poster paths only, preserving the active catalogue and account data.",
    )
    enrichment.add_argument(
        "--enrich-trailers", action="store_true",
        help="Update optional trailer metadata/status on existing active TMDb movies.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        choices=range(1, MAX_ENRICHMENT_MOVIES + 1),
        default=None,
        help="Maximum movie-detail requests in enrichment mode (default: 300).",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Process every pending active TMDb movie in committed trailer batches.",
    )
    args = parser.parse_args(argv)
    media_only = args.enrich_backdrops or args.enrich_posters or args.enrich_trailers
    if media_only and args.pages is not None:
        parser.error("--pages cannot be combined with media-only enrichment")
    if not media_only and args.limit is not None:
        parser.error("--limit requires an enrichment mode")
    if args.all and not args.enrich_trailers:
        parser.error("--all requires --enrich-trailers")

    try:
        client = TmdbClient.from_environment()
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1

    try:
        with client:
            if args.all:
                result = enrich_tmdb_trailers_all(
                    SessionLocal, client=client,
                    batch_size=args.limit or MAX_ENRICHMENT_MOVIES,
                )
            else:
                with SessionLocal() as session, session.begin():
                    if media_only:
                        enrich = (enrich_tmdb_trailers if args.enrich_trailers else
                                  enrich_tmdb_posters if args.enrich_posters else enrich_tmdb_backdrops)
                        result = enrich(
                            session,
                            client=client,
                            limit=args.limit or MAX_ENRICHMENT_MOVIES,
                        )
                    else:
                        result = import_tmdb_catalogue(
                            session, client=client, pages=args.pages or DEFAULT_POPULAR_PAGES
                        )
    except TmdbTrailerAllDatabaseError as exc:
        _print_trailer_all_result(exc.partial_result, "failed")
        sys.stderr.write("TMDb trailer enrichment failed: current batch rolled back\n")
        return 1
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1
    except SQLAlchemyError:
        sys.stderr.write("TMDb catalogue import failed: database write failed\n")
        return 1
    except ValueError:
        sys.stderr.write("TMDb catalogue import failed: catalogue validation failed\n")
        return 1

    if args.all:
        _print_trailer_all_result(result, "stopped" if result.authentication_stopped else "complete")
        return 1 if result.authentication_stopped or result.failed_movie_count else 0
    if media_only:
        if args.enrich_trailers:
            print("TMDb trailer enrichment stopped" if result.authentication_stopped else "TMDb trailer enrichment complete")
            print(f"eligible={result.eligible_movie_count}")
            print(f"fetched={result.fetched_movie_count}")
            print(f"remaining={result.remaining_movie_count}")
            print(f"updated={result.updated_movie_count}")
            print(f"cleared={result.cleared_movie_count}")
            print(f"unchanged={result.unchanged_movie_count}")
            print(f"failed={result.failed_movie_count}")
            return 1 if result.authentication_stopped or result.failed_movie_count else 0
        print("TMDb poster enrichment complete" if args.enrich_posters else "TMDb backdrop enrichment complete")
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


def _print_trailer_all_result(result: TmdbTrailerAllResult, status: str) -> None:
    print(f"TMDb trailer enrichment all {status}")
    print(f"active_revision={result.active_revision_id}")
    print(f"eligible={result.eligible_movie_count}")
    print(f"processed={result.processed_movie_count}")
    print(f"with_trailer={result.with_trailer_movie_count}")
    print(f"without_trailer={result.without_trailer_movie_count}")
    print(f"failed={result.failed_movie_count}")
    print(f"remaining={result.remaining_movie_count}")


def _utc_timestamp(value: datetime) -> str:
    """Render import provenance in a locale-independent UTC form."""

    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


if __name__ == "__main__":
    raise SystemExit(main())
