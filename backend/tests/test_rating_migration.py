"""S3-T30: account-owned movie rating storage migration."""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _alembic(
    database_url: str,
    *arguments: str,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "backend/alembic.ini",
            *arguments,
        ],
        cwd=PROJECT_ROOT,
        env=os.environ | {"DATABASE_URL": database_url},
        check=False,
        capture_output=True,
        text=True,
    )


@pytest.fixture
def migrated_database_url(tmp_path: Path) -> str:
    database_url = (
        f"sqlite:///{(tmp_path / 'ratings.db').as_posix()}"
    )

    completed = _alembic(
        database_url,
        "upgrade",
        "head",
    )

    assert completed.returncode == 0, completed.stderr

    return database_url


@pytest.fixture
def engine(
    migrated_database_url: str,
) -> Iterator[Engine]:
    database_engine = create_engine(
        migrated_database_url,
    )

    @event.listens_for(database_engine, "connect")
    def enforce_foreign_keys(
        dbapi_connection,
        _connection_record,
    ):
        dbapi_connection.execute(
            "PRAGMA foreign_keys=ON"
        )

    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO users
                        (id, email_normalized, password_hash, created_at)
                    VALUES
                        ('user-a', 'a@example.com', 'x',
                         '2026-10-10 00:00:00'),
                        ('user-b', 'b@example.com', 'x',
                         '2026-10-10 00:00:00')
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO catalogue_revisions
                        (
                            id,
                            provider,
                            created_at,
                            inserted_movie_count,
                            updated_movie_count,
                            rejected_movie_count
                        )
                    VALUES
                        (
                            'revision-a',
                            'test',
                            '2026-10-10 00:00:00',
                            1,
                            0,
                            0
                        )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO catalog_movies
                        (
                            id,
                            catalogue_revision_id,
                            source,
                            source_id,
                            title,
                            source_fetched_at
                        )
                    VALUES
                        (
                            'movie-a',
                            'revision-a',
                            'test',
                            'movie-a',
                            'Movie A',
                            '2026-10-10 00:00:00'
                        )
                    """
                )
            )

        yield database_engine

    finally:
        database_engine.dispose()


def _rating_rows(
    engine: Engine,
) -> list[tuple[str, str, int]]:
    with engine.connect() as connection:
        rows = connection.execute(
            text(
                """
                SELECT user_id, movie_id, rating
                FROM user_movie_ratings
                ORDER BY user_id, movie_id
                """
            )
        )

        return [
            (
                row.user_id,
                row.movie_id,
                row.rating,
            )
            for row in rows
        ]


def test_migration_creates_account_owned_rating_table(
    engine: Engine,
) -> None:
    inspector = inspect(engine)

    columns = {
        column["name"]: column
        for column in inspector.get_columns(
            "user_movie_ratings"
        )
    }

    assert set(columns) == {
        "id",
        "user_id",
        "movie_id",
        "rating",
        "created_at",
        "updated_at",
    }

    unique_constraints = {
        constraint["name"]
        for constraint in inspector.get_unique_constraints(
            "user_movie_ratings"
        )
    }

    assert (
        "uq_user_movie_ratings_user_movie"
        in unique_constraints
    )

    foreign_keys = {
        fk["constrained_columns"][0]: (
            fk["referred_table"],
            fk["options"],
        )
        for fk in inspector.get_foreign_keys(
            "user_movie_ratings"
        )
    }

    assert foreign_keys == {
        "user_id": (
            "users",
            {"ondelete": "CASCADE"},
        ),
        "movie_id": (
            "catalog_movies",
            {"ondelete": "CASCADE"},
        ),
    }


def test_database_enforces_rating_range_and_foreign_keys(
    engine: Engine,
) -> None:
    insert = text(
        """
        INSERT INTO user_movie_ratings
            (
                id,
                user_id,
                movie_id,
                rating,
                created_at,
                updated_at
            )
        VALUES
            (
                :id,
                :user_id,
                :movie_id,
                :rating,
                '2026-10-10 00:00:00',
                '2026-10-10 00:00:00'
            )
        """
    )

    invalid_rows = (
        {
            "id": "bad-low",
            "user_id": "user-a",
            "movie_id": "movie-a",
            "rating": 0,
        },
        {
            "id": "bad-high",
            "user_id": "user-a",
            "movie_id": "movie-a",
            "rating": 6,
        },
        {
            "id": "bad-user",
            "user_id": "unknown-user",
            "movie_id": "movie-a",
            "rating": 4,
        },
        {
            "id": "bad-movie",
            "user_id": "user-a",
            "movie_id": "unknown-movie",
            "rating": 4,
        },
    )

    for row in invalid_rows:
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(insert, row)

    assert _rating_rows(engine) == []


def test_two_accounts_can_rate_same_movie_independently(
    engine: Engine,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO user_movie_ratings
                    (
                        id,
                        user_id,
                        movie_id,
                        rating,
                        created_at,
                        updated_at
                    )
                VALUES
                    (
                        'rating-a',
                        'user-a',
                        'movie-a',
                        5,
                        '2026-10-10 00:00:00',
                        '2026-10-10 00:00:00'
                    ),
                    (
                        'rating-b',
                        'user-b',
                        'movie-a',
                        2,
                        '2026-10-10 00:00:00',
                        '2026-10-10 00:00:00'
                    )
                """
            )
        )

    assert _rating_rows(engine) == [
        ("user-a", "movie-a", 5),
        ("user-b", "movie-a", 2),
    ]


