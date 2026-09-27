"""create catalogue storage

Revision ID: 4bde7d96c1c2
Revises: 2d8a3f83d517
Create Date: 2026-09-27 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4bde7d96c1c2"
down_revision: str | Sequence[str] | None = "2d8a3f83d517"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create local, application-owned catalogue persistence tables."""

    op.create_table(
        "catalogue_revisions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("inserted_movie_count", sa.Integer(), nullable=False),
        sa.Column("updated_movie_count", sa.Integer(), nullable=False),
        sa.Column("rejected_movie_count", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "catalogue_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("active_revision_id", sa.String(length=36), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("id = 1", name="ck_catalogue_state_singleton"),
        sa.ForeignKeyConstraint(
            ["active_revision_id"],
            ["catalogue_revisions.id"],
            name="fk_catalogue_state_active_revision",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "active_revision_id", name="uq_catalogue_state_active_revision"
        ),
    )
    op.create_table(
        "catalog_movies",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("catalogue_revision_id", sa.String(length=36), nullable=False),
        sa.Column("source", sa.String(length=32), nullable=False),
        sa.Column("source_id", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("release_year", sa.Integer(), nullable=True),
        sa.Column("overview", sa.Text(), nullable=True),
        sa.Column("popularity_score", sa.Float(), nullable=True),
        sa.Column("vote_average", sa.Float(), nullable=True),
        sa.Column("vote_count", sa.Integer(), nullable=True),
        sa.Column("source_fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["catalogue_revision_id"],
            ["catalogue_revisions.id"],
            name="fk_catalog_movies_catalogue_revision",
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "source", "source_id", name="uq_catalog_movies_source_source_id"
        ),
    )
    op.create_index(
        "ix_catalog_movies_catalogue_revision_id",
        "catalog_movies",
        ["catalogue_revision_id"],
        unique=False,
    )
    op.create_table(
        "genres",
        sa.Column("id", sa.Integer(), autoincrement=False, nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "movie_genres",
        sa.Column("movie_id", sa.String(length=36), nullable=False),
        sa.Column("genre_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["genre_id"],
            ["genres.id"],
            name="fk_movie_genres_genre",
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["movie_id"],
            ["catalog_movies.id"],
            name="fk_movie_genres_movie",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("movie_id", "genre_id"),
    )


def downgrade() -> None:
    """Remove the catalogue schema in reverse dependency order."""

    op.drop_table("movie_genres")
    op.drop_table("genres")
    op.drop_index(
        "ix_catalog_movies_catalogue_revision_id", table_name="catalog_movies"
    )
    op.drop_table("catalog_movies")
    op.drop_table("catalogue_state")
    op.drop_table("catalogue_revisions")
