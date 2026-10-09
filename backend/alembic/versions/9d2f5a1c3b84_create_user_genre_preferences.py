"""create account-owned genre preferences

Revision ID: 9d2f5a1c3b84
Revises: 8c1e2f4a7b90
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "9d2f5a1c3b84"
down_revision: str | Sequence[str] | None = "8c1e2f4a7b90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_genre_preferences",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("genre_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["genre_id"], ["genres.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("user_id", "genre_id"),
    )


def downgrade() -> None:
    op.drop_table("user_genre_preferences")
