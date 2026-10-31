"""Offline C05 rehearsal: migrated fixture, WAL backup, index and HTTP restart.

No real database, TMDb token/network or browser is used. All files live in a
temporary directory, and only child servers started here are stopped here.
"""

from __future__ import annotations

import hashlib
import json
import os
import socket
import sqlite3
import subprocess
import sys
import time
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.error import URLError
from urllib.request import urlopen

from app.cli.storage_snapshot import copy_consistent, inspect_database

ROOT = Path(__file__).resolve().parents[2]


def command(*args: str, environment: dict[str, str]) -> str:
    result = subprocess.run(
        [sys.executable, *args], cwd=ROOT, env=environment,
        capture_output=True, text=True, encoding="utf-8", timeout=45, check=False,
    )
    if result.returncode:
        raise RuntimeError(f"{' '.join(args)} failed: {result.stderr[-2000:]}")
    return result.stdout.strip()


def seed(path: Path) -> None:
    with closing(sqlite3.connect(path)) as db:
        db.execute("PRAGMA foreign_keys=ON")
        db.executescript("""
            INSERT INTO users(id,email_normalized,password_hash,created_at) VALUES
              ('a','a@example.test','synthetic','2026-10-24'),
              ('b','b@example.test','synthetic','2026-10-24');
            INSERT INTO catalogue_revisions(id,provider,created_at,inserted_movie_count,
              updated_movie_count,rejected_movie_count) VALUES ('c05','tmdb','2026-10-24',2,0,0);
            INSERT INTO catalogue_state(id,active_revision_id,updated_at)
              VALUES (1,'c05','2026-10-24');
            INSERT INTO genres(id,name) VALUES (18,'Drama'),(28,'Action');
            INSERT INTO catalog_movies(id,catalogue_revision_id,source,source_id,title,
              overview,poster_path,backdrop_path,trailer_site,trailer_key,trailer_type,
              trailer_official,source_fetched_at) VALUES
              ('movie-a','c05','tmdb','101','A','Moon rescue','/a.jpg','/a-back.jpg',
                'YouTube','AbCdEf123_-','Trailer',1,'2026-10-24'),
              ('movie-b','c05','tmdb','102','B','Drama at sea','/b.jpg','/b-back.jpg',
                NULL,NULL,NULL,NULL,'2026-10-24');
            INSERT INTO movie_genres(movie_id,genre_id) VALUES ('movie-a',28),('movie-b',18);
            INSERT INTO user_genre_preferences(user_id,genre_id) VALUES ('a',28),('b',18);
            INSERT INTO user_movie_ratings(id,user_id,movie_id,rating,created_at,updated_at)
              VALUES ('ra','a','movie-a',5,'2026-10-24','2026-10-24'),
                     ('rb','b','movie-b',3,'2026-10-24','2026-10-24');
            INSERT INTO user_movie_watchlist(id,user_id,movie_id,added_at)
              VALUES ('wa','a','movie-a','2026-10-24'),('wb','b','movie-b','2026-10-24');
        """)
        db.commit()


def free_port() -> int:
    with closing(socket.socket()) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def get_json(url: str) -> dict:
    with urlopen(url, timeout=2) as response:
        if response.status != 200:
            raise RuntimeError(f"HTTP status {response.status} for {url}")
        return json.load(response)


def serve_once(environment: dict[str, str], expected_head: str) -> dict[str, object]:
    port = free_port()
    flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--app-dir", "backend",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT, env=environment, stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
        creationflags=flags,
    )
    base = f"http://127.0.0.1:{port}"
    try:
        for _ in range(80):
            if server.poll() is not None:
                raise RuntimeError(f"backend exited before health: {server.stderr.read()[-1500:]!r}")
            try:
                health = get_json(base + "/health")
                break
            except (URLError, TimeoutError):
                time.sleep(0.1)
        else:
            raise RuntimeError("backend health did not become ready in 8 seconds")
        if health != {"status": "ok", "database": "connected", "migrationVersion": expected_head}:
            raise RuntimeError("backend health does not match the migrated database")
        listing = get_json(base + "/api/movies")
        detail = get_json(base + "/api/movies/movie-a")
        search = get_json(base + "/api/movies/search?q=moon&mode=description")
        similar = get_json(base + "/api/movies/movie-a/similar")
        if listing["meta"]["total"] != 2 or detail["data"]["movie"]["id"] != "movie-a":
            raise RuntimeError("catalogue or detail changed after restart")
        if detail["data"]["movie"]["trailer"]["url"] != "https://www.youtube.com/watch?v=AbCdEf123_-":
            raise RuntimeError("stored official trailer was not restored")
        if search["meta"]["total"] < 1 or "movies" not in similar["data"]:
            raise RuntimeError("index-dependent routes did not become ready")
        return {"health": health, "movies": listing["meta"]["total"],
                "searchMatches": search["meta"]["total"],
                "similarMovies": len(similar["data"]["movies"])}
    finally:
        if server.poll() is None:
            server.terminate()
        try:
            server.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server.kill()
            server.wait(timeout=5)
        if server.stderr is not None:
            server.stderr.close()


def main() -> int:
    started = time.monotonic()
    with TemporaryDirectory(prefix="s4-c05-startup-") as directory:
        base = Path(directory)
        original, backup, recovered = (base / name for name in
                                       ("original.db", "backup.db", "recovered.db"))
        index = base / "overview-index.json"
        environment = os.environ | {
            "DATABASE_URL": f"sqlite:///{original.as_posix()}",
            "NLP_INDEX_PATH": str(index), "TMDB_READ_ACCESS_TOKEN": "",
            "TMDB_NETWORK_DISABLED": "1", "PYTHONUTF8": "1",
        }
        head = command("-m", "alembic", "-c", "backend/alembic.ini", "heads",
                       environment=environment).split()[0]
        command("-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head",
                environment=environment)
        seed(original)
        with closing(sqlite3.connect(original)) as db:
            db.execute("PRAGMA journal_mode=WAL")
            db.execute("PRAGMA wal_autocheckpoint=0")
            db.execute("UPDATE catalog_movies SET popularity_score=42 WHERE id='movie-a'")
            db.commit()
            if not Path(str(original) + "-wal").exists():
                raise RuntimeError("WAL fixture was not created")
            copied = copy_consistent(original, backup)
        restored = copy_consistent(backup, recovered)
        if copied != restored:
            raise RuntimeError("backup and restored database summaries differ")
        environment["DATABASE_URL"] = f"sqlite:///{recovered.as_posix()}"
        command("-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head",
                environment=environment)
        current = command("-m", "alembic", "-c", "backend/alembic.ini", "current",
                          environment=environment).split()[0]
        if current != head:
            raise RuntimeError("recovered migration is not at the single head")
        command("-m", "app.cli.rebuild_overview_index", "rebuild", environment=environment)
        command("-m", "app.cli.rebuild_overview_index", "check", environment=environment)
        first = serve_once(environment, head)
        second = serve_once(environment, head)
        if first != second:
            raise RuntimeError("restart changed health, catalogue or index results")
        if inspect_database(recovered)["counts"] != copied["counts"]:
            raise RuntimeError("account/catalogue counts changed during restart")
        result = {"mode": "synthetic-offline", "migrationHead": head,
                  "database": copied, "indexSha256": hashlib.sha256(index.read_bytes()).hexdigest(),
                  "startup": first, "restart": "passed",
                  "elapsedSeconds": round(time.monotonic() - started, 2)}
        print(json.dumps(result, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
