"""Persistence queries for recommendation results."""

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db.models import CatalogMovie, CatalogueState
from app.recommendations.ranker import popularity_title_id_ordering
from app.repositories.movies import ACTIVE_CATALOGUE_STATE_ID


def list_popular_recommendation_movies(
    session: Session,
    *,
    limit: int,
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
        )
        .options(selectinload(CatalogMovie.genres))
        .order_by(*popularity_title_id_ordering())
        .limit(limit)
    )

    return list(session.scalars(statement).unique())