"""Clases interactivas: secciones con mini-retos y evaluación final, generadas desde una sesión."""

import copy

import pytest

from app.ia import gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_aprobacion import _estado, _lista
from tests.test_ia import _cliente_falso, _quiz
from tests.test_resultados import crear_alumno_con_sesion, cuerpo


def _seccion(i=0, mini="quiz"):
    reto = (
        {"tipo": "quiz", "pregunta": f"¿Pregunta {i}?", "opciones": ["a", "b", "c", "d"], "correcta": 1}
        if mini == "quiz"
        else {"tipo": "verdadero_falso", "afirmacion": f"Afirmación {i}", "correcta": True, "explicacion": "Porque sí."}
    )
    return {"titulo": f"Parte {i}", "explicacion": "Las plantas fabrican su alimento.", "ejemplo": "Un frijol que crece.", "mini_reto": reto}


def _clase(n=3, evaluacion=None):
    return {
        "titulo": "Las plantas",
        "instrucciones": "Avanza con el botón.",
        "tipo_actividad": "clase",
        "secciones": [_seccion(i, "quiz" if i % 2 == 0 else "vf") for i in range(n)],
        "evaluacion": evaluacion or _quiz(n=4),
    }


async def _sesion(cliente, token, contexto="Fotosíntesis: las plantas usan luz, agua y aire."):
    r = await cliente.post(
        "/ia/sesiones",
        json={"titulo": "Plantas", "tema": "La fotosíntesis", "material_nombre": "libro.pdf", "contexto": contexto},
        headers=auth(token),
    )
    assert r.status_code == 201, r.text
    return r.json()["id_sesion"]


async def _clase_generada(cliente, monkeypatch, token, respuestas=None, llamadas=None, **extra):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso(respuestas if respuestas is not None else [_clase()], llamadas if llamadas is not None else []))
    id_sesion = await _sesion(cliente, token)
    return await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion, **extra}, headers=auth(token))


async def test_genera_clase_en_borrador_con_el_material_en_el_prompt(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    llamadas = []
    r = await _clase_generada(cliente, monkeypatch, ana, llamadas=llamadas)
    assert r.status_code == 200, r.text
    datos = r.json()
    assert datos["estado"] == "borrador" and datos["juego"]["tipo_actividad"] == "clase"
    assert len(datos["juego"]["secciones"]) == 3 and datos["juego"]["evaluacion"]["tipo_actividad"] == "quiz"
    assert "las plantas usan luz" in llamadas[0]["contents"] and "La fotosíntesis" in llamadas[0]["contents"]
    assert llamadas[0]["config"].max_output_tokens == 8192
    assert await _lista(cliente, tok) == []  # el alumno no ve borradores


async def test_clase_aprobada_la_ve_el_alumno_y_guarda_resultado_de_la_evaluacion(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    jid = (await _clase_generada(cliente, monkeypatch, ana)).json()["id_juego"]
    assert (await _estado(cliente, ana, jid, "aprobado")).status_code == 200
    juegos = await _lista(cliente, tok)
    assert len(juegos) == 1 and "prompt_original" not in juegos[0]
    r = await cliente.post("/resultados/", json=cuerpo(jid, 75, 120), headers=auth(tok))
    assert r.status_code in (200, 201), r.text


async def test_sesion_ajena_inexistente_o_alumno(cliente, monkeypatch):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    _, tok = await crear_alumno_con_sesion(cliente, ana)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_clase()], []))
    id_sesion = await _sesion(cliente, ana)
    assert (await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion}, headers=auth(beto))).status_code == 404
    assert (await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion}, headers=auth(tok))).status_code == 403
    assert (await cliente.post("/ia/generar-clase", json={}, headers=auth(ana))).status_code == 422
    assert (await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion, "tipo_evaluacion": "sorpresa"}, headers=auth(ana))).status_code == 422


