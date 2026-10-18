"""
Configuración centralizada del backend.
Lee las variables de entorno desde el archivo .env.
"""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuración global del proyecto."""

    # --- Base de datos ---
    DATABASE_URL: str

    # --- Seguridad ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # --- IA (Gemini) ---
    GEMINI_API_KEY: str = ""

    # Configuración para que lea el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


# Instancia única que se importa desde todo el proyecto
settings = Settings()