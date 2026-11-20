"""Equipos 2.0: misiones de varios juegos, modo «roles» e insignia «Equipo estrella»."""

import json
import uuid

import pytest

from app.db import session
from tests.conftest import auth, crear_docente
from tests.test_equipos import escenario, jugar, nuevo_equipo, poner
from tests.test_grupos import alumno_en, nuevo_grupo
from tests.test_resultados import crear_juego


async def lanzar2(cliente, token, id_grupo, ids, meta=70, modo="todos"):
    return await cliente.post(
        "/equipos/misiones", json={"id_grupo": id_grupo, "ids_juegos": ids, "meta": meta, "modo": modo}, headers=auth(token)
    )


async def ver(cliente, token, id_grupo):
    return (await cliente.get(f"/equipos/misiones?id_grupo={id_grupo}", headers=auth(token))).json()


async def mi_mision(cliente, tok_alumno):
    return (await cliente.get("/equipos/mi-mision", headers=auth(tok_alumno))).json()


def equipo(mision, nombre):
    return next(e for e in mision["equipos"] if e["nombre"] == nombre)


async def insignias(cliente, tok_alumno) -> dict:
    logros = (await cliente.get("/resultados/mios", headers=auth(tok_alumno))).json()["logros"]
    return {i["id"]: i for i in logros["insignias"]}


# ------------------------------------------------------------------ varios juegos, modo «todos»


