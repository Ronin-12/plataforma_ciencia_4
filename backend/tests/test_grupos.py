"""Varios grupos por docente (4.º A, 4.º B...) y actividades asignadas por grupo."""

import json
import uuid

from app.ia import gemini
from tests.conftest import auth, crear_docente
from tests.test_ia import _cliente_falso, _quiz
from tests.test_metricas_filtros import juego_de_tipo
from app.db import session
from tests.test_resultados import _id, cuerpo


async def nuevo_grupo(cliente, token, nombre="4.º A", grado=4):
    r = await cliente.post("/grupos/", json={"nombre": nombre, "grado": grado}, headers=auth(token))
    assert r.status_code == 201, r.text
    return r.json()


async def alumno_en(cliente, token, id_grupo, nombre="Sofía"):
    """Da de alta a un alumno en ese grupo y entra con su PIN. Devuelve (alumno, token_del_alumno)."""
    r = await cliente.post("/alumnos/", json={"nombre_pila": nombre, "id_grupo": id_grupo}, headers=auth(token))
    assert r.status_code == 201, r.text
    a = r.json()
    r = await cliente.post(
        "/alumnos/login", json={"codigo_acceso": a["codigo_acceso"], "id_alumno": a["id_alumno"], "pin": a["pin"]}
    )
    assert r.status_code == 200, r.text
    return a, r.json()["access_token"]


async def juego_valido(token, titulo, estado="borrador"):
    """Un juego con contenido completo (el que sí se puede aprobar), sin grupos asignados."""
    contenido = {**_quiz(), "titulo": titulo}
    async with session.get_db_pool().acquire() as conn:
        return str(
            await conn.fetchval(
                "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego, estado) "
                "VALUES ($1, 'p', $2::jsonb, $3) RETURNING id_juego",
                uuid.UUID(_id(token)), json.dumps(contenido), estado,
            )
        )


