"""
Punto de entrada del backend - Plataforma Ciencias Naturales 4.º grado.
Equipo Murciélago.
"""
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Carga las variables de entorno desde el archivo .env
load_dotenv()

# Metadata que aparece en la documentación automática (/docs)
app = FastAPI(
    title="Plataforma Ciencias Naturales 4.º grado",
    description="API del piloto educativo del Equipo Murciélago.",
    version="0.1.0",
)

# Orígenes permitidos para llamar a la API desde el navegador.
# Se listan explícitamente (nunca "*") por seguridad.
ORIGENES_PERMITIDOS = [
    "http://localhost:5173",   # Frontend React (Vite)
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/")
async def raiz() -> dict:
    """Endpoint raíz: confirma que la API está arriba."""
    return {"status": "ok", "proyecto": "Murciélago"}


@app.get("/health")
async def health() -> dict:
    """Estado del sistema. Más adelante se añadirá la verificación de la BD."""
    return {
        "status": "ok",
        "servicio": "murcielago-backend",
        "version": app.version,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "base_de_datos": "pendiente de configurar",
    }