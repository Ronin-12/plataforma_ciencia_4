"""Pruebas de seguridad de la API (RNF-02): sesión, roles, aislamiento entre docentes, PIN y bloqueo."""

import json
import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from google.genai import errors as gerrors

from app.core.config import settings
from app.db import session
from app.routers import ia
from tests.conftest import CLAVE, auth, crear_docente


# ---------------------------------------------------------------- rutas sin sesión


@pytest.mark.parametrize(
    "metodo,ruta",
    [
        ("GET", "/alumnos/"),
        ("POST", "/alumnos/"),
        ("POST", f"/alumnos/{uuid.uuid4()}/restablecer-pin"),
        ("POST", "/ia/generar-juego"),
        ("GET", "/ia/juegos"),
        ("GET", "/docentes/yo"),
    ],
)
async def test_rutas_protegidas_exigen_token(cliente, metodo, ruta):
    r = await cliente.request(metodo, ruta, json={} if metodo == "POST" else None)
    assert r.status_code == 401, (ruta, r.status_code, r.text)


async def test_rutas_viejas_con_id_en_la_direccion_ya_no_existen(cliente):
    token = await crear_docente(cliente)
    otro = uuid.uuid4()
    assert (await cliente.get(f"/alumnos/docente/{otro}", headers=auth(token))).status_code in (404, 405)
    assert (await cliente.get(f"/ia/juegos/{otro}", headers=auth(token))).status_code in (404, 405)


def _token(sub, rol="docente", clave=None, minutos=30, extra=None):
    ahora = datetime.now(timezone.utc)
    payload = {"sub": str(sub), "rol": rol, "iat": ahora, "exp": ahora + timedelta(minutes=minutos)}
    payload.update(extra or {})
    return jwt.encode(payload, clave or settings.SECRET_KEY, algorithm="HS256")


async def test_tokens_invalidos_se_rechazan(cliente):
    token_real = await crear_docente(cliente)
    id_real = jwt.decode(token_real, options={"verify_signature": False})["sub"]
    malos = {
        "firmado con otra clave": _token(id_real, clave="otra-clave-" + "z" * 40),
        "expirado": _token(id_real, minutos=-5),
        "usuario inexistente": _token(uuid.uuid4()),
        "sub que no es uuid": _token("no-es-uuid"),
        "rol inventado": _token(id_real, rol="superadmin"),
        "rol administrador sin serlo": _token(id_real, rol="administrador"),
        "basura": "esto.no.es.un.jwt",
    }
    sin_rol = jwt.encode(
        {"sub": id_real, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
        settings.SECRET_KEY,
        algorithm="HS256",
    )
    malos["sin claim rol"] = sin_rol
    sin_firma = jwt.encode({"sub": id_real, "rol": "docente"}, key="", algorithm="none")
    malos["alg none"] = sin_firma
    for nombre, tok in malos.items():
        r = await cliente.get("/alumnos/", headers=auth(tok))
        assert r.status_code == 401, (nombre, r.status_code)


async def test_docente_desactivado_pierde_acceso_al_instante(cliente):
    token = await crear_docente(cliente)
    assert (await cliente.get("/alumnos/", headers=auth(token))).status_code == 200
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE docentes SET activo = FALSE")
    assert (await cliente.get("/alumnos/", headers=auth(token))).status_code == 401


# --------------------------------------------------------------- registro y login


async def test_registro_exige_codigo_de_invitacion(cliente):
    base = {"nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": CLAVE}
    r = await cliente.post("/docentes/registro", json={**base, "codigo_invitacion": "incorrecto"})
    assert r.status_code == 403
    r = await cliente.post("/docentes/registro", json=base)
    assert r.status_code == 422


async def test_registro_deshabilitado_si_no_hay_codigo(cliente, monkeypatch):
    monkeypatch.setattr(settings, "CODIGO_INVITACION_DOCENTES", "")
    r = await cliente.post(
        "/docentes/registro",
        json={"nombre": "Ana Pérez", "email": "a@b.mx", "password": CLAVE, "codigo_invitacion": "x"},
    )
    assert r.status_code == 503


async def test_registro_frena_adivinar_el_codigo(cliente):
    base = {"nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": CLAVE}
    codigos = []
    for i in range(12):
        r = await cliente.post("/docentes/registro", json={**base, "codigo_invitacion": f"mal-{i}"})
        codigos.append(r.status_code)
    assert codigos[:10] == [403] * 10 and 429 in codigos[10:]


@pytest.mark.parametrize("clave", ["1234567", "", "a" * 73, "ñ" * 40])
async def test_contrasenas_invalidas(cliente, clave):
    r = await cliente.post(
        "/docentes/registro",
        json={"nombre": "Ana Pérez", "email": "ana@escuela.mx", "password": clave, "codigo_invitacion": "invitacion-de-prueba"},
    )
    assert r.status_code == 422


async def test_correo_no_distingue_mayusculas(cliente):
    await crear_docente(cliente, email="Ana@Escuela.MX")
    r = await cliente.post(
        "/docentes/registro",
        json={"nombre": "Otra", "email": "ANA@escuela.mx", "password": CLAVE, "codigo_invitacion": "invitacion-de-prueba"},
    )
    assert r.status_code == 400
    r = await cliente.post("/docentes/login", json={"email": "aNa@ESCUELA.mx", "password": CLAVE})
    assert r.status_code == 200


async def test_token_de_docente_lleva_rol_y_login_devuelve_nombre_real(cliente):
    await crear_docente(cliente, nombre="Ana Pérez")
    r = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})
    cuerpo = r.json()
    payload = jwt.decode(cuerpo["access_token"], options={"verify_signature": False})
    assert payload["rol"] == "docente" and "iat" in payload
    assert cuerpo["docente"]["nombre"] == "Ana Pérez" and cuerpo["docente"]["rol"] == "docente"
    assert "password" not in json.dumps(cuerpo).lower()


