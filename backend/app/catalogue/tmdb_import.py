"""Validate and atomically activate the required TMDb catalogue import."""

from __future__ import annotations

from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, date, datetime
from math import isfinite
from typing import Any, Protocol

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.catalogue.backdrops import valid_backdrop_path
from app.catalogue.posters import valid_poster_path
from app.catalogue.trailers import Trailer, select_trailer
from app.db.models import CatalogMovie, utc_now
from app.integrations.tmdb import (
    DEFAULT_POPULAR_PAGES,
    MAX_POPULAR_PAGES,
    TMDB_SOURCE,
    TmdbAuthenticationError,
    TmdbImportError,
    TmdbPayloadError,
)
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    get_active_catalogue_revision,
    get_movie_by_source_id,
    replace_movie_genres,
    set_movie_backdrop_path,
    set_movie_poster_path,
    upsert_catalogue_movie,
    upsert_genre,
)


class TmdbCatalogueGateway(Protocol):
    """The small provider boundary needed by the importer and its tests."""

    def fetch_genres(self) -> list[Mapping[str, Any]]: ...

    def fetch_popular_movies(self, page: int) -> list[Mapping[str, Any]]: ...

    def fetch_movie_details(self, movie_id: int) -> Mapping[str, Any]: ...

    def fetch_movie_videos(self, movie_id: int) -> Mapping[str, Any]: ...


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


MAX_ENRICHMENT_MOVIES = 300


@dataclass(frozen=True)
class TmdbBackdropEnrichmentResult:
    """Counts from one bounded media-only pass over the active TMDb catalogue."""

    eligible_movie_count: int
    fetched_movie_count: int
    updated_movie_count: int
    cleared_movie_count: int
    unchanged_movie_count: int
    missing_movie_count: int
    invalid_movie_count: int


@dataclass(frozen=True)
class TmdbPosterEnrichmentResult(TmdbBackdropEnrichmentResult):
    """The same safe counts for an explicitly poster-only update."""


@dataclass(frozen=True)
class TmdbTrailerEnrichmentResult:
    eligible_movie_count: int
    fetched_movie_count: int
    updated_movie_count: int
    cleared_movie_count: int
    unchanged_movie_count: int
    failed_movie_count: int
    authentication_stopped: bool
    remaining_movie_count: int = 0
    with_trailer_movie_count: int = 0
    without_trailer_movie_count: int = 0


@dataclass(frozen=True)
class TmdbTrailerAllResult:
    active_revision_id: str
    eligible_movie_count: int
    processed_movie_count: int
    with_trailer_movie_count: int
    without_trailer_movie_count: int
    failed_movie_count: int
    remaining_movie_count: int
    authentication_stopped: bool


class TmdbTrailerAllDatabaseError(SQLAlchemyError):
    """A failed batch rolled back; earlier committed batches remain resumable."""

    def __init__(self, partial_result: TmdbTrailerAllResult) -> None:
        self.partial_result = partial_result
        super().__init__("trailer enrichment batch failed")


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
    backdrop_fetched: bool
    backdrop_path: str | None
    poster_fetched: bool
    poster_path: str | None


class _RejectedMovie(ValueError):
    """A bad provider record that should not abort an otherwise valid snapshot."""


