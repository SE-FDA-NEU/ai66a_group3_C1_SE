"""PostgreSQL 18 recovery rehearsal on two empty, disposable databases."""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest
from app.cli.compare_recovery import _validate_url
from app.db.database import create_database_engine
from app.integrations.tmdb import TmdbClient
from app.main import app, get_db
from app.security.passwords import hash_password
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[2]
HEAD = "d9a6f2c1e508"


def _run(command: list[str], *, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, cwd=ROOT, env=os.environ | (env or {}),
                            capture_output=True, text=True, timeout=120, check=False)
    return result


def _client_args(raw_url: str) -> tuple[list[str], dict[str, str]]:
    url = make_url(raw_url)
    args = ["--host", url.host, "--port", str(url.port or 5432),
            "--username", url.username, "--dbname", url.database]
    env = {"PGSSLMODE": url.query.get("sslmode", "verify-full")}
    if url.password:
        env["PGPASSWORD"] = url.password
    return args, env


def _assert_success(result: subprocess.CompletedProcess[str], name: str) -> None:
    # CLI diagnostics can contain credentials; report only the command and exit code.
    assert result.returncode == 0, f"{name} failed with exit {result.returncode}"


def test_comparator_refuses_redirected_or_misidentified_database():
    with pytest.raises(ValueError, match="overrides"):
        _validate_url("postgresql+psycopg://u@db.example.test/confirmed?dbname=other", "confirmed")
    with pytest.raises(ValueError, match="differs"):
        _validate_url("postgresql+psycopg://u@db.example.test/other", "confirmed")


@pytest.mark.skipif(not (os.getenv("RECOVERY_TEST_SOURCE_URL") and
                         os.getenv("RECOVERY_TEST_TARGET_URL")),
                    reason="Two disposable PostgreSQL 18 URLs are required")
