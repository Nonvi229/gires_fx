import re
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import update

import app.core.security as security
from app.core.config import settings
from app.core.security import decode_reset_token, hash_password, verify_password
from app.models import Trader, VerificationCode
from app.services import password_reset_service as service
from app.services.password_reset_service import InvalidCode, InvalidResetToken, TooManyAttempts

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


def wrong_for(code: str) -> str:
    return "00000" if code != "00000" else "11111"


def do_reset(db, code, password=NEW_PASSWORD):
    """Parcours complet en deux étapes ; renvoie le jeton utilisé."""
    token = service.verify_reset_code(db, EMAIL, code)
    service.reset_password(db, token, password)
    return token


# ------------------------------------------------------------ service : codes

def test_known_email_issues_hashed_five_digit_code(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)

    assert issued is not None
    assert re.fullmatch(r"\d{5}", issued.code)
    row = stored_code(db)
    assert row.code_hash != issued.code  # jamais en clair
    assert row.attempts == 0


def test_code_keeps_leading_zeros(monkeypatch):
    monkeypatch.setattr(service.secrets, "randbelow", lambda n: 42)
    assert service._generate_code() == "00042"


def test_email_is_case_insensitive(db):
    make_trader(db)
    assert service.request_reset(db, "  JANE@Example.com ") is not None


def test_no_new_code_before_cooldown(db):
    make_trader(db)
    assert service.request_reset(db, EMAIL) is not None
    assert service.request_reset(db, EMAIL) is None  # tout de suite après : refusé


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
            service.verify_reset_code(db, EMAIL, wrong_for(issued.code))
    assert stored_code(db).attempts == 3

    db.execute(
        update(VerificationCode).values(
            created_at=datetime.now(timezone.utc) - service.RESEND_COOLDOWN - timedelta(seconds=1)
        )
    )
    db.commit()

    assert service.request_reset(db, EMAIL) is not None
    assert stored_code(db).attempts == 0  # le compteur est bien remis à zéro


# --------------------------------------------- service : étape 1 (le code)

def test_correct_code_returns_token_and_consumes_code(db):
    trader = make_trader(db)
    issued = service.request_reset(db, EMAIL)

    token = service.verify_reset_code(db, EMAIL, issued.code)

    payload = decode_reset_token(token)
    assert payload is not None and payload["sub"] == str(trader.id)
    assert db.query(VerificationCode).count() == 0      # le code est consommé
    db.refresh(trader)
    assert verify_password(OLD_PASSWORD, trader.password_hash)  # mot de passe pas encore changé


