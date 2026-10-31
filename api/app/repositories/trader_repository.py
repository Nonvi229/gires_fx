from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.trader import Trader


class TraderRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_by_email(self, email: str) -> Trader | None:
        return self.db.scalar(select(Trader).where(Trader.email == email))

    def create(self, **data) -> Trader:
        trader = Trader(**data)
        self.db.add(trader)
        self.db.flush()  # obtient l'id sans valider la transaction
        return trader