"""S3-T23 / #125: real HTTP sessions + migrated SQLite; no API overrides.

Browser behaviour lives in frontend/e2e/s13.acceptance.ts. These attack cases
use separate HTTP clients and fresh DB reads, including a real process restart.
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
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]
FIXTURE = ROOT / "backend/tests/fixtures/s04_browser_acceptance.json"
MOVIE = json.loads(FIXTURE.read_text())["movies"][0]["id"]
PASSWORD = "s13-synthetic-password"


@pytest.fixture
def application(tmp_path):
    database = tmp_path / "acceptance.db"
    env = dict(
        os.environ,
        DATABASE_URL=f"sqlite:///{database.as_posix()}",
        SESSION_COOKIE_SECURE="false",
        TMDB_READ_ACCESS_TOKEN="",
        PYTHONPATH=str(ROOT / "backend"),
    )
    subprocess.run(
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
        env=env,
        check=True,
        capture_output=True,
    )
    # Reuse the browser catalogue seeder, never the developer DB or TMDb token.
    subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import sys,json; from pathlib import Path; "
                "sys.path.insert(0, 'backend/scripts'); "
                "from s04_acceptance_server import seed_database; "
                "seed_database(Path(sys.argv[1]), "
                "json.loads(Path(sys.argv[2]).read_text()))"
            ),
            str(database),
            str(FIXTURE),
        ],
        cwd=ROOT,
        env=env,
        check=True,
    )
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    url = f"http://127.0.0.1:{port}"
    processes = []

    def restart():
        if processes and processes[-1].poll() is None:
            processes[-1].terminate()
            processes[-1].wait(timeout=10)
        process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "app.main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=ROOT,
            env=env,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        processes.append(process)
        with httpx.Client(base_url=url, timeout=1, trust_env=False) as probe:
            deadline = time.monotonic() + 15
            while time.monotonic() < deadline:
                assert process.poll() is None, "Acceptance backend stopped"
                try:
                    if probe.get("/api/auth/me").status_code == 401:
                        return
                except httpx.TransportError:
                    pass
                time.sleep(0.05)
        pytest.fail("Acceptance backend did not start")

    clients = []

    def client(email=None):
        http = httpx.Client(
            base_url=url, headers={"Origin": url}, timeout=5, trust_env=False
        )
        clients.append(http)
        if email:
            credentials = {"email": email, "password": PASSWORD}
            assert http.post("/api/auth/register", json=credentials).status_code == 201
            assert http.post("/api/auth/login", json=credentials).status_code == 200
        return http

    try:
        restart()
        yield database, client, restart
    finally:
        for http in clients:
            http.close()
        for process in processes:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)


def rows(database):
    with closing(sqlite3.connect(database)) as connection:
        return {
            table: connection.execute(f"SELECT * FROM {table} ORDER BY 1, 2").fetchall()
            for table in ("user_genre_preferences", "user_movie_ratings")
        }


def save(http, genre, rating):
    assert (
        http.put("/api/me/preferences", json={"genreIds": [genre]}).status_code == 200
    )
    assert (
        http.put(f"/api/me/ratings/{MOVIE}", json={"rating": rating}).status_code == 200
    )


def genres(http, **kwargs):
    response = http.get("/api/me/preferences", **kwargs)
    assert response.status_code == 200
    return [genre["id"] for genre in response.json()["data"]["genres"]]


def recommendations(http, **kwargs):
    response = http.get("/api/me/recommendations", **kwargs)
    assert response.status_code == 200
    return response.json()["data"]


def test_independent_sessions_ignore_forged_identity_and_reset_only_owner(application):
    database, client, _ = application
    a, b = client("a@example.test"), client("b@example.test")
    save(a, 8101, 5)
    save(b, 8102, 2)
    a_id = a.get("/api/auth/me").json()["data"]["user"]["id"]
    forged = {
        "params": {"userId": a_id, "user_id": a_id, "accountId": a_id},
        "headers": {"X-User-Id": a_id},
    }
    before = rows(database)
    assert genres(b, **forged) == [8102]
    assert b.get(f"/api/me/ratings/{MOVIE}", **forged).json()["data"]["rating"] == 2
    a_recommendations = recommendations(a)
    b_recommendations = recommendations(b, **forged)
    assert [m["title"] for m in a_recommendations["movies"]] == [
        "A",
        "B",
        "D",
        "F",
        "H",
        "J",
        "L",
    ]
    assert [m["title"] for m in b_recommendations["movies"]] == [
        "C",
        "E",
        "G",
        "I",
        "K",
    ]
    assert rows(database) == before
    assert (
        b.put("/api/me/preferences", json={"genreIds": [8103]}, **forged).status_code
        == 200
    )
    assert (
        b.put(f"/api/me/ratings/{MOVIE}", json={"rating": 1}, **forged).status_code
        == 200
    )
    assert genres(a) == [8101]
    assert a.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 5
    # A body account selector is rejected; query/header selectors cannot target A.
    assert (
        b.post(
            "/api/me/profile/reset", json={"confirm": True, "userId": a_id}
        ).status_code
        == 400
    )
    assert (
        b.post("/api/me/profile/reset", json={"confirm": True}, **forged).status_code
        == 200
    )
    assert genres(a) == [8101]
    assert a.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 5
    save(b, 8102, 2)
    b_before = recommendations(b)
    assert a.post("/api/me/profile/reset", json={"confirm": True}).status_code == 200
    assert genres(a) == []
    assert a.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] is None
    assert recommendations(a)["mode"] == "popular"
    assert genres(b) == [8102]
    assert b.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 2
    assert recommendations(b) == b_before
    with closing(sqlite3.connect(database)) as connection:
        assert connection.execute(
            "SELECT user_id FROM user_genre_preferences"
        ).fetchall() == [(b.get("/api/auth/me").json()["data"]["user"]["id"],)]
        assert connection.execute(
            "SELECT rating FROM user_movie_ratings"
        ).fetchall() == [(2,)]


@pytest.mark.parametrize("state", ["missing", "expired", "revoked"])
def test_invalid_sessions_reject_every_private_read_and_write(application, state):
    database, client, _ = application
    owner = client("owner@example.test")
    save(owner, 8101, 4)
    before = rows(database)
    attacker = client()
    if state != "missing":
        attacker.cookies.update(owner.cookies)
        digest = hashlib.sha256(owner.cookies.get("ams_session").encode()).hexdigest()
        column = "expires_at" if state == "expired" else "revoked_at"
        value = datetime.now(UTC) - timedelta(days=1)
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute(
                f"UPDATE auth_sessions SET {column}=? WHERE token_digest=?",
                (value.isoformat(), digest),
            )
    for method, path, body in [
        ("GET", "/api/auth/me", None),
        ("GET", "/api/genres", None),
        ("GET", "/api/me/preferences", None),
        ("PUT", "/api/me/preferences", {"genreIds": [8102]}),
        ("GET", f"/api/me/ratings/{MOVIE}", None),
        ("PUT", f"/api/me/ratings/{MOVIE}", {"rating": 1}),
        ("GET", "/api/me/recommendations", None),
        ("POST", "/api/me/profile/reset", {"confirm": True}),
    ]:
        response = attacker.request(method, path, **({"json": body} if body else {}))
        assert response.status_code == 401, (state, method, path)
        assert response.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert rows(database) == before


def test_logout_cookie_replay_relogin_and_actual_backend_restart(application):
    database, client, restart = application
    owner = client("persist@example.test")
    save(owner, 8101, 4)
    before, ranked = rows(database), recommendations(owner)
    replay = client()
    replay.cookies.update(owner.cookies)
    assert owner.post("/api/auth/logout").status_code == 204
    assert replay.get("/api/me/preferences").status_code == 401
    assert replay.put(f"/api/me/ratings/{MOVIE}", json={"rating": 1}).status_code == 401
    credentials = {"email": "persist@example.test", "password": PASSWORD}
    assert owner.post("/api/auth/login", json=credentials).status_code == 200
    assert genres(owner) == [8101]
    assert owner.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 4
    restart()  # New uvicorn PID, same migrated file; no reseeding or API mocks.
    assert genres(owner) == [8101]
    assert owner.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 4
    assert recommendations(owner) == ranked
    assert replay.get("/api/me/preferences").status_code == 401
    assert owner.post("/api/auth/logout").status_code == 204
    assert owner.post("/api/auth/login", json=credentials).status_code == 200
    assert rows(database) == before
    assert recommendations(owner) == ranked


def test_reset_confirmation_origin_and_real_delete_failure_preserve_both_accounts(
    application,
):
    database, client, _ = application
    a, b = client("reset-a@example.test"), client("reset-b@example.test")
    save(a, 8101, 5)
    save(b, 8102, 2)
    before = rows(database)
    for body in [{}, {"confirm": False}, {"confirm": "true"}]:
        assert a.post("/api/me/profile/reset", json=body).status_code == 400
        assert rows(database) == before
    for origin in ["https://attacker.example", "null"]:
        response = a.post(
            "/api/me/profile/reset", json={"confirm": True}, headers={"Origin": origin}
        )
        assert response.status_code == 403
        assert rows(database) == before
    # The real database aborts the second DELETE, after preferences were deleted.
    # This crosses HTTP -> route -> repository -> transaction with no mocks.
    with closing(sqlite3.connect(database)) as connection, connection:
        connection.execute("""CREATE TRIGGER s13_fail_reset
            BEFORE DELETE ON user_movie_ratings
            BEGIN SELECT RAISE(ABORT, 's13-private-injected-failure'); END""")
    try:
        failed = a.post("/api/me/profile/reset", json={"confirm": True})
        assert failed.status_code == 503
        assert failed.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
        assert "s13-private-injected-failure" not in failed.text
        assert rows(database) == before
    finally:
        with closing(sqlite3.connect(database)) as connection, connection:
            connection.execute("DROP TRIGGER s13_fail_reset")
    assert genres(a) == [8101]
    assert a.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 5
    assert genres(b) == [8102]
    assert b.get(f"/api/me/ratings/{MOVIE}").json()["data"]["rating"] == 2
