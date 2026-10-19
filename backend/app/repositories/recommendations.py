"""Persistence queries for recommendation results."""

from collections.abc import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import CatalogMovie, CatalogueState, MovieGenre
from app.recommendations.ranker import popularity_title_id_ordering
from app.repositories.movies import ACTIVE_CATALOGUE_STATE_ID


def list_popular_recommendation_movies(
    session: Session,
    *,
    limit: int,
    page: int = 1,
    view_genre_id: int | None = None,
) -> list[CatalogMovie]:
    """Return usable popular movies from the active catalogue.

    Recommendation fallback requires a usable popularity score. Movies without
    one are therefore excluded rather than appended to the result.
    """

    if not 1 <= limit <= 10:
        raise ValueError("limit must be an integer from 1 to 10")

    statement = (
        select(CatalogMovie)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id
            == CatalogMovie.catalogue_revision_id,
        )
        .where(
            CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID,
            CatalogMovie.popularity_score.is_not(None),
            CatalogMovie.popularity_score < float("inf"),
            CatalogMovie.popularity_score > float("-inf"),
        )
    )
    if view_genre_id is not None:
        statement = statement.where(_has_genre(view_genre_id))
    statement = (statement.options(selectinload(CatalogMovie.genres))
        .order_by(*popularity_title_id_ordering()).limit(limit)
        .offset((page - 1) * limit))
    return list(session.scalars(statement).unique())


def _has_genre(genre_id: int):
    return select(MovieGenre.movie_id).where(
        MovieGenre.movie_id == CatalogMovie.id,
        MovieGenre.genre_id == genre_id,
    ).exists()


def count_popular_recommendation_movies(
    session: Session, *, view_genre_id: int | None = None
) -> int:
    statement = select(func.count(CatalogMovie.id)).join(
        CatalogueState,
        CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
    ).where(
        CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID,
        CatalogMovie.popularity_score.is_not(None),
        CatalogMovie.popularity_score < float("inf"),
        CatalogMovie.popularity_score > float("-inf"),
    )
    if view_genre_id is not None:
        statement = statement.where(_has_genre(view_genre_id))
    return session.scalar(statement) or 0


def list_genre_matched_movies(
    session: Session,
    *,
    genre_ids: Iterable[int],
    limit: int,
    page: int = 1,
    view_genre_id: int | None = None,
) -> list[CatalogMovie]:
    """Return active-catalogue movies sharing at least one of the genres.

    Eligibility is an ``EXISTS`` test, so a movie matching several selected
    genres is one candidate, never several joined rows. The whole eligible set
    is ranked before ``limit`` is applied. A movie without a popularity score
    stays eligible and sorts after every finite score; no zero is invented.
    """

    if not 1 <= limit <= 10:
        raise ValueError("limit must be an integer from 1 to 10")

    selected_genre_ids = set(genre_ids)
    if not selected_genre_ids:
        return []

    shares_selected_genre = (
        select(MovieGenre.movie_id)
        .where(
            MovieGenre.movie_id == CatalogMovie.id,
            MovieGenre.genre_id.in_(selected_genre_ids),
        )
        .exists()
    )
    statement = (
        select(CatalogMovie)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id
            == CatalogMovie.catalogue_revision_id,
        )
        .where(
            CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID,
            shares_selected_genre,
        )
    )
    if view_genre_id is not None:
        statement = statement.where(_has_genre(view_genre_id))
    statement = (statement.options(selectinload(CatalogMovie.genres))
        .order_by(*popularity_title_id_ordering()).limit(limit)
        .offset((page - 1) * limit))
    return list(session.scalars(statement).unique())


def count_genre_matched_movies(
    session: Session, *, genre_ids: Iterable[int], view_genre_id: int | None = None
) -> int:
    selected = set(genre_ids)
    if not selected:
        return 0
    shares_selected = select(MovieGenre.movie_id).where(
        MovieGenre.movie_id == CatalogMovie.id,
        MovieGenre.genre_id.in_(selected),
    ).exists()
    statement = select(func.count(CatalogMovie.id)).join(
        CatalogueState,
        CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
    ).where(CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID, shares_selected)
    if view_genre_id is not None:
        statement = statement.where(_has_genre(view_genre_id))
    return session.scalar(statement) or 0
