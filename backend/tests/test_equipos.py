"""Equipos cooperativos y misiones en equipo."""

import uuid

import pytest

from app.db import session
from tests.conftest import auth, crear_docente
from tests.test_grupos import alumno_en, nuevo_grupo
from tests.test_resultados import _id, crear_juego, cuerpo


async def nuevo_equipo(cliente, token, id_grupo, nombre="Águilas", icono="aguila"):
    r = await cliente.post("/equipos/", json={"id_grupo": id_grupo, "nombre": nombre, "icono": icono}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


async def poner(cliente, token, id_equipo, ids):
    r = await cliente.put(f"/equipos/{id_equipo}/integrantes", json={"ids_alumnos": ids}, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


async def lanzar(cliente, token, id_grupo, id_juego, meta=70):
    return await cliente.post("/equipos/misiones", json={"id_grupo": id_grupo, "id_juego": id_juego, "meta": meta}, headers=auth(token))


async def jugar(cliente, tok_alumno, id_juego, pct):
    r = await cliente.post("/resultados/", json=cuerpo(id_juego, pct), headers=auth(tok_alumno))
    assert r.status_code == 201, r.text


async def escenario(cliente):
    """Docente con un grupo, 4 alumnos y dos equipos de 2. Devuelve todo lo necesario para las pruebas."""
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana, "4.º A")
    alumnos = [await alumno_en(cliente, ana, g["id_grupo"], n) for n in ("Sofía", "Mateo", "Lucía", "Diego")]
    juego = await crear_juego(ana, "Los seres vivos")
    a = await nuevo_equipo(cliente, ana, g["id_grupo"], "Águilas", "aguila")
    b = await nuevo_equipo(cliente, ana, g["id_grupo"], "Delfines", "delfin")
    await poner(cliente, ana, a["id_equipo"], [alumnos[0][0]["id_alumno"], alumnos[1][0]["id_alumno"]])
    await poner(cliente, ana, b["id_equipo"], [alumnos[2][0]["id_alumno"], alumnos[3][0]["id_alumno"]])
    return ana, g, alumnos, juego, a, b


# ------------------------------------------------------------------ equipos


async def test_crear_listar_renombrar_y_borrar_equipos(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    a = await nuevo_equipo(cliente, ana, g["id_grupo"])
    lista = (await cliente.get(f"/equipos/?id_grupo={g['id_grupo']}", headers=auth(ana))).json()
    assert [e["nombre"] for e in lista["equipos"]] == ["Águilas"] and lista["sin_equipo"] == []
    r = await cliente.patch(f"/equipos/{a['id_equipo']}", json={"nombre": "  Halcones ", "icono": "cohete"}, headers=auth(ana))
    assert r.status_code == 200 and r.json()["nombre"] == "Halcones" and r.json()["icono"] == "cohete"
    assert (await cliente.delete(f"/equipos/{a['id_equipo']}", headers=auth(ana))).status_code == 200
    assert (await cliente.get(f"/equipos/?id_grupo={g['id_grupo']}", headers=auth(ana))).json()["equipos"] == []


async def test_nombre_repetido_icono_invalido_y_limite(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    await nuevo_equipo(cliente, ana, g["id_grupo"], "Águilas")
    dup = await cliente.post("/equipos/", json={"id_grupo": g["id_grupo"], "nombre": " águilas "}, headers=auth(ana))
    assert dup.status_code == 409
    assert (await cliente.post("/equipos/", json={"id_grupo": g["id_grupo"], "nombre": "X", "icono": "dragon"}, headers=auth(ana))).status_code == 422
    assert (await cliente.post("/equipos/", json={"id_grupo": g["id_grupo"], "nombre": "   "}, headers=auth(ana))).status_code == 422
    for i in range(9):
        await nuevo_equipo(cliente, ana, g["id_grupo"], f"E{i}", "estrella")
    sobra = await cliente.post("/equipos/", json={"id_grupo": g["id_grupo"], "nombre": "Uno más"}, headers=auth(ana))
    assert sobra.status_code == 409


async def test_permisos_sin_sesion_alumno_y_otro_docente(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    e = await nuevo_equipo(cliente, ana, g["id_grupo"])
    _, tok_alumno = await alumno_en(cliente, ana, g["id_grupo"])
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    ruta = f"/equipos/?id_grupo={g['id_grupo']}"
    assert (await cliente.get(ruta)).status_code == 401
    assert (await cliente.get(ruta, headers=auth(tok_alumno))).status_code == 403
    assert (await cliente.get(ruta, headers=auth(beto))).status_code == 404
    assert (await cliente.post("/equipos/", json={"id_grupo": g["id_grupo"], "nombre": "Intruso"}, headers=auth(beto))).status_code == 404
    assert (await cliente.patch(f"/equipos/{e['id_equipo']}", json={"nombre": "Mío"}, headers=auth(beto))).status_code == 404
    assert (await cliente.delete(f"/equipos/{e['id_equipo']}", headers=auth(beto))).status_code == 404
    assert (await cliente.put(f"/equipos/{e['id_equipo']}/integrantes", json={"ids_alumnos": []}, headers=auth(beto))).status_code == 404


async def test_integrantes_se_mueven_entre_equipos_y_solo_del_mismo_grupo(cliente):
    ana, g, alumnos, _, a, b = await escenario(cliente)
    sofia = alumnos[0][0]["id_alumno"]
    # Pasar a Sofía al equipo B la saca del A (un alumno está en un solo equipo).
    r = await poner(cliente, ana, b["id_equipo"], [sofia, alumnos[2][0]["id_alumno"]])
    por_nombre = {e["nombre"]: {p["nombre_pila"] for p in e["integrantes"]} for e in r["equipos"]}
    assert por_nombre["Delfines"] == {"Sofía", "Lucía"} and por_nombre["Águilas"] == {"Mateo"}
    assert {p["nombre_pila"] for p in r["sin_equipo"]} == {"Diego"}
    # Un alumno de OTRO grupo no puede entrar.
    g2 = await nuevo_grupo(cliente, ana, "4.º B")
    ajeno, _ = await alumno_en(cliente, ana, g2["id_grupo"], "Pedro")
    mal = await cliente.put(f"/equipos/{a['id_equipo']}/integrantes", json={"ids_alumnos": [ajeno["id_alumno"]]}, headers=auth(ana))
    assert mal.status_code == 422
    # Más de 6 integrantes: se rechaza.
    muchos = await cliente.put(f"/equipos/{a['id_equipo']}/integrantes", json={"ids_alumnos": [str(uuid.uuid4()) for _ in range(7)]}, headers=auth(ana))
    assert muchos.status_code == 422


async def test_borrar_un_equipo_deja_a_sus_integrantes_sin_equipo_pero_no_los_borra(cliente):
    ana, g, alumnos, _, a, _ = await escenario(cliente)
    await cliente.delete(f"/equipos/{a['id_equipo']}", headers=auth(ana))
    lista = (await cliente.get(f"/equipos/?id_grupo={g['id_grupo']}", headers=auth(ana))).json()
    assert {p["nombre_pila"] for p in lista["sin_equipo"]} == {"Sofía", "Mateo"}


async def test_formar_equipos_al_azar_reparte_parejo_y_reemplaza(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    for n in ("A1", "A2", "A3", "A4", "A5", "A6", "A7"):
        await alumno_en(cliente, ana, g["id_grupo"], n)
    r = await cliente.post("/equipos/al-azar", json={"id_grupo": g["id_grupo"], "tamano": 3}, headers=auth(ana))
    assert r.status_code == 200
    tamanos = sorted(len(e["integrantes"]) for e in r.json()["equipos"])
    assert tamanos == [3, 4] and r.json()["sin_equipo"] == []     # 7 alumnos en equipos de ~3: 2 equipos (3 y 4)
    nombres_antes = {e["id_equipo"] for e in r.json()["equipos"]}
    otra = await cliente.post("/equipos/al-azar", json={"id_grupo": g["id_grupo"], "tamano": 2}, headers=auth(ana))
    assert len(otra.json()["equipos"]) == 4 and not (nombres_antes & {e["id_equipo"] for e in otra.json()["equipos"]})
    assert max(len(e["integrantes"]) for e in otra.json()["equipos"]) - min(len(e["integrantes"]) for e in otra.json()["equipos"]) <= 1


async def test_al_azar_necesita_al_menos_dos_alumnos_y_valida_el_tamano(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    await alumno_en(cliente, ana, g["id_grupo"], "Solo")
    assert (await cliente.post("/equipos/al-azar", json={"id_grupo": g["id_grupo"]}, headers=auth(ana))).status_code == 409
    assert (await cliente.post("/equipos/al-azar", json={"id_grupo": g["id_grupo"], "tamano": 1}, headers=auth(ana))).status_code == 422


# ------------------------------------------------------------------ misiones


async def test_no_se_lanza_sin_equipos_ni_con_actividad_no_asignada_o_ajena(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    juego = await crear_juego(ana)
    sin_equipos = await lanzar(cliente, ana, g["id_grupo"], juego)
    assert sin_equipos.status_code == 409 and "equipo" in sin_equipos.json()["detail"].lower()
    alumno, _ = await alumno_en(cliente, ana, g["id_grupo"])
    e = await nuevo_equipo(cliente, ana, g["id_grupo"])
    await poner(cliente, ana, e["id_equipo"], [alumno["id_alumno"]])
    # Un borrador no se puede usar.
    async with session.get_db_pool().acquire() as conn:
        await conn.execute("UPDATE juegos_generados SET estado = 'borrador' WHERE id_juego = $1", uuid.UUID(juego))
    assert (await lanzar(cliente, ana, g["id_grupo"], juego)).status_code == 409
    # Una actividad de otro docente tampoco.
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    await nuevo_grupo(cliente, beto, "4.º A")
    ajeno = await crear_juego(beto)
    assert (await lanzar(cliente, ana, g["id_grupo"], ajeno)).status_code == 409
    # Ni un grupo ajeno.
    assert (await lanzar(cliente, beto, g["id_grupo"], ajeno)).status_code == 404


async def test_solo_una_mision_abierta_por_grupo_hasta_cerrarla(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    r = await lanzar(cliente, ana, g["id_grupo"], juego, meta=60)
    assert r.status_code == 201 and r.json()["meta"] == 60 and r.json()["titulo"] == "Los seres vivos"
    assert (await lanzar(cliente, ana, g["id_grupo"], juego)).status_code == 409
    cierre = await cliente.post(f"/equipos/misiones/{r.json()['id_reto']}/cerrar", headers=auth(ana))
    assert cierre.status_code == 200
    assert (await cliente.post(f"/equipos/misiones/{r.json()['id_reto']}/cerrar", headers=auth(ana))).status_code == 404
    assert (await lanzar(cliente, ana, g["id_grupo"], juego)).status_code == 201
    ver = (await cliente.get(f"/equipos/misiones?id_grupo={g['id_grupo']}", headers=auth(ana))).json()
    assert ver["mision"] is not None and len(ver["cerradas"]) == 1


@pytest.mark.parametrize("meta", [9, 101, 0])
async def test_la_meta_debe_estar_entre_10_y_100(cliente, meta):
    ana, g, _, juego, _, _ = await escenario(cliente)
    assert (await lanzar(cliente, ana, g["id_grupo"], juego, meta=meta)).status_code == 422


async def test_otro_docente_no_puede_cerrar_ni_ver_la_mision(cliente):
    ana, g, _, juego, _, _ = await escenario(cliente)
    r = await lanzar(cliente, ana, g["id_grupo"], juego)
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    assert (await cliente.post(f"/equipos/misiones/{r.json()['id_reto']}/cerrar", headers=auth(beto))).status_code == 404
    assert (await cliente.get(f"/equipos/misiones?id_grupo={g['id_grupo']}", headers=auth(beto))).status_code == 404


async def test_la_barra_es_el_promedio_de_los_mejores_resultados_del_equipo(cliente):
    ana, g, alumnos, juego, a, b = await escenario(cliente)
    (sofia, tok_s), (mateo, tok_m) = alumnos[0], alumnos[1]
    await jugar(cliente, tok_s, juego, 100)  # ANTES de la misión: no cuenta
    r = await lanzar(cliente, ana, g["id_grupo"], juego, meta=70)
    assert r.status_code == 201
    def equipo(mision, nombre):
        return next(e for e in mision["equipos"] if e["nombre"] == nombre)
    ver = lambda: cliente.get(f"/equipos/misiones?id_grupo={g['id_grupo']}", headers=auth(ana))
    m = (await ver()).json()["mision"]
    assert equipo(m, "Águilas")["progreso"] == 0 and equipo(m, "Águilas")["ya_jugaron"] == 0

    await jugar(cliente, tok_s, juego, 80)
    m = (await ver()).json()["mision"]
    assert equipo(m, "Águilas")["progreso"] == 40 and equipo(m, "Águilas")["ya_jugaron"] == 1   # (80 + 0) / 2
    assert not equipo(m, "Águilas")["meta_lograda"]

    await jugar(cliente, tok_s, juego, 50)   # repetir con menos NO baja la barra: cuenta el mejor intento
    m = (await ver()).json()["mision"]
    assert equipo(m, "Águilas")["progreso"] == 40

    await jugar(cliente, tok_m, juego, 60)   # (80 + 60) / 2 = 70 = la meta
    m = (await ver()).json()["mision"]
    assert equipo(m, "Águilas")["progreso"] == 70 and equipo(m, "Águilas")["meta_lograda"]
    assert equipo(m, "Delfines")["progreso"] == 0 and not m["clase_completa"]


async def test_toda_la_clase_lo_logra_cuando_cada_equipo_llega_a_la_meta(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    await lanzar(cliente, ana, g["id_grupo"], juego, meta=60)
    for _, tok in alumnos[:3]:
        await jugar(cliente, tok, juego, 100)
    ver = (await cliente.get(f"/equipos/misiones?id_grupo={g['id_grupo']}", headers=auth(ana))).json()["mision"]
    assert not ver["clase_completa"]                 # Águilas llegó (100), pero Delfines va en (100 + 0) / 2 = 50 < 60
    await jugar(cliente, alumnos[3][1], juego, 100)
    ver = (await cliente.get(f"/equipos/misiones?id_grupo={g['id_grupo']}", headers=auth(ana))).json()["mision"]
    assert ver["clase_completa"] and all(e["meta_lograda"] for e in ver["equipos"])


# ------------------------------------------------------------------ lo que ve el alumno


async def test_alumno_sin_equipo_o_sin_mision_no_ve_nada(cliente):
    ana = await crear_docente(cliente)
    g = await nuevo_grupo(cliente, ana)
    alumno, tok = await alumno_en(cliente, ana, g["id_grupo"])
    assert (await cliente.get("/equipos/mi-mision", headers=auth(tok))).json() == {"equipo": None, "mision": None}
    e = await nuevo_equipo(cliente, ana, g["id_grupo"])
    await poner(cliente, ana, e["id_equipo"], [alumno["id_alumno"]])
    r = (await cliente.get("/equipos/mi-mision", headers=auth(tok))).json()
    assert r["equipo"]["nombre"] == "Águilas" and r["mision"] is None


async def test_el_alumno_ve_su_equipo_y_las_barras_pero_nunca_datos_de_otros_alumnos(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    await lanzar(cliente, ana, g["id_grupo"], juego, meta=70)
    (_, tok_s), (_, tok_m), (_, tok_l) = alumnos[0], alumnos[1], alumnos[2]
    await jugar(cliente, tok_l, juego, 90)
    r = await cliente.get("/equipos/mi-mision", headers=auth(tok_s))
    texto = r.text
    for nombre in ("Mateo", "Lucía", "Diego"):                  # ni compañeros ni rivales aparecen por nombre
        assert nombre not in texto
    m = r.json()["mision"]
    assert m["titulo"] == "Los seres vivos" and m["meta"] == 70 and m["yo_ya_jugue"] is False
    assert m["mi_equipo"]["integrantes"] == 2 and m["mi_equipo"]["ya_jugaron"] == 0
    assert [o["nombre"] for o in m["otros_equipos"]] == ["Delfines"] and m["otros_equipos"][0]["progreso"] == 45
    assert "ya_jugaron" not in m["otros_equipos"][0]
    await jugar(cliente, tok_s, juego, 70)
    m = (await cliente.get("/equipos/mi-mision", headers=auth(tok_s))).json()["mision"]
    assert m["yo_ya_jugue"] is True and m["mi_equipo"]["progreso"] == 35


async def test_la_mision_de_un_grupo_no_aparece_en_otro_grupo(cliente):
    ana, g, alumnos, juego, _, _ = await escenario(cliente)
    await lanzar(cliente, ana, g["id_grupo"], juego)
    g2 = await nuevo_grupo(cliente, ana, "4.º B")
    otro, tok_otro = await alumno_en(cliente, ana, g2["id_grupo"], "Pedro")
    e2 = await nuevo_equipo(cliente, ana, g2["id_grupo"], "Zorros", "zorro")
    await poner(cliente, ana, e2["id_equipo"], [otro["id_alumno"]])
    assert (await cliente.get("/equipos/mi-mision", headers=auth(tok_otro))).json()["mision"] is None


async def test_un_docente_no_puede_usar_mi_mision(cliente):
    ana = await crear_docente(cliente)
    assert (await cliente.get("/equipos/mi-mision", headers=auth(ana))).status_code == 403
    assert (await cliente.get("/equipos/mi-mision")).status_code == 401
