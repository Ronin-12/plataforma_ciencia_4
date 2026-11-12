"""
Esquemas Pydantic para la tabla ALUMNOS.
"""
import re
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class AlumnoCreate(BaseModel):
    nombre_pila: str = Field(min_length=1, max_length=60)
    # Solo se aceptan direcciones https:// o rutas del propio sitio (/...).
    avatar_url: str | None = Field(default=None, max_length=500)
    # Opcional: aula concreta. Debe pertenecer al docente que hace la petición.
    id_grupo: UUID | None = None
    # El PIN lo genera el servidor; el cliente nunca lo envía.
    # El docente tampoco se envía: sale del token de sesión.

    @field_validator("nombre_pila")
    @classmethod
    def _limpiar_nombre(cls, valor: str) -> str:
        valor = " ".join(valor.split())
        if not valor:
            raise ValueError("El nombre no puede estar vacío.")
        return valor

    @field_validator("avatar_url")
    @classmethod
    def _avatar_seguro(cls, valor: str | None) -> str | None:
        if valor is None or valor == "":
            return None
        if not (valor.startswith("https://") or (valor.startswith("/") and not valor.startswith("//"))):
            raise ValueError("El avatar debe ser una dirección https:// o una ruta del sitio.")
        return valor


class AlumnoUpdate(BaseModel):
    """Cambios permitidos a un alumno: corregir su nombre (Rectificación) o activar/desactivar su acceso."""

    nombre_pila: str | None = Field(default=None, min_length=1, max_length=60)
    activo: bool | None = None

    @field_validator("nombre_pila")
    @classmethod
    def _limpiar_nombre(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        valor = " ".join(valor.split())
        if not valor:
            raise ValueError("El nombre no puede estar vacío.")
        return valor

    @model_validator(mode="after")
    def _al_menos_un_cambio(self):
        if self.nombre_pila is None and self.activo is None:
            raise ValueError("Indica qué quieres cambiar: nombre_pila o activo.")
        return self


class LoginAlumnoRequest(BaseModel):
    codigo_acceso: str = Field(pattern=r"^\d{6}$")
    id_alumno: UUID
    pin: str = Field(pattern=r"^\d{4}$")


CODIGO_AULA = re.compile(r"^\d{6}$")
