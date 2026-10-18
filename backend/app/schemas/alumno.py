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
    # Se acepta id_grupo para integraciones que ya administren grupos.
    # La interfaz actual envía id_docente y el backend resuelve su aula.
    id_grupo: UUID | None = None
    id_docente: UUID | None = None
    # El PIN se genera automáticamente; nunca debe enviarlo el cliente.

class AlumnoResponse(AlumnoBase):
    id_alumno: UUID
    id_grupo: UUID
    fecha_creacion: datetime
    activo: bool

    class Config:
        from_attributes = True
