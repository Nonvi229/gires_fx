import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trader import Trader, utcnow
from app.models.verification_code import CodePurpose, VerificationCode


class TraderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Trader | None:
        return self.db.scalar(select(Trader).where(Trader.email == email))

    def create(self, **data) -> Trader:
        trader = Trader(**data)
        self.db.add(trader)
        self.db.flush()  # obtient l'id sans valider la transaction
        return trader


class VerificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: uuid.UUID, purpose: CodePurpose) -> VerificationCode | None:
        return self.db.scalar(
            select(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
            )
        )

    def upsert(self, user_id: uuid.UUID, purpose: CodePurpose,
               code_hash: str, expires_at: datetime) -> VerificationCode:
        """Un seul code par (utilisateur, usage) : on remplace l'ancien."""
        record = self.get(user_id, purpose)
        if record:
            record.code_hash = code_hash
            record.expires_at = expires_at
            record.attempts = 0
            record.created_at = utcnow()
        else:
            record = VerificationCode(
                user_id=user_id, purpose=purpose,
                code_hash=code_hash, expires_at=expires_at,
            )
            self.db.add(record)
        return record

    def delete(self, record: VerificationCode) -> None:
        self.db.delete(record)