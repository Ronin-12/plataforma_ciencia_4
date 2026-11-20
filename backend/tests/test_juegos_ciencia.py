"""Juegos de ciencias (Sprint O): laboratorio de hipótesis, etiquetar un esquema y detective de errores."""

import copy
import json

import pytest

from app.ia import demo, gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso


def _hipotesis(n=3):
    return {
        "titulo": "Laboratorio", "instrucciones": "Elige qué pasará.", "tipo_actividad": "hipotesis",
        "preguntas": [
            {"escenario": f"Experimento {i}", "opciones": ["Se hunde", "Flota", "Se disuelve"], "correcta": 1,
             "resultado": "Flota sobre el agua.", "explicacion": "Es menos denso que el agua."}
            for i in range(n)
        ],
    }


def _etiquetar(n=3):
    return {
        "titulo": "Partes", "instrucciones": "Nombra cada parte.", "tipo_actividad": "etiquetar",
        "preguntas": [
            {"consigna": f"Nombra {i}", "esquema": "planta",
             "puntos": [{"numero": 1, "texto": "Flor"}, {"numero": 3, "texto": "Tallo"}, {"numero": 4, "texto": "Raíz"}]}
            for i in range(n)
        ],
    }


def _detective(n=3):
    return {
        "titulo": "Errores", "instrucciones": "Encuentra el error.", "tipo_actividad": "detective",
        "preguntas": [
            {"consigna": f"Busca {i}", "oraciones": ["A es cierto.", "B es cierto.", "C es falso.", "D es cierto."],
             "error": 2, "correccion": "C debería ser cierto.", "explicacion": "Porque sí."}
            for i in range(n)
        ],
    }


def _con(base, cambio):
    juego = copy.deepcopy(base)
    cambio(juego["preguntas"][0])
    return juego


def _valido(juego, tipo):
    return ia._interpretar_juego(json.dumps(juego), tipo)


def _invalido(juego, tipo):
    with pytest.raises(ia.JuegoInvalido):
        _valido(juego, tipo)


@pytest.mark.parametrize("tipo,juego", [("hipotesis", _hipotesis()), ("etiquetar", _etiquetar()), ("detective", _detective())])
def test_los_tres_tipos_validos(tipo, juego):
    assert _valido(juego, tipo)["tipo_actividad"] == tipo


@pytest.mark.parametrize("cambio", [
    lambda p: p.update(opciones=["Solo una"]),                      # menos de 2 predicciones
    lambda p: p.update(opciones=["A", "a", "B"]),                   # repetidas
    lambda p: p.update(correcta=3),                                 # índice fuera de las 3 opciones
    lambda p: p.update(resultado=""),                               # sin resultado que revelar
    lambda p: p.update(escenario="x" * 301),                        # escenario demasiado largo
], ids=["una_opcion", "repetidas", "correcta_fuera", "sin_resultado", "escenario_largo"])
def test_hipotesis_invalida(cambio):
    _invalido(_con(_hipotesis(), cambio), "hipotesis")


@pytest.mark.parametrize("cambio", [
    lambda p: p.update(esquema="galaxia"),                          # esquema que no existe
    lambda p: p["puntos"][0].update(numero=6),                      # punto fuera de rango
    lambda p: p["puntos"][1].update(numero=1),                      # número repetido
    lambda p: p["puntos"][1].update(texto="flor"),                  # nombre repetido
    lambda p: p.update(esquema="tierra", puntos=[{"numero": 1, "texto": "A"}, {"numero": 2, "texto": "B"}, {"numero": 5, "texto": "C"}]),  # tierra solo tiene 4
    lambda p: p.update(puntos=p["puntos"][:2]),                     # solo 2 puntos
], ids=["esquema_inexistente", "fuera_de_rango", "numero_repetido", "nombre_repetido", "punto_que_no_existe", "pocos_puntos"])
def test_etiquetar_invalido(cambio):
    _invalido(_con(_etiquetar(), cambio), "etiquetar")


