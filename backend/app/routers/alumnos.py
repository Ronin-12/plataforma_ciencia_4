"""Rutas para la gestión de alumnos, sus aulas y el acceso del alumno."""

import logging
import secrets
import uuid
from datetime import timedelta

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.core.config import settings
from app.core.deps import docente_actual
from app.core.limites import (
    LimitadorVentana,
    exigir,
    exigir_sin_bloqueo,
    ip_cliente,
    limpiar_fallos,
    registrar_fallo,
)
from app.core.security import (
    HASH_FALSO,
    ROL_ALUMNO,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db_pool
from app.schemas.alumno import CODIGO_AULA, AlumnoCreate, AlumnoUpdate, LoginAlumnoRequest


router = APIRouter(prefix="/alumnos", tags=["Alumnos"])
logger = logging.getLogger("uvicorn.error")

# Límites por IP para el acceso del alumno (no requiere sesión, así que se vigila más).
_limite_aula = LimitadorVentana(maximo=30, ventana_segundos=60)
_limite_login_alumno = LimitadorVentana(maximo=30, ventana_segundos=60)


def generar_pin() -> str:
    """Genera un PIN de cuatro dígitos (con ceros a la izquierda si hace falta)."""
    return f"{secrets.randbelow(10_000):04d}"


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
        if grupo is not None:
            return grupo

    raise HTTPException(
        status_code=503,
        detail="No se pudo crear el aula por ahora. Intenta guardar al alumno otra vez.",
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_alumno(
    alumno: AlumnoCreate,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Crea al alumno en un aula del docente con sesión. El PIN se muestra UNA sola vez."""
    async with pool.acquire() as conn:
        if alumno.id_grupo is not None:
            # El aula debe ser de este docente; si no, responde como si no existiera.
            grupo = await conn.fetchrow(
                "SELECT id_grupo, codigo_acceso FROM grupos WHERE id_grupo = $1 AND id_docente = $2",
                alumno.id_grupo,
                docente["id"],
            )
            if grupo is None:
                raise HTTPException(status_code=404, detail="El aula indicada no existe.")
        else:
            grupo = await obtener_o_crear_aula(conn, docente["id"])

        pin = generar_pin()
        row = await conn.fetchrow(
            """
            INSERT INTO alumnos (nombre_pila, pin_hash, avatar_url, id_grupo)
            VALUES ($1, $2, $3, $4)
            RETURNING id_alumno, nombre_pila, avatar_url, id_grupo, fecha_creacion, activo
            """,
            alumno.nombre_pila,
            hash_password(pin),
            alumno.avatar_url,
            grupo["id_grupo"],
        )

    resultado = dict(row)
    resultado["pin"] = pin  # única vez que el PIN existe en claro
    resultado["codigo_acceso"] = grupo["codigo_acceso"]
    return resultado


@router.get("/")
async def listar_alumnos(
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Alumnos de las aulas del docente con sesión. Nunca incluye PIN."""
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id_alumno, a.nombre_pila, a.avatar_url, a.activo,
                   g.codigo_acceso, g.id_grupo,
                   (a.bloqueado_hasta IS NOT NULL AND a.bloqueado_hasta > now()) AS bloqueado
              FROM alumnos a
              JOIN grupos g ON a.id_grupo = g.id_grupo
             WHERE g.id_docente = $1
             ORDER BY a.nombre_pila ASC
            """,
            docente["id"],
        )
    return {"alumnos": [dict(row) for row in rows]}


@router.patch("/{id_alumno}")
async def actualizar_alumno(
    id_alumno: uuid.UUID,
    cambios: AlumnoUpdate,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Corrige el nombre de un alumno o desactiva/reactiva su acceso (solo alumnos del propio docente).

    Un alumno desactivado no puede entrar, su sesión abierta deja de valer en la siguiente petición
    y no cuenta en las métricas del grupo; sus datos se conservan hasta que se borren.
    """
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            """
            UPDATE alumnos a
               SET nombre_pila = COALESCE($3, a.nombre_pila),
                   activo = COALESCE($4, a.activo)
              FROM grupos g
             WHERE a.id_alumno = $1 AND a.id_grupo = g.id_grupo AND g.id_docente = $2
            RETURNING a.id_alumno, a.nombre_pila, a.avatar_url, a.activo
            """,
            id_alumno, docente["id"], cambios.nombre_pila, cambios.activo,
        )
    if fila is None:
        raise HTTPException(status_code=404, detail="El alumno no existe.")
    return dict(fila)


@router.get("/{id_alumno}/datos")
async def datos_del_alumno(
    id_alumno: uuid.UUID,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Derecho de Acceso (ARCO): todo lo que el sistema guarda de un alumno, para entregarlo si se pide."""
    async with pool.acquire() as conn:
        alumno = await conn.fetchrow(
            """
            SELECT a.id_alumno, a.nombre_pila, a.avatar_url, a.activo, a.fecha_creacion, g.codigo_acceso
              FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
             WHERE a.id_alumno = $1 AND g.id_docente = $2
            """,
            id_alumno, docente["id"],
        )
        if alumno is None:
            raise HTTPException(status_code=404, detail="El alumno no existe.")
        resultados = await conn.fetch(
            """
            SELECT j.contenido_juego->>'titulo' AS juego, r.puntuacion_final, r.tiempo_resolucion,
                   r.numero_intento, r.fecha_ejecucion
              FROM registro_avances r LEFT JOIN juegos_generados j ON j.id_juego = r.id_juego
             WHERE r.id_alumno = $1
             ORDER BY r.fecha_ejecucion
            """,
            id_alumno,
        )
    return {
        "alumno": {**dict(alumno), "pin": "No se guarda: solo existe un hash cifrado (bcrypt)."},
        "resultados": [dict(fila) for fila in resultados],
    }


@router.delete("/{id_alumno}")
async def eliminar_alumno(
    id_alumno: uuid.UUID,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Derecho de Cancelación (RNF-03): borra al alumno y TODOS sus resultados. No se puede deshacer.

    Los resultados se borran solos porque `registro_avances.id_alumno` tiene ON DELETE CASCADE;
    el conteo se hace antes, dentro de la misma transacción, para informar cuántos se eliminaron.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            existe = await conn.fetchval(
                """
                SELECT a.id_alumno FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo
                 WHERE a.id_alumno = $1 AND g.id_docente = $2
                 FOR UPDATE OF a
                """,
                id_alumno, docente["id"],
            )
            if existe is None:
                raise HTTPException(status_code=404, detail="El alumno no existe.")
            borrados = await conn.fetchval("SELECT count(*) FROM registro_avances WHERE id_alumno = $1", id_alumno)
            await conn.execute("DELETE FROM alumnos WHERE id_alumno = $1", id_alumno)
    logger.warning("ARCO: el docente %s borró al alumno %s y %d resultado(s).", docente["id"], id_alumno, borrados)
    return {"eliminado": True, "resultados_borrados": borrados}


@router.post("/{id_alumno}/restablecer-pin")
async def restablecer_pin(
    id_alumno: uuid.UUID,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Genera un PIN nuevo (y desbloquea al alumno). Solo para alumnos del propio docente."""
    pin = generar_pin()
    async with pool.acquire() as conn:
        id_actualizado = await conn.fetchval(
            """
            UPDATE alumnos a
               SET pin_hash = $3, intentos_fallidos = 0, bloqueado_hasta = NULL
              FROM grupos g
             WHERE a.id_alumno = $1 AND a.id_grupo = g.id_grupo AND g.id_docente = $2
            RETURNING a.id_alumno
            """,
            id_alumno,
            docente["id"],
            hash_password(pin),
        )
    if id_actualizado is None:
        raise HTTPException(status_code=404, detail="El alumno no existe.")
    return {"id_alumno": str(id_alumno), "pin": pin}


# --------------------------------------------------------------------------
# Acceso del alumno: código de aula -> elegir su nombre -> PIN
# --------------------------------------------------------------------------


@router.get("/aula/{codigo}")
async def alumnos_del_aula(
    codigo: str,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Paso 2 del acceso: nombres de pila y avatares del aula, para que cada niño elija el suyo."""
    exigir(_limite_aula, ip_cliente(request), "Demasiados intentos. Espera un minuto.")
    if not CODIGO_AULA.match(codigo):
        raise HTTPException(status_code=404, detail="No encontramos esa aula. Revisa el código.")

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT a.id_alumno, a.nombre_pila, a.avatar_url
              FROM alumnos a JOIN grupos g ON a.id_grupo = g.id_grupo
             WHERE g.codigo_acceso = $1 AND a.activo
             ORDER BY a.nombre_pila ASC
            """,
            codigo,
        )
        existe = bool(rows) or await conn.fetchval(
            "SELECT 1 FROM grupos WHERE codigo_acceso = $1", codigo
        )
    if not existe:
        raise HTTPException(status_code=404, detail="No encontramos esa aula. Revisa el código.")
    return {"alumnos": [dict(row) for row in rows]}


@router.post("/login")
async def login_alumno(
    datos: LoginAlumnoRequest,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Paso 3 del acceso: PIN. Tras 5 fallos seguidos ese alumno se bloquea unos minutos."""
    exigir(_limite_login_alumno, ip_cliente(request), "Demasiados intentos. Espera un minuto.")

    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT a.id_alumno, a.nombre_pila, a.avatar_url, a.pin_hash, a.activo, a.bloqueado_hasta
              FROM alumnos a JOIN grupos g ON a.id_grupo = g.id_grupo
             WHERE g.codigo_acceso = $1 AND a.id_alumno = $2
            """,
            datos.codigo_acceso,
            datos.id_alumno,
        )
        exigir_sin_bloqueo(row)

        correcto = verify_password(datos.pin, row["pin_hash"] if row else HASH_FALSO)
        if row is None or not correcto or not row["activo"]:
            if row is not None:
                await registrar_fallo(conn, "alumnos", row["id_alumno"])
            raise HTTPException(status_code=401, detail="El PIN no es correcto.")

        await limpiar_fallos(conn, "alumnos", row["id_alumno"])

    token = create_access_token(
        subject=str(row["id_alumno"]),
        rol=ROL_ALUMNO,
        expires_delta=timedelta(minutes=settings.ALUMNO_TOKEN_MINUTES),
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "alumno": {
            "id_alumno": str(row["id_alumno"]),
            "nombre": row["nombre_pila"],
            "avatar_url": row["avatar_url"],
        },
    }
