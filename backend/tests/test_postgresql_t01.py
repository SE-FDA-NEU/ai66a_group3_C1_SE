"""S5-T01 integration proof. Set TEST_POSTGRES_URL to a disposable PostgreSQL DB."""

from __future__ import annotations

import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path
from time import sleep
from uuid import uuid4

import pytest
from app.cli.provision_account import ProvisioningError, provision_account
from app.db.account_writes import begin_account_write
from app.db.database import create_database_engine
from app.db.models import MovieProviderCheck, MovieWatchProvider, User, UserMovieRating
from app.main import app, get_db
from app.repositories.movies import (
    activate_catalogue_revision,
    count_active_movies,
    create_catalogue_revision,
    list_active_movies,
    replace_movie_genres,
    search_active_movie_titles,
    upsert_catalogue_movie,
    upsert_genre,
)
from app.repositories.profile import reset_user_personalisation
from app.repositories.ratings import set_user_movie_rating
from app.repositories.users import create_user
from app.security.passwords import verify_password
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]


class SecretDatabaseURL(str):
    """Keep pytest's fixture display from printing the subprocess DSN."""

    def __repr__(self) -> str:
        return "<PostgreSQL test URL (redacted)>"


def sanitized_stderr(stderr: str, database_url: str) -> str:
    password = make_url(database_url).password
    return stderr.replace(password, "[REDACTED]") if password else stderr


def test_postgresql_engine_enforces_production_tls(monkeypatch):
    url = "postgresql+psycopg://app@db.example.com/movie_app"
    engine = create_database_engine(url)
    try:
        assert engine.url.query["sslmode"] == "verify-full"
        assert engine.pool.size() == 5
    finally:
        engine.dispose()
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(ValueError, match="verify-full"):
        create_database_engine(url + "?sslmode=disable")


@pytest.mark.parametrize("parameter", [
    "host", "hostaddr", "port", "dbname", "service", "servicefile",
])
def test_provisioning_rejects_query_target_overrides(parameter):
    with pytest.raises(ProvisioningError, match="Target overrides"):
        provision_account(
            f"postgresql+psycopg://app@db.example.com/movie_app?{parameter}=other",
            expected_host="db.example.com", expected_database="movie_app",
            operator="t01-test", email="viewer@example.com", password="secret123",
        )


@pytest.fixture
def pg_engine():
    raw_url = os.environ.get("TEST_POSTGRES_URL")
    if not raw_url:
        if os.environ.get("REQUIRE_POSTGRES_TESTS") == "1":
            pytest.fail("Required PostgreSQL integration needs TEST_POSTGRES_URL")
        pytest.skip("Set TEST_POSTGRES_URL to a disposable PostgreSQL database")
    url = make_url(raw_url)
    if url.drivername != "postgresql+psycopg" or not url.database:
        pytest.fail("TEST_POSTGRES_URL must select a PostgreSQL psycopg database")
    schema = f"t01_{uuid4().hex}"
    admin = create_database_engine(raw_url)
    with admin.connect() as connection:
        actual_major = int(connection.exec_driver_sql("SHOW server_version_num").scalar()) // 10000
    expected_major = int(os.environ.get("TEST_POSTGRES_MAJOR", "18"))
    if actual_major != expected_major:
        admin.dispose()
        pytest.fail(f"Expected PostgreSQL {expected_major}, got PostgreSQL {actual_major}")
    with admin.begin() as connection:
        connection.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    test_url = url.update_query_dict({
        "options": f"-csearch_path={schema}",
    }).render_as_string(hide_password=False)
    try:
        migration = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini",
             "upgrade", "head"],
            cwd=ROOT, env=os.environ | {"DATABASE_URL": test_url},
            capture_output=True, text=True, check=False,
        )
        assert migration.returncode == 0, sanitized_stderr(migration.stderr, test_url)
        engine = create_database_engine(test_url)
        try:
            yield engine, SecretDatabaseURL(test_url)
        finally:
            engine.dispose()
    finally:
        with admin.begin() as connection:
            connection.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin.dispose()


@pytest.fixture
def pg_client(pg_engine):
    engine, url = pg_engine

    def request_session():
        with Session(engine, autoflush=False) as session:
            yield session

    app.dependency_overrides[get_db] = request_session
    try:
        with TestClient(app) as client:
            yield client, engine, url
    finally:
        app.dependency_overrides.clear()


