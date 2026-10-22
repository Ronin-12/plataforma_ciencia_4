"""Dependencias de FastAPI: quién hace la petición y qué rol tiene.

El rol se valida SIEMPRE en el servidor, contra la base de datos, y no solo con lo que dice
el token (RNF-02). Así, una cuenta desactivada o con otro rol deja de funcionar al instante.
"""

import uuid

import asyncpg
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.security import ROL_ALUMNO, ROL_DOCENTE, decode_access_token
from app.db.session import get_db_pool

_esquema = HTTPBearer(auto_error=False)


def _no_autenticado() -> HTTPException:
    return HTTPException(
        status_code=401,
        detail="Tu sesión no es válida o expiró. Inicia sesión de nuevo.",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(_esquema),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> dict:
    """Devuelve al usuario del token (docente, administrador o alumno) o responde 401."""
    if credenciales is None:
        raise _no_autenticado()
    payload = decode_access_token(credenciales.credentials)
    if payload is None:
        raise _no_autenticado()
    try:
        id_usuario = uuid.UUID(str(payload["sub"]))
    except ValueError:
        raise _no_autenticado() from None
    rol = payload["rol"]

    async with pool.acquire() as conn:
        if rol == ROL_ALUMNO:
            fila = await conn.fetchrow(
                """
                SELECT a.id_alumno, a.nombre_pila, a.avatar_url, a.activo,
                       a.id_grupo, g.id_docente
                  FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
                 WHERE a.id_alumno = $1
                """,
                id_usuario,
            )
            if fila is None or not fila["activo"]:
                raise _no_autenticado()
            return {
                "id": fila["id_alumno"],
                "nombre": fila["nombre_pila"],
                "rol": ROL_ALUMNO,
                "id_grupo": fila["id_grupo"],
                "id_docente": fila["id_docente"],
            }

        fila = await conn.fetchrow(
            "SELECT id_docente, nombre, rol, activo FROM docentes WHERE id_docente = $1",
            id_usuario,
        )
        # El rol del token debe coincidir con el que hoy tiene la cuenta en la base.
        if fila is None or not fila["activo"] or fila["rol"] != rol:
            raise _no_autenticado()
        return {"id": fila["id_docente"], "nombre": fila["nombre"], "rol": fila["rol"]}


async def docente_actual(usuario: dict = Depends(usuario_actual)) -> dict:
    """Solo docentes. Los alumnos (y otros roles) reciben 403."""
    if usuario["rol"] != ROL_DOCENTE:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")
    return usuario


async def alumno_actual(usuario: dict = Depends(usuario_actual)) -> dict:
    """Solo alumnos."""
    if usuario["rol"] != ROL_ALUMNO:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")
    return usuario
