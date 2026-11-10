"""Punto de entrada de la API de la Plataforma de Ciencias Naturales."""

import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
# ... (otros imports)
from app.routers import docentes, alumnos, ia, metricas, resultados
# Carga .env antes de importar módulos que construyen Settings.
load_dotenv()

# Los avisos de la app (logger "murcielago") salen en la misma terminal que Uvicorn.
logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

from app.core.errores import capturar_errores  # noqa: E402
from app.db.session import close_db_pool, get_db_pool, init_db_pool  # noqa: E402


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Abre el pool al iniciar y lo cierra al apagar la API."""
    print("Iniciando servidor...")
    await init_db_pool()
    try:
        yield
    finally:
        await close_db_pool()
        print("Servidor apagado.")


app = FastAPI(
    title="Plataforma Ciencias Naturales 4.º grado",
    description="API del piloto educativo del Equipo Murciélago.",
    version="0.1.0",
    lifespan=lifespan,
)

ORIGENES_PERMITIDOS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

# El orden importa: el último middleware que se agrega queda por fuera. Este va antes que
# CORS para que el 500 que devuelve también lleve las cabeceras CORS (ver core/errores.py).
app.middleware("http")(capturar_errores)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
# Registrar las rutas (routers)
app.include_router(docentes.router)
app.include_router(alumnos.router)
app.include_router(ia.router)
app.include_router(resultados.router)
app.include_router(metricas.router)

@app.get("/")
async def raiz() -> dict[str, str]:
    """Confirma que la API está disponible."""
    return {"status": "ok", "proyecto": "Murciélago"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Comprueba la API y ejecuta una consulta real a PostgreSQL."""
    try:
        async with get_db_pool().acquire() as connection:
            await connection.fetchval("SELECT 1")
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="La base de datos no está disponible",
        ) from exc

    return {
        "status": "ok",
        "servicio": "murcielago-backend",
        "version": app.version,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "base_de_datos": "conectada",
    }
