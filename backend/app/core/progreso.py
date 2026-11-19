"""Carga de la base el progreso de UN alumno (base de las insignias y del reporte familiar)."""

import logging
import uuid

import asyncpg

from app.core.logros import Actividad, Progreso, calcular_logros
from app.routers.metricas import ZONA_ESCUELA

logger = logging.getLogger("uvicorn.error")


async def cargar_progreso(conn: asyncpg.Connection, id_alumno: uuid.UUID, id_docente: uuid.UUID) -> Progreso:
    """Actividades APROBADAS del docente y lo que el alumno hizo en cada una.

    Solo se cuentan actividades aprobadas (las que el alumno puede ver): una actividad retirada o
    descartada después no cuenta como pendiente ni como realizada. El día de cada intento se
    pasa a la hora de la escuela, igual que en las métricas del docente.
    """
    filas = await conn.fetch(
        """
        SELECT j.id_juego,
               j.contenido_juego ->> 'titulo'         AS titulo,
               j.contenido_juego ->> 'tipo_actividad' AS tipo,
               COUNT(r.id_registro)                   AS intentos,
               MAX(r.puntuacion_final)                AS mejor,
               (array_agg(r.puntuacion_final ORDER BY r.numero_intento)
                    FILTER (WHERE r.id_registro IS NOT NULL))[1] AS primero,
               (MAX(r.fecha_ejecucion)::timestamptz AT TIME ZONE $3::text)::date AS ultimo
          FROM juegos_generados j
          LEFT JOIN registro_avances r ON r.id_juego = j.id_juego AND r.id_alumno = $1
         WHERE j.id_docente = $2 AND j.estado = 'aprobado'
         GROUP BY j.id_juego
         ORDER BY j.fecha_creacion ASC
        """,
        id_alumno,
        id_docente,
        ZONA_ESCUELA,
    )
    dias = await conn.fetchval(
        """
        SELECT COUNT(DISTINCT (r.fecha_ejecucion::timestamptz AT TIME ZONE $3::text)::date)
          FROM registro_avances r
          JOIN juegos_generados j ON j.id_juego = r.id_juego AND j.estado = 'aprobado' AND j.id_docente = $2
         WHERE r.id_alumno = $1
        """,
        id_alumno,
        id_docente,
        ZONA_ESCUELA,
    )
    actividades = tuple(
        Actividad(
            id_juego=str(f["id_juego"]),
            titulo=f["titulo"] or "Actividad de ciencias",
            tipo=f["tipo"] or "quiz",
            intentos=f["intentos"],
            mejor=f["mejor"],
            primero=f["primero"],
            ultimo=f["ultimo"],
        )
        for f in filas
    )
    return Progreso(actividades=actividades, dias_activos=dias or 0)


async def logros_seguros(conn: asyncpg.Connection, id_alumno: uuid.UUID, id_docente: uuid.UUID) -> dict | None:
    """Las insignias del alumno, o None si algo falla.

    Las insignias son un extra: si su cálculo fallara, no debe romperse lo importante (guardar el
    resultado del niño o mostrar su menú). El error queda en el registro del servidor.
    """
    try:
        return calcular_logros(await cargar_progreso(conn, id_alumno, id_docente))
    except Exception:  # noqa: BLE001 - se registra y se sigue sin insignias
        logger.exception("No se pudieron calcular las insignias del alumno %s.", id_alumno)
        return None
