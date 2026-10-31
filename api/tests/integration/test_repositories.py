import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app.core.clock import utcnow
from app.core.database import SessionLocal
from app.models.trader import Trader
from app.models.verification_code import CodePurpose, VerificationCode
from app.repositories.trader_repository import TraderRepository
from app.repositories.verification_code_repository import VerificationCodeRepository

PURPOSE = CodePurpose.PASSWORD_RESET
COOLDOWN = timedelta(seconds=60)


@pytest.fixture
def trader(db):
    t = Trader(email="alice@example.com", name="Alice", surname="Martin",
               password_hash="hash", is_verified=True)
    db.add(t)
    db.commit()
    return t


def issue(repo, trader, *, code_hash="hash-1", now=None, cooldown=COOLDOWN, purpose=PURPOSE):
    now = now or utcnow()
    return repo.upsert_if_cooled_down(
        user_id=trader.id, purpose=purpose, code_hash=code_hash,
        expires_at=now + timedelta(minutes=3), now=now, cooldown=cooldown,
    )


def stored(db, repo, trader, purpose=PURPOSE):
    db.expire_all()
    return repo.get(trader.id, purpose)


def run_parallel(n, fn):
    """Exécute fn(session) dans n threads, chacun avec sa propre session, départ simultané."""
    barrier = threading.Barrier(n)

    def worker(_):
        with SessionLocal() as session:
            barrier.wait(timeout=10)
            return fn(session)

    with ThreadPoolExecutor(max_workers=n) as pool:
        return list(pool.map(worker, range(n)))


# ---------- TraderRepository ----------

def test_get_by_email_finds_trader(db, trader):
    assert TraderRepository(db).get_by_email("alice@example.com").id == trader.id


def test_get_by_email_returns_none_for_unknown(db):
    assert TraderRepository(db).get_by_email("nobody@example.com") is None


def test_create_flushes_without_committing(db):
    repo = TraderRepository(db)
    t = repo.create(email="bob@example.com", name="Bob", surname="Durand", password_hash="h")
    assert t.id is not None                      # id disponible grâce au flush
    assert t.is_verified is False
    db.rollback()                                # jamais commité : disparaît
    assert repo.get_by_email("bob@example.com") is None


# ---------- VerificationCodeRepository : émission ----------

def test_get_returns_none_without_code(db, trader):
    assert VerificationCodeRepository(db).get(trader.id, PURPOSE) is None


def test_upsert_creates_code(db, trader):
    repo = VerificationCodeRepository(db)
    assert issue(repo, trader, code_hash="abc") is True
    record = stored(db, repo, trader)
    assert record.code_hash == "abc"
    assert record.attempts == 0


def test_upsert_refused_before_cooldown(db, trader):
    repo = VerificationCodeRepository(db)
    t0 = utcnow()
    assert issue(repo, trader, code_hash="a", now=t0) is True
    assert issue(repo, trader, code_hash="b", now=t0 + timedelta(seconds=59)) is False
    assert stored(db, repo, trader).code_hash == "a"      # inchangé


def test_upsert_accepted_after_cooldown_and_resets_attempts(db, trader):
    repo = VerificationCodeRepository(db)
    t0 = utcnow()
    issue(repo, trader, code_hash="a", now=t0)
    record = stored(db, repo, trader)
    assert repo.reserve_attempt(record.id, 3) is True
    assert stored(db, repo, trader).attempts == 1

    assert issue(repo, trader, code_hash="b", now=t0 + timedelta(seconds=61)) is True
    record = stored(db, repo, trader)
    assert record.code_hash == "b"
    assert record.attempts == 0


def test_upsert_without_cooldown_always_replaces(db, trader):
    repo = VerificationCodeRepository(db)
    t0 = utcnow()
    assert issue(repo, trader, code_hash="a", now=t0, cooldown=None) is True
    assert issue(repo, trader, code_hash="b", now=t0, cooldown=None) is True
    assert stored(db, repo, trader).code_hash == "b"


def test_purposes_are_independent(db, trader):
    repo = VerificationCodeRepository(db)
    t0 = utcnow()
    assert issue(repo, trader, code_hash="reset", now=t0, purpose=CodePurpose.PASSWORD_RESET)
    assert issue(repo, trader, code_hash="email", now=t0, purpose=CodePurpose.EMAIL_VERIFICATION)
    assert stored(db, repo, trader, CodePurpose.PASSWORD_RESET).code_hash == "reset"
    assert stored(db, repo, trader, CodePurpose.EMAIL_VERIFICATION).code_hash == "email"


# ---------- VerificationCodeRepository : tentatives ----------

def test_reserve_attempt_stops_at_the_limit(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id
    assert [repo.reserve_attempt(code_id, 3) for _ in range(5)] == [True, True, True, False, False]
    assert stored(db, repo, trader).attempts == 3


def test_reserve_attempt_on_unknown_code_returns_false(db):
    assert VerificationCodeRepository(db).reserve_attempt(uuid4(), 3) is False


def test_reserve_attempt_is_committed(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id
    repo.reserve_attempt(code_id, 3)
    with SessionLocal() as other:                # autre connexion : voit la tentative
        assert other.scalar(
            select(VerificationCode.attempts).where(VerificationCode.id == code_id)
        ) == 1


# ---------- VerificationCodeRepository : consommation ----------

def test_consume_works_once(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id
    assert repo.consume(code_id) is True
    assert repo.consume(code_id) is False
    db.commit()
    assert stored(db, repo, trader) is None


def test_consume_is_not_committed_by_the_repository(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id
    assert repo.consume(code_id) is True
    with SessionLocal() as other:                # pas encore validé : toujours visible
        assert other.get(VerificationCode, code_id) is not None
    db.rollback()                                # l'appelant annule : le code survit
    with SessionLocal() as other:
        assert other.get(VerificationCode, code_id) is not None


# ---------- concurrence ----------

def test_parallel_reserve_attempt_never_exceeds_the_limit(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id

    results = run_parallel(10, lambda s: VerificationCodeRepository(s).reserve_attempt(code_id, 3))

    assert sum(results) == 3
    assert stored(db, repo, trader).attempts == 3


def test_parallel_issue_respects_the_cooldown(db, trader):
    repo = VerificationCodeRepository(db)
    results = run_parallel(
        8, lambda s: issue(VerificationCodeRepository(s), trader, code_hash=uuid4().hex)
    )
    assert sum(results) == 1                     # un seul envoi passe
    db.expire_all()
    assert db.scalar(select(func.count()).select_from(VerificationCode)) == 1


def test_parallel_consume_succeeds_only_once(db, trader):
    repo = VerificationCodeRepository(db)
    issue(repo, trader)
    code_id = stored(db, repo, trader).id

    def consume(session):
        ok = VerificationCodeRepository(session).consume(code_id)
        session.commit()
        return ok

    assert sum(run_parallel(8, consume)) == 1
    assert stored(db, repo, trader) is None