def seed_catalogue(engine, count=13):
    with Session(engine) as session, session.begin():
        upsert_genre(session, genre_id=28, name="Action")
        upsert_genre(session, genre_id=12, name="Drama")
        revision = create_catalogue_revision(session, provider="test")
        ids = []
        for index in range(count):
            movie = upsert_catalogue_movie(
                session, catalogue_revision_id=revision.id, source="test",
                source_id=str(index), title=("Straße %_" if index == 12
                                              else f"Movie {index:02d}"),
                popularity_score=float(count - index),
            )
            movie.poster_path = "/poster.jpg"
            movie.backdrop_path = "/backdrop.jpg"
            replace_movie_genres(session, movie=movie,
                                 genre_ids=[28] if index < 10 else [12])
            ids.append(movie.id)
        activate_catalogue_revision(session, revision_id=revision.id)
        revision_id = revision.id
    return revision_id, ids


def register_and_login(client, email):
    assert client.post("/api/auth/register", json={
        "email": email, "password": "movie12345",
    }).status_code == 201
    assert client.post("/api/auth/login", json={
        "email": email, "password": "movie12345",
    }).status_code == 200


def test_empty_postgresql_migration_schema_constraints_and_provisioning(pg_engine):
    engine, url = pg_engine
    inspector = inspect(engine)
    assert {"users", "auth_sessions", "catalog_movies", "user_movie_ratings",
            "user_movie_watchlist", "catalogue_state", "movie_provider_checks",
            "movie_watch_providers"} <= set(inspector.get_table_names())
    assert {"poster_path", "backdrop_path", "trailer_key", "trailer_published_at"} <= {
        column["name"] for column in inspector.get_columns("catalog_movies")
    }
    assert "rating" in next(
        item["sqltext"] for item in inspector.get_check_constraints("user_movie_ratings")
        if item["name"] == "ck_user_movie_ratings_rating_range"
    )
    # Before the guard, libpq's query dbname redirected this URL to the
    # migrated test database even though the operator confirmed another name.
    redirected_url = make_url(url).set(database="operator_confirmed").update_query_dict({
        "dbname": make_url(url).database,
    }).render_as_string(hide_password=False)
    with pytest.raises(ProvisioningError, match="Target overrides"):
        provision_account(
            redirected_url, expected_host=make_url(url).host,
            expected_database="operator_confirmed", operator="t01-test",
            email="redirected@example.com", password="secret123",
        )
    with Session(engine) as session:
        assert session.scalar(select(User.id).where(
            User.email_normalized == "redirected@example.com"
        )) is None
    assert provision_account(
        url, expected_host=make_url(url).host, expected_database=make_url(url).database,
        operator="t01-test", email="  Viewer@Example.com ", password="secret123",
    ) == "created"
    assert provision_account(
        url, expected_host=make_url(url).host, expected_database=make_url(url).database,
        operator="t01-test", email="viewer@example.com", password="secret123",
    ) == "already_exists"
    with pytest.raises(ProvisioningError, match="different credentials"):
        provision_account(
            url, expected_host=make_url(url).host, expected_database=make_url(url).database,
            operator="t01-test", email="viewer@example.com", password="wrong",
        )
    with pytest.raises(ProvisioningError, match="does not match"):
        provision_account(
            url, expected_host=make_url(url).host, expected_database="wrong_target",
            operator="t01-test", email="other@example.com", password="secret123",
        )
    with Session(engine) as session:
        user = session.scalar(select(User).where(User.email_normalized == "viewer@example.com"))
        assert user and user.password_hash != "secret123"
        assert verify_password("secret123", user.password_hash)
    with pytest.raises(IntegrityError), engine.begin() as connection:
        connection.execute(text("INSERT INTO users (id,email_normalized,password_hash,created_at) "
                                "VALUES (:id,:email,:hash,:created)"), {
            "id": str(uuid4()), "email": "viewer@example.com", "hash": "hash",
            "created": datetime.now(UTC),
        })


