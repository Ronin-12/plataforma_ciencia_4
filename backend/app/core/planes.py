"""Planes de Mupi y sus límites de IA.

No hay cobro en línea: el docente empieza en Gratis y, cuando su escuela llega a un acuerdo con el
equipo, el administrador le cambia el plan desde su panel. Lo esencial (juegos, aprobación,
privacidad, insignias, reporte familiar) es igual en todos los planes; lo que cambia es cuánta IA
incluye cada uno.
"""

from dataclasses import dataclass
from typing import Literal

from app.core.config import settings

PlanId = Literal["gratis", "maestro", "docente", "escuela"]
PLAN_PREDETERMINADO: PlanId = "gratis"


@dataclass(frozen=True)
class Plan:
    id: str
    nombre: str
    mensual: int
    diario: int


def _planes() -> dict[str, Plan]:
    # Gratis se lee de .env (IA_GENERACIONES_*_MAX) para poder ajustarlo sin tocar el código.
    return {
        "gratis": Plan("gratis", "Gratis", settings.IA_GENERACIONES_MENSUALES_MAX, settings.IA_GENERACIONES_DIARIAS_MAX),
        "maestro": Plan("maestro", "Maestro (escuela pública)", 20, 5),
        "docente": Plan("docente", "Docente", 40, 6),
        "escuela": Plan("escuela", "Escuela", 40, 6),
    }


IDS_PLANES: tuple[str, ...] = ("gratis", "maestro", "docente", "escuela")


def plan(plan_id: str | None) -> Plan:
    """El plan con ese id; si no existe (dato viejo o vacío) se usa Gratis."""
    planes = _planes()
    return planes.get(plan_id or PLAN_PREDETERMINADO, planes[PLAN_PREDETERMINADO])


def todos() -> list[Plan]:
    planes = _planes()
    return [planes[i] for i in IDS_PLANES]
