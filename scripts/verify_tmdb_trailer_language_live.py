"""Read-only TMDb language probe for an isolated S4-T19 smoke database.

Run only after trailer enrichment with DATABASE_URL pointing to the separate
smoke database. The script prints movie IDs and aggregate response properties,
never the provider credential or response bodies.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import select

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.catalogue.trailers import select_trailer
from app.db.database import SessionLocal
from app.db.models import CatalogMovie
from app.integrations.tmdb import TMDB_SOURCE, TmdbClient, TmdbImportError
from app.repositories.movies import get_active_catalogue_revision


def _eligible_languages(payload: dict) -> set[str | None]:
    results = payload.get("results")
    if not isinstance(results, list):
        return set()
    return {
        trailer.language
        for raw in results
        if (trailer := select_trailer({"results": [raw]})) is not None
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--max-candidates", type=int, default=30)
    parser.add_argument("--movie-id", type=int, help="Probe one known TMDb movie ID")
    args = parser.parse_args()
    if not 1 <= args.max_candidates <= 100:
        parser.error("--max-candidates must be 1-100")

    if args.movie_id is not None:
        if args.movie_id <= 0:
            parser.error("--movie-id must be positive")
        movie_ids = [str(args.movie_id)]
    else:
        with SessionLocal() as session:
            revision = get_active_catalogue_revision(session)
            if revision is None or revision.provider != TMDB_SOURCE:
                print("language_probe=no_active_tmdb_catalogue")
                return 1
            movie_ids = list(session.scalars(
                select(CatalogMovie.source_id).where(
                    CatalogMovie.catalogue_revision_id == revision.id,
                    CatalogMovie.source == TMDB_SOURCE,
                    CatalogMovie.trailer_key.is_not(None),
                    CatalogMovie.trailer_language.is_not(None),
                    CatalogMovie.trailer_language != "en",
                ).order_by(CatalogMovie.source_id).limit(args.max_candidates)
            ))

    print(f"candidates={len(movie_ids)}")
    try:
        with TmdbClient.from_environment() as client:
            for source_id in movie_ids:
                movie_id = int(source_id)
                expanded = client.fetch_movie_videos(movie_id)
                default = client._get_json(
                    f"/movie/{movie_id}/videos", params={"language": "en-US"}
                )
                expanded_languages = _eligible_languages(expanded)
                default_languages = _eligible_languages(default)
                print(
                    f"movie_id={movie_id} "
                    f"expanded_count={len(expanded.get('results', []))} "
                    f"default_count={len(default.get('results', []))} "
                    f"expanded_official_languages={','.join(sorted(str(x) for x in expanded_languages)) or '-'} "
                    f"default_official_languages={','.join(sorted(str(x) for x in default_languages)) or '-'}"
                )
                if expanded_languages and "en" not in expanded_languages:
                    print(f"non_english_only_official_trailer={movie_id}")
                    print(f"include_parameter_changes_results={expanded_languages != default_languages}")
                    return 0
    except TmdbImportError as exc:
        print(f"language_probe_error={exc}")
        return 1
    print("non_english_only_official_trailer=none_found")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
