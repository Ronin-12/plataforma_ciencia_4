"""Equipos cooperativos y misiones en equipo.

Idea pedagógica: el grupo se divide en equipos de 3 o 4 niños. El docente lanza una «misión»
(una actividad ya aprobada para ese grupo) con una meta, por ejemplo 70 %. Cada niño juega en su
propia tableta y la barra de su equipo es el PROMEDIO de los mejores resultados de sus integrantes:
si alguien repite el juego para mejorar, la barra sube, así que conviene ayudarse.

Una misión puede tener de 1 a 5 juegos y dos modos: «todos» (cada integrante juega todos los juegos) o
«roles» (a cada integrante le toca uno, repartidos en orden, y la barra del equipo avanza cuando cada quien
cumple su parte). Al llegar a la meta, quienes aportaron ganan la insignia «Equipo estrella».

Salvaguardas: no hay ranking de alumnos ni de equipos (las listas van por nombre, no por avance) y
al alumno solo se le dice cuántos de su equipo ya jugaron, nunca quién sacó cuánto.
"""

import random
import uuid
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.deps import alumno_actual, docente_actual
from app.db.session import get_db_pool

router = APIRouter(prefix="/equipos", tags=["Equipos"])

MAX_EQUIPOS_POR_GRUPO = 10
MAX_INTEGRANTES = 6
MAX_JUEGOS_MISION = 5
# Dibujos disponibles para el equipo: la interfaz sabe pintar cada uno.
ICONOS = ("estrella", "cohete", "luna", "delfin", "aguila", "zorro", "tortuga", "mariposa", "planta", "volcan")


def _limpiar_nombre(valor: str) -> str:
    valor = " ".join(valor.split())
    if not valor:
        raise ValueError("El nombre del equipo no puede estar vacío.")
    return valor


def _validar_icono(valor: str) -> str:
    if valor not in ICONOS:
        raise ValueError(f"Ícono no válido. Opciones: {', '.join(ICONOS)}.")
    return valor


class EquipoCrear(BaseModel):
    id_grupo: uuid.UUID
    nombre: str = Field(min_length=1, max_length=40)
    icono: str = "estrella"

    _nombre = field_validator("nombre")(_limpiar_nombre)
    _icono = field_validator("icono")(_validar_icono)


class EquipoCambiar(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=40)
    icono: str | None = None

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, valor: str | None) -> str | None:
        return None if valor is None else _limpiar_nombre(valor)

    @field_validator("icono")
    @classmethod
    def _icono(cls, valor: str | None) -> str | None:
        return None if valor is None else _validar_icono(valor)


class Integrantes(BaseModel):
    ids_alumnos: list[uuid.UUID] = Field(max_length=MAX_INTEGRANTES)


class EquiposAlAzar(BaseModel):
    id_grupo: uuid.UUID
    tamano: int = Field(default=4, ge=2, le=MAX_INTEGRANTES)


class RetoCrear(BaseModel):
    id_grupo: uuid.UUID
    # Una misión de un solo juego puede seguir mandando id_juego; para varios se usa ids_juegos.
    id_juego: uuid.UUID | None = None
    ids_juegos: list[uuid.UUID] = Field(default_factory=list, max_length=MAX_JUEGOS_MISION)
    meta: int = Field(default=70, ge=10, le=100)
    modo: Literal["todos", "roles"] = "todos"

    @model_validator(mode="after")
    def _juegos(self):
        ids = self.ids_juegos or ([self.id_juego] if self.id_juego else [])
        if not ids:
            raise ValueError("Elige al menos una actividad para la misión.")
        if len(set(ids)) != len(ids):
            raise ValueError("No repitas la misma actividad en la misión.")
        if self.modo == "roles" and len(ids) < 2:
            raise ValueError("Para repartir roles elige al menos 2 actividades.")
        self.ids_juegos = ids
        return self


# --- utilidades ----------------------------------------------------------------------------------


async def _grupo_del_docente(conn: asyncpg.Connection, id_grupo: uuid.UUID, id_docente) -> None:
    existe = await conn.fetchval("SELECT 1 FROM grupos WHERE id_grupo = $1 AND id_docente = $2", id_grupo, id_docente)
    if not existe:
        raise HTTPException(status_code=404, detail="No se encontró ese grupo.")


