"""Persistence boundary for resetting account-owned personalisation data."""

from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.db.models import UserGenrePreference, UserMovieRating


def reset_user_personalisation(session: Session, *, user_id: str) -> None:
    """Delete one account's preferences and ratings in the caller's transaction."""

    session.execute(
        delete(UserGenrePreference).where(
            UserGenrePreference.user_id == user_id,
        )
    )
    session.execute(
        delete(UserMovieRating).where(
            UserMovieRating.user_id == user_id,
        )
    )
