"""Resultados de los alumnos (RF-05) y métricas del grupo (RF-06)."""

import asyncio
import json
import uuid

import jwt
import pytest

from app.db import session
from app.routers import resultados
from tests.conftest import auth, crear_docente


def _id(token: str) -> str:
    return jwt.decode(token, options={"verify_signature": False})["sub"]


async def crear_juego(token_docente: str, titulo="El ciclo del agua") -> str:
    """Guarda un juego para el docente directamente en la base (sin gastar la API de Gemini)."""
    contenido = {"titulo": titulo, "instrucciones": "x", "tipo_actividad": "quiz", "preguntas": []}
    async with session.get_db_pool().acquire() as conn:
        return str(
            await conn.fetchval(
                "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego) "
                "VALUES ($1, 'p', $2::jsonb) RETURNING id_juego",
                uuid.UUID(_id(token_docente)),
                json.dumps(contenido),
            )
        )


async def crear_alumno_con_sesion(cliente, token_docente, nombre="Sofía"):
    r = await cliente.post("/alumnos/", json={"nombre_pila": nombre}, headers=auth(token_docente))
    a = r.json()
    r = await cliente.post(
        "/alumnos/login",
        json={"codigo_acceso": a["codigo_acceso"], "id_alumno": a["id_alumno"], "pin": a["pin"]},
    )
    assert r.status_code == 200, r.text
    return a, r.json()["access_token"]


def cuerpo(id_juego, pct=80, seg=45):
    return {"id_juego": id_juego, "puntuacion_final": pct, "tiempo_resolucion": seg}


# ------------------------------------------------------------------ guardar


async def test_sin_sesion_y_docente_no_pueden_guardar_resultados(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    assert (await cliente.post("/resultados/", json=cuerpo(juego))).status_code == 401
    assert (await cliente.post("/resultados/", json=cuerpo(juego), headers=auth(ana))).status_code == 403
    assert (await cliente.get("/resultados/mios", headers=auth(ana))).status_code == 403


async def test_alumno_guarda_intentos_y_el_servidor_numera(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)

    r1 = await cliente.post("/resultados/", json=cuerpo(juego, 60), headers=auth(tok))
    r2 = await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok))
    assert r1.status_code == r2.status_code == 201
    assert (r1.json()["numero_intento"], r2.json()["numero_intento"]) == (1, 2)


