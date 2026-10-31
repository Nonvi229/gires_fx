def send_verification_email(to: str, code: str) -> None:
    # DEV : affiche le code dans le terminal.
    # PROD : branche ici SMTP ou un service (Resend, SendGrid, Brevo...) et supprime ce print.
    print(f"[EMAIL] Code de vérification pour {to} : {code}")

def send_already_registered_email(to: str) -> None:
    # DEV : affichage dans le terminal.
    # PROD : « Vous avez déjà un compte GIRES FX. Connectez-vous, ou réinitialisez
    # votre mot de passe si vous l'avez oublié », avec les liens /login et /forgot-password.
    print(f"[EMAIL] {to} a déjà un compte : rappel connexion / mot de passe oublié")