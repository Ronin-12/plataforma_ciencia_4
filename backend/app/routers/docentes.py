"""
Rutas para la gestión de docentes: registro, inicio de sesión y recuperar la contraseña.
"""
import hashlib
import logging
import secrets

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.core.config import settings
from app.core.correo import enviar_correo
from app.core.deps import docente_actual
from app.core import planes
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
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db_pool
from app.schemas.docente import DocenteCreate, DocenteResponse, validar_password

router = APIRouter(prefix="/docentes", tags=["Docentes"])
logger = logging.getLogger("murcielago")

# Máximo de intentos de registro por IP y hora (frena adivinar el código de invitación).
_limite_registro = LimitadorVentana(maximo=10, ventana_segundos=3600)
# Máximo de intentos de login por IP y minuto (además del bloqueo por cuenta).
_limite_login = LimitadorVentana(maximo=30, ventana_segundos=60)
# Recuperar contraseña: por IP (frena que alguien mande correos a miles de cuentas) y por correo
# (frena que le llenen la bandeja a una sola persona).
_limite_recuperar_ip = LimitadorVentana(maximo=10, ventana_segundos=3600)
_limite_recuperar_correo = LimitadorVentana(maximo=3, ventana_segundos=3600)
_limite_restablecer = LimitadorVentana(maximo=20, ventana_segundos=3600)

MENSAJE_RECUPERAR = (
    "Si ese correo tiene una cuenta en Mupi, te enviamos un enlace para crear una contraseña nueva. "
    "Revisa también la carpeta de spam."
)


# --- Esquema específico para el Login (solo pide email y contraseña) ---
class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


@router.post("/registro", response_model=DocenteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_docente(
    docente: DocenteCreate,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Registra un nuevo docente. Exige el código de invitación que entrega la escuela.
    """
    if not settings.CODIGO_INVITACION_DOCENTES:
        raise HTTPException(
            status_code=503,
            detail="El registro de docentes no está habilitado. Pide a tu administrador el código de invitación.",
        )

    exigir(_limite_registro, ip_cliente(request), "Demasiados intentos de registro. Espera un rato.")

    if not secrets.compare_digest(
        docente.codigo_invitacion.encode("utf-8"),
        settings.CODIGO_INVITACION_DOCENTES.encode("utf-8"),
    ):
        raise HTTPException(status_code=403, detail="El código de invitación no es correcto.")

    hashed_pw = hash_password(docente.password)

    try:
        query = """
            INSERT INTO docentes (nombre, email, password_hash, escuela, tipo_escuela, cct,
                                  acepto_terminos_en, version_terminos)
            VALUES ($1, $2, $3, $4, $5, $6, now(), $7)
            RETURNING id_docente, nombre, email, rol, escuela, tipo_escuela, cct, plan, fecha_creacion, activo
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                query, docente.nombre, docente.email, hashed_pw, docente.escuela,
                docente.tipo_escuela, docente.cct, settings.VERSION_TERMINOS,
            )

        return dict(row)

    except asyncpg.UniqueViolationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El correo electrónico ya está registrado."
        )


