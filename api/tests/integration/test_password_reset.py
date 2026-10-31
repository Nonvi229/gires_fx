import re
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.core.security import hash_password, verify_password
from app.models import Trader, VerificationCode  # adaptez si votre classe a un autre nom
from app.services import password_reset_service as service
from app.services.password_reset_service import InvalidCode, TooManyAttempts

EMAIL = "jane@example.com"
OLD_PASSWORD = "OldPassw0rd!"
NEW_PASSWORD = "NewPassw0rd!"


def make_trader(db, email=EMAIL):
    trader = Trader(
        email=email,
        name="Doe",
        surname="Jane",
        password_hash=hash_password(OLD_PASSWORD),
        is_verified=True,
    )
    db.add(trader)
    db.commit()
    return trader


def stored_code(db):
    db.expire_all()
    return db.query(VerificationCode).one()


# ------------------------------------------------------------------ service

def test_known_email_issues_hashed_six_digit_code(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)

    assert issued is not None
    assert re.fullmatch(r"\d{6}", issued.code)
    row = stored_code(db)
    assert row.code_hash != issued.code  # jamais en clair
    assert row.attempts == 0


def test_email_is_case_insensitive(db):
    make_trader(db)
    assert service.request_reset(db, "  JANE@Example.com ") is not None


def test_second_request_within_cooldown_is_ignored(db):
    make_trader(db)
    service.request_reset(db, EMAIL)
    first_hash = stored_code(db).code_hash

    assert service.request_reset(db, EMAIL) is None
    assert stored_code(db).code_hash == first_hash


def test_new_code_after_cooldown_resets_attempts(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    for _ in range(3):
        with pytest.raises(InvalidCode):
            service.reset_password(db, EMAIL, "000000" if issued.code != "000000" else "111111", NEW_PASSWORD)
    assert stored_code(db).attempts == 3

    db.execute(
        update(VerificationCode).values(
            created_at=datetime.now(timezone.utc) - service.RESEND_COOLDOWN - timedelta(seconds=1)
        )
    )
    db.commit()

    assert service.request_reset(db, EMAIL) is not None
    assert stored_code(db).attempts == 0        # le compteur est bien remis à zéro


def test_reset_with_correct_code_changes_password_and_consumes_code(db):
    trader = make_trader(db)
    issued = service.request_reset(db, EMAIL)

    service.reset_password(db, EMAIL, issued.code, NEW_PASSWORD)

    db.refresh(trader)
    assert verify_password(NEW_PASSWORD, trader.password_hash)
    assert not verify_password(OLD_PASSWORD, trader.password_hash)
    assert db.query(VerificationCode).count() == 0


def test_code_is_single_use(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    service.reset_password(db, EMAIL, issued.code, NEW_PASSWORD)

    with pytest.raises(InvalidCode):
        service.reset_password(db, EMAIL, issued.code, "AnotherPassw0rd!")


def test_wrong_code_is_rejected_and_counted(db):
    trader = make_trader(db)
    issued = service.request_reset(db, EMAIL)
    wrong = "000000" if issued.code != "000000" else "111111"

    with pytest.raises(InvalidCode):
        service.reset_password(db, EMAIL, wrong, NEW_PASSWORD)

    assert stored_code(db).attempts == 1
    db.refresh(trader)
    assert verify_password(OLD_PASSWORD, trader.password_hash)


def test_locked_after_max_attempts_even_with_correct_code(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    wrong = "000000" if issued.code != "000000" else "111111"

    for _ in range(service.MAX_ATTEMPTS):
        with pytest.raises(InvalidCode):
            service.reset_password(db, EMAIL, wrong, NEW_PASSWORD)

    with pytest.raises(TooManyAttempts):
        service.reset_password(db, EMAIL, issued.code, NEW_PASSWORD)


def test_expired_code_is_rejected(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    db.execute(update(VerificationCode).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    db.commit()

    with pytest.raises(InvalidCode):
        service.reset_password(db, EMAIL, issued.code, NEW_PASSWORD)


def test_reset_for_unknown_email_gives_same_error(db):
    with pytest.raises(InvalidCode):
        service.reset_password(db, "ghost@example.com", "123456", NEW_PASSWORD)


# ---------------------------------------------------------------------- API


@pytest.fixture
def sent(monkeypatch):
    box = []
    monkeypatch.setattr(
        "app.routers.password_reset.send_email",
        lambda to, subject, body: box.append((to, body)),
    )
    return box


def code_from(body: str) -> str:
    return re.search(r"\b(\d{6})\b", body).group(1)


def test_forgot_password_answers_identically_for_known_and_unknown(client, db, sent):
    make_trader(db)

    known = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    unknown = client.post("/api/auth/forgot-password", json={"email": "ghost@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()
    assert [to for to, _ in sent] == [EMAIL]  # un seul email, pour le compte existant


def test_full_flow_through_the_api(client, db, sent):
    trader = make_trader(db)

    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    code = code_from(sent[0][1])

    ok = client.post("/api/auth/reset-password", json={"email": EMAIL, "code": code, "new_password": NEW_PASSWORD})
    assert ok.status_code == 200

    db.refresh(trader)
    assert verify_password(NEW_PASSWORD, trader.password_hash)

    reuse = client.post("/api/auth/reset-password", json={"email": EMAIL, "code": code, "new_password": "Another0ne!"})
    assert reuse.status_code == 400


def test_wrong_code_returns_400(client, db, sent):
    make_trader(db)
    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    real = code_from(sent[0][1])
    wrong = "000000" if real != "000000" else "111111"

    res = client.post("/api/auth/reset-password", json={"email": EMAIL, "code": wrong, "new_password": NEW_PASSWORD})
    assert res.status_code == 400
    assert res.json()["detail"] == "Code invalide ou expiré."


def test_lockout_returns_429_even_with_correct_code(client, db, sent):
    make_trader(db)
    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    real = code_from(sent[0][1])
    wrong = "000000" if real != "000000" else "111111"

    for _ in range(service.MAX_ATTEMPTS):
        res = client.post("/api/auth/reset-password", json={"email": EMAIL, "code": wrong, "new_password": NEW_PASSWORD})
        assert res.status_code == 400

    locked = client.post("/api/auth/reset-password", json={"email": EMAIL, "code": real, "new_password": NEW_PASSWORD})
    assert locked.status_code == 429


@pytest.mark.parametrize(
    "payload",
    [
        {"email": EMAIL, "code": "12345", "new_password": NEW_PASSWORD},
        {"email": EMAIL, "code": "abcdef", "new_password": NEW_PASSWORD},
        {"email": EMAIL, "code": "123456", "new_password": "short"},
    ],
)
def test_invalid_payload_returns_422(client, db, payload):
    assert client.post("/api/auth/reset-password", json=payload).status_code == 422

def test_no_new_code_before_cooldown(db):
    make_trader(db)
    assert service.request_reset(db, EMAIL) is not None
    assert service.request_reset(db, EMAIL) is None     # tout de suite après : refusé