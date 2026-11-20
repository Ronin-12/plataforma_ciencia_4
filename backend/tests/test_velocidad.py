"""Velocidad de la IA: pensamiento limitado, tiempo máximo, memoria del análisis y tareas en segundo plano."""

import asyncio
import json
import uuid

import pytest
from google.genai import errors as gerrors

from app.core.config import settings
from app.db import session
from app.ia import gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_admin import crear_admin
from tests.test_clases import _clase, _sesion
from tests.test_ia import _cliente_falso, _error, _generar, _quiz
from tests.test_produccion import _gemini_con_tokens
from tests.test_sesiones import PNG, TEMAS, _analizar, _archivo

PROMPT = {"texto_prompt": "las partes de una planta", "tipo_actividad": "quiz"}


@pytest.fixture(autouse=True)
def _estado_limpio(monkeypatch):
    """El cliente y los modelos «sin pensamiento» se recuerdan entre llamadas: cada prueba parte de cero."""
    monkeypatch.setattr(gemini, "_clientes", {})
    monkeypatch.setattr(gemini, "_sin_pensamiento", set())


def _cliente_lento(respuestas, llamadas, retraso=0.0, compuerta: asyncio.Event | None = None):
    """Gemini falso que tarda: espera `retraso` segundos o a que se abra la `compuerta`."""
    pendientes = list(respuestas)

    class _Modelos:
        async def generate_content(self, **kwargs):
            llamadas.append(kwargs)
            if compuerta is not None:
                await compuerta.wait()
            elif retraso:
                await asyncio.sleep(retraso)
            elemento = pendientes.pop(0)

            class _R:
                text = json.dumps(elemento)

            return _R()

    class _Aio:
        models = _Modelos()

    class _Cliente:
        def __init__(self, *a, **k):
            self.aio = _Aio()

    return _Cliente


# ------------------------------------------------------------------ pensamiento limitado


@pytest.mark.parametrize("nivel,esperado", [("nada", 0), ("bajo", 512), ("medio", 2048), ("alto", 8192)])
async def test_se_limita_el_pensamiento_segun_la_configuracion(cliente, monkeypatch, nivel, esperado):
    monkeypatch.setattr(settings, "GEMINI_PENSAMIENTO", nivel)
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz()])
    assert r.status_code == 200
    assert llamadas[0]["config"].thinking_config.thinking_budget == esperado


async def test_en_auto_no_se_toca_el_pensamiento(cliente, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_PENSAMIENTO", "auto")
    r, llamadas = await _generar(cliente, monkeypatch, [_quiz()])
    assert r.status_code == 200 and llamadas[0]["config"].thinking_config is None


async def test_un_modelo_que_rechaza_el_pensamiento_se_reintenta_sin_esa_opcion(cliente, monkeypatch):
    rechazo = gerrors.ClientError(400, {"error": {"message": "Thinking budget is not supported for this model", "status": "INVALID_ARGUMENT"}})
    r, llamadas = await _generar(cliente, monkeypatch, [rechazo, _quiz()])
    assert r.status_code == 200 and len(llamadas) == 2
    assert llamadas[0]["config"].thinking_config is not None and llamadas[1]["config"].thinking_config is None
    # Se recuerda: la siguiente generación ya no manda la opción a ese modelo.
    token = await crear_docente(cliente, "otra@escuela.mx")
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], llamadas))
    assert (await cliente.post("/ia/generar-juego", json=PROMPT, headers=auth(token))).status_code == 200
    assert llamadas[2]["config"].thinking_config is None


# ------------------------------------------------------------------ tiempo máximo y cliente único


async def test_un_modelo_que_no_responde_a_tiempo_se_cambia_por_el_siguiente(cliente, monkeypatch):
    monkeypatch.setattr(settings, "IA_TIMEOUT_SEGUNDOS", 0.05)
    llamadas = []
    # La primera respuesta tarda 5 s (se corta a los 0,05 s); la segunda llega enseguida.
    pendientes = [5.0, 0.0]

    class _Modelos:
        async def generate_content(self, **kwargs):
            llamadas.append(kwargs)
            await asyncio.sleep(pendientes.pop(0))

            class _R:
                text = json.dumps(_quiz())

            return _R()

    class _Aio:
        models = _Modelos()

    class _Cliente:
        def __init__(self, *a, **k):
            self.aio = _Aio()

    monkeypatch.setattr(gemini.genai, "Client", _Cliente)
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 200 and len(llamadas) == 2
    assert llamadas[0]["model"] != llamadas[1]["model"]


