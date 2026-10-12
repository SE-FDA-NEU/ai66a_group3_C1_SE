"""Account-scoped orchestration for the Sprint 3 recommendation baseline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import CatalogMovie
from app.repositories.movies import to_movie_summary_dto
from app.repositories.preferences import list_user_preference_genres
from app.repositories.recommendations import (
    list_genre_matched_movies,
    list_popular_recommendation_movies,
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


def build_account_recommendations(
    session: Session,
    *,
    user_id: str,
    limit: int,
) -> AccountRecommendationResult:
    """Build recommendations from one session-resolved account and local data.

    This is read-only: a recommendation failure must not clear saved genres.
    Persistence exceptions intentionally propagate to the API's existing 503
    handler; only a successful query with zero matches triggers popular fallback.
    Ratings remain a separate Sprint 4 ranking extension, not an error fallback
    or an input to this Sprint 3 genre/popularity baseline.
    """

    selected_genres = list_user_preference_genres(session, user_id=user_id)
    if not selected_genres:
        return _popular_result(session, limit=limit, no_match=False)

    matched_movies = list_genre_matched_movies(
        session,
        genre_ids=(genre.id for genre in selected_genres),
        limit=limit,
    )
    if not matched_movies:
        return _popular_result(session, limit=limit, no_match=True)

    return AccountRecommendationResult(
        movies=[
            _to_recommendation_movie(movie, selected_genres=selected_genres)
            for movie in matched_movies
        ],
        mode="personalised",
        personalised=True,
        no_match=False,
    )


def _popular_result(
    session: Session,
    *,
    limit: int,
    no_match: bool,
) -> AccountRecommendationResult:
    movies = list_popular_recommendation_movies(session, limit=limit)
    return AccountRecommendationResult(
        movies=[
            _to_recommendation_movie(movie, selected_genres=[]) for movie in movies
        ],
        mode="popular",
        personalised=False,
        no_match=no_match,
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
