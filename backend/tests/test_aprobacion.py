"""Aprobación del docente: el juego de la IA nace en borrador y el alumno solo ve los aprobados."""

import json
import uuid
from pathlib import Path

import jwt
import pytest

from app.db import session
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso, _quiz
from tests.test_resultados import crear_alumno_con_sesion, cuerpo


async def _generar(cliente, monkeypatch, token, juego=None):
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso([juego or _quiz()], []))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "plantas"}, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["id_juego"]


async def _estado(cliente, token, id_juego, estado):
    return await cliente.post(f"/ia/juegos/{id_juego}/estado", json={"estado": estado}, headers=auth(token))


async def _lista(cliente, token, **params):
    r = await cliente.get("/ia/juegos", params=params, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()["juegos"]


async def test_juego_generado_nace_en_borrador_y_el_alumno_no_lo_ve(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso([_quiz()], []))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas"}, headers=auth(ana))
    assert r.status_code == 200, r.text
    assert r.json()["estado"] == "borrador"
    assert [j["estado"] for j in await _lista(cliente, ana)] == ["borrador"]
    assert await _lista(cliente, tok) == []


async def test_aprobar_lo_muestra_al_alumno_sin_datos_internos(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = await _generar(cliente, monkeypatch, ana)
    r = await _estado(cliente, ana, jid, "aprobado")
    assert r.status_code == 200 and r.json()["estado"] == "aprobado" and r.json()["fecha_aprobacion"]
    juegos = await _lista(cliente, tok)
    assert len(juegos) == 1
    assert not {"prompt_original", "estado", "fecha_aprobacion"} & set(juegos[0])
    # Retirarlo (volver a borrador) lo oculta otra vez.
    assert (await _estado(cliente, ana, jid, "borrador")).json()["fecha_aprobacion"] is None
    assert await _lista(cliente, tok) == []


async def test_descartar_y_restaurar(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = await _generar(cliente, monkeypatch, ana)
    await _estado(cliente, ana, jid, "aprobado")
    assert (await _estado(cliente, ana, jid, "descartado")).status_code == 200
    assert await _lista(cliente, ana) == []
    assert len(await _lista(cliente, ana, estado="descartado")) == 1
    assert await _lista(cliente, tok) == []
    assert (await _estado(cliente, ana, jid, "borrador")).status_code == 200
    assert len(await _lista(cliente, ana)) == 1


async def test_estado_invalido_o_ajeno_o_de_alumno(cliente, monkeypatch):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = await _generar(cliente, monkeypatch, ana)
    assert (await _estado(cliente, ana, jid, "publicado")).status_code == 422
    assert (await _estado(cliente, beto, jid, "aprobado")).status_code == 404
    assert (await _estado(cliente, tok, jid, "aprobado")).status_code == 403
    assert (await _estado(cliente, ana, str(uuid.uuid4()), "aprobado")).status_code == 404
    assert (await cliente.put(f"/ia/juegos/{jid}", json=_quiz(), headers=auth(beto))).status_code == 404
    assert (await cliente.put(f"/ia/juegos/{jid}", json=_quiz(), headers=auth(tok))).status_code == 403
    assert (await _lista(cliente, ana))[0]["estado"] == "borrador"


async def test_no_se_aprueba_un_contenido_guardado_invalido(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    jid = await _generar(cliente, monkeypatch, ana)
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE juegos_generados SET contenido_juego = '{\"titulo\": \"x\"}'::jsonb")
    r = await _estado(cliente, ana, jid, "aprobado")
    assert r.status_code == 422 and "no se puede aprobar" in r.json()["detail"]
    assert (await _lista(cliente, ana))[0]["estado"] == "borrador"


async def test_editar_valida_igual_que_la_ia(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    jid = await _generar(cliente, monkeypatch, ana)
    r = await cliente.put(f"/ia/juegos/{jid}", json=_quiz(opciones=3), headers=auth(ana))
    assert r.status_code == 422
    nuevo = _quiz()
    nuevo["titulo"] = "Título corregido"
    r = await cliente.put(f"/ia/juegos/{jid}", json=nuevo, headers=auth(ana))
    assert r.status_code == 200 and r.json()["juego"]["titulo"] == "Título corregido"
    guardado = (await _lista(cliente, ana))[0]["contenido_juego"]
    guardado = json.loads(guardado) if isinstance(guardado, str) else guardado
    assert guardado["titulo"] == "Título corregido"


async def test_no_se_puede_cambiar_el_tipo_de_actividad(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    jid = await _generar(cliente, monkeypatch, ana)
    otro = {
        "titulo": "VF", "instrucciones": "x", "tipo_actividad": "verdadero_falso",
        "preguntas": [{"afirmacion": f"a{i}", "es_verdadera": True} for i in range(3)],
    }
    r = await cliente.put(f"/ia/juegos/{jid}", json=otro, headers=auth(ana))
    assert r.status_code in (400, 422)


async def test_editar_un_aprobado_lo_regresa_a_borrador(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = await _generar(cliente, monkeypatch, ana)
    await _estado(cliente, ana, jid, "aprobado")
    assert len(await _lista(cliente, tok)) == 1
    r = await cliente.put(f"/ia/juegos/{jid}", json=_quiz(), headers=auth(ana))
    assert r.json()["estado"] == "borrador"
    assert await _lista(cliente, tok) == []


async def test_no_se_edita_un_descartado(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    jid = await _generar(cliente, monkeypatch, ana)
    await _estado(cliente, ana, jid, "descartado")
    r = await cliente.put(f"/ia/juegos/{jid}", json=_quiz(), headers=auth(ana))
    assert r.status_code == 409


async def test_resultados_solo_de_juegos_aprobados(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = await _generar(cliente, monkeypatch, ana)
    r = await cliente.post("/resultados/", json=cuerpo(jid, 100, 30), headers=auth(tok))
    assert r.status_code == 404
    await _estado(cliente, ana, jid, "aprobado")
    r = await cliente.post("/resultados/", json=cuerpo(jid, 100, 30), headers=auth(tok))
    assert r.status_code in (200, 201), r.text


async def test_metricas_no_cuentan_borradores_sin_intentos(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    borrador = await _generar(cliente, monkeypatch, ana)
    aprobado = await _generar(cliente, monkeypatch, ana, {**_quiz(), "titulo": "Aprobado"})
    await _estado(cliente, ana, aprobado, "aprobado")
    await cliente.post("/resultados/", json=cuerpo(aprobado, 80, 20), headers=auth(tok))
    titulos = [j["titulo"] for j in (await cliente.get("/metricas/grupo", headers=auth(ana))).json()["por_juego"]]
    assert titulos == ["Aprobado"]
    # Si se retira un juego que ya tiene intentos, sigue apareciendo (no se pierde el historial).
    await _estado(cliente, ana, aprobado, "borrador")
    titulos = [j["titulo"] for j in (await cliente.get("/metricas/grupo", headers=auth(ana))).json()["por_juego"]]
    assert titulos == ["Aprobado"] and borrador


async def test_migracion_004_es_idempotente_y_aprueba_lo_viejo(cliente):
    sql = (Path(__file__).resolve().parents[2] / "db" / "migraciones" / "004_aprobacion.sql").read_text(encoding="utf-8")
    ana = await crear_docente(cliente)
    id_ana = uuid.UUID(jwt.decode(ana, options={"verify_signature": False})["sub"])
    async with session.get_db_pool().acquire() as conn:
        try:
            await conn.execute("ALTER TABLE juegos_generados DROP CONSTRAINT IF EXISTS ck_juegos_estado")
            await conn.execute("DROP INDEX IF EXISTS idx_juegos_docente_estado")
            await conn.execute("ALTER TABLE juegos_generados DROP COLUMN estado, DROP COLUMN fecha_aprobacion")
            viejo = await conn.fetchval(
                "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego) "
                "VALUES ($1, 'p', '{}'::jsonb) RETURNING id_juego", id_ana)
            await conn.execute(sql)
            await conn.execute(sql)  # segunda vez: no debe fallar
            assert await conn.fetchval("SELECT estado FROM juegos_generados WHERE id_juego = $1", viejo) == "aprobado"
            assert await conn.fetchval("SELECT fecha_aprobacion IS NOT NULL FROM juegos_generados WHERE id_juego = $1", viejo)
            nuevo = await conn.fetchval(
                "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego) "
                "VALUES ($1, 'p', '{}'::jsonb) RETURNING estado", id_ana)
            assert nuevo == "borrador"
            with pytest.raises(Exception):
                await conn.execute("UPDATE juegos_generados SET estado = 'raro'")
        finally:
            await conn.execute(sql)
