"""create users

Revision ID: 7f5b1d2a6e90
Revises: 4bde7d96c1c2
Create Date: 2026-09-28 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "7f5b1d2a6e90"
down_revision: str | Sequence[str] | None = "4bde7d96c1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create users without any plaintext password column."""

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column(
            "email_normalized",
            sa.String(length=320, collation="NOCASE"),
            nullable=False,
        ),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "email_normalized", name="uq_users_email_normalized"
        ),
    )


def downgrade() -> None:
    """Remove the users table."""

    op.drop_table("users")
