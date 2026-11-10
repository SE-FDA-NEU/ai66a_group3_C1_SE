"""Offline T11 harness: migrated file SQLite, real API and session per request."""

from __future__ import annotations

import hashlib
import os
import sqlite3
import subprocess
import sys
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Event, Lock
from unittest.mock import patch

from app.db.database import create_database_engine
from app.main import app, get_db
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import event, text
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[3]
RESET = "/api/me/profile/reset"
PREFERENCES = "/api/me/preferences"
RATING = "/api/me/ratings/movie-a"
CONFIRMED = {"confirm": True}
NEW_GENRES = {"genreIds": [28, 35]}
NEW_RATING = {"rating": 4}
HEADERS = {"Origin": "http://testserver"}
NOW = datetime(2026, 10, 24, 0, 0, tzinfo=UTC)


class FrozenDatetime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW.astimezone(tz) if tz else NOW.replace(tzinfo=None)


def migrate_template(path: Path) -> Path:
    result = subprocess.run(
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
        env={
            **os.environ,
            "DATABASE_URL": f"sqlite:///{path.as_posix()}",
            "TMDB_READ_ACCESS_TOKEN": "",
            "TMDB_NETWORK_DISABLED": "1",
            "PYTHONUTF8": "1",
        },
        capture_output=True,
        text=True,
        encoding="utf-8",
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    return path


class WriteGate:
    """Pause an actual leader write while observing follower SQL acquisition."""

    def __init__(self, leader_statement: str) -> None:
        self.statement = leader_statement
        self.leader_written = Event()
        self.follower_attempted = Event()
        self.release = Event()

    def before(self, actor: str, statement: str) -> None:
        if actor == "follower" and statement == "BEGIN IMMEDIATE":
            self.follower_attempted.set()

    def after(self, actor: str, statement: str) -> None:
        if (
            actor == "leader"
            and statement.startswith(self.statement)
            and not self.leader_written.is_set()
        ):
            self.leader_written.set()
            assert self.release.wait(8), (
                "leader was not released (test coordination failure)"
            )


class ResetHarness:
    def __init__(
        self,
        template: Path,
        path: Path,
        *,
        journal: str = "delete",
        timeout: float = 5.0,
    ):
        with (
            sqlite3.connect(template.as_uri() + "?mode=ro", uri=True) as source,
            sqlite3.connect(path) as target,
        ):
            source.backup(target)
            assert journal in {"delete", "wal"}
            assert (
                target.execute(f"PRAGMA journal_mode={journal}").fetchone()[0]
                == journal
            )
        self.path = path
        self.engine = create_database_engine(
            f"sqlite:///{path.as_posix()}", sqlite_timeout_seconds=timeout
        )
        self.factory = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.sql = defaultdict(list)
        self.trace = []
        self.trace_lock = Lock()
        self.gate: WriteGate | None = None
        self.fail_second_delete = False
        self.fail_commit = False
        self.connections = defaultdict(set)
        event.listen(self.factory, "after_begin", self._after_begin)
        event.listen(
            self.factory,
            "after_commit",
            lambda session: self.record(
                session.info.get("actor", "setup"), "committed"
            ),
        )
        event.listen(self.engine, "before_cursor_execute", self._before)
        event.listen(self.engine, "after_cursor_execute", self._after)
        event.listen(self.engine, "commit", self._commit)
        self.seed()
        self.before_shared = self.shared_rows()
        self.clients = []

    def record(self, actor: str, phase: str) -> None:
        with self.trace_lock:
            self.trace.append((actor, phase))

    def _after_begin(self, session, _transaction, connection):
        connection.info["actor"] = session.info.get("actor", "setup")

    def _before(self, connection, _cursor, statement, _parameters, _context, _many):
        actor = connection.info.get("actor", "setup")
        self.sql[actor].append(statement)
        self.connections[actor].add(id(connection.connection.driver_connection))
        if self.gate:
            self.gate.before(actor, statement)
        if self.fail_second_delete and statement.startswith(
            "DELETE FROM user_movie_ratings"
        ):
            from sqlalchemy.exc import OperationalError

            raise OperationalError(
                statement, {}, Exception("synthetic-private-db-detail")
            )

    def _after(self, connection, _cursor, statement, _parameters, _context, _many):
        actor = connection.info.get("actor", "setup")
        if statement == "BEGIN IMMEDIATE":
            self.record(actor, "acquired")
        if statement.startswith(("DELETE", "UPDATE", "INSERT")):
            self.record(actor, "mutated")
        if self.gate:
            self.gate.after(actor, statement)

    def _commit(self, _connection):
        if self.fail_commit:
            from sqlalchemy.exc import OperationalError

            raise OperationalError(
                "COMMIT", {}, Exception("synthetic-private-commit-detail")
            )

    def seed(self):
        # Accounts and tokens are synthetic. No Argon2 delay/network/real clock dependency.
        now = NOW.isoformat(" ")
        with self.engine.begin() as db:
            for account in ("a", "b"):
                db.execute(
                    text(
                        "INSERT INTO users(id,email_normalized,password_hash,created_at) VALUES (:id,:email,'synthetic-only',:now)"
                    ),
                    {"id": account, "email": f"t11-{account}@example.test", "now": now},
                )
                db.execute(
                    text(
                        "INSERT INTO auth_sessions(token_digest,user_id,created_at,expires_at) VALUES (:digest,:id,:now,:expiry)"
                    ),
                    {
                        "digest": hashlib.sha256(
                            f"t11-{account}-synthetic-token".encode()
                        ).hexdigest(),
                        "id": account,
                        "now": now,
                        "expiry": (NOW + timedelta(days=1)).isoformat(" "),
                    },
                )
            db.execute(
                text(
                    "INSERT INTO catalogue_revisions VALUES ('t11-revision','synthetic','2026-10-24',3,0,0)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO catalogue_state VALUES (1,'t11-revision','2026-10-24')"
                )
            )
            for genre, name in [
                (28, "Action"),
                (35, "Comedy"),
                (878, "Science Fiction"),
                (18, "Drama"),
            ]:
                db.execute(
                    text("INSERT INTO genres VALUES (:id,:name)"),
                    {"id": genre, "name": name},
                )
            for suffix, genre, popularity in [
                ("a", 28, 90),
                ("b", 35, 80),
                ("c", 18, 70),
            ]:
                db.execute(
                    text(
                        "INSERT INTO catalog_movies(id,catalogue_revision_id,source,source_id,title,popularity_score,overview,backdrop_path,source_fetched_at) VALUES (:id,'t11-revision','synthetic',:source,:title,:score,'Invented local synopsis','/retained.jpg','2026-10-24')"
                    ),
                    {
                        "id": f"movie-{suffix}",
                        "source": suffix,
                        "title": f"Fixture {suffix}",
                        "score": popularity,
                    },
                )
                db.execute(
                    text("INSERT INTO movie_genres VALUES (:movie,:genre)"),
                    {"movie": f"movie-{suffix}", "genre": genre},
                )
            db.execute(
                text(
                    "INSERT INTO user_genre_preferences VALUES ('a',28),('a',35),('a',878),('b',18)"
                )
            )
            db.execute(
                text(
                    "INSERT INTO user_movie_ratings VALUES ('rating-a1','a','movie-a',5,'2026-10-24','2026-10-24'),('rating-a2','a','movie-b',2,'2026-10-24','2026-10-24'),('rating-b1','b','movie-c',3,'2026-10-24','2026-10-24')"
                )
            )

    def client(self, account="a"):
        client = TestClient(app)
        client.cookies.set("ams_session", f"t11-{account}-synthetic-token")
        self.clients.append(client)
        return client

    @contextmanager
    def installed(self):
        def request_session(request: Request):
            with self.factory() as session:
                session.info["actor"] = request.headers.get("X-T11-Actor", "request")
                yield session

        previous = app.dependency_overrides.copy()
        app.dependency_overrides[get_db] = request_session
        try:
            with patch("app.security.sessions.datetime", FrozenDatetime):
                yield self
        finally:
            if self.gate:
                self.gate.release.set()
            app.dependency_overrides.clear()
            app.dependency_overrides.update(previous)
            for client in self.clients:
                client.close()
            self.engine.dispose()

    def personalisation(self, account="a"):
        with self.engine.connect() as db:
            genres = list(
                db.execute(
                    text(
                        "SELECT genre_id FROM user_genre_preferences WHERE user_id=:id ORDER BY genre_id"
                    ),
                    {"id": account},
                ).scalars()
            )
            ratings = [
                tuple(row)
                for row in db.execute(
                    text(
                        "SELECT movie_id,rating FROM user_movie_ratings WHERE user_id=:id ORDER BY movie_id"
                    ),
                    {"id": account},
                )
            ]
            return genres, ratings

    def shared_rows(self):
        tables = [
            "users",
            "auth_sessions",
            "catalogue_state",
            "catalogue_revisions",
            "catalog_movies",
            "genres",
            "movie_genres",
        ]
        with self.engine.connect() as db:
            return {
                table: [
                    tuple(row)
                    for row in db.execute(text(f"SELECT * FROM {table} ORDER BY 1,2"))
                ]
                for table in tables
            }


def mutate(client, kind: str, *, actor="request", value=4):
    headers = {**HEADERS, "X-T11-Actor": actor}
    if kind == "reset":
        return client.post(RESET, json=CONFIRMED, headers=headers)
    if kind == "preferences":
        return client.put(PREFERENCES, json=NEW_GENRES, headers=headers)
    assert kind == "rating"
    return client.put(RATING, json={"rating": value}, headers=headers)


def concurrent_pair(
    harness, first_kind, second_kind, *, follower_account="a", follower_rating=4
):
    """Two API requests overlap a held SQLite write; no sleep-based ordering."""
    statement = (
        "UPDATE user_movie_ratings"
        if first_kind == "rating"
        else "DELETE FROM user_genre_preferences"
    )
    harness.gate = WriteGate(statement)
    first_client = harness.client()
    second_client = harness.client(follower_account)
    with ThreadPoolExecutor(max_workers=2) as executor:
        first = executor.submit(mutate, first_client, first_kind, actor="leader")
        try:
            assert harness.gate.leader_written.wait(5), (
                "leader did not execute its real write"
            )
            second = executor.submit(
                mutate,
                second_client,
                second_kind,
                actor="follower",
                value=follower_rating,
            )
            assert harness.gate.follower_attempted.wait(5), (
                "follower did not reach reservation SQL"
            )
            assert not second.done(), (
                "follower completed while leader still held the database writer"
            )
        finally:
            harness.gate.release.set()
        responses = first.result(timeout=10), second.result(timeout=10)
    # Physical reservation and held write establish order. Do not compare wall
    # clocks or HTTP completion: response delivery may race after commit.
    assert harness.trace.index(("leader", "mutated")) < harness.trace.index(
        ("follower", "acquired")
    )
    assert harness.connections["leader"].isdisjoint(harness.connections["follower"])
    return responses