def import_tmdb_catalogue(
    session: Session,
    *,
    client: TmdbCatalogueGateway,
    fetched_at: datetime | None = None,
    pages: int = DEFAULT_POPULAR_PAGES,
) -> TmdbImportResult:
    """Create and activate one validated TMDb revision in the caller's transaction.

    Provider I/O and validation occur before the first database write.  The
    caller owns commit/rollback, so a provider, validation, or persistence
    failure cannot point runtime reads at a partial revision.
    """

    if type(pages) is not int or not 1 <= pages <= MAX_POPULAR_PAGES:
        raise ValueError(f"pages must be an integer from 1 to {MAX_POPULAR_PAGES}")

    source_fetched_at = _normalise_timestamp(fetched_at or utc_now())
    genres_by_id = _prepare_genres(client.fetch_genres())
    prepared_movies, rejected_movie_count = _prepare_movies(
        client=client,
        genres_by_id=genres_by_id,
        source_fetched_at=source_fetched_at,
        pages=pages,
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
        if prepared_movie.backdrop_fetched:
            set_movie_backdrop_path(
                session, movie_id=movie.id, backdrop_path=prepared_movie.backdrop_path
            )
        if prepared_movie.poster_fetched:
            set_movie_poster_path(
                session, movie_id=movie.id, poster_path=prepared_movie.poster_path
            )
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


def enrich_tmdb_backdrops(
    session: Session, *, client: TmdbCatalogueGateway, limit: int = MAX_ENRICHMENT_MOVIES
) -> TmdbBackdropEnrichmentResult:
    """Fetch media for existing active TMDb movies without changing the revision.

    The caller owns the transaction. Any provider or database failure rolls
    back the whole pass; a missing or invalid field leaves its old value alone.
    There is at most one detail request per selected movie.
    """

    if type(limit) is not int or not 1 <= limit <= MAX_ENRICHMENT_MOVIES:
        raise ValueError(f"limit must be an integer from 1 to {MAX_ENRICHMENT_MOVIES}")
    revision = get_active_catalogue_revision(session)
    if revision is None or revision.provider != TMDB_SOURCE:
        raise ValueError("an active TMDb catalogue is required for backdrop enrichment")

    active_movies = (
        CatalogMovie.catalogue_revision_id == revision.id,
        CatalogMovie.source == TMDB_SOURCE,
    )
    eligible = session.scalar(select(func.count()).select_from(CatalogMovie).where(*active_movies))
    movies = list(
        session.scalars(
            select(CatalogMovie)
            .where(*active_movies)
            .order_by(CatalogMovie.source_id)
            .limit(limit)
        )
    )
    updated = cleared = unchanged = missing = invalid = 0
    for movie in movies:
        # Source IDs are positive integers because the core importer validated
        # them. A corrupted row is a failure, not a reason to fetch a new URL.
        if not movie.source_id.isdecimal() or int(movie.source_id) <= 0:
            raise ValueError("active TMDb catalogue contains an invalid source ID")
        details = client.fetch_movie_details(int(movie.source_id))
        if "backdrop_path" not in details:
            missing += 1
            continue
        path = details["backdrop_path"]
        if path is not None and not valid_backdrop_path(path):
            invalid += 1
            continue
        if movie.backdrop_path == path:
            unchanged += 1
            continue
        set_movie_backdrop_path(session, movie_id=movie.id, backdrop_path=path)
        updated += 1
        if path is None:
            cleared += 1

    return TmdbBackdropEnrichmentResult(
        eligible_movie_count=eligible or 0,
        fetched_movie_count=len(movies),
        updated_movie_count=updated,
        cleared_movie_count=cleared,
        unchanged_movie_count=unchanged,
        missing_movie_count=missing,
        invalid_movie_count=invalid,
    )


def enrich_tmdb_posters(
    session: Session, *, client: TmdbCatalogueGateway, limit: int = MAX_ENRICHMENT_MOVIES
) -> TmdbPosterEnrichmentResult:
    """Bounded poster-only backfill; caller atomically commits or rolls back.

    This never activates a new revision or touches overview/genres/popularity,
    user data, backdrop paths or NLP text/config revision inputs.
    """
    if type(limit) is not int or not 1 <= limit <= MAX_ENRICHMENT_MOVIES:
        raise ValueError(f"limit must be an integer from 1 to {MAX_ENRICHMENT_MOVIES}")
    revision = get_active_catalogue_revision(session)
    if revision is None or revision.provider != TMDB_SOURCE:
        raise ValueError("an active TMDb catalogue is required for poster enrichment")
    active = (CatalogMovie.catalogue_revision_id == revision.id, CatalogMovie.source == TMDB_SOURCE)
    eligible = session.scalar(select(func.count()).select_from(CatalogMovie).where(*active))
    movies = list(session.scalars(select(CatalogMovie).where(*active)
                                  .order_by(CatalogMovie.source_id).limit(limit)))
    updated = cleared = unchanged = missing = invalid = 0
    for movie in movies:
        if not movie.source_id.isdecimal() or int(movie.source_id) <= 0:
            raise ValueError("active TMDb catalogue contains an invalid source ID")
        details = client.fetch_movie_details(int(movie.source_id))
        if "poster_path" not in details:
            missing += 1
            continue
        path = details["poster_path"]
        if path is not None and not valid_poster_path(path):
            invalid += 1
            continue
        if movie.poster_path == path:
            unchanged += 1
            continue
        set_movie_poster_path(session, movie_id=movie.id, poster_path=path)
        updated += 1
        cleared += path is None
    return TmdbPosterEnrichmentResult(
        eligible_movie_count=eligible or 0, fetched_movie_count=len(movies),
        updated_movie_count=updated, cleared_movie_count=cleared,
        unchanged_movie_count=unchanged, missing_movie_count=missing, invalid_movie_count=invalid,
    )


def enrich_tmdb_trailers(
    session: Session, *, client: TmdbCatalogueGateway, limit: int = MAX_ENRICHMENT_MOVIES,
    only_unattempted: bool = False,
) -> TmdbTrailerEnrichmentResult:
    """Backfill active TMDb movies, with one bounded videos request per movie.

    Provider failures retain the last successful trailer and persist only a safe
    status. Database failures roll back the caller's whole transaction.
    """
    if type(limit) is not int or not 1 <= limit <= MAX_ENRICHMENT_MOVIES:
        raise ValueError(f"limit must be an integer from 1 to {MAX_ENRICHMENT_MOVIES}")
    revision = get_active_catalogue_revision(session)
    if revision is None or revision.provider != TMDB_SOURCE:
        raise ValueError("an active TMDb catalogue is required for trailer enrichment")
    active = (CatalogMovie.catalogue_revision_id == revision.id, CatalogMovie.source == TMDB_SOURCE)
    eligible = session.scalar(select(func.count()).select_from(CatalogMovie).where(*active)) or 0
    # A null attempt is a movie this command has never visited. Once every
    # movie has been visited, refresh the oldest attempt first.
    query = select(CatalogMovie).where(*active)
    if only_unattempted:
        query = query.where(CatalogMovie.trailer_attempted_at.is_(None))
    movies = list(session.scalars(query.order_by(
        CatalogMovie.trailer_attempted_at.asc().nullsfirst(), CatalogMovie.source_id
    ).limit(limit)))
    fetched = updated = cleared = unchanged = failed = 0
    authentication_stopped = False
    for movie in movies:
        if not movie.source_id.isdecimal() or int(movie.source_id) <= 0:
            raise ValueError("active TMDb catalogue contains an invalid source ID")
        fetched += 1
        attempted_at = utc_now()
        try:
            trailer = select_trailer(client.fetch_movie_videos(int(movie.source_id)))
        except TmdbImportError as exc:
            movie.trailer_attempted_at = attempted_at
            movie.trailer_status = "stale" if movie.trailer_succeeded_at else "error"
            session.flush()
            failed += 1
            if isinstance(exc, TmdbAuthenticationError):
                authentication_stopped = True
                break
            continue

        before = (movie.trailer_site, movie.trailer_key, movie.trailer_name,
                  movie.trailer_type, movie.trailer_official, movie.trailer_language,
                  _sqlite_utc(movie.trailer_published_at))
        _set_movie_trailer(session, movie, trailer, attempted_at)
        after = (movie.trailer_site, movie.trailer_key, movie.trailer_name,
                 movie.trailer_type, movie.trailer_official, movie.trailer_language,
                 _sqlite_utc(movie.trailer_published_at))
        if before == after:
            unchanged += 1
        else:
            updated += 1
            cleared += trailer is None and before[1] is not None
    remaining = session.scalar(select(func.count()).select_from(CatalogMovie).where(
        *active, CatalogMovie.trailer_attempted_at.is_(None))) or 0
    with_trailer = sum(movie.trailer_key is not None for movie in movies[:fetched])
    return TmdbTrailerEnrichmentResult(
        eligible_movie_count=eligible, fetched_movie_count=fetched,
        remaining_movie_count=remaining,
        with_trailer_movie_count=with_trailer,
        without_trailer_movie_count=fetched - with_trailer,
        updated_movie_count=updated, cleared_movie_count=cleared,
        unchanged_movie_count=unchanged, failed_movie_count=failed,
        authentication_stopped=authentication_stopped,
    )


def enrich_tmdb_trailers_all(
    session_factory: Callable[[], Session], *, client: TmdbCatalogueGateway,
    batch_size: int = MAX_ENRICHMENT_MOVIES,
) -> TmdbTrailerAllResult:
    """Commit each pending-only batch; a later invocation resumes unfinished work."""
    if type(batch_size) is not int or not 1 <= batch_size <= MAX_ENRICHMENT_MOVIES:
        raise ValueError(f"batch_size must be an integer from 1 to {MAX_ENRICHMENT_MOVIES}")
    with session_factory() as session:
        revision = get_active_catalogue_revision(session)
        if revision is None or revision.provider != TMDB_SOURCE:
            raise ValueError("an active TMDb catalogue is required for trailer enrichment")
        revision_id = revision.id
        active = (CatalogMovie.catalogue_revision_id == revision_id,
                  CatalogMovie.source == TMDB_SOURCE)
        eligible = session.scalar(select(func.count()).select_from(CatalogMovie).where(*active)) or 0
        remaining = session.scalar(select(func.count()).select_from(CatalogMovie).where(
            *active, CatalogMovie.trailer_attempted_at.is_(None))) or 0

    processed = with_trailer = without_trailer = failed = 0
    authentication_stopped = False

    def snapshot() -> TmdbTrailerAllResult:
        return TmdbTrailerAllResult(
            active_revision_id=revision_id, eligible_movie_count=eligible,
            processed_movie_count=processed, with_trailer_movie_count=with_trailer,
            without_trailer_movie_count=without_trailer, failed_movie_count=failed,
            remaining_movie_count=remaining, authentication_stopped=authentication_stopped,
        )

    while remaining:
        try:
            with session_factory() as session, session.begin():
                current = get_active_catalogue_revision(session)
                if current is None or current.id != revision_id:
                    raise ValueError("active TMDb catalogue changed during trailer enrichment")
                batch = enrich_tmdb_trailers(
                    session, client=client, limit=min(batch_size, remaining),
                    only_unattempted=True,
                )
        except SQLAlchemyError as exc:
            raise TmdbTrailerAllDatabaseError(snapshot()) from exc
        if batch.fetched_movie_count == 0:
            raise ValueError("pending trailer movies changed during enrichment")
        processed += batch.fetched_movie_count
        with_trailer += batch.with_trailer_movie_count
        without_trailer += batch.without_trailer_movie_count
        failed += batch.failed_movie_count
        remaining = batch.remaining_movie_count
        authentication_stopped = batch.authentication_stopped
        if authentication_stopped:
            break
    return snapshot()


def _set_movie_trailer(
    session: Session, movie: CatalogMovie, trailer: Trailer | None, attempted_at: datetime
) -> None:
    movie.trailer_site = trailer.site if trailer else None
    movie.trailer_key = trailer.key if trailer else None
    movie.trailer_name = trailer.name if trailer else None
    movie.trailer_type = trailer.type if trailer else None
    movie.trailer_official = trailer.official if trailer else None
    movie.trailer_language = trailer.language if trailer else None
    movie.trailer_published_at = trailer.published_at if trailer else None
    movie.trailer_attempted_at = attempted_at
    movie.trailer_succeeded_at = attempted_at
    movie.trailer_status = "success"
    session.flush()


def _sqlite_utc(value: datetime | None) -> datetime | None:
    """SQLite drops timezone metadata; compare UTC instants consistently."""
    if value is None:
        return None
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


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
    pages: int,
) -> tuple[list[_PreparedMovie], int]:
    prepared_movies: list[_PreparedMovie] = []
    seen_source_ids: set[str] = set()
    rejected_movie_count = 0

    for page in range(1, pages + 1):
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
    genre_ids, details = _movie_genre_ids(
        raw_movie,
        movie_id=movie_id,
        client=client,
        known_genre_ids=genres_by_id,
    )
    media = raw_movie if "backdrop_path" in raw_movie else details
    backdrop_fetched = media is not None and "backdrop_path" in media
    backdrop_path = media["backdrop_path"] if backdrop_fetched else None
    if backdrop_path is not None and not valid_backdrop_path(backdrop_path):
        backdrop_fetched = False
        backdrop_path = None
    poster_media = raw_movie if "poster_path" in raw_movie else details
    poster_fetched = poster_media is not None and "poster_path" in poster_media
    poster_path = poster_media["poster_path"] if poster_fetched else None
    if poster_path is not None and not valid_poster_path(poster_path):
        poster_fetched = False
        poster_path = None
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
        backdrop_fetched=backdrop_fetched,
        backdrop_path=backdrop_path,
        poster_fetched=poster_fetched,
        poster_path=poster_path,
    )


def _movie_genre_ids(
    raw_movie: Mapping[str, Any],
    *,
    movie_id: int,
    client: TmdbCatalogueGateway,
    known_genre_ids: Mapping[int, str],
) -> tuple[tuple[int, ...], Mapping[str, Any] | None]:
    details = None
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
    return tuple(genre_ids), details


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
