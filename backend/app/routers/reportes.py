"""Reporte de avance para la familia: lo que el docente imprime o comparte de UN alumno."""

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import docente_actual
from app.core.logros import Progreso, calcular_logros
from app.core.progreso import cargar_progreso
from app.db.session import get_db_pool
from app.routers.metricas import UMBRAL_APOYO, ZONA_ESCUELA
from app.routers.resultados import puntos_de

router = APIRouter(prefix="/alumnos", tags=["Reportes"])

# Con este porcentaje o más, una actividad se cuenta como algo que al alumno le sale muy bien.
UMBRAL_FORTALEZA = 80
MAX_FORTALEZAS = 3


def armar_reporte(progreso: Progreso) -> dict:
    """Cifras del reporte a partir del progreso. Es puro (sin base de datos), por eso se prueba solo.

    No incluye nada de otros alumnos: ni promedios del grupo ni posiciones. Una familia debe ver
    el avance de su hijo o hija contra sí mismo, no contra sus compañeros.
    """
    actividades = progreso.actividades
    realizadas = progreso.realizadas
    mejores = [a.mejor for a in realizadas if a.mejor is not None]

    fuertes = sorted((a for a in realizadas if (a.mejor or 0) >= UMBRAL_FORTALEZA), key=lambda a: -(a.mejor or 0))
    repasar = [a for a in realizadas if (a.mejor or 0) < UMBRAL_APOYO]

    return {
        "resumen": {
            "disponibles": len(actividades),
            "realizadas": len(realizadas),
            "pendientes": len(actividades) - len(realizadas),
            "promedio": round(sum(mejores) / len(mejores)) if mejores else None,
            "intentos": sum(a.intentos for a in actividades),
            "dias_activos": progreso.dias_activos,
        },
        "actividades": [
            {
                "id_juego": a.id_juego,
                "titulo": a.titulo,
                "tipo": a.tipo,
                "realizada": a.realizada,
                "mejor": a.mejor,
                "intentos": a.intentos,
                "ultimo": a.ultimo.isoformat() if a.ultimo else None,
            }
            for a in actividades
        ],
        "fortalezas": [a.titulo for a in fuertes[:MAX_FORTALEZAS]],
        "para_repasar": [a.titulo for a in repasar],
        "puntos": sum(puntos_de(a.mejor) for a in realizadas if a.mejor is not None),
        "logros": calcular_logros(progreso),
        "umbral_apoyo": UMBRAL_APOYO,
        "umbral_fortaleza": UMBRAL_FORTALEZA,
    }


@router.get("/{id_alumno}/reporte")
async def reporte_familiar(
    id_alumno: uuid.UUID,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Reporte de avance de un alumno del propio docente, listo para imprimir o compartir con su familia.

    Igual que el derecho de Acceso (ARCO), solo el docente del alumno puede pedirlo; un alumno de
    otro docente responde 404 como si no existiera. Un alumno desactivado también tiene reporte.
    """
    async with pool.acquire() as conn:
        alumno = await conn.fetchrow(
            """
            SELECT a.id_alumno, a.nombre_pila, g.grado
              FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
             WHERE a.id_alumno = $1 AND g.id_docente = $2
            """,
            id_alumno,
            docente["id"],
        )
        if alumno is None:
            raise HTTPException(status_code=404, detail="El alumno no existe.")
        escuela = await conn.fetchval("SELECT escuela FROM docentes WHERE id_docente = $1", docente["id"])
        hoy = await conn.fetchval("SELECT (now() AT TIME ZONE $1::text)::date", ZONA_ESCUELA)
        progreso = await cargar_progreso(conn, id_alumno, docente["id"])

    return {
        "alumno": {"id_alumno": str(alumno["id_alumno"]), "nombre": alumno["nombre_pila"], "grado": alumno["grado"]},
        "docente": {"nombre": docente["nombre"], "escuela": escuela},
        "generado": hoy.isoformat(),
        **armar_reporte(progreso),
    }