async def test_mision_con_varios_juegos_promedia_todas_las_partes(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    juego2 = await crear_juego(ana, "El ciclo del agua")
    (_, tok_s), (_, tok_m) = alumnos[0], alumnos[1]
    r = await lanzar2(cliente, ana, g["id_grupo"], [juego, juego2], meta=50)
    assert r.status_code == 201, r.text
    mision = r.json()
    assert mision["modo"] == "todos" and [j["titulo"] for j in mision["juegos"]] == ["Los seres vivos", "El ciclo del agua"]
    assert equipo(mision, "Águilas")["progreso"] == 0

    # Águilas: 2 integrantes x 2 juegos = 4 partes.
    await jugar(cliente, tok_s, juego, 100)
    aguilas = equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")
    assert aguilas["progreso"] == 25 and aguilas["ya_jugaron"] == 0  # Sofía aún no terminó TODOS los juegos
    await jugar(cliente, tok_s, juego2, 100)
    aguilas = equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")
    assert aguilas["progreso"] == 50 and aguilas["ya_jugaron"] == 1 and aguilas["meta_lograda"]
    await jugar(cliente, tok_m, juego, 100)
    aguilas = equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")
    assert aguilas["progreso"] == 75 and aguilas["ya_jugaron"] == 1
    por_juego = {p["titulo"]: (p["listos"], p["asignados"]) for p in aguilas["por_juego"]}
    assert por_juego == {"Los seres vivos": (2, 2), "El ciclo del agua": (1, 2)}


async def test_el_alumno_ve_todos_los_juegos_de_la_mision_y_cuales_ya_hizo(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    juego2 = await crear_juego(ana, "El ciclo del agua")
    tok_s = alumnos[0][1]
    await lanzar2(cliente, ana, g["id_grupo"], [juego, juego2])
    m = (await mi_mision(cliente, tok_s))["mision"]
    assert [(j["titulo"], j["hecho"]) for j in m["juegos"]] == [("Los seres vivos", False), ("El ciclo del agua", False)]
    assert m["id_juego"] == juego and m["yo_ya_jugue"] is False
    await jugar(cliente, tok_s, juego, 80)
    m = (await mi_mision(cliente, tok_s))["mision"]
    assert [j["hecho"] for j in m["juegos"]] == [True, False]
    assert m["id_juego"] == juego2 and m["yo_ya_jugue"] is False  # «el que sigue» es el pendiente
    await jugar(cliente, tok_s, juego2, 80)
    m = (await mi_mision(cliente, tok_s))["mision"]
    assert all(j["hecho"] for j in m["juegos"]) and m["yo_ya_jugue"] is True


async def test_una_mision_de_un_solo_juego_sigue_funcionando_como_antes(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    r = await cliente.post("/equipos/misiones", json={"id_grupo": g["id_grupo"], "id_juego": juego, "meta": 70}, headers=auth(ana))
    assert r.status_code == 201
    assert r.json()["modo"] == "todos" and len(r.json()["juegos"]) == 1 and r.json()["id_juego"] == juego


# ------------------------------------------------------------------ modo «roles»


async def _juego_de(cliente, tok_alumno) -> str:
    m = (await mi_mision(cliente, tok_alumno))["mision"]
    assert len(m["juegos"]) == 1  # en modo «roles» solo ve SU parte
    return m["juegos"][0]["id_juego"]


async def test_en_modo_roles_a_cada_integrante_le_toca_un_juego_distinto(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    juego2 = await crear_juego(ana, "El ciclo del agua")
    (_, tok_s), (_, tok_m) = alumnos[0], alumnos[1]
    r = await lanzar2(cliente, ana, g["id_grupo"], [juego, juego2], meta=50, modo="roles")
    assert r.status_code == 201 and r.json()["modo"] == "roles"
    parte_s, parte_m = await _juego_de(cliente, tok_s), await _juego_de(cliente, tok_m)
    assert {parte_s, parte_m} == {juego, juego2}
    assert await _juego_de(cliente, tok_s) == parte_s  # el reparto no cambia entre consultas

    # Jugar el juego que le tocó a otro NO cuenta: la parte de Sofía es solo la suya.
    await jugar(cliente, tok_s, parte_m, 100)
    assert equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")["progreso"] == 0
    await jugar(cliente, tok_s, parte_s, 100)
    aguilas = equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")
    assert aguilas["progreso"] == 50 and aguilas["ya_jugaron"] == 1 and aguilas["meta_lograda"]
    await jugar(cliente, tok_m, parte_m, 100)
    aguilas = equipo((await ver(cliente, ana, g["id_grupo"]))["mision"], "Águilas")
    assert aguilas["progreso"] == 100 and aguilas["ya_jugaron"] == 2
    assert {p["titulo"]: (p["listos"], p["asignados"]) for p in aguilas["por_juego"]} == {"Los seres vivos": (1, 1), "El ciclo del agua": (1, 1)}


async def test_roles_exige_equipos_con_suficientes_integrantes(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    j2, j3 = await crear_juego(ana, "Dos"), await crear_juego(ana, "Tres")
    r = await lanzar2(cliente, ana, g["id_grupo"], [juego, j2, j3], modo="roles")  # equipos de 2, tres juegos
    assert r.status_code == 409 and "al menos 3" in r.json()["detail"] and "Águilas" in r.json()["detail"]
    assert (await ver(cliente, ana, g["id_grupo"]))["mision"] is None  # no quedó nada a medias


@pytest.mark.parametrize("nombre,ids,modo", [
    ("sin_juegos", [], "todos"),
    ("repetidos", ["A", "A"], "todos"),
    ("roles_con_uno", ["A"], "roles"),
    ("demasiados", ["A", "B", "C", "D", "E", "F"], "todos"),
    ("modo_raro", ["A"], "equipos"),
])
async def test_datos_de_la_mision_invalidos(cliente, nombre, ids, modo):
    ana, g, _, juego, _, _ = await escenario(cliente)
    # «A»..«F» se sustituyen por actividades reales (algunas repetidas a propósito).
    reales = {letra: await crear_juego(ana, f"Juego {letra}") for letra in "ABCDEF"}
    r = await lanzar2(cliente, ana, g["id_grupo"], [reales[i] for i in ids], modo=modo)
    assert r.status_code == 422, (nombre, r.text)


async def test_todas_las_actividades_deben_ser_del_docente_aprobadas_y_del_grupo(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    luis = await crear_docente(cliente, "luis@escuela.mx", "Luis Ríos")
    ajeno = await crear_juego(luis, "De otro docente")
    async with session.get_db_pool().acquire() as conn:
        borrador = await conn.fetchval(
            "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego, estado) VALUES ($1, 'p', '{\"titulo\": \"B\"}', 'borrador') RETURNING id_juego",
            uuid.UUID((await cliente.get("/docentes/yo", headers=auth(ana))).json()["id_docente"]),
        )
    for malo in (ajeno, str(borrador)):
        r = await lanzar2(cliente, ana, g["id_grupo"], [juego, malo])
        assert r.status_code == 409 and "Todas las actividades" in r.json()["detail"]


# ------------------------------------------------------------------ insignia «Equipo estrella»


async def test_quien_aporta_a_un_equipo_que_llega_a_la_meta_gana_la_insignia(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    (_, tok_s), (_, tok_m), (_, tok_l) = alumnos[0], alumnos[1], alumnos[2]
    await lanzar2(cliente, ana, g["id_grupo"], [juego], meta=60)
    assert (await insignias(cliente, tok_s))["equipo_estrella"]["obtenida"] is False
    await jugar(cliente, tok_s, juego, 100)  # (100 + 0) / 2 = 50 < 60
    assert (await insignias(cliente, tok_s))["equipo_estrella"]["obtenida"] is False
    await jugar(cliente, tok_m, juego, 40)   # (100 + 40) / 2 = 70
    m = (await mi_mision(cliente, tok_s))["mision"]  # consultar la misión anota el logro
    assert m["mi_equipo"]["meta_lograda"] and m["insignia_ganada"] is True
    assert (await insignias(cliente, tok_s))["equipo_estrella"]["obtenida"] is True
    assert (await insignias(cliente, tok_m))["equipo_estrella"]["obtenida"] is True
    assert (await insignias(cliente, tok_l))["equipo_estrella"]["obtenida"] is False  # otro equipo, no llegó


async def test_quien_no_jugo_nada_no_se_lleva_el_logro_del_equipo(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    (_, tok_s), (_, tok_m) = alumnos[0], alumnos[1]
    await lanzar2(cliente, ana, g["id_grupo"], [juego], meta=50)
    await jugar(cliente, tok_s, juego, 100)  # el promedio llega a 50 solo con lo de Sofía
    assert (await mi_mision(cliente, tok_s))["mision"]["insignia_ganada"] is True
    assert (await mi_mision(cliente, tok_m))["mision"]["insignia_ganada"] is False
    assert (await insignias(cliente, tok_m))["equipo_estrella"]["obtenida"] is False
    # Cuando Mateo sí aporta, la gana.
    await jugar(cliente, tok_m, juego, 10)
    assert (await mi_mision(cliente, tok_m))["mision"]["insignia_ganada"] is True


async def test_en_modo_roles_solo_gana_quien_cumplio_su_parte(cliente):
    ana, g, alumnos, juego, a, _ = await escenario(cliente)
    j2 = await crear_juego(ana, "El ciclo del agua")
    (_, tok_s), (_, tok_m) = alumnos[0], alumnos[1]
    await lanzar2(cliente, ana, g["id_grupo"], [juego, j2], meta=50, modo="roles")
    parte_s = await _juego_de(cliente, tok_s)
    await jugar(cliente, tok_s, parte_s, 100)  # (100 + 0) / 2 = 50 = meta
    assert (await mi_mision(cliente, tok_s))["mision"]["insignia_ganada"] is True
    assert (await mi_mision(cliente, tok_m))["mision"]["insignia_ganada"] is False


async def test_el_logro_se_anota_al_cerrar_y_no_se_pierde_si_el_equipo_cambia(cliente):
    ana, g, alumnos, juego, a, _ = await escenario(cliente)
    (_, tok_s) = alumnos[0]
    r = await lanzar2(cliente, ana, g["id_grupo"], [juego], meta=50)
    await jugar(cliente, tok_s, juego, 100)  # nadie consulta la misión: el logro se anota al cerrarla
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM misiones_logradas") == 0
    assert (await cliente.post(f"/equipos/misiones/{r.json()['id_reto']}/cerrar", headers=auth(ana))).status_code == 200
    assert (await insignias(cliente, tok_s))["equipo_estrella"]["obtenida"] is True
    # Se deshace el equipo: la insignia ya es de Sofía.
    assert (await cliente.delete(f"/equipos/{a['id_equipo']}", headers=auth(ana))).status_code == 200
    assert (await insignias(cliente, tok_s))["equipo_estrella"]["obtenida"] is True


async def test_la_insignia_cuenta_misiones_de_otros_grupos_y_se_borra_con_el_alumno(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    (sofia, tok_s) = alumnos[0]
    await lanzar2(cliente, ana, g["id_grupo"], [juego], meta=50)
    await jugar(cliente, tok_s, juego, 100)
    await mi_mision(cliente, tok_s)
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM misiones_logradas WHERE id_alumno = $1", uuid.UUID(sofia["id_alumno"])) == 1
        await conn.execute("DELETE FROM alumnos WHERE id_alumno = $1", uuid.UUID(sofia["id_alumno"]))
        assert await conn.fetchval("SELECT COUNT(*) FROM misiones_logradas") == 0  # derecho a borrar: no queda rastro


# ------------------------------------------------------------------ privacidad


async def test_el_alumno_no_recibe_identificadores_ni_datos_de_companeros(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    j2 = await crear_juego(ana, "El ciclo del agua")
    (sofia, tok_s), (mateo, tok_m) = alumnos[0], alumnos[1]
    await lanzar2(cliente, ana, g["id_grupo"], [juego, j2], meta=50, modo="roles")
    await jugar(cliente, tok_m, await _juego_de(cliente, tok_m), 90)
    r = await cliente.get("/equipos/mi-mision", headers=auth(tok_s))
    assert r.status_code == 200
    texto = r.text
    for otro in (mateo["id_alumno"], alumnos[2][0]["id_alumno"], alumnos[3][0]["id_alumno"], "Mateo", "Lucía", "Diego"):
        assert otro not in texto
    assert "_partes_de" not in texto and "_mejores" not in texto and "por_juego" not in texto
    # El docente tampoco recibe los datos internos (sí ve nombres de equipos, no identificadores de alumnos en la misión).
    docente = json.dumps((await ver(cliente, ana, g["id_grupo"])), default=str)
    assert "_partes_de" not in docente and "_mejores" not in docente and sofia["id_alumno"] not in docente


async def test_solo_el_docente_del_grupo_puede_lanzar_misiones_de_varios_juegos(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    luis = await crear_docente(cliente, "luis@escuela.mx", "Luis Ríos")
    assert (await lanzar2(cliente, luis, g["id_grupo"], [juego])).status_code == 404
    assert (await cliente.post("/equipos/misiones", json={"id_grupo": g["id_grupo"], "ids_juegos": [juego]})).status_code == 401
