"""
Esquemas Pydantic para la tabla ALUMNOS.
"""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class AlumnoBase(BaseModel):
    nombre_pila: str
    avatar_url: str | None = None

class AlumnoCreate(AlumnoBase):
    id_grupo: UUID
    # El PIN no se pide, el backend lo genera automáticamente

class AlumnoResponse(AlumnoBase):
    id_alumno: UUID
    id_grupo: UUID
    fecha_creacion: datetime
    activo: bool

    class Config:
        from_attributes = True