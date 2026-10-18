"""Conexión y pool de PostgreSQL mediante asyncpg."""

import asyncpg

from app.core.config import settings


pool: asyncpg.Pool | None = None


async def init_db_pool() -> None:
    """Crea el pool de conexiones durante el arranque de FastAPI."""
    global pool

    if pool is not None:
        return

    # asyncpg recibe una URL PostgreSQL estándar, sin el sufijo de SQLAlchemy.
    dsn = settings.DATABASE_URL.replace(
        "postgresql+asyncpg://",
        "postgresql://",
        1,
    )

    pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=10,
    )
    print("✅ Pool de conexiones a PostgreSQL inicializado")


async def close_db_pool() -> None:
    """Cierra el pool durante el apagado de FastAPI."""
    global pool

    if pool is not None:
        await pool.close()
        pool = None
        print("🔒 Pool de conexiones cerrado")


def get_db_pool() -> asyncpg.Pool:
    """Devuelve el pool inicializado o genera un error claro."""
    if pool is None:
        raise RuntimeError("El pool de conexiones no está inicializado")
    return pool
