"""Qué actividades recibe un grupo cuando se crea."""

import uuid

import asyncpg


async def heredar_actividades_si_es_el_primero(conn: asyncpg.Connection, id_docente: uuid.UUID, id_grupo: uuid.UUID) -> None:
    """El PRIMER grupo de un docente recibe las actividades que ya tenía.

    Un docente puede crear y aprobar actividades antes de abrir su primer grupo; sin esto, al abrirlo
    tendría que volver a asignarlas una por una. Los grupos siguientes (4.º B, 4.º C...) empiezan
    vacíos a propósito: cada grupo ve solo lo que el docente le asigna.
    """
    if await conn.fetchval("SELECT COUNT(*) FROM grupos WHERE id_docente = $1", id_docente) != 1:
        return
    await conn.execute(
        "INSERT INTO juegos_grupos (id_juego, id_grupo) SELECT id_juego, $2 FROM juegos_generados WHERE id_docente = $1 "
        "ON CONFLICT DO NOTHING",
        id_docente,
        id_grupo,
    )
