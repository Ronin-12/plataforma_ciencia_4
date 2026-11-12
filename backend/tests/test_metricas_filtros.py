"""Filtros de las métricas del docente (fecha y tipo), 'quién falta' y alumnos desactivados."""

import json
import uuid
from datetime import datetime

import pytest

from app.db import session
from tests.conftest import auth, crear_docente
from tests.test_resultados import _id, crear_alumno_con_sesion, cuerpo


async def juego_de_tipo(token_docente: str, titulo: str, tipo: str = "quiz", estado: str = "aprobado") -> str:
    contenido = {"titulo": titulo, "instrucciones": "x", "tipo_actividad": tipo}
    async with session.get_db_pool().acquire() as conn:
        return str(
            await conn.fetchval(
                "INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego, estado) "
                "VALUES ($1, 'p', $2::jsonb, $3) RETURNING id_juego",
                uuid.UUID(_id(token_docente)),
                json.dumps(contenido),
                estado,
            )
        )


async def intento_en(id_alumno: str, id_juego: str, instante: str, pct: int = 80):
    """Guarda un intento en un instante exacto, p. ej. '2026-11-11 23:30-06' (con huso horario)."""
    async with session.get_db_pool().acquire() as conn:
        await conn.execute(
            """
            INSERT INTO registro_avances (id_alumno, id_juego, puntuacion_final, tiempo_resolucion, numero_intento, fecha_ejecucion)
            VALUES ($1, $2, $3, 30,
                    (SELECT COALESCE(MAX(numero_intento), 0) + 1 FROM registro_avances WHERE id_alumno = $1 AND id_juego = $2),
                    ($4::timestamptz)::timestamp)
            """,
            uuid.UUID(id_alumno),
            uuid.UUID(id_juego),
            pct,
            datetime.fromisoformat(instante),
        )


async def metricas(cliente, token, **filtros):
    r = await cliente.get("/metricas/grupo", params=filtros, headers=auth(token))
    assert r.status_code == 200, r.text
    return r.json()


# --------------------------------------------------------------------- tipo


async def test_filtrar_por_tipo_separa_clases_de_juegos(cliente):
    ana = await crear_docente(cliente)
    quiz = await juego_de_tipo(ana, "Quiz del agua", "quiz")
    clase = await juego_de_tipo(ana, "Clase de plantas", "clase")
    sofia, tok = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await cliente.post("/resultados/", json=cuerpo(quiz, 100), headers=auth(tok))
    await cliente.post("/resultados/", json=cuerpo(clase, 40), headers=auth(tok))

    todo = await metricas(cliente, ana)
    assert todo["resumen"]["intentos"] == 2 and len(todo["por_juego"]) == 2 and todo["actividades_total"] == 2

    solo_clases = await metricas(cliente, ana, tipo="clase")
    assert solo_clases["filtros"]["tipo"] == "clase"
    assert [j["titulo"] for j in solo_clases["por_juego"]] == ["Clase de plantas"]
    assert solo_clases["resumen"]["intentos"] == 1 and solo_clases["resumen"]["promedio_puntuacion"] == 40
    assert solo_clases["actividades_total"] == 1
    # El promedio del alumno también se calcula solo con las clases (no mezcla el 100 del quiz).
    assert solo_clases["por_alumno"][0]["promedio_puntuacion"] == 40
    assert solo_clases["por_alumno"][0]["necesita_apoyo"] is True

    solo_quiz = await metricas(cliente, ana, tipo="quiz")
    assert [j["titulo"] for j in solo_quiz["por_juego"]] == ["Quiz del agua"]
    assert solo_quiz["por_alumno"][0]["promedio_puntuacion"] == 100


async def test_un_tipo_sin_actividades_devuelve_todo_en_cero_sin_fallar(cliente):
    ana = await crear_docente(cliente)
    await juego_de_tipo(ana, "Solo quiz", "quiz")
    await crear_alumno_con_sesion(cliente, ana, "Sofía")
    m = await metricas(cliente, ana, tipo="memoria")
    assert m["por_juego"] == [] and m["resumen"]["intentos"] == 0 and m["actividades_total"] == 0
    assert [a["nombre_pila"] for a in m["por_alumno"]] == ["Sofía"]  # el alumno sigue en la lista


# -------------------------------------------------------------------- fecha


