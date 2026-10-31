import pytest
from pydantic import ValidationError

from app.core.config import Settings

ENV_NAMES = [
    "DATABASE_URL", "SECRET_KEY", "FRONTEND_ORIGIN", "CODE_EXPIRE_MINUTES",
    "CODE_MAX_ATTEMPTS", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD",
    "SMTP_FROM", "JWT_ALGORITHM",
]

REQUIRED = {"database_url": "postgresql://x/y", "secret_key": "k" * 40}


@pytest.fixture
def clean_env(monkeypatch):
    """Retire les variables d'environnement (monkeypatch les restaure ensuite)."""
    for name in ENV_NAMES:
        monkeypatch.delenv(name, raising=False)


def make(**values):
    # _env_file=None : on ignore les fichiers .env réels
    return Settings(_env_file=None, **{**REQUIRED, **values})


def test_defaults(clean_env):
    s = make()
    assert s.frontend_origin == "http://localhost:5173"
    assert s.code_expire_minutes == 3
    assert s.code_max_attempts == 3
    assert s.smtp_host == ""
    assert s.smtp_port == 587
    assert s.smtp_user == ""
    assert s.smtp_password == ""
    assert s.smtp_from == "no-reply@gires-fx.local"
    assert s.jwt_algorithm == "HS256"


@pytest.mark.parametrize("missing", ["database_url", "secret_key"])
def test_required_settings_are_enforced(clean_env, missing):
    values = dict(REQUIRED)
    values.pop(missing)
    with pytest.raises(ValidationError):
        Settings(_env_file=None, **values)


def test_environment_variables_override_defaults(clean_env, monkeypatch):
    monkeypatch.setenv("CODE_EXPIRE_MINUTES", "7")
    monkeypatch.setenv("SMTP_PORT", "2525")
    monkeypatch.setenv("FRONTEND_ORIGIN", "https://app.example.com")
    s = make()
    assert s.code_expire_minutes == 7
    assert s.smtp_port == 2525
    assert s.frontend_origin == "https://app.example.com"


def test_invalid_number_is_rejected(clean_env, monkeypatch):
    monkeypatch.setenv("CODE_MAX_ATTEMPTS", "beaucoup")
    with pytest.raises(ValidationError):
        make()


def test_unknown_variables_are_ignored(clean_env, monkeypatch):
    monkeypatch.setenv("VARIABLE_INCONNUE", "x")
    make()  # `extra="ignore"` : pas d'erreur

def test_secret_key_must_be_at_least_32_characters(clean_env):
    with pytest.raises(ValidationError):
        make(secret_key="k" * 31)
    assert make(secret_key="k" * 32).secret_key == "k" * 32


@pytest.mark.parametrize("value", [0, -1])
def test_code_max_attempts_must_be_positive(clean_env, value):
    with pytest.raises(ValidationError):
        make(code_max_attempts=value)


@pytest.mark.parametrize("value", [0, -5])
def test_code_expire_minutes_must_be_positive(clean_env, value):
    with pytest.raises(ValidationError):
        make(code_expire_minutes=value)


def test_minimum_valid_values_are_accepted(clean_env):
    s = make(code_max_attempts=1, code_expire_minutes=1)
    assert (s.code_max_attempts, s.code_expire_minutes) == (1, 1)