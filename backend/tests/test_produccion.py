"""Sprint L (publicación): registro con escuela y términos, recuperar contraseña, planes con límite
diario, medición de tokens, formulario de contacto y configuración para producción."""

import json
import re
import uuid

import pytest
from starlette.requests import Request

from app.core import planes
from app.core.config import Settings, settings
from app.core.limites import ip_cliente
from app.db import session
from app.ia import gemini
from app.routers import docentes
from tests.conftest import CLAVE, auth, crear_docente
from tests.test_admin import crear_admin
from tests.test_ia import _quiz


async def _registrar(cliente, **extra):
    datos = {
        "nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": CLAVE,
        "codigo_invitacion": "invitacion-de-prueba", "acepta_terminos": True,
    }
    datos.update(extra)
    return await cliente.post("/docentes/registro", json=datos)


async def _login(cliente, email="ana@escuela.mx", password=CLAVE):
    return await cliente.post("/docentes/login", json={"email": email, "password": password})


# ------------------------------------------------------------------- registro y términos


async def test_sin_aceptar_terminos_no_se_crea_la_cuenta(cliente):
    r = await _registrar(cliente, acepta_terminos=False)
    assert r.status_code == 422 and "aviso de privacidad" in r.text
    datos = {"nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": CLAVE, "codigo_invitacion": "invitacion-de-prueba"}
    assert (await cliente.post("/docentes/registro", json=datos)).status_code == 422


async def test_se_guardan_tipo_de_escuela_cct_y_aceptacion(cliente):
    r = await _registrar(cliente, tipo_escuela="publica", cct=" 09dpr-1234x ")
    assert r.status_code == 201, r.text
    cuerpo = r.json()
    assert (cuerpo["tipo_escuela"], cuerpo["cct"], cuerpo["plan"]) == ("publica", "09DPR1234X", "gratis")
    async with session.get_db_pool().acquire() as conn:
        fila = await conn.fetchrow("SELECT acepto_terminos_en, version_terminos FROM docentes")
    assert fila["acepto_terminos_en"] is not None and fila["version_terminos"] == settings.VERSION_TERMINOS


@pytest.mark.parametrize("cct", ["123", "09DP1234XX", "AADPR1234X"])
async def test_cct_con_forma_incorrecta(cliente, cct):
    assert (await _registrar(cliente, cct=cct)).status_code == 422


async def test_tipo_de_escuela_invalido(cliente):
    assert (await _registrar(cliente, tipo_escuela="mixta")).status_code == 422


async def test_yo_devuelve_el_plan(cliente):
    token = await crear_docente(cliente)
    yo = (await cliente.get("/docentes/yo", headers=auth(token))).json()
    assert yo["plan"]["id"] == "gratis" and yo["plan"]["mensual"] == settings.IA_GENERACIONES_MENSUALES_MAX


# ---------------------------------------------------------------- recuperar contraseña


@pytest.fixture
def correos(monkeypatch):
    enviados = []

    async def falso(destino, asunto, texto):
        enviados.append({"destino": destino, "asunto": asunto, "texto": texto})

    monkeypatch.setattr(docentes, "enviar_correo", falso)
    return enviados


def _token_del_correo(correo) -> str:
    return re.search(r"restablecer=([\w-]+)", correo["texto"]).group(1)


async def test_correo_desconocido_recibe_el_mismo_mensaje_y_no_se_envia_nada(cliente, correos):
    await crear_docente(cliente)
    conocido = await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    desconocido = await cliente.post("/docentes/recuperar", json={"email": "nadie@escuela.mx"})
    assert conocido.status_code == desconocido.status_code == 200
    assert conocido.json() == desconocido.json()
    assert [c["destino"] for c in correos] == ["ana@escuela.mx"]


async def test_restablecer_cambia_la_contrasena_y_cierra_las_sesiones(cliente, correos):
    sesion_vieja = await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ANA@escuela.mx"})
    token = _token_del_correo(correos[0])
    assert "http://localhost:5173/?restablecer=" in correos[0]["texto"]

    r = await cliente.post("/docentes/restablecer", json={"token": token, "password": "Nueva-Clave-22"})
    assert r.status_code == 200, r.text
    assert (await _login(cliente)).status_code == 401
    assert (await _login(cliente, password="Nueva-Clave-22")).status_code == 200
    # La sesión abierta antes del cambio ya no vale (por si alguien la había robado).
    assert (await cliente.get("/docentes/yo", headers=auth(sesion_vieja))).status_code == 401
    nueva = (await _login(cliente, password="Nueva-Clave-22")).json()["access_token"]
    assert (await cliente.get("/docentes/yo", headers=auth(nueva))).status_code == 200


