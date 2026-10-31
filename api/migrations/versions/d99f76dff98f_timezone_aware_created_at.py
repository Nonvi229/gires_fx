"""timezone aware created_at

Revision ID: d99f76dff98f
Revises: eec2f56eaa2a
Create Date: 2026-10-31 19:52:14.865051

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd99f76dff98f'
down_revision: Union[str, Sequence[str], None] = 'eec2f56eaa2a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    for table in ("traders", "verification_codes"):
        op.alter_column(
            table, "created_at",
            existing_type=sa.DateTime(),
            type_=sa.DateTime(timezone=True),
            postgresql_using="created_at AT TIME ZONE 'UTC'",   # les anciennes valeurs étaient en UTC
        )

def downgrade() -> None:
    for table in ("traders", "verification_codes"):
        op.alter_column(
            table, "created_at",
            existing_type=sa.DateTime(timezone=True),
            type_=sa.DateTime(),
            postgresql_using="created_at AT TIME ZONE 'UTC'",
        )