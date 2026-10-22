"""Hash de contraseñas y PIN, y utilidades para tokens JWT."""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings

ROL_DOCENTE = "docente"
ROL_ADMIN = "administrador"
ROL_ALUMNO = "alumno"


def hash_password(password: str) -> str:
    """Genera un hash bcrypt para almacenar una contraseña (o un PIN)."""
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Devuelve True si la contraseña coincide con el hash bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


# Hash que no corresponde a ninguna cuenta. Se compara cuando el usuario no existe
# para que responder "no existe" tarde lo mismo que responder "clave incorrecta".
HASH_FALSO = hash_password("sin-cuenta-con-este-hash")


def create_access_token(
    subject: Any,
    expires_delta: timedelta | None = None,
    rol: str = ROL_DOCENTE,
) -> str:
    """Crea un JWT firmado con el id del usuario (sub) y su rol."""
    ahora = datetime.now(timezone.utc)
    expiration = ahora + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": str(subject),
        "rol": rol,
        "iat": ahora,
        "exp": expiration,
    }
    return jwt.encode(
        payload,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Decodifica un JWT válido; devuelve None si expiró, está alterado o está incompleto."""
    try:
        return jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["exp", "sub", "rol"]},
        )
    except jwt.InvalidTokenError:
        return None
