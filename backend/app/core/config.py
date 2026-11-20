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

    # --- IA ---
    # "gemini" (real) o "demo" (respuestas de ejemplo, sin clave ni créditos; para presentaciones).
    IA_PROVEEDOR: str = "gemini"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.8-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-3.6-flash"
    GEMINI_LAST_RESORT_MODEL: str = "gemini-3.5-flash-lite"
    # Velocidad: cuánto "piensa" el modelo antes de responder (nada, bajo, medio, alto o auto = lo decide
    # Google). Menos pensamiento = respuestas más rápidas y baratas; para juegos de primaria "bajo" basta.
    GEMINI_PENSAMIENTO: str = "bajo"
    # Segundos máximos que se espera a un modelo antes de probar el siguiente (con archivos se permite más).
    IA_TIMEOUT_SEGUNDOS: int = 45
    IA_TIMEOUT_ARCHIVOS_SEGUNDOS: int = 120
    # Días que se recuerda el análisis de un material ya subido (mismo archivo = respuesta al instante).
    IA_CACHE_DIAS: int = 30
    # Cada generación completada consume un crédito. Estos dos valores son los del plan Gratis;
    # los demás planes están en app/core/planes.py.
    IA_GENERACIONES_MENSUALES_MAX: int = 15
    IA_GENERACIONES_DIARIAS_MAX: int = 3
    # Precio del modelo en dólares por millón de tokens y tipo de cambio: solo sirven para ESTIMAR el
    # costo en el panel de administración. Revísalos en la página de precios de tu proveedor.
    IA_PRECIO_ENTRADA_USD_MTOK: float = 1.50
    IA_PRECIO_SALIDA_USD_MTOK: float = 7.50
    IA_TIPO_CAMBIO_MXN: float = 18.5

    # --- Publicación ---
    # Direcciones (separadas por comas) desde las que el navegador puede llamar a la API.
    CORS_ORIGENES: str = "http://localhost:5173,http://127.0.0.1:5173"
    # True solo si la API corre detrás de nginx en el mismo servidor: así la IP real del visitante
    # sale de la cabecera X-Real-IP. Con False se ignora (alguien podría falsificarla).
    CONFIAR_EN_PROXY: bool = False
    # Dirección pública de la página: se usa para armar el enlace de "recuperar contraseña".
    URL_FRONTEND: str = "http://localhost:5173"
    # Minutos que vale un enlace para recuperar la contraseña.
    RECUPERACION_MINUTOS: int = 30
    # Versión vigente del aviso de privacidad y los términos (cámbiala si los modificas).
    VERSION_TERMINOS: str = "2026-11"

    # --- Correo (recuperar contraseña) ---
    # Sin SMTP_HOST el enlace se escribe en la terminal del backend (útil en local, nunca en producción).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USUARIO: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_REMITENTE: str = ""

    @property
    def origenes_cors(self) -> list[str]:
        return [o.strip().rstrip("/") for o in self.CORS_ORIGENES.split(",") if o.strip()]

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
