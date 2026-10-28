import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

from app.core.config import settings

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