async def test_no_se_puede_guardar_resultado_de_juego_ajeno_ni_inexistente(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    juego_de_beto = await crear_juego(beto)
    _, tok = await crear_alumno_con_sesion(cliente, ana)

    assert (await cliente.post("/resultados/", json=cuerpo(juego_de_beto), headers=auth(tok))).status_code == 404
    assert (await cliente.post("/resultados/", json=cuerpo(str(uuid.uuid4())), headers=auth(tok))).status_code == 404


@pytest.mark.parametrize(
    "cambio",
    [{"puntuacion_final": 101}, {"puntuacion_final": -1}, {"tiempo_resolucion": -5}, {"tiempo_resolucion": 7201},
     {"id_juego": "no-es-uuid"}, {"puntuacion_final": "alto"}],
)
async def test_validacion_de_resultados(cliente, cambio):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    r = await cliente.post("/resultados/", json={**cuerpo(juego), **cambio}, headers=auth(tok))
    assert r.status_code == 422


async def test_el_alumno_no_puede_registrar_a_nombre_de_otro(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    luis, _ = await crear_alumno_con_sesion(cliente, ana, "Luis")
    r = await cliente.post(
        "/resultados/", json={**cuerpo(juego), "id_alumno": luis["id_alumno"]}, headers=auth(tok_sofia)
    )
    assert r.status_code == 201
    async with session.get_db_pool().acquire() as conn:
        dueno = await conn.fetchval("SELECT id_alumno FROM registro_avances")
    assert str(dueno) == sofia["id_alumno"]


async def test_envios_simultaneos_no_repiten_numero_de_intento(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    respuestas = await asyncio.gather(
        *[cliente.post("/resultados/", json=cuerpo(juego, 50 + i), headers=auth(tok)) for i in range(6)]
    )
    assert all(r.status_code == 201 for r in respuestas), [r.text for r in respuestas]
    assert sorted(r.json()["numero_intento"] for r in respuestas) == [1, 2, 3, 4, 5, 6]


async def test_tope_de_resultados_por_hora(cliente, monkeypatch):
    monkeypatch.setattr(resultados._limite_resultados, "maximo", 3)
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    estados = [(await cliente.post("/resultados/", json=cuerpo(juego), headers=auth(tok))).status_code for _ in range(5)]
    assert estados == [201, 201, 201, 429, 429]


async def test_borrar_el_juego_borra_sus_resultados(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    await cliente.post("/resultados/", json=cuerpo(juego), headers=auth(tok))
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("DELETE FROM juegos_generados")
        assert await conn.fetchval("SELECT COUNT(*) FROM registro_avances") == 0


# --------------------------------------------------------------------- puntos


async def test_puntos_suman_el_mejor_intento_por_juego(cliente):
    ana = await crear_docente(cliente)
    j1, j2 = await crear_juego(ana, "Uno"), await crear_juego(ana, "Dos")
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    vacio = (await cliente.get("/resultados/mios", headers=auth(tok))).json()
    assert vacio["puntos_totales"] == 0 and vacio["juegos_jugados"] == 0

    for pct in (40, 100, 70):  # repetir el juego no suma de más: cuenta el mejor (100 → 10 puntos)
        await cliente.post("/resultados/", json=cuerpo(j1, pct), headers=auth(tok))
    await cliente.post("/resultados/", json=cuerpo(j2, 67), headers=auth(tok))  # 67 → 7 puntos

    r = (await cliente.get("/resultados/mios", headers=auth(tok))).json()
    assert r["puntos_totales"] == 17 and r["juegos_jugados"] == 2
    por_juego = {x["id_juego"]: x for x in r["por_juego"]}
    assert por_juego[j1]["mejor"] == 100 and por_juego[j1]["intentos"] == 3


async def test_cada_alumno_ve_solo_sus_puntos(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana)
    _, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    _, tok_luis = await crear_alumno_con_sesion(cliente, ana, "Luis")
    await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok_sofia))
    assert (await cliente.get("/resultados/mios", headers=auth(tok_luis))).json()["puntos_totales"] == 0


# ------------------------------------------------------------------- métricas


async def test_metricas_exigen_ser_docente(cliente):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    assert (await cliente.get("/metricas/grupo")).status_code == 401
    assert (await cliente.get("/metricas/grupo", headers=auth(tok))).status_code == 403


async def test_metricas_del_grupo(cliente):
    ana = await crear_docente(cliente)
    juego = await crear_juego(ana, "El ciclo del agua")
    await crear_juego(ana, "Sin jugar todavía")
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    luis, tok_luis = await crear_alumno_con_sesion(cliente, ana, "Luis")
    await cliente.post("/alumnos/", json={"nombre_pila": "Mara"}, headers=auth(ana))  # nunca juega

    for pct, seg in ((100, 30), (80, 50)):
        await cliente.post("/resultados/", json=cuerpo(juego, pct, seg), headers=auth(tok_sofia))
    await cliente.post("/resultados/", json=cuerpo(juego, 20, 100), headers=auth(tok_luis))

    m = (await cliente.get("/metricas/grupo", headers=auth(ana))).json()
    assert m["umbral_apoyo"] == 60
    assert m["resumen"] == {
        "intentos": 3, "alumnos_que_jugaron": 2, "promedio_puntuacion": 67,
        "tiempo_promedio_seg": 60, "alumnos_total": 3,
    }
    juegos = {j["titulo"]: j for j in m["por_juego"]}
    assert juegos["El ciclo del agua"]["intentos"] == 3 and juegos["El ciclo del agua"]["alumnos"] == 2
    assert juegos["Sin jugar todavía"]["intentos"] == 0 and juegos["Sin jugar todavía"]["promedio_puntuacion"] is None

    alumnos = {a["nombre_pila"]: a for a in m["por_alumno"]}
    assert alumnos["Sofía"]["promedio_puntuacion"] == 90 and alumnos["Sofía"]["necesita_apoyo"] is False
    assert alumnos["Luis"]["promedio_puntuacion"] == 20 and alumnos["Luis"]["necesita_apoyo"] is True
    assert alumnos["Mara"]["intentos"] == 0 and alumnos["Mara"]["necesita_apoyo"] is False
    assert alumnos["Sofía"]["ultimo_intento"] is not None


async def test_metricas_no_mezclan_grupos_de_docentes(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    juego_ana = await crear_juego(ana)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    await cliente.post("/resultados/", json=cuerpo(juego_ana, 90), headers=auth(tok))

    m = (await cliente.get("/metricas/grupo", headers=auth(beto))).json()
    assert m["resumen"]["intentos"] == 0 and m["resumen"]["alumnos_total"] == 0
    assert m["por_juego"] == [] and m["por_alumno"] == []