async def test_se_recortan_secciones_y_retos_sobrantes(cliente, monkeypatch):
    clase = _clase(n=5)
    clase["secciones"] += [_seccion(9), _seccion(10)]
    clase["evaluacion"] = _quiz(n=7)
    ana = await crear_docente(cliente)
    r = await _clase_generada(cliente, monkeypatch, ana, [clase])
    assert r.status_code == 200, r.text
    assert len(r.json()["juego"]["secciones"]) == 5 and len(r.json()["juego"]["evaluacion"]["preguntas"]) == 5


@pytest.mark.parametrize("dano", ["mini_reto_raro", "evaluacion_de_otro_tipo", "sin_evaluacion", "pocas_secciones"])
async def test_clase_invalida_reintenta_y_devuelve_credito(cliente, monkeypatch, dano):
    mala = copy.deepcopy(_clase())
    if dano == "mini_reto_raro":
        mala["secciones"][0]["mini_reto"]["tipo"] = "memoria"
    elif dano == "evaluacion_de_otro_tipo":
        mala["evaluacion"] = {
            "titulo": "VF", "instrucciones": "x", "tipo_actividad": "verdadero_falso",
            "preguntas": [{"afirmacion": f"a{i}", "correcta": True, "explicacion": "e"} for i in range(3)],
        }
    elif dano == "sin_evaluacion":
        del mala["evaluacion"]
    else:
        mala["secciones"] = mala["secciones"][:2]
    ana = await crear_docente(cliente)
    llamadas = []
    r = await _clase_generada(cliente, monkeypatch, ana, [mala] * 6, llamadas)
    assert r.status_code == 502, r.text
    assert len(llamadas) > 1  # reintentó con retroalimentación
    uso = (await cliente.get("/ia/uso", headers=auth(ana))).json()
    assert uso["usadas"] == 0
    assert await _lista(cliente, ana) == []


async def test_clase_se_corrige_con_un_reintento(cliente, monkeypatch):
    mala = _clase()
    mala["secciones"][0]["mini_reto"]["tipo"] = "memoria"
    ana = await crear_docente(cliente)
    llamadas = []
    r = await _clase_generada(cliente, monkeypatch, ana, [mala, _clase()], llamadas)
    assert r.status_code == 200 and len(llamadas) == 2
    assert "no cumplió el formato" in llamadas[1]["contents"]


async def test_editar_una_clase(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    jid = (await _clase_generada(cliente, monkeypatch, ana)).json()["id_juego"]
    await _estado(cliente, ana, jid, "aprobado")
    nueva = _clase()
    nueva["secciones"][0]["explicacion"] = "Texto corregido por el docente."
    r = await cliente.put(f"/ia/juegos/{jid}", json=nueva, headers=auth(ana))
    assert r.status_code == 200 and r.json()["estado"] == "borrador"
    assert r.json()["juego"]["secciones"][0]["explicacion"] == "Texto corregido por el docente."

    rota = _clase()
    rota["secciones"][0]["mini_reto"]["opciones"] = ["solo", "dos"]
    assert (await cliente.put(f"/ia/juegos/{jid}", json=rota, headers=auth(ana))).status_code == 422
    # Una clase no se convierte en un juego suelto ni al revés.
    assert (await cliente.put(f"/ia/juegos/{jid}", json=_quiz(), headers=auth(ana))).status_code == 400


async def test_no_se_aprueba_una_clase_guardada_invalida(cliente, monkeypatch):
    from app.db import session

    ana = await crear_docente(cliente)
    jid = (await _clase_generada(cliente, monkeypatch, ana)).json()["id_juego"]
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE juegos_generados SET contenido_juego = jsonb_set(contenido_juego, '{secciones}', '[]')")
    r = await _estado(cliente, ana, jid, "aprobado")
    assert r.status_code == 422


def test_el_analisis_conserva_los_puntos_clave():
    temas = ia._leer_temas('{"temas":[{"titulo":"Agua","descripcion":"d","contenido":"El agua hierve a 100 grados."}]}')
    assert temas[0]["contenido"] == "El agua hierve a 100 grados."
    assert ia._leer_temas('[{"titulo":"Sin contenido"}]')[0]["contenido"] == ""
