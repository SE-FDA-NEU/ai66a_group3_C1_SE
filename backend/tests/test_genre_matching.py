"""S3-T07: genre matching and bounded baseline ranking at the repository."""

from __future__ import annotations

import json
from collections.abc import Iterator
from pathlib import Path

import pytest
from app.db.database import Base
from app.db.models import CatalogMovie, Genre, MovieGenre
from app.repositories.movies import (
    activate_catalogue_revision,
    create_catalogue_revision,
)
from app.repositories.recommendations import list_genre_matched_movies
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "recommendations_s3_t06.json"


@pytest.fixture
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    database_session = sessionmaker(bind=engine, autoflush=False)()
    try:
        yield database_session
    finally:
        database_session.close()
        engine.dispose()


def _add_movie(
    session: Session,
    *,
    revision_id: str,
    movie_id: str,
    title: str,
    genre_ids: list[int],
    popularity: float | None,
) -> None:
    session.add(
        CatalogMovie(
            id=movie_id,
            catalogue_revision_id=revision_id,
            source="test",
            source_id=movie_id,
            title=title,
            popularity_score=popularity,
        )
    )
    session.flush()
    session.add_all(
        MovieGenre(movie_id=movie_id, genre_id=genre_id) for genre_id in genre_ids
    )


def _ids(movies: list[CatalogMovie]) -> list[str]:
    return [movie.id for movie in movies]


def test_matches_the_t06_personalised_oracle(session: Session) -> None:
    fixture = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    session.add_all(
        Genre(id=genre["id"], name=genre["name"]) for genre in fixture["genres"]
    )
    revision = create_catalogue_revision(session, provider="fixture")
    unique_rows = {row["id"]: row for row in fixture["candidateRows"]}
    for row in unique_rows.values():
        _add_movie(
            session,
            revision_id=revision.id,
            movie_id=row["id"],
            title=row["title"],
            genre_ids=row["genreIds"],
            popularity=row["popularityScore"],
        )
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    personalised = fixture["cases"]["personalisedTwoGenreIntersection"]
    no_match = fixture["cases"]["popularNoMatch"]

    result = list_genre_matched_movies(
        session,
        genre_ids=personalised["savedGenreIds"],
        limit=personalised["request"]["limit"],
    )

    assert _ids(result) == [
        movie["id"] for movie in personalised["expectedResponse"]["data"]["movies"]
    ]
    assert len(result) == len(set(_ids(result))) == 10
    assert all(
        set(personalised["savedGenreIds"]) & {genre.id for genre in movie.genres}
        for movie in result
    )
    # A saved genre that no candidate carries yields no match, not a fallback.
    assert (
        list_genre_matched_movies(
            session, genre_ids=no_match["savedGenreIds"], limit=10
        )
        == []
    )


def test_every_result_shares_a_selected_genre_and_others_are_excluded(
    session: Session,
) -> None:
    session.add_all(Genre(id=gid, name=f"G{gid}") for gid in (1, 2, 3))
    revision = create_catalogue_revision(session, provider="test")
    _add_movie(session, revision_id=revision.id, movie_id="a", title="A",
               genre_ids=[1], popularity=10.0)
    _add_movie(session, revision_id=revision.id, movie_id="b", title="B",
               genre_ids=[2], popularity=99.0)
    _add_movie(session, revision_id=revision.id, movie_id="c", title="C",
               genre_ids=[1, 3], popularity=5.0)
    _add_movie(session, revision_id=revision.id, movie_id="d", title="D",
               genre_ids=[3], popularity=50.0)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    result = list_genre_matched_movies(session, genre_ids=[1, 2], limit=10)

    assert _ids(result) == ["b", "a", "c"]


