"""Grupos del docente (4.º A, 4.º B...): cada uno con su código de aula, sus alumnos y sus actividades."""

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.asignacion import heredar_actividades_si_es_el_primero
from app.core.deps import docente_actual
from app.core.materias import GRADO_MAX, GRADO_MIN
from app.db.session import get_db_pool
from app.routers.alumnos import generar_codigo_acceso

router = APIRouter(prefix="/grupos", tags=["Grupos"])

MAX_GRUPOS_POR_DOCENTE = 30


def _limpiar_nombre(valor: str) -> str:
    valor = " ".join(valor.split())
    if not valor:
        raise ValueError("El nombre del grupo no puede estar vacío.")
    return valor


class GrupoCrear(BaseModel):
    nombre: str = Field(min_length=1, max_length=40)
    grado: int = Field(ge=GRADO_MIN, le=GRADO_MAX)

    _nombre = field_validator("nombre")(_limpiar_nombre)


class GrupoCambiar(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=40)
    grado: int | None = Field(default=None, ge=GRADO_MIN, le=GRADO_MAX)

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else _limpiar_nombre(valor)

    @model_validator(mode="after")
    def _al_menos_un_cambio(self):
        if self.nombre is None and self.grado is None:
            raise ValueError("Indica qué quieres cambiar: nombre o grado.")
        return self


_CAMPOS_GRUPO = """
    g.id_grupo, g.nombre, g.grado, g.codigo_acceso, g.fecha_creacion,
    (SELECT COUNT(*) FROM alumnos a WHERE a.id_grupo = g.id_grupo AND a.activo) AS alumnos_activos,
    (SELECT COUNT(*) FROM alumnos a WHERE a.id_grupo = g.id_grupo)              AS alumnos_total,
    (SELECT COUNT(*) FROM juegos_grupos jg JOIN juegos_generados j ON j.id_juego = jg.id_juego
      WHERE jg.id_grupo = g.id_grupo AND j.estado = 'aprobado')                 AS actividades
"""


def _como_dict(fila: asyncpg.Record) -> dict:
    return {**dict(fila), "id_grupo": str(fila["id_grupo"])}


@router.get("/")
async def listar_grupos(docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Los grupos del docente con sesión, con cuántos alumnos y cuántas actividades tiene cada uno."""
    async with pool.acquire() as conn:
        filas = await conn.fetch(
            f"SELECT {_CAMPOS_GRUPO} FROM grupos g WHERE g.id_docente = $1 ORDER BY g.grado, LOWER(g.nombre)",
            docente["id"],
        )
    return {"grupos": [_como_dict(f) for f in filas]}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_grupo(
    datos: GrupoCrear, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Abre un grupo nuevo con su propio código de aula. El nombre no se repite entre los grupos del docente."""
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM grupos WHERE id_docente = $1", docente["id"])
        if total >= MAX_GRUPOS_POR_DOCENTE:
            raise HTTPException(status_code=409, detail=f"Llegaste al máximo de {MAX_GRUPOS_POR_DOCENTE} grupos.")
        for _ in range(10):  # el código es único en toda la plataforma: si choca, se genera otro
            try:
                async with conn.transaction():
                    nuevo = await conn.fetchrow(
                        "INSERT INTO grupos (codigo_acceso, grado, id_docente, nombre) VALUES ($1, $2, $3, $4) RETURNING id_grupo",
                        generar_codigo_acceso(), datos.grado, docente["id"], datos.nombre,
                    )
                    await heredar_actividades_si_es_el_primero(conn, docente["id"], nuevo["id_grupo"])
            except asyncpg.UniqueViolationError as exc:
                if "uq_grupos_docente_nombre" in str(exc):
                    raise HTTPException(status_code=409, detail="Ya tienes un grupo con ese nombre.") from exc
                continue
            fila = await conn.fetchrow(f"SELECT {_CAMPOS_GRUPO} FROM grupos g WHERE g.id_grupo = $1", nuevo["id_grupo"])
            return _como_dict(fila)
    raise HTTPException(status_code=503, detail="No se pudo crear el grupo por ahora. Inténtalo de nuevo.")


@router.patch("/{id_grupo}")
async def cambiar_grupo(
    id_grupo: uuid.UUID,
    datos: GrupoCambiar,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Corrige el nombre o el grado de un grupo del propio docente."""
    async with pool.acquire() as conn:
        try:
            fila = await conn.fetchrow(
                f"""
                WITH cambiado AS (
                    UPDATE grupos SET nombre = COALESCE($3, nombre), grado = COALESCE($4, grado)
                     WHERE id_grupo = $1 AND id_docente = $2
                    RETURNING *
                )
                SELECT {_CAMPOS_GRUPO} FROM cambiado g
                """,
                id_grupo, docente["id"], datos.nombre, datos.grado,
            )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(status_code=409, detail="Ya tienes un grupo con ese nombre.") from exc
    if fila is None:
        raise HTTPException(status_code=404, detail="El grupo no existe.")
    return _como_dict(fila)


@router.delete("/{id_grupo}")
async def eliminar_grupo(
    id_grupo: uuid.UUID, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Borra un grupo SIN alumnos. Con alumnos se rechaza: primero hay que darlos de baja (así nada se pierde por error)."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            existe = await conn.fetchval(
                "SELECT 1 FROM grupos WHERE id_grupo = $1 AND id_docente = $2 FOR UPDATE", id_grupo, docente["id"]
            )
            if not existe:
                raise HTTPException(status_code=404, detail="El grupo no existe.")
            alumnos = await conn.fetchval("SELECT COUNT(*) FROM alumnos WHERE id_grupo = $1", id_grupo)
            if alumnos:
                raise HTTPException(
                    status_code=409,
                    detail=f"Este grupo tiene {alumnos} alumno(s). Da de baja a sus alumnos antes de borrarlo.",
                )
            await conn.execute("DELETE FROM grupos WHERE id_grupo = $1", id_grupo)
    return {"eliminado": True}
