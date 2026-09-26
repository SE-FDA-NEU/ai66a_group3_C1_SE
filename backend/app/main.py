from fastapi import FastAPI
from sqlalchemy import text

from app.db.database import engine


app = FastAPI(
    title="AI Movie Recommendation System",
)


@app.get("/health")
def health():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {
        "status": "ok",
        "database": "connected",
    }