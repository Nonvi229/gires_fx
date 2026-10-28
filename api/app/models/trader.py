import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from sqlalchemy import DateTime, String

def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Trader(Base):
    __tablename__ = "traders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    surname: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
