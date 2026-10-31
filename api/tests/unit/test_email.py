import logging
from unittest.mock import MagicMock

import pytest

from app.core import email as email_module
from app.services.email_service import send_already_registered_email, send_verification_email


@pytest.fixture
def smtp_cls(monkeypatch):
    cls = MagicMock()
    monkeypatch.setattr(email_module.smtplib, "SMTP", cls)
    return cls


def configure(monkeypatch, **values):
    defaults = dict(smtp_host="smtp.test", smtp_port=2525, smtp_user="user",
                    smtp_password="secret", smtp_from="no-reply@test.local")
    defaults.update(values)
    for name, value in defaults.items():
        monkeypatch.setattr(email_module.settings, name, value)


def test_without_smtp_host_message_is_logged_not_sent(monkeypatch, smtp_cls, caplog):
    configure(monkeypatch, smtp_host="")
    with caplog.at_level(logging.WARNING, logger="app.core.email"):
        email_module.send_email("a@b.c", "Sujet", "Votre code : 12345")
    smtp_cls.assert_not_called()
    assert "Votre code : 12345" in caplog.text
    assert "a@b.c" in caplog.text


def test_with_smtp_host_message_is_sent(monkeypatch, smtp_cls):
    configure(monkeypatch)
    email_module.send_email("a@b.c", "Sujet", "Corps du message")

    smtp_cls.assert_called_once_with("smtp.test", 2525, timeout=10)
    smtp = smtp_cls.return_value.__enter__.return_value
    assert [c[0] for c in smtp.method_calls] == ["starttls", "login", "send_message"]
    smtp.login.assert_called_once_with("user", "secret")

    msg = smtp.send_message.call_args.args[0]
    assert msg["To"] == "a@b.c"
    assert msg["From"] == "no-reply@test.local"
    assert msg["Subject"] == "Sujet"
    assert "Corps du message" in msg.get_content()


def test_login_is_skipped_without_smtp_user(monkeypatch, smtp_cls):
    configure(monkeypatch, smtp_user="")
    email_module.send_email("a@b.c", "Sujet", "Corps")
    smtp = smtp_cls.return_value.__enter__.return_value
    smtp.login.assert_not_called()
    smtp.send_message.assert_called_once()


def test_smtp_failure_propagates_to_the_caller(monkeypatch, smtp_cls):
    configure(monkeypatch)
    smtp_cls.side_effect = OSError("connexion refusée")
    with pytest.raises(OSError):
        email_module.send_email("a@b.c", "Sujet", "Corps")


def test_verification_email_shows_recipient_and_code(capsys):
    send_verification_email("a@b.c", "12345")
    out = capsys.readouterr().out
    assert "a@b.c" in out and "12345" in out


def test_already_registered_email_shows_recipient(capsys):
    send_already_registered_email("a@b.c")
    assert "a@b.c" in capsys.readouterr().out