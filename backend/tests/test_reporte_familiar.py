"""Insignias del alumno (en /resultados) y reporte de avance para la familia (/alumnos/{id}/reporte)."""

import json
import uuid

from app.core import progreso as modulo_progreso
from tests.conftest import auth, crear_docente
from tests.test_metricas_filtros import intento_en, juego_de_tipo
from tests.test_resultados import crear_alumno_con_sesion, cuerpo


async def reporte(cliente, token, id_alumno):
    r = await cliente.get(f"/alumnos/{id_alumno}/reporte", headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


def ids(insignias):
    return {i["id"] for i in insignias if i["obtenida"]}


# ---------------------------------------------------------------- insignias


async def test_mios_trae_las_insignias_y_van_ganandose_al_jugar(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Ciclo del agua")
    await juego_de_tipo(ana, "Plantas")
    await juego_de_tipo(ana, "Animales")
    _, tok = await crear_alumno_con_sesion(cliente, ana)

    antes = (await cliente.get("/resultados/mios", headers=auth(tok))).json()["logros"]
    assert antes["obtenidas"] == 0 and antes["total"] == 8 and antes["nivel"]["nombre"] == "Cría de murciélago"

    await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok))
    despues = (await cliente.get("/resultados/mios", headers=auth(tok))).json()["logros"]
    assert ids(despues["insignias"]) == {"primer_vuelo", "eco_perfecto"}
    assert despues["nivel"]["nombre"] == "Murciélago explorador"


async def test_al_guardar_se_avisa_de_las_insignias_nuevas_una_sola_vez(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Ciclo del agua")
    _, tok = await crear_alumno_con_sesion(cliente, ana)

    primero = (await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok))).json()
    assert {i["id"] for i in primero["logros_nuevos"]} == {"primer_vuelo", "eco_perfecto"}
    assert all(i["obtenida"] for i in primero["logros_nuevos"])

    # Repetir no vuelve a "ganar" lo que ya tenía.
    segundo = (await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok))).json()
    assert segundo["logros_nuevos"] == []
    assert segundo["numero_intento"] == 2  # y la respuesta de siempre sigue completa


