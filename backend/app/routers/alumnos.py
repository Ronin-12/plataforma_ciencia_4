"""
Rutas para la gestión de alumnos.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from app.schemas.alumno import AlumnoCreate, AlumnoResponse
from app.db.session import get_db_pool
import asyncpg
import random

router = APIRouter(prefix="/alumnos", tags=["Alumnos"])

def generar_pin_unico():
    """Genera un PIN de 4 dígitos."""
    return random.randint(1000, 9999)

@router.post("/", response_model=AlumnoResponse, status_code=status.HTTP_201_CREATED)
async def crear_alumno(alumno: AlumnoCreate, pool: asyncpg.Pool = Depends(get_db_pool)):
    """
    Crea un nuevo alumno. El PIN se genera automáticamente.
    """
    async with pool.acquire() as conn:
        # Intentamos hasta 5 veces generar un PIN que no esté repetido en el grupo
        for _ in range(5):
            pin = generar_pin_unico()
            try:
                query = """
                    INSERT INTO alumnos (nombre_pila, pin_seguridad, avatar_url, id_grupo)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id_alumno, nombre_pila, avatar_url, id_grupo, fecha_creacion, activo
                """
                row = await conn.fetchrow(
                    query, 
                    alumno.nombre_pila, 
                    pin, 
                    alumno.avatar_url, 
                    alumno.id_grupo
                )
                # Agregamos el PIN manualmente a la respuesta para que el docente lo vea
                resultado = dict(row)
                resultado["pin_generado"] = pin
                return resultado
                
            except asyncpg.UniqueViolationError:
                # El PIN ya existe en este grupo, el ciclo intentará con otro
                continue
                
        raise HTTPException(status_code=500, detail="No se pudo generar un PIN único.")