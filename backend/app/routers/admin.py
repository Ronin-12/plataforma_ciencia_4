"""Panel de administración (RF-09): cuentas de docentes, uso de la IA y cifras generales del piloto.

PRIVACIDAD: el administrador ve cuentas de DOCENTES y cifras agregadas. Nunca nombres de alumnos
ni resultados individuales: esas consultas ni siquiera los seleccionan.
"""

import logging
import uuid
from datetime import date

import asyncpg
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core import planes
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
            SELECT d.id_docente, d.nombre, d.email, d.escuela, d.tipo_escuela, d.cct, d.plan,
                   d.activo, d.fecha_creacion,
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
    docentes = []
    for fila in filas:
        item = dict(fila)
        item["id_docente"] = str(item["id_docente"])
        limite = planes.plan(item["plan"]).mensual
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


# ------------------------------------------------------------------------------- planes


@router.get("/planes")
async def lista_de_planes(admin: dict = Depends(admin_actual)):
    """Los planes que se pueden asignar y cuánta IA incluye cada uno."""
    return {"planes": [{"id": p.id, "nombre": p.nombre, "mensual": p.mensual, "diario": p.diario} for p in planes.todos()]}


class CambioDePlan(BaseModel):
    plan: Literal["gratis", "maestro", "docente", "escuela"]


@router.patch("/docentes/{id_docente}/plan")
async def cambiar_plan_de_docente(
    id_docente: uuid.UUID,
    datos: CambioDePlan,
    admin: dict = Depends(admin_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Asigna el plan acordado con el docente o su escuela (no hay cobro en línea)."""
    async with pool.acquire() as conn:
        cuenta = await conn.fetchrow("SELECT rol FROM docentes WHERE id_docente = $1", id_docente)
        if cuenta is None:
            raise HTTPException(status_code=404, detail="Docente no encontrado.")
        if cuenta["rol"] != ROL_DOCENTE:
            raise HTTPException(status_code=403, detail="Las cuentas de administrador no tienen plan.")
        await conn.execute("UPDATE docentes SET plan = $2 WHERE id_docente = $1", id_docente, datos.plan)
    logger.warning("ADMIN: el administrador %s puso el plan %s a la cuenta %s.", admin["id"], datos.plan, id_docente)
    plan = planes.plan(datos.plan)
    return {"id_docente": str(id_docente), "plan": plan.id, "mensual": plan.mensual, "diario": plan.diario}


# ----------------------------------------------------------------------- costo de la IA


@router.get("/uso-ia")
async def uso_de_la_ia(admin: dict = Depends(admin_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Tokens del mes en curso y su costo ESTIMADO, por tarea. Sirve para confirmar si los planes alcanzan."""
    async with pool.acquire() as conn:
        filas = await conn.fetch(
            """
            SELECT tarea, COUNT(*) AS llamadas,
                   COALESCE(SUM(tokens_entrada), 0) AS entrada, COALESCE(SUM(tokens_salida), 0) AS salida,
                   AVG(duracion_ms) AS ms_promedio, MAX(duracion_ms) AS ms_maximo
              FROM ia_uso_tokens
             WHERE fecha >= date_trunc('month', now())
             GROUP BY tarea ORDER BY tarea
            """
        )
        generaciones = await conn.fetchval(
            "SELECT COALESCE(SUM(generaciones), 0) FROM ia_generaciones_mes WHERE periodo = $1", _periodo_actual()
        )

    def costo_usd(entrada: int, salida: int) -> float:
        return (entrada * settings.IA_PRECIO_ENTRADA_USD_MTOK + salida * settings.IA_PRECIO_SALIDA_USD_MTOK) / 1_000_000

    por_tarea = []
    total_entrada = total_salida = 0
    for f in filas:
        total_entrada += f["entrada"]
        total_salida += f["salida"]
        por_tarea.append({
            "tarea": f["tarea"], "llamadas": f["llamadas"], "tokens_entrada": f["entrada"], "tokens_salida": f["salida"],
            "costo_usd": round(costo_usd(f["entrada"], f["salida"]), 4),
            # Lo que tarda cada llamada a la IA: sirve para comprobar si los cambios de velocidad funcionaron.
            "segundos_promedio": round(float(f["ms_promedio"]) / 1000, 1) if f["ms_promedio"] is not None else None,
            "segundos_maximo": round(f["ms_maximo"] / 1000, 1) if f["ms_maximo"] is not None else None,
        })
    total_usd = costo_usd(total_entrada, total_salida)
    return {
        "por_tarea": por_tarea,
        "tokens_entrada": total_entrada,
        "tokens_salida": total_salida,
        "costo_usd": round(total_usd, 4),
        "costo_mxn": round(total_usd * settings.IA_TIPO_CAMBIO_MXN, 2),
        "generaciones_cobradas": generaciones,
        # Costo promedio de cada crédito usado este mes: el número clave para fijar precios.
        "costo_por_generacion_mxn": round(total_usd * settings.IA_TIPO_CAMBIO_MXN / generaciones, 2) if generaciones else None,
        "precios": {
            "entrada_usd_mtok": settings.IA_PRECIO_ENTRADA_USD_MTOK,
            "salida_usd_mtok": settings.IA_PRECIO_SALIDA_USD_MTOK,
            "tipo_cambio_mxn": settings.IA_TIPO_CAMBIO_MXN,
        },
    }


# ----------------------------------------------------------- solicitudes de contacto


@router.get("/solicitudes")
async def lista_de_solicitudes(admin: dict = Depends(admin_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Mensajes que llegaron desde la sección Planes, los más recientes primero."""
    async with pool.acquire() as conn:
        filas = await conn.fetch(
            """
            SELECT id_solicitud, nombre, email, telefono, escuela, tipo_escuela, cct, num_docentes,
                   plan_interes, mensaje, estado, fecha_creacion
              FROM solicitudes_contacto
             ORDER BY (estado = 'cerrada'), fecha_creacion DESC
             LIMIT 500
            """
        )
    return {"solicitudes": [{**dict(f), "id_solicitud": str(f["id_solicitud"])} for f in filas]}


class EstadoSolicitud(BaseModel):
    estado: Literal["nueva", "en_proceso", "cerrada"]


@router.patch("/solicitudes/{id_solicitud}")
async def cambiar_estado_solicitud(
    id_solicitud: uuid.UUID,
    datos: EstadoSolicitud,
    admin: dict = Depends(admin_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    async with pool.acquire() as conn:
        hecho = await conn.fetchval(
            "UPDATE solicitudes_contacto SET estado = $2 WHERE id_solicitud = $1 RETURNING id_solicitud",
            id_solicitud, datos.estado,
        )
    if hecho is None:
        raise HTTPException(status_code=404, detail="Solicitud no encontrada.")
    return {"id_solicitud": str(id_solicitud), "estado": datos.estado}
