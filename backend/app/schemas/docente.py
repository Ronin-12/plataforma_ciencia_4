"""
Esquemas Pydantic para la tabla DOCENTES.
"""
import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# Clave de Centro de Trabajo de la SEP: 2 dígitos (estado), 3 letras, 4 dígitos y 1 letra o dígito.
# Ejemplo: 09DPR1234X.
PATRON_CCT = re.compile(r"^\d{2}[A-Z]{3}\d{4}[A-Z0-9]$")


def validar_cct(valor: str | None) -> str | None:
    """Limpia la CCT (mayúsculas, sin espacios ni guiones) y revisa su forma. Vacía = None."""
    limpio = re.sub(r"[\s-]", "", valor or "").upper()
    if not limpio:
        return None
    if not PATRON_CCT.match(limpio):
        raise ValueError("La CCT debe tener 10 caracteres, por ejemplo 09DPR1234X.")
    return limpio


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
    escuela: str | None = Field(default=None, max_length=120)
    tipo_escuela: Literal["publica", "privada"] | None = None
    cct: str | None = Field(default=None, max_length=20)
    # Obligatorio: sin aceptar el aviso de privacidad y los términos no se crea la cuenta.
    acepta_terminos: bool

    @field_validator("cct")
    @classmethod
    def _cct_valida(cls, valor: str | None) -> str | None:
        return validar_cct(valor)

    @field_validator("acepta_terminos")
    @classmethod
    def _debe_aceptar(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("Para crear tu cuenta debes aceptar el aviso de privacidad y los términos.")
        return valor

    @field_validator("escuela")
    @classmethod
    def _limpiar_escuela(cls, valor: str | None) -> str | None:
        valor = " ".join((valor or "").split())
        return valor or None

    @field_validator("password")
    @classmethod
    def _password_valida(cls, valor: str) -> str:
        return validar_password(valor)


# Esquema para devolver un docente (NUNCA devuelve la contraseña)
class DocenteResponse(DocenteBase):
    id_docente: UUID
    rol: str
    escuela: str | None = None
    tipo_escuela: str | None = None
    cct: str | None = None
    plan: str = "gratis"
    fecha_creacion: datetime
    activo: bool

    model_config = ConfigDict(from_attributes=True)
