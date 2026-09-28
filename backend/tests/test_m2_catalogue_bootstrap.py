from __future__ import annotations

import os
import socket
import subprocess
import sys
from pathlib import Path

import pytest
from app.catalogue.m2_seed import (
    LOCAL_SEED_GENRES,
    LOCAL_SEED_MOVIES,
    seed_m2_catalogue,
)
from app.db.database import Base
from app.db.models import (
    CatalogMovie,
    CatalogueRevision,
    CatalogueState,
    Genre,
    MovieGenre,
)
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_bootstrap_command_migrates_and_seeds_an_empty_database(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'm2-catalogue.db').as_posix()}"

    completed = _run_bootstrap(database_url)

    assert completed.returncode == 0, completed.stderr
    output = _parse_bootstrap_output(completed.stdout)
    assert output["M2 catalogue bootstrap complete"] == ""
    assert output["movies"] == "12"
    assert output["genres"] == "8"
    assert output["movie_genres"] == "22"
    assert len(output["active_revision"]) == 36

    assert _active_counts(database_url) == (12, 8, 22)


def test_second_bootstrap_run_is_idempotent(tmp_path: Path) -> None:
    database_url = f"sqlite:///{(tmp_path / 'm2-catalogue.db').as_posix()}"

    first_output = _parse_bootstrap_output(_run_bootstrap(database_url).stdout)
    second = _run_bootstrap(database_url)
    second_output = _parse_bootstrap_output(second.stdout)

    assert second.returncode == 0, second.stderr
    assert second_output["active_revision"] == first_output["active_revision"]
    assert second_output["movies"] == "12"
    assert second_output["genres"] == "8"
    assert second_output["movie_genres"] == "22"
    assert _active_counts(database_url) == (12, 8, 22)


def test_seed_service_never_needs_a_network_connection(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    database_url = f"sqlite:///{(tmp_path / 'offline.db').as_posix()}"
    engine = create_engine(database_url)
    Base.metadata.create_all(engine)
    local_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def fail_network(*_args: object, **_kwargs: object) -> object:
        raise AssertionError("the deterministic M2 seed must not use the network")

    monkeypatch.setenv("TMDB_READ_ACCESS_TOKEN", "")
    monkeypatch.setattr(socket, "create_connection", fail_network)
    try:
        with local_session() as session, session.begin():
            result = seed_m2_catalogue(session)
        assert result.movie_count == len(LOCAL_SEED_MOVIES)
        assert result.genre_count == len(LOCAL_SEED_GENRES)
        assert result.movie_genre_count == 22
    finally:
        engine.dispose()


def _run_bootstrap(database_url: str) -> subprocess.CompletedProcess[str]:
    environment = os.environ | {
        "DATABASE_URL": database_url,
        "TMDB_READ_ACCESS_TOKEN": "",
    }
    return subprocess.run(
        [sys.executable, "-m", "app.cli.bootstrap_m2_catalogue"],
        cwd=PROJECT_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )


def _parse_bootstrap_output(output: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for line in output.splitlines():
        if "=" in line:
            key, value = line.split("=", maxsplit=1)
            parsed[key] = value
        else:
            parsed[line] = ""
    return parsed


def _active_counts(database_url: str) -> tuple[int, int, int]:
    engine = create_engine(database_url)
    local_session = sessionmaker(bind=engine)
    try:
        with local_session() as session:
            active_revision = session.scalar(
                select(CatalogueRevision)
                .join(
                    CatalogueState,
                    CatalogueState.active_revision_id == CatalogueRevision.id,
                )
                .where(CatalogueState.id == 1)
            )
            assert active_revision is not None
            movie_count = session.scalar(
                select(func.count(CatalogMovie.id)).where(
                    CatalogMovie.catalogue_revision_id == active_revision.id
                )
            )
            movie_genre_count = session.scalar(
                select(func.count(MovieGenre.movie_id))
                .join(CatalogMovie, CatalogMovie.id == MovieGenre.movie_id)
                .where(CatalogMovie.catalogue_revision_id == active_revision.id)
            )
            genre_count = session.scalar(
                select(func.count(func.distinct(Genre.id)))
                .join(MovieGenre, MovieGenre.genre_id == Genre.id)
                .join(CatalogMovie, CatalogMovie.id == MovieGenre.movie_id)
                .where(CatalogMovie.catalogue_revision_id == active_revision.id)
            )
        return int(movie_count or 0), int(genre_count or 0), int(movie_genre_count or 0)
    finally:
        engine.dispose()
