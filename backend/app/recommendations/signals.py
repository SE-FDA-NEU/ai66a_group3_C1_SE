"""Account rating signals for the later recommendation ranking consumer."""

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CatalogMovie, CatalogueState, MovieGenre, UserMovieRating
from app.repositories.movies import ACTIVE_CATALOGUE_STATE_ID

GenreSignals = dict[int, dict[str, int]]


def load_account_genre_signals(session: Session, *, user_id: str) -> GenreSignals:
    """Read current account's saved ratings in the active local catalogue."""

    statement = (
        select(UserMovieRating.movie_id, UserMovieRating.rating, MovieGenre.genre_id)
        .join(CatalogMovie, CatalogMovie.id == UserMovieRating.movie_id)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
        )
        .join(MovieGenre, MovieGenre.movie_id == UserMovieRating.movie_id)
        .where(
            UserMovieRating.user_id == user_id,
            CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID,
        )
    )
    signals: GenreSignals = {}
    for movie_id, rating, genre_id in session.execute(statement):
        sign = 1 if rating >= 4 else -1 if rating <= 2 else 0
        if sign:
            signals.setdefault(genre_id, {})[movie_id] = sign
    return signals


def adjustment_for_candidate(
    signals: GenreSignals, *, genre_ids: Iterable[int]
) -> int:
    """Sum each related rated movie once, even across shared genres."""

    related: dict[str, int] = {}
    for genre_id in genre_ids:
        related.update(signals.get(genre_id, {}))
    return sum(related.values())
