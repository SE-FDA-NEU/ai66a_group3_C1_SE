from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, MovieGenre
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    get_active_catalogue_revision,
    get_active_movie_by_id,
    list_active_movies,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    with local_session() as database_session:
        yield database_session
        database_session.rollback()

    Base.metadata.drop_all(engine)
    engine.dispose()


def test_reimport_preserves_the_internal_movie_id(session: Session) -> None:
    first_revision = create_catalogue_revision(session, provider="seed")
    original_movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=first_revision.id,
        source="tmdb",
        source_id="550",
        title="Fight Club",
        release_year=1999,
    )
    original_id = original_movie.id

    second_revision = create_catalogue_revision(session, provider="tmdb")
    refreshed_movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=second_revision.id,
        source="tmdb",
        source_id="550",
        title="Fight Club",
        overview="An insomniac office worker forms an underground club.",
    )

    assert refreshed_movie.id == original_id
    assert refreshed_movie.catalogue_revision_id == second_revision.id
    assert refreshed_movie.overview == "An insomniac office worker forms an underground club."


def test_active_reads_exclude_movies_from_an_older_revision(session: Session) -> None:
    first_revision = create_catalogue_revision(session, provider="seed")
    inactive_movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=first_revision.id,
        source="seed",
        source_id="old-movie",
        title="Older catalogue movie",
        popularity_score=100.0,
    )
    activate_catalogue_revision(session, revision_id=first_revision.id)

    second_revision = create_catalogue_revision(session, provider="seed")
    active_movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=second_revision.id,
        source="seed",
        source_id="new-movie",
        title="Active catalogue movie",
        popularity_score=1.0,
    )
    activate_catalogue_revision(session, revision_id=second_revision.id)

    assert get_active_catalogue_revision(session).id == second_revision.id
    assert [movie.id for movie in list_active_movies(session, limit=10)] == [active_movie.id]
    assert get_active_movie_by_id(session, movie_id=inactive_movie.id) is None
    assert get_active_movie_by_id(session, movie_id=active_movie.id).id == active_movie.id


def test_unknown_active_movie_id_returns_no_record(session: Session) -> None:
    revision = create_catalogue_revision(session, provider="seed")
    activate_catalogue_revision(session, revision_id=revision.id)

    assert get_active_movie_by_id(session, movie_id="does-not-exist") is None


def test_missing_year_and_overview_remain_null(session: Session) -> None:
    revision = create_catalogue_revision(session, provider="seed")
    movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="missing-fields",
        title="Unknown details",
        release_year=None,
        overview=None,
    )

    stored_movie = session.get(CatalogMovie, movie.id)

    assert stored_movie.release_year is None
    assert stored_movie.overview is None


def test_replace_movie_genres_de_duplicates_the_relation(session: Session) -> None:
    revision = create_catalogue_revision(session, provider="seed")
    movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="genre-test",
        title="Genre test",
        source_fetched_at=datetime(2026, 9, 27, tzinfo=UTC),
    )
    upsert_genre(session, genre_id=28, name="Action")
    upsert_genre(session, genre_id=35, name="Comedy")

    assigned_genres = replace_movie_genres(
        session,
        movie=movie,
        genre_ids=[28, 35, 28],
    )

    stored_relations = list(
        session.scalars(
            select(MovieGenre).where(MovieGenre.movie_id == movie.id)
        )
    )

    assert [genre.id for genre in assigned_genres] == [28, 35]
    assert {(relation.movie_id, relation.genre_id) for relation in stored_relations} == {
        (movie.id, 28),
        (movie.id, 35),
    }


def test_no_catalogue_state_has_no_runtime_visible_movies(session: Session) -> None:
    revision = create_catalogue_revision(session, provider="seed")
    movie = upsert_catalogue_movie(
        session,
        catalogue_revision_id=revision.id,
        source="seed",
        source_id="not-active",
        title="Not active yet",
    )

    assert get_active_catalogue_revision(session) is None
    assert list_active_movies(session, limit=10) == []
    assert get_active_movie_by_id(session, movie_id=movie.id) is None


def test_active_movies_use_popularity_then_title_then_internal_id(session: Session) -> None:
    revision = create_catalogue_revision(session, provider="seed")
    lower_id = "00000000-0000-0000-0000-000000000001"
    higher_id = "00000000-0000-0000-0000-000000000002"

    session.add_all(
        [
            CatalogMovie(
                id=higher_id,
                catalogue_revision_id=revision.id,
                source="seed",
                source_id="b-title",
                title="Beta",
                popularity_score=10.0,
            ),
            CatalogMovie(
                id=lower_id,
                catalogue_revision_id=revision.id,
                source="seed",
                source_id="a-title",
                title="Alpha",
                popularity_score=10.0,
            ),
            CatalogMovie(
                id="00000000-0000-0000-0000-000000000003",
                catalogue_revision_id=revision.id,
                source="seed",
                source_id="missing-score",
                title="No popularity",
                popularity_score=None,
            ),
        ]
    )
    session.flush()
    activate_catalogue_revision(session, revision_id=revision.id)

    assert [movie.id for movie in list_active_movies(session, limit=10)] == [
        lower_id,
        higher_id,
        "00000000-0000-0000-0000-000000000003",
    ]