async def asignar(cliente, token, id_juego, ids_grupos):
    r = await cliente.put(f"/ia/juegos/{id_juego}/grupos", json={"ids_grupos": ids_grupos}, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


async def titulos_del_alumno(cliente, tok):
    r = await cliente.get("/ia/juegos", headers=auth(tok))
    assert r.status_code == 200, r.text
    return {j["contenido_juego"]["titulo"] if isinstance(j["contenido_juego"], dict) else json.loads(j["contenido_juego"])["titulo"] for j in r.json()["juegos"]}


# ------------------------------------------------------------------ grupos


async def test_el_docente_abre_varios_grupos_cada_uno_con_su_codigo(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    assert a["codigo_acceso"] != b["codigo_acceso"] and len(a["codigo_acceso"]) == 6
    lista = (await cliente.get("/grupos/", headers=auth(ana))).json()["grupos"]
    assert [g["nombre"] for g in lista] == ["4.º A", "4.º B"]
    assert all(g["alumnos_activos"] == 0 and g["actividades"] == 0 for g in lista[1:])


async def test_el_nombre_no_se_repite_aunque_cambien_mayusculas(cliente):
    ana = await crear_docente(cliente)
    await nuevo_grupo(cliente, ana, "4.º A")
    r = await cliente.post("/grupos/", json={"nombre": "  4.º a ", "grado": 4}, headers=auth(ana))
    assert r.status_code == 409
    # Otro docente sí puede usar el mismo nombre.
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    await nuevo_grupo(cliente, beto, "4.º A")


async def test_datos_invalidos_del_grupo(cliente):
    ana = await crear_docente(cliente)
    for cuerpo_malo in ({"nombre": "", "grado": 4}, {"nombre": "   ", "grado": 4}, {"nombre": "5.º", "grado": 7}, {"nombre": "5.º", "grado": 0}):
        r = await cliente.post("/grupos/", json=cuerpo_malo, headers=auth(ana))
        assert r.status_code == 422, cuerpo_malo


async def test_solo_el_docente_dueno_ve_y_cambia_su_grupo(cliente):
    ana = await crear_docente(cliente)
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    g = await nuevo_grupo(cliente, ana)
    assert (await cliente.get("/grupos/", headers=auth(beto))).json()["grupos"] == []
    assert (await cliente.patch(f"/grupos/{g['id_grupo']}", json={"nombre": "X"}, headers=auth(beto))).status_code == 404
    assert (await cliente.delete(f"/grupos/{g['id_grupo']}", headers=auth(beto))).status_code == 404
    assert (await cliente.get("/grupos/")).status_code == 401
    r = await cliente.patch(f"/grupos/{g['id_grupo']}", json={"nombre": "4.º Azul", "grado": 5}, headers=auth(ana))
    assert r.status_code == 200 and (r.json()["nombre"], r.json()["grado"]) == ("4.º Azul", 5)


async def test_un_grupo_con_alumnos_no_se_borra_pero_uno_vacio_si(cliente):
    ana = await crear_docente(cliente)
    con, vacio = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    await alumno_en(cliente, ana, con["id_grupo"])
    assert (await cliente.delete(f"/grupos/{con['id_grupo']}", headers=auth(ana))).status_code == 409
    assert (await cliente.delete(f"/grupos/{vacio['id_grupo']}", headers=auth(ana))).status_code == 200
    assert [g["nombre"] for g in (await cliente.get("/grupos/", headers=auth(ana))).json()["grupos"]] == ["4.º A"]


async def test_cada_alumno_queda_en_el_grupo_que_se_eligio_y_no_en_el_de_otro_docente(cliente):
    ana = await crear_docente(cliente)
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    await alumno_en(cliente, ana, a["id_grupo"], "Sofía")
    await alumno_en(cliente, ana, b["id_grupo"], "Mateo")
    lista = (await cliente.get("/alumnos/", headers=auth(ana))).json()["alumnos"]
    assert {x["nombre_pila"]: x["grupo"] for x in lista} == {"Sofía": "4.º A", "Mateo": "4.º B"}
    r = await cliente.post("/alumnos/", json={"nombre_pila": "Intruso", "id_grupo": a["id_grupo"]}, headers=auth(beto))
    assert r.status_code == 404
    grupos = {g["nombre"]: g for g in (await cliente.get("/grupos/", headers=auth(ana))).json()["grupos"]}
    assert grupos["4.º A"]["alumnos_activos"] == 1 and grupos["4.º B"]["alumnos_activos"] == 1


# ------------------------------------------------------- actividades por grupo


async def test_cada_grupo_ve_solo_las_actividades_que_se_le_asignaron(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    _, tok_a = await alumno_en(cliente, ana, a["id_grupo"], "Sofía")
    _, tok_b = await alumno_en(cliente, ana, b["id_grupo"], "Mateo")
    solo_a = await juego_de_tipo(ana, "Solo A")
    solo_b = await juego_de_tipo(ana, "Solo B")
    ambos = await juego_de_tipo(ana, "Para ambos")
    await asignar(cliente, ana, solo_a, [a["id_grupo"]])
    await asignar(cliente, ana, solo_b, [b["id_grupo"]])
    await asignar(cliente, ana, ambos, [a["id_grupo"], b["id_grupo"]])
    assert await titulos_del_alumno(cliente, tok_a) == {"Solo A", "Para ambos"}
    assert await titulos_del_alumno(cliente, tok_b) == {"Solo B", "Para ambos"}


async def test_un_alumno_no_puede_guardar_resultados_de_una_actividad_de_otro_grupo(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    _, tok_b = await alumno_en(cliente, ana, b["id_grupo"], "Mateo")
    juego = await juego_de_tipo(ana, "Solo A")
    await asignar(cliente, ana, juego, [a["id_grupo"]])
    r = await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok_b))
    assert r.status_code == 404
    await asignar(cliente, ana, juego, [a["id_grupo"], b["id_grupo"]])  # al asignarla, ya puede
    assert (await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok_b))).status_code == 201


