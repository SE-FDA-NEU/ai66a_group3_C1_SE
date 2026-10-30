"""EARLY_TEST_SETUP (#219): isolate default engines before test collection."""

import os
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

ROOT = Path(__file__).resolve().parent


def pytest_configure(config: pytest.Config) -> None:
    directory = TemporaryDirectory(prefix="movie-pytest-")
    environment = pytest.MonkeyPatch()
    environment.setenv("DATABASE_URL", f"sqlite:///{Path(directory.name) / 'tests.db'}")
    environment.setenv("TMDB_READ_ACCESS_TOKEN", "")
    environment.setenv("TMDB_NETWORK_DISABLED", "1")
    environment.setenv("NLP_INDEX_PATH", str(Path(directory.name) / "overview-index.json"))

    def cleanup() -> None:
        try:
            database = sys.modules.get("app.db.database")
            if database is not None:
                database.engine.dispose()
        finally:
            try:
                directory.cleanup()
            finally:
                environment.undo()

    # Also runs when migrations/collection fail. Dispose pooled SQLite handles
    # before deleting files, including on Windows, then restore inherited env.
    config.add_cleanup(cleanup)
    migration = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=ROOT,
        env=os.environ.copy(),
        capture_output=True,
        text=True,
        check=False,
    )
    if migration.returncode:
        raise pytest.UsageError(f"Temporary test database migration failed:\n{migration.stderr}")
