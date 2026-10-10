"""create account-owned movie ratings

Revision ID: b7e4c2d91f30
Revises: 9d2f5a1c3b84
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b7e4c2d91f30"
down_revision: str | Sequence[str] | None = "9d2f5a1c3b84"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "user_movie_ratings",
        sa.Column(
            "id",
            sa.String(length=36),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            sa.String(length=36),
            nullable=False,
        ),
        sa.Column(
            "movie_id",
            sa.String(length=36),
            nullable=False,
        ),
        sa.Column(
            "rating",
            sa.Integer(),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
        ),
        sa.CheckConstraint(
            "rating >= 1 AND rating <= 5",
            name="ck_user_movie_ratings_rating_range",
        ),
        sa.ForeignKeyConstraint(
            ["movie_id"],
            ["catalog_movies.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "movie_id",
            name="uq_user_movie_ratings_user_movie",
        ),
    )

    op.create_index(
        "ix_user_movie_ratings_user_id",
        "user_movie_ratings",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_user_movie_ratings_movie_id",
        "user_movie_ratings",
        ["movie_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_movie_ratings_movie_id",
        table_name="user_movie_ratings",
    )
    op.drop_index(
        "ix_user_movie_ratings_user_id",
        table_name="user_movie_ratings",
    )
    op.drop_table("user_movie_ratings")