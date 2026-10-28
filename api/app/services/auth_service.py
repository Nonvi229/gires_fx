import hmac
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import generate_code, hash_code, hash_password
from app.models.trader import utcnow
from app.models.verification_code import CodePurpose
from app.repositories.trader_repository import TraderRepository, VerificationRepository
from app.schemas.auth import RegisterIn, VerifyEmailIn
from app.services.email_service import send_verification_email


RESEND_COOLDOWN = timedelta(seconds=30)

def _as_utc(dt: datetime) -> datetime:
    """SQLite renvoie des dates sans fuseau : on force UTC pour pouvoir comparer."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _issue_code(vrepo: VerificationRepository, user_id: uuid.UUID, purpose: CodePurpose) -> str:
    code = generate_code()
    vrepo.upsert(
        user_id=user_id,
        purpose=purpose,
        code_hash=hash_code(code),
        expires_at=utcnow() + timedelta(minutes=settings.code_expire_minutes),
    )
    return code


def register(db: Session, data: RegisterIn) -> None:
    repo, vrepo = TraderRepository(db), VerificationRepository(db)
    email = data.email.lower().strip()
    existing = repo.get_by_email(email)

    if existing and existing.is_verified:
        raise HTTPException(status.HTTP_409_CONFLICT, "Un compte existe déjà avec cet email")

    password_hash = hash_password(data.password)

    if existing:  # inscription abandonnée : on la reprend
        existing.name = data.name
        existing.surname = data.surname
        existing.password_hash = password_hash
        trader = existing
    else:
        trader = repo.create(
            email=email, name=data.name, surname=data.surname, password_hash=password_hash
        )

    code = _issue_code(vrepo, trader.id, CodePurpose.EMAIL_VERIFICATION)
    db.commit()
    send_verification_email(trader.email, code)  # après le commit


def verify_email(db: Session, data: VerifyEmailIn) -> None:
    repo, vrepo = TraderRepository(db), VerificationRepository(db)
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "Code invalide ou expiré")

    trader = repo.get_by_email(data.email.lower().strip())
    record = vrepo.get(trader.id, CodePurpose.EMAIL_VERIFICATION) if trader else None

    if not record or _as_utc(record.expires_at) < utcnow():
        raise invalid

    if record.attempts >= settings.code_max_attempts:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, demandez un nouveau code"
        )

    record.attempts += 1
    if not hmac.compare_digest(record.code_hash, hash_code(data.code)):
        db.commit()  # enregistre la tentative échouée
        raise invalid

    vrepo.delete(record)  # code à usage unique
    trader.is_verified = True
    db.commit()


def resend_code(db: Session, email: str) -> None:
    repo, vrepo = TraderRepository(db), VerificationRepository(db)
    trader = repo.get_by_email(email.lower().strip())

    # Même réponse que le compte existe ou non (évite de révéler les emails inscrits)
    if not trader or trader.is_verified:
        return

    record = vrepo.get(trader.id, CodePurpose.EMAIL_VERIFICATION)
    if record and utcnow() - _as_utc(record.created_at) < RESEND_COOLDOWN:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Patientez quelques secondes avant de redemander un code")

    code = _issue_code(vrepo, trader.id, CodePurpose.EMAIL_VERIFICATION)
    db.commit()
    send_verification_email(trader.email, code)