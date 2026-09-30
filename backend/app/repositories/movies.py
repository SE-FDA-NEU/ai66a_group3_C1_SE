"""Parameterised persistence access for the active local movie catalogue."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from math import isfinite

from sqlalchemy import case, delete, select
from sqlalchemy.orm import Session, selectinload

from app.db.models import (
    CatalogMovie,
    CatalogueRevision,
    CatalogueState,
    Genre,
    MovieGenre,
    new_opaque_id,
    utc_now,
)
from app.schemas.movies import GenreDto, MovieDetailDto, MovieSummaryDto

ACTIVE_CATALOGUE_STATE_ID = 1


def create_catalogue_revision(
    session: Session,
    *,
    provider: str,
    inserted_movie_count: int = 0,
    updated_movie_count: int = 0,
    rejected_movie_count: int = 0,
) -> CatalogueRevision:
    """Create an inactive candidate revision inside the caller's transaction."""

    normalized_provider = provider.strip()
    if not normalized_provider:
        raise ValueError("provider must not be blank")

    revision = CatalogueRevision(
        id=new_opaque_id(),
        provider=normalized_provider,
        inserted_movie_count=inserted_movie_count,
        updated_movie_count=updated_movie_count,
        rejected_movie_count=rejected_movie_count,
    )
    session.add(revision)
    session.flush()
    return revision


def get_active_catalogue_revision(session: Session) -> CatalogueRevision | None:
    """Return the single runtime-visible revision, if a successful one exists."""

    statement = (
        select(CatalogueRevision)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogueRevision.id,
        )
        .where(CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID)
    )
    return session.scalar(statement)


def activate_catalogue_revision(
    session: Session, *, revision_id: str
) -> CatalogueState:
    """Atomically point runtime reads at an existing candidate revision.

    The caller controls commit/rollback so an importer can activate only after
    all of its movie and genre writes have succeeded.
    """

    revision = session.get(CatalogueRevision, revision_id)
    if revision is None:
        raise ValueError("catalogue revision does not exist")

    state = session.get(CatalogueState, ACTIVE_CATALOGUE_STATE_ID)
    if state is None:
        state = CatalogueState(
            id=ACTIVE_CATALOGUE_STATE_ID,
            active_revision_id=revision.id,
        )
        session.add(state)
    else:
        state.active_revision_id = revision.id
        state.updated_at = utc_now()

    session.flush()
    return state


def get_movie_by_source_id(
    session: Session, *, source: str, source_id: str
) -> CatalogMovie | None:
    """Find a provider record without exposing that provider ID to the client."""

    statement = select(CatalogMovie).where(
        CatalogMovie.source == source,
        CatalogMovie.source_id == source_id,
    )
    return session.scalar(statement)


def upsert_catalogue_movie(
    session: Session,
    *,
    catalogue_revision_id: str,
    source: str,
    source_id: str,
    title: str,
    release_year: int | None = None,
    overview: str | None = None,
    popularity_score: float | None = None,
    vote_average: float | None = None,
    vote_count: int | None = None,
    source_fetched_at: datetime | None = None,
) -> CatalogMovie:
    """Insert or refresh one provider movie while preserving its internal ID."""

    normalized_source = source.strip()
    normalized_source_id = source_id.strip()
    normalized_title = title.strip()

    if not normalized_source:
        raise ValueError("source must not be blank")
    if not normalized_source_id:
        raise ValueError("source_id must not be blank")
    if not normalized_title:
        raise ValueError("title must not be blank")
    if session.get(CatalogueRevision, catalogue_revision_id) is None:
        raise ValueError("catalogue revision does not exist")

    movie = get_movie_by_source_id(
        session,
        source=normalized_source,
        source_id=normalized_source_id,
    )
    if movie is None:
        movie = CatalogMovie(
            id=new_opaque_id(),
            catalogue_revision_id=catalogue_revision_id,
            source=normalized_source,
            source_id=normalized_source_id,
            title=normalized_title,
        )
        session.add(movie)
    else:
        movie.catalogue_revision_id = catalogue_revision_id
        movie.title = normalized_title

    movie.release_year = release_year
    movie.overview = _normalise_optional_text(overview)
    movie.popularity_score = _finite_or_none(popularity_score, "popularity_score")
    movie.vote_average = _finite_or_none(vote_average, "vote_average")
    movie.vote_count = vote_count
    movie.source_fetched_at = source_fetched_at or utc_now()
    session.flush()
    return movie


