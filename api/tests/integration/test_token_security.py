from datetime import timedelta

import jwt
import pytest

from app.core import security
from app.core.clock import utcnow
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.models.trader import Trader

EMAIL = "alice@example.com"
PASSWORD = "MotDePasse123"
SECRET = settings.secret_key


@pytest.fixture
def trader(db):
    t = Trader(
        email=EMAIL, name="Alice", surname="Martin",
        password_hash=hash_password(PASSWORD), is_verified=True,
    )
    db.add(t)
    db.commit()
    return t


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def forge(trader, *, key=SECRET, alg=None, drop=(), exp_delta=timedelta(minutes=5), **overrides):
    now = utcnow()
    payload = {
        "sub": str(trader.id),
        "purpose": "access",
        "fp": security._fingerprint(trader.password_hash),
        "iat": now,
        "exp": now + exp_delta,
    }
    for name in drop:
        payload.pop(name)
    payload.update(overrides)
    return jwt.encode(payload, key, algorithm=alg or settings.jwt_algorithm)


def test_forge_helper_produces_a_valid_session(client, trader):
    """Garde-fou : sans cassure, le jeton fabriqué est accepté."""
    assert client.get("/api/auth/me", headers=bearer(forge(trader))).status_code == 200


@pytest.mark.parametrize("case", [
    dict(key="une-autre-cle-secrete-assez-longue-123456"),
    dict(drop=("exp",)),
    dict(drop=("sub",)),
    dict(drop=("fp",)),
    dict(key=None, alg="none"),
    dict(alg="HS512"),
    dict(sub="pas-un-uuid"),
    dict(purpose="password_reset"),
    dict(exp_delta=timedelta(seconds=-1)),
], ids=["other_key", "no_exp", "no_sub", "no_fp", "none_alg", "hs512",
        "sub_not_uuid", "wrong_purpose", "expired"])
def test_me_rejects_forged_tokens(client, trader, case):
    r = client.get("/api/auth/me", headers=bearer(forge(trader, **case)))
    assert r.status_code == 401


def test_me_rejects_token_of_deleted_user(client, db, trader):
    token = create_access_token(str(trader.id), trader.password_hash)
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 200
    db.delete(trader)
    db.commit()
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


def test_me_rejects_account_turned_unverified(client, db, trader):
    token = create_access_token(str(trader.id), trader.password_hash)
    trader.is_verified = False
    db.commit()
    assert client.get("/api/auth/me", headers=bearer(token)).status_code == 401


@pytest.mark.parametrize("header", [
    "token-sans-schema",
    "Basic abcdef",
    "Bearer",
    "Bearer ",
])
def test_me_rejects_malformed_authorization_header(client, trader, header):
    r = client.get("/api/auth/me", headers={"Authorization": header})
    assert r.status_code == 401


def test_me_exposes_only_public_fields(client, trader):
    token = create_access_token(str(trader.id), trader.password_hash)
    body = client.get("/api/auth/me", headers=bearer(token)).json()
    assert set(body) == {"id", "email", "name", "surname"}


@pytest.mark.parametrize("password", ["x" * 129, ""])
def test_login_rejects_out_of_range_password(client, trader, password):
    r = client.post("/api/auth/login", json={"email": EMAIL, "password": password})
    assert r.status_code == 422


def test_no_response_leaks_hashes_or_codes(client, db, mailbox):
    responses = []

    r = client.post("/api/auth/register", json={
        "name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD})
    responses.append((r, mailbox.verification[-1][1]))
    code = mailbox.verification[-1][1]

    responses.append((client.post("/api/auth/verify-email",
                                  json={"email": EMAIL, "code": code}), code))

    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    responses.append((login, code))
    token = login.json()["token"]
    responses.append((client.get("/api/auth/me", headers=bearer(token)), code))

    r = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    reset_code = mailbox.reset[-1][1]
    responses.append((r, reset_code))

    r = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": reset_code})
    responses.append((r, reset_code))
    reset_token = r.json()["token"]

    r = client.post("/api/auth/reset-password",
                    json={"token": reset_token, "new_password": "NouveauMotDePasse456"})
    responses.append((r, reset_code))

    for response, secret_code in responses:
        text = response.text
        assert "password_hash" not in text
        assert "argon2" not in text
        assert PASSWORD not in text
        assert "NouveauMotDePasse456" not in text
        # le code n'apparaît dans aucune réponse HTTP (seulement dans l'email)
        assert secret_code not in text.replace(token, "").replace(reset_token, "")