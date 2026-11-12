"""Sesiones, créditos de IA y subida de materiales (commit de la colaboración + endurecimiento)."""

import json

import pytest
from google.genai import errors as gerrors

from app.core.config import settings
from app.db import session
from app.ia import gemini
from app.routers import ia
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso, _error, _quiz

TEMAS = {"temas": [{"titulo": "La fotosíntesis", "descripcion": "Cómo las plantas fabrican su alimento"}]}
PDF = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20
JPG = b"\xff\xd8\xff\xe0" + b"0" * 20
WEBP = b"RIFF\x00\x00\x00\x00WEBPVP8 " + b"0" * 20


async def _uso(cliente, token):
    r = await cliente.get("/ia/uso", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


async def _generar(cliente, token, **extra):
    return await cliente.post(
        "/ia/generar-juego",
        json={"texto_prompt": "las partes de una planta", "tipo_actividad": "quiz", **extra},
        headers=auth(token),
    )


async def _analizar(cliente, token, archivos):
    return await cliente.post("/ia/materiales/analizar", files=archivos, headers=auth(token))


def _archivo(nombre="libro.pdf", contenido=PDF, tipo="application/pdf"):
    return ("archivos", (nombre, contenido, tipo))


# ------------------------------------------------------------------ sin id desde el cliente


@pytest.mark.parametrize(
    "metodo,ruta",
    [("GET", "/ia/uso"), ("GET", "/ia/sesiones"), ("POST", "/ia/sesiones"), ("POST", "/ia/materiales/analizar")],
)
async def test_rutas_nuevas_exigen_sesion(cliente, metodo, ruta):
    r = await cliente.request(metodo, ruta)
    assert r.status_code == 401


async def test_las_rutas_con_id_de_docente_ya_no_existen(cliente):
    token = await crear_docente(cliente)
    yo = (await cliente.get("/docentes/yo", headers=auth(token))).json()["id_docente"]
    for ruta in (f"/ia/uso/{yo}", f"/ia/sesiones/{yo}"):
        assert (await cliente.get(ruta, headers=auth(token))).status_code in (404, 405)


async def test_un_alumno_no_puede_usar_creditos_ni_sesiones(cliente):
    docente = await crear_docente(cliente)
    r = await cliente.post("/alumnos/", json={"nombre_pila": "Sofía"}, headers=auth(docente))
    alumno = r.json()
    r = await cliente.post(
        "/alumnos/login", json={"codigo_acceso": alumno["codigo_acceso"], "id_alumno": alumno["id_alumno"], "pin": alumno["pin"]}
    )
    token = r.json()["access_token"]
    for metodo, ruta in (("GET", "/ia/uso"), ("GET", "/ia/sesiones"), ("POST", "/ia/sesiones")):
        assert (await cliente.request(metodo, ruta, headers=auth(token))).status_code == 403


# ------------------------------------------------------------------------------- sesiones


async def test_crear_y_listar_sesiones_propias(cliente):
    token = await crear_docente(cliente)
    r = await cliente.post(
        "/ia/sesiones", json={"titulo": "Plantas", "tema": "Fotosíntesis", "contexto": "texto"}, headers=auth(token)
    )
    assert r.status_code == 201 and r.json()["titulo"] == "Plantas"
    lista = (await cliente.get("/ia/sesiones", headers=auth(token))).json()["sesiones"]
    assert [s["titulo"] for s in lista] == ["Plantas"]
    assert "contexto" not in lista[0]  # el material de referencia no se manda al navegador


async def test_un_docente_no_ve_las_sesiones_de_otro(cliente):
    a = await crear_docente(cliente)
    b = await crear_docente(cliente, email="luis@escuela.mx", nombre="Luis Gómez")
    await cliente.post("/ia/sesiones", json={"titulo": "Plantas", "tema": "Fotosíntesis"}, headers=auth(a))
    assert (await cliente.get("/ia/sesiones", headers=auth(b))).json()["sesiones"] == []


async def test_el_id_docente_que_mande_el_cliente_se_ignora(cliente):
    a = await crear_docente(cliente)
    b = await crear_docente(cliente, email="luis@escuela.mx", nombre="Luis Gómez")
    yo_a = (await cliente.get("/docentes/yo", headers=auth(a))).json()["id_docente"]
    await cliente.post(
        "/ia/sesiones", json={"titulo": "Mía", "tema": "x1", "id_docente": yo_a}, headers=auth(b)
    )
    assert (await cliente.get("/ia/sesiones", headers=auth(a))).json()["sesiones"] == []
    assert len((await cliente.get("/ia/sesiones", headers=auth(b))).json()["sesiones"]) == 1


async def test_no_se_puede_generar_con_la_sesion_de_otro_docente(cliente, monkeypatch):
    a = await crear_docente(cliente)
    b = await crear_docente(cliente, email="luis@escuela.mx", nombre="Luis Gómez")
    sesion = (await cliente.post("/ia/sesiones", json={"titulo": "Plantas", "tema": "Fotosíntesis"}, headers=auth(a))).json()
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await _generar(cliente, b, id_sesion=sesion["id_sesion"])
    assert r.status_code == 404
    assert (await _uso(cliente, b))["usadas"] == 0  # y no le costó nada


async def test_el_material_de_la_sesion_llega_a_la_ia_pero_no_se_guarda_como_prompt(cliente, monkeypatch):
    token = await crear_docente(cliente)
    sesion = (
        await cliente.post(
            "/ia/sesiones",
            json={"titulo": "Plantas", "tema": "Fotosíntesis", "contexto": "MATERIAL-SECRETO-DEL-LIBRO"},
            headers=auth(token),
        )
    ).json()
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], llamadas))
    r = await _generar(cliente, token, id_sesion=sesion["id_sesion"])
    assert r.status_code == 200
    assert "MATERIAL-SECRETO-DEL-LIBRO" in llamadas[0]["contents"]
    async with session.get_db_pool().acquire() as conn:
        guardado = await conn.fetchval("SELECT prompt_original FROM juegos_generados")
    assert guardado == "las partes de una planta"


