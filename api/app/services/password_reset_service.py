import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models import CodePurpose
from app.repositories.trader_repository import TraderRepository
from app.repositories.verification_code_repository import VerificationCodeRepository

CODE_LENGTH = 5
CODE_TTL_MINUTES = 3
MAX_ATTEMPTS = 3
RESEND_COOLDOWN = timedelta(seconds=60)

# Hash factice pour que "email inconnu" prenne autant de temps que "code faux"
_DUMMY_HASH = hash_password("000000")


class InvalidCode(Exception):
    """Code faux, expiré, inexistant ou déjà utilisé (message volontairement unique)."""


class TooManyAttempts(Exception):
    """Limite de tentatives atteinte : il faut demander un nouveau code."""


@dataclass
class IssuedCode:
    email: str
    code: str


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"

def request_reset(db: Session, email: str) -> IssuedCode | None:
    """Prépare un code de réinitialisation.

    Retourne None si le compte n'existe pas, ou si un code a déjà été envoyé
    il y a moins de 60 s. Le router répond de la même façon dans tous les cas
    (pas de fuite d'emails).
    """
    email = email.strip().lower()
    trader = TraderRepository(db).get_by_email(email)

    code = _generate_code()
    code_hash = hash_password(code)  # coût identique que le compte existe ou non

    if trader is None:
        return None  # compte inconnu : aucun code créé, aucun email envoyé

    now = _now()
    issued = VerificationCodeRepository(db).upsert_if_cooled_down(
        user_id=trader.id,
        purpose=CodePurpose.PASSWORD_RESET,
        code_hash=code_hash,
        expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
        now=now,
        cooldown=RESEND_COOLDOWN,
    )
    return IssuedCode(email=trader.email, code=code) if issued else None

def reset_password(db: Session, email: str, code: str, new_password: str) -> None:
    email = email.strip().lower()
    trader = TraderRepository(db).get_by_email(email)
    codes = VerificationCodeRepository(db)
    stored = codes.get(trader.id, CodePurpose.PASSWORD_RESET) if trader else None

    if stored is None or stored.expires_at <= _now():
        verify_password(code, _DUMMY_HASH)  # temps de réponse comparable
        raise InvalidCode()

    # Réserve la tentative AVANT de comparer : le compteur ne peut pas être contourné
    if not codes.reserve_attempt(stored.id, MAX_ATTEMPTS):
        raise TooManyAttempts()

    if not verify_password(code, stored.code_hash):
        raise InvalidCode()

    # Usage unique : si une requête simultanée a déjà consommé le code, on refuse
    if not codes.consume(stored.id):
        raise InvalidCode()

    trader.password_hash = hash_password(new_password)
    db.commit()