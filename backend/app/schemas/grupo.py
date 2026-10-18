"""
Esquemas Pydantic para la tabla GRUPOS.
"""
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class GrupoBase(BaseModel):
    grado: int

class GrupoCreate(GrupoBase):
    id_docente: UUID
    # El código de acceso se genera automáticamente

class GrupoResponse(GrupoBase):
    id_grupo: UUID
    codigo_acceso: str
    id_docente: UUID
    fecha_creacion: datetime

    class Config:
        from_attributes = True