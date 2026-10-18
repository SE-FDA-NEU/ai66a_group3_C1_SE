"""C04 review provisioning: disposable migrated SQLite, no real provider calls."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from app.cli import create_review_account as cli
from app.db.models import (
    AuthSession,
    CatalogMovie,
    CatalogueRevision,
    CatalogueState,
    Genre,
    User,
    UserGenrePreference,
    UserMovieRating,
)
from app.main import app, get_db
from app.repositories.users import create_user
from app.security.passwords import verify_password
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def review_database(tmp_path: Path) -> str:
    path = tmp_path / "app.db"
    url = f"sqlite:///{path.as_posix()}"
    env = os.environ | {
        "DATABASE_URL": url,
        "TMDB_READ_ACCESS_TOKEN": "",
        "TMDB_NETWORK_DISABLED": "1",
        "PYTHONPATH": str(ROOT / "backend"),
    }
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr.decode(errors="replace")
    engine = create_engine(url)
    try:
        with Session(engine) as session, session.begin():
            # Synthetic fixture with TMDb-shaped provenance, NOT live import evidence.
            revision = CatalogueRevision(id="review-fixture-revision", provider="tmdb")
            session.add(revision)
            session.flush()
            session.add(CatalogueState(id=1, active_revision_id=revision.id))
            session.add(
                CatalogMovie(
                    id="review-fixture-movie",
                    catalogue_revision_id=revision.id,
                    source="tmdb",
                    source_id="synthetic-review-only",
                    title="Synthetic review fixture",
                    popularity_score=90,
                )
            )
    finally:
        engine.dispose()
    return url


def test_create_public_demo_once_with_argon2id(review_database: str) -> None:
    assert cli.create_review_account(review_database) == "created"
    engine = create_engine(review_database)
    try:
        with Session(engine) as session:
            user = session.scalar(select(User))
            assert user is not None
            assert user.email_normalized == cli.REVIEW_EMAIL
            assert user.password_hash.startswith("$argon2id$")
            assert cli.REVIEW_PASSWORD not in user.password_hash
            assert verify_password(cli.REVIEW_PASSWORD, user.password_hash)
            assert session.scalar(select(func.count(User.id))) == 1
    finally:
        engine.dispose()


def test_rerun_preserves_identity_hash_preferences_rating_and_session(
    review_database: str,
) -> None:
    cli.create_review_account(review_database)
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            user = session.scalar(select(User))
            assert user is not None
            identity, password_hash = user.id, user.password_hash
            session.add(Genre(id=28, name="Action"))
            session.flush()
            session.add(UserGenrePreference(user_id=identity, genre_id=28))
            session.add(UserMovieRating(user_id=identity, movie_id="review-fixture-movie", rating=4))
            session.add(
                AuthSession(
                    token_digest="0" * 64,
                    user_id=identity,
                    expires_at=datetime.now(UTC) + timedelta(hours=1),
                )
            )
        assert cli.create_review_account(review_database) == "already_exists"
        with Session(engine) as session:
            user = session.scalar(select(User))
            assert user is not None
            assert (user.id, user.password_hash) == (identity, password_hash)
            assert session.scalar(select(func.count(User.id))) == 1
            assert session.get(UserGenrePreference, (identity, 28)) is not None
            rating = session.scalar(
                select(UserMovieRating).where(
                    UserMovieRating.user_id == identity,
                    UserMovieRating.movie_id == "review-fixture-movie",
                )
            )
            assert rating is not None and rating.rating == 4
            assert session.get(AuthSession, "0" * 64).user_id == identity
    finally:
        engine.dispose()


def test_conflicting_password_is_never_reset(review_database: str) -> None:
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            create_user(session, email=cli.REVIEW_EMAIL.upper(), password="different-test-only")
            user = session.scalar(select(User))
            identity, password_hash = user.id, user.password_hash
        with pytest.raises(cli.ReviewSetupError, match="different password"):
            cli.create_review_account(review_database)
        with Session(engine) as session:
            user = session.scalar(select(User))
            assert (user.id, user.password_hash) == (identity, password_hash)
    finally:
        engine.dispose()


@pytest.mark.parametrize(
    "database_url",
    [
        "sqlite:///:memory:",
        "postgresql://localhost/review",
        "sqlite:///./data/m3-review.db?uri=true",
    ],
)
def test_unsafe_database_targets_are_refused(database_url: str) -> None:
    with pytest.raises(cli.ReviewSetupError):
        cli.create_review_account(database_url)


def test_missing_database_is_not_created(tmp_path: Path) -> None:
    path = tmp_path / "m3-review.db"
    with pytest.raises(cli.ReviewSetupError, match="migrations"):
        cli.create_review_account(f"sqlite:///{path.as_posix()}")
    assert not path.exists()


@pytest.mark.parametrize("provider", ["m2-seed", None])
def test_no_account_without_an_accepted_tmdb_catalogue(
    review_database: str, provider: str | None
) -> None:
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            if provider is None:
                session.delete(session.get(CatalogueState, 1))
            else:
                session.get(CatalogueRevision, "review-fixture-revision").provider = provider
        with pytest.raises(cli.ReviewSetupError, match="TMDb import"):
            cli.create_review_account(review_database)
        with Session(engine) as session:
            assert session.scalar(select(func.count(User.id))) == 0
    finally:
        engine.dispose()


def test_empty_catalogue_is_refused(review_database: str) -> None:
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            session.delete(session.get(CatalogMovie, "review-fixture-movie"))
        with pytest.raises(cli.ReviewSetupError, match="no movies"):
            cli.create_review_account(review_database)
    finally:
        engine.dispose()


def test_non_tmdb_movies_are_refused_even_if_revision_claims_tmdb(
    review_database: str,
) -> None:
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            session.get(CatalogMovie, "review-fixture-movie").source = "m2-seed"
        with pytest.raises(cli.ReviewSetupError, match="non-TMDb"):
            cli.create_review_account(review_database)
        with Session(engine) as session:
            assert session.scalar(select(func.count(User.id))) == 0
    finally:
        engine.dispose()


def test_catalogue_and_other_accounts_are_unchanged(review_database: str) -> None:
    engine = create_engine(review_database)
    try:
        with Session(engine) as session, session.begin():
            other = create_user(session, email="other@example.com", password="other-only-test")
            identity = other.id
            before_movie = session.get(CatalogMovie, "review-fixture-movie")
            before = (
                before_movie.id,
                before_movie.catalogue_revision_id,
                before_movie.title,
                before_movie.source_id,
                before_movie.popularity_score,
                session.get(CatalogueState, 1).active_revision_id,
            )
            other_hash = session.get(User, identity).password_hash
        assert cli.create_review_account(review_database) == "created"
        assert cli.create_review_account(review_database) == "already_exists"
        with Session(engine) as session:
            movie = session.get(CatalogMovie, "review-fixture-movie")
            assert (
                movie.id,
                movie.catalogue_revision_id,
                movie.title,
                movie.source_id,
                movie.popularity_score,
                session.get(CatalogueState, 1).active_revision_id,
            ) == before
            assert session.get(User, identity).password_hash == other_hash
            assert session.scalar(select(func.count(User.id))) == 2
    finally:
        engine.dispose()


def test_cli_requires_explicit_opt_in_and_refuses_production(
    monkeypatch: pytest.MonkeyPatch, review_database: str
) -> None:
    monkeypatch.setattr(cli, "DATABASE_URL", review_database)
    with pytest.raises(SystemExit) as missing:
        cli.main([])
    assert missing.value.code == 2
    monkeypatch.setenv("APP_ENV", "production")
    assert cli.main(["--confirm-local-demo"]) == 1


def test_cli_is_offline_and_prints_no_password_or_token(
    monkeypatch: pytest.MonkeyPatch, review_database: str, capsys: pytest.CaptureFixture[str]
) -> None:
    def deny_network(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("Review provisioning must not access the network")

    monkeypatch.setattr(cli, "DATABASE_URL", review_database)
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("TMDB_READ_ACCESS_TOKEN", "synthetic-not-a-real-token")
    monkeypatch.setattr(socket, "create_connection", deny_network)
    assert cli.main(["--confirm-local-demo"]) == 0
    assert cli.main(["--confirm-local-demo"]) == 0
    output = capsys.readouterr()
    assert "created" in output.out and "already_exists" in output.out
    assert cli.REVIEW_PASSWORD not in output.out + output.err
    assert "synthetic-not-a-real-token" not in output.out + output.err


def test_documented_credentials_authenticate_through_real_login(
    review_database: str,
) -> None:
    cli.create_review_account(review_database)
    engine = create_engine(review_database, connect_args={"check_same_thread": False})

    def isolated_db() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    app.dependency_overrides[get_db] = isolated_db
    try:
        with TestClient(app) as client:
            wrong = client.post(
                "/api/auth/login",
                json={"email": cli.REVIEW_EMAIL, "password": "wrong-test-password"},
            )
            assert wrong.status_code == 401
            assert wrong.json()["error"]["message"] == "Email or password is incorrect"
            response = client.post(
                "/api/auth/login",
                json={"email": cli.REVIEW_EMAIL, "password": cli.REVIEW_PASSWORD},
            )
            assert response.status_code == 200
            assert set(response.json()["data"]["user"]) == {"id", "email"}
            assert client.get("/api/auth/me").status_code == 200
    finally:
        app.dependency_overrides.clear()
        engine.dispose()
