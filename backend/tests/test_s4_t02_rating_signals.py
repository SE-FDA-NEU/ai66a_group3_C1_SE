"""S4-T02: saved rating signs remain account-scoped and count once per movie."""

from __future__ import annotations

from collections.abc import Iterator

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, User, UserMovieRating
from app.recommendations.signals import (
    adjustment_for_candidate,
    load_account_genre_signals,
)
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
    replace_movie_genres,
    upsert_catalogue_movie,
    upsert_genre,
)
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

ACCOUNT_A = "10000000-0000-0000-0000-000000000001"
ACCOUNT_B = "10000000-0000-0000-0000-000000000002"


@pytest.fixture
def seeded_session(tmp_path) -> Iterator[tuple[Session, dict[str, str]]]:
    engine = create_engine(f"sqlite+pysqlite:///{(tmp_path / 'signals.db').as_posix()}")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for genre_id, name in ((1, "Action"), (2, "Comedy"), (3, "Drama")):
            upsert_genre(session, genre_id=genre_id, name=name)
        revision = create_catalogue_revision(session, provider="synthetic-test")
        movie_ids = {}
        for name, score, genres in (
            ("Action Comedy Signal", 1.0, [1, 2]),
            ("Action Signal", 2.0, [1]),
            ("Action Candidate", 80.0, [1]),
            ("Comedy Candidate", 80.0, [2]),
        ):
            movie = upsert_catalogue_movie(
                session,
                catalogue_revision_id=revision.id,
                source="synthetic-test",
                source_id=name,
                title=name,
                popularity_score=score,
            )
            replace_movie_genres(session, movie=movie, genre_ids=genres)
            movie_ids[name] = movie.id
        activate_catalogue_revision(session, revision_id=revision.id)
        session.add_all([
            User(id=ACCOUNT_A, email_normalized="a@example.test", password_hash="test"),
            User(id=ACCOUNT_B, email_normalized="b@example.test", password_hash="test"),
        ])
        session.commit()
        yield session, movie_ids
    engine.dispose()


def save_rating(session: Session, *, account: str, movie_id: str, value: int) -> None:
    existing = session.scalar(select(UserMovieRating).where(
        UserMovieRating.user_id == account,
        UserMovieRating.movie_id == movie_id,
    ))
    if existing is None:
        session.add(UserMovieRating(user_id=account, movie_id=movie_id, rating=value))
    else:
        existing.rating = value
    session.commit()


@pytest.mark.parametrize(("rating", "sign"), [
    (1, -1), (2, -1), (3, 0), (4, 1), (5, 1),
])
def test_s4_t02_all_five_rating_values_keep_raw_80_80(
    seeded_session: tuple[Session, dict[str, str]], rating: int, sign: int
) -> None:
    session, ids = seeded_session
    save_rating(session, account=ACCOUNT_A, movie_id=ids["Action Signal"], value=rating)

    signals = load_account_genre_signals(session, user_id=ACCOUNT_A)
    action_adjustment = adjustment_for_candidate(signals, genre_ids=[1])
    comedy_adjustment = adjustment_for_candidate(signals, genre_ids=[2])
    action_raw = session.get(CatalogMovie, ids["Action Candidate"])
    comedy_raw = session.get(CatalogMovie, ids["Comedy Candidate"])
    assert action_raw is not None and comedy_raw is not None
    assert action_raw.popularity_score == comedy_raw.popularity_score == 80
    assert action_adjustment == sign
    assert comedy_adjustment == 0
    assert action_raw.popularity_score + action_adjustment == 80 + sign
    assert comedy_raw.popularity_score + comedy_adjustment == 80


def test_s4_t02_shared_genres_count_once_and_latest_value_wins(
    seeded_session: tuple[Session, dict[str, str]],
) -> None:
    session, ids = seeded_session
    save_rating(session, account=ACCOUNT_A,
                movie_id=ids["Action Comedy Signal"], value=5)
    save_rating(session, account=ACCOUNT_A, movie_id=ids["Action Signal"], value=1)
    signals = load_account_genre_signals(session, user_id=ACCOUNT_A)
    assert adjustment_for_candidate(signals, genre_ids=[1, 2]) == 0
    assert adjustment_for_candidate(signals, genre_ids=[1]) == 0
    assert adjustment_for_candidate(signals, genre_ids=[2]) == 1

    save_rating(session, account=ACCOUNT_A,
                movie_id=ids["Action Comedy Signal"], value=1)
    updated = load_account_genre_signals(session, user_id=ACCOUNT_A)
    assert adjustment_for_candidate(updated, genre_ids=[1, 2]) == -2
    assert adjustment_for_candidate(updated, genre_ids=[1]) == -2
    assert adjustment_for_candidate(updated, genre_ids=[2]) == -1


def test_s4_t02_account_isolation_and_no_ratings_baseline(
    seeded_session: tuple[Session, dict[str, str]],
) -> None:
    session, ids = seeded_session
    assert adjustment_for_candidate(
        load_account_genre_signals(session, user_id=ACCOUNT_A), genre_ids=[1, 2]
    ) == 0
    save_rating(session, account=ACCOUNT_A,
                movie_id=ids["Action Comedy Signal"], value=5)
    save_rating(session, account=ACCOUNT_B,
                movie_id=ids["Action Comedy Signal"], value=1)
    a = load_account_genre_signals(session, user_id=ACCOUNT_A)
    b = load_account_genre_signals(session, user_id=ACCOUNT_B)
    assert adjustment_for_candidate(a, genre_ids=[1, 2]) == 1
    assert adjustment_for_candidate(b, genre_ids=[1, 2]) == -1
    assert adjustment_for_candidate(a, genre_ids=[3]) == 0


def test_s4_t02_ignores_ratings_from_inactive_catalogue(
    seeded_session: tuple[Session, dict[str, str]],
) -> None:
    session, ids = seeded_session
    save_rating(session, account=ACCOUNT_A, movie_id=ids["Action Signal"], value=5)
    assert adjustment_for_candidate(
        load_account_genre_signals(session, user_id=ACCOUNT_A), genre_ids=[1]
    ) == 1
    replacement = create_catalogue_revision(session, provider="synthetic-test")
    activate_catalogue_revision(session, revision_id=replacement.id)
    session.commit()
    assert adjustment_for_candidate(
        load_account_genre_signals(session, user_id=ACCOUNT_A), genre_ids=[1]
    ) == 0
