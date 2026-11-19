"""Reglas de las insignias del murciélago. Son puras: no necesitan base de datos."""

from datetime import date

import pytest

from app.core.logros import CATALOGO, Actividad, Progreso, calcular_logros, insignias_nuevas
from app.routers.reportes import armar_reporte

pytestmark = pytest.mark.sin_bd


def act(n, intentos=0, mejor=None, primero=None, tipo="quiz"):
    return Actividad(id_juego=f"j{n}", titulo=f"Actividad {n}", tipo=tipo, intentos=intentos, mejor=mejor,
                     primero=primero if primero is not None else mejor, ultimo=date(2026, 11, 12) if intentos else None)


def estado(progreso):
    """{id: (obtenida, actual, meta)} para comparar sin ruido."""
    return {i["id"]: (i["obtenida"], i["actual"], i["meta"]) for i in calcular_logros(progreso)["insignias"]}


def test_sin_actividad_no_hay_ninguna_insignia_y_el_nivel_es_el_primero():
    r = calcular_logros(Progreso(actividades=(act(1), act(2))))
    assert r["obtenidas"] == 0 and r["total"] == len(CATALOGO) == 8
    assert r["nivel"]["nombre"] == "Cría de murciélago" and r["nivel"]["faltan_para_subir"] == 1


def test_primer_vuelo_con_la_primera_actividad_terminada():
    assert estado(Progreso(actividades=(act(1, 1, 30),)))["primer_vuelo"][0] is True
    assert estado(Progreso(actividades=(act(1),)))["primer_vuelo"][0] is False


def test_eco_perfecto_solo_con_cien_por_ciento():
    assert estado(Progreso(actividades=(act(1, 1, 99),)))["eco_perfecto"][0] is False
    assert estado(Progreso(actividades=(act(1, 1, 100),)))["eco_perfecto"][0] is True


def test_radar_afinado_pide_tres_actividades_distintas_con_80_o_mas():
    dos = Progreso(actividades=(act(1, 1, 90), act(2, 1, 80), act(3, 1, 79)))
    assert estado(dos)["radar_afinado"] == (False, 2, 3)
    tres = Progreso(actividades=(act(1, 1, 90), act(2, 1, 80), act(3, 1, 100)))
    assert estado(tres)["radar_afinado"][0] is True
    # Tres intentos de la MISMA actividad no cuentan como tres actividades.
    una = Progreso(actividades=(act(1, 3, 100),))
    assert estado(una)["radar_afinado"] == (False, 1, 3)


def test_vuelo_constante_cuenta_dias_distintos():
    assert estado(Progreso(dias_activos=2))["vuelo_constante"] == (False, 2, 3)
    assert estado(Progreso(dias_activos=3))["vuelo_constante"][0] is True


def test_cada_vez_mejor_exige_repetir_y_superar_el_primer_intento():
    assert estado(Progreso(actividades=(act(1, 2, 80, primero=50),)))["cada_vez_mejor"][0] is True
    assert estado(Progreso(actividades=(act(1, 2, 50, primero=50),)))["cada_vez_mejor"][0] is False  # igual
    assert estado(Progreso(actividades=(act(1, 1, 90, primero=90),)))["cada_vez_mejor"][0] is False  # sin repetir
    # Empeorar al repetir no cuenta: el mejor sigue siendo el primero.
    assert estado(Progreso(actividades=(act(1, 2, 90, primero=90),)))["cada_vez_mejor"][0] is False


def test_alas_persistentes_son_tres_intentos_de_una_misma_actividad():
    assert estado(Progreso(actividades=(act(1, 2, 70), act(2, 2, 70))))["alas_persistentes"] == (False, 2, 3)
    assert estado(Progreso(actividades=(act(1, 3, 70),)))["alas_persistentes"][0] is True


