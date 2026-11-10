"""Run the required, server-only TMDb catalogue import."""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime

from sqlalchemy.exc import SQLAlchemyError

from app.catalogue.providers import SUPPORTED_COUNTRIES
from app.catalogue.tmdb_import import (
    MAX_ENRICHMENT_MOVIES,
    TmdbImageAllError,
    TmdbImageAllResult,
    TmdbProviderAllError,
    TmdbProviderAllResult,
    TmdbTrailerAllDatabaseError,
    TmdbTrailerAllResult,
    enrich_tmdb_backdrops,
    enrich_tmdb_images_all,
    enrich_tmdb_posters,
    enrich_tmdb_providers_all,
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
    enrichment.add_argument(
        "--enrich-providers", action="store_true",
        help="Check regional providers and supplied TMDb watch links across the active catalogue.",
    )
    parser.add_argument("--countries", nargs="+", choices=SUPPORTED_COUNTRIES,
                        help="Provider countries (default: US GB SG). Requires --enrich-providers --all.")
    parser.add_argument(
        "--refresh", action="store_true",
        help="Recheck successful/no-data movies too (requires --enrich-providers --all).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        choices=range(1, MAX_ENRICHMENT_MOVIES + 1),
        default=None,
        help="Movies per pass, or per committed batch with --all (1-300; default: 300).",
    )
    parser.add_argument(
        "--all", action="store_true",
        help="Enrich the whole active catalogue in committed batches; trailers/providers resume pending work.",
    )
    args = parser.parse_args(argv)
    media_only = args.enrich_backdrops or args.enrich_posters or args.enrich_trailers or args.enrich_providers
    if media_only and args.pages is not None:
        parser.error("--pages cannot be combined with media-only enrichment")
    if not media_only and args.limit is not None:
        parser.error("--limit requires an enrichment mode")
    if args.all and not media_only:
        parser.error("--all requires an enrichment mode")
    if args.enrich_providers and not args.all:
        parser.error("--enrich-providers requires --all; --limit controls committed batch size")
    if args.refresh and not args.enrich_providers:
        parser.error("--refresh requires --enrich-providers --all")
    if args.countries and not args.enrich_providers:
        parser.error("--countries requires --enrich-providers --all")
    if args.countries and len(set(args.countries)) != len(args.countries):
        parser.error("--countries must contain unique country codes")

    try:
        client = TmdbClient.from_environment()
    except TmdbImportError as exc:
        sys.stderr.write(f"TMDb catalogue import failed: {exc}\n")
        return 1

    try:
        with client:
            if args.enrich_providers:
                result = enrich_tmdb_providers_all(
                    SessionLocal, client=client, batch_size=args.limit or MAX_ENRICHMENT_MOVIES,
                    refresh=args.refresh,
                    countries=tuple(args.countries or SUPPORTED_COUNTRIES),
                )
            elif args.all and args.enrich_trailers:
                result = enrich_tmdb_trailers_all(
                    SessionLocal, client=client,
                    batch_size=args.limit or MAX_ENRICHMENT_MOVIES,
                )
            elif args.all:
                result = enrich_tmdb_images_all(
                    SessionLocal, client=client, media="poster" if args.enrich_posters else "backdrop",
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
    except TmdbProviderAllError as exc:
        _print_provider_all_result(exc.partial_result, "failed")
        sys.stderr.write("TMDb provider enrichment failed: current batch rolled back or catalogue changed\n")
        return 1
    except TmdbImageAllError as exc:
        _print_image_all_result(exc.partial_result, "failed")
        sys.stderr.write(f"TMDb image enrichment failed: {exc.reason}; current batch rolled back\n")
        return 1
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

    if args.enrich_providers:
        stopped = result.authentication_stopped or result.retry_after_seconds is not None
        _print_provider_all_result(result, "stopped" if stopped else "complete")
        return 1 if result.authentication_stopped or result.failed_movie_count else 0
    if args.all and not args.enrich_trailers:
        _print_image_all_result(result, "complete")
        return 0
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
    for reason, count in result.rejection_reasons:
        print(f"rejection_reason[{reason}]={count}")
    print(f"movies={result.movie_count}")
    print(f"associated_genres={result.associated_genre_count}")
    print(f"finite_popularity_movies={result.finite_popularity_movie_count}")
    print(f"source_fetched_at={_utc_timestamp(result.source_fetched_at)}")
    print(f"imported_at={_utc_timestamp(result.imported_at)}")
    print(f"sample_source_ids={','.join(result.sample_source_ids)}")
    return 0


def _print_provider_all_result(result: TmdbProviderAllResult, status: str) -> None:
    print(f"TMDb regional provider enrichment all {status}")
    print(f"active_revision={result.active_revision_id}")
    fields = ("eligible", "already_checked", "processed", "with_data", "no_data", "failed",
              "valid_link", "missing_link", "invalid_link", "remaining")
    for key in fields:
        print(f"{key}={getattr(result, key + '_movie_count')}")
    print(f"movie_fetches={result.movie_fetch_count}")
    print(f"http_requests={result.http_request_count}")
    print(f"http_retries={max(0, result.http_request_count - result.movie_fetch_count)}")
    for region in result.regions:
        for key in fields:
            print(f"{region.country}.{key}={getattr(region, key + '_movie_count')}")
    if result.retry_after_seconds is not None:
        print(f"retry_after_seconds={result.retry_after_seconds}")


def _print_image_all_result(result: TmdbImageAllResult, status: str) -> None:
    print(f"TMDb {result.media} enrichment all {status}")
    print(f"active_revision={result.active_revision_id}")
    print(f"eligible={result.eligible_movie_count}")
    for key in ("processed", "updated", "cleared", "unchanged", "missing", "invalid", "remaining"):
        print(f"{key}={getattr(result, key + '_movie_count')}")


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