def test_postgresql_vn_provider_memberships_and_constraints(pg_engine):
    engine, url = pg_engine
    def migrate(*action):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *action],
            cwd=ROOT, env=os.environ | {"DATABASE_URL": url},
            capture_output=True, text=True, check=False, timeout=30,
        )
        assert result.returncode == 0, sanitized_stderr(result.stderr, url)

    migrate("downgrade", "b8e4d2c96f10")
    _, movie_ids = seed_catalogue(engine, count=1)
    with Session(engine) as session, session.begin():
        session.add(MovieProviderCheck(movie_id=movie_ids[0], country="VN", status="success",
                                      attempted_at=datetime.now(UTC), checked_at=datetime.now(UTC)))
        session.flush()
        session.add_all(MovieWatchProvider(
            movie_id=movie_ids[0], country="VN", availability_type=group, provider_id=8, name="Synthetic",
        ) for group in ("flatrate", "rent", "buy", "free", "ads"))
    with Session(engine) as session:
        assert len(session.scalars(select(MovieWatchProvider)).all()) == 5
    migrate("upgrade", "head")
    with Session(engine) as session, session.begin():
        assert len(session.scalars(select(MovieWatchProvider)).all()) == 5
        for country in ("US", "GB", "SG"):
            session.add(MovieProviderCheck(movie_id=movie_ids[0], country=country, status="success",
                attempted_at=datetime.now(UTC), providers=[MovieWatchProvider(
                    movie_id=movie_ids[0], country=country, availability_type="flatrate", provider_id=8, name=country,
                )]))
    with Session(engine) as session:
        assert len(session.scalars(select(MovieWatchProvider)).all()) == 8
    with pytest.raises(IntegrityError), Session(engine) as session, session.begin():
        session.add(MovieWatchProvider(movie_id=movie_ids[0], country="VN", availability_type="rent",
                                       provider_id=8, name="Duplicate"))
    with pytest.raises(IntegrityError), Session(engine) as session, session.begin():
        session.add(MovieProviderCheck(movie_id="missing", country="VN", status="success",
                                      attempted_at=datetime.now(UTC)))
    with pytest.raises(IntegrityError), Session(engine) as session, session.begin():
        session.add(MovieProviderCheck(movie_id=movie_ids[0], country="CA", status="success",
                                      attempted_at=datetime.now(UTC)))


def test_postgresql_rating_migration_keeps_identity(pg_engine):
    engine, url = pg_engine
    _, ids = seed_catalogue(engine, count=1)
    with Session(engine) as session, session.begin():
        user = create_user(session, email="migration@example.com", password="movie12345")
        rating = set_user_movie_rating(
            session, user_id=user.id, movie_id=ids[0], rating=4.0,
        )
        user_id = user.id
        rating_id = rating.id
    for action in (("downgrade", "e9b6f0a42c17"), ("upgrade", "head")):
        result = subprocess.run(
            [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", *action],
            cwd=ROOT, env=os.environ | {"DATABASE_URL": url},
            capture_output=True, text=True, check=False,
        )
        assert result.returncode == 0, sanitized_stderr(result.stderr, url)
    with Session(engine) as session:
        row = session.get(UserMovieRating, rating_id)
        assert row is not None and (row.user_id, row.movie_id, row.rating) == (
            user_id, ids[0], 4.0,
        )


def test_postgresql_api_isolation_reset_and_catalogue_pages(pg_client):
    client_a, engine, _ = pg_client
    revision, ids = seed_catalogue(engine)
    register_and_login(client_a, "A@Example.com")
    assert client_a.post("/api/auth/register", json={
        "email": "a@example.com", "password": "movie12345",
    }).status_code == 409
    with TestClient(app) as client_b:
        register_and_login(client_b, "b@example.com")
        for client in (client_a, client_b):
            assert client.put("/api/me/watchlist/" + ids[0]).status_code == 200
        assert client_a.put("/api/me/preferences", json={"genreIds": [28, 12]}).status_code == 200
        assert client_b.put("/api/me/preferences", json={"genreIds": [28]}).status_code == 200
        assert client_a.put("/api/me/ratings/" + ids[0], json={"rating": 4.5}).status_code == 200
        assert client_b.put("/api/me/ratings/" + ids[0], json={"rating": 2.5}).status_code == 200
        first = client_a.get("/api/movies").json()
        second = client_a.get("/api/movies", params={"page": 2}).json()
        assert (first["meta"]["total"], first["meta"]["totalPages"],
                len(first["data"]["movies"]), len(second["data"]["movies"])) == (13, 2, 10, 3)
        assert [movie["title"] for movie in first["data"]["movies"]] == [
            f"Movie {index:02d}" for index in range(10)
        ]
        assert len({movie["id"] for movie in first["data"]["movies"] +
                    second["data"]["movies"]}) == 13
        assert first["meta"]["catalogueRevision"] == revision
        assert client_a.get("/api/movies/search", params={"q": "STRASSE"}).json()["meta"]["total"] == 1
        assert client_a.get("/api/movies/search", params={"q": "%_"}).json()["meta"]["total"] == 1
        recommendations = client_a.get("/api/me/recommendations").json()
        assert recommendations["meta"]["total"] == 13
        assert client_a.get("/api/me/recommendations", params={"page": 2}).json()["meta"]["count"] == 3
        filtered = client_a.get("/api/me/recommendations", params={"genreId": 28}).json()
        assert (filtered["meta"]["total"], filtered["meta"]["unfilteredTotal"]) == (10, 13)
        with Session(engine) as session:
            a_id = session.scalar(select(User.id).where(User.email_normalized == "a@example.com"))
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO user_movie_ratings "
                "(id,user_id,movie_id,rating,created_at,updated_at) "
                "VALUES (:id,:user,:movie,3.25,:now,:now)"
            ), {"id": str(uuid4()), "user": a_id, "movie": ids[1], "now": datetime.now(UTC)})
        with pytest.raises(IntegrityError), engine.begin() as connection:
            connection.execute(text(
                "INSERT INTO user_movie_watchlist (id,user_id,movie_id,added_at) "
                "VALUES (:id,:user,:movie,:now)"
            ), {"id": str(uuid4()), "user": a_id, "movie": "missing-movie",
                "now": datetime.now(UTC)})
        with Session(engine) as session:
            reset_user_personalisation(session, user_id=a_id)
            session.rollback()
        assert client_a.get("/api/me/ratings/" + ids[0]).json()["data"]["rating"] == 4.5
        assert client_a.post("/api/me/profile/reset", json={"confirm": True}).status_code == 200
        assert client_a.get("/api/me/profile").json()["data"]["ratingCount"] == 0
        assert client_a.get("/api/me/preferences").json()["data"]["genres"] == []
        assert client_a.get("/api/me/watchlist").json()["meta"]["total"] == 1
        assert client_a.get("/api/me/watchlist").json()["data"]["movies"][0]["addedAt"].endswith("Z")
        assert client_b.get("/api/me/watchlist").json()["meta"]["total"] == 1
        assert client_b.get("/api/me/ratings/" + ids[0]).json()["data"]["rating"] == 2.5
        assert client_b.get("/api/me/preferences").json()["data"]["genres"][0]["id"] == 28


