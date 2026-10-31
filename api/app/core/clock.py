from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """Force UTC sur une date sans fuseau (SQLite, anciennes colonnes)."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)