def upsert_genre(session: Session, *, genre_id: int, name: str) -> Genre:
    """Create or refresh a provider genre without duplicating its numeric ID."""

    normalized_name = name.strip()
    if not normalized_name:
        raise ValueError("genre name must not be blank")

    genre = session.get(Genre, genre_id)
    if genre is None:
        genre = Genre(id=genre_id, name=normalized_name)
        session.add(genre)
    else:
        genre.name = normalized_name

    session.flush()
    return genre


def replace_movie_genres(
    session: Session, *, movie: CatalogMovie, genre_ids: Iterable[int]
) -> list[Genre]:
    """Replace a movie's relations with a de-duplicated, validated genre set."""

    unique_genre_ids = list(dict.fromkeys(genre_ids))
    if not unique_genre_ids:
        session.execute(delete(MovieGenre).where(MovieGenre.movie_id == movie.id))
        session.flush()
        return []

    genres = list(
        session.scalars(select(Genre).where(Genre.id.in_(unique_genre_ids)))
    )
    genres_by_id = {genre.id: genre for genre in genres}
    missing_genre_ids = [
        genre_id for genre_id in unique_genre_ids if genre_id not in genres_by_id
    ]
    if missing_genre_ids:
        raise ValueError(f"unknown genre IDs: {missing_genre_ids}")

    session.execute(delete(MovieGenre).where(MovieGenre.movie_id == movie.id))
    session.flush()
    session.add_all(
        MovieGenre(movie_id=movie.id, genre_id=genre_id)
        for genre_id in unique_genre_ids
    )
    session.flush()
    return [genres_by_id[genre_id] for genre_id in unique_genre_ids]


def list_active_movies(session: Session, *, limit: int) -> list[CatalogMovie]:
    """Return only movies in the active revision in deterministic popular order."""

    if not 1 <= limit <= 10:
        raise ValueError("limit must be an integer from 1 to 10")

    statement = (
        select(CatalogMovie)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
        )
        .where(CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID)
        .options(selectinload(CatalogMovie.genres))
        .order_by(
            case((CatalogMovie.popularity_score.is_(None), 1), else_=0),
            CatalogMovie.popularity_score.desc(),
            CatalogMovie.title.asc(),
            CatalogMovie.id.asc(),
        )
        .limit(limit)
    )
    return list(session.scalars(statement).unique())


def get_active_movie_by_id(session: Session, *, movie_id: str) -> CatalogMovie | None:
    """Find an opaque internal movie ID only when it belongs to the active revision."""

    statement = (
        select(CatalogMovie)
        .join(
            CatalogueState,
            CatalogueState.active_revision_id == CatalogMovie.catalogue_revision_id,
        )
        .where(
            CatalogueState.id == ACTIVE_CATALOGUE_STATE_ID,
            CatalogMovie.id == movie_id,
        )
        .options(selectinload(CatalogMovie.genres))
    )
    return session.scalar(statement)


def to_movie_summary_dto(movie: CatalogMovie) -> MovieSummaryDto:
    """Project a catalogue movie to the safe public list-item shape."""

    return MovieSummaryDto(
        id=movie.id,
        title=movie.title,
        releaseYear=movie.release_year,
        genres=[GenreDto(id=genre.id, name=genre.name) for genre in movie.genres],
        popularityScore=movie.popularity_score,
    )


def to_movie_detail_dto(movie: CatalogMovie) -> MovieDetailDto:
    """Project a catalogue movie to the safe public detail shape."""

    return MovieDetailDto(
        id=movie.id,
        title=movie.title,
        releaseYear=movie.release_year,
        genres=[GenreDto(id=genre.id, name=genre.name) for genre in movie.genres],
        overview=movie.overview,
        popularityScore=movie.popularity_score,
        voteAverage=movie.vote_average,
        voteCount=movie.vote_count,
    )


def _normalise_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized_value = value.strip()
    return normalized_value or None


def _finite_or_none(value: float | None, field_name: str) -> float | None:
    if value is None:
        return None
    if not isfinite(value):
        raise ValueError(f"{field_name} must be finite when supplied")
    return value