async def test_login_no_revela_si_el_correo_existe(cliente):
    await crear_docente(cliente)
    existe = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": "mala-clave-1"})
    no_existe = await cliente.post("/docentes/login", json={"email": "nadie@escuela.mx", "password": "mala-clave-1"})
    assert existe.status_code == no_existe.status_code == 401
    assert existe.json() == no_existe.json()


async def test_bloqueo_tras_cinco_fallos_y_liberacion(cliente):
    await crear_docente(cliente)
    for _ in range(5):
        r = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": "mala-clave-1"})
        assert r.status_code == 401
    # Bloqueada: incluso la contraseña correcta recibe 429.
    r = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})
    assert r.status_code == 429 and "Retry-After" in r.headers
    # Al vencer el bloqueo vuelve a entrar y el contador se reinicia.
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE docentes SET bloqueado_hasta = now() - interval '1 second'")
    r = await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})
    assert r.status_code == 200


# ------------------------------------------------- aislamiento entre docentes y PIN


async def _crear_alumno(cliente, token, nombre="Sofía"):
    r = await cliente.post("/alumnos/", json={"nombre_pila": nombre}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


async def test_docente_no_ve_ni_toca_alumnos_de_otro(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    sofia = await _crear_alumno(cliente, ana)

    assert (await cliente.get("/alumnos/", headers=auth(beto))).json()["alumnos"] == []
    r = await cliente.post(f"/alumnos/{sofia['id_alumno']}/restablecer-pin", headers=auth(beto))
    assert r.status_code == 404
    # Beto intenta meter un alumno en el aula de Ana
    r = await cliente.post(
        "/alumnos/",
        json={"nombre_pila": "Intruso", "id_grupo": sofia["id_grupo"]},
        headers=auth(beto),
    )
    assert r.status_code == 404
    nombres = [a["nombre_pila"] for a in (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"]]
    assert nombres == ["Sofía"]


async def test_id_docente_enviado_por_el_cliente_se_ignora(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    id_ana = jwt.decode(ana, options={"verify_signature": False})["sub"]
    r = await cliente.post(
        "/alumnos/", json={"nombre_pila": "Luis", "id_docente": id_ana}, headers=auth(beto)
    )
    assert r.status_code == 201
    assert (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"] == []
    assert len((await cliente.get("/alumnos/", headers=auth(beto))).json()["alumnos"]) == 1


async def test_pin_se_guarda_con_bcrypt_y_no_se_vuelve_a_mostrar(cliente):
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    assert len(sofia["pin"]) == 4 and sofia["pin"].isdigit()
    assert "pin_hash" not in sofia

    async with session.get_db_pool().acquire() as conn:
        guardado = await conn.fetchval("SELECT pin_hash FROM alumnos")
    assert guardado.startswith("$2") and sofia["pin"] not in guardado

    lista = (await cliente.get("/alumnos/", headers=auth(ana))).text
    assert "pin" not in lista.lower()

    nuevo = (await cliente.post(f"/alumnos/{sofia['id_alumno']}/restablecer-pin", headers=auth(ana))).json()
    assert len(nuevo["pin"]) == 4


async def test_nombre_y_avatar_se_validan(cliente):
    ana = await crear_docente(cliente)
    for cuerpo in (
        {"nombre_pila": "   "},
        {"nombre_pila": "x" * 61},
        {"nombre_pila": "Ok", "avatar_url": "javascript:alert(1)"},
        {"nombre_pila": "Ok", "avatar_url": "//otro-sitio.com/a.png"},
    ):
        r = await cliente.post("/alumnos/", json=cuerpo, headers=auth(ana))
        assert r.status_code == 422, cuerpo
    r = await cliente.post(
        "/alumnos/", json={"nombre_pila": "  Ana   María ", "avatar_url": "https://x.mx/a.png"}, headers=auth(ana)
    )
    assert r.status_code == 201 and r.json()["nombre_pila"] == "Ana María"


# ------------------------------------------------------------ acceso del alumno


async def _entrar_alumno(cliente, codigo, id_alumno, pin):
    return await cliente.post(
        "/alumnos/login", json={"codigo_acceso": codigo, "id_alumno": id_alumno, "pin": pin}
    )


async def test_flujo_de_alumno_codigo_nombre_pin(cliente):
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    codigo = sofia["codigo_acceso"]

    aula = (await cliente.get(f"/alumnos/aula/{codigo}")).json()["alumnos"]
    assert [a["nombre_pila"] for a in aula] == ["Sofía"]
    assert set(aula[0]) == {"id_alumno", "nombre_pila", "avatar_url"}  # sin PIN ni datos de más

    assert (await cliente.get("/alumnos/aula/000000")).status_code == 404
    assert (await cliente.get("/alumnos/aula/abc")).status_code == 404

    r = await _entrar_alumno(cliente, codigo, sofia["id_alumno"], "0000" if sofia["pin"] != "0000" else "1111")
    assert r.status_code == 401
    r = await _entrar_alumno(cliente, "999999", sofia["id_alumno"], sofia["pin"])
    assert r.status_code == 401  # el alumno no pertenece a esa aula
    r = await _entrar_alumno(cliente, codigo, sofia["id_alumno"], sofia["pin"])
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["alumno"]["nombre"] == "Sofía"
    assert jwt.decode(cuerpo["access_token"], options={"verify_signature": False})["rol"] == "alumno"


async def test_alumno_tiene_permisos_de_alumno_y_nada_mas(cliente):
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    tok = (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], sofia["pin"])).json()["access_token"]

    assert (await cliente.get("/alumnos/", headers=auth(tok))).status_code == 403
    assert (await cliente.post("/alumnos/", json={"nombre_pila": "X"}, headers=auth(tok))).status_code == 403
    assert (await cliente.post(f"/alumnos/{sofia['id_alumno']}/restablecer-pin", headers=auth(tok))).status_code == 403
    assert (await cliente.post("/ia/generar-juego", json={"texto_prompt": "ciclo del agua"}, headers=auth(tok))).status_code == 403
    assert (await cliente.get("/ia/juegos", headers=auth(tok))).status_code == 200


async def test_alumno_se_bloquea_tras_cinco_pin_malos_y_docente_lo_libera(cliente):
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    malo = "0000" if sofia["pin"] != "0000" else "1111"
    for _ in range(5):
        assert (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], malo)).status_code == 401
    r = await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], sofia["pin"])
    assert r.status_code == 429

    bloqueado = (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"][0]["bloqueado"]
    assert bloqueado is True

    nuevo = (await cliente.post(f"/alumnos/{sofia['id_alumno']}/restablecer-pin", headers=auth(ana))).json()["pin"]
    assert (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], nuevo)).status_code == 200