async def test_el_progreso_y_las_insignias_solo_cuentan_lo_del_propio_grupo(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    alumno_a, tok_a = await alumno_en(cliente, ana, a["id_grupo"], "Sofía")
    for t in ("Uno", "Dos", "Tres"):
        await asignar(cliente, ana, await juego_de_tipo(ana, t), [a["id_grupo"]])
    ajena = await juego_de_tipo(ana, "Del otro grupo")
    await asignar(cliente, ana, ajena, [b["id_grupo"]])
    rep = (await cliente.get(f"/alumnos/{alumno_a['id_alumno']}/reporte", headers=auth(ana))).json()
    assert rep["resumen"]["disponibles"] == 3 and rep["alumno"]["grupo"] == "4.º A"
    assert "Del otro grupo" not in {x["titulo"] for x in rep["actividades"]}
    assert (await cliente.get("/resultados/mios", headers=auth(tok_a))).json()["logros"]["total"] == 8


async def test_se_puede_quitar_una_actividad_a_todos_los_grupos(cliente):
    ana = await crear_docente(cliente)
    a = await nuevo_grupo(cliente, ana)
    _, tok = await alumno_en(cliente, ana, a["id_grupo"])
    juego = await juego_de_tipo(ana, "Retirable")
    await asignar(cliente, ana, juego, [a["id_grupo"]])
    assert await titulos_del_alumno(cliente, tok) == {"Retirable"}
    await asignar(cliente, ana, juego, [])
    assert await titulos_del_alumno(cliente, tok) == set()


async def test_no_se_pueden_asignar_grupos_ni_juegos_de_otro_docente(cliente):
    ana = await crear_docente(cliente)
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    g_beto = await nuevo_grupo(cliente, beto)
    juego_ana = await juego_de_tipo(ana, "De Ana")
    # Un grupo ajeno: se rechaza y no cambia nada.
    r = await cliente.put(f"/ia/juegos/{juego_ana}/grupos", json={"ids_grupos": [g_beto["id_grupo"]]}, headers=auth(ana))
    assert r.status_code == 404
    # Un juego ajeno.
    r = await cliente.put(f"/ia/juegos/{juego_ana}/grupos", json={"ids_grupos": []}, headers=auth(beto))
    assert r.status_code == 404


async def test_aprobar_sin_elegir_grupos_lo_asigna_a_todos_y_eligiendo_solo_a_esos(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    borrador1 = await juego_valido(ana, "Para todos")
    borrador2 = await juego_valido(ana, "Solo B")
    r = await cliente.post(f"/ia/juegos/{borrador1}/estado", json={"estado": "aprobado"}, headers=auth(ana))
    assert r.status_code == 200 and set(r.json()["grupos"]) == {a["id_grupo"], b["id_grupo"]}
    r = await cliente.post(
        f"/ia/juegos/{borrador2}/estado", json={"estado": "aprobado", "ids_grupos": [b["id_grupo"]]}, headers=auth(ana)
    )
    assert r.status_code == 200 and r.json()["grupos"] == [b["id_grupo"]]
    # Volver a aprobar sin indicar grupos conserva la selección que ya tenía.
    await cliente.post(f"/ia/juegos/{borrador2}/estado", json={"estado": "borrador"}, headers=auth(ana))
    r = await cliente.post(f"/ia/juegos/{borrador2}/estado", json={"estado": "aprobado"}, headers=auth(ana))
    assert r.json()["grupos"] == [b["id_grupo"]]


async def test_el_docente_ve_a_que_grupos_asigno_cada_juego_y_el_alumno_no(cliente):
    ana = await crear_docente(cliente)
    a = await nuevo_grupo(cliente, ana)
    _, tok = await alumno_en(cliente, ana, a["id_grupo"])
    juego = await juego_de_tipo(ana, "Uno")
    await asignar(cliente, ana, juego, [a["id_grupo"]])
    docente_ve = (await cliente.get("/ia/juegos", headers=auth(ana))).json()["juegos"][0]
    assert docente_ve["grupos"] == [a["id_grupo"]]
    alumno_ve = (await cliente.get("/ia/juegos", headers=auth(tok))).json()["juegos"][0]
    assert "grupos" not in alumno_ve and "prompt_original" not in alumno_ve


async def test_el_primer_grupo_hereda_lo_ya_aprobado_y_los_siguientes_empiezan_vacios(cliente):
    ana = await crear_docente(cliente)
    await juego_de_tipo(ana, "Previo")  # aprobado antes de abrir ningún grupo
    primero = await nuevo_grupo(cliente, ana, "4.º A")
    segundo = await nuevo_grupo(cliente, ana, "4.º B")
    grupos = {g["nombre"]: g for g in (await cliente.get("/grupos/", headers=auth(ana))).json()["grupos"]}
    assert grupos["4.º A"]["actividades"] == 1 and grupos["4.º B"]["actividades"] == 0
    _, tok_b = await alumno_en(cliente, ana, segundo["id_grupo"])
    assert await titulos_del_alumno(cliente, tok_b) == set()
    _, tok_a = await alumno_en(cliente, ana, primero["id_grupo"], "Luz")
    assert await titulos_del_alumno(cliente, tok_a) == {"Previo"}


# ------------------------------------------------------------------ métricas


async def test_las_metricas_se_pueden_ver_por_grupo(cliente):
    ana = await crear_docente(cliente)
    a, b = await nuevo_grupo(cliente, ana, "4.º A"), await nuevo_grupo(cliente, ana, "4.º B")
    _, tok_a = await alumno_en(cliente, ana, a["id_grupo"], "Sofía")
    await alumno_en(cliente, ana, b["id_grupo"], "Mateo")
    solo_a, ambos = await juego_de_tipo(ana, "Solo A"), await juego_de_tipo(ana, "Ambos")
    await asignar(cliente, ana, solo_a, [a["id_grupo"]])
    await asignar(cliente, ana, ambos, [a["id_grupo"], b["id_grupo"]])
    await cliente.post("/resultados/", json=cuerpo(solo_a, 90), headers=auth(tok_a))

    de_a = (await cliente.get(f"/metricas/grupo?id_grupo={a['id_grupo']}", headers=auth(ana))).json()
    assert de_a["grupo"]["nombre"] == "4.º A"
    assert de_a["resumen"]["alumnos_total"] == 1 and de_a["actividades_total"] == 2
    assert [x["nombre_pila"] for x in de_a["por_alumno"]] == ["Sofía"] and de_a["por_alumno"][0]["disponibles"] == 2

    de_b = (await cliente.get(f"/metricas/grupo?id_grupo={b['id_grupo']}", headers=auth(ana))).json()
    assert de_b["resumen"]["alumnos_total"] == 1 and de_b["actividades_total"] == 1
    assert [j["titulo"] for j in de_b["por_juego"]] == ["Ambos"]
    assert de_b["por_juego"][0]["faltan"] == ["Mateo"]  # a Sofía (de A) no se le pide la de B
    assert de_b["resumen"]["intentos"] == 0

    todos = (await cliente.get("/metricas/grupo", headers=auth(ana))).json()
    assert todos["grupo"] is None and todos["resumen"]["alumnos_total"] == 2
    por_nombre = {x["nombre_pila"]: x["disponibles"] for x in todos["por_alumno"]}
    assert por_nombre == {"Sofía": 2, "Mateo": 1}
    solo_a_fila = next(j for j in todos["por_juego"] if j["titulo"] == "Solo A")
    assert solo_a_fila["faltan"] == []  # Mateo no tiene esa actividad: no le falta


async def test_no_se_pueden_ver_las_metricas_de_un_grupo_ajeno(cliente):
    ana = await crear_docente(cliente)
    beto = await crear_docente(cliente, "beto@escuela.mx", "Beto")
    g = await nuevo_grupo(cliente, ana)
    assert (await cliente.get(f"/metricas/grupo?id_grupo={g['id_grupo']}", headers=auth(beto))).status_code == 404


# ----------------------------------------------------------- materia y grado


async def generar(cliente, monkeypatch, token=None, **extra):
    llamadas = []
    monkeypatch.setattr(gemini.genai, "Client", _cliente_falso([_quiz()], llamadas))
    token = token or await crear_docente(cliente)
    r = await cliente.post(
        "/ia/generar-juego", json={"texto_prompt": "las fracciones", "tipo_actividad": "quiz", **extra}, headers=auth(token)
    )
    return r, llamadas, token


async def test_la_materia_y_el_grado_se_guardan_y_cambian_lo_que_se_le_pide_a_la_ia(cliente, monkeypatch):
    r, llamadas, token = await generar(cliente, monkeypatch, materia="matematicas", grado=2)
    assert r.status_code == 200, r.text
    assert (r.json()["materia"], r.json()["grado"]) == ("matematicas", 2)
    pedido = json.dumps(llamadas[0], ensure_ascii=False, default=str)
    assert "7 años (2.º de primaria), materia Matemáticas" in pedido  # 2.º grado ≈ 7 años
    assert "9 años" not in pedido
    guardado = (await cliente.get("/ia/juegos", headers=auth(token))).json()["juegos"][0]
    assert (guardado["materia"], guardado["grado"]) == ("matematicas", 2)


async def test_sin_materia_ni_grado_se_asume_ciencias_de_4o(cliente, monkeypatch):
    r, llamadas, _ = await generar(cliente, monkeypatch)
    assert (r.json()["materia"], r.json()["grado"]) == ("ciencias", 4)
    assert "9 años (4.º de primaria), materia Ciencias Naturales" in json.dumps(llamadas[0], ensure_ascii=False, default=str)


async def test_materia_o_grado_invalidos_se_rechazan(cliente, monkeypatch):
    token = await crear_docente(cliente)
    for malo in ({"materia": "astrologia"}, {"grado": 7}, {"grado": 0}):
        r, llamadas, _ = await generar(cliente, monkeypatch, token=token, **malo)
        assert r.status_code == 422 and not llamadas, malo


async def test_el_alumno_recibe_la_materia_de_cada_actividad(cliente, monkeypatch):
    r, _, token = await generar(cliente, monkeypatch, materia="historia", grado=5)
    g = await nuevo_grupo(cliente, token, "5.º A", 5)
    await cliente.post(f"/ia/juegos/{r.json()['id_juego']}/estado", json={"estado": "aprobado"}, headers=auth(token))
    _, tok = await alumno_en(cliente, token, g["id_grupo"])
    juego = (await cliente.get("/ia/juegos", headers=auth(tok))).json()["juegos"][0]
    assert (juego["materia"], juego["grado"]) == ("historia", 5)
