from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# api/app/core/config.py  →  parents[2] = dossier api/
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR.parent / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    secret_key: str
    frontend_origin: str = "http://localhost:5173"
    code_expire_minutes: int = 3
    code_max_attempts: int = 3

    # SMTP (vide en développement : l'email s'affiche dans le terminal)
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@gires-fx.local"


settings = Settings()