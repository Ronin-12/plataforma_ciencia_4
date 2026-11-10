"""
Esquemas Pydantic para la tabla DOCENTES.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


def validar_password(valor: str) -> str:
    """Contraseña de 8 a 72 bytes (bcrypt ignora o rechaza lo que pase de 72)."""
    if len(valor) < 8:
        raise ValueError("La contraseña debe tener al menos 8 caracteres.")
    if len(valor.encode("utf-8")) > 72:
        raise ValueError("La contraseña es demasiado larga (máximo 72 bytes).")
    return valor


# Esquema base (datos comunes)
class DocenteBase(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    email: EmailStr

    @field_validator("nombre")
    @classmethod
    def _limpiar_nombre(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if len(valor) < 2:
            raise ValueError("El nombre es demasiado corto.")
        return valor

    @field_validator("email")
    @classmethod
    def _correo_en_minusculas(cls, valor: str) -> str:
        return valor.lower()


# Esquema para crear un docente (recibe contraseña en texto plano)
class DocenteCreate(DocenteBase):
    password: str
    codigo_invitacion: str = Field(min_length=1, max_length=100)

    @field_validator("password")
    @classmethod
    def _password_valida(cls, valor: str) -> str:
        return validar_password(valor)


# Esquema para devolver un docente (NUNCA devuelve la contraseña)
class DocenteResponse(DocenteBase):
    id_docente: UUID
    rol: str
    fecha_creacion: datetime
    activo: bool

    class Config:
        from_attributes = True
