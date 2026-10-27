"""S3-T26: additive backdrop storage, independent of TMDb import and UI."""

from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from app.db.models import CatalogMovie
from app.repositories import movies
from sqlalchemy import (
    Engine,
    MetaData,
    Table,
    create_engine,
    event,
    inspect,
    select,
    text,
)
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]
PREVIOUS_REVISION = "b7e4c2d91f30"
BACKDROP_REVISION = "c6f8a2d4e901"


def _alembic(database_url: str, *arguments: str) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *arguments],
        cwd=ROOT,
        env=os.environ
        | {
            "DATABASE_URL": database_url,
            "TMDB_READ_ACCESS_TOKEN": "",
            "PYTHONUTF8": "1",
        },
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def _engine(database_url: str) -> Engine:
    engine = create_engine(database_url)

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        connection.execute("PRAGMA foreign_keys=ON")

    return engine


def _seed_existing_data(engine: Engine) -> None:
    """Synthetic pre-backdrop rows: two accounts, three preferences, two ratings."""
    statements = (
        (
            "INSERT INTO users VALUES "
            "('user-a','a@example.test','synthetic-hash-a','2026-10-17'),"
            "('user-b','b@example.test','synthetic-hash-b','2026-10-17')"
        ),
        (
            "INSERT INTO auth_sessions "
            "(token_digest,user_id,created_at,expires_at,revoked_at) VALUES "
            "('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',"
            "'user-a','2026-10-17','2026-10-30',NULL),"
            "('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',"
            "'user-b','2026-10-17','2026-10-30',NULL)"
        ),
        (
            "INSERT INTO catalogue_revisions VALUES "
            "('active-revision','synthetic','2026-10-17',2,0,0),"
            "('retired-revision','synthetic','2026-10-16',1,0,0)"
        ),
        "INSERT INTO genres VALUES (28,'Action'),(35,'Comedy')",
        (
            "INSERT INTO catalog_movies "
            "(id,catalogue_revision_id,source,source_id,title,release_year,overview,"
            "popularity_score,vote_average,vote_count,source_fetched_at) VALUES "
            "('movie-a','active-revision','synthetic','101','Alpha',2021,"
            "'An invented action story.',95,7.5,100,'2026-10-17'),"
            "('movie-b','active-revision','synthetic','102','Beta',NULL,NULL,80,"
            "NULL,NULL,'2026-10-17'),"
            "('retired-movie','retired-revision','synthetic','103','Retired',2020,"
            "'An inactive fixture.',100,6,20,'2026-10-16')"
        ),
        (
            "INSERT INTO movie_genres VALUES "
            "('movie-a',28),('movie-b',35),('retired-movie',28)"
        ),
        (
            "INSERT INTO user_genre_preferences VALUES "
            "('user-a',28),('user-a',35),('user-b',28)"
        ),
        (
            "INSERT INTO user_movie_ratings "
            "(id,user_id,movie_id,rating,created_at,updated_at) VALUES "
            "('rating-a','user-a','movie-a',5,'2026-10-17','2026-10-17'),"
            "('rating-b','user-b','movie-b',2,'2026-10-17','2026-10-17')"
        ),
        "INSERT INTO catalogue_state VALUES (1,'active-revision','2026-10-17')",
    )
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _snapshot(engine: Engine, *, include_backdrop: bool = False) -> dict:
    """Compare all existing rows, excluding only the additive field/version."""
    metadata = MetaData()
    metadata.reflect(bind=engine)
    snapshot = {}
    with engine.connect() as connection:
        for table in metadata.sorted_tables:
            if table.name == "alembic_version":
                continue
            columns = [
                column
                for column in table.columns
                if include_backdrop or column.name not in {"backdrop_path", "poster_path"}
            ]
            snapshot[table.name] = [
                tuple(row)
                for row in connection.execute(select(*columns).order_by(*columns))
            ]
    return snapshot


def _constraints(engine: Engine) -> dict:
    inspector = inspect(engine)
    return {
        table: {
            "pk": inspector.get_pk_constraint(table),
            "unique": inspector.get_unique_constraints(table),
            "fk": inspector.get_foreign_keys(table),
            "check": inspector.get_check_constraints(table),
            "indexes": inspector.get_indexes(table),
        }
        for table in inspector.get_table_names()
        if table != "alembic_version"
    }