# ------------------------------------------------------------------------------- créditos


async def test_un_juego_generado_gasta_un_credito(cliente, monkeypatch):
    token = await crear_docente(cliente)
    assert await _uso(cliente, token) == {"limite": 15, "usadas": 0, "disponibles": 15, "unidad": "créditos de IA", "demo": False}
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    r = await _generar(cliente, token)
    assert r.status_code == 200 and r.json()["uso"]["usadas"] == 1
    assert (await _uso(cliente, token))["disponibles"] == 14


async def test_si_la_ia_no_entrega_nada_se_devuelve_el_credito(cliente, monkeypatch):
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz(opciones=3)] * 6, []))
    assert (await _generar(cliente, token)).status_code == 502
    assert (await _uso(cliente, token))["usadas"] == 0


@pytest.mark.parametrize("error", [_error(400), _error(503)])
async def test_errores_de_gemini_devuelven_el_credito(cliente, monkeypatch, error):
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([error] * 3, []))
    assert (await _generar(cliente, token)).status_code in (502, 503)
    assert (await _uso(cliente, token))["usadas"] == 0


async def test_un_fallo_inesperado_tambien_devuelve_el_credito(cliente, monkeypatch):
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([RuntimeError("se cayó la red")], []))
    assert (await _generar(cliente, token)).status_code == 500
    assert (await _uso(cliente, token))["usadas"] == 0


async def test_si_no_se_pudo_guardar_el_juego_se_devuelve_el_credito(cliente, monkeypatch):
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("ALTER TABLE juegos_generados RENAME TO juegos_tmp")
    try:
        assert (await _generar(cliente, token)).status_code == 500
    finally:
        async with session.get_db_pool().acquire() as conn:
            await conn.execute("ALTER TABLE juegos_tmp RENAME TO juegos_generados")
    assert (await _uso(cliente, token))["usadas"] == 0


async def test_al_llegar_al_limite_mensual_responde_429(cliente, monkeypatch):
    monkeypatch.setattr(settings, "IA_GENERACIONES_MENSUALES_MAX", 2)
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz(), _quiz()], []))
    assert (await _generar(cliente, token)).status_code == 200
    assert (await _generar(cliente, token)).status_code == 200
    r = await _generar(cliente, token)
    assert r.status_code == 429 and "límite mensual" in r.json()["detail"]
    assert (await _uso(cliente, token))["disponibles"] == 0


async def test_cada_docente_tiene_sus_propios_creditos(cliente, monkeypatch):
    a = await crear_docente(cliente)
    b = await crear_docente(cliente, email="luis@escuela.mx", nombre="Luis Gómez")
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], []))
    await _generar(cliente, a)
    assert (await _uso(cliente, a))["usadas"] == 1 and (await _uso(cliente, b))["usadas"] == 0


async def test_las_peticiones_en_paralelo_no_pasan_del_limite(cliente, monkeypatch):
    import asyncio

    monkeypatch.setattr(settings, "IA_GENERACIONES_MENSUALES_MAX", 3)
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()] * 8, []))
    respuestas = await asyncio.gather(*[_generar(cliente, token) for _ in range(6)])
    codigos = sorted(r.status_code for r in respuestas)
    assert codigos.count(200) == 3 and codigos.count(429) == 3


# ------------------------------------------------------------------ análisis de materiales


async def _analizar_con(cliente, monkeypatch, archivos, secuencia=None):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso(secuencia or [TEMAS], llamadas))
    token = await crear_docente(cliente)
    return await _analizar(cliente, token, archivos), token, llamadas


@pytest.mark.parametrize(
    "nombre,contenido,tipo", [("a.pdf", PDF, "application/pdf"), ("a.png", PNG, "image/png"), ("a.jpg", JPG, "image/jpeg"), ("a.webp", WEBP, "image/webp")]
)
async def test_formatos_permitidos(cliente, monkeypatch, nombre, contenido, tipo):
    r, token, _ = await _analizar_con(cliente, monkeypatch, [_archivo(nombre, contenido, tipo)])
    assert r.status_code == 200
    assert r.json()["temas"][0]["titulo"] == "La fotosíntesis"
    assert r.json()["uso"]["usadas"] == 1