async def _equipo_del_docente(conn: asyncpg.Connection, id_equipo: uuid.UUID, id_docente) -> asyncpg.Record:
    fila = await conn.fetchrow(
        """
        SELECT e.id_equipo, e.id_grupo, e.nombre, e.icono
          FROM equipos e JOIN grupos g ON g.id_grupo = e.id_grupo
         WHERE e.id_equipo = $1 AND g.id_docente = $2
        """,
        id_equipo, id_docente,
    )
    if fila is None:
        raise HTTPException(status_code=404, detail="No se encontró ese equipo.")
    return fila


def _s(valor) -> str:
    return str(valor)


async def _listar(conn: asyncpg.Connection, id_grupo: uuid.UUID) -> dict:
    equipos = await conn.fetch(
        "SELECT id_equipo, nombre, icono FROM equipos WHERE id_grupo = $1 ORDER BY LOWER(nombre)", id_grupo
    )
    alumnos = await conn.fetch(
        """
        SELECT a.id_alumno, a.nombre_pila, ea.id_equipo
          FROM alumnos a LEFT JOIN equipos_alumnos ea ON ea.id_alumno = a.id_alumno
         WHERE a.id_grupo = $1 AND a.activo
         ORDER BY LOWER(a.nombre_pila)
        """,
        id_grupo,
    )
    por_equipo: dict = {}
    sin_equipo = []
    for a in alumnos:
        persona = {"id_alumno": _s(a["id_alumno"]), "nombre_pila": a["nombre_pila"]}
        if a["id_equipo"] is None:
            sin_equipo.append(persona)
        else:
            por_equipo.setdefault(a["id_equipo"], []).append(persona)
    return {
        "equipos": [
            {"id_equipo": _s(e["id_equipo"]), "nombre": e["nombre"], "icono": e["icono"], "integrantes": por_equipo.get(e["id_equipo"], [])}
            for e in equipos
        ],
        "sin_equipo": sin_equipo,
    }


async def _juegos_de_reto(conn: asyncpg.Connection, id_reto: uuid.UUID) -> list[asyncpg.Record]:
    return await conn.fetch(
        """
        SELECT rj.id_juego, j.contenido_juego->>'titulo' AS titulo, j.contenido_juego->>'tipo_actividad' AS tipo_actividad
          FROM retos_equipo_juegos rj JOIN juegos_generados j ON j.id_juego = rj.id_juego
         WHERE rj.id_reto = $1 ORDER BY rj.posicion
        """,
        id_reto,
    )


