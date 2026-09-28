"""Create the deterministic local movie catalogue used by the M2 demo.

This module deliberately owns only the offline bootstrap dataset.  It neither
imports ``httpx`` nor reads TMDb credentials, so the walking skeleton remains
usable from a clean clone without network access.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import CatalogMovie, CatalogueRevision, Genre, MovieGenre
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    get_active_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)

LOCAL_SEED_PROVIDER = "local-m2-seed-v1"
LOCAL_SEED_SOURCE = "local-m2"
LOCAL_SEED_FETCHED_AT = datetime(2026, 9, 28, tzinfo=timezone.utc)


@dataclass(frozen=True)
class SeedGenre:
    """A stable genre record in the offline M2 catalogue."""

    id: int
    name: str


@dataclass(frozen=True)
class SeedMovie:
    """A stable movie record in the offline M2 catalogue."""

    source_id: str
    title: str
    release_year: int | None
    overview: str | None
    popularity_score: float
    vote_average: float
    vote_count: int
    genre_ids: tuple[int, ...]


@dataclass(frozen=True)
class BootstrapResult:
    """The active catalogue identity and row counts after a bootstrap run."""

    active_revision_id: str
    movie_count: int
    genre_count: int
    movie_genre_count: int


LOCAL_SEED_GENRES = (
    SeedGenre(12, "Adventure"),
    SeedGenre(16, "Animation"),
    SeedGenre(18, "Drama"),
    SeedGenre(28, "Action"),
    SeedGenre(35, "Comedy"),
    SeedGenre(53, "Thriller"),
    SeedGenre(878, "Science Fiction"),
    SeedGenre(10749, "Romance"),
)

LOCAL_SEED_MOVIES = (
    SeedMovie(
        "m2-001",
        "Northstar Protocol",
        2024,
        "A rescue pilot follows a damaged beacon beyond the mapped colonies.",
        98.0,
        7.8,
        1_250,
        (28, 878),
    ),
    SeedMovie(
        "m2-002",
        "Quiet Harbour",
        2022,
        "Two strangers rebuild their lives while restoring a storm-damaged pier.",
        92.0,
        7.4,
        930,
        (18, 10749),
    ),
    SeedMovie(
        "m2-003",
        "Paper Planets",
        2020,
        "A young inventor folds a paper map that opens a path between worlds.",
        90.0,
        7.6,
        810,
        (16, 12),
    ),
    SeedMovie(
        "m2-004",
        "The Last Detour",
        2021,
        "A missed exit turns a careful family holiday into an unlikely quest.",
        90.0,
        7.1,
        760,
        (35, 12),
    ),
    SeedMovie(
        "m2-005",
        "Glass Signal",
        2023,
        "An analyst decodes a warning hidden in a city's emergency broadcasts.",
        88.0,
        7.5,
        1_010,
        (53, 878),
    ),
    SeedMovie(
        "m2-006",
        "After the Rain",
        2019,
        "A musician returns home to finish the song her family never heard.",
        85.0,
        7.2,
        640,
        (18,),
    ),
    SeedMovie(
        "m2-007",
        "Red Horizon",
        2024,
        "A climbing team races an approaching dust storm on a distant frontier.",
        84.0,
        7.3,
        1_120,
        (28, 12),
    ),
    SeedMovie(
        "m2-008",
        "Borrowed Summer",
        2022,
        "A practical chef and a carefree traveler exchange homes for one season.",
        80.0,
        6.9,
        540,
        (35, 10749),
    ),
    SeedMovie(
        "m2-009",
        "Echo Room",
        2021,
        "A sound engineer hears messages that predict the next night in town.",
        78.0,
        7.0,
        680,
        (53, 18),
    ),
    SeedMovie(
        "m2-010",
        "Orbit of Us",
        2020,
        "Two astronauts decide whether to return home after a mission changes.",
        75.0,
        7.1,
        710,
        (878, 10749),
    ),
    SeedMovie(
        "m2-011",
        "Archive 17",
        None,
        "A records clerk discovers that one sealed file is still being updated.",
        72.0,
        6.8,
        450,
        (53,),
    ),
    SeedMovie(
        "m2-012",
        "Unfinished Map",
        2023,
        None,
        70.0,
        6.7,
        390,
        (12, 18),
    ),
)


def seed_m2_catalogue(session: Session) -> BootstrapResult:
    """Upsert and activate the fixed M2 catalogue in the caller's transaction.

    Calling this function repeatedly retains the same local revision and the
    same source/movie and movie/genre keys.  The caller is responsible for the
    transaction so a failure cannot leave a partially active catalogue.
    """

    revision, revision_is_new = _get_or_create_local_revision(session)

    for genre in LOCAL_SEED_GENRES:
        upsert_genre(session, genre_id=genre.id, name=genre.name)

    inserted_movie_count = 0
    updated_movie_count = 0
    for seed_movie in LOCAL_SEED_MOVIES:
        existing_movie = session.scalar(
            select(CatalogMovie).where(
                CatalogMovie.source == LOCAL_SEED_SOURCE,
                CatalogMovie.source_id == seed_movie.source_id,
            )
        )
        movie = upsert_catalogue_movie(
            session,
            catalogue_revision_id=revision.id,
            source=LOCAL_SEED_SOURCE,
            source_id=seed_movie.source_id,
            title=seed_movie.title,
            release_year=seed_movie.release_year,
            overview=seed_movie.overview,
            popularity_score=seed_movie.popularity_score,
            vote_average=seed_movie.vote_average,
            vote_count=seed_movie.vote_count,
            source_fetched_at=LOCAL_SEED_FETCHED_AT,
        )
        replace_movie_genres(session, movie=movie, genre_ids=seed_movie.genre_ids)
        if existing_movie is None:
            inserted_movie_count += 1
        else:
            updated_movie_count += 1

    if revision_is_new:
        revision.inserted_movie_count = inserted_movie_count
        revision.updated_movie_count = updated_movie_count

    active_revision = get_active_catalogue_revision(session)
    if active_revision is None or active_revision.id != revision.id:
        activate_catalogue_revision(session, revision_id=revision.id)

    movie_count, genre_count, movie_genre_count = _active_counts(session, revision.id)
    return BootstrapResult(
        active_revision_id=revision.id,
        movie_count=movie_count,
        genre_count=genre_count,
        movie_genre_count=movie_genre_count,
    )


def _get_or_create_local_revision(
    session: Session,
) -> tuple[CatalogueRevision, bool]:
    revisions = list(
        session.scalars(
            select(CatalogueRevision)
            .where(CatalogueRevision.provider == LOCAL_SEED_PROVIDER)
            .order_by(CatalogueRevision.created_at.asc(), CatalogueRevision.id.asc())
        )
    )
    if len(revisions) > 1:
        raise RuntimeError(
            "multiple local M2 seed revisions exist; repair the local database "
            "before running the bootstrap again"
        )
    if revisions:
        return revisions[0], False
    return create_catalogue_revision(session, provider=LOCAL_SEED_PROVIDER), True


def _active_counts(session: Session, revision_id: str) -> tuple[int, int, int]:
    movie_count = session.scalar(
        select(func.count(CatalogMovie.id)).where(
            CatalogMovie.catalogue_revision_id == revision_id
        )
    )
    movie_genre_count = session.scalar(
        select(func.count(MovieGenre.movie_id))
        .join(CatalogMovie, CatalogMovie.id == MovieGenre.movie_id)
        .where(CatalogMovie.catalogue_revision_id == revision_id)
    )
    genre_count = session.scalar(
        select(func.count(func.distinct(Genre.id)))
        .join(MovieGenre, MovieGenre.genre_id == Genre.id)
        .join(CatalogMovie, CatalogMovie.id == MovieGenre.movie_id)
        .where(CatalogMovie.catalogue_revision_id == revision_id)
    )
    return int(movie_count or 0), int(genre_count or 0), int(movie_genre_count or 0)