def test_dump_restore_regional_account_index_and_rollback_refusal(tmp_path, monkeypatch):
    source_url = os.environ["RECOVERY_TEST_SOURCE_URL"]
    target_url = os.environ["RECOVERY_TEST_TARGET_URL"]
    source_name = make_url(source_url).database
    target_name = make_url(target_url).database
    _validate_url(source_url, source_name)
    _validate_url(target_url, target_name)
    assert source_name != target_name
    assert source_name.startswith("s5_t06_") and target_name.startswith("s5_t06_")
    assert _run(["pg_dump", "--version"]).stdout.startswith("pg_dump (PostgreSQL) 18.")
    assert _run(["pg_restore", "--version"]).stdout.startswith("pg_restore (PostgreSQL) 18.")
    source = create_database_engine(source_url)
    target = create_database_engine(target_url)
    try:
        for engine in (source, target):
            with engine.connect() as connection:
                assert int(connection.exec_driver_sql("SHOW server_version_num").scalar()) // 10000 == 18
                assert connection.exec_driver_sql("SELECT current_database()").scalar() == engine.url.database
            assert "alembic_version" not in inspect(engine).get_table_names()
        _assert_success(_run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
                              "upgrade", "head"], env={"DATABASE_URL": source_url}), "alembic")

        with source.begin() as connection:
            connection.execute(text("INSERT INTO catalogue_revisions "
                "(id,provider,created_at,inserted_movie_count,updated_movie_count,rejected_movie_count) "
                "VALUES ('r','tmdb',now(),2,0,0)"))
            connection.execute(text("INSERT INTO catalogue_state(id,active_revision_id,updated_at) "
                                    "VALUES (1,'r',now())"))
            connection.execute(text("INSERT INTO genres(id,name) VALUES (28,'Action'),(18,'Drama')"))
            connection.execute(text("INSERT INTO catalog_movies "
                "(id,catalogue_revision_id,source,source_id,title,overview,poster_path,backdrop_path,"
                "trailer_site,trailer_key,trailer_type,trailer_official,source_fetched_at) VALUES "
                "('movie-a','r','tmdb','101','Moon journey','Moon rescue journey',"
                "'/a.jpg','/a-back.jpg','YouTube','AbCdEf123_-','Trailer',true,now()),"
                "('movie-b','r','tmdb','102','Moon return','Another moon rescue',"
                "'/b.jpg','/b-back.jpg','YouTube','AbCdEf123_-','Trailer',true,now())"))
            connection.execute(text("INSERT INTO movie_genres(movie_id,genre_id) VALUES "
                                    "('movie-a',28),('movie-a',18),('movie-b',28),('movie-b',18)"))
            connection.execute(text("INSERT INTO movie_provider_checks "
                "(movie_id,country,status,attempted_at,checked_at,watch_options_url,link_status) VALUES "
                "('movie-a','US','success',now(),now(),"
                "'https://www.themoviedb.org/movie/101/watch?locale=US','valid'),"
                "('movie-a','GB','success',now(),now(),"
                "'https://www.themoviedb.org/movie/101/watch?locale=GB','valid'),"
                "('movie-a','SG','no_data',now(),now(),NULL,'missing'),"
                "('movie-a','VN','success',now(),now(),"
                "'https://www.themoviedb.org/movie/101/watch?locale=VN','valid'),"
                "('movie-b','US','stale',now(),now(),"
                "'https://www.themoviedb.org/movie/102/watch?locale=US','valid'),"
                "('movie-b','GB','error',now(),NULL,NULL,NULL),"
                "('movie-b','SG','success',now(),now(),"
                "'https://www.themoviedb.org/movie/102/watch?locale=SG','valid')"))
            connection.execute(text("INSERT INTO movie_watch_providers "
                "(movie_id,country,availability_type,provider_id,name,logo_path) VALUES "
                "('movie-a','US','flatrate',8,'Synthetic US','/logo.jpg'),"
                "('movie-a','GB','rent',8,'Synthetic GB','/logo.jpg'),"
                "('movie-a','VN','buy',8,'Synthetic VN','/logo.jpg'),"
                "('movie-b','US','buy',8,'Synthetic US','/logo.jpg'),"
                "('movie-b','SG','free',8,'Synthetic SG','/logo.jpg')"))
            connection.execute(text("INSERT INTO users(id,email_normalized,password_hash,created_at) "
                                    "VALUES ('a','a@example.test',:hash,now()),"
                                    "('b','b@example.test',:hash,now())"),
                               {"hash": hash_password("movie12345")})

        def source_session():
            with Session(source, autoflush=False) as session:
                yield session

        app.dependency_overrides[get_db] = source_session
        a, b = TestClient(app), TestClient(app)
        for client, label, genre, rating, movie_id in (
            (a, "a", 28, 3.5, "movie-a"), (b, "b", 18, 4.5, "movie-b"),
        ):
            assert client.post("/api/auth/login", json={
                "email": f"{label}@example.test", "password": "movie12345",
            }).status_code == 200
            assert client.put("/api/me/preferences", json={"genreIds": [genre]}).status_code == 200
            assert client.put(f"/api/me/ratings/{movie_id}", json={"rating": rating}).status_code == 200
            assert client.put(f"/api/me/watchlist/{movie_id}").status_code == 200
        app.dependency_overrides.clear()

        archive = tmp_path / "recovery.dump"
        source_args, source_env = _client_args(source_url)
        _assert_success(_run(["pg_dump", "--format=custom", "--no-owner", "--no-privileges",
                              "--file", str(archive), *source_args], env=source_env), "pg_dump")
        assert archive.stat().st_size > 0
        target_args, target_env = _client_args(target_url)
        _assert_success(_run(["pg_restore", "--exit-on-error", "--no-owner", "--no-privileges",
                              *target_args, str(archive)], env=target_env), "pg_restore")
        comparison = _run([sys.executable, "-m", "app.cli.compare_recovery",
                           "--source-database", source_name, "--target-database", target_name],
                          env={"RECOVERY_SOURCE_URL": source_url,
                               "RECOVERY_TARGET_URL": target_url,
                               "PYTHONPATH": str(ROOT / "backend")})
        _assert_success(comparison, "compare_recovery")
        assert "region_status_and_link_states_equal=true" in comparison.stdout
        _assert_success(_run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
                              "check"], env={"DATABASE_URL": target_url}), "alembic check")
        with target.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == HEAD
            assert connection.execute(text("SELECT count(*) FROM movie_provider_checks")).scalar() == 7
            assert connection.execute(text("SELECT count(*) FROM pg_constraint "
                                           "WHERE contype IN ('f','c') AND NOT convalidated")).scalar() == 0
        duplicate = _run(["pg_restore", "--exit-on-error", "--no-owner", "--no-privileges",
                          *target_args, str(archive)], env=target_env)
        assert duplicate.returncode != 0
        _assert_success(_run([sys.executable, "-m", "app.cli.compare_recovery",
                              "--source-database", source_name, "--target-database", target_name],
                             env={"RECOVERY_SOURCE_URL": source_url,
                                  "RECOVERY_TARGET_URL": target_url,
                                  "PYTHONPATH": str(ROOT / "backend")}), "post-refusal comparison")
        downgrade = _run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
                          "downgrade", "b8e4d2c96f10"], env={"DATABASE_URL": target_url})
        assert downgrade.returncode != 0
        assert "Regional provider data must be preserved" in downgrade.stderr
        _assert_success(_run([sys.executable, "-m", "app.cli.compare_recovery",
                              "--source-database", source_name, "--target-database", target_name],
                             env={"RECOVERY_SOURCE_URL": source_url,
                                  "RECOVERY_TARGET_URL": target_url,
                                  "PYTHONPATH": str(ROOT / "backend")}), "post-downgrade comparison")
        with target.connect() as connection:
            assert connection.execute(text("SELECT version_num FROM alembic_version")).scalar() == HEAD

        import app.main as main_module

        factory = sessionmaker(target, autoflush=False)
        monkeypatch.setattr(main_module, "engine", target)
        monkeypatch.setattr(main_module, "SessionLocal", factory)
        monkeypatch.setenv("NLP_INDEX_PATH", str(tmp_path / "restored-index.json"))
        monkeypatch.setenv("TMDB_NETWORK_DISABLED", "1")
        monkeypatch.setattr(TmdbClient, "_get_json", lambda *_a, **_k: pytest.fail("runtime TMDb call"))

        def target_session():
            with factory() as session:
                yield session

        app.dependency_overrides[get_db] = target_session
        with TestClient(app) as restored_a, TestClient(app) as restored_b:
            restored_a.cookies.update(a.cookies)
            restored_b.cookies.update(b.cookies)
            assert restored_a.get("/health").json()["migrationVersion"] == HEAD
            assert restored_a.get("/api/movies").json()["meta"]["total"] == 2
            assert restored_a.get("/api/movies/search", params={
                "q": "moon", "mode": "description",
            }).status_code == 200
            assert restored_a.get("/api/movies/movie-a/similar").status_code == 200
            for country in ("US", "GB", "SG"):
                response = restored_a.get("/api/movies/movie-a", params={"country": country})
                assert response.status_code == 200
                movie = response.json()["data"]["movie"]
                assert movie["id"] == "movie-a"
                assert movie["providers"]["country"] == country
                assert movie["providers"]["status"] == ("no_data" if country == "SG" else "success")
                groups = movie["providers"]["groups"]
                expected_group = {"US": "flatrate", "GB": "rent", "SG": None}[country]
                assert {key for key, value in groups.items() if value} == (
                    {expected_group} if expected_group else set()
                )
                if expected_group:
                    assert groups[expected_group][0]["name"] == f"Synthetic {country}"
                assert movie["watchOptionsUrl"] == (
                    f"https://www.themoviedb.org/movie/101/watch?locale={country}"
                    if country != "SG" else None
                )
            assert restored_a.get("/api/movies/movie-a").json()["data"]["movie"]["providers"]["country"] == "US"
            assert restored_a.get("/api/movies/movie-a?country=VN").status_code == 400
            assert restored_a.get("/api/movies/movie-a?country=CA").status_code == 400
            assert restored_a.get("/api/movies/movie-a?country=us").status_code == 400
            for country, status, expected_link in (
                ("US", "stale", "https://www.themoviedb.org/movie/102/watch?locale=US"),
                ("GB", "error", None),
                ("SG", "success", "https://www.themoviedb.org/movie/102/watch?locale=SG"),
            ):
                movie = restored_a.get("/api/movies/movie-b", params={"country": country}).json()["data"]["movie"]
                assert movie["id"] == "movie-b"
                assert movie["providers"]["status"] == status
                assert movie["watchOptionsUrl"] == expected_link
            assert restored_a.get("/api/me/ratings/movie-a").json()["data"]["rating"] == 3.5
            assert restored_b.get("/api/me/ratings/movie-b").json()["data"]["rating"] == 4.5
            assert restored_a.post("/api/me/profile/reset", json={"confirm": True}).status_code == 200
            assert restored_a.get("/api/me/preferences").json()["data"]["genres"] == []
            assert restored_a.get("/api/me/profile").json()["data"]["ratingCount"] == 0
            assert restored_a.get("/api/me/watchlist").json()["meta"]["total"] == 1
            assert restored_b.get("/api/me/watchlist").json()["meta"]["total"] == 1
            assert restored_b.get("/api/me/ratings/movie-b").json()["data"]["rating"] == 4.5
            with target.begin() as connection:
                connection.execute(text("UPDATE alembic_version SET version_num='b8e4d2c96f10'"))
            assert restored_a.get("/health").status_code == 503
            with target.begin() as connection:
                connection.execute(text("UPDATE alembic_version SET version_num=:head"), {"head": HEAD})
            assert restored_a.get("/health").status_code == 200
        with TestClient(app) as later:
            assert later.post("/api/auth/login", json={
                "email": "b@example.test", "password": "movie12345",
            }).status_code == 200
            assert later.get("/api/me/watchlist").json()["meta"]["total"] == 1
            assert later.get("/api/me/ratings/movie-b").json()["data"]["rating"] == 4.5
    finally:
        app.dependency_overrides.clear()
        source.dispose()
        target.dispose()