@router.post("/login")
async def login_docente(
    datos: LoginRequest,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Inicia sesión de un docente y devuelve un token JWT con su rol.
    Tras varios intentos fallidos seguidos la cuenta se bloquea unos minutos.
    """
    exigir(_limite_login, ip_cliente(request), "Demasiados intentos desde esta red. Espera un minuto.")

    email = datos.email.strip().lower()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT id_docente, nombre, rol, escuela, plan, password_hash, activo, bloqueado_hasta
              FROM docentes WHERE lower(email) = $1
            """,
            email,
        )
        exigir_sin_bloqueo(row)

        # Si el correo no existe se compara igual contra un hash falso: mismo tiempo de respuesta.
        correcta = verify_password(datos.password, row["password_hash"] if row else HASH_FALSO)
        if row is None or not correcta or not row["activo"]:
            if row is not None:
                await registrar_fallo(conn, "docentes", row["id_docente"])
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        await limpiar_fallos(conn, "docentes", row["id_docente"])

    token = create_access_token(subject=str(row["id_docente"]), rol=row["rol"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "docente": {
            "id_docente": str(row["id_docente"]),
            "nombre": row["nombre"],
            "rol": row["rol"],
            "escuela": row["escuela"],
            "plan": row["plan"],
        },
    }


@router.get("/yo")
async def mi_perfil(docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Devuelve los datos básicos de la persona con sesión iniciada y su plan."""
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            "SELECT escuela, tipo_escuela, cct, plan FROM docentes WHERE id_docente = $1", docente["id"]
        )
    plan = planes.plan(fila["plan"] if fila else None)
    return {
        "id_docente": str(docente["id"]),
        "nombre": docente["nombre"],
        "rol": docente["rol"],
        "escuela": fila["escuela"] if fila else None,
        "tipo_escuela": fila["tipo_escuela"] if fila else None,
        "cct": fila["cct"] if fila else None,
        "plan": {"id": plan.id, "nombre": plan.nombre, "mensual": plan.mensual, "diario": plan.diario},
    }


# ------------------------------------------------------------------ recuperar contraseña


def _huella(token: str) -> str:
    """Se guarda el sha256 del enlace, nunca el enlace: quien lea la base no puede usarlo."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class RecuperarRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255)


class RestablecerRequest(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str

    @field_validator("password")
    @classmethod
    def _password_valida(cls, valor: str) -> str:
        return validar_password(valor)


@router.post("/recuperar")
async def pedir_recuperacion(
    datos: RecuperarRequest,
    request: Request,
    tareas: BackgroundTasks,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Envía al correo un enlace de un solo uso para crear una contraseña nueva.

    Responde SIEMPRE lo mismo, exista o no la cuenta: así nadie puede averiguar qué correos
    están registrados. Las cuentas desactivadas no reciben enlace.
    """
    exigir(_limite_recuperar_ip, ip_cliente(request), "Demasiadas solicitudes. Espera un rato.")
    email = datos.email.strip().lower()
    if not _limite_recuperar_correo.permitir(email):
        # Mismo mensaje: no se revela si el correo existe ni que se alcanzó el límite.
        return {"mensaje": MENSAJE_RECUPERAR}

    async with pool.acquire() as conn:
        cuenta = await conn.fetchrow(
            "SELECT id_docente, nombre, activo FROM docentes WHERE lower(email) = $1", email
        )
        if cuenta is None or not cuenta["activo"]:
            return {"mensaje": MENSAJE_RECUPERAR}
        token = secrets.token_urlsafe(32)
        async with conn.transaction():
            # Un enlace nuevo anula los anteriores que no se usaron.
            await conn.execute(
                "UPDATE recuperaciones_password SET usado_en = now() WHERE id_docente = $1 AND usado_en IS NULL",
                cuenta["id_docente"],
            )
            await conn.execute(
                """
                INSERT INTO recuperaciones_password (id_docente, token_hash, expira_en)
                VALUES ($1, $2, now() + make_interval(mins => $3))
                """,
                cuenta["id_docente"], _huella(token), settings.RECUPERACION_MINUTOS,
            )

    enlace = f"{settings.URL_FRONTEND.rstrip('/')}/?restablecer={token}"
    # El correo sale después de responder: así la respuesta tarda lo mismo exista o no la cuenta.
    tareas.add_task(
        enviar_correo,
        email,
        "Mupi: crea una contraseña nueva",
        (
            f"Hola, {cuenta['nombre']}:\n\n"
            "Recibimos una solicitud para cambiar la contraseña de tu cuenta de Mupi.\n"
            f"Abre este enlace para crear una nueva (vale {settings.RECUPERACION_MINUTOS} minutos y solo una vez):\n\n"
            f"{enlace}\n\n"
            "Si no fuiste tú, ignora este correo: tu contraseña no cambia.\n\n"
            "Equipo Mupi"
        ),
    )
    logger.info("Recuperación de contraseña solicitada para la cuenta %s", cuenta["id_docente"])
    return {"mensaje": MENSAJE_RECUPERAR}


@router.post("/restablecer")
async def restablecer_password(
    datos: RestablecerRequest,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Cambia la contraseña con un enlace válido. Cierra todas las sesiones abiertas de esa cuenta."""
    exigir(_limite_restablecer, ip_cliente(request), "Demasiados intentos. Espera un rato.")
    invalido = HTTPException(
        status_code=400,
        detail="El enlace no es válido o ya caducó. Pide uno nuevo desde «¿Olvidaste tu contraseña?».",
    )
    async with pool.acquire() as conn:
        async with conn.transaction():
            # FOR UPDATE: si llegan dos peticiones con el mismo enlace, solo una lo usa.
            registro = await conn.fetchrow(
                """
                SELECT r.id_recuperacion, r.id_docente
                  FROM recuperaciones_password r
                  JOIN docentes d ON d.id_docente = r.id_docente
                 WHERE r.token_hash = $1 AND r.usado_en IS NULL AND r.expira_en > now() AND d.activo
                 FOR UPDATE OF r
                """,
                _huella(datos.token),
            )
            if registro is None:
                raise invalido
            await conn.execute(
                """
                UPDATE docentes
                   SET password_hash = $2, password_cambiada_en = now(),
                       intentos_fallidos = 0, bloqueado_hasta = NULL
                 WHERE id_docente = $1
                """,
                registro["id_docente"], hash_password(datos.password),
            )
            await conn.execute(
                "UPDATE recuperaciones_password SET usado_en = now() WHERE id_docente = $1 AND usado_en IS NULL",
                registro["id_docente"],
            )
    logger.info("La cuenta %s cambió su contraseña con un enlace de recuperación", registro["id_docente"])
    return {"mensaje": "Listo. Ya puedes iniciar sesión con tu contraseña nueva."}
