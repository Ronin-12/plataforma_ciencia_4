"""Capa de IA intercambiable (RNF-08), modo demo y privacidad de nombres (RNF-04)."""

import json

import pytest

import app.ia as capa_ia
from app.core.config import settings
from app.ia import gemini
from app.ia.base import ProveedorIA
from app.ia.demo import ProveedorDemo, _RETOS
from app.ia.privacidad import encontrar_nombres, ocultar_nombres
from app.routers.ia import validar_contenido
from tests.conftest import auth, crear_docente
from tests.test_clases import _clase, _sesion
from tests.test_ia import _cliente_falso, _quiz
from tests.test_resultados import crear_alumno_con_sesion
from tests.test_sesiones import PNG, _analizar, _archivo

TIPOS = list(_RETOS)


@pytest.fixture
def demo(monkeypatch):
    """Modo demo, con Gemini 'explosivo': si algo intenta usarlo, la prueba falla."""
    monkeypatch.setattr(settings, "IA_PROVEEDOR", "demo")

    def _no_debe_llamarse(*a, **k):
        raise AssertionError("En modo demo no se debe construir el cliente de Gemini")

    monkeypatch.setattr(gemini.genai, "Client", _no_debe_llamarse)


# ------------------------------------------------------------ elección del proveedor


def test_el_proveedor_se_elige_por_configuracion(monkeypatch):
    monkeypatch.setattr(settings, "IA_PROVEEDOR", "gemini")
    assert isinstance(capa_ia.obtener_proveedor(), gemini.ProveedorGemini)
    monkeypatch.setattr(settings, "IA_PROVEEDOR", " DEMO ")
    assert isinstance(capa_ia.obtener_proveedor(), ProveedorDemo)
    monkeypatch.setattr(settings, "IA_PROVEEDOR", "inventado")
    with pytest.raises(RuntimeError, match="gemini, demo"):
        capa_ia.obtener_proveedor()


async def test_gemini_sin_clave_responde_503_pero_demo_no_la_necesita(cliente, monkeypatch, demo):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    ana = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas"}, headers=auth(ana))
    assert r.status_code == 200  # demo
    monkeypatch.setattr(settings, "IA_PROVEEDOR", "gemini")
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas"}, headers=auth(ana))
    assert r.status_code == 503 and "GEMINI_API_KEY" in r.json()["detail"]


async def test_un_proveedor_nuevo_se_conecta_sin_tocar_las_rutas(cliente, monkeypatch):
    """Prueba de RNF-08: una clase que cumple la interfaz y se registra, y ya funciona."""

    class ProveedorFalso(ProveedorIA):
        nombre = "el proveedor falso"

        def problema_de_configuracion(self):
            return None

        def modelos(self):
            return ["modelo-a"]

        async def generar_json(self, solicitud, modelo):
            return json.dumps(_quiz())

    monkeypatch.setitem(capa_ia.PROVEEDORES, "falso", ProveedorFalso)
    monkeypatch.setattr(settings, "IA_PROVEEDOR", "falso")
    ana = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas"}, headers=auth(ana))
    assert r.status_code == 200, r.text
    assert r.json()["juego"]["tipo_actividad"] == "quiz" and r.json()["uso"]["usadas"] == 1


# ------------------------------------------------------------------------ modo demo


@pytest.mark.parametrize("tipo", TIPOS)
def test_todo_el_contenido_demo_es_valido(tipo):
    """Si el banco demo se rompiera, el docente vería un error al presentar: esta prueba lo evita."""
    import asyncio
    from app.ia.base import Solicitud

    prov = ProveedorDemo()
    for tarea in ("juego", "clase"):
        texto = asyncio.run(prov.generar_json(Solicitud(instruccion="", tarea=tarea, tipo=tipo, tema="Plantas"), "demo"))
        contenido = validar_contenido(json.loads(texto))
        assert contenido["titulo"].endswith("(demo)")


