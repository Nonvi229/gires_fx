from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.email import send_email
from app.core.database import get_db  # adaptez si votre get_db est ailleurs
from app.schemas.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.services import password_reset_service as service

router = APIRouter(prefix="/auth", tags=["Trader Fonctionnalités"])

FORGOT_MESSAGE = "Si un compte existe pour cet email, un code vient d'être envoyé."


@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest, background: BackgroundTasks, db: Session = Depends(get_db)):
    issued = service.request_reset(db, data.email)
    if issued is not None:
        body = (
            f"Votre code de réinitialisation GIRES FX : {issued.code}\n\n"
            f"Il expire dans {service.CODE_TTL_MINUTES} minutes.\n"
            "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message."
        )
        background.add_task(
            send_email, issued.email, "Réinitialisation de votre mot de passe", body
        )
    # Même réponse que l'email existe ou non
    return {"message": FORGOT_MESSAGE}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    try:
        service.reset_password(db, data.email, data.code, data.new_password)
    except service.TooManyAttempts:
        raise HTTPException(
            status_code=429, detail="Trop de tentatives. Demandez un nouveau code."
        )
    except service.InvalidCode:
        raise HTTPException(status_code=400, detail="Code invalide ou expiré.")
    return {"message": "Mot de passe mis à jour."}
