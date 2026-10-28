"""Allow 0.5 through 5 stars in 0.5 steps without changing rating identity.

Revision ID: f2c7e4a91b60
Revises: e9b6f0a42c17
"""

import sqlalchemy as sa
from alembic import op

revision = "f2c7e4a91b60"
down_revision = "e9b6f0a42c17"
branch_labels = None
depends_on = None

CONSTRAINT = "ck_user_movie_ratings_rating_range"


def upgrade() -> None:
    with op.batch_alter_table("user_movie_ratings", recreate="always") as batch:
        batch.drop_constraint(CONSTRAINT, type_="check")
        batch.alter_column("rating", existing_type=sa.Integer(), type_=sa.Float(), existing_nullable=False)
        batch.create_check_constraint(
            CONSTRAINT,
            "typeof(rating) IN ('integer', 'real') AND rating BETWEEN 0.5 AND 5 "
            "AND rating * 2 = CAST(rating * 2 AS INTEGER)",
        )


def downgrade() -> None:
    connection = op.get_bind()
    fractional = connection.scalar(sa.text(
        "SELECT COUNT(*) FROM user_movie_ratings WHERE rating != CAST(rating AS INTEGER)"
    ))
    if fractional:
        raise RuntimeError(
            "Cannot downgrade while half-star ratings exist; preserve/export them "
            "and explicitly resolve them before restoring the integer-only schema."
        )
    with op.batch_alter_table("user_movie_ratings", recreate="always") as batch:
        batch.drop_constraint(CONSTRAINT, type_="check")
        batch.alter_column("rating", existing_type=sa.Float(), type_=sa.Integer(), existing_nullable=False)
        batch.create_check_constraint(CONSTRAINT, "typeof(rating) = 'integer' AND rating BETWEEN 1 AND 5")
