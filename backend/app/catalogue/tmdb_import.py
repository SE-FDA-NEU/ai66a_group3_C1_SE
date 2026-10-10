"""Validate and atomically activate the required TMDb catalogue import."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime
from math import isfinite
from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.db.models import utc_now
from app.integrations.tmdb import MAX_POPULAR_PAGES, TMDB_SOURCE, TmdbPayloadError
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    get_movie_by_source_id,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)


class TmdbCatalogueGateway(Protocol):
    """The small provider boundary needed by the importer and its tests."""

    def fetch_genres(self) -> list[Mapping[str, Any]]: ...

    def fetch_popular_movies(self, page: int) -> list[Mapping[str, Any]]: ...

    def fetch_movie_details(self, movie_id: int) -> Mapping[str, Any]: ...


@dataclass(frozen=True)
class TmdbImportResult:
    """Safe provenance summary printed after a successful import commit."""

    active_revision_id: str
    inserted_movie_count: int
    updated_movie_count: int
    rejected_movie_count: int
    movie_count: int
    associated_genre_count: int
    finite_popularity_movie_count: int
    source_fetched_at: datetime
    imported_at: datetime
    sample_source_ids: tuple[str, ...]


@dataclass(frozen=True)
class _PreparedMovie:
    source_id: str
    title: str
    release_year: int | None
    overview: str | None
    popularity_score: float | None
    vote_average: float | None
    vote_count: int | None
    genre_ids: tuple[int, ...]
    source_fetched_at: datetime


class _RejectedMovie(ValueError):
    """A bad provider record that should not abort an otherwise valid snapshot."""


def import_tmdb_catalogue(
    session: Session,
    *,
    client: TmdbCatalogueGateway,
    fetched_at: datetime | None = None,
) -> TmdbImportResult:
    """Create and activate one validated TMDb revision in the caller's transaction.

    Provider I/O and validation occur before the first database write.  The
    caller owns commit/rollback, so a provider, validation, or persistence
    failure cannot point runtime reads at a partial revision.
    """

    source_fetched_at = _normalise_timestamp(fetched_at or utc_now())
    genres_by_id = _prepare_genres(client.fetch_genres())
    prepared_movies, rejected_movie_count = _prepare_movies(
        client=client,
        genres_by_id=genres_by_id,
        source_fetched_at=source_fetched_at,
    )
    if not prepared_movies:
        raise TmdbPayloadError("TMDb did not return any usable movies")

    associated_genre_count = len(
        {genre_id for movie in prepared_movies for genre_id in movie.genre_ids}
    )
    finite_popularity_movie_count = sum(
        movie.popularity_score is not None for movie in prepared_movies
    )

    revision = create_catalogue_revision(session, provider=TMDB_SOURCE)
    for genre_id, name in genres_by_id.items():
        upsert_genre(session, genre_id=genre_id, name=name)

    inserted_movie_count = 0
    updated_movie_count = 0
    for prepared_movie in prepared_movies:
        existing_movie = get_movie_by_source_id(
            session,
            source=TMDB_SOURCE,
            source_id=prepared_movie.source_id,
        )
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=revision.id,
            source=TMDB_SOURCE,
            source_id=prepared_movie.source_id,
            title=prepared_movie.title,
            release_year=prepared_movie.release_year,
            overview=prepared_movie.overview,
            popularity_score=prepared_movie.popularity_score,
            vote_average=prepared_movie.vote_average,
            vote_count=prepared_movie.vote_count,
            source_fetched_at=prepared_movie.source_fetched_at,
        )
        replace_movie_genres(session, movie=movie, genre_ids=prepared_movie.genre_ids)
        if existing_movie is None:
            inserted_movie_count += 1
        else:
            updated_movie_count += 1

    revision.inserted_movie_count = inserted_movie_count
    revision.updated_movie_count = updated_movie_count
    revision.rejected_movie_count = rejected_movie_count
    activate_catalogue_revision(session, revision_id=revision.id)

    return TmdbImportResult(
        active_revision_id=revision.id,
        inserted_movie_count=inserted_movie_count,
        updated_movie_count=updated_movie_count,
        rejected_movie_count=rejected_movie_count,
        movie_count=len(prepared_movies),
        associated_genre_count=associated_genre_count,
        finite_popularity_movie_count=finite_popularity_movie_count,
        source_fetched_at=source_fetched_at,
        imported_at=revision.created_at,
        sample_source_ids=tuple(movie.source_id for movie in prepared_movies[:3]),
    )


def _prepare_genres(raw_genres: list[Mapping[str, Any]]) -> dict[int, str]:
    genres_by_id: dict[int, str] = {}
    for raw_genre in raw_genres:
        try:
            genre_id = _positive_integer(raw_genre.get("id"))
            name = _required_text(raw_genre.get("name"))
        except _RejectedMovie as exc:
            raise TmdbPayloadError("TMDb returned an invalid genre payload") from exc
        if genre_id in genres_by_id:
            raise TmdbPayloadError("TMDb returned duplicate genre IDs")
        genres_by_id[genre_id] = name

    if not genres_by_id:
        raise TmdbPayloadError("TMDb returned no usable genres")
    return genres_by_id


def _prepare_movies(
    *,
    client: TmdbCatalogueGateway,
    genres_by_id: Mapping[int, str],
    source_fetched_at: datetime,
) -> tuple[list[_PreparedMovie], int]:
    prepared_movies: list[_PreparedMovie] = []
    seen_source_ids: set[str] = set()
    rejected_movie_count = 0

    for page in range(1, MAX_POPULAR_PAGES + 1):
        for raw_movie in client.fetch_popular_movies(page):
            try:
                prepared_movie = _prepare_movie(
                    raw_movie,
                    client=client,
                    genres_by_id=genres_by_id,
                    source_fetched_at=source_fetched_at,
                )
            except _RejectedMovie:
                rejected_movie_count += 1
                continue

            if prepared_movie.source_id in seen_source_ids:
                rejected_movie_count += 1
                continue
            seen_source_ids.add(prepared_movie.source_id)
            prepared_movies.append(prepared_movie)

    return prepared_movies, rejected_movie_count


def _prepare_movie(
    raw_movie: Mapping[str, Any],
    *,
    client: TmdbCatalogueGateway,
    genres_by_id: Mapping[int, str],
    source_fetched_at: datetime,
) -> _PreparedMovie:
    movie_id = _positive_integer(raw_movie.get("id"))
    title = _required_text(raw_movie.get("title"))
    genre_ids = _movie_genre_ids(
        raw_movie,
        movie_id=movie_id,
        client=client,
        known_genre_ids=genres_by_id,
    )
    return _PreparedMovie(
        source_id=str(movie_id),
        title=title,
        release_year=_release_year_or_none(raw_movie.get("release_date")),
        overview=_optional_text(raw_movie.get("overview")),
        popularity_score=_finite_float_or_none(raw_movie.get("popularity")),
        vote_average=_finite_float_or_none(raw_movie.get("vote_average")),
        vote_count=_non_negative_integer_or_none(raw_movie.get("vote_count")),
        genre_ids=genre_ids,
        source_fetched_at=source_fetched_at,
    )


def _movie_genre_ids(
    raw_movie: Mapping[str, Any],
    *,
    movie_id: int,
    client: TmdbCatalogueGateway,
    known_genre_ids: Mapping[int, str],
) -> tuple[int, ...]:
    if "genre_ids" in raw_movie:
        raw_genre_ids = raw_movie["genre_ids"]
    else:
        details = client.fetch_movie_details(movie_id)
        raw_genres = details.get("genres")
        if not isinstance(raw_genres, list):
            raise _RejectedMovie("movie details are missing genres")
        raw_genre_ids = [
            genre.get("id") if isinstance(genre, Mapping) else None
            for genre in raw_genres
        ]

    if not isinstance(raw_genre_ids, list):
        raise _RejectedMovie("movie genre IDs must be a list")

    genre_ids: list[int] = []
    for raw_genre_id in raw_genre_ids:
        genre_id = _positive_integer(raw_genre_id)
        if genre_id not in known_genre_ids:
            raise _RejectedMovie("movie references an unknown genre")
        if genre_id not in genre_ids:
            genre_ids.append(genre_id)
    return tuple(genre_ids)


def _positive_integer(value: Any) -> int:
    if isinstance(value, bool):
        raise _RejectedMovie("value must be a positive integer")
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, str) and value.isdecimal() and int(value) > 0:
        return int(value)
    raise _RejectedMovie("value must be a positive integer")


def _required_text(value: Any) -> str:
    if not isinstance(value, str):
        raise _RejectedMovie("value must be non-empty text")
    normalized_value = value.strip()
    if not normalized_value:
        raise _RejectedMovie("value must be non-empty text")
    return normalized_value


def _optional_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    normalized_value = value.strip()
    return normalized_value or None


def _release_year_or_none(value: Any) -> int | None:
    if not isinstance(value, str):
        return None
    try:
        return date.fromisoformat(value).year
    except ValueError:
        return None


def _finite_float_or_none(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if isfinite(number) else None


def _non_negative_integer_or_none(value: Any) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value >= 0:
        return value
    if isinstance(value, float) and isfinite(value) and value >= 0 and value.is_integer():
        return int(value)
    return None


def _normalise_timestamp(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("fetched_at must be timezone-aware")
    return value.astimezone(UTC)
