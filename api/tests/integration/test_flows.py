from datetime import timedelta

from sqlalchemy import select

from app.core.clock import utcnow
from app.models.trader import Trader
from app.models.verification_code import CodePurpose, VerificationCode

EMAIL = "alice@example.com"
PASSWORD = "MotDePasse123"
NEW_PASSWORD = "NouveauMotDePasse456"


def signup_and_verify(client, mailbox):
    r = client.post("/api/auth/register", json={
        "name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD,
    })
    assert r.status_code == 201
    code = mailbox.verification[-1][1]
    assert client.post("/api/auth/verify-email", json={"email": EMAIL, "code": code}).status_code == 200


def login(client, password=PASSWORD):
    return client.post("/api/auth/login", json={"email": EMAIL, "password": password})


def me(client, token):
    return client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})


def forgot(client):
    r = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    assert r.status_code == 200
    return r


def reset_flow(client, mailbox, new_password=NEW_PASSWORD):
    forgot(client)
    code = mailbox.reset[-1][1]
    r = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": code})
    assert r.status_code == 200
    token = r.json()["token"]
    return client.post("/api/auth/reset-password", json={"token": token, "new_password": new_password})


def age_reset_code(db, seconds):
    db.expire_all()
    trader = db.scalar(select(Trader).where(Trader.email == EMAIL))
    record = db.scalar(select(VerificationCode).where(
        VerificationCode.user_id == trader.id,
        VerificationCode.purpose == CodePurpose.PASSWORD_RESET,
    ))
    record.created_at = utcnow() - timedelta(seconds=seconds)
    db.commit()


def test_signup_verify_login_me(client, db, mailbox):
    signup_and_verify(client, mailbox)
    r = login(client)
    assert r.status_code == 200
    profile = me(client, r.json()["token"])
    assert profile.status_code == 200
    assert profile.json()["email"] == EMAIL
    assert profile.json()["name"] == "Alice"


def test_login_is_refused_until_email_is_verified(client, db, mailbox):
    client.post("/api/auth/register", json={
        "name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD,
    })
    assert login(client).status_code == 403


def test_password_reset_replaces_the_old_password(client, db, mailbox):
    signup_and_verify(client, mailbox)
    assert reset_flow(client, mailbox).status_code == 200
    assert login(client, PASSWORD).status_code == 401
    assert login(client, NEW_PASSWORD).status_code == 200


def test_session_opened_before_reset_is_refused_after(client, db, mailbox):
    signup_and_verify(client, mailbox)
    old_token = login(client).json()["token"]
    assert me(client, old_token).status_code == 200

    assert reset_flow(client, mailbox).status_code == 200

    assert me(client, old_token).status_code == 401
    assert me(client, login(client, NEW_PASSWORD).json()["token"]).status_code == 200


def test_second_forgot_replaces_the_previous_code(client, db, mailbox):
    signup_and_verify(client, mailbox)
    forgot(client)
    old = mailbox.reset[-1][1]
    age_reset_code(db, seconds=61)               # passe le cooldown de 60 s
    forgot(client)
    new = mailbox.reset[-1][1]
    assert len(mailbox.reset) == 2

    if new != old:
        r = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": old})
        assert r.status_code == 400
    r = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": new})
    assert r.status_code == 200


def test_access_token_cannot_be_used_to_reset_password(client, db, mailbox):
    signup_and_verify(client, mailbox)
    access = login(client).json()["token"]
    r = client.post("/api/auth/reset-password", json={"token": access, "new_password": NEW_PASSWORD})
    assert r.status_code == 400
    assert login(client, PASSWORD).status_code == 200


def test_no_reset_code_for_unverified_account(client, db, mailbox):
    client.post("/api/auth/register", json={
        "name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD,
    })
    r = forgot(client)
    assert r.status_code == 200
    assert mailbox.reset == []                   # aucun email de reset envoyé

    db.expire_all()
    trader = db.scalar(select(Trader).where(Trader.email == EMAIL))
    record = db.scalar(select(VerificationCode).where(
        VerificationCode.user_id == trader.id,
        VerificationCode.purpose == CodePurpose.PASSWORD_RESET,
    ))
    assert record is None                        # aucun code stocké


def test_forgot_answers_identically_for_unverified_and_unknown(client, db, mailbox):
    client.post("/api/auth/register", json={
        "name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD,
    })
    unverified = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    unknown = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert unverified.status_code == unknown.status_code == 200
    assert unverified.json() == unknown.json()