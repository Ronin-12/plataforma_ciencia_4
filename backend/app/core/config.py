"""
Configuración centralizada del backend.
Lee las variables de entorno desde el archivo .env.
"""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Claves que estuvieron publicadas en el repositorio: nunca son válidas.
CLAVES_PUBLICAS = {
    "hdLBya7i49bGuozLa5jjWVG-WylvTewNSsSGuoKm09UTN6sWfnIkHxZ3mkxpBbsKy3b2dM8SAGdAIQJBgDAbww",
}


class Settings(BaseSettings):
    """Configuración global del proyecto."""

    # --- Base de datos ---
    DATABASE_URL: str

    # --- Seguridad ---
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30  # sesión de docente
    ALUMNO_TOKEN_MINUTES: int = 120  # sesión de alumno (una clase)

    # Quien no tenga este código no puede crear cuentas de docente.
    # Vacío = el registro de docentes queda deshabilitado.
    CODIGO_INVITACION_DOCENTES: str = ""

    # Bloqueo temporal de una cuenta tras demasiados intentos fallidos seguidos.
    LOGIN_MAX_INTENTOS: int = 5
    LOGIN_BLOQUEO_MINUTOS: int = 5

    # Tope de juegos que un docente puede generar con IA por hora (control de costo).
    IA_MAX_JUEGOS_POR_HORA: int = 20

    # --- IA (Gemini) ---
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.6-flash"
    GEMINI_LAST_RESORT_MODEL: str = "gemini-3.5-flash-lite"

    # Configuración para que lea el archivo .env
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("SECRET_KEY")
    @classmethod
    def _clave_robusta(cls, valor: str) -> str:
        valor = valor.strip()
        if len(valor) < 32 or valor in CLAVES_PUBLICAS or valor.upper().startswith("CAMBIA"):
            raise ValueError(
                "SECRET_KEY es débil o es una clave que ya se publicó. Genera una nueva con: "
                'python -c "import secrets; print(secrets.token_urlsafe(64))" '
                "y pégala en backend/.env"
            )
        return valor

    @field_validator("CODIGO_INVITACION_DOCENTES")
    @classmethod
    def _invitacion(cls, valor: str) -> str:
        valor = valor.strip()
        if valor and (len(valor) < 8 or valor.upper().startswith("CAMBIA")):
            raise ValueError("CODIGO_INVITACION_DOCENTES debe tener al menos 8 caracteres (o dejarse vacío).")
        return valor


# Instancia única que se importa desde todo el proyecto
settings = Settings()
