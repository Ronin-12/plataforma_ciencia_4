"""Comprueba al arrancar que las migraciones de db/migraciones/ están aplicadas.

Sin esta revisión, una migración olvidada solo se nota cuando alguien usa la función que la
necesita, y el error aparece lejos de su causa. Aquí falla de inmediato y dice qué hacer.
"""

import asyncpg

# (tabla, columna, migración que la crea). Al añadir una migración, añade aquí lo que exige.
COLUMNAS_REQUERIDAS: list[tuple[str, str, str]] = [
    ("alumnos", "pin_hash", "001_seguridad.sql"),
    ("alumnos", "bloqueado_hasta", "001_seguridad.sql"),
    ("docentes", "bloqueado_hasta", "001_seguridad.sql"),
    ("registro_avances", "id_juego", "002_resultados.sql"),
    ("docentes", "escuela", "003_escuela.sql"),
    ("juegos_generados", "estado", "004_aprobacion.sql"),
]


class EsquemaDesactualizado(RuntimeError):
    pass


async def migraciones_pendientes(conn: asyncpg.Connection) -> list[str]:
    """Nombres de las migraciones (en orden) que faltan por aplicar."""
    existentes = {
        (f["table_name"], f["column_name"])
        for f in await conn.fetch(
            """
            SELECT table_name, column_name FROM information_schema.columns
             WHERE table_schema = current_schema()
            """
        )
    }
    faltan = {migracion for tabla, columna, migracion in COLUMNAS_REQUERIDAS if (tabla, columna) not in existentes}
    return sorted(faltan)


async def exigir_esquema_al_dia(conn: asyncpg.Connection) -> None:
    pendientes = await migraciones_pendientes(conn)
    if not pendientes:
        return
    comandos = "\n".join(
        f'  & "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" -U postgres -d murcielago -f db\\migraciones\\{nombre}'
        for nombre in pendientes
    )
    raise EsquemaDesactualizado(
        "\n\nFALTAN MIGRACIONES en la base de datos: " + ", ".join(pendientes) + ".\n"
        "Aplícalas en orden, desde la raíz del proyecto, y vuelve a iniciar el servidor:\n"
        + comandos
        + "\n(Cambia '-d murcielago' si tu DATABASE_URL usa otra base.)\n"
    )
