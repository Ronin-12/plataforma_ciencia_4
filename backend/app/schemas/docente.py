"""
Esquemas Pydantic para la tabla DOCENTES.
"""
from pydantic import BaseModel, EmailStr
from datetime import datetime
from uuid import UUID

# Esquema base (datos comunes)
class DocenteBase(BaseModel):
    nombre: str
    email: EmailStr

# Esquema para crear un docente (recibe contraseña en texto plano)
class DocenteCreate(DocenteBase):
    password: str

# Esquema para devolver un docente (NUNCA devuelve la contraseña)
class DocenteResponse(DocenteBase):
    id_docente: UUID
    rol: str
    fecha_creacion: datetime
    activo: bool

    class Config:
        from_attributes = True