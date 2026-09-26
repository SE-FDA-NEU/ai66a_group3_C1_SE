from fastapi import FastAPI
from sqlalchemy import text

from app.db.database import engine

app = FastAPI(
    title="AI Movie Recommendation System",
)


@app.get("/health")
def health():
    with engine.connect() as connection:
        migration_version = connection.execute(
            text("SELECT version_num FROM alembic_version")
        ).scalar_one_or_none()

    return {
        "status": "ok",
        "database": "connected",
        "migrationVersion": migration_version,
    }