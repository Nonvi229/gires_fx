from datetime import datetime, timezone

from app.core.clock import as_utc, utcnow


def test_utcnow_is_timezone_aware():
    assert utcnow().tzinfo is not None
    assert utcnow().utcoffset().total_seconds() == 0


def test_as_utc_adds_utc_to_naive_dates():
    naive = datetime(2026, 10, 31, 12, 0)
    assert as_utc(naive) == datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)


def test_as_utc_keeps_aware_dates():
    aware = datetime(2026, 10, 31, 12, 0, tzinfo=timezone.utc)
    assert as_utc(aware) is aware