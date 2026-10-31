from datetime import timedelta

import pytest
from sqlalchemy import func, select

from app.core.clock import utcnow
from app.core.security import hash_code, verify_password
from app.models.trader import Trader
from app.models.verification_code import CodePurpose, VerificationCode

EMAIL = "alice@example.com"
PASSWORD = "MotDePasse123"
PURPOSE = CodePurpose.EMAIL_VERIFICATION


# ---------- helpers ----------

def register(client, **override):
    payload = {"name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD}
    payload.update(override)
    return client.post("/api/auth/register", json=payload)


def verify(client, code, email=EMAIL):
    return client.post("/api/auth/verify-email", json={"email": email, "code": code})


def resend(client, email=EMAIL):
    return client.post("/api/auth/resend-code", json={"email": email})


def get_trader(db, email=EMAIL):
    db.expire_all()
    return db.scalar(select(Trader).where(Trader.email == email))


def get_code(db, trader):
    db.expire_all()
    return db.scalar(
        select(VerificationCode).where(
            VerificationCode.user_id == trader.id, VerificationCode.purpose == PURPOSE
        )
    )


def count_traders(db):
    db.expire_all()
    return db.scalar(select(func.count()).select_from(Trader))


def wrong_code(code):
    return "11111" if code == "00000" else "00000"


def registered(client, mailbox):
    """Inscrit Alice et renvoie le code reçu par email."""
    assert register(client).status_code == 201
    return mailbox.verification[-1][1]


def age_code(db, trader, seconds):
    """Vieillit le dernier envoi pour passer le cooldown sans attendre."""
    record = get_code(db, trader)
    record.created_at = utcnow() - timedelta(seconds=seconds)
    db.commit()


# ---------- inscription ----------

def test_register_new_account(client, db, mailbox):
    r = register(client)
    assert r.status_code == 201
    assert "message" in r.json()

    trader = get_trader(db)
    assert trader.is_verified is False
    assert trader.password_hash != PASSWORD
    assert verify_password(PASSWORD, trader.password_hash)

    (to, code), = mailbox.verification
    assert to == EMAIL and len(code) == 5 and code.isdigit()
    record = get_code(db, trader)
    assert record.code_hash == hash_code(code)
    assert record.code_hash != code
    assert record.attempts == 0


def test_register_normalizes_email(client, db, mailbox):
    assert register(client, email="Alice@Example.COM").status_code == 201
    assert get_trader(db, EMAIL) is not None


def test_register_strips_name_and_surname(client, db, mailbox):
    assert register(client, name="  Alice  ", surname="  Martin ").status_code == 201
    trader = get_trader(db)
    assert (trader.name, trader.surname) == ("Alice", "Martin")


def test_register_resumes_abandoned_signup(client, db, mailbox):
    register(client)
    first_hash = get_trader(db).password_hash

    assert register(client, name="Bob", surname="Durand", password="AutrePass456").status_code == 201

    assert count_traders(db) == 1
    trader = get_trader(db)
    assert (trader.name, trader.surname) == ("Bob", "Durand")
    assert trader.password_hash != first_hash
    assert verify_password("AutrePass456", trader.password_hash)
    assert trader.is_verified is False

    # le nouveau code remplace l'ancien
    assert len(mailbox.verification) == 2
    assert get_code(db, trader).code_hash == hash_code(mailbox.verification[-1][1])


def test_register_on_verified_account_changes_nothing(client, db, mailbox):
    verify(client, registered(client, mailbox))
    assert get_trader(db).is_verified is True

    r = register(client, name="Pirate", password="MotDePassePirate1")
    assert r.status_code == 201

    trader = get_trader(db)
    assert trader.name == "Alice"
    assert verify_password(PASSWORD, trader.password_hash)
    assert mailbox.already == [EMAIL]
    assert len(mailbox.verification) == 1       # aucun nouveau code
    assert get_code(db, trader) is None


@pytest.mark.parametrize("override", [
    {"name": "A"},
    {"surname": "B"},
    {"password": "court"},
    {"password": "x" * 129},
    {"email": "pas-un-email"},
])
def test_register_rejects_invalid_input(client, db, mailbox, override):
    assert register(client, **override).status_code == 422
    assert count_traders(db) == 0
    assert mailbox.verification == []


@pytest.mark.parametrize("field", ["name", "surname", "email", "password"])
def test_register_rejects_missing_field(client, db, mailbox, field):
    payload = {"name": "Alice", "surname": "Martin", "email": EMAIL, "password": PASSWORD}
    payload.pop(field)
    assert client.post("/api/auth/register", json=payload).status_code == 422
    assert count_traders(db) == 0


# ---------- vérification d'email ----------

def test_verify_email_activates_account(client, db, mailbox):
    code = registered(client, mailbox)
    r = verify(client, code)
    assert r.status_code == 200
    trader = get_trader(db)
    assert trader.is_verified is True
    assert get_code(db, trader) is None          # code consommé


def test_verify_email_is_case_insensitive(client, db, mailbox):
    code = registered(client, mailbox)
    assert verify(client, code, email="ALICE@Example.com").status_code == 200


def test_wrong_code_returns_400_and_counts_attempt(client, db, mailbox):
    code = registered(client, mailbox)
    assert verify(client, wrong_code(code)).status_code == 400
    trader = get_trader(db)
    assert trader.is_verified is False
    assert get_code(db, trader).attempts == 1


def test_locked_after_three_attempts_even_with_correct_code(client, db, mailbox):
    code = registered(client, mailbox)
    for _ in range(3):
        assert verify(client, wrong_code(code)).status_code == 400
    assert verify(client, code).status_code == 429
    assert verify(client, wrong_code(code)).status_code == 429
    assert get_trader(db).is_verified is False


def test_expired_code_is_rejected(client, db, mailbox):
    code = registered(client, mailbox)
    record = get_code(db, get_trader(db))
    record.expires_at = utcnow() - timedelta(seconds=1)
    db.commit()
    assert verify(client, code).status_code == 400
    assert get_trader(db).is_verified is False


def test_code_is_single_use(client, db, mailbox):
    code = registered(client, mailbox)
    assert verify(client, code).status_code == 200
    assert verify(client, code).status_code == 400


def test_unknown_email_gives_same_error_as_wrong_code(client, db, mailbox):
    code = registered(client, mailbox)
    wrong = verify(client, wrong_code(code))
    unknown = verify(client, code, email="nobody@example.com")
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json()


@pytest.mark.parametrize("bad", ["1234", "123456", "abcde", ""])
def test_verify_email_rejects_malformed_code(client, db, mailbox, bad):
    registered(client, mailbox)
    assert verify(client, bad).status_code == 422


# ---------- renvoi de code ----------

def test_resend_for_unknown_email_is_silent(client, db, mailbox):
    r = resend(client, "nobody@example.com")
    assert r.status_code == 200
    assert mailbox.verification == []


def test_resend_for_verified_account_is_silent(client, db, mailbox):
    verify(client, registered(client, mailbox))
    assert resend(client).status_code == 200
    assert len(mailbox.verification) == 1        # seulement celui de l'inscription


def test_resend_before_cooldown_returns_429(client, db, mailbox):
    registered(client, mailbox)
    assert resend(client).status_code == 429
    assert len(mailbox.verification) == 1


def test_resend_after_cooldown_issues_new_code(client, db, mailbox):
    old = registered(client, mailbox)
    trader = get_trader(db)
    record = get_code(db, trader)
    record.attempts = 2
    db.commit()
    age_code(db, trader, seconds=31)

    assert resend(client).status_code == 200

    assert len(mailbox.verification) == 2
    new = mailbox.verification[-1][1]
    record = get_code(db, trader)
    assert record.attempts == 0
    assert record.code_hash == hash_code(new)
    if new != old:                                # 1 chance sur 100 000 de collision
        assert verify(client, old).status_code == 400
    assert verify(client, new).status_code == 200