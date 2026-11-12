"""Panel de administración (RF-09): cuentas de docentes, uso de la IA y cifras generales del piloto.

PRIVACIDAD: el administrador ve cuentas de DOCENTES y cifras agregadas. Nunca nombres de alumnos
ni resultados individuales: esas consultas ni siquiera los seleccionan.
"""

import logging
import uuid
from datetime import date

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.config import settings
from app.core.deps import admin_actual
from app.core.security import ROL_DOCENTE
from app.db.session import get_db_pool

router = APIRouter(prefix="/admin", tags=["Administración"])
logger = logging.getLogger("uvicorn.error")


def _periodo_actual() -> date:
    """Primer día del mes en curso: así se guarda el consumo mensual de créditos (ver routers/ia.py)."""
    return date.today().replace(day=1)


@router.get("/resumen")
async def resumen_general(admin: dict = Depends(admin_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Cifras globales del piloto."""
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            """
            SELECT
              (SELECT COUNT(*) FROM docentes WHERE rol = $1 AND activo)      AS docentes_activos,
              (SELECT COUNT(*) FROM docentes WHERE rol = $1 AND NOT activo)  AS docentes_inactivos,
              (SELECT COUNT(*) FROM grupos)                                  AS grupos,
              (SELECT COUNT(*) FROM alumnos WHERE activo)                    AS alumnos_activos,
              (SELECT COUNT(*) FROM juegos_generados WHERE estado = 'aprobado') AS actividades,
              (SELECT COUNT(*) FROM registro_avances r JOIN alumnos a ON a.id_alumno = r.id_alumno
                WHERE a.activo AND r.id_juego IS NOT NULL)                   AS intentos,
              (SELECT COALESCE(SUM(generaciones), 0) FROM ia_generaciones_mes WHERE periodo = $2)
                                                                             AS creditos_usados_mes
            """,
            ROL_DOCENTE,
            _periodo_actual(),
        )
    return {**dict(fila), "creditos_por_docente": settings.IA_GENERACIONES_MENSUALES_MAX}


@router.get("/docentes")
async def lista_de_docentes(admin: dict = Depends(admin_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Cada docente con su tamaño (grupos, alumnos), su producción, su uso de IA y su última actividad."""
    async with pool.acquire() as conn:
        filas = await conn.fetch(
            """
            SELECT d.id_docente, d.nombre, d.email, d.escuela, d.activo, d.fecha_creacion,
              (SELECT COUNT(*) FROM grupos g WHERE g.id_docente = d.id_docente)                 AS grupos,
              (SELECT COUNT(*) FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
                WHERE g.id_docente = d.id_docente AND a.activo)                                 AS alumnos,
              (SELECT COUNT(*) FROM juegos_generados j
                WHERE j.id_docente = d.id_docente AND j.estado = 'aprobado')                    AS actividades,
              (SELECT COUNT(*) FROM registro_avances r
                 JOIN alumnos a ON a.id_alumno = r.id_alumno
                 JOIN grupos g ON g.id_grupo = a.id_grupo
                WHERE g.id_docente = d.id_docente AND a.activo AND r.id_juego IS NOT NULL)      AS intentos,
              COALESCE((SELECT m.generaciones FROM ia_generaciones_mes m
                         WHERE m.id_docente = d.id_docente AND m.periodo = $2), 0)              AS creditos_usados,
              GREATEST(
                (SELECT MAX(j.fecha_creacion) FROM juegos_generados j WHERE j.id_docente = d.id_docente),
                (SELECT MAX(r.fecha_ejecucion)::timestamptz FROM registro_avances r
                   JOIN alumnos a ON a.id_alumno = r.id_alumno
                   JOIN grupos g ON g.id_grupo = a.id_grupo
                  WHERE g.id_docente = d.id_docente)
              )                                                                                 AS ultima_actividad
              FROM docentes d
             WHERE d.rol = $1
             ORDER BY lower(d.nombre)
            """,
            ROL_DOCENTE,
            _periodo_actual(),
        )
    limite = settings.IA_GENERACIONES_MENSUALES_MAX
    docentes = []
    for fila in filas:
        item = dict(fila)
        item["id_docente"] = str(item["id_docente"])
        item["creditos_limite"] = limite
        item["creditos_disponibles"] = max(0, limite - item["creditos_usados"])
        docentes.append(item)
    return {"docentes": docentes}


class EstadoDocente(BaseModel):
    activo: bool


@router.patch("/docentes/{id_docente}")
async def activar_o_desactivar_docente(
    id_docente: uuid.UUID,
    datos: EstadoDocente,
    admin: dict = Depends(admin_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Desactivar corta el acceso del docente: no puede iniciar sesión y su sesión abierta deja de valer.

    No borra nada (sus grupos, juegos y alumnos siguen ahí) y se puede revertir. Solo aplica a
    cuentas de docente: una de administrador no se puede tocar desde aquí.
    """
    async with pool.acquire() as conn:
        cuenta = await conn.fetchrow("SELECT rol FROM docentes WHERE id_docente = $1", id_docente)
        if cuenta is None:
            raise HTTPException(status_code=404, detail="Docente no encontrado.")
        if cuenta["rol"] != ROL_DOCENTE:
            raise HTTPException(status_code=403, detail="Las cuentas de administrador no se pueden modificar desde aquí.")
        await conn.execute("UPDATE docentes SET activo = $2 WHERE id_docente = $1", id_docente, datos.activo)
    # Se registran solo identificadores, nunca correos ni nombres.
    logger.warning(
        "ADMIN: el administrador %s %s la cuenta de docente %s.",
        admin["id"], "reactivó" if datos.activo else "desactivó", id_docente,
    )
    return {"id_docente": str(id_docente), "activo": datos.activo}
