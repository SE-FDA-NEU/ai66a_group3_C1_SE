"""Shared deterministic ordering for popularity-based movie ranking."""

from dataclasses import dataclass
from typing import Literal

from sqlalchemy import case

from app.db.models import CatalogMovie
from app.recommendations.signals import GenreSignals, adjustment_for_candidate


def popularity_title_id_ordering():
    """Return the shared deterministic popularity/title/ID ordering."""

    return score_title_id_ordering(
        CatalogMovie.popularity_score, CatalogMovie.title, CatalogMovie.id, sql=True
    )


def score_title_id_ordering(score, title, movie_id, *, sql: bool):
    """One comparator for SQL catalogue reads and computed personal scores.

    SQL expressions and Python values need different operators, but use the
    same null-last, descending-score, ascending-title/ID ordering components.
    """

    return (
        case((score.is_(None), 1), else_=0) if sql else score is None,
        score.desc() if sql else (-score if score is not None else 0),
        title.asc() if sql else title,
        movie_id.asc() if sql else movie_id,
    )


@dataclass(frozen=True)
class PersonalRanking:
    """The same computed values drive ordering and the protected DTO."""

    movie: CatalogMovie
    rating_adjustment: int
    adjusted_score: float | None
    basis: Literal["rating_signals", "baseline", "rating_unavailable"]


def rank_personalised_movies(
    movies: list[CatalogMovie],
    *,
    signals: GenreSignals,
    ratings_available: bool,
) -> list[PersonalRanking]:
    """Extend the shared popularity/title/ID order across all eligible movies.

    The repository supplies distinct eligible candidates without a page limit.
    Keep all score computation here so response metadata cannot disagree with
    the comparator. Popular fallbacks continue to use the SQL ordering above.
    """

    ranked = []
    for movie in movies:
        adjustment = adjustment_for_candidate(
            signals, genre_ids=(genre.id for genre in movie.genres)
        ) if ratings_available else 0
        score = (movie.popularity_score + adjustment
                 if movie.popularity_score is not None else None)
        ranked.append(PersonalRanking(
            movie=movie,
            rating_adjustment=adjustment,
            adjusted_score=score,
            basis=("rating_unavailable" if not ratings_available else
                   "rating_signals" if adjustment else "baseline"),
        ))
    return sorted(ranked, key=lambda rank: score_title_id_ordering(
        rank.adjusted_score, rank.movie.title, rank.movie.id, sql=False,
    ))
