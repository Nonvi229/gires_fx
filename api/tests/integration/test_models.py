import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.trader import Trader
from app.models.verification_code import CodePurpose, VerificationCode


def make_trader(email="jane@example.com"):
    return Trader(email=email, name="Doe", surname="Jane", password_hash="hash")


def make_code(user_id, purpose=CodePurpose.LOGIN_2FA):
    return VerificationCode(
        user_id=user_id,
        purpose=purpose,
        code_hash="hash",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
    )


def test_trader_gets_uuid_and_defaults(db):
    trader = make_trader()
    db.add(trader)
    db.commit()

    assert isinstance(trader.id, uuid.UUID)
    assert trader.is_verified is False
    assert trader.created_at is not None


def test_email_must_be_unique(db):
    db.add(make_trader())
    db.commit()

    db.add(make_trader())
    with pytest.raises(IntegrityError):
        db.commit()


def test_only_one_code_per_user_and_purpose(db):
    trader = make_trader()
    db.add(trader)
    db.commit()

    db.add(make_code(trader.id))
    db.commit()

    db.add(make_code(trader.id))
    with pytest.raises(IntegrityError):
        db.commit()


def test_different_purposes_are_allowed(db):
    trader = make_trader()
    db.add(trader)
    db.commit()

    db.add(make_code(trader.id, CodePurpose.LOGIN_2FA))
    db.add(make_code(trader.id, CodePurpose.PASSWORD_RESET))
    db.commit()

    assert db.query(VerificationCode).count() == 2


def test_codes_are_deleted_with_their_trader(db):
    trader = make_trader()
    db.add(trader)
    db.commit()
    db.add(make_code(trader.id))
    db.commit()

    db.delete(trader)
    db.commit()

    assert db.query(VerificationCode).count() == 0

EMAIL = "jane@example.com"
PAYLOAD = {"name": "Jane", "surname": "Doe", "email": EMAIL, "password": "Passw0rd!x"}

def test_register_answers_identically_for_new_and_existing(client, db, monkeypatch):
    sent = []
    monkeypatch.setattr("app.services.auth_service.send_verification_email",
                        lambda to, code: sent.append(("code", to)))
    monkeypatch.setattr("app.services.auth_service.send_already_registered_email",
                        lambda to: sent.append(("reminder", to)))

    first = client.post("/api/auth/register", json=PAYLOAD)
    trader = db.query(Trader).one()
    trader.is_verified = True          # le compte est maintenant vérifié
    db.commit()

    second = client.post("/api/auth/register", json=PAYLOAD)

    assert first.status_code == second.status_code == 201
    assert first.json() == second.json()                 # aucune différence visible
    assert sent == [("code", EMAIL), ("reminder", EMAIL)]