async def test_el_enlace_solo_sirve_una_vez(cliente, correos):
    await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    token = _token_del_correo(correos[0])
    assert (await cliente.post("/docentes/restablecer", json={"token": token, "password": "Nueva-Clave-22"})).status_code == 200
    r = await cliente.post("/docentes/restablecer", json={"token": token, "password": "Otra-Clave-33"})
    assert r.status_code == 400 and "no es válido" in r.json()["detail"]


async def test_un_enlace_nuevo_anula_el_anterior(cliente, correos):
    await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    viejo, nuevo = _token_del_correo(correos[0]), _token_del_correo(correos[1])
    assert (await cliente.post("/docentes/restablecer", json={"token": viejo, "password": "Nueva-Clave-22"})).status_code == 400
    assert (await cliente.post("/docentes/restablecer", json={"token": nuevo, "password": "Nueva-Clave-22"})).status_code == 200


async def test_el_enlace_caduca(cliente, correos):
    await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE recuperaciones_password SET expira_en = now() - interval '1 minute'")
    token = _token_del_correo(correos[0])
    assert (await cliente.post("/docentes/restablecer", json={"token": token, "password": "Nueva-Clave-22"})).status_code == 400


async def test_en_la_base_solo_queda_la_huella_del_enlace(cliente, correos):
    await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    token = _token_del_correo(correos[0])
    async with session.get_db_pool().acquire() as conn:
        guardado = await conn.fetchval("SELECT token_hash FROM recuperaciones_password")
    assert guardado != token and len(guardado) == 64


async def test_una_cuenta_desactivada_no_recibe_enlace(cliente, correos):
    await crear_docente(cliente)
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE docentes SET activo = FALSE")
    r = await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    assert r.status_code == 200 and correos == []


async def test_restablecer_desbloquea_la_cuenta(cliente, correos):
    await crear_docente(cliente)
    for _ in range(settings.LOGIN_MAX_INTENTOS):
        await _login(cliente, password="incorrecta")
    assert (await _login(cliente)).status_code == 429
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    token = _token_del_correo(correos[0])
    await cliente.post("/docentes/restablecer", json={"token": token, "password": "Nueva-Clave-22"})
    assert (await _login(cliente, password="Nueva-Clave-22")).status_code == 200


async def test_no_se_llena_la_bandeja_de_una_persona(cliente, correos):
    await crear_docente(cliente)
    for _ in range(6):
        assert (await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})).status_code == 200
    assert len(correos) == 3


async def test_restablecer_exige_una_contrasena_valida(cliente, correos):
    await crear_docente(cliente)
    await cliente.post("/docentes/recuperar", json={"email": "ana@escuela.mx"})
    token = _token_del_correo(correos[0])
    assert (await cliente.post("/docentes/restablecer", json={"token": token, "password": "corta"})).status_code == 422


# ------------------------------------------------------------------ planes y límite diario


async def _generar(cliente, token):
    return await cliente.post(
        "/ia/generar-juego", json={"texto_prompt": "las partes de una planta", "tipo_actividad": "quiz"}, headers=auth(token)
    )


class _Uso:
    prompt_token_count = 1200
    candidates_token_count = 300
    thoughts_token_count = 200


def _gemini_con_tokens(respuestas):
    pendientes = list(respuestas)

    class _Modelos:
        async def generate_content(self, **kwargs):
            elemento = pendientes.pop(0)

            class _R:
                text = json.dumps(elemento)
                usage_metadata = _Uso()

            return _R()

    class _Aio:
        models = _Modelos()

    class _Cliente:
        def __init__(self, *a, **k):
            self.aio = _Aio()

    return _Cliente


