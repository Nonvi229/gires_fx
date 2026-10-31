import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token, reset_token_matches
from app.models.trader import Trader

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Trader:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Session invalide ou expirée",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized

    payload = decode_access_token(creds.credentials)
    if payload is None:
        raise unauthorized

    try:
        user_id = uuid.UUID(payload["sub"])
    except (ValueError, TypeError):
        raise unauthorized

    trader = db.get(Trader, user_id)
    if trader is None or not trader.is_verified or not reset_token_matches(payload, trader.password_hash):
        raise unauthorized
    return trader