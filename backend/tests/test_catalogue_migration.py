from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy import create_engine, inspect

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def test_catalogue_migration_creates_the_required_tables(tmp_path: Path) -> None:
    database_path = tmp_path / "catalogue.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    environment = os.environ | {"DATABASE_URL": database_url}

    completed = subprocess.run(
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "backend/alembic.ini",
            "upgrade",
            "head",
        ],
        cwd=PROJECT_ROOT,
        env=environment,
        check=False,
        capture_output=True,
        text=True,
    )

    assert completed.returncode == 0, completed.stderr

    engine = create_engine(database_url)
    try:
        table_names = set(inspect(engine).get_table_names())
    finally:
        engine.dispose()

    assert {
        "catalogue_revisions",
        "catalogue_state",
        "catalog_movies",
        "genres",
        "movie_genres",
    }.issubset(table_names)
