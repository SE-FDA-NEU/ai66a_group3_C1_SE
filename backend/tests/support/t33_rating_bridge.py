"""Test-only React transport to real FastAPI and disposable migrated SQLite.

This is not a production endpoint, a browser-cookie test or live TMDb evidence.
"""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
import sys
from contextlib import closing, contextmanager
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch


def reply(value):
    print(json.dumps(value), flush=True)


@contextmanager
def api_clients(app, engine):
    from fastapi.testclient import TestClient

    try:
        with TestClient(app) as setup, TestClient(app) as client:
            yield setup, client
    finally:
        engine.dispose()


def main():
    with TemporaryDirectory(prefix="t33-rating-acceptance-") as directory:
        path = Path(directory) / "acceptance.db"
        os.environ["DATABASE_URL"] = f"sqlite:///{path.as_posix()}"
        os.environ["TMDB_READ_ACCESS_TOKEN"] = ""
        root = Path(__file__).resolve().parents[3]
        sys.path.insert(0, str(root / "backend"))
        bootstrap = subprocess.run(
            [sys.executable, "-m", "app.cli.bootstrap_m2_catalogue"],
            cwd=root,
            env=os.environ | {"PYTHONUTF8": "1"},
            capture_output=True,
            text=True,
            check=False,
        )
        if bootstrap.returncode:
            raise RuntimeError("Isolated T33 fixture bootstrap failed")

        from app.db.database import engine
        from app.main import app
        from sqlalchemy.exc import OperationalError

        origin = {"Origin": "http://testserver"}
        with api_clients(app, engine) as (setup, client):
            for email, genres in [
                ("t33-a@example.com", [28, 35]),
                ("t33-b@example.com", [18]),
            ]:
                payload = {"email": email, "password": "movie123"}
                assert setup.post("/api/auth/register", json=payload).status_code == 201
                assert (
                    setup.post(
                        "/api/auth/login", json=payload, headers=origin
                    ).status_code
                    == 200
                )
                assert (
                    setup.put(
                        "/api/me/preferences", json={"genreIds": genres}, headers=origin
                    ).status_code
                    == 200
                )
            movie = client.get("/api/movies?limit=10").json()["data"]["movies"][0]
            fail_next_save = False
            reply(
                {
                    "ready": True,
                    "metadata": {"movieId": movie["id"], "title": movie["title"]},
                }
            )
            for line in sys.stdin:
                request = json.loads(line)
                op = request["op"]
                if op == "close":
                    reply({"id": request["id"], "result": True})
                    break
                if op == "fail_next_save":
                    fail_next_save = True
                    result = True
                elif op == "state":
                    with closing(
                        sqlite3.connect(path.as_uri() + "?mode=ro", uri=True)
                    ) as db:
                        result = {
                            "preferences": db.execute(
                                "SELECT user_id, genre_id FROM user_genre_preferences ORDER BY user_id, genre_id"
                            ).fetchall(),
                            "ratings": db.execute(
                                "SELECT u.email_normalized, r.movie_id, r.rating FROM user_movie_ratings r "
                                "JOIN users u ON u.id=r.user_id ORDER BY u.email_normalized, r.movie_id"
                            ).fetchall(),
                            "integrity": db.execute(
                                "PRAGMA integrity_check"
                            ).fetchone()[0],
                        }
                elif op == "request":
                    kwargs = {
                        "headers": origin,
                        **({"json": request["body"]} if "body" in request else {}),
                    }
                    if (
                        fail_next_save
                        and request["method"] == "PUT"
                        and request["url"].startswith("/api/me/ratings/")
                    ):
                        fail_next_save = False
                        with patch(
                            "sqlalchemy.orm.Session.commit",
                            side_effect=OperationalError("injected", {}, Exception()),
                        ):
                            response = client.request(
                                request["method"], request["url"], **kwargs
                            )
                    else:
                        response = client.request(
                            request["method"], request["url"], **kwargs
                        )
                    result = {
                        "status": response.status_code,
                        "body": response.json() if response.content else None,
                    }
                else:
                    raise ValueError("Unknown T33 operation")
                reply({"id": request["id"], "result": result})


if __name__ == "__main__":
    main()