async def test_limite_diario_y_no_cobra_el_mes_si_el_dia_esta_lleno(cliente, monkeypatch):
    monkeypatch.setattr(settings, "IA_GENERACIONES_DIARIAS_MAX", 2)
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _gemini_con_tokens([_quiz()] * 3))
    assert (await _generar(cliente, token)).status_code == 200
    assert (await _generar(cliente, token)).status_code == 200
    r = await _generar(cliente, token)
    assert r.status_code == 429 and "de hoy" in r.json()["detail"]
    uso = (await cliente.get("/ia/uso", headers=auth(token))).json()
    assert (uso["usadas"], uso["usadas_hoy"], uso["disponibles_hoy"]) == (2, 2, 0)


async def test_un_fallo_devuelve_tambien_el_credito_del_dia(cliente, monkeypatch):
    token = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _gemini_con_tokens([_quiz(opciones=3)] * 6))
    assert (await _generar(cliente, token)).status_code == 502
    uso = (await cliente.get("/ia/uso", headers=auth(token))).json()
    assert (uso["usadas"], uso["usadas_hoy"]) == (0, 0)


async def test_el_admin_asigna_un_plan_y_cambian_los_limites(cliente):
    admin = await crear_admin(cliente)
    ana = await crear_docente(cliente)
    yo = (await cliente.get("/docentes/yo", headers=auth(ana))).json()["id_docente"]
    r = await cliente.patch(f"/admin/docentes/{yo}/plan", json={"plan": "docente"}, headers=auth(admin))
    assert r.status_code == 200 and r.json()["mensual"] == planes.plan("docente").mensual
    uso = (await cliente.get("/ia/uso", headers=auth(ana))).json()
    assert (uso["plan"], uso["limite"], uso["limite_diario"]) == ("docente", 40, planes.plan("docente").diario)
    lista = (await cliente.get("/admin/docentes", headers=auth(admin))).json()["docentes"]
    assert {d["email"]: d["creditos_limite"] for d in lista}["ana@escuela.mx"] == 40


async def test_plan_invalido_y_permisos(cliente):
    admin = await crear_admin(cliente)
    ana = await crear_docente(cliente)
    yo = (await cliente.get("/docentes/yo", headers=auth(ana))).json()["id_docente"]
    assert (await cliente.patch(f"/admin/docentes/{yo}/plan", json={"plan": "oro"}, headers=auth(admin))).status_code == 422
    assert (await cliente.patch(f"/admin/docentes/{yo}/plan", json={"plan": "docente"}, headers=auth(ana))).status_code == 403
    r = await cliente.patch(f"/admin/docentes/{uuid.uuid4()}/plan", json={"plan": "docente"}, headers=auth(admin))
    assert r.status_code == 404
    assert (await cliente.get("/admin/planes", headers=auth(ana))).status_code == 403
    ids = [p["id"] for p in (await cliente.get("/admin/planes", headers=auth(admin))).json()["planes"]]
    assert ids == ["gratis", "maestro", "docente", "escuela"]


# ------------------------------------------------------------------ medición de tokens


async def test_se_guardan_los_tokens_y_el_admin_ve_el_costo(cliente, monkeypatch):
    admin = await crear_admin(cliente)
    ana = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _gemini_con_tokens([_quiz()]))
    assert (await _generar(cliente, ana)).status_code == 200
    async with session.get_db_pool().acquire() as conn:
        fila = await conn.fetchrow("SELECT tarea, tokens_entrada, tokens_salida FROM ia_uso_tokens")
    assert (fila["tarea"], fila["tokens_entrada"], fila["tokens_salida"]) == ("juego", 1200, 500)
    r = (await cliente.get("/admin/uso-ia", headers=auth(admin))).json()
    esperado = (1200 * settings.IA_PRECIO_ENTRADA_USD_MTOK + 500 * settings.IA_PRECIO_SALIDA_USD_MTOK) / 1_000_000
    assert r["costo_usd"] == round(esperado, 4) and r["generaciones_cobradas"] == 1
    assert r["costo_por_generacion_mxn"] == round(esperado * settings.IA_TIPO_CAMBIO_MXN, 2)


