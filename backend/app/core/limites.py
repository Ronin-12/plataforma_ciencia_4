"""Límites de uso: ventana deslizante en memoria y bloqueo de cuentas por intentos fallidos.

El limitador en memoria vive dentro de un solo proceso. Con varias instancias del servidor
(por ejemplo, escalado en Azure) hay que moverlo a Redis o a la base de datos.
El bloqueo por cuenta SÍ vive en PostgreSQL y funciona con varias instancias.
"""

import math
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

import asyncpg
from fastapi import HTTPException, Request

from app.core.config import settings


class LimitadorVentana:
    """Permite como máximo `maximo` eventos por `ventana_segundos` para cada clave."""

    def __init__(self, maximo: int, ventana_segundos: int) -> None:
        self.maximo = maximo
        self.ventana = ventana_segundos
        self._eventos: dict[str, deque[float]] = defaultdict(deque)

    def permitir(self, clave: str) -> bool:
        """Registra el evento y devuelve False si ya se superó el límite."""
        ahora = time.monotonic()
        cola = self._eventos[clave]
        while cola and ahora - cola[0] > self.ventana:
            cola.popleft()
        if len(cola) >= self.maximo:
            return False
        cola.append(ahora)
        if len(self._eventos) > 20_000:  # evita que la memoria crezca sin límite
            self._limpiar(ahora)
        return True

    def _limpiar(self, ahora: float) -> None:
        for clave in [k for k, c in self._eventos.items() if not c or ahora - c[-1] > self.ventana]:
            del self._eventos[clave]

    def reiniciar(self) -> None:
        self._eventos.clear()


def ip_cliente(request: Request) -> str:
    """IP del cliente. Detrás de un proxy hay que arrancar uvicorn con --proxy-headers."""
    return request.client.host if request.client else "desconocida"


def exigir(limitador: LimitadorVentana, clave: str, mensaje: str) -> None:
    """Lanza 429 si la clave superó el límite del limitador."""
    if not limitador.permitir(clave):
        raise HTTPException(
            status_code=429,
            detail=mensaje,
            headers={"Retry-After": str(limitador.ventana)},
        )


# --- Bloqueo por cuenta (guardado en PostgreSQL) ---------------------------------------------

_ID_POR_TABLA = {"docentes": "id_docente", "alumnos": "id_alumno"}


def segundos_de_bloqueo(fila: asyncpg.Record | None) -> int:
    """Segundos que faltan para que termine el bloqueo de la cuenta (0 si no está bloqueada)."""
    if fila is None or fila["bloqueado_hasta"] is None:
        return 0
    faltan = (fila["bloqueado_hasta"] - datetime.now(timezone.utc)).total_seconds()
    return math.ceil(faltan) if faltan > 0 else 0


def exigir_sin_bloqueo(fila: asyncpg.Record | None) -> None:
    """Lanza 429 si la cuenta sigue bloqueada."""
    faltan = segundos_de_bloqueo(fila)
    if faltan:
        raise HTTPException(
            status_code=429,
            detail=f"Demasiados intentos. Espera {math.ceil(faltan / 60)} min e inténtalo de nuevo.",
            headers={"Retry-After": str(faltan)},
        )


async def registrar_fallo(conn: asyncpg.Connection, tabla: str, id_cuenta) -> None:
    """Suma un intento fallido; al llegar al máximo bloquea la cuenta. Es atómico."""
    columna = _ID_POR_TABLA[tabla]  # solo tablas conocidas: nunca texto del usuario
    await conn.execute(
        f"""
        UPDATE {tabla}
           SET intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2
                                        THEN 0 ELSE intentos_fallidos + 1 END,
               bloqueado_hasta   = CASE WHEN intentos_fallidos + 1 >= $2
                                        THEN now() + make_interval(mins => $3)
                                        ELSE bloqueado_hasta END
         WHERE {columna} = $1
        """,
        id_cuenta,
        settings.LOGIN_MAX_INTENTOS,
        settings.LOGIN_BLOQUEO_MINUTOS,
    )


async def limpiar_fallos(conn: asyncpg.Connection, tabla: str, id_cuenta) -> None:
    """Pone en cero el contador tras un acceso correcto."""
    columna = _ID_POR_TABLA[tabla]
    await conn.execute(
        f"UPDATE {tabla} SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE {columna} = $1",
        id_cuenta,
    )
