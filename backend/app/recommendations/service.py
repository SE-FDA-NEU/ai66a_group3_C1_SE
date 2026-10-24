"""Account-scoped orchestration for the Sprint 3 recommendation baseline."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import CatalogMovie
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
    Ratings remain a separate Sprint 4 ranking extension, not an error fallback
    or an input to this Sprint 3 genre/popularity baseline.
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
        limit=limit,
        page=page,
        view_genre_id=genre_id,
    )

    return AccountRecommendationResult(
        movies=[
            _to_recommendation_movie(movie, selected_genres=selected_genres)
            for movie in matched_movies
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
