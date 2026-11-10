"""Add nullable poster metadata, preserving existing identity and account rows.

Revision ID: d8a4e6f20195
Revises: c6f8a2d4e901
"""

import sqlalchemy as sa
from alembic import op

revision = "d8a4e6f20195"
down_revision = "c6f8a2d4e901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("catalog_movies", sa.Column("poster_path", sa.Text(), nullable=True))


def downgrade() -> None:
    # Operator-only rollback removes this additive media field, never core rows.
    op.drop_column("catalog_movies", "poster_path")
