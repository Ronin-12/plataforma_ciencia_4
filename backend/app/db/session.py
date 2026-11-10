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

    new_pool = await asyncpg.create_pool(
        dsn=dsn,
        min_size=1,
        max_size=10,
    )

    # Esta tabla se añadió después del esquema inicial del piloto.
    # CREATE IF NOT EXISTS permite actualizar bases locales ya existentes sin borrar datos.
    try:
        async with new_pool.acquire() as connection:
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS juegos_generados (
                    id_juego UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    id_docente UUID NOT NULL
                        REFERENCES docentes (id_docente) ON DELETE CASCADE,
                    prompt_original TEXT NOT NULL,
                    contenido_juego JSONB NOT NULL,
                    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sesiones_docente (
                    id_sesion UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    id_docente UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
                    titulo VARCHAR(160) NOT NULL,
                    tema VARCHAR(240) NOT NULL,
                    material_nombre VARCHAR(255),
                    contexto TEXT NOT NULL DEFAULT '',
                    fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS ia_generaciones_mes (
                    id_docente UUID NOT NULL REFERENCES docentes (id_docente) ON DELETE CASCADE,
                    periodo DATE NOT NULL,
                    generaciones INTEGER NOT NULL DEFAULT 0 CHECK (generaciones >= 0),
                    PRIMARY KEY (id_docente, periodo)
                )
                """
            )
            await connection.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_juegos_generados_id_docente
                ON juegos_generados (id_docente)
                """
            )
            await connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_sesiones_docente_fecha ON sesiones_docente (id_docente, fecha_creacion DESC)"
            )
            await connection.execute(
                "ALTER TABLE juegos_generados ADD COLUMN IF NOT EXISTS id_sesion UUID REFERENCES sesiones_docente (id_sesion) ON DELETE SET NULL"
            )
    except BaseException:
        await new_pool.close()
        raise

    pool = new_pool
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
