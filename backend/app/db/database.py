import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine

PROJECT_ROOT = Path(__file__).resolve().parents[3]

load_dotenv(PROJECT_ROOT / ".env")


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite:///./data/app.db",
)


engine = create_engine(
    DATABASE_URL,
    connect_args=(
        {"check_same_thread": False}
        if DATABASE_URL.startswith("sqlite")
        else {}
    ),
)