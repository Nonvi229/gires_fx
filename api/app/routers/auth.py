from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import MessageOut, RegisterIn, VerifyEmailIn, ResendIn
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MessageOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    auth_service.register(db, data)
    return {"message": "Un code à 5 chiffres vous a été envoyé par email"}


@router.post("/verify-email", response_model=MessageOut)
def verify_email(data: VerifyEmailIn, db: Session = Depends(get_db)):
    auth_service.verify_email(db, data)
    return {"message": "Compte activé"}

@router.post("/resend-code", response_model=MessageOut)
def resend_code(data: ResendIn, db: Session = Depends(get_db)):
    auth_service.resend_code(db, data.email)
    return {"message": "Si ce compte existe, un nouveau code a été envoyé"}