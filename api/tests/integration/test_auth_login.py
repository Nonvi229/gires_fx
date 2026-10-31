from datetime import timedelta

import jwt
import pytest

from app.core.clock import utcnow
from app.core.config import settings
from app.core.security import (
    create_access_token, create_reset_token, hash_password,
)
from app.models.trader import Trader

PASSWORD = "MotDePasse123"


@pytest.fixture
def trader(db):
    t = Trader(
        email="alice@example.com", name="Alice", surname="Martin",
        password_hash=hash_password(PASSWORD), is_verified=True,
    )
    db.add(t)
    db.commit()
    return t


def _login(client, email="alice@example.com", password=PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def test_login_returns_token_and_me_works(client, trader):
    r = _login(client)
    assert r.status_code == 200
    token = r.json()["token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "alice@example.com"
    assert "password_hash" not in me.json()


def test_login_email_is_case_insensitive(client, trader):
    assert _login(client, email="ALICE@Example.com").status_code == 200


def test_wrong_password_and_unknown_email_give_same_error(client, trader):
    wrong = _login(client, password="incorrect123")
    unknown = _login(client, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json() == unknown.json()


def test_unverified_account_with_correct_password_is_refused(client, db, trader):
    trader.is_verified = False
    db.commit()
    assert _login(client).status_code == 403


def test_unverified_account_with_wrong_password_looks_like_any_failure(client, db, trader):
    trader.is_verified = False
    db.commit()
    assert _login(client, password="incorrect123").status_code == 401


def test_me_requires_a_token(client):
    assert client.get("/api/auth/me").status_code == 401


def test_me_rejects_garbage_token(client):
    r = client.get("/api/auth/me", headers={"Authorization": "Bearer nimportequoi"})
    assert r.status_code == 401


def test_reset_token_cannot_be_used_as_session(client, trader):
    token = create_reset_token(str(trader.id), trader.password_hash)
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_expired_access_token_is_rejected(client, trader):
    now = utcnow()
    token = jwt.encode(
        {"sub": str(trader.id), "purpose": "access", "iat": now - timedelta(hours=2),
         "exp": now - timedelta(hours=1)},
        settings.secret_key, algorithm=settings.jwt_algorithm,
    )
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401


def test_session_is_invalidated_by_password_change(client, db, trader):
    token = create_access_token(str(trader.id), trader.password_hash)
    trader.password_hash = hash_password("NouveauMotDePasse456")
    db.commit()
    r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401