async def test_los_intentos_fallidos_tambien_cuentan_tokens(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    monkeypatch.setattr(gemini.genai, "Client", _gemini_con_tokens([_quiz(opciones=3)] * 6))
    assert (await _generar(cliente, ana)).status_code == 502
    async with session.get_db_pool().acquire() as conn:
        llamadas = await conn.fetchval("SELECT COUNT(*) FROM ia_uso_tokens")
    assert llamadas >= 2


# ------------------------------------------------------------------ formulario de contacto


def _solicitud(**extra):
    datos = {
        "nombre": "Laura Díaz", "email": "Laura@Escuela.mx", "telefono": "55 1234 5678",
        "escuela": "Primaria Benito Juárez", "tipo_escuela": "publica", "cct": "09dpr1234x",
        "num_docentes": 12, "plan_interes": "licencia", "mensaje": "Queremos probar Mupi.", "acepta_privacidad": True,
    }
    datos.update(extra)
    return datos


async def test_la_solicitud_llega_al_panel_del_admin(cliente):
    admin = await crear_admin(cliente)
    r = await cliente.post("/contacto", json=_solicitud())
    assert r.status_code == 201, r.text
    lista = (await cliente.get("/admin/solicitudes", headers=auth(admin))).json()["solicitudes"]
    assert len(lista) == 1
    s = lista[0]
    assert (s["email"], s["cct"], s["telefono"], s["estado"]) == ("laura@escuela.mx", "09DPR1234X", "5512345678", "nueva")
    r = await cliente.patch(f"/admin/solicitudes/{s['id_solicitud']}", json={"estado": "en_proceso"}, headers=auth(admin))
    assert r.status_code == 200
    assert (await cliente.get("/admin/solicitudes", headers=auth(admin))).json()["solicitudes"][0]["estado"] == "en_proceso"


@pytest.mark.parametrize(
    "cambio", [{"acepta_privacidad": False}, {"num_docentes": 0}, {"tipo_escuela": "otra"}, {"telefono": "12"}, {"cct": "x"}]
)
async def test_solicitudes_invalidas(cliente, cambio):
    assert (await cliente.post("/contacto", json=_solicitud(**cambio))).status_code == 422


async def test_los_robots_no_se_guardan(cliente):
    r = await cliente.post("/contacto", json=_solicitud(sitio_web="http://spam.example"))
    assert r.status_code == 201
    async with session.get_db_pool().acquire() as conn:
        assert await conn.fetchval("SELECT COUNT(*) FROM solicitudes_contacto") == 0


async def test_el_formulario_tiene_limite_por_red(cliente):
    codigos = [(await cliente.post("/contacto", json=_solicitud())).status_code for _ in range(6)]
    assert codigos == [201] * 5 + [429]


async def test_solo_el_admin_ve_las_solicitudes(cliente):
    ana = await crear_docente(cliente)
    assert (await cliente.get("/admin/solicitudes", headers=auth(ana))).status_code == 403
    assert (await cliente.get("/admin/solicitudes")).status_code == 401


# ------------------------------------------------------------------ configuración


@pytest.mark.sin_bd
def test_origenes_cors_desde_env():
    conf = Settings(DATABASE_URL="x", SECRET_KEY="k" * 40, CORS_ORIGENES=" https://mupi.mx/ , https://www.mupi.mx ")
    assert conf.origenes_cors == ["https://mupi.mx", "https://www.mupi.mx"]


def _peticion(ip: str, cabeceras: dict[str, str]) -> Request:
    return Request({
        "type": "http", "method": "GET", "path": "/", "client": (ip, 1234),
        "headers": [(k.lower().encode(), v.encode()) for k, v in cabeceras.items()],
    })


@pytest.mark.sin_bd
def test_ip_real_solo_si_se_confia_en_el_proxy(monkeypatch):
    monkeypatch.setattr(settings, "CONFIAR_EN_PROXY", False)
    assert ip_cliente(_peticion("127.0.0.1", {"X-Real-IP": "8.8.8.8"})) == "127.0.0.1"
    monkeypatch.setattr(settings, "CONFIAR_EN_PROXY", True)
    assert ip_cliente(_peticion("127.0.0.1", {"X-Real-IP": "8.8.8.8"})) == "8.8.8.8"
    # Desde fuera nadie puede hacerse pasar por otra IP.
    assert ip_cliente(_peticion("200.1.1.1", {"X-Real-IP": "8.8.8.8"})) == "200.1.1.1"