async def test_se_decide_por_el_contenido_no_por_el_nombre(cliente, monkeypatch):
    # Un ejecutable disfrazado de PDF.
    r, token, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo("virus.pdf", b"MZ\x90\x00 programa", "application/pdf")])
    assert r.status_code == 415 and llamadas == []
    assert (await _uso(cliente, token))["usadas"] == 0  # se rechaza antes de gastar un crédito


async def test_un_pdf_con_otro_nombre_si_se_acepta(cliente, monkeypatch):
    r, _, _ = await _analizar_con(cliente, monkeypatch, [_archivo("foto-del-libro.txt", PDF, "text/plain")])
    assert r.status_code == 200


async def test_un_archivo_vacio_se_rechaza(cliente, monkeypatch):
    r, _, _ = await _analizar_con(cliente, monkeypatch, [_archivo("vacio.pdf", b"")])
    assert r.status_code == 415


async def test_mas_de_diez_archivos_se_rechazan(cliente, monkeypatch):
    r, _, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo(f"{i}.pdf") for i in range(11)])
    assert r.status_code == 400 and llamadas == []


async def test_el_tope_de_tamano_se_aplica_leyendo_por_partes(cliente, monkeypatch):
    monkeypatch.setattr(ia, "MAX_BYTES_MATERIAL", 100)
    grande = PDF + b"0" * 200
    r, token, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo("grande.pdf", grande)])
    assert r.status_code == 413 and llamadas == []
    assert (await _uso(cliente, token))["usadas"] == 0


async def test_el_tope_cuenta_la_suma_de_todos_los_archivos(cliente, monkeypatch):
    monkeypatch.setattr(ia, "MAX_BYTES_MATERIAL", 100)
    r, _, _ = await _analizar_con(cliente, monkeypatch, [_archivo("a.pdf", PDF + b"0" * 60), _archivo("b.pdf", PDF + b"0" * 60)])
    assert r.status_code == 413


async def test_el_middleware_corta_antes_de_leer_el_cuerpo(cliente):
    token = await crear_docente(cliente)
    r = await cliente.post(
        "/ia/materiales/analizar",
        content=b"x",
        headers={**auth(token), "content-type": "multipart/form-data; boundary=x", "content-length": str(500 * 1024 * 1024)},
    )
    assert r.status_code == 413 and "20 MB" in r.json()["detail"]


async def test_si_la_ia_no_logra_leer_el_material_se_devuelve_el_credito(cliente, monkeypatch):
    r, token, _ = await _analizar_con(cliente, monkeypatch, [_archivo()], secuencia=["basura", "basura", "basura"])
    assert r.status_code == 502
    assert (await _uso(cliente, token))["usadas"] == 0


async def test_el_analisis_pasa_al_siguiente_modelo_si_uno_falla(cliente, monkeypatch):
    r, _, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo()], secuencia=[_error(503), _error(403), TEMAS])
    assert r.status_code == 200 and len(llamadas) == 3


@pytest.mark.parametrize(
    "texto",
    [TEMAS, "```json\n" + json.dumps(TEMAS) + "\n```", TEMAS["temas"]],
    ids=["objeto", "bloque_de_codigo", "lista_directa"],
)
async def test_el_analisis_acepta_las_formas_que_usa_la_ia(cliente, monkeypatch, texto):
    r, _, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo()], secuencia=[texto])
    assert r.status_code == 200 and len(llamadas) == 1


async def test_una_respuesta_cortada_pasa_al_siguiente_modelo(cliente, monkeypatch):
    r, _, llamadas = await _analizar_con(cliente, monkeypatch, [_archivo()], secuencia=['{"temas": [{"titulo": "La foto', TEMAS])
    assert r.status_code == 200 and len(llamadas) == 2


async def test_temas_sin_titulo_se_descartan(cliente, monkeypatch):
    r, _, llamadas = await _analizar_con(
        cliente, monkeypatch, [_archivo()], secuencia=[{"temas": [{"descripcion": "sin título"}]}, TEMAS]
    )
    assert r.status_code == 200 and len(llamadas) == 2


def test_leer_temas_recorta_longitudes_absurdas():
    temas = ia._leer_temas(json.dumps({"temas": [{"titulo": "t" * 900, "descripcion": "d" * 9000}]}))
    assert len(temas[0]["titulo"]) == 240 and len(temas[0]["descripcion"]) == 600


async def test_nunca_se_lee_un_archivo_completo_sin_tope(cliente, monkeypatch):
    """Cada lectura pide como mucho «lo que falta del tope + 1» bytes, no el archivo entero."""
    from starlette.datastructures import UploadFile

    pedidos = []
    leer_original = UploadFile.read

    async def espia(self, size=-1):
        pedidos.append(size)
        return await leer_original(self, size)

    monkeypatch.setattr(UploadFile, "read", espia)
    r, _, _ = await _analizar_con(cliente, monkeypatch, [_archivo("a.pdf"), _archivo("b.pdf")])
    assert r.status_code == 200
    assert pedidos and all(0 < p <= ia.MAX_BYTES_MATERIAL + 1 for p in pedidos)
