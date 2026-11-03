from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import MessageOut, RegisterIn, VerifyEmailIn, ResendIn, LoginIn, MeOut, TokenOut, UpdateProfileIn, ChangePasswordIn
from app.services import auth_service
from app.core.dependencies import get_current_user
from app.models.trader import Trader


router = APIRouter(prefix="/auth", tags=["Trader Fonctionnalités"])


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=MessageOut)
def register(data: RegisterIn, db: Session = Depends(get_db)):
    auth_service.register(db, data)
    return {"message": "Si cette adresse peut être utilisée, un code vient d’être envoyé."}


@router.post("/verify-email", response_model=MessageOut)
def verify_email(data: VerifyEmailIn, db: Session = Depends(get_db)):
    auth_service.verify_email(db, data)
    return {"message": "Compte activé"}


@router.post("/resend-code", response_model=MessageOut)
def resend_code(data: ResendIn, db: Session = Depends(get_db)):
    auth_service.resend_code(db, data.email)
    return {"message": "Si ce compte existe, un nouveau code a été envoyé"}


@router.post("/login", response_model=TokenOut)
def login(data: LoginIn, db: Session = Depends(get_db)):
    return {"token": auth_service.login(db, data)}


@router.get("/me", response_model=MeOut)
def me(current: Trader = Depends(get_current_user)):
    return current


@router.patch("/me", response_model=MeOut)
def update_me(
    data: UpdateProfileIn,
    current: Trader = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return auth_service.update_profile(db, current, data)


@router.post("/change-password", response_model=TokenOut)
def change_password( data: ChangePasswordIn, current: Trader = Depends(get_current_user), db: Session = Depends(get_db), ):
    return {"token": auth_service.change_password(db, current, data)}