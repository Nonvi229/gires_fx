import hashlib
import hmac
import secrets
from datetime import timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.clock import utcnow
from app.core.config import settings

RESET_TOKEN_MINUTES = 10
ACCESS_TOKEN_MINUTES = 60
_ph = PasswordHasher()


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, password)
    except VerifyMismatchError:
        return False


def generate_code() -> str:
    """Code à 5 chiffres, aléatoire cryptographique (zéros initiaux conservés)."""
    return f"{secrets.randbelow(100000):05d}"


def hash_code(code: str) -> str:
    """Le code n'est jamais stocké en clair."""
    return hmac.new(settings.secret_key.encode(), code.encode(), hashlib.sha256).hexdigest()


def _fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_reset_token(user_id: str, password_hash: str) -> str:
    now = utcnow()
    payload = {
        "sub": user_id,
        "purpose": "password_reset",
        "fp": _fingerprint(password_hash),   # lie le jeton à l'ancien mot de passe
        "iat": now,
        "exp": now + timedelta(minutes=RESET_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_reset_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    return payload if payload.get("purpose") == "password_reset" else None


def reset_token_matches(payload: dict, password_hash: str) -> bool:
    return hmac.compare_digest(payload.get("fp", ""), _fingerprint(password_hash))


def create_access_token(user_id: str, password_hash: str) -> str:
    now = utcnow()
    payload = {
        "sub": user_id,
        "purpose": "access",                 # distinct de "password_reset"
        "fp": _fingerprint(password_hash),   # un changement de mot de passe invalide les sessions
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub"]},
        )
    except jwt.PyJWTError:
        return None
    return payload if payload.get("purpose") == "access" else None