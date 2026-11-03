import pytest

from app.core.security import create_access_token, hash_password, verify_password
from app.repositories.trader_repository import TraderRepository

API = "/api"  # préfixe sous lequel main.py monte les routeurs (le front appelle /api/auth/...)
PASSWORD = "ancien-mdp-123"
NEW_PASSWORD = "nouveau-mdp-456"


@pytest.fixture
def trader(db):
    t = TraderRepository(db).create(
        email="awa@exemple.com", name="Awa", surname="Dossou",
        password_hash=hash_password(PASSWORD),
    )
    t.is_verified = True
    db.commit()
    return t


def bearer(trader) -> dict:
    token = create_access_token(str(trader.id), trader.password_hash)
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------- PATCH /auth/me

def test_update_profile_ok(client, db, trader):
    r = client.patch(
        f"{API}/auth/me",
        json={"name": "  Marc ", "surname": " Kpadonou "},
        headers=bearer(trader),
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["name"], body["surname"], body["email"]) == ("Marc", "Kpadonou", "awa@exemple.com")

    db.refresh(trader)
    assert (trader.name, trader.surname) == ("Marc", "Kpadonou")

    again = client.get(f"{API}/auth/me", headers=bearer(trader))
    assert again.json()["name"] == "Marc"


def test_update_profile_requires_auth(client):
    payload = {"name": "Marc", "surname": "Kpadonou"}
    assert client.patch(f"{API}/auth/me", json=payload).status_code == 401
    bad = {"Authorization": "Bearer jeton-invalide"}
    assert client.patch(f"{API}/auth/me", json=payload, headers=bad).status_code == 401


@pytest.mark.parametrize("payload", [
    {"name": "", "surname": "Dossou"},
    {"name": "   ", "surname": "Dossou"},
    {"name": "A", "surname": "Dossou"},
    {"name": "Awa", "surname": "D"},
    {"name": "x" * 101, "surname": "Dossou"},
    {"name": "Awa"},
    {},
])
def test_update_profile_rejects_invalid(client, db, trader, payload):
    r = client.patch(f"{API}/auth/me", json=payload, headers=bearer(trader))
    assert r.status_code == 422
    db.refresh(trader)
    assert (trader.name, trader.surname) == ("Awa", "Dossou")


def test_update_profile_cannot_change_email_or_status(client, db, trader):
    r = client.patch(
        f"{API}/auth/me",
        json={"name": "Marc", "surname": "Kpadonou", "email": "pirate@exemple.com", "is_verified": False},
        headers=bearer(trader),
    )
    assert r.status_code == 200
    assert r.json()["email"] == "awa@exemple.com"
    db.refresh(trader)
    assert trader.email == "awa@exemple.com"
    assert trader.is_verified is True


# ------------------------------------------------------ POST /auth/change-password

def _change(client, trader, current=PASSWORD, new=NEW_PASSWORD, headers=None):
    return client.post(
        f"{API}/auth/change-password",
        json={"current_password": current, "new_password": new},
        headers=headers if headers is not None else bearer(trader),
    )


def test_change_password_ok_stores_a_new_hash(client, db, trader):
    r = _change(client, trader)
    assert r.status_code == 200
    assert r.json()["token"]

    db.refresh(trader)
    assert verify_password(NEW_PASSWORD, trader.password_hash)
    assert not verify_password(PASSWORD, trader.password_hash)
    assert NEW_PASSWORD not in trader.password_hash  # jamais en clair


def test_change_password_returns_a_working_token(client, trader):
    token = _change(client, trader).json()["token"]
    r = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert r.json()["email"] == "awa@exemple.com"


def test_change_password_invalidates_the_old_token(client, trader):
    old = bearer(trader)
    assert client.get(f"{API}/auth/me", headers=old).status_code == 200
    _change(client, trader, headers=old)
    assert client.get(f"{API}/auth/me", headers=old).status_code == 401


def test_login_after_change(client, trader):
    _change(client, trader)
    ok = client.post(f"{API}/auth/login", json={"email": "awa@exemple.com", "password": NEW_PASSWORD})
    assert ok.status_code == 200 and ok.json()["token"]
    ko = client.post(f"{API}/auth/login", json={"email": "awa@exemple.com", "password": PASSWORD})
    assert ko.status_code == 401


def test_change_password_wrong_current(client, db, trader):
    r = _change(client, trader, current="mauvais-mdp-000")
    assert r.status_code == 400  # 400 et non 401 : un 401 voudrait dire « jeton invalide »
    assert "actuel incorrect" in r.json()["detail"]
    db.refresh(trader)
    assert verify_password(PASSWORD, trader.password_hash)  # rien n'a changé


def test_change_password_same_as_current(client, db, trader):
    r = _change(client, trader, new=PASSWORD)
    assert r.status_code == 400
    assert "différent" in r.json()["detail"]
    db.refresh(trader)
    assert verify_password(PASSWORD, trader.password_hash)


@pytest.mark.parametrize("payload", [
    {"current_password": PASSWORD, "new_password": "court"},
    {"current_password": PASSWORD, "new_password": "x" * 129},
    {"current_password": "", "new_password": NEW_PASSWORD},
    {"new_password": NEW_PASSWORD},
    {"current_password": PASSWORD},
])
def test_change_password_rejects_invalid(client, db, trader, payload):
    r = client.post(f"{API}/auth/change-password", json=payload, headers=bearer(trader))
    assert r.status_code == 422
    db.refresh(trader)
    assert verify_password(PASSWORD, trader.password_hash)


def test_change_password_requires_auth(client):
    r = client.post(
        f"{API}/auth/change-password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
    )
    assert r.status_code == 401

def test_get_me_still_works(client, trader):
    r = client.get(f"{API}/auth/me", headers=bearer(trader))
    assert r.status_code == 200
    assert r.json()["email"] == "awa@exemple.com"