def test_code_is_single_use(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    service.verify_reset_code(db, EMAIL, issued.code)

    with pytest.raises(InvalidCode):
        service.verify_reset_code(db, EMAIL, issued.code)


def test_wrong_code_is_rejected_and_counted(db):
    trader = make_trader(db)
    issued = service.request_reset(db, EMAIL)

    with pytest.raises(InvalidCode):
        service.verify_reset_code(db, EMAIL, wrong_for(issued.code))

    assert stored_code(db).attempts == 1
    db.refresh(trader)
    assert verify_password(OLD_PASSWORD, trader.password_hash)


def test_locked_after_max_attempts_even_with_correct_code(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)

    for _ in range(service.MAX_ATTEMPTS):
        with pytest.raises(InvalidCode):
            service.verify_reset_code(db, EMAIL, wrong_for(issued.code))

    with pytest.raises(TooManyAttempts):
        service.verify_reset_code(db, EMAIL, issued.code)


def test_expired_code_is_rejected(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    db.execute(update(VerificationCode).values(expires_at=datetime.now(timezone.utc) - timedelta(seconds=1)))
    db.commit()

    with pytest.raises(InvalidCode):
        service.verify_reset_code(db, EMAIL, issued.code)


def test_verify_for_unknown_email_gives_same_error(db):
    with pytest.raises(InvalidCode):
        service.verify_reset_code(db, "ghost@example.com", "12456")


# -------------------------------------------- service : étape 2 (le jeton)

def test_reset_with_token_changes_password(db):
    trader = make_trader(db)
    issued = service.request_reset(db, EMAIL)

    do_reset(db, issued.code)

    db.refresh(trader)
    assert verify_password(NEW_PASSWORD, trader.password_hash)
    assert not verify_password(OLD_PASSWORD, trader.password_hash)


def test_reset_token_is_single_use(db):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    token = do_reset(db, issued.code)

    with pytest.raises(InvalidResetToken):
        service.reset_password(db, token, "AnotherPassw0rd!")  # le mot de passe a changé


def test_garbage_token_is_rejected(db):
    with pytest.raises(InvalidResetToken):
        service.reset_password(db, "pas-un-jeton", NEW_PASSWORD)


def test_expired_token_is_rejected(db, monkeypatch):
    make_trader(db)
    issued = service.request_reset(db, EMAIL)
    monkeypatch.setattr(security, "RESET_TOKEN_MINUTES", -1)   # jeton déjà expiré à sa création
    token = service.verify_reset_code(db, EMAIL, issued.code)

    with pytest.raises(InvalidResetToken):
        service.reset_password(db, token, NEW_PASSWORD)


def test_token_with_another_purpose_is_rejected(db):
    trader = make_trader(db)
    token = jwt.encode(
        {"sub": str(trader.id), "purpose": "access", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.secret_key,
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(InvalidResetToken):
        service.reset_password(db, token, NEW_PASSWORD)


def test_token_signed_with_another_key_is_rejected(db):
    trader = make_trader(db)
    token = jwt.encode(
        {"sub": str(trader.id), "purpose": "password_reset", "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        "une-autre-cle-secrete-de-test-0123456789",
        algorithm=settings.jwt_algorithm,
    )

    with pytest.raises(InvalidResetToken):
        service.reset_password(db, token, NEW_PASSWORD)


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
    return re.search(r"\b(\d{5})\b", body).group(1)


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

    step1 = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": code})
    assert step1.status_code == 200
    token = step1.json()["token"]

    step2 = client.post("/api/auth/reset-password", json={"token": token, "new_password": NEW_PASSWORD})
    assert step2.status_code == 200

    db.refresh(trader)
    assert verify_password(NEW_PASSWORD, trader.password_hash)

    reuse = client.post("/api/auth/reset-password", json={"token": token, "new_password": "Another0ne!"})
    assert reuse.status_code == 400


def test_wrong_code_returns_400(client, db, sent):
    make_trader(db)
    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    real = code_from(sent[0][1])

    res = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": wrong_for(real)})
    assert res.status_code == 400
    assert res.json()["detail"] == "Code invalide ou expiré."


def test_lockout_returns_429_even_with_correct_code(client, db, sent):
    make_trader(db)
    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    real = code_from(sent[0][1])

    for _ in range(service.MAX_ATTEMPTS):
        res = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": wrong_for(real)})
        assert res.status_code == 400

    locked = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": real})
    assert locked.status_code == 429


def test_reset_with_garbage_token_returns_400(client, db):
    res = client.post("/api/auth/reset-password", json={"token": "x" * 40, "new_password": NEW_PASSWORD})
    assert res.status_code == 400


@pytest.mark.parametrize("code", ["1234", "123456", "abcde", ""])
def test_verify_reset_code_rejects_malformed_codes(client, db, code):
    res = client.post("/api/auth/verify-reset-code", json={"email": EMAIL, "code": code})
    assert res.status_code == 422


@pytest.mark.parametrize(
    "payload",
    [
        {"token": "x" * 30, "new_password": "short"},      # mot de passe trop court
        {"token": "court", "new_password": NEW_PASSWORD},  # jeton trop court
    ],
)
def test_reset_password_rejects_malformed_payload(client, db, payload):
    assert client.post("/api/auth/reset-password", json=payload).status_code == 422