"""
Rutas para la gestión de docentes.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from app.schemas.docente import DocenteCreate, DocenteResponse
from app.db.session import get_db_pool
from app.core.security import hash_password, verify_password, create_access_token
import asyncpg

router = APIRouter(prefix="/docentes", tags=["Docentes"])


# --- Esquema específico para el Login (solo pide email y contraseña) ---
class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/registro", response_model=DocenteResponse, status_code=status.HTTP_201_CREATED)
async def registrar_docente(docente: DocenteCreate, pool: asyncpg.Pool = Depends(get_db_pool)):
    """
    Registra un nuevo docente en la base de datos.
    """
    # 1. Hasheamos la contraseña por seguridad
    hashed_pw = hash_password(docente.password)
    
    try:
        # 2. Insertamos en la base de datos
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
async def login_docente(datos: LoginRequest, pool: asyncpg.Pool = Depends(get_db_pool)):
    """
    Inicia sesión de un docente y devuelve un token JWT.
    """
    # 1. Buscamos al docente por email
    query = "SELECT id_docente, password_hash FROM docentes WHERE email = $1"
    async with pool.acquire() as conn:
        row = await conn.fetchrow(query, datos.email)
        
    if not row:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        
    # 2. Verificamos la contraseña
    if not verify_password(datos.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        
    # 3. Creamos el token
    token = create_access_token(subject=str(row["id_docente"]))
    
    return {"access_token": token, "token_type": "bearer"}