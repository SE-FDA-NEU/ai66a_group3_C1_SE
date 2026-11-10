from unittest.mock import Mock

import pytest
from app import main
from app.db.database import Base, create_database_engine
from app.main import app
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

client = TestClient(app)


def test_health_reads_database():
    response = client.get("/health")

    assert response.status_code == 200

    body = response.json()

    assert body["status"] == "ok"
    assert body["database"] == "connected"
    assert body["migrationVersion"] is not None


@pytest.fixture
def health_engine(tmp_path, monkeypatch):
    database = create_database_engine(f"sqlite:///{tmp_path / 'health.db'}")
    Base.metadata.create_all(database)
    with database.begin() as connection:
        connection.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
        for head in main.MIGRATION_HEADS:
            connection.execute(text("INSERT INTO alembic_version VALUES (:head)"), {"head": head})
    monkeypatch.setattr(main, "engine", database)
    yield database
    database.dispose()


def test_health_database_outage_and_recovery(health_engine, monkeypatch):
    assert client.get("/health").status_code == 200
    failed = Mock()
    failed.connect.side_effect = SQLAlchemyError("password=private database URL and SQL")
    monkeypatch.setattr(main, "engine", failed)
    response = client.get("/health")
    assert response.status_code == 503
    assert response.json()["error"]["message"] == "Service is temporarily unavailable"
    assert "private" not in response.text
    assert response.json()["error"]["requestId"] == response.headers["x-request-id"]
    monkeypatch.setattr(main, "engine", health_engine)
    assert client.get("/health").status_code == 200


@pytest.mark.parametrize("damage", [
    "DELETE FROM alembic_version",
    "UPDATE alembic_version SET version_num = 'outdated'",
    "DROP TABLE alembic_version",
    "DROP TABLE auth_sessions",
    "ALTER TABLE catalog_movies DROP COLUMN backdrop_path",
])
def test_health_requires_current_schema(health_engine, damage):
    with health_engine.begin() as connection:
        connection.execute(text(damage))
    response = client.get("/health")
    assert response.status_code == 503
    assert "SQL" not in response.text
    assert response.json()["error"]["code"] == "SERVICE_UNAVAILABLE"
