"""Create or restore a consistent SQLite snapshot without overwriting a database.

Run from the repository root with explicit paths. A restore writes a NEW database
file; the operator switches DATABASE_URL only after stopping the application and
checking migrations, catalogue/index readiness and account data.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import sys
import tempfile
import time
from contextlib import closing
from pathlib import Path


class SnapshotError(Exception):
    """A source, destination or SQLite consistency check failed."""


def inspect_database(path: Path) -> dict[str, object]:
    if not path.is_file():
        raise SnapshotError("source is not an existing SQLite file")
    try:
        with closing(sqlite3.connect(path.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)) as db:
            db.execute("PRAGMA query_only=ON")
            if db.execute("PRAGMA integrity_check").fetchone() != ("ok",):
                raise SnapshotError("SQLite integrity check failed")
            if db.execute("PRAGMA foreign_key_check").fetchone() is not None:
                raise SnapshotError("SQLite foreign key check failed")
            versions = [row[0] for row in db.execute("SELECT version_num FROM alembic_version")]
            if len(versions) != 1 or not isinstance(versions[0], str):
                raise SnapshotError("expected exactly one Alembic revision")
            tables = {row[0] for row in db.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            )}
            required = {"users", "user_genre_preferences", "user_movie_ratings",
                        "catalog_movies", "catalogue_state", "alembic_version"}
            if not required <= tables:
                raise SnapshotError("required application tables are missing")
            counts = {
                name: db.execute(f"SELECT count(*) FROM {name}").fetchone()[0]
                for name in ("users", "user_genre_preferences", "user_movie_ratings",
                             "catalog_movies", "user_movie_watchlist") if name in tables
            }
            active = db.execute(
                "SELECT active_revision_id FROM catalogue_state WHERE id=1"
            ).fetchone()
            return {"migrationVersion": versions[0], "activeRevision": active[0] if active else None,
                    "counts": counts}
    except sqlite3.Error as exc:
        raise SnapshotError("SQLite inspection failed") from exc


def _require_unused_destination(destination: Path) -> None:
    if destination.exists() or any(Path(str(destination) + suffix).exists()
                                   for suffix in ("-wal", "-shm", "-journal")):
        raise SnapshotError("destination already exists")


def copy_consistent(source: Path, destination: Path) -> dict[str, object]:
    """Use SQLite's online backup API, including committed WAL pages.

    The destination is published with an exclusive hard link only after it
    passes integrity and foreign-key checks. Existing files are never replaced.
    The caller must keep the destination unused throughout the copy: sidecar
    checks cannot prevent another process creating a journal after the check.
    """
    if source.resolve() == destination.resolve():
        raise SnapshotError("source and destination must differ")
    _require_unused_destination(destination)
    if not destination.parent.is_dir():
        raise SnapshotError("destination directory does not exist")
    inspect_database(source)
    temporary: Path | None = None
    try:
        handle, name = tempfile.mkstemp(prefix=".sqlite-snapshot-", dir=destination.parent)
        os.close(handle)
        temporary = Path(name)
        started = time.monotonic()

        def bounded(_status: int, _remaining: int, _total: int) -> None:
            if time.monotonic() - started > 30:
                raise SnapshotError("SQLite backup exceeded 30 seconds")

        with (closing(sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True, timeout=5)) as src,
              closing(sqlite3.connect(temporary)) as dst):
            src.backup(dst, pages=64, progress=bounded, sleep=0.1)
        result = inspect_database(temporary)
        digest = hashlib.sha256()
        with temporary.open("rb") as copied:
            for block in iter(lambda: copied.read(1024 * 1024), b""):
                digest.update(block)
        result["sha256"] = digest.hexdigest()
        _require_unused_destination(destination)
        os.link(temporary, destination)
        return result
    except (OSError, sqlite3.Error) as exc:
        raise SnapshotError("SQLite snapshot copy failed") from exc
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("inspect", "backup", "restore"))
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", nargs="?", type=Path)
    args = parser.parse_args(argv)
    if (args.action == "inspect") != (args.destination is None):
        parser.error("inspect takes one path; backup and restore take source and new destination")
    try:
        result = (inspect_database(args.source) if args.action == "inspect" else
                  copy_consistent(args.source, args.destination))
    except SnapshotError as exc:
        print(f"storage snapshot unavailable: {exc}", file=sys.stderr)
        return 1
    print(json.dumps({"action": args.action, **result}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