@pytest.mark.parametrize("tipo", TIPOS)
async def test_demo_genera_cada_tipo_sin_gastar_creditos(cliente, demo, tipo):
    ana = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "las plantas", "tipo_actividad": tipo}, headers=auth(ana))
    assert r.status_code == 200, r.text
    assert r.json()["juego"]["tipo_actividad"] == tipo and r.json()["estado"] == "borrador"
    assert r.json()["uso"]["demo"] is True  # la pantalla del docente usa esto para mantener el aviso
    uso = (await cliente.get("/ia/uso", headers=auth(ana))).json()
    assert uso["usadas"] == 0 and uso["demo"] is True


async def test_demo_sorpresa_clase_y_analisis(cliente, demo):
    ana = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "el agua", "tipo_actividad": "sorpresa"}, headers=auth(ana))
    assert r.status_code == 200
    id_sesion = await _sesion(cliente, ana)
    r = await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion, "tipo_evaluacion": "completar"}, headers=auth(ana))
    assert r.status_code == 200 and r.json()["juego"]["evaluacion"]["tipo_actividad"] == "completar"
    r = await _analizar(cliente, ana, [_archivo("foto.png", PNG, "image/png")])
    assert r.status_code == 200 and len(r.json()["temas"]) == 3 and r.json()["temas"][0]["contenido"]
    assert (await cliente.get("/ia/uso", headers=auth(ana))).json()["usadas"] == 0


# ------------------------------------------------------- privacidad: nombres de alumnos


def test_deteccion_de_nombres():
    nombres = ["Sofía", "Luis Ángel", "Rosa", "Al"]
    # Con mayúscula inicial y sin importar acentos; la flor en minúscula no cuenta; «Al» es muy corto.
    assert encontrar_nombres("Sofia y Luis angel; la rosa es una flor; Al final", nombres) == ["Sofia", "Luis angel"]
    assert encontrar_nombres("ROSA llegó", nombres) == ["ROSA"]
    assert encontrar_nombres("Rosalía y Sofíaa", nombres) == []  # palabras completas
    assert encontrar_nombres("nada que ocultar", nombres) == []


def test_ocultar_nombres_conserva_el_resto_del_texto():
    limpio, encontrados = ocultar_nombres("Sofía mira la rosa. Luis Ángel se fue.", ["Sofía", "Luis Ángel", "Rosa"])
    assert limpio == "un alumno mira la rosa. un alumno se fue."
    assert encontrados == ["Sofía", "Luis Ángel"]


async def test_el_prompt_con_nombre_de_alumno_no_llega_a_la_ia(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], llamadas))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "Un juego donde Sofia gane"}, headers=auth(ana))
    assert r.status_code == 422 and "Sofia" in r.json()["detail"]
    assert llamadas == []  # ni un byte salió hacia la IA
    assert (await cliente.get("/ia/uso", headers=auth(ana))).json()["usadas"] == 0
    # Sin el nombre, sí se genera.
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "Un juego sobre las plantas"}, headers=auth(ana))
    assert r.status_code == 200


async def test_una_palabra_comun_en_minuscula_no_se_confunde_con_un_alumno(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    await crear_alumno_con_sesion(cliente, ana, nombre="Rosa")
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "Partes de la rosa y su tallo"}, headers=auth(ana))
    assert r.status_code == 200


async def test_los_alumnos_de_otro_docente_no_bloquean(cliente, monkeypatch):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    await crear_alumno_con_sesion(cliente, beto, nombre="Sofía")
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "Un juego para Sofía"}, headers=auth(ana))
    assert r.status_code == 200


async def test_el_material_de_la_sesion_se_limpia_antes_de_enviarlo(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_clase()], llamadas))
    id_sesion = await _sesion(cliente, ana, contexto="Fotosíntesis. Ejercicio resuelto por Sofía en clase.")
    r = await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion}, headers=auth(ana))
    assert r.status_code == 200, r.text
    enviado = llamadas[0]["contents"]
    assert "Sofía" not in enviado and "un alumno" in enviado


async def test_las_indicaciones_de_la_clase_con_nombre_se_rechazan(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    await crear_alumno_con_sesion(cliente, ana, nombre="Sofía")
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_clase()], llamadas))
    id_sesion = await _sesion(cliente, ana)
    r = await cliente.post("/ia/generar-clase", json={"id_sesion": id_sesion, "indicaciones": "Dedícala a Sofía"}, headers=auth(ana))
    assert r.status_code == 422 and llamadas == []
