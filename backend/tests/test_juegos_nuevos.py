"""Juegos nuevos: clasificar en categorías y línea de tiempo."""

import copy
import json

import pytest

from app.ia import demo, gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso


def _clasificar(n=3):
    return {
        "titulo": "¿Vivo o sin vida?", "instrucciones": "Reparte cada cosa.", "tipo_actividad": "clasificar",
        "preguntas": [
            {
                "consigna": f"Clasifica {i}", "categorias": ["Ser vivo", "Sin vida"],
                "elementos": [
                    {"texto": "Gato", "categoria": "Ser vivo"}, {"texto": "Roca", "categoria": "Sin vida"},
                    {"texto": "Rosa", "categoria": "Ser vivo"}, {"texto": "Nube", "categoria": "Sin vida"},
                ],
            }
            for i in range(n)
        ],
    }


def _linea(n=3, eventos=4):
    return {
        "titulo": "Etapas", "instrucciones": "Coloca cada etapa.", "tipo_actividad": "linea_tiempo",
        "preguntas": [
            {"consigna": f"Línea {i}", "eventos": [{"etiqueta": f"Etapa {k}", "texto": f"Pasa {k}"} for k in range(eventos)]}
            for i in range(n)
        ],
    }


def _juego_con(base, cambio):
    juego = copy.deepcopy(base)
    cambio(juego["preguntas"][0])
    return juego


def _valido(juego, tipo):
    return ia._interpretar_juego(json.dumps(juego), tipo)


def _invalido(juego, tipo):
    with pytest.raises(ia.JuegoInvalido):
        _valido(juego, tipo)


def test_clasificar_valido():
    assert _valido(_clasificar(), "clasificar")["tipo_actividad"] == "clasificar"


@pytest.mark.parametrize("cambio", [
    lambda p: p.update(categorias=["Ser vivo"]),                                  # una sola categoría
    lambda p: p.update(categorias=["Ser vivo", "ser vivo"]),                      # repetidas (sin distinguir mayúsculas)
    lambda p: p["elementos"][0].update(categoria="Mineral"),                      # categoría que no existe
    lambda p: [e.update(categoria="Ser vivo") for e in p["elementos"]],           # una categoría queda vacía
    lambda p: p["elementos"].pop(),                                               # 3 elementos: muy pocos
    lambda p: p["elementos"][1].update(texto="gato"),                             # elemento repetido
    lambda p: p.update(categorias=["A", "B", "C", "D"]),                          # demasiadas categorías
], ids=["una_categoria", "categorias_repetidas", "categoria_inexistente", "categoria_vacia", "pocos_elementos", "elemento_repetido", "cuatro_categorias"])
def test_clasificar_invalido(cambio):
    _invalido(_juego_con(_clasificar(), cambio), "clasificar")


def test_linea_valida():
    assert _valido(_linea(), "linea_tiempo")["tipo_actividad"] == "linea_tiempo"


def test_linea_con_mas_de_seis_eventos_se_recorta():
    juego = _valido(_linea(eventos=9), "linea_tiempo")
    assert all(len(p["eventos"]) == 6 for p in juego["preguntas"])


@pytest.mark.parametrize("cambio", [
    lambda p: p.update(eventos=p["eventos"][:2]),                                # quedan 2 eventos
    lambda p: p["eventos"][1].update(etiqueta="Etapa 0"),                         # etiqueta repetida
    lambda p: p["eventos"][1].update(texto="Pasa 0"),                             # suceso repetido
    lambda p: p["eventos"][0].update(etiqueta=""),                                # etiqueta vacía
], ids=["pocos_eventos", "etiqueta_repetida", "suceso_repetido", "etiqueta_vacia"])
def test_linea_invalida(cambio):
    _invalido(_juego_con(_linea(), cambio), "linea_tiempo")


async def _generar(cliente, monkeypatch, secuencia, tipo):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso(secuencia, llamadas))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "los seres vivos", "tipo_actividad": tipo}, headers=auth(token))
    return r, llamadas, token


@pytest.mark.parametrize("tipo,juego", [("clasificar", _clasificar()), ("linea_tiempo", _linea())])
async def test_la_ia_genera_el_tipo_nuevo_y_el_prompt_lo_describe(cliente, monkeypatch, tipo, juego):
    r, llamadas, _ = await _generar(cliente, monkeypatch, [juego], tipo)
    assert r.status_code == 200 and r.json()["juego"]["tipo_actividad"] == tipo
    assert tipo in llamadas[0]["contents"]


async def test_si_pide_clasificar_y_llega_otro_tipo_se_reintenta(cliente, monkeypatch):
    r, llamadas, _ = await _generar(cliente, monkeypatch, [_linea(), _clasificar()], "clasificar")
    assert r.status_code == 200 and len(llamadas) == 2
    assert r.json()["juego"]["tipo_actividad"] == "clasificar"


async def test_el_docente_puede_editar_y_guardar_un_juego_de_clasificar(cliente, monkeypatch):
    r, _, token = await _generar(cliente, monkeypatch, [_clasificar()], "clasificar")
    jid, juego = r.json()["id_juego"], r.json()["juego"]
    juego["preguntas"][0]["elementos"][0]["texto"] = "Perro"
    assert (await cliente.put(f"/ia/juegos/{jid}", json=juego, headers=auth(token))).status_code == 200
    juego["preguntas"][0]["elementos"][0]["categoria"] = "Inventada"  # categoría inexistente: el servidor lo rechaza
    assert (await cliente.put(f"/ia/juegos/{jid}", json=juego, headers=auth(token))).status_code == 422


@pytest.mark.parametrize("tipo", ["clasificar", "linea_tiempo"])
def test_el_modo_demo_incluye_los_tipos_nuevos(tipo):
    assert tipo in demo._RETOS and len(demo._RETOS[tipo]) >= 3
    _valido(demo._juego(tipo, "Tema"), tipo)


async def test_una_clase_puede_terminar_con_evaluacion_de_tipo_nuevo(cliente, monkeypatch):
    clase = demo._clase("linea_tiempo", "Tema")
    assert ia._interpretar_clase(json.dumps(clase), "linea_tiempo")["evaluacion"]["tipo_actividad"] == "linea_tiempo"
