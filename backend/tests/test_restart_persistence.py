"""Account data survives a new application process on a migrated test database."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
EMAIL = "s3-c04@example.invalid"
PASSWORD = "disposable-test-password"
HEADERS = {"Origin": "http://testserver"}


def test_preferences_and_rating_survive_application_restart(tmp_path: Path) -> None:
    database = tmp_path / "restart.db"
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
    for command in (
        [
            sys.executable,
            "-m",
            "alembic",
            "-c",
            "backend/alembic.ini",
            "upgrade",
            "head",
        ],
        [sys.executable, "-m", "app.cli.bootstrap_m2_catalogue"],
        [sys.executable, __file__, "create"],
        [sys.executable, __file__, "verify"],
    ):
        completed = subprocess.run(
            command,
            cwd=ROOT,
            env=environment,
            capture_output=True,
            text=True,
            check=False,
        )
        assert completed.returncode == 0, completed.stderr


def _probe(mode: str) -> None:
    from app.main import app

    with TestClient(app) as client:
        if mode == "create":
            assert (
                client.post(
                    "/api/auth/register", json={"email": EMAIL, "password": PASSWORD}
                ).status_code
                == 201
            )
        assert (
            client.post(
                "/api/auth/login",
                json={"email": EMAIL, "password": PASSWORD},
                headers=HEADERS,
            ).status_code
            == 200
        )

        genres = client.get("/api/genres").json()["data"]["genres"]
        genre_id = genres[0]["id"]
        movies = client.get("/api/movies?limit=1").json()["data"]["movies"]
        movie_id = movies[0]["id"]
        rating_path = f"/api/me/ratings/{movie_id}"

        if mode == "create":
            assert (
                client.put(
                    "/api/me/preferences",
                    json={"genreIds": [genre_id]},
                    headers=HEADERS,
                ).status_code
                == 200
            )
            assert (
                client.put(rating_path, json={"rating": 4}, headers=HEADERS).status_code
                == 200
            )
        else:
            saved = client.get("/api/me/preferences").json()["data"]["genres"]
            assert [genre["id"] for genre in saved] == [genre_id]
            assert client.get(rating_path).json()["data"]["rating"] == 4


if __name__ == "__main__":
    _probe(sys.argv[1])
