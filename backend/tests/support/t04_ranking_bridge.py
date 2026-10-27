"""Test-only JSON-lines transport: React/jsdom -> real FastAPI -> migrated SQLite.

S4-T04 fixture: two accounts with Action and Comedy saved, and two candidates whose
raw popularity is 80 (Zulu Action: Action only, Alpha Comedy: Comedy only). The
numbers belong to this deterministic fixture, not to the imported TMDb catalogue.
Not an HTTP endpoint or browser-cookie test. Never used by production routes.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

ORIGIN = {"Origin": "http://testserver"}
ACCOUNTS = {"a": "t04-a@example.com", "b": "t04-b@example.com"}
MOVIES = [
    ("zulu-action", "Zulu Action", 28),
    ("alpha-comedy", "Alpha Comedy", 35),
]


def reply(value):
    print(json.dumps(value), flush=True)


def main():
    with TemporaryDirectory(prefix="t04-ranking-refresh-") as directory:
        path = Path(directory) / "acceptance.db"
        # Set isolated configuration before importing any application module.
        os.environ["DATABASE_URL"] = f"sqlite:///{path.as_posix()}"
        os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
        root = Path(__file__).resolve().parents[3]
        sys.path.insert(0, str(root / "backend"))
        sys.path.insert(0, str(root / "backend" / "tests"))
        from filter_verification_support import migrate_database

        migrate_database(path)

        from app.main import app, get_db
        from app.repositories.movies import (
            activate_catalogue_revision,
            create_catalogue_revision,
            replace_movie_genres,
            upsert_catalogue_movie,
            upsert_genre,
        )
        from fastapi.testclient import TestClient
        from sqlalchemy import create_engine, event
        from sqlalchemy.orm import sessionmaker

        engine = create_engine(
            f"sqlite:///{path.as_posix()}", connect_args={"check_same_thread": False}
        )

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _record):
            connection.execute("PRAGMA foreign_keys=ON")

        sessions = sessionmaker(bind=engine, autoflush=False)

        def request_session():
            with sessions() as session:
                yield session

        app.dependency_overrides[get_db] = request_session
        clients = {name: TestClient(app) for name in ACCOUNTS}
        try:
            with sessions() as session, session.begin():
                revision = create_catalogue_revision(session, provider="synthetic-t04")
                for genre_id, name in [(28, "Action"), (35, "Comedy")]:
                    upsert_genre(session, genre_id=genre_id, name=name)
                for source_id, title, genre_id in MOVIES:
                    movie = upsert_catalogue_movie(
                        session,
                        catalogue_revision_id=revision.id,
                        source="synthetic-t04",
                        source_id=source_id,
                        title=title,
                        popularity_score=80,
                    )
                    replace_movie_genres(session, movie=movie, genre_ids=[genre_id])
                activate_catalogue_revision(session, revision_id=revision.id)

            for name, email in ACCOUNTS.items():
                http = clients[name]
                payload = {"email": email, "password": "movie123"}
                assert http.post("/api/auth/register", json=payload).status_code == 201
                assert (
                    http.post(
                        "/api/auth/login", json=payload, headers=ORIGIN
                    ).status_code
                    == 200
                )
                assert (
                    http.put(
                        "/api/me/preferences",
                        json={"genreIds": [28, 35]},
                        headers=ORIGIN,
                    ).status_code
                    == 200
                )

            with closing(sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)) as db:
                movie_id, title = db.execute(
                    "SELECT id, title FROM catalog_movies WHERE title = 'Zulu Action'"
                ).fetchone()
            reply({"ready": True, "metadata": {"movieId": movie_id, "title": title}})

            for line in sys.stdin:
                request = json.loads(line)
                op = request["op"]
                if op == "close":
                    reply({"id": request["id"], "result": True})
                    break
                if op == "state":
                    with closing(
                        sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
                    ) as db:
                        result = {
                            "preferences": db.execute(
                                "SELECT u.email_normalized, p.genre_id "
                                "FROM user_genre_preferences p "
                                "JOIN users u ON u.id=p.user_id "
                                "ORDER BY u.email_normalized, p.genre_id"
                            ).fetchall(),
                            "ratings": db.execute(
                                "SELECT u.email_normalized, r.movie_id, r.rating "
                                "FROM user_movie_ratings r "
                                "JOIN users u ON u.id=r.user_id "
                                "ORDER BY u.email_normalized, r.movie_id"
                            ).fetchall(),
                            "popularity": db.execute(
                                "SELECT title, popularity_score FROM catalog_movies "
                                "ORDER BY title"
                            ).fetchall(),
                            "integrity": db.execute(
                                "PRAGMA integrity_check"
                            ).fetchone()[0],
                        }
                elif op == "request":
                    response = clients[request.get("account", "a")].request(
                        request["method"],
                        request["url"],
                        headers=ORIGIN,
                        **({"json": request["body"]} if "body" in request else {}),
                    )
                    result = {
                        "status": response.status_code,
                        "body": response.json() if response.content else None,
                    }
                else:
                    raise ValueError("Unknown T04 test operation")
                reply({"id": request["id"], "result": result})
        finally:
            for http in clients.values():
                http.close()
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()


if __name__ == "__main__":
    main()
