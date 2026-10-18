"""Rutas para la gestión de alumnos y sus aulas."""

import secrets
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, status

from app.db.session import get_db_pool
from app.schemas.alumno import AlumnoCreate


router = APIRouter(prefix="/alumnos", tags=["Alumnos"])


def generar_pin_unico() -> int:
    """Genera un PIN de cuatro dígitos para el alumno."""
    return 1000 + secrets.randbelow(9000)


def generar_codigo_acceso() -> str:
    """Genera el código de seis dígitos para entrar al aula."""
    return str(100000 + secrets.randbelow(900000))


async def obtener_o_crear_aula(conn: asyncpg.Connection, id_docente: uuid.UUID):
    """Reutiliza la primera aula del docente o crea una de cuarto grado."""
    grupo = await conn.fetchrow(
        """
        SELECT id_grupo, codigo_acceso
        FROM grupos
        WHERE id_docente = $1
        ORDER BY fecha_creacion ASC
        LIMIT 1
        """,
        id_docente,
    )
    if grupo is not None:
        return grupo

    for _ in range(10):
        try:
            grupo = await conn.fetchrow(
                """
                INSERT INTO grupos (codigo_acceso, grado, id_docente)
                VALUES ($1, 4, $2)
                ON CONFLICT (codigo_acceso) DO NOTHING
                RETURNING id_grupo, codigo_acceso
                """,
                generar_codigo_acceso(),
                id_docente,
            )
        except asyncpg.ForeignKeyViolationError as exc:
            raise HTTPException(status_code=404, detail="El docente indicado no existe.") from exc
        if grupo is not None:
            return grupo

    raise HTTPException(
        status_code=503,
        detail="No se pudo crear el aula por ahora. Intenta guardar al alumno otra vez.",
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_alumno(
    alumno: AlumnoCreate,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Crea al alumno en el aula seleccionada o en la del docente."""
    if alumno.id_grupo is None and alumno.id_docente is None:
        raise HTTPException(
            status_code=422,
            detail="Falta id_docente para asignar al alumno a un aula.",
        )

    async with pool.acquire() as conn:
        codigo_acceso: str | None = None
        if alumno.id_grupo is not None:
            id_grupo = alumno.id_grupo
            codigo_acceso = await conn.fetchval(
                "SELECT codigo_acceso FROM grupos WHERE id_grupo = $1",
                id_grupo,
            )
            if codigo_acceso is None:
                raise HTTPException(status_code=404, detail="El aula indicada no existe.")
        else:
            grupo = await obtener_o_crear_aula(conn, alumno.id_docente)
            id_grupo = grupo["id_grupo"]
            codigo_acceso = grupo["codigo_acceso"]

        # ON CONFLICT deja reintentar sin abortar la transacción PostgreSQL.
        for _ in range(30):
            pin = generar_pin_unico()
            row = await conn.fetchrow(
                """
                INSERT INTO alumnos (nombre_pila, pin_seguridad, avatar_url, id_grupo)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id_grupo, pin_seguridad) DO NOTHING
                RETURNING id_alumno, nombre_pila, avatar_url, id_grupo,
                          fecha_creacion, activo
                """,
                alumno.nombre_pila.strip(),
                pin,
                alumno.avatar_url,
                id_grupo,
            )
            if row is not None:
                resultado = dict(row)
                resultado["pin_seguridad"] = pin
                resultado["codigo_acceso"] = codigo_acceso
                return resultado

    raise HTTPException(
        status_code=503,
        detail="No se pudo asignar un PIN único. Intenta guardar al alumno otra vez.",
    )


@router.get("/docente/{id_docente}")
async def obtener_alumnos_docente(
    id_docente: str,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Devuelve los alumnos de todas las aulas del docente."""
    try:
        query = """
            SELECT a.id_alumno, a.nombre_pila, a.pin_seguridad, a.avatar_url,
                   g.codigo_acceso, g.id_grupo
            FROM alumnos a
            JOIN grupos g ON a.id_grupo = g.id_grupo
            WHERE g.id_docente = $1
            ORDER BY a.nombre_pila ASC
        """
        async with pool.acquire() as conn:
            rows = await conn.fetch(query, uuid.UUID(id_docente))
        return {"alumnos": [dict(row) for row in rows]}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="El ID del docente no es un UUID válido.") from exc