async def test_pin_viejo_deja_de_servir_tras_restablecer(cliente):
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    for _ in range(20):  # el nuevo PIN casi siempre es distinto; se repite hasta que lo sea
        nuevo = (await cliente.post(f"/alumnos/{sofia['id_alumno']}/restablecer-pin", headers=auth(ana))).json()["pin"]
        if nuevo != sofia["pin"]:
            break
    assert (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], sofia["pin"])).status_code == 401


async def test_pin_existente_con_hash_de_pgcrypto_se_acepta(cliente):
    """La migración convierte PIN viejos con crypt(); Python debe poder verificarlos."""
    ana = await crear_docente(cliente)
    sofia = await _crear_alumno(cliente, ana)
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE alumnos SET pin_hash = crypt('4321', gen_salt('bf', 12))")
    assert (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], "4321")).status_code == 200


# --------------------------------------------------------------------------- IA

JUEGO = {
    "titulo": "El ciclo del agua",
    "instrucciones": "Elige la respuesta correcta.",
    "tipo_actividad": "quiz",
    "preguntas": [
        {"pregunta": f"Pregunta {i}", "opciones": ["a", "b", "c", "d"], "correcta": 0} for i in range(3)
    ],
}


class _Respuesta:
    text = json.dumps(JUEGO)


