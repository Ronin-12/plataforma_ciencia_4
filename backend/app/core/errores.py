"""Respuesta uniforme para los errores que ninguna ruta manejó.

Sin esto, FastAPI responde el 500 desde su capa más externa, que queda FUERA de
CORSMiddleware: la respuesta sale sin cabeceras CORS, el navegador la bloquea y el
panel muestra "No se pudo conectar con el servidor" aunque la API sí esté encendida.
Este middleware se registra ANTES que CORS en main.py, así queda por dentro de él y
su respuesta JSON sí lleva las cabeceras.
"""

import logging

import asyncpg
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger("murcielago")

MENSAJE_500 = "Error del servidor. Inténtalo de nuevo en un momento."


def _parece_migracion_faltante(exc: BaseException) -> bool:
    """Una tabla o columna que no existe casi siempre es una migración sin aplicar."""
    errores = (asyncpg.UndefinedTableError, asyncpg.UndefinedColumnError)
    return isinstance(exc, errores) or isinstance(exc.__cause__, errores)


async def capturar_errores(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        logger.exception("Error sin manejar en %s %s", request.method, request.url.path)
        if _parece_migracion_faltante(exc):
            logger.error("Parece que falta una migración: revisa el aviso que aparece al arrancar.")
        return JSONResponse(status_code=500, content={"detail": MENSAJE_500})
