"""C05: online WAL backup and offline restore of two populated accounts."""

from __future__ import annotations

import os
import sqlite3
import subprocess
import sys
from contextlib import closing
from pathlib import Path

import pytest
from app.cli import storage_snapshot
from app.cli.storage_snapshot import (
    SnapshotError,
    copy_consistent,
    inspect_database,
    main,
)
from app.db.database import create_database_engine
from app.recommendations.overview_index import load_active_index, rebuild_active_index
from app.repositories.movies import upsert_catalogue_movie
from app.repositories.profile import reset_user_personalisation
from sqlalchemy import text
from sqlalchemy.orm import Session
from support.reset_concurrency import migrate_template

ROOT = Path(__file__).resolve().parents[2]


def _rows(db: sqlite3.Connection, table: str) -> list[tuple]:
    return db.execute(f"SELECT * FROM {table} ORDER BY 1,2").fetchall()


def _seed(db: sqlite3.Connection) -> None:
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA wal_autocheckpoint=0")
    assert db.execute("PRAGMA journal_mode=WAL").fetchone() == ("wal",)
    db.executescript("""
        INSERT INTO users(id,email_normalized,password_hash,created_at) VALUES
          ('a','a@example.test','synthetic','2026-10-24'),
          ('b','b@example.test','synthetic','2026-10-24');
        INSERT INTO catalogue_revisions(id,provider,created_at,inserted_movie_count,
          updated_movie_count,rejected_movie_count) VALUES ('r','tmdb','2026-10-24',2,0,0);
        INSERT INTO catalogue_state(id,active_revision_id,updated_at)
          VALUES (1,'r','2026-10-24');
        INSERT INTO genres(id,name) VALUES (18,'Drama'),(28,'Action');
        INSERT INTO catalog_movies(id,catalogue_revision_id,source,source_id,title,
          overview,poster_path,backdrop_path,trailer_site,trailer_key,trailer_type,
          trailer_official,source_fetched_at) VALUES
          ('movie-a','r','tmdb','101','A','Moon rescue','/a.jpg','/a-back.jpg',
            'YouTube','AbCdEf123_-','Trailer',1,'2026-10-24'),
          ('movie-b','r','tmdb','102','B','Drama at sea','/b.jpg','/b-back.jpg',
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


def test_online_wal_backup_restore_and_account_index_recovery(tmp_path: Path):
    live = migrate_template(tmp_path / "live.db")
    backup = tmp_path / "backup.db"
    recovered = tmp_path / "recovered.db"
    tables = ("users", "catalogue_state", "catalog_movies", "movie_genres",
              "user_genre_preferences", "user_movie_ratings", "user_movie_watchlist")
    with closing(sqlite3.connect(live)) as writer:
        _seed(writer)
        expected = {table: _rows(writer, table) for table in tables}
        assert Path(str(live) + "-wal").stat().st_size > 0
        saved = copy_consistent(live, backup)
        assert saved["counts"] == {
            "users": 2, "user_genre_preferences": 2,
            "user_movie_ratings": 2, "catalog_movies": 2,
            "user_movie_watchlist": 2,
        }
        assert saved["activeRevision"] == "r"
        assert len(saved["sha256"]) == 64
        # A later write to the live database is not part of the snapshot.
        writer.execute("DELETE FROM user_movie_watchlist WHERE user_id='a'")
        writer.execute("UPDATE catalog_movies SET title='Changed later' WHERE id='movie-a'")
        writer.commit()
        restored = copy_consistent(backup, recovered)
        assert restored == saved

    with closing(sqlite3.connect(recovered)) as db:
        db.execute("PRAGMA foreign_keys=ON")
        assert {table: _rows(db, table) for table in tables} == expected
        assert db.execute("PRAGMA foreign_key_check").fetchall() == []
    engine = create_database_engine(f"sqlite:///{recovered.as_posix()}")
    index_path = tmp_path / "recovered-index.json"
    try:
        with Session(engine) as session:
            rebuilt = rebuild_active_index(session, index_path)
            assert rebuilt.movie_ids == ("movie-a", "movie-b")
        with Session(engine) as session, session.begin():
            reset_user_personalisation(session, user_id="a")
            movie = upsert_catalogue_movie(session, catalogue_revision_id="r",
                                           source="tmdb", source_id="101", title="A reimported",
                                           overview="Moon rescue")
            assert movie.id == "movie-a"
        with engine.connect() as db:
            assert db.execute(text("SELECT count(*) FROM user_movie_watchlist")).scalar_one() == 2
            assert db.execute(text("SELECT count(*) FROM user_genre_preferences WHERE user_id='b'")).scalar_one() == 1
            assert db.execute(text("SELECT count(*) FROM user_movie_ratings WHERE user_id='b'")).scalar_one() == 1
            assert db.execute(text("SELECT poster_path,backdrop_path,trailer_key FROM catalog_movies WHERE id='movie-a'")).one() == ("/a.jpg", "/a-back.jpg", "AbCdEf123_-")
        with Session(engine) as session:
            assert load_active_index(session, index_path).movie_ids == rebuilt.movie_ids
        assert inspect_database(recovered)["counts"]["user_movie_watchlist"] == 2
    finally:
        engine.dispose()
    probe_code = """from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
assert c.get('/health').json()['migrationVersion']
assert c.get('/api/movies').json()['meta']['total'] == 2
assert c.get('/api/movies/search?q=moon&mode=description').status_code == 200
"""
    probe = subprocess.run(
        [sys.executable, "-c", probe_code],
        cwd=ROOT, env=os.environ | {
            "DATABASE_URL": f"sqlite:///{recovered.as_posix()}",
            "NLP_INDEX_PATH": str(index_path), "TMDB_READ_ACCESS_TOKEN": "",
            "TMDB_NETWORK_DISABLED": "1",
        }, capture_output=True, text=True, timeout=30, check=False,
    )
    assert probe.returncode == 0, probe.stdout + probe.stderr


def test_snapshot_refuses_overwrite_or_corrupt_source(tmp_path: Path, capsys):
    source = migrate_template(tmp_path / "source.db")
    target = tmp_path / "target.db"
    copy_consistent(source, target)
    with pytest.raises(SnapshotError, match="destination already exists"):
        copy_consistent(source, target)
    assert main(["inspect", str(target)]) == 0
    restored = tmp_path / "restored.db"
    assert main(["restore", str(target), str(restored)]) == 0
    assert inspect_database(restored) == inspect_database(source)
    assert "migrationVersion" in capsys.readouterr().out
    corrupt = tmp_path / "corrupt.db"
    corrupt.write_bytes(b"not SQLite")
    with pytest.raises(SnapshotError, match="SQLite inspection failed"):
        copy_consistent(corrupt, tmp_path / "no-copy.db")
    assert not (tmp_path / "no-copy.db").exists()


@pytest.mark.parametrize("journal_timing", ["before_copy", "before_publication"])
def test_restore_refuses_hot_rollback_journal(
    tmp_path: Path, capsys, monkeypatch, journal_timing: str,
):
    source = migrate_template(tmp_path / "source.db")
    destination = migrate_template(tmp_path / "destination.db")
    for path in (source, destination):
        with closing(sqlite3.connect(path)) as db:
            _seed(db)
    with closing(sqlite3.connect(source)) as db:
        db.execute("UPDATE users SET email_normalized='snapshot-a@example.test' WHERE id='a'")
        db.commit()
    source_before = source.read_bytes()

    # Spill uncommitted pages to the main file, then exit without SQLite cleanup.
    crash = subprocess.run(
        [sys.executable, "-c", """import os
import sqlite3
import sys
db = sqlite3.connect(sys.argv[1])
assert db.execute('PRAGMA journal_mode=DELETE').fetchone() == ('delete',)
db.execute('PRAGMA synchronous=FULL')
db.execute('PRAGMA cache_size=1')
db.execute('BEGIN IMMEDIATE')
db.execute("UPDATE users SET email_normalized='uncommitted@example.test' WHERE id='a'")
db.execute("UPDATE catalog_movies SET overview=? WHERE id='movie-a'", ('x' * 1024 * 1024,))
os._exit(0)
""", str(destination)],
        cwd=ROOT, capture_output=True, text=True, timeout=30, check=False,
    )
    assert crash.returncode == 0, crash.stdout + crash.stderr
    journal = Path(str(destination) + "-journal")
    journal_before = journal.read_bytes()
    assert len(journal_before) > 512
    old_database = tmp_path / "old-database.db"
    destination.rename(old_database)
    old_before = old_database.read_bytes()

    # Prove this is a hot journal: pairing it with the snapshot replays old data
    # on the first open, overwriting the snapshot's distinct committed email.
    replay = tmp_path / "unsafe-restore-control.db"
    replay.write_bytes(source_before)
    Path(str(replay) + "-journal").write_bytes(journal_before)
    with closing(sqlite3.connect(replay)) as db:
        assert db.execute(
            "SELECT email_normalized FROM users WHERE id='a'"
        ).fetchone() == ("a@example.test",)

    if journal_timing == "before_publication":
        held_journal = tmp_path / "held-journal"
        journal.rename(held_journal)

        def inspect_then_expose_journal(path: Path) -> dict[str, object]:
            result = inspect_database(path)
            if path != source:
                held_journal.rename(journal)
            return result

        monkeypatch.setattr(storage_snapshot, "inspect_database", inspect_then_expose_journal)

    assert main(["restore", str(source), str(destination)]) == 1
    output = capsys.readouterr()
    assert "destination already exists" in output.err
    assert output.out == ""
    assert not destination.exists()
    assert journal.read_bytes() == journal_before
    assert old_database.read_bytes() == old_before
    assert source.read_bytes() == source_before
