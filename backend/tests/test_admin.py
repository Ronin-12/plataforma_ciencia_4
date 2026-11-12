"""Panel de administración (RF-09): permisos, cifras, desactivar docentes y privacidad de los alumnos."""

import json
import uuid
from datetime import date

import pytest

from app.db import session
from tests.conftest import CLAVE, auth, crear_docente
from tests.test_metricas_filtros import juego_de_tipo
from tests.test_resultados import _id, crear_alumno_con_sesion, cuerpo


async def crear_admin(cliente, email="admin@escuela.mx") -> str:
    """Crea una cuenta y la promueve a administrador (en producción se hace con una línea de SQL)."""
    await crear_docente(cliente, email, nombre="Admin Gómez")
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE docentes SET rol = 'administrador' WHERE email = $1", email)
    r = await cliente.post("/docentes/login", json={"email": email, "password": CLAVE})
    assert r.status_code == 200 and r.json()["docente"]["rol"] == "administrador", r.text
    return r.json()["access_token"]


async def poner_creditos(token_docente: str, usados: int):
    async with session.get_db_pool().acquire() as conn:
        await conn.execute(
            "INSERT INTO ia_generaciones_mes (id_docente, periodo, generaciones) VALUES ($1, $2, $3)",
            uuid.UUID(_id(token_docente)),
            date.today().replace(day=1),
            usados,
        )


async def docentes_de(cliente, admin) -> dict:
    r = await cliente.get("/admin/docentes", headers=auth(admin))
    assert r.status_code == 200, r.text
    return {d["nombre"]: d for d in r.json()["docentes"]}


async def escenario(cliente):
    """Ana (con grupo, 2 alumnos, 1 actividad aprobada + 1 borrador, 2 intentos, 3 créditos) y Beto (vacío)."""
    admin = await crear_admin(cliente)
    ana = await crear_docente(cliente, "ana@escuela.mx", nombre="Ana Pérez")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    aprobado = await juego_de_tipo(ana, "Quiz aprobado")
    await juego_de_tipo(ana, "Borrador", estado="borrador")
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    luis, tok_luis = await crear_alumno_con_sesion(cliente, ana, "Luis")
    await cliente.post("/resultados/", json=cuerpo(aprobado, 90), headers=auth(tok_sofia))
    await cliente.post("/resultados/", json=cuerpo(aprobado, 30), headers=auth(tok_luis))
    await poner_creditos(ana, 3)
    return admin, ana, beto, {"sofia": sofia, "luis": luis}


# ---------------------------------------------------------------- permisos


RUTAS = [("GET", "/admin/resumen"), ("GET", "/admin/docentes"), ("PATCH", f"/admin/docentes/{uuid.uuid4()}")]


@pytest.mark.parametrize("metodo,ruta", RUTAS)
async def test_sin_sesion_da_401(cliente, metodo, ruta):
    r = await cliente.request(metodo, ruta, json={"activo": False} if metodo == "PATCH" else None)
    assert r.status_code == 401


@pytest.mark.parametrize("metodo,ruta", RUTAS)
async def test_un_docente_no_entra_al_panel_de_administracion(cliente, metodo, ruta):
    ana = await crear_docente(cliente)
    r = await cliente.request(metodo, ruta, headers=auth(ana), json={"activo": False} if metodo == "PATCH" else None)
    assert r.status_code == 403


@pytest.mark.parametrize("metodo,ruta", RUTAS)
async def test_un_alumno_no_entra_al_panel_de_administracion(cliente, metodo, ruta):
    ana = await crear_docente(cliente)
    _, tok_alumno = await crear_alumno_con_sesion(cliente, ana)
    r = await cliente.request(metodo, ruta, headers=auth(tok_alumno), json={"activo": False} if metodo == "PATCH" else None)
    assert r.status_code == 403


async def test_un_docente_no_puede_ascenderse_cambiando_el_token(cliente):
    """El rol se valida contra la base: un token de docente nunca vale como administrador."""
    ana = await crear_docente(cliente)
    assert (await cliente.get("/admin/resumen", headers=auth(ana))).status_code == 403
    assert (await cliente.get("/admin/resumen", headers=auth(ana + "x"))).status_code == 401


# ------------------------------------------------------------------ cifras


async def test_la_lista_de_docentes_trae_sus_cifras(cliente):
    admin, ana, beto, _ = await escenario(cliente)
    docentes = await docentes_de(cliente, admin)

    assert set(docentes) == {"Ana Pérez", "Beto Ruiz"}  # el administrador no se lista a sí mismo
    a = docentes["Ana Pérez"]
    assert (a["grupos"], a["alumnos"], a["actividades"], a["intentos"]) == (1, 2, 1, 2)  # el borrador no cuenta
    assert (a["creditos_usados"], a["creditos_limite"], a["creditos_disponibles"]) == (3, 15, 12)
    assert a["activo"] is True and a["email"] == "ana@escuela.mx" and a["ultima_actividad"] is not None

    b = docentes["Beto Ruiz"]
    assert (b["grupos"], b["alumnos"], b["actividades"], b["intentos"], b["creditos_usados"]) == (0, 0, 0, 0, 0)
    assert b["ultima_actividad"] is None and b["creditos_disponibles"] == 15


