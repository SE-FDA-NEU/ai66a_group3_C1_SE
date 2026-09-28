"""Migrate and seed the local deterministic catalogue used by M2."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from sqlalchemy.engine import make_url

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_DATABASE_URL = "sqlite:///./data/app.db"


def main() -> int:
    """Apply migrations, seed the local catalogue, and print its final state."""

    database_url = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    _create_sqlite_parent_directory(database_url)

    migration_result = subprocess.run(
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
        env=os.environ.copy(),
        check=False,
        capture_output=True,
        text=True,
    )
    if migration_result.returncode != 0:
        sys.stderr.write(migration_result.stdout)
        sys.stderr.write(migration_result.stderr)
        return migration_result.returncode

    from app.catalogue.m2_seed import seed_m2_catalogue
    from app.db.database import SessionLocal

    with SessionLocal() as session, session.begin():
        result = seed_m2_catalogue(session)

    print("M2 catalogue bootstrap complete")
    print(f"active_revision={result.active_revision_id}")
    print(f"movies={result.movie_count}")
    print(f"genres={result.genre_count}")
    print(f"movie_genres={result.movie_genre_count}")
    return 0


def _create_sqlite_parent_directory(database_url: str) -> None:
    """Create the parent directory for a file-backed local SQLite database."""

    url = make_url(database_url)
    if url.get_backend_name() != "sqlite" or url.database in {None, ":memory:"}:
        return

    database_path = Path(url.database)
    if not database_path.is_absolute():
        database_path = PROJECT_ROOT / database_path
    database_path.parent.mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
