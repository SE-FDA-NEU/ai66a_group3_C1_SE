"""Persistence access for the genre catalogue and account-owned preferences."""

from __future__ import annotations

from sqlalchemy import delete, select
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


class GenreNotFoundError(ValueError):
    """At least one requested canonical genre does not exist locally."""


def replace_user_preference_genres(
    session: Session, *, user_id: str, genre_ids: list[int]
) -> list[GenreDto]:
    """Prepare an account-scoped replacement; the caller commits or rolls back.

    Validate the entire set before deleting anything. Flush and project the
    response before commit so a later DTO read cannot fail after a successful
    write. Existing canonical genres remain valid even when no active movie
    currently uses them, as specified by the preference-write contract.
    """

    # Canonical IDs are SQLite INTEGERs. Treat unrepresentable JSON integers
    # as unknown IDs rather than leaking a driver OverflowError as HTTP 500.
    if any(genre_id < -(2**63) or genre_id >= 2**63 for genre_id in genre_ids):
        raise GenreNotFoundError("Genre not found")

    genres = list(
        session.scalars(
            select(Genre).where(Genre.id.in_(genre_ids)).order_by(Genre.name, Genre.id)
        )
    )
    if {genre.id for genre in genres} != set(genre_ids):
        raise GenreNotFoundError("Genre not found")

    session.execute(
        delete(UserGenrePreference).where(UserGenrePreference.user_id == user_id)
    )
    session.add_all(
        UserGenrePreference(user_id=user_id, genre_id=genre_id)
        for genre_id in genre_ids
    )
    session.flush()
    return [GenreDto(id=genre.id, name=genre.name) for genre in genres]


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
    return [
        GenreDto(id=genre.id, name=genre.name) for genre in session.scalars(statement)
    ]


def list_user_preference_genres(session: Session, *, user_id: str) -> list[GenreDto]:
    """Return only the given account's saved genres; empty when none are saved."""

    statement = (
        select(Genre)
        .join(UserGenrePreference, UserGenrePreference.genre_id == Genre.id)
        .where(UserGenrePreference.user_id == user_id)
        .order_by(Genre.name, Genre.id)
    )
    return [
        GenreDto(id=genre.id, name=genre.name) for genre in session.scalars(statement)
    ]
