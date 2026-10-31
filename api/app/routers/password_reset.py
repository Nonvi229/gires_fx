import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.email import send_email
from app.schemas.password_reset import (
    ForgotPasswordRequest,
    ResetPasswordRequest,
    ResetTokenResponse,
    VerifyResetCodeRequest,
)
from app.services import password_reset_service as service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Trader Fonctionnalités"])

FORGOT_MESSAGE = "Si un compte existe pour cet email, un code vient d'être envoyé."


def _safe_send(to: str, subject: str, body: str) -> None:
    """Tâche de fond : un échec d'envoi est journalisé, sans le corps du message (il contient le code)."""
    try:
        send_email(to, subject, body)
    except Exception:
        logger.exception("Échec d'envoi de l'email de réinitialisation")


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
            _safe_send, issued.email, "Réinitialisation de votre mot de passe", body
        )
    # Même réponse que l'email existe ou non
    return {"message": FORGOT_MESSAGE}


@router.post("/verify-reset-code", response_model=ResetTokenResponse)
def verify_reset_code(data: VerifyResetCodeRequest, db: Session = Depends(get_db)):
    """Étape 1 : vérifie le code à 5 chiffres et renvoie un jeton de 10 minutes."""
    try:
        token = service.verify_reset_code(db, data.email, data.code)
    except service.TooManyAttempts:
        raise HTTPException(status_code=429, detail="Trop de tentatives. Demandez un nouveau code.")
    except service.InvalidCode:
        raise HTTPException(status_code=400, detail="Code invalide ou expiré.")
    return {"token": token}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Étape 2 : change le mot de passe avec le jeton de l'étape 1."""
    try:
        service.reset_password(db, data.token, data.new_password)
    except service.InvalidResetToken:
        raise HTTPException(status_code=400, detail="Délai dépassé, recommencez la procédure.")
    return {"message": "Mot de passe mis à jour."}