async def test_si_todos_los_modelos_tardan_se_avisa_que_esta_saturada(cliente, monkeypatch):
    monkeypatch.setattr(settings, "IA_TIMEOUT_SEGUNDOS", 0.05)
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_lento([_quiz()] * 3, llamadas, retraso=5.0))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/generar-juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 503 and "saturada" in r.json()["detail"]
    uso = (await cliente.get("/ia/uso", headers=auth(token))).json()
    assert uso["usadas"] == 0  # no se cobra lo que no se entregó


async def test_el_cliente_de_google_se_crea_una_sola_vez(cliente, monkeypatch):
    creados = []
    base = _cliente_falso([_quiz()] * 2, [])

    class _Contado(base):
        def __init__(self, *a, **k):
            super().__init__(*a, **k)
            creados.append(1)

    monkeypatch.setattr(gemini.genai, "Client", _Contado)
    token = await crear_docente(cliente)
    for _ in range(2):
        assert (await cliente.post("/ia/generar-juego", json=PROMPT, headers=auth(token))).status_code == 200
    assert len(creados) == 1


# ------------------------------------------------------------------ tiempos medidos


async def test_se_guarda_cuanto_tardo_cada_llamada_y_el_admin_lo_ve(cliente, monkeypatch):
    admin = await crear_admin(cliente)
    ana = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _gemini_con_tokens([_quiz()]))
    assert (await cliente.post("/ia/generar-juego", json=PROMPT, headers=auth(ana))).status_code == 200
    async with session.get_db_pool().acquire() as conn:
        ms = await conn.fetchval("SELECT duracion_ms FROM ia_uso_tokens")
    assert ms is not None and ms >= 0
    por_tarea = (await cliente.get("/admin/uso-ia", headers=auth(admin))).json()["por_tarea"]
    assert por_tarea[0]["tarea"] == "juego" and por_tarea[0]["segundos_promedio"] is not None


# ------------------------------------------------------------------ memoria del análisis


async def _analizar_dos_veces(cliente, monkeypatch, segundo=None):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([TEMAS, TEMAS, TEMAS], llamadas))
    token = await crear_docente(cliente)
    primero = await _analizar(cliente, token, [_archivo("a.png", PNG, "image/png")])
    segundo = await _analizar(cliente, token, segundo or [_archivo("OTRO-NOMBRE.png", PNG, "image/png")])
    return token, primero, segundo, llamadas


async def test_el_mismo_material_se_responde_sin_llamar_a_la_ia_ni_gastar_credito(cliente, monkeypatch):
    token, primero, segundo, llamadas = await _analizar_dos_veces(cliente, monkeypatch)
    assert primero.status_code == 200 and primero.json()["desde_cache"] is False
    assert segundo.status_code == 200 and segundo.json()["desde_cache"] is True
    assert segundo.json()["temas"] == primero.json()["temas"] and segundo.json()["contexto"] == primero.json()["contexto"]
    assert segundo.json()["archivos"] == ["OTRO-NOMBRE.png"]  # se reconoce por contenido, no por nombre
    assert len(llamadas) == 1
    assert (await cliente.get("/ia/uso", headers=auth(token))).json()["usadas"] == 1


async def test_un_material_distinto_si_llama_a_la_ia(cliente, monkeypatch):
    _, _, segundo, llamadas = await _analizar_dos_veces(cliente, monkeypatch, [_archivo("b.png", PNG + b"1", "image/png")])
    assert segundo.json()["desde_cache"] is False and len(llamadas) == 2


async def test_la_memoria_es_de_cada_docente(cliente, monkeypatch):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([TEMAS, TEMAS], llamadas))
    ana = await crear_docente(cliente)
    luis = await crear_docente(cliente, "luis@escuela.mx", "Luis Ríos")
    for token in (ana, luis):
        r = await _analizar(cliente, token, [_archivo("a.png", PNG, "image/png")])
        assert r.status_code == 200 and r.json()["desde_cache"] is False
    assert len(llamadas) == 2


