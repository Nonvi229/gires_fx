import logging
from datetime import datetime, timezone
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from app.core.config import settings
from app.core.database import engine as test_engine

INI = Path(__file__).resolve().parents[2] / "alembic.ini"
INITIAL = "eec2f56eaa2a"
TZ_AWARE = "d99f76dff98f"

# Nom dérivé de la base de test : ..._test -> ..._migrations_test
BASE_DB = test_engine.url.database
MIG_DB = BASE_DB[: -len("_test")] + "_migrations_test"


@pytest.fixture(autouse=True)
def keep_logging_intact():
    """env.py appelle fileConfig() : on restaure les loggers pour ne pas casser caplog ailleurs."""
    root = logging.getLogger()
    handlers, level = root.handlers[:], root.level
    states = {
        name: (lg.disabled, lg.level)
        for name, lg in logging.root.manager.loggerDict.items()
        if isinstance(lg, logging.Logger)
    }
    yield
    root.handlers[:] = handlers
    root.setLevel(level)
    for name, lg in logging.root.manager.loggerDict.items():
        if isinstance(lg, logging.Logger):
            lg.disabled, lg.level = states.get(name, (False, lg.level))


@pytest.fixture
def mig(monkeypatch):
    """Base PostgreSQL vide et dédiée aux migrations, créée puis supprimée pour chaque test."""
    assert MIG_DB.endswith("_test") and MIG_DB != BASE_DB, "Refus : nom de base de migration invalide"

    admin = create_engine(test_engine.url, isolation_level="AUTOCOMMIT")
    quoted = admin.dialect.identifier_preparer.quote(MIG_DB)

    def drop():
        with admin.connect() as c:
            c.execute(text(f"DROP DATABASE IF EXISTS {quoted} WITH (FORCE)"))  # PostgreSQL >= 13

    drop()
    with admin.connect() as c:
        c.execute(text(f"CREATE DATABASE {quoted}"))

    url = test_engine.url.set(database=MIG_DB)
    # env.py lit settings.database_url : on le redirige vers la base de migration
    monkeypatch.setattr(settings, "database_url", url.render_as_string(hide_password=False))

    engine = create_engine(url)
    engine.admin, engine.quoted = admin, quoted      # pour les tests qui règlent le fuseau
    try:
        yield engine
    finally:
        engine.dispose()
        drop()
        admin.dispose()


def cfg() -> Config:
    return Config(str(INI))


def tables(engine):
    return set(inspect(engine).get_table_names())


def current_revision(engine):
    with engine.connect() as c:
        return c.execute(text("SELECT version_num FROM alembic_version")).scalar()


def test_upgrade_head_creates_the_schema(mig):
    command.upgrade(cfg(), "head")
    assert {"traders", "verification_codes"} <= tables(mig)
    head = ScriptDirectory.from_config(cfg()).get_current_head()
    assert current_revision(mig) == head == TZ_AWARE


def test_downgrade_base_then_upgrade_again(mig):
    command.upgrade(cfg(), "head")
    command.downgrade(cfg(), "base")
    assert tables(mig) <= {"alembic_version"}
    command.upgrade(cfg(), "head")                   # échoue si le downgrade laisse des restes (ex. type enum)
    assert {"traders", "verification_codes"} <= tables(mig)


def test_models_match_migrations(mig):
    """Aucune dérive : alembic check lève une erreur si un autogenerate produirait des changements."""
    command.upgrade(cfg(), "head")
    command.check(cfg())


@pytest.mark.parametrize("server_tz", ["UTC", "Asia/Tokyo"])
def test_timezone_migration_keeps_existing_instants(mig, server_tz):
    """Les anciennes dates (sans fuseau) sont réputées UTC, quel que soit le fuseau du serveur."""
    with mig.admin.connect() as c:
        c.execute(text(f"ALTER DATABASE {mig.quoted} SET timezone TO '{server_tz}'"))

    command.upgrade(cfg(), INITIAL)
    with mig.begin() as c:
        c.execute(text(
            "INSERT INTO traders (id, email, name, surname, password_hash, is_verified, created_at) "
            "VALUES (CAST(:id AS uuid), 'old@example.com', 'Old', 'User', 'h', true, '2026-01-15 10:00:00')"
        ), {"id": "11111111-1111-1111-1111-111111111111"})
        c.execute(text(
            "INSERT INTO verification_codes (id, user_id, purpose, code_hash, expires_at, attempts, created_at) "
            "VALUES (CAST(:id AS uuid), CAST(:uid AS uuid), CAST('PASSWORD_RESET' AS code_purpose), "
            "'h', '2026-01-15 10:03:00+00', 0, '2026-01-15 10:00:00')"
        ), {"id": "22222222-2222-2222-2222-222222222222",
            "uid": "11111111-1111-1111-1111-111111111111"})

    command.upgrade(cfg(), "head")

    expected = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
    with mig.connect() as c:
        trader_dt = c.execute(text("SELECT created_at FROM traders")).scalar()
        code_dt = c.execute(text("SELECT created_at FROM verification_codes")).scalar()
    assert trader_dt == expected
    assert code_dt == expected

    columns = {t: {col["name"]: col for col in inspect(mig).get_columns(t)}
               for t in ("traders", "verification_codes")}
    assert columns["traders"]["created_at"]["type"].timezone is True
    assert columns["verification_codes"]["created_at"]["type"].timezone is True