async def _progreso(conn: asyncpg.Connection, reto: asyncpg.Record, interno: bool = False) -> dict:
    """Avance de cada equipo en una misión.

    Cada «parte» es un integrante con un juego: en modo «todos» son todas las combinaciones; en «roles», un
    juego por integrante (repartidos en orden por identificador, así el reparto no cambia entre consultas).
    El avance es el promedio del MEJOR resultado de cada parte (la que no se ha jugado cuenta 0).
    Con `interno=True` se agregan datos con identificadores de alumnos (claves que empiezan con «_»):
    son solo para el servidor y hay que quitarlos con `_publico` antes de responder.
    """
    juegos = await _juegos_de_reto(conn, reto["id_reto"])
    ids_juegos = [j["id_juego"] for j in juegos]
    equipos_bd = await conn.fetch(
        "SELECT id_equipo, nombre, icono FROM equipos WHERE id_grupo = $1 ORDER BY LOWER(nombre)", reto["id_grupo"]
    )
    celdas = await conn.fetch(
        """
        SELECT ea.id_equipo, a.id_alumno, rj.id_juego, m.mejor
          FROM equipos e
          JOIN equipos_alumnos ea ON ea.id_equipo = e.id_equipo
          JOIN alumnos a ON a.id_alumno = ea.id_alumno AND a.activo
          JOIN retos_equipo_juegos rj ON rj.id_reto = $2
          LEFT JOIN LATERAL (
                SELECT MAX(r.puntuacion_final) AS mejor
                  FROM registro_avances r
                 WHERE r.id_alumno = a.id_alumno AND r.id_juego = rj.id_juego AND r.fecha_ejecucion >= $3
          ) m ON TRUE
         WHERE e.id_grupo = $1
        """,
        reto["id_grupo"], reto["id_reto"], reto["fecha_inicio"],
    )
    mejores: dict = {}  # {id_equipo: {id_alumno: {id_juego: mejor o None}}}
    for c in celdas:
        mejores.setdefault(c["id_equipo"], {}).setdefault(c["id_alumno"], {})[c["id_juego"]] = c["mejor"]

    equipos = []
    for e in equipos_bd:
        por_alumno = mejores.get(e["id_equipo"], {})
        miembros = sorted(por_alumno)
        if reto["modo"] == "roles" and ids_juegos:
            partes_de = {m: [ids_juegos[i % len(ids_juegos)]] for i, m in enumerate(miembros)}
        else:
            partes_de = {m: list(ids_juegos) for m in miembros}
        resultados = [por_alumno[m][g] for m in miembros for g in partes_de[m]]
        progreso = min(100, round(sum(r or 0 for r in resultados) / len(resultados))) if resultados else 0
        listos = sum(1 for m in miembros if partes_de[m] and all(por_alumno[m][g] is not None for g in partes_de[m]))
        por_juego = []
        for j in juegos:
            quienes = [m for m in miembros if j["id_juego"] in partes_de[m]]
            por_juego.append({
                "id_juego": _s(j["id_juego"]), "titulo": j["titulo"], "asignados": len(quienes),
                "listos": sum(1 for m in quienes if por_alumno[m][j["id_juego"]] is not None),
            })
        equipo = {
            "id_equipo": _s(e["id_equipo"]), "nombre": e["nombre"], "icono": e["icono"],
            "integrantes": len(miembros), "ya_jugaron": listos, "progreso": progreso,
            "meta_lograda": bool(miembros) and progreso >= reto["meta"], "por_juego": por_juego,
        }
        if interno:
            equipo["_partes_de"], equipo["_mejores"] = partes_de, por_alumno
        equipos.append(equipo)
    con_gente = [e for e in equipos if e["integrantes"] > 0]
    return {
        "id_reto": _s(reto["id_reto"]), "id_juego": _s(reto["id_juego"]), "meta": reto["meta"], "estado": reto["estado"],
        "modo": reto["modo"], "titulo": reto["titulo"], "tipo_actividad": reto["tipo_actividad"],
        "juegos": [{"id_juego": _s(j["id_juego"]), "titulo": j["titulo"], "tipo_actividad": j["tipo_actividad"]} for j in juegos],
        "fecha_inicio": reto["fecha_inicio"], "fecha_cierre": reto["fecha_cierre"],
        "equipos": equipos,
        # Toda la clase lo logró cuando cada equipo con integrantes llegó a la meta.
        "clase_completa": bool(con_gente) and all(e["meta_lograda"] for e in con_gente),
    }


def _publico(progreso: dict) -> dict:
    """El mismo avance sin los datos internos (los que traen identificadores de alumnos)."""
    return {**progreso, "equipos": [{k: v for k, v in e.items() if not k.startswith("_")} for e in progreso["equipos"]]}


async def _otorgar_insignias(conn: asyncpg.Connection, progreso: dict) -> None:
    """Anota a quienes aportaron a un equipo que ya llegó a la meta (insignia «Equipo estrella»).

    «Aportó» = jugó al menos una de sus partes: quien no ha jugado nada no se lleva el logro del equipo.
    Es idempotente: se puede llamar en cada consulta y solo agrega lo que faltaba.
    """
    filas = [
        (uuid.UUID(progreso["id_reto"]), id_alumno)
        for equipo in progreso["equipos"] if equipo["meta_lograda"]
        for id_alumno, partes in equipo["_partes_de"].items()
        if any(equipo["_mejores"][id_alumno][g] is not None for g in partes)
    ]
    if filas:
        await conn.executemany("INSERT INTO misiones_logradas (id_reto, id_alumno) VALUES ($1, $2) ON CONFLICT DO NOTHING", filas)


_SELECT_RETO = """
    SELECT r.id_reto, r.id_grupo, r.id_juego, r.meta, r.modo, r.estado, r.fecha_inicio, r.fecha_cierre,
           j.contenido_juego->>'titulo' AS titulo, j.contenido_juego->>'tipo_actividad' AS tipo_actividad
      FROM retos_equipo r JOIN juegos_generados j ON j.id_juego = r.id_juego
"""


# --- equipos (docente) -----------------------------------------------------------------------------


