"""Sprint A: chequeo de migraciones al arrancar y escuela del docente."""

import pytest

from app.db import session
from app.db.verificacion import EsquemaDesactualizado, exigir_esquema_al_dia, migraciones_pendientes
from tests.conftest import CLAVE


# ------------------------------------------------------------ chequeo de migraciones


async def test_base_al_dia_no_tiene_migraciones_pendientes():
    async with session.get_db_pool().acquire() as conn:
        assert await migraciones_pendientes(conn) == []
        await exigir_esquema_al_dia(conn)


async def test_si_falta_una_columna_dice_que_migracion_aplicar():
    async with session.get_db_pool().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("ALTER TABLE docentes DROP COLUMN escuela")
            assert await migraciones_pendientes(conn) == ["003_escuela.sql"]
            with pytest.raises(EsquemaDesactualizado) as exc:
                await exigir_esquema_al_dia(conn)
            assert "003_escuela.sql" in str(exc.value) and "psql.exe" in str(exc.value)
        finally:
            await tr.rollback()


async def test_si_faltan_varias_se_listan_en_orden():
    async with session.get_db_pool().acquire() as conn:
        tr = conn.transaction()
        await tr.start()
        try:
            await conn.execute("ALTER TABLE docentes DROP COLUMN escuela")
            await conn.execute("TRUNCATE registro_avances")
            await conn.execute("DROP INDEX IF EXISTS uq_registro_intento_juego")
            await conn.execute("ALTER TABLE registro_avances DROP COLUMN id_juego CASCADE")
            assert await migraciones_pendientes(conn) == ["002_resultados.sql", "003_escuela.sql"]
        finally:
            await tr.rollback()


# ------------------------------------------------------------------ escuela del docente


async def _registrar(cliente, **extra):
    return await cliente.post(
        "/docentes/registro",
        json={
            "nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": CLAVE,
            "codigo_invitacion": "invitacion-de-prueba", **extra,
        },
    )


async def test_la_escuela_se_guarda_y_vuelve_en_el_login(cliente):
    r = await _registrar(cliente, escuela="  Primaria   Benito Juárez ")
    assert r.status_code == 201 and r.json()["escuela"] == "Primaria Benito Juárez"
    login = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})
    assert login.json()["docente"]["escuela"] == "Primaria Benito Juárez"


@pytest.mark.parametrize("valor", [None, "", "   "])
async def test_la_escuela_es_opcional(cliente, valor):
    r = await _registrar(cliente, escuela=valor)
    assert r.status_code == 201 and r.json()["escuela"] is None


async def test_escuela_demasiado_larga_se_rechaza(cliente):
    r = await _registrar(cliente, escuela="x" * 121)
    assert r.status_code == 422
