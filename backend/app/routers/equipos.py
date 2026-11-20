"""Equipos cooperativos y misiones en equipo.

Idea pedagógica: el grupo se divide en equipos de 3 o 4 niños. El docente lanza una «misión»
(una actividad ya aprobada para ese grupo) con una meta, por ejemplo 70 %. Cada niño juega en su
propia tableta y la barra de su equipo es el PROMEDIO de los mejores resultados de sus integrantes:
si alguien repite el juego para mejorar, la barra sube, así que conviene ayudarse.

Salvaguardas: no hay ranking de alumnos ni de equipos (las listas van por nombre, no por avance) y
al alumno solo se le dice cuántos de su equipo ya jugaron, nunca quién sacó cuánto.
"""

import random
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator

from app.core.deps import alumno_actual, docente_actual
from app.db.session import get_db_pool

router = APIRouter(prefix="/equipos", tags=["Equipos"])

MAX_EQUIPOS_POR_GRUPO = 10
MAX_INTEGRANTES = 6
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
    id_juego: uuid.UUID
    meta: int = Field(default=70, ge=10, le=100)


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


async def _progreso(conn: asyncpg.Connection, reto: asyncpg.Record) -> dict:
    """Avance de cada equipo en una misión: promedio de los mejores resultados de sus integrantes."""
    filas = await conn.fetch(
        """
        SELECT e.id_equipo, e.nombre, e.icono,
               COUNT(a.id_alumno)                    AS integrantes,
               COUNT(m.mejor)                        AS ya_jugaron,
               COALESCE(SUM(COALESCE(m.mejor, 0)), 0) AS suma
          FROM equipos e
          LEFT JOIN equipos_alumnos ea ON ea.id_equipo = e.id_equipo
          LEFT JOIN alumnos a ON a.id_alumno = ea.id_alumno AND a.activo
          LEFT JOIN LATERAL (
                SELECT MAX(r.puntuacion_final) AS mejor
                  FROM registro_avances r
                 WHERE r.id_alumno = a.id_alumno AND r.id_juego = $2 AND r.fecha_ejecucion >= $3
          ) m ON TRUE
         WHERE e.id_grupo = $1
         GROUP BY e.id_equipo, e.nombre, e.icono
         ORDER BY LOWER(e.nombre)
        """,
        reto["id_grupo"], reto["id_juego"], reto["fecha_inicio"],
    )
    equipos = []
    for f in filas:
        integrantes = f["integrantes"]
        progreso = min(100, round(f["suma"] / integrantes)) if integrantes else 0
        equipos.append({
            "id_equipo": _s(f["id_equipo"]), "nombre": f["nombre"], "icono": f["icono"],
            "integrantes": integrantes, "ya_jugaron": f["ya_jugaron"], "progreso": progreso,
            "meta_lograda": integrantes > 0 and progreso >= reto["meta"],
        })
    con_gente = [e for e in equipos if e["integrantes"] > 0]
    return {
        "id_reto": _s(reto["id_reto"]), "id_juego": _s(reto["id_juego"]), "meta": reto["meta"], "estado": reto["estado"],
        "titulo": reto["titulo"], "tipo_actividad": reto["tipo_actividad"],
        "fecha_inicio": reto["fecha_inicio"], "fecha_cierre": reto["fecha_cierre"],
        "equipos": equipos,
        # Toda la clase lo logró cuando cada equipo con integrantes llegó a la meta.
        "clase_completa": bool(con_gente) and all(e["meta_lograda"] for e in con_gente),
    }


_SELECT_RETO = """
    SELECT r.id_reto, r.id_grupo, r.id_juego, r.meta, r.estado, r.fecha_inicio, r.fecha_cierre,
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
    """Abre una misión en equipo: una actividad aprobada y asignada a ese grupo, con su meta."""
    async with pool.acquire() as conn:
        await _grupo_del_docente(conn, datos.id_grupo, docente["id"])
        asignado = await conn.fetchval(
            """
            SELECT 1 FROM juegos_generados j JOIN juegos_grupos jg ON jg.id_juego = j.id_juego
             WHERE j.id_juego = $1 AND j.id_docente = $2 AND j.estado = 'aprobado' AND jg.id_grupo = $3
            """,
            datos.id_juego, docente["id"], datos.id_grupo,
        )
        if not asignado:
            raise HTTPException(status_code=409, detail="La actividad debe estar aprobada y asignada a este grupo.")
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
        try:
            id_reto = await conn.fetchval(
                "INSERT INTO retos_equipo (id_grupo, id_juego, meta) VALUES ($1, $2, $3) RETURNING id_reto",
                datos.id_grupo, datos.id_juego, datos.meta,
            )
        except asyncpg.UniqueViolationError as exc:
            raise HTTPException(status_code=409, detail="Ya hay una misión abierta en este grupo: ciérrala primero.") from exc
        reto = await conn.fetchrow(_SELECT_RETO + " WHERE r.id_reto = $1", id_reto)
        return await _progreso(conn, reto)


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
        return {
            "mision": await _progreso(conn, abierta) if abierta else None,
            "cerradas": [await _progreso(conn, c) for c in cerradas],
        }


@router.post("/misiones/{id_reto}/cerrar")
async def cerrar_mision(id_reto: uuid.UUID, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        reto = await conn.fetchrow(
            """
            UPDATE retos_equipo r SET estado = 'cerrado', fecha_cierre = CURRENT_TIMESTAMP
              FROM grupos g
             WHERE r.id_reto = $1 AND g.id_grupo = r.id_grupo AND g.id_docente = $2 AND r.estado = 'abierto'
            RETURNING r.id_reto
            """,
            id_reto, docente["id"],
        )
        if reto is None:
            raise HTTPException(status_code=404, detail="No se encontró una misión abierta con ese identificador.")
    return {"id_reto": _s(reto["id_reto"]), "estado": "cerrado"}


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
        progreso = await _progreso(conn, abierta)
        mi_mejor = await conn.fetchval(
            "SELECT MAX(puntuacion_final) FROM registro_avances WHERE id_alumno = $1 AND id_juego = $2 AND fecha_ejecucion >= $3",
            alumno["id"], abierta["id_juego"], abierta["fecha_inicio"],
        )
        propio = next(e for e in progreso["equipos"] if e["id_equipo"] == base["equipo"]["id_equipo"])
        return {
            **base,
            "mision": {
                "id_reto": progreso["id_reto"], "id_juego": progreso["id_juego"], "titulo": progreso["titulo"],
                "tipo_actividad": progreso["tipo_actividad"], "meta": progreso["meta"],
                "mi_equipo": propio,
                # Los demás equipos: solo nombre, dibujo y barra. Nunca quién sacó cuánto.
                "otros_equipos": [
                    {k: e[k] for k in ("id_equipo", "nombre", "icono", "progreso", "meta_lograda")}
                    for e in progreso["equipos"] if e["integrantes"] > 0 and e["id_equipo"] != propio["id_equipo"]
                ],
                "yo_ya_jugue": mi_mejor is not None,
                "clase_completa": progreso["clase_completa"],
            },
        }