async def test_la_memoria_vence_con_los_dias(cliente, monkeypatch):
    token, _, _, llamadas = await _analizar_dos_veces(cliente, monkeypatch)
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE ia_cache_material SET fecha_creacion = now() - interval '40 days'")
    r = await _analizar(cliente, token, [_archivo("a.png", PNG, "image/png")])
    assert r.json()["desde_cache"] is False and len(llamadas) == 2


async def test_con_la_memoria_apagada_siempre_se_llama_a_la_ia(cliente, monkeypatch):
    monkeypatch.setattr(settings, "IA_CACHE_DIAS", 0)
    _, _, segundo, llamadas = await _analizar_dos_veces(cliente, monkeypatch)
    assert segundo.json()["desde_cache"] is False and len(llamadas) == 2


async def test_una_respuesta_invalida_no_se_guarda_en_la_memoria(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso(["no soy json"] * 3, []))
    token = await crear_docente(cliente)
    r = await _analizar(cliente, token, [_archivo("a.png", PNG, "image/png")])
    assert r.status_code == 502
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM ia_cache_material") == 0


# ------------------------------------------------------------------ tareas en segundo plano


async def _esperar(cliente, token, id_tarea, hasta=("lista", "error")):
    """Consulta la tarea como lo hace la pantalla, hasta que termine."""
    for _ in range(100):
        r = await cliente.get(f"/ia/tareas/{id_tarea}", headers=auth(token))
        assert r.status_code == 200, r.text
        if r.json()["estado"] in hasta:
            return r.json()
        await asyncio.sleep(0.05)
    raise AssertionError("la tarea no terminó")


async def test_generar_un_juego_en_segundo_plano(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 202 and uuid.UUID(r.json()["id_tarea"])
    tarea = await _esperar(cliente, token, r.json()["id_tarea"])
    assert tarea["estado"] == "lista" and tarea["etapa"] == "Listo"
    assert tarea["resultado"]["estado"] == "borrador" and tarea["resultado"]["juego"]["tipo_actividad"] == "quiz"
    assert tarea["resultado"]["uso"]["usadas"] == 1
    juegos = (await cliente.get("/ia/juegos", headers=auth(token))).json()["juegos"]
    assert [j["id_juego"] for j in juegos] == [tarea["resultado"]["id_juego"]]


async def test_generar_una_clase_en_segundo_plano(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_clase()], []))
    token = await crear_docente(cliente)
    id_sesion = await _sesion(cliente, token)
    r = await cliente.post("/ia/tareas/clase", json={"id_sesion": id_sesion, "tipo_evaluacion": "quiz"}, headers=auth(token))
    assert r.status_code == 202
    tarea = await _esperar(cliente, token, r.json()["id_tarea"])
    assert tarea["estado"] == "lista" and tarea["resultado"]["juego"]["tipo_actividad"] == "clase"


async def test_analizar_material_en_segundo_plano(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([TEMAS], []))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/tareas/materiales", files=[_archivo("a.png", PNG, "image/png")], headers=auth(token))
    assert r.status_code == 202
    tarea = await _esperar(cliente, token, r.json()["id_tarea"])
    assert tarea["estado"] == "lista" and tarea["resultado"]["temas"][0]["titulo"] == "La fotosíntesis"


async def test_un_archivo_invalido_se_rechaza_al_instante(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([TEMAS], []))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/tareas/materiales", files=[_archivo("a.exe", b"MZ" + b"0" * 20, "application/octet-stream")], headers=auth(token))
    assert r.status_code == 415
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM ia_tareas") == 0


async def test_si_la_ia_falla_la_tarea_dice_por_que_y_devuelve_el_credito(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_error(429)] * 3, []))
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 202
    tarea = await _esperar(cliente, token, r.json()["id_tarea"])
    assert tarea["estado"] == "error" and tarea["error"]["estado"] == 503 and "saturada" in tarea["error"]["detalle"]
    assert "resultado" not in tarea
    assert (await cliente.get("/ia/uso", headers=auth(token))).json()["usadas"] == 0


