"""Local, account-scoped watchlist queries; callers own transactions."""

from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import CatalogMovie, CatalogueState, UserMovieWatchlist
from app.repositories.movies import ACTIVE_CATALOGUE_STATE_ID


def membership(session: Session, *, user_id: str, movie_id: str) -> UserMovieWatchlist | None:
    return session.scalar(select(UserMovieWatchlist).where(
        UserMovieWatchlist.user_id == user_id,
        UserMovieWatchlist.movie_id == movie_id,
    ))


def add_movie(session: Session, *, user_id: str, movie_id: str) -> UserMovieWatchlist:
    row = membership(session, user_id=user_id, movie_id=movie_id)
    if row is None:
        row = UserMovieWatchlist(user_id=user_id, movie_id=movie_id)
        session.add(row)
        session.flush()
    return row


def remove_movie(session: Session, *, user_id: str, movie_id: str) -> None:
    session.execute(delete(UserMovieWatchlist).where(
        UserMovieWatchlist.user_id == user_id,
        UserMovieWatchlist.movie_id == movie_id,
    ))


def count_user_movies(session: Session, *, user_id: str, active_only: bool = False) -> int:
    statement = select(func.count()).select_from(UserMovieWatchlist).where(
        UserMovieWatchlist.user_id == user_id
    )
    if active_only:
        statement = statement.join(CatalogMovie, CatalogMovie.id == UserMovieWatchlist.movie_id).join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
        ).where(CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID)
    return session.scalar(statement) or 0


def list_user_movies(session: Session, *, user_id: str, page: int, limit: int) -> list[tuple[UserMovieWatchlist, CatalogMovie]]:
    statement = (
        select(UserMovieWatchlist, CatalogMovie)
        .join(CatalogMovie, CatalogMovie.id == UserMovieWatchlist.movie_id)
        .join(CatalogueState, CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id)
        .where(UserMovieWatchlist.user_id == user_id, CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID)
        .options(selectinload(CatalogMovie.genres))
        .order_by(UserMovieWatchlist.added_at.desc(), CatalogMovie.id.asc())
        .limit(limit).offset((page - 1) * limit)
    )
    return list(session.execute(statement).unique().all())


def utc_iso(value: datetime) -> str:
    # SQLite reads DateTime(timezone=True) without tzinfo; stored values are UTC.
    return value.replace(tzinfo=UTC).isoformat().replace("+00:00", "Z")