async def test_constancia_cuenta_dias_distintos_en_la_hora_de_la_escuela(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Ciclo del agua")
    a, tok = await crear_alumno_con_sesion(cliente, ana)
    # 02:00 UTC del 13 es todavía el 12 en México (8 p. m.): son DOS días, no tres.
    await intento_en(a["id_alumno"], juego, "2026-11-13 02:00+00")
    await intento_en(a["id_alumno"], juego, "2026-11-12 15:00+00")
    await intento_en(a["id_alumno"], juego, "2026-11-14 15:00+00")
    logros = (await cliente.get("/resultados/mios", headers=auth(tok))).json()["logros"]
    constante = next(i for i in logros["insignias"] if i["id"] == "vuelo_constante")
    assert (constante["actual"], constante["obtenida"]) == (2, False)

    await intento_en(a["id_alumno"], juego, "2026-11-16 15:00+00")
    logros = (await cliente.get("/resultados/mios", headers=auth(tok))).json()["logros"]
    assert "vuelo_constante" in ids(logros["insignias"])


async def test_si_fallan_las_insignias_el_resultado_del_alumno_se_guarda_igual(cliente, monkeypatch):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Ciclo del agua")
    _, tok = await crear_alumno_con_sesion(cliente, ana)

    async def roto(*_a, **_k):
        raise RuntimeError("falla simulada")

    monkeypatch.setattr(modulo_progreso, "cargar_progreso", roto)
    r = await cliente.post("/resultados/", json=cuerpo(juego, 80), headers=auth(tok))
    assert r.status_code == 201 and r.json()["logros_nuevos"] == []
    mios = (await cliente.get("/resultados/mios", headers=auth(tok))).json()
    assert mios["logros"] is None and mios["puntos_totales"] == 8  # los puntos de siempre no se afectan


# ------------------------------------------------------------------ reporte


async def test_el_reporte_solo_lo_pide_el_docente_del_alumno(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    sofia, tok_alumno = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    ruta = f"/alumnos/{sofia['id_alumno']}/reporte"

    assert (await cliente.get(ruta)).status_code == 401
    assert (await cliente.get(ruta, headers=auth(tok_alumno))).status_code == 403  # un alumno no pide reportes
    assert (await cliente.get(ruta, headers=auth(beto))).status_code == 404  # docente ajeno: como si no existiera
    assert (await cliente.get(f"/alumnos/{uuid.uuid4()}/reporte", headers=auth(ana))).status_code == 404
    assert (await cliente.get(ruta, headers=auth(ana))).status_code == 200


async def test_el_reporte_resume_lo_hecho_lo_pendiente_y_lo_que_hay_que_repasar(cliente):
    ana = await crear_docente(cliente)
    agua = await juego_de_tipo(ana, "El ciclo del agua")
    plantas = await juego_de_tipo(ana, "Las plantas")
    await juego_de_tipo(ana, "Los animales")  # aprobado, sin hacer
    await juego_de_tipo(ana, "Borrador sin aprobar", estado="borrador")  # el alumno no lo ve: no cuenta
    await juego_de_tipo(ana, "Actividad retirada", estado="descartado")
    sofia, tok = await crear_alumno_con_sesion(cliente, ana, "Sofía")

    await cliente.post("/resultados/", json=cuerpo(agua, 40), headers=auth(tok))
    await cliente.post("/resultados/", json=cuerpo(agua, 90), headers=auth(tok))  # mejora: el mejor es 90
    await cliente.post("/resultados/", json=cuerpo(plantas, 40), headers=auth(tok))

    r = await reporte(cliente, ana, sofia["id_alumno"])
    assert r["alumno"]["nombre"] == "Sofía" and r["alumno"]["grado"] == 4
    assert r["docente"]["nombre"] == "Ana Pérez"
    assert r["resumen"] == {"disponibles": 3, "realizadas": 2, "pendientes": 1, "promedio": 65, "intentos": 3, "dias_activos": 1}
    assert r["puntos"] == 9 + 4  # round(90/10) + round(40/10): igual que en el menú del alumno
    assert r["fortalezas"] == ["El ciclo del agua"] and r["para_repasar"] == ["Las plantas"]
    por_titulo = {a["titulo"]: a for a in r["actividades"]}
    assert set(por_titulo) == {"El ciclo del agua", "Las plantas", "Los animales"}  # sin borrador ni retirada
    assert (por_titulo["El ciclo del agua"]["mejor"], por_titulo["El ciclo del agua"]["intentos"]) == (90, 2)
    assert por_titulo["Los animales"]["realizada"] is False and por_titulo["Los animales"]["mejor"] is None
    assert r["logros"]["obtenidas"] >= 1 and "primer_vuelo" in ids(r["logros"]["insignias"])


async def test_el_reporte_de_un_alumno_sin_actividad_no_falla(cliente):
    ana = await crear_docente(cliente)
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    r = await reporte(cliente, ana, sofia["id_alumno"])
    assert r["resumen"] == {"disponibles": 0, "realizadas": 0, "pendientes": 0, "promedio": None, "intentos": 0, "dias_activos": 0}
    assert r["actividades"] == [] and r["fortalezas"] == [] and r["para_repasar"] == [] and r["puntos"] == 0


async def test_el_reporte_no_filtra_datos_de_otros_alumnos(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "El ciclo del agua")
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    _, tok_mateo = await crear_alumno_con_sesion(cliente, ana, "Mateo")
    await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok_sofia))
    await cliente.post("/resultados/", json=cuerpo(juego, 10), headers=auth(tok_mateo))

    texto = json.dumps(await reporte(cliente, ana, sofia["id_alumno"]), ensure_ascii=False)
    assert "Mateo" not in texto  # ni el nombre de un compañero...
    assert '"mejor": 100' in texto and '"mejor": 10,' not in texto  # ...ni su resultado
    assert '"intentos": 1' in texto


async def test_un_alumno_desactivado_conserva_su_reporte(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "El ciclo del agua")
    sofia, tok = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await cliente.post("/resultados/", json=cuerpo(juego, 70), headers=auth(tok))
    r = await cliente.patch(f"/alumnos/{sofia['id_alumno']}", json={"activo": False}, headers=auth(ana))
    assert r.status_code == 200
    assert (await reporte(cliente, ana, sofia["id_alumno"]))["resumen"]["realizadas"] == 1


async def test_la_fecha_del_ultimo_intento_es_la_del_dia_en_la_escuela(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "El ciclo del agua")
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await intento_en(sofia["id_alumno"], juego, "2026-11-13 02:00+00")  # 8 p. m. del 12 en México
    r = await reporte(cliente, ana, sofia["id_alumno"])
    assert r["actividades"][0]["ultimo"] == "2026-11-12"


async def test_el_reporte_incluye_la_escuela_del_docente(cliente):
    r = await cliente.post(
        "/docentes/registro",
        json={"nombre": "Luz Mora", "email": "luz@escuela.mx", "password": "ClaveSegura123!", "codigo_invitacion": "invitacion-de-prueba", "escuela": "Primaria Benito Juárez"},
    )
    assert r.status_code == 201, r.text
    tok = (await cliente.post("/docentes/login", json={"email": "luz@escuela.mx", "password": "ClaveSegura123!"})).json()["access_token"]
    sofia, _ = await crear_alumno_con_sesion(cliente, tok, "Sofía")
    assert (await reporte(cliente, tok, sofia["id_alumno"]))["docente"] == {"nombre": "Luz Mora", "escuela": "Primaria Benito Juárez"}
