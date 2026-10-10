from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.db.models import (
    CatalogMovie,
    CatalogueRevision,
    User,
    UserMovieRating,
)
from app.repositories.ratings import (
    get_user_movie_rating,
    set_user_movie_rating,
)
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def database_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={
            "check_same_thread": False,
        },
        poolclass=StaticPool,
    )

    Base.metadata.create_all(engine)

    local_session = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
    )

    session = local_session()

    revision = CatalogueRevision(
        id="revision-a",
        provider="test",
    )

    movie = CatalogMovie(
        id="movie-a",
        catalogue_revision_id="revision-a",
        source="test",
        source_id="movie-a",
        title="Movie A",
    )

    user_a = User(
        id="user-a",
        email_normalized="a@example.com",
        password_hash="hash",
    )

    user_b = User(
        id="user-b",
        email_normalized="b@example.com",
        password_hash="hash",
    )

    session.add_all(
        [
            revision,
            movie,
            user_a,
            user_b,
        ]
    )

    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_two_accounts_can_rate_same_movie_independently(
    database_session: Session,
) -> None:
    rating_a = set_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
        rating=5,
    )

    rating_b = set_user_movie_rating(
        database_session,
        user_id="user-b",
        movie_id="movie-a",
        rating=2,
    )

    database_session.commit()

    assert rating_a.rating == 5
    assert rating_b.rating == 2

    assert get_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
    ).rating == 5

    assert get_user_movie_rating(
        database_session,
        user_id="user-b",
        movie_id="movie-a",
    ).rating == 2


def test_updating_rating_preserves_exactly_one_current_row(
    database_session: Session,
) -> None:
    first = set_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
        rating=2,
    )

    database_session.commit()

    rating_id = first.id

    updated = set_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
        rating=5,
    )

    database_session.commit()

    count = database_session.scalar(
        select(func.count())
        .select_from(UserMovieRating)
        .where(
            UserMovieRating.user_id == "user-a",
            UserMovieRating.movie_id == "movie-a",
        )
    )

    assert count == 1
    assert updated.id == rating_id
    assert updated.rating == 5


def test_repository_reads_are_scoped_to_account(
    database_session: Session,
) -> None:
    set_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
        rating=4,
    )

    database_session.commit()

    assert get_user_movie_rating(
        database_session,
        user_id="user-a",
        movie_id="movie-a",
    ) is not None

    assert (
        get_user_movie_rating(
            database_session,
            user_id="user-b",
            movie_id="movie-a",
        )
        is None
    )


def test_unknown_movie_cannot_create_orphan_rating(
    database_session: Session,
) -> None:
    with pytest.raises(
        LookupError,
        match="movie does not exist",
    ):
        set_user_movie_rating(
            database_session,
            user_id="user-a",
            movie_id="unknown-movie",
            rating=4,
        )

    database_session.rollback()

    count = database_session.scalar(
        select(func.count()).select_from(
            UserMovieRating
        )
    )

    assert count == 0


@pytest.mark.parametrize(
    ("rating", "expected_exception"),
    [
        (0, ValueError),
        (6, ValueError),
        (-1, ValueError),
        (3.5, TypeError),
        ("5", TypeError),
        (True, TypeError),
        (None, TypeError),
    ],
)
def test_repository_rejects_invalid_rating_values(
    database_session: Session,
    rating: object,
    expected_exception: type[Exception],
) -> None:
    with pytest.raises(
        expected_exception,
        match="rating must be an integer from 1 to 5",
    ):
        set_user_movie_rating(
            database_session,
            user_id="user-a",
            movie_id="movie-a",
            rating=rating,  # type: ignore[arg-type]
        )