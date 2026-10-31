import hmac
import uuid
from datetime import timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.clock import as_utc, utcnow
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_code,
    hash_code,
    hash_password,
    verify_password,
)
from app.models.verification_code import CodePurpose
from app.repositories.trader_repository import TraderRepository
from app.repositories.verification_code_repository import VerificationCodeRepository
from app.schemas.auth import LoginIn, RegisterIn, VerifyEmailIn
from app.services.email_service import send_already_registered_email, send_verification_email

RESEND_COOLDOWN = timedelta(seconds=30)

# Hash factice : le temps de réponse du login ne révèle pas si l'email existe
_DUMMY_HASH = hash_password("mot-de-passe-factice")


def _issue_code(
    codes: VerificationCodeRepository, user_id: uuid.UUID, cooldown: timedelta | None = None
) -> str | None:
    """Émet un code de vérification d'email. Retourne None si le cooldown n'est pas écoulé.

    Le repository committe : le trader déjà flushé est validé avec le code.
    """
    code = generate_code()
    now = utcnow()
    issued = codes.upsert_if_cooled_down(
        user_id=user_id,
        purpose=CodePurpose.EMAIL_VERIFICATION,
        code_hash=hash_code(code),
        expires_at=now + timedelta(minutes=settings.code_expire_minutes),
        now=now,
        cooldown=cooldown,
    )
    return code if issued else None


def register(db: Session, data: RegisterIn) -> None:
    repo, codes = TraderRepository(db), VerificationCodeRepository(db)
    email = data.email.lower().strip()
    existing = repo.get_by_email(email)

    # Calculé dans tous les cas : le temps de réponse ne révèle pas si le compte existe
    password_hash = hash_password(data.password)

    if existing and existing.is_verified:
        send_already_registered_email(existing.email)
        return  # même réponse qu'une inscription normale

    if existing:  # inscription abandonnée : on la reprend
        existing.name = data.name
        existing.surname = data.surname
        existing.password_hash = password_hash
        trader = existing
    else:
        trader = repo.create(
            email=email, name=data.name, surname=data.surname, password_hash=password_hash
        )

    # Sans cooldown : une reprise d'inscription remplace toujours le code
    code = _issue_code(codes, trader.id)
    send_verification_email(trader.email, code)


def verify_email(db: Session, data: VerifyEmailIn) -> None:
    repo, codes = TraderRepository(db), VerificationCodeRepository(db)
    invalid = HTTPException(status.HTTP_400_BAD_REQUEST, "Code invalide ou expiré")

    trader = repo.get_by_email(data.email.lower().strip())
    record = codes.get(trader.id, CodePurpose.EMAIL_VERIFICATION) if trader else None

    if record is None or as_utc(record.expires_at) <= utcnow():
        raise invalid

    # Tentative réservée AVANT la comparaison : le compteur ne peut pas être contourné
    if not codes.reserve_attempt(record.id, settings.code_max_attempts):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Trop de tentatives, demandez un nouveau code"
        )

    if not hmac.compare_digest(record.code_hash, hash_code(data.code)):
        raise invalid

    # Usage unique : si une requête simultanée a déjà consommé le code, on refuse
    if not codes.consume(record.id):
        raise invalid

    trader.is_verified = True
    db.commit()


def resend_code(db: Session, email: str) -> None:
    repo, codes = TraderRepository(db), VerificationCodeRepository(db)
    trader = repo.get_by_email(email.lower().strip())

    # Même réponse que le compte existe ou non (évite de révéler les emails inscrits)
    if not trader or trader.is_verified:
        return

    code = _issue_code(codes, trader.id, cooldown=RESEND_COOLDOWN)
    if code is None:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS, "Patientez quelques secondes avant de redemander un code"
        )
    send_verification_email(trader.email, code)


def login(db: Session, data: LoginIn) -> str:
    trader = TraderRepository(db).get_by_email(data.email.lower().strip())
    password_ok = verify_password(
        data.password, trader.password_hash if trader else _DUMMY_HASH
    )

    # Même erreur pour email inconnu et mauvais mot de passe
    if not trader or not password_ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email ou mot de passe incorrect")

    # Après vérification du mot de passe seulement, donc sans fuite d'information
    if not trader.is_verified:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Compte non vérifié. Validez d’abord votre email.")

    return create_access_token(str(trader.id), trader.password_hash)