def test_postgresql_account_lock_and_catalogue_snapshot(pg_client):
    client, engine, _ = pg_client
    revision, ids = seed_catalogue(engine)
    register_and_login(client, "lock@example.com")
    assert client.put("/api/me/ratings/" + ids[0], json={"rating": 4.5}).status_code == 200
    assert client.put("/api/me/watchlist/" + ids[0]).status_code == 200
    with Session(engine) as session:
        user_id = session.scalar(select(User.id).where(User.email_normalized == "lock@example.com"))
        with pytest.raises(InvalidRequestError, match="before database reads"):
            begin_account_write(session)
    with ThreadPoolExecutor(max_workers=2) as pool:
        with Session(engine) as blocker, blocker.begin():
            blocker.execute(select(User.id).where(User.id == user_id).with_for_update())
            reset = pool.submit(client.post, "/api/me/profile/reset", json={"confirm": True})
            save = pool.submit(client.put, "/api/me/ratings/" + ids[0], json={"rating": 3.5})
            sleep(0.2)
            assert not reset.done() and not save.done()
        assert reset.result().status_code == 200
        assert save.result().status_code == 200
    with Session(engine) as session:
        rows = list(session.scalars(select(UserMovieRating).where(UserMovieRating.user_id == user_id)))
        assert len(rows) <= 1
        assert [row.rating for row in rows] in ([], [3.5])
    for operation in ("preferences", "watchlist"):
        with ThreadPoolExecutor(max_workers=1) as pool:
            with Session(engine) as blocker, blocker.begin():
                blocker.execute(select(User.id).where(User.id == user_id).with_for_update())
                if operation == "preferences":
                    future = pool.submit(client.put, "/api/me/preferences",
                                         json={"genreIds": [28]})
                else:
                    future = pool.submit(client.delete, "/api/me/watchlist/" + ids[0])
                sleep(0.1)
                assert not future.done()
            assert future.result().status_code == 200
    assert client.put("/api/me/watchlist/" + ids[0]).status_code == 200
    assert client.get("/api/me/watchlist").json()["meta"]["total"] == 1

    with Session(engine) as reader:
        assert count_active_movies(reader) == 13
        with Session(engine) as writer, writer.begin():
            replacement = create_catalogue_revision(writer, provider="test")
            activate_catalogue_revision(writer, revision_id=replacement.id)
        assert count_active_movies(reader) == 13
        assert len(list_active_movies(reader, limit=10)) == 10
        assert [movie.id for movie in search_active_movie_titles(reader, query="STRASSE")] == [ids[12]]
        reader.rollback()
    assert client.get("/api/movies", params={"catalogueRevision": revision}).status_code == 409
