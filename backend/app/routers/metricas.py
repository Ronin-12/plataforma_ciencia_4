"""Métricas del grupo para el docente (RF-06)."""

import asyncpg
from fastapi import APIRouter, Depends

from app.core.deps import docente_actual
from app.db.session import get_db_pool

router = APIRouter(prefix="/metricas", tags=["Métricas"])

# Un alumno "necesita apoyo" si su promedio de aciertos queda por debajo de este porcentaje.
UMBRAL_APOYO = 60


@router.get("/grupo")
async def metricas_del_grupo(
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Resumen, desglose por juego y por alumno de las aulas del docente con sesión."""
    id_docente = docente["id"]
    async with pool.acquire() as conn:
        resumen = await conn.fetchrow(
            """
            SELECT COUNT(r.id_registro)                         AS intentos,
                   COUNT(DISTINCT r.id_alumno)                  AS alumnos_que_jugaron,
                   ROUND(AVG(r.puntuacion_final))::int          AS promedio_puntuacion,
                   ROUND(AVG(r.tiempo_resolucion))::int         AS tiempo_promedio_seg
              FROM registro_avances r
              JOIN alumnos a ON a.id_alumno = r.id_alumno
              JOIN grupos g ON g.id_grupo = a.id_grupo
             WHERE g.id_docente = $1 AND r.id_juego IS NOT NULL
            """,
            id_docente,
        )
        total_alumnos = await conn.fetchval(
            """
            SELECT COUNT(*) FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
             WHERE g.id_docente = $1 AND a.activo
            """,
            id_docente,
        )
        por_juego = await conn.fetch(
            """
            SELECT j.id_juego,
                   j.contenido_juego ->> 'titulo'                AS titulo,
                   j.contenido_juego ->> 'tipo_actividad'        AS tipo,
                   COUNT(r.id_registro)                          AS intentos,
                   COUNT(DISTINCT r.id_alumno)                   AS alumnos,
                   ROUND(AVG(r.puntuacion_final))::int           AS promedio_puntuacion,
                   ROUND(AVG(r.tiempo_resolucion))::int          AS tiempo_promedio_seg
              FROM juegos_generados j
              LEFT JOIN registro_avances r ON r.id_juego = j.id_juego
             WHERE j.id_docente = $1
               AND (j.estado = 'aprobado'
                    OR EXISTS (SELECT 1 FROM registro_avances x WHERE x.id_juego = j.id_juego))
             GROUP BY j.id_juego
             ORDER BY j.fecha_creacion DESC
            """,
            id_docente,
        )
        por_alumno = await conn.fetch(
            """
            SELECT a.id_alumno, a.nombre_pila,
                   COUNT(r.id_registro)                          AS intentos,
                   COUNT(DISTINCT r.id_juego)                    AS juegos_jugados,
                   ROUND(AVG(r.puntuacion_final))::int           AS promedio_puntuacion,
                   MAX(r.fecha_ejecucion)::timestamptz           AS ultimo_intento
              FROM alumnos a
              JOIN grupos g ON g.id_grupo = a.id_grupo
              LEFT JOIN registro_avances r ON r.id_alumno = a.id_alumno AND r.id_juego IS NOT NULL
             WHERE g.id_docente = $1 AND a.activo
             GROUP BY a.id_alumno, a.nombre_pila
             ORDER BY a.nombre_pila
            """,
            id_docente,
        )

    alumnos = []
    for fila in por_alumno:
        item = dict(fila)
        item["id_alumno"] = str(item["id_alumno"])
        item["necesita_apoyo"] = (
            item["promedio_puntuacion"] is not None and item["promedio_puntuacion"] < UMBRAL_APOYO
        )
        alumnos.append(item)

    juegos = [{**dict(f), "id_juego": str(f["id_juego"])} for f in por_juego]
    return {
        "umbral_apoyo": UMBRAL_APOYO,
        "resumen": {**dict(resumen), "alumnos_total": total_alumnos},
        "por_juego": juegos,
        "por_alumno": alumnos,
    }
