from datetime import datetime, timedelta
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.models import CodePurpose, VerificationCode


class VerificationCodeRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, user_id: UUID, purpose: CodePurpose) -> VerificationCode | None:
        return self.db.scalar(
            select(VerificationCode).where(
                VerificationCode.user_id == user_id,
                VerificationCode.purpose == purpose,
            )
        )

    def upsert_if_cooled_down(
        self,
        *,
        user_id: UUID,
        purpose: CodePurpose,
        code_hash: str,
        expires_at: datetime,
        now: datetime,
        cooldown: timedelta,
    ) -> bool:
        """Crée ou remplace le code, SAUF si le dernier envoi date de moins de `cooldown`.

        Une seule instruction SQL : le délai minimum entre deux envois est donc
        respecté même avec des requêtes simultanées. Retourne True si un code a été émis.
        """
        stmt = pg_insert(VerificationCode).values(
            user_id=user_id,
            purpose=purpose,
            code_hash=code_hash,
            expires_at=expires_at,
            attempts=0,
            created_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            constraint="uq_user_purpose",
            set_={
                "code_hash": stmt.excluded.code_hash,
                "expires_at": stmt.excluded.expires_at,
                "attempts": 0,
                "created_at": stmt.excluded.created_at,
            },
            where=VerificationCode.created_at <= now - cooldown,
        )
        row = self.db.execute(stmt.returning(VerificationCode.id)).first()
        self.db.commit()
        return row is not None

    def reserve_attempt(self, code_id: UUID, max_attempts: int) -> bool:
        """Consomme une tentative de façon atomique. False si la limite est atteinte."""
        row = self.db.execute(
            update(VerificationCode)
            .where(VerificationCode.id == code_id, VerificationCode.attempts < max_attempts)
            .values(attempts=VerificationCode.attempts + 1)
            .returning(VerificationCode.id)
            .execution_options(synchronize_session=False)
        ).first()
        self.db.commit()
        return row is not None

    def consume(self, code_id: UUID) -> bool:
        """Supprime le code (usage unique). Pas de commit : l'appelant valide la transaction."""
        row = self.db.execute(
            delete(VerificationCode)
            .where(VerificationCode.id == code_id)
            .returning(VerificationCode.id)
            .execution_options(synchronize_session=False)
        ).first()
        return row is not None