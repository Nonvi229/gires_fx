from pathlib import Path
from pydantic import Field
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
    frontend_origin: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "no-reply@gires-fx.local"
    jwt_algorithm: str = "HS256"
    secret_key: str = Field(min_length=32)
    code_max_attempts: int = Field(default=3, ge=1)
    code_expire_minutes: int = Field(default=3, ge=1)


settings = Settings()