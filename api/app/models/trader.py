from datetime import datetime, timezone
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Trader(Base):
    __tablename__ = "traders"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    surname: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
