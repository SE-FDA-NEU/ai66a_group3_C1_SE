"""Account-scoped recommendations extending the Sprint 3 baseline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.models import CatalogMovie
from app.recommendations.ranker import rank_personalised_movies
from app.recommendations.signals import load_account_genre_signals
from app.repositories.movies import to_movie_summary_dto
from app.repositories.preferences import list_user_preference_genres
from app.repositories.recommendations import (
    count_genre_matched_movies,
    count_popular_recommendation_movies,
    list_genre_matched_movies,
    list_popular_recommendation_movies,
)
from app.schemas.movies import GenreDto
from app.schemas.recommendations import (
    PersonalisedRecommendationMovieDto,
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
    Only the optional rating read may degrade to the valid baseline. Core
    reads and authentication remain outside that narrow error boundary.
    """

    selected_genres = list_user_preference_genres(session, user_id=user_id)
    if not selected_genres:
        return _popular_result(session, limit=limit, page=page,
                               genre_id=genre_id, no_match=False)

    selected_ids = [genre.id for genre in selected_genres]
    unfiltered_total = count_genre_matched_movies(session, genre_ids=selected_ids)
    if unfiltered_total == 0:
        return _popular_result(session, limit=limit, page=page,
                               genre_id=genre_id, no_match=True)
    total = count_genre_matched_movies(
        session, genre_ids=selected_ids, view_genre_id=genre_id
    ) if genre_id is not None else unfiltered_total
    matched_movies = list_genre_matched_movies(
        session,
        genre_ids=selected_ids,
        limit=None,
    )

    # Catalogue/preferences/candidate genres have succeeded before attempting
    # the optional read. No cached personal state survives this request.
    ratings_available = True
    try:
        signals = load_account_genre_signals(session, user_id=user_id)
    except SQLAlchemyError:
        signals = {}
        ratings_available = False
    ranked = rank_personalised_movies(
        matched_movies, signals=signals, ratings_available=ratings_available
    )
    if genre_id is not None:
        ranked = [rank for rank in ranked
                  if any(genre.id == genre_id for genre in rank.movie.genres)]
    start = (page - 1) * limit

    return AccountRecommendationResult(
        movies=[
            PersonalisedRecommendationMovieDto(
                **_to_recommendation_movie(
                    rank.movie, selected_genres=selected_genres
                ).model_dump(),
                ratingAdjustment=rank.rating_adjustment,
                adjustedScore=rank.adjusted_score,
                basis=rank.basis,
            )
            for rank in ranked[start:start + limit]
        ],
        mode="personalised",
        personalised=True,
        no_match=False,
        total=total,
        unfiltered_total=unfiltered_total,
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
) -> RecommendationMovieDto:
    movie_genre_ids = {genre.id for genre in movie.genres}
    matched_genres = [genre for genre in selected_genres if genre.id in movie_genre_ids]
    return RecommendationMovieDto(
        **to_movie_summary_dto(movie).model_dump(),
        reason=RecommendationReason(matchedGenres=matched_genres),
    )
