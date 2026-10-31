import logging
import re

import pytest
from fastapi.testclient import TestClient

from app.core.security import hash_password
from app.main import app
from app.models.trader import Trader

EMAIL = "alice@example.com"
LOGGER = "app.routers.password_reset"


@pytest.fixture
def trader(db):
    t = Trader(email=EMAIL, name="Alice", surname="Martin",
               password_hash=hash_password("MotDePasse123"), is_verified=True)
    db.add(t)
    db.commit()
    return t


def forgot(email=EMAIL):
    # raise_server_exceptions=False : une erreur serveur deviendrait un 500, pas une exception de test
    return TestClient(app, raise_server_exceptions=False).post(
        "/api/auth/forgot-password", json={"email": email}
    )


def test_email_is_sent_to_the_account_with_a_five_digit_code(trader, monkeypatch):
    sent = []
    monkeypatch.setattr(LOGGER + ".send_email", lambda to, subject, body: sent.append((to, subject, body)))
    assert forgot().status_code == 200
    (to, subject, body), = sent
    assert to == EMAIL
    assert "Réinitialisation" in subject
    assert re.search(r"\b\d{5}\b", body)


def test_no_email_is_sent_for_unknown_address(db, monkeypatch):
    sent = []
    monkeypatch.setattr(LOGGER + ".send_email", lambda *a: sent.append(a))
    assert forgot("nobody@example.com").status_code == 200
    assert sent == []


def test_sending_failure_still_answers_200_and_is_logged(trader, monkeypatch, caplog):
    def failing_send(to, subject, body):
        raise OSError("SMTP injoignable")

    monkeypatch.setattr(LOGGER + ".send_email", failing_send)
    with caplog.at_level(logging.ERROR, logger=LOGGER):
        r = forgot()
    assert r.status_code == 200
    assert "Échec d'envoi de l'email de réinitialisation" in caplog.text
    assert "SMTP injoignable" in caplog.text            # la cause est dans la trace


def test_sending_failure_does_not_log_the_code(trader, monkeypatch, caplog):
    bodies = []

    def failing_send(to, subject, body):
        bodies.append(body)
        raise OSError("SMTP injoignable")

    monkeypatch.setattr(LOGGER + ".send_email", failing_send)
    with caplog.at_level(logging.DEBUG):
        forgot()
    code = re.search(r"\b\d{5}\b", bodies[0]).group()
    assert code not in caplog.text


def test_forgot_password_does_not_print_the_code(trader, monkeypatch, capsys):
    bodies = []
    monkeypatch.setattr(LOGGER + ".send_email", lambda to, subject, body: bodies.append(body))
    forgot()
    code = re.search(r"\b\d{5}\b", bodies[0]).group()
    captured = capsys.readouterr()
    assert code not in captured.out
    assert code not in captured.err