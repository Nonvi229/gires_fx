def send_verification_email(to: str, code: str) -> None:
    # DEV : affiche le code dans le terminal.
    # PROD : branche ici SMTP ou un service (Resend, SendGrid, Brevo...) et supprime ce print.
    print(f"[EMAIL] Code de vérification pour {to} : {code}")