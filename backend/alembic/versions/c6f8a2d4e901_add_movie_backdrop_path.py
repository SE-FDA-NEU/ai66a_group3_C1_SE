"""Add nullable catalogue backdrop storage without rebuilding existing tables.

Revision ID: c6f8a2d4e901
Revises: b7e4c2d91f30
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c6f8a2d4e901"
down_revision: str | Sequence[str] | None = "b7e4c2d91f30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "catalog_movies",
        sa.Column("backdrop_path", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    # Explicit operator action only: dropping this column loses its media paths.
    # Application startup never downgrades or resets a database.
    op.drop_column("catalog_movies", "backdrop_path")
