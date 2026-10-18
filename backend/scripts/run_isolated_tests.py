"""Migrate a disposable SQLite database and run the offline backend suite."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    with TemporaryDirectory(prefix="s3-c04-tests-") as directory:
        database = Path(directory) / "tests.db"
        environment = os.environ.copy()
        environment.update(
            DATABASE_URL=f"sqlite:///{database.as_posix()}",
            TMDB_READ_ACCESS_TOKEN="",
            TMDB_NETWORK_DISABLED="1",
        )
        environment["PYTHONPATH"] = os.pathsep.join(
            part
            for part in (str(ROOT / "backend"), environment.get("PYTHONPATH", ""))
            if part
        )
        migrate = subprocess.run(
            [
                sys.executable,
                "-m",
                "alembic",
                "-c",
                "backend/alembic.ini",
                "upgrade",
                "head",
            ],
            cwd=ROOT,
            env=environment,
            check=False,
        )
        if migrate.returncode:
            return migrate.returncode
        tests = subprocess.run(
            [sys.executable, "-m", "pytest", "backend/tests", *sys.argv[1:]],
            cwd=ROOT,
            env=environment,
            check=False,
        )
        return tests.returncode


if __name__ == "__main__":
    raise SystemExit(main())
