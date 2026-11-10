"""Offline checks for the existing app's one-origin production boundary."""

import logging

import pytest
from app import main
from app.recommendations.overview_index import IndexUnavailable
from fastapi.testclient import TestClient
from psycopg.errors import InsufficientPrivilege
from sqlalchemy.exc import OperationalError


@pytest.fixture
def frontend(tmp_path, monkeypatch):
    root = tmp_path / "dist"
    (root / "assets").mkdir(parents=True)
    (root / "index.html").write_text('<html><script src="/assets/app.js"></script></html>')
    (root / "assets" / "app.js").write_text('console.log("app")')
    monkeypatch.setattr(main, "FRONTEND_DIST", root)
    return TestClient(main.app)


@pytest.mark.parametrize("path", [
    "/", "/about-recommendations", "/popular", "/search?q=space", "/movies/movie-id",
    "/login", "/register", "/recommendations", "/preferences", "/profile", "/watchlist",
])
def test_spa_direct_refresh(frontend, path):
    response = frontend.get(path)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")
    assert response.headers["cache-control"] == "no-cache"
    assert '/assets/app.js' in response.text


def test_assets_and_head(frontend):
    response = frontend.get("/assets/app.js")
    assert response.status_code == 200
    assert "javascript" in response.headers["content-type"]
    assert 'console.log("app")' in response.text
    assert frontend.head("/movies/movie-id").status_code == 200
    assert frontend.head("/movies/movie-id").content == b""


@pytest.mark.parametrize("path", [
    "/api", "/api/unknown", "/api/unknown/nested", "/health/missing", "/assets/missing.js",
    "/missing.png", "/assets/%2e%2e/%2e%2e/private.txt",
])
def test_missing_resources_are_json_errors(frontend, path):
    response = frontend.get(path, headers={"accept": "text/html"})
    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    assert response.json()["error"]["code"] == "NOT_FOUND"


def test_missing_build_is_unavailable(frontend, tmp_path, monkeypatch):
    monkeypatch.setattr(main, "FRONTEND_DIST", tmp_path / "missing")
    assert frontend.get("/login").status_code == 503
    assert frontend.get("/api/auth/me").status_code == 401


def test_symlink_cannot_serve_files_outside_build(frontend, tmp_path):
    private = tmp_path / "private.txt"
    private.write_text("private-data")
    (tmp_path / "dist" / "assets" / "leak.txt").symlink_to(private)
    response = frontend.get("/assets/leak.txt")
    assert response.status_code == 404
    assert "private-data" not in response.text


def test_index_symlink_cannot_serve_files_outside_build(frontend, tmp_path):
    private = tmp_path / "private.html"
    private.write_text("private-data")
    index = tmp_path / "dist" / "index.html"
    index.unlink()
    index.symlink_to(private)
    response = frontend.get("/login")
    assert response.status_code == 503
    assert "private-data" not in response.text


def test_request_logs_correlate_errors_without_sensitive_input(frontend, caplog):
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        response = frontend.post("/api/auth/login?token=private-query", json={
            "email": "private-email", "password": "private-password",
        }, headers={
            "origin": "https://private-origin.example", "cookie": "session=private-cookie",
            "authorization": "Bearer private-token", "x-request-id": "private-forged-id",
        })
    assert response.status_code == 403
    correlation = response.headers["x-request-id"]
    assert response.json()["error"]["requestId"] == correlation
    logs = "\n".join(record.getMessage() for record in caplog.records if record.name == "uvicorn.error")
    assert correlation in logs
    assert "method=POST" in logs and "status=403" in logs and "latency_ms=" in logs
    assert "private" not in logs


def test_unexpected_errors_are_safe_and_logged(frontend, caplog):
    def broken_database():
        raise RuntimeError("private-password private-db-url private-token")

    main.app.dependency_overrides[main.get_db] = broken_database
    try:
        with caplog.at_level(logging.INFO, logger="uvicorn.error"):
            response = frontend.get("/api/me/ratings/private-account?token=private-query")
    finally:
        main.app.dependency_overrides.clear()
    assert response.status_code == 500
    assert response.json()["error"]["requestId"] == response.headers["x-request-id"]
    records = [record for record in caplog.records if record.name == "uvicorn.error"]
    assert len(records) == 1
    assert records[0].levelno == logging.ERROR
    assert "route=/api/me/ratings/{movie_id}" in records[0].getMessage()
    assert "status=500" in records[0].getMessage()
    assert "private" not in response.text + records[0].getMessage()
    assert records[0].exc_info is None


@pytest.mark.parametrize("failure, expected", [
    (PermissionError(13, "private-path private-password"),
     "error_type=PermissionError sqlstate=None errno=13"),
    (OperationalError("private-sql", {}, InsufficientPrivilege("private-password")),
     "error_type=InsufficientPrivilege sqlstate=42501 errno=None"),
    (IndexUnavailable("private-corpus private-token"),
     "error_type=IndexUnavailable sqlstate=None errno=None"),
])
def test_startup_failure_logs_safe_diagnostics(monkeypatch, caplog, failure, expected):
    def fail_preparation(_sessions):
        raise failure

    monkeypatch.setattr(main, "prepare_startup_index", fail_preparation)
    with (
        caplog.at_level(logging.ERROR, logger="uvicorn.error"),
        pytest.raises(RuntimeError, match="NLP index preparation failed"),
        TestClient(main.app),
    ):
        pass
    records = [record for record in caplog.records if record.name == "uvicorn.error"]
    assert len(records) == 1
    assert expected in records[0].getMessage()
    assert "private" not in records[0].getMessage()
    assert records[0].exc_info is None
