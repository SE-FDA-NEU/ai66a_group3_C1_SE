"""Build or check the shared local overview index without network access."""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app.db.database import SessionLocal
from app.recommendations.overview_index import (
    DEFAULT_INDEX_PATH,
    IndexUnavailable,
    load_active_index,
    rebuild_active_index,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("rebuild", "check"))
    parser.add_argument(
        "--path", type=Path,
        default=Path(os.environ.get("NLP_INDEX_PATH", DEFAULT_INDEX_PATH)),
        help="JSON artifact path (default: NLP_INDEX_PATH or project data directory)",
    )
    args = parser.parse_args(argv)
    try:
        with SessionLocal() as session:
            index = (
                rebuild_active_index(session, args.path)
                if args.action == "rebuild" else load_active_index(session, args.path)
            )
        # Open a fresh read snapshot after replacing an artifact. If catalogue
        # text changed during the build, this second check fails instead of
        # claiming that the new artifact is ready.
        if args.action == "rebuild":
            with SessionLocal() as session:
                index = load_active_index(session, args.path)
    except (IndexUnavailable, SQLAlchemyError, OSError) as exc:
        print(f"overview index unavailable: {exc}", file=sys.stderr)
        return 1
    print("ready=true")
    print(f"catalogueRevision={index.catalogue_revision}")
    print(f"corpusDigest={index.corpus_digest}")
    print(f"configFingerprint={index.config_fingerprint}")
    print(f"movies={len(index.movie_ids)}")
    print(f"usableDocuments={index.document_count}")
    print(f"vocabularyTerms={len(index.idf)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
