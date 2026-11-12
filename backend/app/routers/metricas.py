"""Métricas del grupo para el docente (RF-06), con filtros por fecha y por tipo de actividad."""

from datetime import date
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.deps import docente_actual
from app.db.session import get_db_pool

router = APIRouter(prefix="/metricas", tags=["Métricas"])

# Un alumno "necesita apoyo" si su promedio de aciertos queda por debajo de este porcentaje.
UMBRAL_APOYO = 60

# Los intentos se guardan con la hora del servidor. Para decir "este intento fue el día X" hay que
# convertirla a la hora de la escuela; si no, un juego terminado a las 8 p. m. en México caería en
# el día siguiente cuando el servidor trabaja en UTC.
ZONA_ESCUELA = "America/Mexico_City"

TipoFiltro = Literal["quiz", "verdadero_falso", "ordenar", "relacionar", "memoria", "completar", "clase"]

# Condiciones sobre un intento `r` (registro_avances). Son texto fijo: lo que escribe el usuario
# nunca se concatena aquí, siempre viaja como parámetro ($2 desde, $3 hasta, $4 tipo, $5 zona).
_DIA_DEL_INTENTO = "(r.fecha_ejecucion::timestamptz AT TIME ZONE $5::text)::date"
_INTENTO_EN_PERIODO = f"""
    ($2::date IS NULL OR {_DIA_DEL_INTENTO} >= $2::date)
    AND ($3::date IS NULL OR {_DIA_DEL_INTENTO} <= $3::date)
"""
_INTENTO_DEL_TIPO = """
    ($4::text IS NULL OR EXISTS (
        SELECT 1 FROM juegos_generados jt
         WHERE jt.id_juego = r.id_juego AND jt.contenido_juego ->> 'tipo_actividad' = $4::text))
"""
# Solo cuentan los alumnos activos: desactivar a un alumno lo saca de todas las métricas.
_ALUMNO_ACTIVO_DEL_DOCENTE = """
    EXISTS (SELECT 1 FROM alumnos aa JOIN grupos gg ON gg.id_grupo = aa.id_grupo
             WHERE aa.id_alumno = r.id_alumno AND aa.activo AND gg.id_docente = $1)
"""
_FILTROS_DE_INTENTO = f"{_INTENTO_EN_PERIODO} AND {_INTENTO_DEL_TIPO} AND {_ALUMNO_ACTIVO_DEL_DOCENTE}"


