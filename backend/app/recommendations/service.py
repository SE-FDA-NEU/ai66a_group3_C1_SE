"""Account-scoped orchestration for the Sprint 3 recommendation baseline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import CatalogMovie
from app.repositories.movies import to_movie_summary_dto
from app.repositories.preferences import list_user_preference_genres
from app.repositories.recommendations import (
    count_popular_recommendation_movies,
    list_all_genre_matched_movies,
    list_popular_recommendation_movies,
    list_user_rating_genres,
)
from app.schemas.movies import GenreDto
from app.schemas.recommendations import (
    RecommendationMovieDto,
    RecommendationReason,
)


@dataclass(frozen=True)
class AccountRecommendationResult:
    movies: list[RecommendationMovieDto]
    mode: Literal["popular", "personalised"]
    personalised: bool
    no_match: bool
    total: int
    unfiltered_total: int


def build_account_recommendations(
    session: Session,
    *,
    user_id: str,
    limit: int,
    page: int = 1,
    genre_id: int | None = None,
) -> AccountRecommendationResult:
    """Build recommendations from one session-resolved account and local data.

    This is read-only: a recommendation failure must not clear saved genres.
    Persistence exceptions intentionally propagate to the API's existing 503
    handler; only a successful query with zero matches triggers popular fallback.
    A rating-only read failure preserves the complete preference-based result
    and marks its score basis as unavailable; core read errors still propagate.
    """

    selected_genres = list_user_preference_genres(session, user_id=user_id)
    if not selected_genres:
        return _popular_result(session, limit=limit, page=page,
                               genre_id=genre_id, no_match=False)

    selected_ids = [genre.id for genre in selected_genres]
    matched_movies = list_all_genre_matched_movies(session, genre_ids=selected_ids)
    if not matched_movies:
        return _popular_result(session, limit=limit, page=page,
                               genre_id=genre_id, no_match=True)

    try:
        rating_rows = list_user_rating_genres(session, user_id=user_id)
    except SQLAlchemyError:
        # Core catalogue and preferences have already been read successfully.
        # A rating-only failure must be visible without inventing an empty
        # account history or changing the user's saved preferences.
        rating_rows = None
    genre_signals = _rating_signals_by_genre(rating_rows or [])
    scored = []
    for movie in matched_movies:
        adjustment = _rating_adjustment(movie, genre_signals)
        raw_score = movie.popularity_score
        adjusted_score = raw_score + adjustment if raw_score is not None else None
        basis = (
            "rating_unavailable" if rating_rows is None else
            "rating_signals" if adjustment else "baseline"
        )
        scored.append((movie, adjustment, adjusted_score, basis))
    scored.sort(key=lambda item: (
        item[2] is None,
        -(item[2] if item[2] is not None else 0),
        item[0].title,
        item[0].id,
    ))
    if genre_id is not None:
        scored = [item for item in scored if any(
            genre.id == genre_id for genre in item[0].genres
        )]
    total = len(scored)
    page_rows = scored[(page - 1) * limit:page * limit]

    return AccountRecommendationResult(
        movies=[
            _to_recommendation_movie(
                movie,
                selected_genres=selected_genres,
                rating_adjustment=adjustment,
                adjusted_score=adjusted_score,
                basis=basis,
            )
            for movie, adjustment, adjusted_score, basis in page_rows
        ],
        mode="personalised",
        personalised=True,
        no_match=False,
        total=total,
        unfiltered_total=len(matched_movies),
    )


def _popular_result(
    session: Session,
    *,
    limit: int,
    page: int,
    genre_id: int | None,
    no_match: bool,
) -> AccountRecommendationResult:
    unfiltered_total = count_popular_recommendation_movies(session)
    total = (count_popular_recommendation_movies(session, view_genre_id=genre_id)
             if genre_id is not None else unfiltered_total)
    movies = list_popular_recommendation_movies(
        session, limit=limit, page=page, view_genre_id=genre_id
    )
    return AccountRecommendationResult(
        movies=[
            _to_recommendation_movie(movie, selected_genres=[]) for movie in movies
        ],
        mode="popular",
        personalised=False,
        no_match=no_match,
        total=total,
        unfiltered_total=unfiltered_total,
    )


def _to_recommendation_movie(
    movie: CatalogMovie,
    *,
    selected_genres: list[GenreDto],
    rating_adjustment: int | None = None,
    adjusted_score: float | None = None,
    basis: Literal["baseline", "rating_signals", "rating_unavailable"] | None = None,
) -> RecommendationMovieDto:
    movie_genre_ids = {genre.id for genre in movie.genres}
    matched_genres = [genre for genre in selected_genres if genre.id in movie_genre_ids]
    score_fields = (
        {"ratingAdjustment": rating_adjustment, "adjustedScore": adjusted_score,
         "basis": basis}
        if basis is not None else {}
    )
    return RecommendationMovieDto(
        **to_movie_summary_dto(movie).model_dump(),
        reason=RecommendationReason(matchedGenres=matched_genres),
        **score_fields,
    )


def _rating_signals_by_genre(
    rows: list[tuple[str, int, int]],
) -> dict[int, dict[str, int]]:
    by_genre: dict[int, dict[str, int]] = {}
    for movie_id, rating, genre_id in rows:
        sign = 1 if rating >= 4 else -1 if rating <= 2 else 0
        if sign:
            by_genre.setdefault(genre_id, {})[movie_id] = sign
    return by_genre


def _rating_adjustment(
    movie: CatalogMovie,
    genre_signals: dict[int, dict[str, int]],
) -> int:
    shared_rated_movies: dict[str, int] = {}
    for genre in movie.genres:
        shared_rated_movies.update(genre_signals.get(genre.id, {}))
    return sum(shared_rated_movies.values())