def test_movie_matching_several_selected_genres_appears_once(
    session: Session,
) -> None:
    session.add_all(Genre(id=gid, name=f"G{gid}") for gid in (1, 2, 3))
    revision = create_catalogue_revision(session, provider="test")
    _add_movie(session, revision_id=revision.id, movie_id="both", title="Both",
               genre_ids=[1, 2, 3], popularity=10.0)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    result = list_genre_matched_movies(session, genre_ids=[1, 2, 3, 3], limit=10)

    assert _ids(result) == ["both"]


def test_missing_popularity_sorts_after_finite_scores_without_becoming_zero(
    session: Session,
) -> None:
    session.add(Genre(id=1, name="G1"))
    revision = create_catalogue_revision(session, provider="test")
    for movie_id, title, popularity in (
        ("none-a", "Aardvark", None),
        ("zero", "Zebra", 0.0),
        ("low", "Moth", 0.5),
        ("high", "Yak", 80.0),
    ):
        _add_movie(session, revision_id=revision.id, movie_id=movie_id,
                   title=title, genre_ids=[1], popularity=popularity)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    result = list_genre_matched_movies(session, genre_ids=[1], limit=10)

    # A real 0.0 outranks a missing score, so null is not treated as zero.
    assert _ids(result) == ["high", "low", "zero", "none-a"]
    assert result[-1].popularity_score is None


def test_whole_eligible_set_is_ranked_before_the_limit_of_ten(
    session: Session,
) -> None:
    session.add(Genre(id=1, name="G1"))
    revision = create_catalogue_revision(session, provider="test")
    # The best movie is inserted last and the scores increase with insertion
    # order, so a limit applied before ranking would drop the top results.
    for index in range(15):
        _add_movie(session, revision_id=revision.id, movie_id=f"m{index:02d}",
                   title=f"Movie {index:02d}", genre_ids=[1],
                   popularity=float(index))
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    result = list_genre_matched_movies(session, genre_ids=[1], limit=10)

    assert _ids(result) == [f"m{index:02d}" for index in range(14, 4, -1)]
    assert len(list_genre_matched_movies(session, genre_ids=[1], limit=3)) == 3


def test_ties_use_title_then_internal_id(session: Session) -> None:
    session.add(Genre(id=1, name="G1"))
    revision = create_catalogue_revision(session, provider="test")
    for movie_id, title in (("z-id", "Same"), ("a-id", "Same"), ("m-id", "Alpha")):
        _add_movie(session, revision_id=revision.id, movie_id=movie_id,
                   title=title, genre_ids=[1], popularity=7.0)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    result = list_genre_matched_movies(session, genre_ids=[1], limit=10)

    assert _ids(result) == ["m-id", "a-id", "z-id"]


def test_only_the_active_revision_is_searched(session: Session) -> None:
    session.add(Genre(id=1, name="G1"))
    retired = create_catalogue_revision(session, provider="test")
    active = create_catalogue_revision(session, provider="test")
    _add_movie(session, revision_id=retired.id, movie_id="old", title="Old",
               genre_ids=[1], popularity=100.0)
    _add_movie(session, revision_id=active.id, movie_id="new", title="New",
               genre_ids=[1], popularity=1.0)
    activate_catalogue_revision(session, revision_id=active.id)
    session.commit()

    assert _ids(list_genre_matched_movies(session, genre_ids=[1], limit=10)) == [
        "new"
    ]


def test_no_selected_genres_returns_nothing(session: Session) -> None:
    session.add(Genre(id=1, name="G1"))
    revision = create_catalogue_revision(session, provider="test")
    _add_movie(session, revision_id=revision.id, movie_id="a", title="A",
               genre_ids=[1], popularity=1.0)
    activate_catalogue_revision(session, revision_id=revision.id)
    session.commit()

    assert list_genre_matched_movies(session, genre_ids=[], limit=10) == []


@pytest.mark.parametrize("limit", [0, 11, -1])
def test_limit_outside_one_to_ten_is_rejected(session: Session, limit: int) -> None:
    with pytest.raises(ValueError):
        list_genre_matched_movies(session, genre_ids=[1], limit=limit)