def _cliente_falso(fallos):
    """Cliente de Gemini falso: lanza los errores de `fallos` (uno por modelo) y luego responde bien."""
    pendientes = list(fallos)

    class _Modelos:
        async def generate_content(self, **kwargs):
            if pendientes:
                raise pendientes.pop(0)
            return _Respuesta()

    class _Aio:
        models = _Modelos()

    class _Cliente:
        def __init__(self, *a, **k):
            self.aio = _Aio()

    return _Cliente


async def test_generar_juego_guarda_con_el_docente_del_token(cliente, monkeypatch):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    id_beto = jwt.decode(beto, options={"verify_signature": False})["sub"]
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso([]))

    # Ana intenta guardar el juego a nombre de Beto: el servidor ignora ese campo.
    r = await cliente.post(
        "/ia/generar-juego",
        json={"texto_prompt": "ciclo del agua", "id_docente": id_beto},
        headers=auth(ana),
    )
    assert r.status_code == 200, r.text
    assert len((await cliente.get("/ia/juegos", headers=auth(ana))).json()["juegos"]) == 1
    assert (await cliente.get("/ia/juegos", headers=auth(beto))).json()["juegos"] == []


async def test_alumno_ve_los_juegos_de_su_docente_sin_el_prompt(cliente, monkeypatch):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    sofia = await _crear_alumno(cliente, ana)
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso([]))
    await cliente.post("/ia/generar-juego", json={"texto_prompt": "ciclo del agua"}, headers=auth(ana))
    await cliente.post("/ia/generar-juego", json={"texto_prompt": "juego de Beto"}, headers=auth(beto))

    tok = (await _entrar_alumno(cliente, sofia["codigo_acceso"], sofia["id_alumno"], sofia["pin"])).json()["access_token"]
    juegos = (await cliente.get("/ia/juegos", headers=auth(tok))).json()["juegos"]
    assert len(juegos) == 1 and "prompt_original" not in juegos[0]


async def test_respaldo_de_modelo_funciona_con_429_y_404(cliente, monkeypatch):
    """Antes, un 429/404 (ClientError) no activaba el modelo de respaldo y terminaba en error 500."""
    ana = await crear_docente(cliente)
    fallos = [
        gerrors.ClientError(429, {"error": {"message": "cuota", "status": "RESOURCE_EXHAUSTED"}}),
        gerrors.ClientError(404, {"error": {"message": "modelo", "status": "NOT_FOUND"}}),
    ]
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso(fallos))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "ciclo del agua"}, headers=auth(ana))
    assert r.status_code == 200, r.text


async def test_si_todos_los_modelos_fallan_responde_503_y_no_500(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    fallos = [gerrors.ClientError(429, {"error": {"message": "cuota", "status": "RESOURCE_EXHAUSTED"}})] * 3
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso(fallos))
    r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "ciclo del agua"}, headers=auth(ana))
    assert r.status_code == 503


async def test_tope_de_juegos_por_hora(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    monkeypatch.setattr(ia.genai, "Client", _cliente_falso([]))
    estados = []
    for _ in range(5):
        r = await cliente.post("/ia/generar-juego", json={"texto_prompt": "ciclo del agua"}, headers=auth(ana))
        estados.append(r.status_code)
    assert estados == [200, 200, 200, 429, 429]
