"""S4-T02: saved rating signs remain account-scoped and count once per movie."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, CatalogueState, User, UserMovieRating
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
ORACLE_PATH = Path(__file__).parent / "fixtures" / "s4_t02_ranking_handoff.json"


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
    (0.5, -1), (1, -1), (1.5, -1), (2, -1), (2.5, 0),
    (3, 0), (3.5, 0), (4, 1), (4.5, 1), (5, 1),
])
def test_s4_t02_all_rating_values_keep_raw_80_80(
    seeded_session: tuple[Session, dict[str, str]], rating: float, sign: int
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


def test_s4_t02_keeps_saved_rating_history_when_source_leaves_active_catalogue(
    seeded_session: tuple[Session, dict[str, str]],
) -> None:
    session, ids = seeded_session
    save_rating(session, account=ACCOUNT_A, movie_id=ids["Action Signal"], value=5)
    assert adjustment_for_candidate(
        load_account_genre_signals(session, user_id=ACCOUNT_A), genre_ids=[1]
    ) == 1
    replacement = create_catalogue_revision(session, provider="synthetic-test")
    candidate = upsert_catalogue_movie(
        session,
        catalogue_revision_id=replacement.id,
        source="synthetic-test",
        source_id="new-action-candidate",
        title="New Action Candidate",
        popularity_score=80.0,
    )
    replace_movie_genres(session, movie=candidate, genre_ids=[1])
    activate_catalogue_revision(session, revision_id=replacement.id)
    session.commit()
    assert session.scalar(select(UserMovieRating.rating).where(
        UserMovieRating.user_id == ACCOUNT_A,
        UserMovieRating.movie_id == ids["Action Signal"],
    )) == 5
    assert candidate.catalogue_revision_id == replacement.id
    assert session.scalar(select(CatalogueState.active_revision_id)) == replacement.id
    assert adjustment_for_candidate(
        load_account_genre_signals(session, user_id=ACCOUNT_A), genre_ids=[1]
    ) == 1


def test_s4_t02_90_80_neutral_handoff(
    seeded_session: tuple[Session, dict[str, str]],
) -> None:
    session, ids = seeded_session
    fixture = json.loads(ORACLE_PATH.read_text(encoding="utf-8"))["neutral90_80"]
    action = session.get(CatalogMovie, ids["Action Candidate"])
    comedy = session.get(CatalogMovie, ids["Comedy Candidate"])
    source = session.get(CatalogMovie, ids["Action Signal"])
    assert action is not None and comedy is not None and source is not None
    for movie, row in zip((action, comedy), fixture["candidates"], strict=True):
        movie.title = row["title"]
        movie.popularity_score = row["popularityScore"]
    source.title = fixture["ratedSource"]["title"]
    source.popularity_score = fixture["ratedSource"]["popularityScore"]
    session.commit()
    save_rating(
        session, account=ACCOUNT_A, movie_id=source.id,
        value=fixture["ratedSource"]["rating"],
    )

    signals = load_account_genre_signals(session, user_id=ACCOUNT_A)
    assert adjustment_for_candidate(signals, genre_ids=[1]) == 0
    assert adjustment_for_candidate(signals, genre_ids=[2]) == 0
    assert [action.popularity_score, comedy.popularity_score] == [90, 80]
    assert fixture["expectedAdjustments"] == {
        action.title: 0, comedy.title: 0, source.title: 0,
    }
    assert fixture["expectedOrderedTitles"] == [
        action.title, comedy.title, source.title,
    ]


def test_s4_t02_whole_set_handoff_oracle_is_explicit() -> None:
    fixture = json.loads(ORACLE_PATH.read_text(encoding="utf-8"))["wholeSet25"]
    candidates = fixture["candidates"]
    titles = [row["title"] for row in candidates]
    pages = fixture["expectedAfterPages"]
    meta = fixture["expectedPageMeta"]
    target = next(row for row in candidates if row["title"] == "Target")
    source = fixture["ratedSource"]
    signals = {genre_id: {source["sourceId"]: 1}
               for genre_id in source["genreIds"]}

    assert len(titles) == len(set(titles)) == meta["total"] == 25
    assert fixture["selectedGenreIds"] == [1]
    assert source["rating"] == 5 and source["genreIds"] == [2]
    assert target["popularityScore"] == 90.5
    assert adjustment_for_candidate(signals, genre_ids=target["genreIds"]) == 1
    assert all(
        adjustment_for_candidate(signals, genre_ids=row["genreIds"]) == 0
        for row in candidates if row is not target
    )
    assert fixture["expectedAdjustment"] == {"Target": 1, "otherCandidates": 0}
    assert "Target" not in fixture["expectedBeforePage1"]
    assert fixture["expectedBeforePage1"][-1] == "Action 10"
    assert pages[0][-1] == "Target"
    before = sorted(candidates, key=lambda row: (-row["popularityScore"], row["title"]))
    after = sorted(candidates, key=lambda row: (
        -(row["popularityScore"] + adjustment_for_candidate(
            signals, genre_ids=row["genreIds"]
        )), row["title"],
    ))
    assert before[10]["title"] == "Target"
    assert after[9]["title"] == "Target"
    assert [row["title"] for row in before[:fixture["limit"]]] == fixture[
        "expectedBeforePage1"
    ]
    assert [
        [row["title"] for row in after[index:index + fixture["limit"]]]
        for index in range(0, len(after), fixture["limit"])
    ] == pages
    assert [len(page) for page in pages] == meta["pageLengths"] == [10, 10, 5]
    assert meta["totalPages"] == 3 and meta["unfilteredTotal"] == 25
    assert len([title for page in pages for title in page]) == 25
    assert {title for page in pages for title in page} == set(titles)
    assert fixture["expectedGenre2View"] == {
        "titles": ["Target"], "total": 1, "totalPages": 1,
        "unfilteredTotal": 25,
    }
    assert [row["title"] for row in after if 2 in row["genreIds"]] == ["Target"]
