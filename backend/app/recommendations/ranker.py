"""Shared deterministic ordering for popularity-based movie ranking."""

from sqlalchemy import case

from app.db.models import CatalogMovie


def popularity_title_id_ordering():
    """Return the shared deterministic popularity/title/ID ordering."""

    return (
        case((CatalogMovie.popularity_score.is_(None), 1), else_=0),
        CatalogMovie.popularity_score.desc(),
        CatalogMovie.title.asc(),
        CatalogMovie.id.asc(),
    )