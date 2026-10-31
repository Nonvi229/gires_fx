import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.clock import as_utc, utcnow
from app.core.security import (
    create_reset_token,
    decode_reset_token,
    hash_password,
    reset_token_matches,
    verify_password,
)
from app.models.trader import Trader
from app.models.verification_code import CodePurpose
from app.repositories.trader_repository import TraderRepository
from app.repositories.verification_code_repository import VerificationCodeRepository

CODE_LENGTH = 5
CODE_TTL_MINUTES = 3
MAX_ATTEMPTS = 3
RESEND_COOLDOWN = timedelta(seconds=60)

# Hash factice : « email inconnu » prend autant de temps que « code faux »
_DUMMY_HASH = hash_password("000000")


class InvalidCode(Exception):
    """Code faux, expiré, inexistant ou déjà utilisé (message volontairement unique)."""


class TooManyAttempts(Exception):
    """Limite de tentatives atteinte : il faut demander un nouveau code."""


class InvalidResetToken(Exception):
    """Jeton invalide, expiré, ou déjà utilisé."""


@dataclass
class IssuedCode:
    email: str
    code: str


def _generate_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"


def request_reset(db: Session, email: str) -> IssuedCode | None:
    """Prépare un code de réinitialisation.

    Retourne None si le compte n'existe pas, ou si un code a déjà été envoyé
    il y a moins de 60 s. Le router répond de la même façon dans tous les cas.
    """
    email = email.strip().lower()
    trader = TraderRepository(db).get_by_email(email)

    code = _generate_code()
    code_hash = hash_password(code)  # coût identique que le compte existe ou non

    if trader is None or not trader.is_verified:
        return None

    now = utcnow()
    issued = VerificationCodeRepository(db).upsert_if_cooled_down(
        user_id=trader.id,
        purpose=CodePurpose.PASSWORD_RESET,
        code_hash=code_hash,
        expires_at=now + timedelta(minutes=CODE_TTL_MINUTES),
        now=now,
        cooldown=RESEND_COOLDOWN,
    )
    return IssuedCode(email=trader.email, code=code) if issued else None


def verify_reset_code(db: Session, email: str, code: str) -> str:
    """Étape 1 : valide le code à 5 chiffres, le consomme, renvoie un jeton de 10 min."""
    email = email.strip().lower()
    trader = TraderRepository(db).get_by_email(email)
    codes = VerificationCodeRepository(db)
    stored = codes.get(trader.id, CodePurpose.PASSWORD_RESET) if trader else None

    if stored is None or as_utc(stored.expires_at) <= utcnow():
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

    db.commit()
    return create_reset_token(str(trader.id), trader.password_hash)


def reset_password(db: Session, token: str, new_password: str) -> None:
    """Étape 2 : change le mot de passe avec le jeton obtenu à l'étape 1."""
    payload = decode_reset_token(token)
    if payload is None:
        raise InvalidResetToken()

    try:
        trader = db.get(Trader, uuid.UUID(payload["sub"]))
    except (KeyError, ValueError):
        raise InvalidResetToken()

    # Le jeton est lié à l'ancien mot de passe : une fois changé, il ne marche plus
    if trader is None or not reset_token_matches(payload, trader.password_hash):
        raise InvalidResetToken()

    trader.password_hash = hash_password(new_password)
    db.commit()