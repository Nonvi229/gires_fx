import re
from datetime import timedelta

import jwt
import pytest

from app.core import security
from app.core.clock import utcnow
from app.core.config import settings
from app.core.security import (
    ACCESS_TOKEN_MINUTES,
    RESET_TOKEN_MINUTES,
    create_access_token,
    create_reset_token,
    decode_access_token,
    decode_reset_token,
    generate_code,
    hash_code,
    hash_password,
    reset_token_matches,
)

SECRET = settings.secret_key
USER_ID = "3f2b8c1e-5d4a-4c7e-9b1a-0d2e6f7a8b9c"
HASH = hash_password("MotDePasse123")


def forge(purpose, *, key=SECRET, alg=None, drop=(), exp_delta=timedelta(minutes=5), **overrides):
    """Fabrique un jeton, éventuellement invalide, pour tester les décodeurs."""
    now = utcnow()
    payload = {
        "sub": USER_ID,
        "purpose": purpose,
        "fp": security._fingerprint(HASH),
        "iat": now,
        "exp": now + exp_delta,
    }
    for name in drop:
        payload.pop(name)
    payload.update(overrides)
    return jwt.encode(payload, key, algorithm=alg or settings.jwt_algorithm)


# ---------- codes ----------

def test_generate_code_is_always_five_digits():
    for _ in range(300):
        assert re.fullmatch(r"\d{5}", generate_code())


def test_generate_code_keeps_leading_zeros(monkeypatch):
    monkeypatch.setattr(security.secrets, "randbelow", lambda n: 42)
    assert generate_code() == "00042"


def test_hash_code_is_deterministic_and_not_plaintext():
    assert hash_code("12345") == hash_code("12345")
    assert hash_code("12345") != hash_code("12346")
    assert "12345" not in hash_code("12345")


def test_hash_code_depends_on_secret_key(monkeypatch):
    before = hash_code("12345")
    monkeypatch.setattr(security.settings, "secret_key", "une-autre-cle-secrete-assez-longue-123456")
    assert hash_code("12345") != before


# ---------- contenu des jetons ----------

def test_access_token_claims():
    payload = decode_access_token(create_access_token(USER_ID, HASH))
    assert payload["sub"] == USER_ID
    assert payload["purpose"] == "access"
    assert payload["fp"] == security._fingerprint(HASH)
    assert payload["exp"] - payload["iat"] == ACCESS_TOKEN_MINUTES * 60


def test_reset_token_claims():
    payload = decode_reset_token(create_reset_token(USER_ID, HASH))
    assert payload["sub"] == USER_ID
    assert payload["purpose"] == "password_reset"
    assert payload["exp"] - payload["iat"] == RESET_TOKEN_MINUTES * 60


def test_fingerprint_does_not_expose_the_hash():
    assert HASH not in create_access_token(USER_ID, HASH)
    assert len(security._fingerprint(HASH)) == 16


def test_access_and_reset_tokens_are_not_interchangeable():
    assert decode_access_token(create_reset_token(USER_ID, HASH)) is None
    assert decode_reset_token(create_access_token(USER_ID, HASH)) is None


def test_reset_token_matches():
    payload = decode_access_token(create_access_token(USER_ID, HASH))
    assert reset_token_matches(payload, HASH) is True
    assert reset_token_matches(payload, hash_password("AutreMotDePasse1")) is False
    assert reset_token_matches({}, HASH) is False       # pas de "fp"


# ---------- jetons invalides ----------

@pytest.mark.parametrize("token", ["", "abc", "a.b.c"])
def test_garbage_is_rejected(token):
    assert decode_access_token(token) is None
    assert decode_reset_token(token) is None


BAD_TOKENS = {
    "other_key": dict(key="une-autre-cle-secrete-assez-longue-123456"),
    "no_exp": dict(drop=("exp",)),
    "no_sub": dict(drop=("sub",)),
    "none_alg": dict(key=None, alg="none"),
    "hs512": dict(alg="HS512"),
    "expired": dict(exp_delta=timedelta(seconds=-1)),
}


@pytest.mark.parametrize("case", BAD_TOKENS)
def test_decode_access_token_rejects_bad_tokens(case):
    assert decode_access_token(forge("access", **BAD_TOKENS[case])) is None


@pytest.mark.parametrize("case", BAD_TOKENS)
def test_decode_reset_token_rejects_bad_tokens(case):
    assert decode_reset_token(forge("password_reset", **BAD_TOKENS[case])) is None


def test_valid_forged_tokens_are_accepted():
    """Garde-fou : forge() produit bien des jetons valides quand rien n'est cassé."""
    assert decode_access_token(forge("access")) is not None
    assert decode_reset_token(forge("password_reset")) is not None