@router.get("/")
async def listar_equipos(
    id_grupo: uuid.UUID = Query(...), docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Los equipos de un grupo con sus integrantes, y los alumnos que aún no tienen equipo."""
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, id_grupo, docente["id"])
        return await _listar(conn, id_grupo)


@router.post("/", status_code=status.HTTP_201_CREATED)
async def crear_equipo(datos: EquipoCrear, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, datos.id_grupo, docente["id"])
        total = await conn.fetchval("SELECT COUNT(*) FROM equipos WHERE id_grupo = $1", datos.id_grupo)
        if total >= MAX_EQUIPOS_POR_GRUPO:
            raise HTTPException(status_code=409, detail=f"Un grupo puede tener hasta {MAX_EQUIPOS_POR_GRUPO} equipos.")
        try:
            fila = await conn.fetchrow(
                "INSERT INTO equipos (id_grupo, nombre, icono) VALUES ($1, $2, $3) RETURNING id_equipo, nombre, icono",
                datos.id_grupo, datos.nombre, datos.icono,
            )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(status_code=409, detail="Ya hay un equipo con ese nombre en este grupo.") from exc
    return {"id_equipo": _s(fila["id_equipo"]), "nombre": fila["nombre"], "icono": fila["icono"], "integrantes": []}


@router.post("/al-azar")
async def formar_equipos_al_azar(
    datos: EquiposAlAzar, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Reparte a los alumnos activos del grupo en equipos parejos. Reemplaza los equipos que hubiera."""
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, datos.id_grupo, docente["id"])
        ids = [f["id_alumno"] for f in await conn.fetch("SELECT id_alumno FROM alumnos WHERE id_grupo = $1 AND activo", datos.id_grupo)]
        if len(ids) < 2:
            raise HTTPException(status_code=409, detail="Para formar equipos necesitas al menos 2 alumnos en el grupo.")
        cantidad = max(1, min(MAX_EQUIPOS_POR_GRUPO, round(len(ids) / datos.tamano)))
        random.shuffle(ids)
        async with conn.transaction():
            await conn.execute("DELETE FROM equipos WHERE id_grupo = $1", datos.id_grupo)
            for numero in range(cantidad):
                equipo = await conn.fetchval(
                    "INSERT INTO equipos (id_grupo, nombre, icono) VALUES ($1, $2, $3) RETURNING id_equipo",
                    datos.id_grupo, f"Equipo {numero + 1}", ICONOS[numero % len(ICONOS)],
                )
                # Reparto por turnos: los equipos nunca difieren en más de un integrante.
                for id_alumno in ids[numero::cantidad]:
                    await conn.execute("INSERT INTO equipos_alumnos (id_alumno, id_equipo) VALUES ($1, $2)", id_alumno, equipo)
        return await _listar(conn, datos.id_grupo)


