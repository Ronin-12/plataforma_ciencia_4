"""Configura .env con la contraseña local de PostgreSQL sin mostrarla."""

import asyncio
import getpass
import os
import sys
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import asyncpg
from dotenv import dotenv_values


BACKEND_DIR = Path(__file__).resolve().parent
ENV_PATH = BACKEND_DIR / ".env"


def connection_urls(password: str, current_url: str) -> tuple[str, str, str, str]:
    """Return asyncpg DSN, updated env URL, hostname, and database name."""
    normalized = current_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    parsed = urlsplit(normalized)
    username = unquote(parsed.username or "")
    hostname = parsed.hostname or ""
    if not username or not hostname or not parsed.path.strip("/"):
        raise ValueError("DATABASE_URL no tiene usuario, host o base de datos válidos.")

    host_part = f"[{hostname}]" if ":" in hostname else hostname
    port_part = f":{parsed.port}" if parsed.port else ""
    netloc = f"{quote(username, safe='')}:{quote(password, safe='')}@{host_part}{port_part}"
    dsn = urlunsplit(("postgresql", netloc, parsed.path, parsed.query, parsed.fragment))
    env_url = urlunsplit(
        ("postgresql+asyncpg", netloc, parsed.path, parsed.query, parsed.fragment)
    )
    return dsn, env_url, hostname, parsed.path.lstrip("/")


async def verify_connection(dsn: str) -> str:
    """Verify the candidate credentials with asyncpg before changing .env."""
    connection = await asyncpg.connect(dsn=dsn, timeout=8)
    try:
        return await connection.fetchval("SELECT current_database()")
    finally:
        await connection.close()


def update_env_url(new_url: str) -> None:
    """Replace exactly one DATABASE_URL line while preserving other settings."""
    if not ENV_PATH.is_file():
        raise FileNotFoundError("No existe backend/.env; créalo desde .env.example primero.")

    contents = ENV_PATH.read_text(encoding="utf-8-sig")
    lines = contents.splitlines(keepends=True)
    matches = [index for index, line in enumerate(lines) if line.lstrip().startswith("DATABASE_URL=")]
    if len(matches) != 1:
        raise ValueError(".env debe contener exactamente una línea DATABASE_URL=.")

    index = matches[0]
    newline = "\r\n" if lines[index].endswith("\r\n") else "\n" if lines[index].endswith("\n") else ""
    lines[index] = f"DATABASE_URL={new_url}{newline}"
    ENV_PATH.write_text("".join(lines), encoding="utf-8", newline="")


def main() -> int:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    if os.environ.get("DATABASE_URL"):
        print("Hay una variable DATABASE_URL en Windows que puede sobrescribir backend/.env.")
        print("Elimínala de esta sesión con: Remove-Item Env:DATABASE_URL")
        return 1

    values = dotenv_values(ENV_PATH)
    current_url = values.get("DATABASE_URL")
    if not current_url:
        print("No encontré DATABASE_URL en backend/.env.")
        return 1

    password = getpass.getpass("Escribe la contraseña válida de PostgreSQL para postgres: ")
    if not password:
        print("La contraseña no puede estar vacía.")
        return 1

    try:
        dsn, env_url, hostname, expected_database = connection_urls(password, current_url)
        database = asyncio.run(verify_connection(dsn))
        if database != expected_database:
            print("La conexión abrió otra base distinta a la indicada en DATABASE_URL; no guardé cambios.")
            return 1

        update_env_url(env_url)
    except Exception as exc:
        # Do not print connection arguments or secrets.
        print(f"No pude validar la conexión ({type(exc).__name__}); .env quedó sin cambios.")
        print("Confirma la contraseña y que PostgreSQL esté activo en el host configurado.")
        return 1

    print(f"Contraseña validada y guardada en backend/.env para {hostname}/{database}.")
    print("Inicia la API con: python run.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