@pytest.mark.parametrize("cambio", [
    lambda p: p.update(error=4),                                    # apunta a una oración que no existe
    lambda p: p.update(oraciones=p["oraciones"][:3], error=0),      # 3 oraciones: muy pocas
    lambda p: p["oraciones"].__setitem__(1, "a es cierto."),        # oración repetida
    lambda p: p.update(correccion="C es falso."),                   # la corrección es igual al error
    lambda p: p.update(correccion=""),
], ids=["error_fuera", "pocas_oraciones", "oracion_repetida", "correccion_igual", "sin_correccion"])
def test_detective_invalido(cambio):
    _invalido(_con(_detective(), cambio), "detective")


def test_se_recortan_puntos_y_oraciones_de_mas():
    j = _etiquetar()
    j["preguntas"][0]["puntos"] = [{"numero": n, "texto": f"P{n}"} for n in range(1, 6)] + [{"numero": 1, "texto": "extra"}]
    assert len(_valido(j, "etiquetar")["preguntas"][0]["puntos"]) == 5
    d = _detective()
    d["preguntas"][0]["oraciones"] = [f"Oración {k}." for k in range(8)]
    d["preguntas"][0]["error"] = 1
    assert len(_valido(d, "detective")["preguntas"][0]["oraciones"]) == 6


async def _generar(cliente, monkeypatch, secuencia, tipo):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso(secuencia, llamadas))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas", "tipo_actividad": tipo}, headers=auth(token))
    return r, llamadas, token


@pytest.mark.parametrize("tipo,juego", [("hipotesis", _hipotesis()), ("etiquetar", _etiquetar()), ("detective", _detective())])
async def test_la_ia_genera_y_el_prompt_describe_el_tipo(cliente, monkeypatch, tipo, juego):
    r, llamadas, _ = await _generar(cliente, monkeypatch, [juego], tipo)
    assert r.status_code == 200 and r.json()["juego"]["tipo_actividad"] == tipo
    assert f"{tipo}: cada pregunta usa" in llamadas[0]["contents"]


async def test_el_prompt_de_etiquetar_dice_que_marca_cada_punto(cliente, monkeypatch):
    _, llamadas, _ = await _generar(cliente, monkeypatch, [_etiquetar()], "etiquetar")
    assert "1 flor, 2 hoja, 3 tallo, 4 raíz, 5 fruto" in llamadas[0]["contents"]


async def test_el_docente_edita_un_detective_y_el_servidor_revalida(cliente, monkeypatch):
    r, _, token = await _generar(cliente, monkeypatch, [_detective()], "detective")
    jid, juego = r.json()["id_juego"], r.json()["juego"]
    juego["preguntas"][0]["oraciones"][0] = "Otra oración cierta."
    assert (await cliente.put(f"/ia/juegos/{jid}", json=juego, headers=auth(token))).status_code == 200
    juego["preguntas"][0]["error"] = 5  # no existe esa oración
    assert (await cliente.put(f"/ia/juegos/{jid}", json=juego, headers=auth(token))).status_code == 422


@pytest.mark.parametrize("tipo", ["hipotesis", "etiquetar", "detective"])
def test_el_modo_demo_incluye_los_tipos(tipo):
    assert tipo in demo._RETOS and len(demo._RETOS[tipo]) >= 3
    _valido(demo._juego(tipo, "Tema"), tipo)


async def test_una_clase_puede_terminar_con_evaluacion_detective(cliente):
    clase = demo._clase("detective", "Tema")
    assert ia._interpretar_clase(json.dumps(clase), "detective")["evaluacion"]["tipo_actividad"] == "detective"


async def test_el_filtro_de_metricas_acepta_los_tipos_nuevos(cliente):
    token = await crear_docente(cliente)
    for tipo in ("hipotesis", "etiquetar", "detective"):
        assert (await cliente.get(f"/metricas/grupo?tipo={tipo}", headers=auth(token))).status_code == 200
