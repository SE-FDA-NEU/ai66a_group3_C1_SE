"""Persistence boundary for account-owned movie ratings."""

from __future__ import annotations

from math import isfinite

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import CatalogMovie, UserMovieRating


def get_user_movie_rating(
    session: Session,
    *,
    user_id: str,
    movie_id: str,
) -> UserMovieRating | None:
    """Return only the rating owned by the requested account/movie pair."""

    statement = select(UserMovieRating).where(
        UserMovieRating.user_id == user_id,
        UserMovieRating.movie_id == movie_id,
    )

    return session.scalar(statement)


def set_user_movie_rating(
    session: Session,
    *,
    user_id: str,
    movie_id: str,
    rating: float,
) -> UserMovieRating:
    """Insert or update one account-owned rating in the caller's transaction."""

    if isinstance(rating, bool) or not isinstance(rating, (int, float)):
        raise TypeError("rating must be a number from 0.5 to 5 in half-star steps")

    if not 0.5 <= rating <= 5 or not isfinite(rating) or not float(rating * 2).is_integer():
        raise ValueError("rating must be a number from 0.5 to 5 in half-star steps")

    movie_exists = session.scalar(
        select(CatalogMovie.id).where(
            CatalogMovie.id == movie_id,
        )
    )

    if movie_exists is None:
        raise LookupError("movie does not exist")

    existing = get_user_movie_rating(
        session,
        user_id=user_id,
        movie_id=movie_id,
    )

    if existing is None:
        existing = UserMovieRating(
            user_id=user_id,
            movie_id=movie_id,
            rating=rating,
        )
        session.add(existing)
    else:
        existing.rating = rating

    session.flush()
    return existing
