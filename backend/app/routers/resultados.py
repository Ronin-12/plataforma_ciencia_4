"""Resultados de los alumnos al terminar un juego (RF-05)."""

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.deps import alumno_actual
from app.core.limites import LimitadorVentana, exigir
from app.db.session import get_db_pool

router = APIRouter(prefix="/resultados", tags=["Resultados"])

# Tope de resultados por alumno y hora: un juego dura minutos, así que esto nunca estorba a un
# niño de verdad y frena a quien intente llenar la base de basura.
_limite_resultados = LimitadorVentana(maximo=60, ventana_segundos=3600)


class ResultadoCreate(BaseModel):
    id_juego: uuid.UUID
    # Porcentaje de aciertos (0 a 100). Lo calcula el juego en el navegador del alumno:
    # sirve para seguimiento pedagógico, no para evaluaciones con consecuencias.
    puntuacion_final: int = Field(ge=0, le=100)
    tiempo_resolucion: int = Field(ge=0, le=7200)  # segundos


def puntos_de(mejor_porcentaje: int) -> int:
    """Un juego perfecto vale 10 puntos: se redondea el mejor porcentaje a la decena más cercana."""
    return (mejor_porcentaje + 5) // 10


@router.post("/", status_code=status.HTTP_201_CREATED)
async def guardar_resultado(
    datos: ResultadoCreate,
    alumno: dict = Depends(alumno_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Guarda un intento. El alumno sale del token; el número de intento lo calcula el servidor."""
    exigir(_limite_resultados, str(alumno["id"]), "Estás enviando resultados muy rápido. Espera un momento.")

    async with pool.acquire() as conn:
        # Solo se pueden registrar resultados de juegos del propio docente del alumno.
        existe = await conn.fetchval(
            "SELECT 1 FROM juegos_generados WHERE id_juego = $1 AND id_docente = $2",
            datos.id_juego,
            alumno["id_docente"],
        )
        if not existe:
            raise HTTPException(status_code=404, detail="Ese juego no existe.")

        # Si dos envíos simultáneos calculan el mismo número de intento, el índice único
        # rechaza uno y se reintenta con el número siguiente.
        for _ in range(5):
            try:
                fila = await conn.fetchrow(
                    """
                    INSERT INTO registro_avances
                        (id_alumno, id_juego, puntuacion_final, tiempo_resolucion, numero_intento)
                    VALUES ($1, $2, $3, $4,
                            (SELECT COALESCE(MAX(numero_intento), 0) + 1
                               FROM registro_avances
                              WHERE id_alumno = $1 AND id_juego = $2))
                    RETURNING id_registro, numero_intento, puntuacion_final, tiempo_resolucion
                    """,
                    alumno["id"],
                    datos.id_juego,
                    datos.puntuacion_final,
                    datos.tiempo_resolucion,
                )
                return dict(fila)
            except asyncpg.UniqueViolationError:
                continue

    raise HTTPException(status_code=503, detail="No se pudo guardar tu resultado. Inténtalo de nuevo.")


@router.get("/mios")
async def mis_resultados(
    alumno: dict = Depends(alumno_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Puntos del alumno: suma, por juego, de su mejor intento (repetir un juego no infla los puntos)."""
    async with pool.acquire() as conn:
        filas = await conn.fetch(
            """
            SELECT id_juego, MAX(puntuacion_final) AS mejor, COUNT(*) AS intentos
              FROM registro_avances
             WHERE id_alumno = $1 AND id_juego IS NOT NULL
             GROUP BY id_juego
            """,
            alumno["id"],
        )
    por_juego = [
        {"id_juego": str(f["id_juego"]), "mejor": f["mejor"], "intentos": f["intentos"]} for f in filas
    ]
    return {
        "puntos_totales": sum(puntos_de(f["mejor"]) for f in filas),
        "juegos_jugados": len(filas),
        "por_juego": por_juego,
    }