@router.patch("/{id_equipo}")
async def cambiar_equipo(
    id_equipo: uuid.UUID, datos: EquipoCambiar, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    if datos.nombre is None and datos.icono is None:
        raise HTTPException(status_code=422, detail="Indica qué quieres cambiar: nombre o ícono.")
    async with pool.acquire() as conn:
        actual = await _equipo_del_docente(conn, id_equipo, docente["id"])
        try:
            fila = await conn.fetchrow(
                "UPDATE equipos SET nombre = COALESCE($2, nombre), icono = COALESCE($3, icono) WHERE id_equipo = $1 RETURNING id_equipo, nombre, icono",
                actual["id_equipo"], datos.nombre, datos.icono,
            )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(status_code=409, detail="Ya hay un equipo con ese nombre en este grupo.") from exc
    return {"id_equipo": _s(fila["id_equipo"]), "nombre": fila["nombre"], "icono": fila["icono"]}


@router.delete("/{id_equipo}")
async def eliminar_equipo(id_equipo: uuid.UUID, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Borra el equipo; sus integrantes quedan sin equipo (no se borra ningún alumno)."""
    async with pool.acquire() as conn:
        await _equipo_del_docente(conn, id_equipo, docente["id"])
        await conn.execute("DELETE FROM equipos WHERE id_equipo = $1", id_equipo)
    return {"eliminado": True}


@router.put("/{id_equipo}/integrantes")
async def poner_integrantes(
    id_equipo: uuid.UUID, datos: Integrantes, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """Deja como integrantes exactamente a esos alumnos. Si alguno estaba en otro equipo, se mueve."""
    ids = list(dict.fromkeys(datos.ids_alumnos))  # sin repetidos, conserva el orden
    async with pool.acquire() as conn:
        equipo = await _equipo_del_docente(conn, id_equipo, docente["id"])
        if ids:
            validos = await conn.fetchval(
                "SELECT COUNT(*) FROM alumnos WHERE id_grupo = $1 AND activo AND id_alumno = ANY($2::uuid[])", equipo["id_grupo"], ids
            )
            if validos != len(ids):
                raise HTTPException(status_code=422, detail="Todos los integrantes deben ser alumnos activos de este grupo.")
        async with conn.transaction():
            await conn.execute("DELETE FROM equipos_alumnos WHERE id_equipo = $1", id_equipo)
            for id_alumno in ids:
                await conn.execute(
                    """
                    INSERT INTO equipos_alumnos (id_alumno, id_equipo) VALUES ($1, $2)
                    ON CONFLICT (id_alumno) DO UPDATE SET id_equipo = EXCLUDED.id_equipo
                    """,
                    id_alumno, id_equipo,
                )
        return await _listar(conn, equipo["id_grupo"])


# --- misiones en equipo ----------------------------------------------------------------------------


@router.post("/misiones", status_code=status.HTTP_201_CREATED)
async def lanzar_mision(datos: RetoCrear, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Abre una misión en equipo: de 1 a 5 actividades aprobadas y asignadas a ese grupo, con su meta y su modo."""
    ids = datos.ids_juegos
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, datos.id_grupo, docente["id"])
        validos = await conn.fetchval(
            """
            SELECT COUNT(*) FROM juegos_generados j JOIN juegos_grupos jg ON jg.id_juego = j.id_juego
             WHERE j.id_juego = ANY($1::uuid[]) AND j.id_docente = $2 AND j.estado = 'aprobado' AND jg.id_grupo = $3
            """,
            ids, docente["id"], datos.id_grupo,
        )
        if validos != len(ids):
            raise HTTPException(
                status_code=409,
                detail="La actividad debe estar aprobada y asignada a este grupo." if len(ids) == 1
                else "Todas las actividades deben estar aprobadas y asignadas a este grupo.",
            )
        con_gente = await conn.fetchval(
            """
            SELECT COUNT(*) FROM equipos e
             WHERE e.id_grupo = $1 AND EXISTS (
                   SELECT 1 FROM equipos_alumnos ea JOIN alumnos a ON a.id_alumno = ea.id_alumno
                    WHERE ea.id_equipo = e.id_equipo AND a.activo)
            """,
            datos.id_grupo,
        )
        if not con_gente:
            raise HTTPException(status_code=409, detail="Primero arma al menos un equipo con integrantes.")
        if datos.modo == "roles":
            cortos = await conn.fetch(
                """
                SELECT e.nombre FROM equipos e
                  JOIN equipos_alumnos ea ON ea.id_equipo = e.id_equipo
                  JOIN alumnos a ON a.id_alumno = ea.id_alumno AND a.activo
                 WHERE e.id_grupo = $1
                 GROUP BY e.id_equipo, e.nombre HAVING COUNT(a.id_alumno) < $2
                 ORDER BY LOWER(e.nombre)
                """,
                datos.id_grupo, len(ids),
            )
            if cortos:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        f"Para repartir {len(ids)} juegos, cada equipo necesita al menos {len(ids)} integrantes. "
                        f"Les faltan a: {', '.join(c['nombre'] for c in cortos)}."
                    ),
                )
        try:
            async with conn.transaction():
                id_reto = await conn.fetchval(
                    "INSERT INTO retos_equipo (id_grupo, id_juego, meta, modo) VALUES ($1, $2, $3, $4) RETURNING id_reto",
                    datos.id_grupo, ids[0], datos.meta, datos.modo,
                )
                await conn.executemany(
                    "INSERT INTO retos_equipo_juegos (id_reto, id_juego, posicion) VALUES ($1, $2, $3)",
                    [(id_reto, id_juego, posicion) for posicion, id_juego in enumerate(ids, start=1)],
                )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(status_code=409, detail="Ya hay una misión abierta en este grupo: ciérrala primero.") from exc
        reto = await conn.fetchrow(_SELECT_RETO + " WHERE r.id_reto = $1", id_reto)
        return _publico(await _progreso(conn, reto, interno=True))


@router.get("/misiones")
async def ver_misiones(
    id_grupo: uuid.UUID = Query(...), docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
):
    """La misión abierta del grupo con el avance de cada equipo, y las últimas ya cerradas."""
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, id_grupo, docente["id"])
        abierta = await conn.fetchrow(_SELECT_RETO + " WHERE r.id_grupo = $1 AND r.estado = 'abierto'", id_grupo)
        cerradas = await conn.fetch(
            _SELECT_RETO + " WHERE r.id_grupo = $1 AND r.estado = 'cerrado' ORDER BY r.fecha_cierre DESC LIMIT 5", id_grupo
        )
        mision = None
        if abierta:
            progreso = await _progreso(conn, abierta, interno=True)
            await _otorgar_insignias(conn, progreso)
            mision = _publico(progreso)
        return {"mision": mision, "cerradas": [await _progreso(conn, c) for c in cerradas]}


