"""Insignias del murciélago: logros que gana un alumno por lo que ya hizo en la plataforma.

Diseño (y por qué):
- Todo se CALCULA al momento a partir de los resultados guardados. No hay tabla nueva ni migración:
  si cambia una regla, el cambio vale para todos y nunca queda un logro "huérfano" en la base.
- Solo cuenta lo propio de cada niño (constancia, mejora, dominio). No hay rankings ni comparaciones
  con otros alumnos: el objetivo es motivar a cada quien con su propio avance.
- Este módulo es puro (no toca la base de datos), así que se prueba sin PostgreSQL.
"""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Actividad:
    """Una actividad aprobada del docente y lo que este alumno hizo en ella."""

    id_juego: str
    titulo: str
    tipo: str
    intentos: int = 0
    mejor: int | None = None  # mejor porcentaje de aciertos
    primero: int | None = None  # porcentaje del primer intento
    ultimo: date | None = None  # día del último intento (hora de la escuela)

    @property
    def realizada(self) -> bool:
        return self.intentos > 0


@dataclass(frozen=True)
class Progreso:
    """Lo necesario para calcular insignias y el reporte familiar de un alumno."""

    actividades: tuple[Actividad, ...] = ()
    dias_activos: int = 0  # días distintos (hora de la escuela) en los que jugó

    @property
    def realizadas(self) -> tuple[Actividad, ...]:
        return tuple(a for a in self.actividades if a.realizada)


# Cuántas actividades hacen falta, como mínimo, para poder ganar «Colonia completa»: con una o dos
# actividades en total sería demasiado fácil.
MINIMO_COLONIA = 3
PORCENTAJE_RADAR = 80


@dataclass(frozen=True)
class Definicion:
    id: str
    nombre: str
    descripcion: str  # lo que el niño debe hacer, en lenguaje simple
    color: str  # clave de la paleta (la interfaz la traduce a colores)
    icono: str  # clave del icono (la interfaz la traduce a un dibujo)
    medir: Callable[[Progreso], tuple[int, int]]  # (avance actual, meta)


def _primer_vuelo(p: Progreso) -> tuple[int, int]:
    return len(p.realizadas), 1


def _vuelo_constante(p: Progreso) -> tuple[int, int]:
    return p.dias_activos, 3


def _radar_afinado(p: Progreso) -> tuple[int, int]:
    return sum(1 for a in p.realizadas if (a.mejor or 0) >= PORCENTAJE_RADAR), 3


def _eco_perfecto(p: Progreso) -> tuple[int, int]:
    return sum(1 for a in p.realizadas if a.mejor == 100), 1


def _cada_vez_mejor(p: Progreso) -> tuple[int, int]:
    # Mejoró de verdad: repitió la actividad y su mejor resultado superó al del primer intento.
    return sum(1 for a in p.realizadas if a.intentos >= 2 and (a.mejor or 0) > (a.primero or 0)), 1


def _alas_persistentes(p: Progreso) -> tuple[int, int]:
    return max((a.intentos for a in p.realizadas), default=0), 3


def _explorador_de_clases(p: Progreso) -> tuple[int, int]:
    return sum(1 for a in p.realizadas if a.tipo == "clase"), 1


def _colonia_completa(p: Progreso) -> tuple[int, int]:
    return len(p.realizadas), max(len(p.actividades), MINIMO_COLONIA)


# El orden es el de la vitrina: de lo más fácil a lo más difícil.
CATALOGO: tuple[Definicion, ...] = (
    Definicion("primer_vuelo", "Primer vuelo", "Termina tu primera actividad.", "teal", "vuelo", _primer_vuelo),
    Definicion("vuelo_constante", "Vuelo constante", "Practica en 3 días distintos.", "sky", "luna", _vuelo_constante),
    Definicion("radar_afinado", "Radar afinado", "Logra 80 % o más en 3 actividades.", "violet", "radar", _radar_afinado),
    Definicion("eco_perfecto", "Eco perfecto", "Saca 100 % en una actividad.", "amber", "estrella", _eco_perfecto),
    Definicion("cada_vez_mejor", "Cada vez mejor", "Repite una actividad y mejora tu resultado.", "emerald", "mejora", _cada_vez_mejor),
    Definicion("alas_persistentes", "Alas persistentes", "Repite la misma actividad 3 veces.", "rose", "repetir", _alas_persistentes),
    Definicion("explorador_de_clases", "Explorador de clases", "Termina una clase interactiva.", "indigo", "libro", _explorador_de_clases),
    Definicion("colonia_completa", "Colonia completa", "Termina todas las actividades (mínimo 3).", "orange", "colonia", _colonia_completa),
)

# Título según cuántas insignias lleva. Cada tramo es (mínimo de insignias, nombre).
NIVELES: tuple[tuple[int, str], ...] = (
    (0, "Cría de murciélago"),
    (1, "Murciélago explorador"),
    (3, "Murciélago navegante"),
    (5, "Guardián de la colonia"),
    (8, "Maestro de la noche"),
)


def _nivel(obtenidas: int) -> dict:
    indice = max(i for i, (minimo, _) in enumerate(NIVELES) if obtenidas >= minimo)
    siguiente = NIVELES[indice + 1][0] - obtenidas if indice + 1 < len(NIVELES) else None
    return {"indice": indice, "nombre": NIVELES[indice][1], "faltan_para_subir": siguiente}


def calcular_logros(progreso: Progreso) -> dict:
    """Insignias (obtenidas o con su avance), cuántas lleva y su nivel."""
    insignias = []
    for d in CATALOGO:
        actual, meta = d.medir(progreso)
        insignias.append(
            {
                "id": d.id,
                "nombre": d.nombre,
                "descripcion": d.descripcion,
                "color": d.color,
                "icono": d.icono,
                "meta": meta,
                "actual": min(actual, meta),
                "obtenida": actual >= meta,
            }
        )
    obtenidas = sum(1 for i in insignias if i["obtenida"])
    return {"insignias": insignias, "obtenidas": obtenidas, "total": len(insignias), "nivel": _nivel(obtenidas)}


def insignias_nuevas(antes: dict, despues: dict) -> list[dict]:
    """Insignias que están obtenidas ahora y antes no (para celebrarlas al terminar una actividad)."""
    ya = {i["id"] for i in antes["insignias"] if i["obtenida"]}
    return [i for i in despues["insignias"] if i["obtenida"] and i["id"] not in ya]
