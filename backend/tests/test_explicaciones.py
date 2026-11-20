"""«¿Por qué?»: cada reto puede traer una explicación que el alumno lee después de responder."""

import json

import pytest

from app.ia import demo, gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso, _generar, _quiz


def _con_explicacion(texto):
    juego = _quiz()
    for pregunta in juego["preguntas"]:
        pregunta["explicacion"] = texto
    return juego


async def test_la_explicacion_de_la_ia_se_guarda_y_llega_al_docente(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_con_explicacion("Porque la raíz absorbe agua.")])
    assert r.status_code == 200
    assert all(p["explicacion"] == "Porque la raíz absorbe agua." for p in r.json()["juego"]["preguntas"])


async def test_la_explicacion_es_opcional(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_quiz()])  # sin explicacion: los juegos viejos siguen valiendo
    assert r.status_code == 200
    assert all(not p.get("explicacion") for p in r.json()["juego"]["preguntas"])


async def test_una_explicacion_muy_larga_se_recorta(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_con_explicacion("x" * 900)])
    assert r.status_code == 200 and len(llamadas) == 1  # no se gastó un reintento por esto
    assert all(len(p["explicacion"]) == 400 for p in r.json()["juego"]["preguntas"])


@pytest.mark.parametrize("raro", ["", "   ", None, 7, ["a"]])
async def test_una_explicacion_vacia_o_rara_se_descarta_sin_rechazar_el_juego(cliente, monkeypatch, raro):
    r, llamadas = await _generar(cliente, monkeypatch, [_con_explicacion(raro)])
    assert r.status_code == 200 and len(llamadas) == 1
    assert all("explicacion" not in p for p in r.json()["juego"]["preguntas"])


async def test_el_prompt_le_pide_a_la_ia_la_explicacion(cliente, monkeypatch):
    _, llamadas = await _generar(cliente, monkeypatch, [_quiz()])
    assert "explicacion" in llamadas[0]["contents"]


async def test_el_docente_puede_editar_la_explicacion_y_otro_docente_no(cliente, monkeypatch):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], llamadas))
    ana = await crear_docente(cliente, "ana@escuela.mx")
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas", "tipo_actividad": "quiz"}, headers=auth(ana))
    assert r.status_code == 200
    jid, editado = r.json()["id_juego"], r.json()["juego"]
    for pregunta in editado["preguntas"]:
        pregunta["explicacion"] = "Texto escrito por la docente."

    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    assert (await cliente.put(f"/ia/juegos/{jid}", json=editado, headers=auth(beto))).status_code == 404

    assert (await cliente.put(f"/ia/juegos/{jid}", json=editado, headers=auth(ana))).status_code == 200
    lista = (await cliente.get("/ia/juegos?estado=borrador", headers=auth(ana))).json()["juegos"]
    contenido = next(j for j in lista if j["id_juego"] == jid)["contenido_juego"]
    if isinstance(contenido, str):
        contenido = json.loads(contenido)
    assert all(p["explicacion"] == "Texto escrito por la docente." for p in contenido["preguntas"])


@pytest.mark.parametrize("tipo", sorted(demo._RETOS))
def test_el_modo_demo_trae_explicacion_en_todos_los_tipos_y_el_juego_es_valido(tipo):
    assert all(reto.get("explicacion") for reto in demo._RETOS[tipo])
    # Pasa por la misma validación que el contenido de la IA real.
    ia._interpretar_juego(json.dumps(demo._juego(tipo, "Tema")), tipo)