@router.post("/misiones/{id_reto}/cerrar")
async def cerrar_mision(id_reto: uuid.UUID, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        reto = await conn.fetchrow(
            _SELECT_RETO + " JOIN grupos g ON g.id_grupo = r.id_grupo WHERE r.id_reto = $1 AND g.id_docente = $2 AND r.estado = 'abierto'",
            id_reto, docente["id"],
        )
        if reto is None:
            raise HTTPException(status_code=404, detail="No se encontró una misión abierta con ese identificador.")
        # Antes de cerrar se anotan los logros: después los equipos pueden cambiar y ya no habría cómo saberlo.
        await _otorgar_insignias(conn, await _progreso(conn, reto, interno=True))
        await conn.execute(
            "UPDATE retos_equipo SET estado = 'cerrado', fecha_cierre = CURRENT_TIMESTAMP WHERE id_reto = $1 AND estado = 'abierto'", id_reto
        )
    return {"id_reto": _s(id_reto), "estado": "cerrado"}


# --- alumno ----------------------------------------------------------------------------------------


@router.get("/mi-mision")
async def mi_mision(alumno: dict = Depends(alumno_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Lo que ve el alumno: su equipo y la misión abierta de su grupo (sin datos de otros alumnos)."""
    async with pool.acquire() as conn:
        equipo = await conn.fetchrow(
            """
            SELECT e.id_equipo, e.nombre, e.icono FROM equipos_alumnos ea JOIN equipos e ON e.id_equipo = ea.id_equipo
             WHERE ea.id_alumno = $1 AND e.id_grupo = $2
            """,
            alumno["id"], alumno["id_grupo"],
        )
        if equipo is None:
            return {"equipo": None, "mision": None}
        abierta = await conn.fetchrow(_SELECT_RETO + " WHERE r.id_grupo = $1 AND r.estado = 'abierto'", alumno["id_grupo"])
        base = {"equipo": {"id_equipo": _s(equipo["id_equipo"]), "nombre": equipo["nombre"], "icono": equipo["icono"]}}
        if abierta is None:
            return {**base, "mision": None}
        progreso = await _progreso(conn, abierta, interno=True)
        await _otorgar_insignias(conn, progreso)
        id_propio = base["equipo"]["id_equipo"]
        propio = next(e for e in progreso["equipos"] if e["id_equipo"] == id_propio)
        mias = propio["_partes_de"].get(alumno["id"], [])  # los juegos que me tocan (todos, o uno en modo «roles»)
        mis_mejores = propio["_mejores"].get(alumno["id"], {})
        mis_juegos = [
            {**j, "hecho": mis_mejores.get(uuid.UUID(j["id_juego"])) is not None}
            for j in progreso["juegos"] if uuid.UUID(j["id_juego"]) in mias
        ]
        siguiente = next((j for j in mis_juegos if not j["hecho"]), mis_juegos[0] if mis_juegos else None)
        gano = await conn.fetchval(
            "SELECT 1 FROM misiones_logradas WHERE id_reto = $1 AND id_alumno = $2", abierta["id_reto"], alumno["id"]
        )
        mi_equipo = {k: v for k, v in propio.items() if not k.startswith("_") and k != "por_juego"}
        return {
            **base,
            "mision": {
                "id_reto": progreso["id_reto"], "modo": progreso["modo"], "meta": progreso["meta"],
                # Compatibilidad: el juego «que sigue» (o el primero) con los nombres de siempre.
                "id_juego": siguiente["id_juego"] if siguiente else progreso["id_juego"],
                "titulo": siguiente["titulo"] if siguiente else progreso["titulo"],
                "tipo_actividad": siguiente["tipo_actividad"] if siguiente else progreso["tipo_actividad"],
                "juegos": mis_juegos,
                "mi_equipo": mi_equipo,
                # Los demás equipos: solo nombre, dibujo y barra. Nunca quién sacó cuánto.
                "otros_equipos": [
                    {k: e[k] for k in ("id_equipo", "nombre", "icono", "progreso", "meta_lograda")}
                    for e in progreso["equipos"] if e["integrantes"] > 0 and e["id_equipo"] != id_propio
                ],
                "yo_ya_jugue": bool(mis_juegos) and all(j["hecho"] for j in mis_juegos),
                "clase_completa": progreso["clase_completa"],
                "insignia_ganada": bool(gano),
            },
        }