async def test_filtrar_por_fecha_incluye_ambos_extremos(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz")
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    for dia in ("2026-11-09", "2026-11-10", "2026-11-11"):
        await intento_en(sofia["id_alumno"], juego, f"{dia} 12:00-06")

    assert (await metricas(cliente, ana))["resumen"]["intentos"] == 3
    assert (await metricas(cliente, ana, desde="2026-11-10"))["resumen"]["intentos"] == 2
    assert (await metricas(cliente, ana, hasta="2026-11-10"))["resumen"]["intentos"] == 2
    assert (await metricas(cliente, ana, desde="2026-11-10", hasta="2026-11-10"))["resumen"]["intentos"] == 1
    assert (await metricas(cliente, ana, desde="2026-12-01"))["resumen"]["intentos"] == 0


async def test_el_dia_se_cuenta_con_la_hora_de_la_escuela_no_la_del_servidor(cliente):
    """23:30 en México del día 11 son las 05:30 UTC del día 12: debe contar como día 11."""
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz")
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await intento_en(sofia["id_alumno"], juego, "2026-11-11 23:30-06")

    assert (await metricas(cliente, ana, desde="2026-11-11", hasta="2026-11-11"))["resumen"]["intentos"] == 1
    assert (await metricas(cliente, ana, desde="2026-11-12"))["resumen"]["intentos"] == 0
    assert (await metricas(cliente, ana, hasta="2026-11-10"))["resumen"]["intentos"] == 0


async def test_con_filtro_las_actividades_y_alumnos_siguen_en_la_lista_con_cero(cliente):
    """El filtro acota los intentos, no desaparece al alumno ni a la actividad (si no, no se vería quién falta)."""
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz")
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await intento_en(sofia["id_alumno"], juego, "2026-11-01 12:00-06")

    m = await metricas(cliente, ana, desde="2026-11-10")
    assert m["resumen"]["intentos"] == 0
    assert m["por_juego"][0]["titulo"] == "Quiz" and m["por_juego"][0]["intentos"] == 0
    assert m["por_alumno"][0]["nombre_pila"] == "Sofía" and m["por_alumno"][0]["intentos"] == 0
    assert m["por_alumno"][0]["necesita_apoyo"] is False  # sin intentos en el periodo no es "falta de apoyo"


# --------------------------------------------------------------- validación


@pytest.mark.parametrize(
    "params",
    [
        {"desde": "2026-11-12", "hasta": "2026-11-01"},
        {"tipo": "inventado"},
        {"desde": "ayer"},
        {"hasta": "2026-13-45"},
    ],
)
async def test_filtros_invalidos_dan_422(cliente, params):
    ana = await crear_docente(cliente)
    r = await cliente.get("/metricas/grupo", params=params, headers=auth(ana))
    assert r.status_code == 422


async def test_el_tipo_no_permite_inyectar_sql(cliente):
    ana = await crear_docente(cliente)
    r = await cliente.get("/metricas/grupo", params={"tipo": "quiz' OR '1'='1"}, headers=auth(ana))
    assert r.status_code == 422


# ------------------------------------------------------------- quién falta


async def test_cada_actividad_dice_quien_falta_por_hacerla(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz del agua")
    await juego_de_tipo(ana, "Borrador sin aprobar", estado="borrador")
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await crear_alumno_con_sesion(cliente, ana, "Luis")
    await crear_alumno_con_sesion(cliente, ana, "Mara")
    await cliente.post("/resultados/", json=cuerpo(juego, 90), headers=auth(tok_sofia))

    m = await metricas(cliente, ana)
    # El borrador no aparece: el alumno no lo ve, así que a nadie "le falta".
    assert [j["titulo"] for j in m["por_juego"]] == ["Quiz del agua"]
    actividad = m["por_juego"][0]
    assert actividad["faltan"] == ["Luis", "Mara"] and actividad["pendientes"] == 2
    assert next(a for a in m["por_alumno"] if a["nombre_pila"] == "Sofía")["juegos_jugados"] == 1
    assert m["actividades_total"] == 1


async def test_quien_falta_respeta_el_periodo(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz")
    sofia, _ = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await intento_en(sofia["id_alumno"], juego, "2026-11-01 12:00-06")

    assert (await metricas(cliente, ana))["por_juego"][0]["faltan"] == []
    # En la semana del 10 al 16 Sofía todavía no ha hecho nada: falta.
    assert (await metricas(cliente, ana, desde="2026-11-10", hasta="2026-11-16"))["por_juego"][0]["faltan"] == ["Sofía"]


# ----------------------------------------------------- alumnos desactivados


async def test_un_alumno_desactivado_sale_de_todas_las_cifras(cliente):
    ana = await crear_docente(cliente)
    juego = await juego_de_tipo(ana, "Quiz")
    sofia, tok_sofia = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    luis, tok_luis = await crear_alumno_con_sesion(cliente, ana, "Luis")
    await cliente.post("/resultados/", json=cuerpo(juego, 100), headers=auth(tok_sofia))
    await cliente.post("/resultados/", json=cuerpo(juego, 20), headers=auth(tok_luis))
    assert (await metricas(cliente, ana))["resumen"]["intentos"] == 2

    r = await cliente.patch(f"/alumnos/{luis['id_alumno']}", json={"activo": False}, headers=auth(ana))
    assert r.status_code == 200, r.text

    m = await metricas(cliente, ana)
    assert m["resumen"]["intentos"] == 1 and m["resumen"]["promedio_puntuacion"] == 100
    assert m["resumen"]["alumnos_que_jugaron"] == 1 and m["resumen"]["alumnos_total"] == 1
    assert m["por_juego"][0]["intentos"] == 1 and m["por_juego"][0]["alumnos"] == 1
    assert [a["nombre_pila"] for a in m["por_alumno"]] == ["Sofía"]
    assert m["por_juego"][0]["faltan"] == []  # un alumno inactivo tampoco "falta"

    # Al reactivarlo, sus resultados vuelven (la desactivación no borra datos).
    await cliente.patch(f"/alumnos/{luis['id_alumno']}", json={"activo": True}, headers=auth(ana))
    assert (await metricas(cliente, ana))["resumen"]["intentos"] == 2


# ----------------------------------------------------------------- aislamiento


async def test_los_filtros_no_mezclan_docentes(cliente):
    ana = await crear_docente(cliente, "ana@escuela.mx")
    beto = await crear_docente(cliente, "beto@escuela.mx", nombre="Beto Ruiz")
    juego = await juego_de_tipo(ana, "Quiz de Ana", "clase")
    sofia, tok = await crear_alumno_con_sesion(cliente, ana, "Sofía")
    await cliente.post("/resultados/", json=cuerpo(juego, 90), headers=auth(tok))

    m = await metricas(cliente, beto, tipo="clase", desde="2020-01-01")
    assert m["resumen"]["intentos"] == 0 and m["por_juego"] == [] and m["por_alumno"] == []
    assert m["actividades_total"] == 0
