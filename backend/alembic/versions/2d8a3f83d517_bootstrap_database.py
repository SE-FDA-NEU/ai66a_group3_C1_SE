"""bootstrap database

Revision ID: 2d8a3f83d517
Revises: 
Create Date: 2026-09-26 18:20:21.208026

"""
from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = '2d8a3f83d517'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
