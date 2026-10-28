from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# racine du projet : api/app/core/config.py -> parents[3]
ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    database_url: str

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()