async def test_el_resumen_general_suma_todo_el_piloto(cliente):
    admin, ana, beto, _ = await escenario(cliente)
    r = await cliente.get("/admin/resumen", headers=auth(admin))
    assert r.status_code == 200
    assert r.json() == {
        "docentes_activos": 2, "docentes_inactivos": 0, "grupos": 1, "alumnos_activos": 2,
        "actividades": 1, "intentos": 2, "creditos_usados_mes": 3, "creditos_por_docente": 15,
    }


async def test_alumnos_desactivados_no_cuentan_en_las_cifras_del_administrador(cliente):
    admin, ana, beto, alumnos = await escenario(cliente)
    await cliente.patch(f"/alumnos/{alumnos['luis']['id_alumno']}", json={"activo": False}, headers=auth(ana))
    resumen = (await cliente.get("/admin/resumen", headers=auth(admin))).json()
    assert resumen["alumnos_activos"] == 1 and resumen["intentos"] == 1
    a = (await docentes_de(cliente, admin))["Ana Pérez"]
    assert a["alumnos"] == 1 and a["intentos"] == 1


# --------------------------------------------------------------- privacidad


async def test_el_administrador_no_recibe_nombres_ni_datos_de_alumnos(cliente):
    admin, ana, beto, alumnos = await escenario(cliente)
    for ruta in ("/admin/docentes", "/admin/resumen"):
        texto = (await cliente.get(ruta, headers=auth(admin))).text
        for secreto in ("Sofía", "Luis", alumnos["sofia"]["codigo_acceso"], alumnos["sofia"]["pin"], alumnos["sofia"]["id_alumno"]):
            assert secreto not in texto, f"{ruta} filtró '{secreto}'"


# ------------------------------------------------------ activar / desactivar


async def test_desactivar_a_un_docente_corta_su_acceso_sin_borrar_nada(cliente):
    admin, ana, beto, _ = await escenario(cliente)
    r = await cliente.patch(f"/admin/docentes/{_id(ana)}", json={"activo": False}, headers=auth(admin))
    assert r.status_code == 200 and r.json() == {"id_docente": _id(ana), "activo": False}

    # No puede iniciar sesión y su sesión abierta deja de valer al instante.
    assert (await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})).status_code == 401
    assert (await cliente.get("/alumnos/", headers=auth(ana))).status_code == 401
    # Sus datos siguen ahí.
    a = (await docentes_de(cliente, admin))["Ana Pérez"]
    assert a["activo"] is False and (a["alumnos"], a["actividades"], a["intentos"]) == (2, 1, 2)
    resumen = (await cliente.get("/admin/resumen", headers=auth(admin))).json()
    assert resumen["docentes_activos"] == 1 and resumen["docentes_inactivos"] == 1

    # Se revierte: vuelve a entrar, y hasta su sesión anterior (sin vencer) vuelve a servir.
    r = await cliente.patch(f"/admin/docentes/{_id(ana)}", json={"activo": True}, headers=auth(admin))
    assert r.status_code == 200 and r.json()["activo"] is True
    assert (await cliente.post("/docentes/login", json={"email": "ana@escuela.mx", "password": CLAVE})).status_code == 200
    assert (await cliente.get("/alumnos/", headers=auth(ana))).status_code == 200


async def test_desactivar_a_un_docente_no_afecta_a_otro(cliente):
    admin, ana, beto, _ = await escenario(cliente)
    await cliente.patch(f"/admin/docentes/{_id(ana)}", json={"activo": False}, headers=auth(admin))
    assert (await cliente.get("/alumnos/", headers=auth(beto))).status_code == 200


async def test_una_cuenta_de_administrador_no_se_puede_desactivar(cliente):
    admin = await crear_admin(cliente)
    otro = await crear_admin(cliente, "admin2@escuela.mx")
    for objetivo in (admin, otro):  # ni a sí mismo ni a otro administrador
        r = await cliente.patch(f"/admin/docentes/{_id(objetivo)}", json={"activo": False}, headers=auth(admin))
        assert r.status_code == 403
    assert (await cliente.get("/admin/resumen", headers=auth(admin))).status_code == 200


async def test_desactivar_un_docente_inexistente_o_con_datos_malos(cliente):
    admin = await crear_admin(cliente)
    assert (await cliente.patch(f"/admin/docentes/{uuid.uuid4()}", json={"activo": False}, headers=auth(admin))).status_code == 404
    assert (await cliente.patch("/admin/docentes/no-es-un-uuid", json={"activo": False}, headers=auth(admin))).status_code == 422
    ana = await crear_docente(cliente)
    for cuerpo_malo in ({}, {"activo": "quizás"}, {"activo": None}):
        r = await cliente.patch(f"/admin/docentes/{_id(ana)}", json=cuerpo_malo, headers=auth(admin))
        assert r.status_code == 422, cuerpo_malo


async def test_un_administrador_desactivado_pierde_el_acceso(cliente):
    admin = await crear_admin(cliente)
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE docentes SET activo = FALSE WHERE email = 'admin@escuela.mx'")
    assert (await cliente.get("/admin/resumen", headers=auth(admin))).status_code == 401