@pytest.fixture
def database(tmp_path: Path) -> Iterator[tuple[Engine, str]]:
    url = f"sqlite:///{(tmp_path / 'backdrop.db').as_posix()}"
    _alembic(url, "upgrade", "head")
    engine = _engine(url)
    try:
        _seed_existing_data(engine)
        yield engine, url
    finally:
        engine.dispose()


def test_fresh_migration_creates_nullable_backdrop_storage(tmp_path: Path) -> None:
    url = f"sqlite:///{(tmp_path / 'fresh.db').as_posix()}"
    _alembic(url, "upgrade", "head")
    engine = _engine(url)
    try:
        columns = {
            column["name"]: column
            for column in inspect(engine).get_columns("catalog_movies")
        }
        assert "backdrop_path" in columns, (
            "The migrated catalogue needs backdrop storage"
        )
        assert columns["backdrop_path"]["nullable"] is True
        assert columns["backdrop_path"]["default"] is None
        assert "movies" not in inspect(engine).get_table_names()
        assert "backdrop_path" in CatalogMovie.__table__.columns
        _seed_existing_data(engine)
        with engine.connect() as connection:
            assert connection.execute(
                text("SELECT backdrop_path FROM catalog_movies ORDER BY id")
            ).scalars().all() == [None, None, None]
    finally:
        engine.dispose()


def test_upgrade_preserves_every_row_identity_and_constraint(tmp_path: Path) -> None:
    url = f"sqlite:///{(tmp_path / 'populated.db').as_posix()}"
    _alembic(url, "upgrade", PREVIOUS_REVISION)
    engine = _engine(url)
    try:
        _seed_existing_data(engine)
        before = _snapshot(engine)
        constraints = _constraints(engine)
        assert len(before["users"]) == 2
        assert len(before["user_genre_preferences"]) == 3
        assert len(before["user_movie_ratings"]) == 2
        # Attribute the additive-constraint assertion to the backdrop migration,
        # rather than later migrations that intentionally change rating checks.
        _alembic(url, "upgrade", BACKDROP_REVISION)
        after = _snapshot(engine)
        assert {table: after[table] for table in before} == before
        after_constraints = _constraints(engine)
        assert {table: after_constraints[table] for table in constraints} == constraints
        with engine.connect() as connection:
            assert connection.execute(text("PRAGMA foreign_key_check")).all() == []
            assert connection.execute(
                text("SELECT backdrop_path FROM catalog_movies ORDER BY id")
            ).scalars().all() == [None, None, None]
        _alembic(url, "upgrade", "head")
        current = _snapshot(engine)
        assert {table: current[table] for table in before} == before
        assert current["user_movie_watchlist"] == []
    finally:
        engine.dispose()


def test_revision_extends_the_current_chain_without_a_fork() -> None:
    scripts = ScriptDirectory.from_config(Config(str(ROOT / "backend/alembic.ini")))
    assert len(scripts.get_heads()) == 1
    assert scripts.get_revision(BACKDROP_REVISION).down_revision == PREVIOUS_REVISION
    assert BACKDROP_REVISION in {
        revision.revision for revision in scripts.walk_revisions()
    }


def test_path_update_clear_and_reads_preserve_core_fields(database) -> None:
    engine, _url = database
    before = _snapshot(engine)
    for path in ("/synthetic-backdrop.jpg", "/replacement-backdrop.jpg", None):
        with Session(engine) as session, session.begin():
            updated = movies.set_movie_backdrop_path(
                session, movie_id="movie-a", backdrop_path=path
            )
            assert updated.id == "movie-a"
        with Session(engine) as session:
            movie = movies.get_active_movie_by_id(session, movie_id="movie-a")
            assert movie.backdrop_path == path
            assert (
                movies.get_movie_by_source_id(
                    session, source="synthetic", source_id="101"
                ).backdrop_path
                == path
            )
            assert [row.id for row in movies.list_active_movies(session, limit=10)] == [
                "movie-a",
                "movie-b",
            ]
        assert _snapshot(engine) == before