def test_explorador_de_clases_solo_con_actividades_de_tipo_clase_realizadas():
    assert estado(Progreso(actividades=(act(1, 1, 70),)))["explorador_de_clases"][0] is False
    assert estado(Progreso(actividades=(act(1, 0, tipo="clase"),)))["explorador_de_clases"][0] is False
    assert estado(Progreso(actividades=(act(1, 1, 70, tipo="clase"),)))["explorador_de_clases"][0] is True


def test_colonia_completa_necesita_todas_y_al_menos_tres_actividades():
    # Con solo 2 actividades disponibles, hacerlas no basta: la meta mínima es 3.
    assert estado(Progreso(actividades=(act(1, 1, 90), act(2, 1, 90))))["colonia_completa"] == (False, 2, 3)
    todas = Progreso(actividades=(act(1, 1, 90), act(2, 1, 90), act(3, 1, 90)))
    assert estado(todas)["colonia_completa"][0] is True
    # Una actividad nueva del docente "reabre" la meta: ya no están todas hechas.
    nueva = Progreso(actividades=todas.actividades + (act(4),))
    assert estado(nueva)["colonia_completa"] == (False, 3, 4)


def test_el_avance_nunca_pasa_de_la_meta():
    r = estado(Progreso(actividades=(act(1, 9, 100),), dias_activos=20))
    assert r["alas_persistentes"] == (True, 3, 3) and r["vuelo_constante"] == (True, 3, 3)


def test_el_nivel_sube_con_las_insignias():
    perfecto = Progreso(
        actividades=(act(1, 3, 100, primero=40, tipo="clase"), act(2, 1, 100), act(3, 1, 100)), dias_activos=5
    )
    r = calcular_logros(perfecto)
    assert r["obtenidas"] == 8 and r["nivel"]["nombre"] == "Maestro de la noche"
    assert r["nivel"]["faltan_para_subir"] is None


def test_insignias_nuevas_son_las_que_se_ganaron_con_el_ultimo_intento():
    antes = calcular_logros(Progreso(actividades=(act(1), act(2), act(3))))
    despues = calcular_logros(Progreso(actividades=(act(1, 1, 100), act(2), act(3))))
    assert {i["id"] for i in insignias_nuevas(antes, despues)} == {"primer_vuelo", "eco_perfecto"}
    # Sin cambios no hay nada que celebrar (y nunca se repite una ya ganada).
    assert insignias_nuevas(despues, despues) == []


def test_cada_insignia_trae_lo_que_la_interfaz_necesita():
    for i in calcular_logros(Progreso())["insignias"]:
        assert set(i) == {"id", "nombre", "descripcion", "color", "icono", "meta", "actual", "obtenida"}
    assert len({d.id for d in CATALOGO}) == len(CATALOGO)  # ids únicos


def test_el_reporte_separa_lo_que_domina_de_lo_que_hay_que_repasar_en_los_limites():
    # 80 % ya es fortaleza (79 no) y 59 % hay que repasarlo (60 ya no): el mismo límite de 60 que usan las métricas del docente.
    p = Progreso(actividades=(act(1, 1, 80), act(2, 1, 79), act(3, 1, 60), act(4, 1, 59)))
    r = armar_reporte(p)
    assert r["fortalezas"] == ["Actividad 1"]
    assert r["para_repasar"] == ["Actividad 4"]


def test_las_fortalezas_van_de_mayor_a_menor_y_son_tres_como_maximo():
    p = Progreso(actividades=tuple(act(n, 1, 80 + n) for n in range(1, 6)))  # 81..85
    assert armar_reporte(p)["fortalezas"] == ["Actividad 5", "Actividad 4", "Actividad 3"]


def test_el_promedio_del_reporte_usa_solo_lo_realizado_y_el_mejor_intento():
    p = Progreso(actividades=(act(1, 2, 90, primero=10), act(2, 1, 50), act(3)))
    resumen = armar_reporte(p)["resumen"]
    assert (resumen["promedio"], resumen["realizadas"], resumen["pendientes"], resumen["intentos"]) == (70, 2, 1, 3)
