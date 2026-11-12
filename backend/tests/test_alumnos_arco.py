"""Derechos ARCO sobre los alumnos: Acceso (datos), Rectificación (nombre), Oposición (desactivar), Cancelación (borrar)."""

import uuid
from pathlib import Path

import pytest

from app.db import session
from app.db.verificacion import migraciones_pendientes
from app.ia import gemini
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso, _quiz
from tests.test_resultados import _id, crear_alumno_con_sesion, crear_juego, cuerpo


async def _registros(id_alumno) -> int:
    async with session.get_db_pool().acquire() as conn:
        return await conn.fetchval("SELECT count(*) FROM registro_avances WHERE id_alumno = $1", uuid.UUID(str(id_alumno)))


async def _existe(id_alumno) -> bool:
    async with session.get_db_pool().acquire() as conn:
        return bool(await conn.fetchval("SELECT 1 FROM alumnos WHERE id_alumno = $1", uuid.UUID(str(id_alumno))))


async def _jugar(cliente, tok, juego, pct=80):
    r = await cliente.post("/resultados/", json=cuerpo(juego, pct, 30), headers=auth(tok))
    assert r.status_code in (200, 201), r.text


async def _metricas(cliente, ana):
    return (await cliente.get("/metricas/grupo", headers=auth(ana))).json()


# ------------------------------------------------------------------ rectificar (nombre)


async def test_corregir_el_nombre(cliente):
    ana = await crear_docente(cliente)
    a, _ = await crear_alumno_con_sesion(cliente, ana, nombre="Sofia")
    r = await cliente.patch(f"/alumnos/{a['id_alumno']}", json={"nombre_pila": "  Sofía   López "}, headers=auth(ana))
    assert r.status_code == 200 and r.json()["nombre_pila"] == "Sofía López"
    nombres = [x["nombre_pila"] for x in (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"]]
    assert nombres == ["Sofía López"]


@pytest.mark.parametrize("cuerpo_malo", [{}, {"nombre_pila": ""}, {"nombre_pila": "   "}, {"nombre_pila": "x" * 61}, {"activo": "quizá"}])
async def test_cambios_invalidos_se_rechazan(cliente, cuerpo_malo):
    ana = await crear_docente(cliente)
    a, _ = await crear_alumno_con_sesion(cliente, ana)
    r = await cliente.patch(f"/alumnos/{a['id_alumno']}", json=cuerpo_malo, headers=auth(ana))
    assert r.status_code == 422


async def test_el_nombre_nuevo_queda_protegido_ante_la_ia(cliente, monkeypatch):
    """RNF-04: la lista de nombres protegidos se lee de la base cada vez, así que un cambio cuenta de inmediato."""
    ana = await crear_docente(cliente)
    a, _ = await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    await cliente.patch(f"/alumnos/{a['id_alumno']}", json={"nombre_pila": "Mateo"}, headers=auth(ana))
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "Un juego para Mateo"}, headers=auth(ana))
    assert r.status_code == 422


# ----------------------------------------------------------- oposición (desactivar)