async def test_lo_rechazable_se_rechaza_antes_de_crear_la_tarea(cliente, monkeypatch):
    token = await crear_docente(cliente)
    r = await cliente.post("/ia/tareas/clase", json={"id_sesion": str(uuid.uuid4()), "tipo_evaluacion": "quiz"}, headers=auth(token))
    assert r.status_code == 404
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    assert (await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))).status_code == 503
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM ia_tareas") == 0


async def test_solo_quien_la_pidio_ve_la_tarea(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    ana = await crear_docente(cliente)
    luis = await crear_docente(cliente, "luis@escuela.mx", "Luis Ríos")
    id_tarea = (await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(ana))).json()["id_tarea"]
    assert (await cliente.get(f"/ia/tareas/{id_tarea}", headers=auth(luis))).status_code == 404
    assert (await cliente.get(f"/ia/tareas/{uuid.uuid4()}", headers=auth(ana))).status_code == 404
    assert (await cliente.get(f"/ia/tareas/{id_tarea}")).status_code == 401
    await _esperar(cliente, ana, id_tarea)


@pytest.mark.parametrize("metodo,ruta", [("POST", "/ia/tareas/juego"), ("POST", "/ia/tareas/clase"), ("POST", "/ia/tareas/materiales"), ("GET", f"/ia/tareas/{uuid.uuid4()}")])
async def test_las_tareas_exigen_sesion(cliente, metodo, ruta):
    assert (await cliente.request(metodo, ruta)).status_code == 401


async def test_mientras_trabaja_se_ve_la_etapa_y_hay_un_tope_de_tareas_a_la_vez(cliente, monkeypatch):
    compuerta = asyncio.Event()
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_lento([_quiz()] * 2, llamadas, compuerta=compuerta))
    token = await crear_docente(cliente)
    ids = [(await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))).json()["id_tarea"] for _ in range(2)]
    en_curso = await _esperar(cliente, token, ids[0], hasta=("en_proceso",))
    for _ in range(100):  # la etapa se anota apenas arranca el trabajo
        en_curso = (await cliente.get(f"/ia/tareas/{ids[0]}", headers=auth(token))).json()
        if en_curso["etapa"].startswith("Creando"):
            break
        await asyncio.sleep(0.02)
    assert en_curso["estado"] == "en_proceso" and en_curso["etapa"].startswith("Creando") and "resultado" not in en_curso
    # Una tercera mientras las otras dos siguen: se pide esperar.
    r = await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 429 and "en curso" in r.json()["detail"]
    compuerta.set()
    for id_tarea in ids:
        assert (await _esperar(cliente, token, id_tarea))["estado"] == "lista"
    # Ya terminaron: se puede pedir otra (se reinicia el tope por hora, que en pruebas es de 3).
    ia._limite_generacion.reiniciar()
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 202
    assert (await _esperar(cliente, token, r.json()["id_tarea"]))["estado"] == "lista"


async def test_una_tarea_perdida_se_da_por_fallida_y_no_bloquea_al_docente(cliente, monkeypatch):
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    token = await crear_docente(cliente)
    async with session.get_db_pool().acquire() as conn:
        id_docente = await conn.fetchval("SELECT id_docente FROM docentes")
        viejas = [
            await conn.fetchval(
                "INSERT INTO ia_tareas (id_docente, tipo, fecha_creacion) VALUES ($1, 'juego', now() - interval '20 minutes') RETURNING id_tarea",
                id_docente,
            )
            for _ in range(2)
        ]
    # Al consultarla se reconoce como perdida...
    tarea = await _esperar(cliente, token, viejas[0])
    assert tarea["estado"] == "error" and tarea["error"]["estado"] == 504
    # ...y las que quedaban «en proceso» hace mucho no cuentan para el tope.
    r = await cliente.post("/ia/tareas/juego", json=PROMPT, headers=auth(token))
    assert r.status_code == 202
    assert (await _esperar(cliente, token, r.json()["id_tarea"]))["estado"] == "lista"
    assert (await _esperar(cliente, token, viejas[1]))["estado"] == "error"


async def test_las_rutas_de_siempre_siguen_respondiendo_con_el_resultado_completo(cliente, monkeypatch):
    r, _ = await _generar(cliente, monkeypatch, [_quiz()])
    assert r.status_code == 200 and r.json()["juego"]["tipo_actividad"] == "quiz" and r.json()["estado"] == "borrador"
