"""Generación de juegos: respuestas raras de la IA, reintentos y respaldo entre modelos."""

import copy
import json

import pytest
from google.genai import errors as gerrors

from app.routers import ia
from tests.conftest import auth, crear_docente


def _quiz(n=3, opciones=4):
    return {
        "titulo": "Las partes de una planta",
        "instrucciones": "Elige la respuesta correcta.",
        "tipo_actividad": "quiz",
        "preguntas": [
            {"pregunta": f"Pregunta {i}", "opciones": [f"op{j}" for j in range(opciones)], "correcta": 0}
            for i in range(n)
        ],
    }


def _error(codigo):
    return gerrors.ClientError(codigo, {"error": {"message": "x", "status": "X"}})


def _cliente_falso(secuencia, llamadas):
    """Gemini falso: cada llamada consume un elemento (excepción = se lanza; texto = se devuelve)."""
    pendientes = list(secuencia)

    class _Modelos:
        async def generate_content(self, **kwargs):
            llamadas.append(kwargs)
            elemento = pendientes.pop(0)
            if isinstance(elemento, Exception):
                raise elemento

            class _R:
                text = elemento if isinstance(elemento, str) else json.dumps(elemento)

            return _R()

    class _Aio:
        models = _Modelos()

    class _Cliente:
        def __init__(self, *a, **k):
            self.aio = _Aio()

    return _Cliente


async def _generar(cliente, monkeypatch, secuencia, tipo="sorpresa"):
    llamadas = []
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso(secuencia, llamadas))
    token = await crear_docente(cliente)
    r = await cliente.post(
        "/ia/generar-juego", json={"texto_prompt": "las partes de una planta", "tipo_actividad": tipo}, headers=auth(token)
    )
    return r, llamadas


async def test_juego_correcto(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz()])
    assert r.status_code == 200 and len(llamadas) == 1


async def test_si_sobran_retos_se_recortan_a_cinco(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_quiz(n=7)])
    assert r.status_code == 200 and len(r.json()["juego"]["preguntas"]) == 5


async def test_si_sobran_parejas_se_recortan(cliente, monkeypatch):
    juego = {
        "titulo": "Une", "instrucciones": "x", "tipo_actividad": "relacionar",
        "preguntas": [
            {"consigna": "c", "pares": [{"izquierda": f"i{k}", "derecha": f"d{k}"} for k in range(8)]}
            for _ in range(3)
        ],
    }
    r, _ = await _generar(cliente, monkeypatch, [juego])
    assert r.status_code == 200
    assert all(len(p["pares"]) == 5 for p in r.json()["juego"]["preguntas"])


async def test_json_envuelto_en_bloque_de_codigo(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, ["```json\n" + json.dumps(_quiz()) + "\n```"])
    assert r.status_code == 200


async def test_respuesta_invalida_se_reintenta_diciendole_a_la_ia_que_fallo(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz(opciones=3), _quiz()])
    assert r.status_code == 200
    assert len(llamadas) == 2
    assert "no cumplió el formato" in llamadas[1]["contents"]
    assert llamadas[1]["model"] == llamadas[0]["model"]  # el reintento es con el mismo modelo


async def test_si_un_modelo_insiste_en_fallar_se_prueba_otro(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz(opciones=3), "no es json", _quiz()])
    assert r.status_code == 200 and len(llamadas) == 3
    assert llamadas[2]["model"] != llamadas[0]["model"]


async def test_si_nunca_cumple_el_formato_responde_502_con_mensaje_util(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz(opciones=3)] * 6)
    assert r.status_code == 502 and len(llamadas) == 6
    assert "no logró crear un juego válido" in r.json()["detail"]


async def test_tipo_distinto_al_pedido_se_reintenta(cliente, monkeypatch):
    verdadero_falso = {
        "titulo": "t", "instrucciones": "x", "tipo_actividad": "verdadero_falso",
        "preguntas": [{"afirmacion": "a", "correcta": True, "explicacion": "e"}] * 3,
    }
    r, llamadas = await _generar(cliente, monkeypatch, [verdadero_falso, _quiz()], tipo="quiz")
    assert r.status_code == 200 and len(llamadas) == 2
    assert "se pidió 'quiz'" in llamadas[1]["contents"]


async def test_el_motivo_del_fallo_queda_en_el_registro(cliente, monkeypatch, caplog):
    caplog.set_level("WARNING", logger="uvicorn.error")
    await _generar(cliente, monkeypatch, [_quiz(opciones=3), _quiz()])
    assert any("Juego inválido" in m and "opciones" in m for m in caplog.messages)


@pytest.mark.parametrize("codigo", [403, 404, 429, 503])
async def test_error_de_un_modelo_pasa_al_siguiente(cliente, monkeypatch, codigo):
    r, llamadas = await _generar(cliente, monkeypatch, [_error(codigo), _quiz()])
    assert r.status_code == 200 and len(llamadas) == 2


async def test_clave_bloqueada_en_todos_los_modelos_da_mensaje_claro(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_error(403)] * 3)
    assert r.status_code == 502
    assert "Revisa GEMINI_API_KEY" in r.json()["detail"]


async def test_clave_invalida_400_no_prueba_mas_modelos(cliente, monkeypatch):
    r, llamadas = await _generar(cliente, monkeypatch, [_error(400)])
    assert r.status_code == 502 and "400" in r.json()["detail"] and len(llamadas) == 1


async def test_no_se_guarda_nada_si_el_juego_no_es_valido(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_quiz(opciones=3)] * 6)
    assert r.status_code == 502
    token = (await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": "Clave-Segura-1"})).json()["access_token"]
    assert (await cliente.get("/ia/juegos", headers=auth(token))).json()["juegos"] == []


def test_la_interpretacion_no_modifica_lo_que_recibe():
    original = _quiz(n=7)
    copia = copy.deepcopy(original)
    ia._interpretar_juego(json.dumps(original), "sorpresa")
    assert original == copia
