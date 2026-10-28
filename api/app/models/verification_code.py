import enum
from datetime import datetime
from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base
from app.models.trader import utcnow


class CodePurpose(str, enum.Enum):
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    LOGIN_2FA = "LOGIN_2FA"
    PASSWORD_RESET = "PASSWORD_RESET"


class VerificationCode(Base):
    __tablename__ = "verification_codes"
    __table_args__ = (UniqueConstraint("user_id", "purpose", name="uq_user_purpose"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("traders.id", ondelete="CASCADE"), index=True
    )
    purpose: Mapped[CodePurpose] = mapped_column(Enum(CodePurpose, name="code_purpose"))
    code_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
