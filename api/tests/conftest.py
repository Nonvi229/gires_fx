import os
from pathlib import Path

import pytest
from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import make_url
import re
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]  # racine du projet (là où est .env)


def _test_database_url() -> str:
    explicit = os.environ.get("TEST_DATABASE_URL")
    if explicit:
        return explicit
    dev_url = make_url(dotenv_values(ROOT / ".env")["DATABASE_URL"])
    return dev_url.set(database=f"{dev_url.database}_test").render_as_string(hide_password=False)


TEST_URL = _test_database_url()
assert make_url(TEST_URL).database.endswith("_test"), (
    "Sécurité : la base de test doit se terminer par _test"
)
# IMPORTANT : à fixer AVANT tout import de l'application
os.environ["DATABASE_URL"] = TEST_URL

from fastapi.testclient import TestClient  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.database import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def _schema():
    # Dernier garde-fou : ne jamais toucher à une base qui n'est pas _test
    assert engine.url.database.endswith("_test"), (
        f"Refus : la base '{engine.url.database}' n'est pas une base de test"
    )
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db(_schema):
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()
        with engine.begin() as conn:
            conn.execute(text("TRUNCATE verification_codes, traders CASCADE"))


@pytest.fixture
def client(_schema):
    return TestClient(app)

@pytest.fixture
def mailbox(monkeypatch):
    """Intercepte les emails : on lit les codes ici au lieu du terminal."""
    box = SimpleNamespace(verification=[], already=[], reset=[])
    monkeypatch.setattr(
        "app.services.auth_service.send_verification_email",
        lambda email, code: box.verification.append((email, code)),
    )
    monkeypatch.setattr(
        "app.services.auth_service.send_already_registered_email",
        lambda email: box.already.append(email),
    )
    monkeypatch.setattr(
        "app.routers.password_reset.send_email",
        lambda to, subject, body: box.reset.append((to, re.search(r"\b\d{5}\b", body).group())),
    )
    return box