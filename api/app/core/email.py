import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(to: str, subject: str, body: str) -> None:
    """Envoie un email via SMTP.

    Sans SMTP configuré (développement), le message est affiché dans le terminal
    de l'API. À ne jamais laisser ainsi en production : le code y serait lisible.
    """
    if not settings.smtp_host:
        logger.warning("EMAIL NON ENVOYÉ (SMTP non configuré)\nÀ : %s\nSujet : %s\n%s", to, subject, body)
        return

    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)