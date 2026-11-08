"""Prepare the disposable NLP artifact from the active database at app startup."""

from __future__ import annotations

import logging
import time
from collections.abc import Callable

from sqlalchemy.orm import Session

from app.recommendations.overview_index import (
    load_active_index,
    rebuild_active_index,
    resolve_index_path,
)
from app.repositories.movies import get_active_catalogue_revision

# Uvicorn configures this logger at INFO in the documented backend command, so
# the measured startup result is visible to the Neon-backed operator.
logger = logging.getLogger("uvicorn.error")


def prepare_startup_index(session_factory: Callable[[], Session]) -> None:
    """Reuse or rebuild only derived data; an empty baseline can start before import.

    A second database snapshot checks that the active corpus still matches the
    artifact after an import racing the build. No catalogue or account rows are
    written here. A real preparation failure stops startup rather than serving
    Search/Similar with an index known to be unavailable.
    """

    started = time.monotonic()
    with session_factory() as session:
        if get_active_catalogue_revision(session) is None:
            logger.info("NLP index skipped: no active catalogue")
            return
        path = resolve_index_path()
        existed = path.is_file()
        index = rebuild_active_index(session, path)
    with session_factory() as session:
        index = load_active_index(session, path)
    logger.info(
        "NLP index ready: revision=%s movies=%d usable=%d digest=%s "
        "config=%s artifact_existed=%s elapsed_seconds=%.3f",
        index.catalogue_revision,
        len(index.movie_ids),
        index.document_count,
        index.corpus_digest,
        index.config_fingerprint,
        existed,
        time.monotonic() - started,
    )