async def test_desactivar_corta_el_acceso_al_instante_y_reactivar_lo_devuelve(cliente):
    ana = await crear_docente(cliente)
    a, tok = await crear_alumno_con_sesion(cliente, ana)
    juego = await crear_juego(ana)
    await _jugar(cliente, tok, juego)
    assert (await _metricas(cliente, ana))["resumen"]["alumnos_total"] == 1

    r = await cliente.patch(f"/alumnos/{a['id_alumno']}", json={"activo": False}, headers=auth(ana))
    assert r.status_code == 200 and r.json()["activo"] is False
    # Su sesión abierta deja de valer en la siguiente petición.
    assert (await cliente.get("/ia/juegos", headers=auth(tok))).status_code == 401
    # No puede volver a entrar ni aparece en la lista del aula.
    login = {"codigo_acceso": a["codigo_acceso"], "id_alumno": a["id_alumno"], "pin": a["pin"]}
    assert (await cliente.post("/alumnos/login", json=login)).status_code == 401
    assert (await cliente.get(f"/alumnos/aula/{a['codigo_acceso']}")).json()["alumnos"] == []
    # Fuera de las métricas, pero sus datos se conservan.
    assert (await _metricas(cliente, ana))["resumen"]["alumnos_total"] == 0
    assert await _registros(a["id_alumno"]) == 1
    # El docente lo sigue viendo en su lista, marcado como inactivo.
    lista = (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"]
    assert [x["activo"] for x in lista] == [False]

    await cliente.patch(f"/alumnos/{a['id_alumno']}", json={"activo": True}, headers=auth(ana))
    assert (await cliente.post("/alumnos/login", json=login)).status_code == 200
    assert (await _metricas(cliente, ana))["resumen"]["alumnos_total"] == 1


# --------------------------------------------------------------- cancelación (borrar)


async def test_borrar_elimina_al_alumno_y_todos_sus_resultados(cliente):
    ana = await crear_docente(cliente)
    a, tok = await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    b, tok_b = await crear_alumno_con_sesion(cliente, ana, nombre="Beto")
    juego = await crear_juego(ana)
    await _jugar(cliente, tok, juego, 100)
    await _jugar(cliente, tok, juego, 60)
    await _jugar(cliente, tok_b, juego, 90)
    assert await _registros(a["id_alumno"]) == 2

    r = await cliente.delete(f"/alumnos/{a['id_alumno']}", headers=auth(ana))
    assert r.status_code == 200 and r.json() == {"eliminado": True, "resultados_borrados": 2}
    assert not await _existe(a["id_alumno"]) and await _registros(a["id_alumno"]) == 0
    # Sus credenciales ya no sirven.
    assert (await cliente.get("/ia/juegos", headers=auth(tok))).status_code == 401
    login = {"codigo_acceso": a["codigo_acceso"], "id_alumno": a["id_alumno"], "pin": a["pin"]}
    assert (await cliente.post("/alumnos/login", json=login)).status_code in (401, 404)
    # Nada más se tocó: el otro alumno y sus resultados siguen ahí.
    assert await _existe(b["id_alumno"]) and await _registros(b["id_alumno"]) == 1
    nombres = [x["nombre_pila"] for x in (await _metricas(cliente, ana))["por_alumno"]]
    assert nombres == ["Beto"]
    # Borrar dos veces: la segunda ya no existe.
    assert (await cliente.delete(f"/alumnos/{a['id_alumno']}", headers=auth(ana))).status_code == 404


async def test_nadie_ajeno_puede_modificar_borrar_ni_ver_datos(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    a, tok = await crear_alumno_con_sesion(cliente, ana)
    id_ = a["id_alumno"]
    assert (await cliente.patch(f"/alumnos/{id_}", json={"activo": False}, headers=auth(beto))).status_code == 404
    assert (await cliente.delete(f"/alumnos/{id_}", headers=auth(beto))).status_code == 404
    assert (await cliente.get(f"/alumnos/{id_}/datos", headers=auth(beto))).status_code == 404
    assert (await cliente.delete(f"/alumnos/{uuid.uuid4()}", headers=auth(ana))).status_code == 404
    # El propio alumno y las peticiones sin sesión tampoco.
    for metodo, ruta in [("PATCH", f"/alumnos/{id_}"), ("DELETE", f"/alumnos/{id_}"), ("GET", f"/alumnos/{id_}/datos")]:
        assert (await cliente.request(metodo, ruta, json={"activo": False} if metodo == "PATCH" else None, headers=auth(tok))).status_code == 403
        assert (await cliente.request(metodo, ruta, json={"activo": False} if metodo == "PATCH" else None)).status_code == 401
    assert await _existe(id_)


# ------------------------------------------------------------------- acceso (datos)


async def test_descargar_los_datos_del_alumno(cliente):
    ana = await crear_docente(cliente)
    a, tok = await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    juego = await crear_juego(ana, titulo="El ciclo del agua")
    await _jugar(cliente, tok, juego, 70)
    r = await cliente.get(f"/alumnos/{a['id_alumno']}/datos", headers=auth(ana))
    assert r.status_code == 200
    datos = r.json()
    assert datos["alumno"]["nombre_pila"] == "Sofía" and datos["alumno"]["codigo_acceso"] == a["codigo_acceso"]
    assert [(x["juego"], x["puntuacion_final"]) for x in datos["resultados"]] == [("El ciclo del agua", 70)]
    # Nunca sale el PIN ni su hash.
    assert "pin_hash" not in r.text and a["pin"] not in datos["alumno"]["pin"] and "$2" not in r.text


# ------------------------------------------------- migración 005 y arranque sin DDL


async def test_migracion_005_es_idempotente_y_el_chequeo_detecta_si_falta():
    sql = (Path(__file__).resolve().parents[2] / "db" / "migraciones" / "005_tablas_ia.sql").read_text(encoding="utf-8")
    async with session.get_db_pool().acquire() as conn:
        await conn.execute(sql)
        await conn.execute(sql)  # segunda vez: no debe fallar ni cambiar nada
        assert await migraciones_pendientes(conn) == []

        class _Deshacer(Exception):
            pass

        with pytest.raises(_Deshacer):
            async with conn.transaction():  # DROP es transaccional: se deshace al final
                await conn.execute("DROP TABLE ia_generaciones_mes")
                assert await migraciones_pendientes(conn) == ["005_tablas_ia.sql"]
                raise _Deshacer
        assert await migraciones_pendientes(conn) == []


def test_el_arranque_ya_no_crea_tablas():
    fuente = (Path(__file__).resolve().parents[1] / "app" / "db" / "session.py").read_text(encoding="utf-8")
    assert "CREATE TABLE" not in fuente and "ALTER TABLE" not in fuente