def test_existing_core_reimport_preserves_a_saved_path(database) -> None:
    engine, _url = database
    with Session(engine) as session, session.begin():
        movies.set_movie_backdrop_path(
            session, movie_id="movie-a", backdrop_path="/preserved.jpg"
        )
    with Session(engine) as session, session.begin():
        movie = session.get(CatalogMovie, "movie-a")
        refreshed = movies.upsert_catalogue_movie(
            session,
            catalogue_revision_id=movie.catalogue_revision_id,
            source=movie.source,
            source_id=movie.source_id,
            title=movie.title,
            release_year=movie.release_year,
            overview=movie.overview,
            popularity_score=movie.popularity_score,
            vote_average=movie.vote_average,
            vote_count=movie.vote_count,
            source_fetched_at=movie.source_fetched_at,
        )
        assert refreshed.id == "movie-a"
        assert refreshed.backdrop_path == "/preserved.jpg"


def test_backdrop_write_never_commits_the_callers_transaction(database) -> None:
    engine, _url = database
    before = _snapshot(engine, include_backdrop=True)
    with (
        pytest.raises(RuntimeError, match="controlled failure"),
        Session(engine) as session,
        session.begin(),
    ):
        movies.set_movie_backdrop_path(
            session, movie_id="movie-a", backdrop_path="/rolled-back.jpg"
        )
        raise RuntimeError("controlled failure")
    assert _snapshot(engine, include_backdrop=True) == before


def test_unknown_movie_cannot_create_a_record(database) -> None:
    engine, _url = database
    before = _snapshot(engine, include_backdrop=True)
    with Session(engine) as session, pytest.raises(ValueError, match="does not exist"):
        movies.set_movie_backdrop_path(
            session, movie_id="unknown", backdrop_path="/not-inserted.jpg"
        )
    assert _snapshot(engine, include_backdrop=True) == before


@pytest.mark.parametrize("invalid", [True, 42, b"image", {"path": "/image.jpg"}])
def test_non_text_paths_do_not_mutate_existing_data(database, invalid) -> None:
    engine, _url = database
    before = _snapshot(engine, include_backdrop=True)
    with Session(engine) as session, pytest.raises(ValueError, match="string or None"):
        movies.set_movie_backdrop_path(
            session, movie_id="movie-a", backdrop_path=invalid
        )
    assert _snapshot(engine, include_backdrop=True) == before


def test_populated_upgrade_is_idempotent(database) -> None:
    engine, url = database
    with Session(engine) as session, session.begin():
        movies.set_movie_backdrop_path(
            session, movie_id="movie-a", backdrop_path="/persisted.jpg"
        )
    before = _snapshot(engine, include_backdrop=True)
    _alembic(url, "upgrade", "head")
    _alembic(url, "upgrade", "head")
    assert _snapshot(engine, include_backdrop=True) == before


def test_storage_exposes_only_valid_url_in_detail_dto(database) -> None:
    engine, _url = database
    with Session(engine) as session, session.begin():
        movies.set_movie_backdrop_path(
            session, movie_id="movie-a", backdrop_path="/storage-only.jpg"
        )
        movie = movies.get_active_movie_by_id(session, movie_id="movie-a")
        summary = movies.to_movie_summary_dto(movie).model_dump()
        detail = movies.to_movie_detail_dto(movie).model_dump()
        assert "backdrop_path" not in summary | detail
        assert "backdropUrl" not in summary
        assert detail["backdropUrl"] == "https://image.tmdb.org/t/p/w780/storage-only.jpg"


def test_existing_uniqueness_and_foreign_keys_still_reject_invalid_rows(
    database,
) -> None:
    engine, _url = database
    movie_table = Table("catalog_movies", MetaData(), autoload_with=engine)
    with engine.connect() as connection:
        original = dict(
            connection.execute(select(movie_table).where(movie_table.c.id == "movie-a"))
            .mappings()
            .one()
        )
    duplicate = original | {"id": "duplicate-movie"}
    orphan = original | {
        "id": "orphan-movie",
        "source_id": "orphan",
        "catalogue_revision_id": "unknown",
    }
    for invalid in (duplicate, orphan):
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(movie_table.insert().values(invalid))
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("DELETE FROM genres WHERE id=28"))


def test_explicit_disposable_downgrade_preserves_non_backdrop_data(database) -> None:
    engine, url = database
    before = _snapshot(engine)
    _alembic(url, "downgrade", PREVIOUS_REVISION)
    assert "backdrop_path" not in {
        column["name"] for column in inspect(engine).get_columns("catalog_movies")
    }
    after = _snapshot(engine)
    assert {table: before[table] for table in after} == after
    assert _constraints(engine)["catalog_movies"]["unique"]
    _alembic(url, "upgrade", "head")
    assert _snapshot(engine) == before
