"""
app/core/config.py
Application configuration via pydantic-settings.
All values are read from environment variables / .env file.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # ── Application ──────────────────────────────────────────────────────────
    APP_NAME: str = "EmotiTune API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/emotitune"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    # ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── ML ───────────────────────────────────────────────────────────────────
    EMOTION_MODEL_PATH: str = "./ml/models/emotitune_v3_best.pth"
    BERT_MODEL_NAME: str = "bert-base-uncased"
    EMOTION_CLASSES: str = "angry,disgust,fear,happy,neutral,sad,surprise"

    @property
    def emotion_class_list(self) -> List[str]:
        return [e.strip() for e in self.EMOTION_CLASSES.split(",")]

    # ── CORS ─────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://localhost:5173"

    @property
    def allowed_origins_list(self) -> List[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",")]

    # ── Sentry ───────────────────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── File Storage ─────────────────────────────────────────────────────────
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 10


@lru_cache()
def get_settings() -> Settings:
    """Cached settings singleton."""
    return Settings()


settings = get_settings()
