"""Configuración de las pruebas.

Necesitan una base PostgreSQL DESECHABLE (se vacían sus tablas). Define su dirección así:

    PowerShell:  $env:TEST_DATABASE_URL = "postgresql://postgres:TU_CLAVE@127.0.0.1:5432/murcielago_test"

Esa base debe tener aplicados db/schema_v2.sql y las migraciones de db/migraciones/ (en orden).
Nunca apuntes TEST_DATABASE_URL a tu base de trabajo ni a la de producción.
"""

import asyncio
import os
import sys

import pytest

if sys.platform == "win32":  # asyncpg no funciona con el bucle por defecto de Windows
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

URL_PRUEBA = os.environ.get("TEST_DATABASE_URL")

# Se fijan ANTES de importar la aplicación, que lee la configuración al importarse.
os.environ["DATABASE_URL"] = URL_PRUEBA or "postgresql://sin-base/prueba"
os.environ["SECRET_KEY"] = "clave-de-pruebas-" + "x" * 48
os.environ["CODIGO_INVITACION_DOCENTES"] = "invitacion-de-prueba"
os.environ["GEMINI_API_KEY"] = "clave-falsa-de-pruebas"
os.environ["LOGIN_MAX_INTENTOS"] = "5"
os.environ["LOGIN_BLOQUEO_MINUTOS"] = "5"
os.environ["IA_MAX_JUEGOS_POR_HORA"] = "3"

import httpx  # noqa: E402

from app.db import session  # noqa: E402
from app.main import app  # noqa: E402
from app.routers import alumnos, docentes, ia, resultados  # noqa: E402


def pytest_collection_modifyitems(config, items):
    if URL_PRUEBA:
        return
    saltar = pytest.mark.skip(reason="Define TEST_DATABASE_URL para correr las pruebas con PostgreSQL.")
    for item in items:
        if "test_config" not in item.nodeid:
            item.add_marker(saltar)


@pytest.fixture(scope="session", autouse=True)
async def _pool():
    if not URL_PRUEBA:
        yield
        return
    await session.init_db_pool()
    yield
    await session.close_db_pool()


@pytest.fixture(autouse=True)
async def _limpiar():
    """Cada prueba empieza con tablas vacías y sin límites acumulados."""
    if URL_PRUEBA:
        async with session.get_db_pool().acquire() as conn:
            await conn.execute("TRUNCATE docentes CASCADE")
    for limitador in (
        docentes._limite_registro,
        docentes._limite_login,
        alumnos._limite_aula,
        alumnos._limite_login_alumno,
        ia._limite_generacion,
        resultados._limite_resultados,
    ):
        limitador.reiniciar()
    yield


@pytest.fixture
async def cliente():
    transporte = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transporte, base_url="http://prueba") as c:
        yield c


CLAVE = "Clave-Segura-1"


async def crear_docente(cliente, email="ana@escuela.mx", nombre="Ana Pérez") -> str:
    """Registra un docente con el código de invitación y devuelve su token."""
    r = await cliente.post(
        "/docentes/registro",
        json={"nombre": nombre, "email": email, "password": CLAVE, "codigo_invitacion": "invitacion-de-prueba"},
    )
    assert r.status_code == 201, r.text
    r = await cliente.post("/docentes/login", json={"email": email, "password": CLAVE})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