def test_database_rejects_duplicate_user_movie_pair(
    engine: Engine,
) -> None:
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO user_movie_ratings
                    (
                        id,
                        user_id,
                        movie_id,
                        rating,
                        created_at,
                        updated_at
                    )
                VALUES
                    (
                        'rating-a',
                        'user-a',
                        'movie-a',
                        4,
                        '2026-10-10 00:00:00',
                        '2026-10-10 00:00:00'
                    )
                """
            )
        )

    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(
            text(
                """
                    INSERT INTO user_movie_ratings
                        (
                            id,
                            user_id,
                            movie_id,
                            rating,
                            created_at,
                            updated_at
                        )
                    VALUES
                        (
                            'rating-b',
                            'user-a',
                            'movie-a',
                            5,
                            '2026-10-10 00:00:00',
                            '2026-10-10 00:00:00'
                        )
                    """
            )
        )

    assert _rating_rows(engine) == [
        ("user-a", "movie-a", 4),
    ]

def test_upgrade_preserves_existing_account_preferences_and_catalogue_ids(
    tmp_path: Path,
) -> None:
    database_url = (
        f"sqlite:///{(tmp_path / 'upgrade.db').as_posix()}"
    )

    before_rating_revision = _alembic(
        database_url,
        "upgrade",
        "9d2f5a1c3b84",
    )

    assert before_rating_revision.returncode == 0, (
        before_rating_revision.stderr
    )

    database_engine = create_engine(database_url)

    try:
        with database_engine.begin() as connection:
            connection.execute(
                text(
                    """
                    INSERT INTO users
                        (
                            id,
                            email_normalized,
                            password_hash,
                            created_at
                        )
                    VALUES
                        (
                            'preserved-user',
                            'preserved@example.com',
                            'hash',
                            '2026-10-10 00:00:00'
                        )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO catalogue_revisions
                        (
                            id,
                            provider,
                            created_at,
                            inserted_movie_count,
                            updated_movie_count,
                            rejected_movie_count
                        )
                    VALUES
                        (
                            'preserved-revision',
                            'test',
                            '2026-10-10 00:00:00',
                            1,
                            0,
                            0
                        )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO genres (id, name)
                    VALUES (28, 'Action')
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO catalog_movies
                        (
                            id,
                            catalogue_revision_id,
                            source,
                            source_id,
                            title,
                            source_fetched_at
                        )
                    VALUES
                        (
                            'preserved-movie',
                            'preserved-revision',
                            'test',
                            'preserved-movie',
                            'Preserved Movie',
                            '2026-10-10 00:00:00'
                        )
                    """
                )
            )

            connection.execute(
                text(
                    """
                    INSERT INTO user_genre_preferences
                        (user_id, genre_id)
                    VALUES
                        ('preserved-user', 28)
                    """
                )
            )
    finally:
        database_engine.dispose()

    upgraded = _alembic(
        database_url,
        "upgrade",
        "head",
    )

    assert upgraded.returncode == 0, upgraded.stderr

    database_engine = create_engine(database_url)

    try:
        with database_engine.connect() as connection:
            user_id = connection.scalar(
                text(
                    """
                    SELECT id
                    FROM users
                    WHERE id = 'preserved-user'
                    """
                )
            )

            movie_id = connection.scalar(
                text(
                    """
                    SELECT id
                    FROM catalog_movies
                    WHERE id = 'preserved-movie'
                    """
                )
            )

            preference = connection.execute(
                text(
                    """
                    SELECT user_id, genre_id
                    FROM user_genre_preferences
                    WHERE user_id = 'preserved-user'
                    """
                )
            ).one()

        assert user_id == "preserved-user"
        assert movie_id == "preserved-movie"
        assert preference == (
            "preserved-user",
            28,
        )

    finally:
        database_engine.dispose()