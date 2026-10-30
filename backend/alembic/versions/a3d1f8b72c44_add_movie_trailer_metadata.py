"""Add optional trailer and enrichment status to existing catalogue movies."""

import sqlalchemy as sa
from alembic import op

revision = "a3d1f8b72c44"
down_revision = "f2c7e4a91b60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for name, column_type in (
        ("trailer_site", sa.String(32)),
        ("trailer_key", sa.String(32)),
        ("trailer_name", sa.Text()),
        ("trailer_type", sa.String(32)),
        ("trailer_official", sa.Boolean()),
        ("trailer_language", sa.String(16)),
        ("trailer_published_at", sa.DateTime(timezone=True)),
        ("trailer_attempted_at", sa.DateTime(timezone=True)),
        ("trailer_succeeded_at", sa.DateTime(timezone=True)),
        ("trailer_status", sa.String(16)),
    ):
        op.add_column("catalog_movies", sa.Column(name, column_type, nullable=True))


def downgrade() -> None:
    for name in (
        "trailer_status", "trailer_succeeded_at", "trailer_attempted_at",
        "trailer_published_at", "trailer_language", "trailer_official",
        "trailer_type", "trailer_name", "trailer_key", "trailer_site",
    ):
        op.drop_column("catalog_movies", name)