@router.get("/grupo")
async def metricas_del_grupo(
    desde: date | None = Query(None, description="Primer día incluido (AAAA-MM-DD)."),
    hasta: date | None = Query(None, description="Último día incluido (AAAA-MM-DD)."),
    tipo: TipoFiltro | None = Query(None, description="Solo actividades de este tipo ('clase' para las clases)."),
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Resumen, desglose por actividad y por alumno de las aulas del docente con sesión.

    Los filtros de fecha y tipo acotan los INTENTOS que se cuentan. Las actividades y los alumnos
    siguen apareciendo aunque no tengan intentos en el periodo (con 0), para ver quién falta.
    """
    if desde and hasta and desde > hasta:
        raise HTTPException(status_code=422, detail="La fecha «desde» no puede ser posterior a «hasta».")

    id_docente = docente["id"]
    filtros = (id_docente, desde, hasta, tipo, ZONA_ESCUELA)
    async with pool.acquire() as conn:
        resumen = await conn.fetchrow(
            f"""
            SELECT COUNT(r.id_registro)                         AS intentos,
                   COUNT(DISTINCT r.id_alumno)                  AS alumnos_que_jugaron,
                   ROUND(AVG(r.puntuacion_final))::int          AS promedio_puntuacion,
                   ROUND(AVG(r.tiempo_resolucion))::int         AS tiempo_promedio_seg
              FROM registro_avances r
             WHERE r.id_juego IS NOT NULL AND {_FILTROS_DE_INTENTO}
            """,
            *filtros,
        )
        total_alumnos = await conn.fetchval(
            """
            SELECT COUNT(*) FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
             WHERE g.id_docente = $1 AND a.activo
            """,
            id_docente,
        )
        # Actividades aprobadas (las que el alumno ve) del tipo pedido: el "de N" de cada alumno.
        actividades_total = await conn.fetchval(
            """
            SELECT COUNT(*) FROM juegos_generados j
             WHERE j.id_docente = $1 AND j.estado = 'aprobado'
               AND ($2::text IS NULL OR j.contenido_juego ->> 'tipo_actividad' = $2::text)
            """,
            id_docente,
            tipo,
        )
        por_juego = await conn.fetch(
            f"""
            SELECT j.id_juego,
                   j.contenido_juego ->> 'titulo'                AS titulo,
                   j.contenido_juego ->> 'tipo_actividad'        AS tipo,
                   j.estado,
                   COUNT(r.id_registro)                          AS intentos,
                   COUNT(DISTINCT r.id_alumno)                   AS alumnos,
                   ROUND(AVG(r.puntuacion_final))::int           AS promedio_puntuacion,
                   ROUND(AVG(r.tiempo_resolucion))::int          AS tiempo_promedio_seg
              FROM juegos_generados j
              LEFT JOIN registro_avances r
                     ON r.id_juego = j.id_juego AND {_FILTROS_DE_INTENTO}
             WHERE j.id_docente = $1
               AND ($4::text IS NULL OR j.contenido_juego ->> 'tipo_actividad' = $4::text)
               AND (j.estado = 'aprobado'
                    OR EXISTS (SELECT 1 FROM registro_avances x WHERE x.id_juego = j.id_juego))
             GROUP BY j.id_juego
             ORDER BY j.fecha_creacion DESC
            """,
            *filtros,
        )
        # Quién falta por hacer cada actividad aprobada (en el periodo pedido).
        faltan = await conn.fetch(
            f"""
            SELECT j.id_juego, array_agg(a.nombre_pila ORDER BY a.nombre_pila) AS nombres
              FROM juegos_generados j
              JOIN alumnos a ON a.activo
              JOIN grupos g ON g.id_grupo = a.id_grupo AND g.id_docente = $1
             WHERE j.id_docente = $1 AND j.estado = 'aprobado'
               AND ($4::text IS NULL OR j.contenido_juego ->> 'tipo_actividad' = $4::text)
               AND NOT EXISTS (
                    SELECT 1 FROM registro_avances r
                     WHERE r.id_juego = j.id_juego AND r.id_alumno = a.id_alumno
                       AND {_INTENTO_EN_PERIODO})
             GROUP BY j.id_juego
            """,
            *filtros,
        )
        por_alumno = await conn.fetch(
            f"""
            SELECT a.id_alumno, a.nombre_pila,
                   COUNT(r.id_registro)                          AS intentos,
                   COUNT(DISTINCT r.id_juego)                    AS juegos_jugados,
                   ROUND(AVG(r.puntuacion_final))::int           AS promedio_puntuacion,
                   MAX(r.fecha_ejecucion)::timestamptz           AS ultimo_intento
              FROM alumnos a
              JOIN grupos g ON g.id_grupo = a.id_grupo
              LEFT JOIN registro_avances r
                     ON r.id_alumno = a.id_alumno AND r.id_juego IS NOT NULL AND {_FILTROS_DE_INTENTO}
             WHERE g.id_docente = $1 AND a.activo
             GROUP BY a.id_alumno, a.nombre_pila
             ORDER BY a.nombre_pila
            """,
            *filtros,
        )

    alumnos = []
    for fila in por_alumno:
        item = dict(fila)
        item["id_alumno"] = str(item["id_alumno"])
        item["necesita_apoyo"] = (
            item["promedio_puntuacion"] is not None and item["promedio_puntuacion"] < UMBRAL_APOYO
        )
        alumnos.append(item)

    nombres_que_faltan = {f["id_juego"]: list(f["nombres"]) for f in faltan}
    juegos = []
    for fila in por_juego:
        pendientes = nombres_que_faltan.get(fila["id_juego"], [])
        juegos.append({**dict(fila), "id_juego": str(fila["id_juego"]), "faltan": pendientes, "pendientes": len(pendientes)})

    return {
        "umbral_apoyo": UMBRAL_APOYO,
        "filtros": {"desde": desde.isoformat() if desde else None, "hasta": hasta.isoformat() if hasta else None, "tipo": tipo},
        "actividades_total": actividades_total,
        "resumen": {**dict(resumen), "alumnos_total": total_alumnos},
        "por_juego": juegos,
        "por_alumno": alumnos,
    }
