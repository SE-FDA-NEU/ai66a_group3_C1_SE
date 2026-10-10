"""Persistence access for the genre catalogue and account-owned preferences."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import (
    CatalogMovie,
    CatalogueState,
    Genre,
    MovieGenre,
    UserGenrePreference,
)
from app.repositories.movies import ACTIVE_CATALOGUE_STATE_ID
from app.schemas.movies import GenreDto


def list_available_genres(session: Session) -> list[GenreDto]:
    """Return genres carried by at least one movie of the active revision.

    A genre no active movie uses could never match a recommendation, so it is
    not offered for selection.  Reads local SQLite only.
    """

    statement = (
        select(Genre)
        .join(MovieGenre, MovieGenre.genre_id == Genre.id)
        .join(CatalogMovie, CatalogMovie.id == MovieGenre.movie_id)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
        )
        .where(CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID)
        .distinct()
        .order_by(Genre.name, Genre.id)
    )
    return [GenreDto(id=genre.id, name=genre.name) for genre in session.scalars(statement)]


def list_user_preference_genres(session: Session, *, user_id: str) -> list[GenreDto]:
    """Return only the given account's saved genres; empty when none are saved."""

    statement = (
        select(Genre)
        .join(UserGenrePreference, UserGenrePreference.genre_id == Genre.id)
        .where(UserGenrePreference.user_id == user_id)
        .order_by(Genre.name, Genre.id)
    )
    return [GenreDto(id=genre.id, name=genre.name) for genre in session.scalars(statement)]
