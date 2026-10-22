"""
Rutas para la gestión de docentes.
"""
import secrets

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

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
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db_pool
from app.schemas.docente import DocenteCreate, DocenteResponse

router = APIRouter(prefix="/docentes", tags=["Docentes"])

# Máximo de intentos de registro por IP y hora (frena adivinar el código de invitación).
_limite_registro = LimitadorVentana(maximo=10, ventana_segundos=3600)
# Máximo de intentos de login por IP y minuto (además del bloqueo por cuenta).
_limite_login = LimitadorVentana(maximo=30, ventana_segundos=60)


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
            INSERT INTO docentes (nombre, email, password_hash)
            VALUES ($1, $2, $3)
            RETURNING id_docente, nombre, email, rol, fecha_creacion, activo
        """
        async with pool.acquire() as conn:
            row = await conn.fetchrow(query, docente.nombre, docente.email, hashed_pw)

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
            SELECT id_docente, nombre, rol, password_hash, activo, bloqueado_hasta
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
        },
    }


@router.get("/yo")
async def mi_perfil(docente: dict = Depends(docente_actual)):
    """Devuelve los datos básicos de la persona con sesión iniciada."""
    return {"id_docente": str(docente["id"]), "nombre": docente["nombre"], "rol": docente["rol"]}
