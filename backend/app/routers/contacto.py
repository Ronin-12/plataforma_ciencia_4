"""Formulario de contacto de la sección Planes.

Mupi no cobra en línea: quien quiere más que el plan Gratis deja sus datos aquí y el equipo se
pone en contacto para llegar a un acuerdo. Las solicitudes se ven en el panel de administración.
"""

import logging
import re
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.core.limites import LimitadorVentana, exigir, ip_cliente
from app.db.session import get_db_pool
from app.schemas.docente import validar_cct

router = APIRouter(prefix="/contacto", tags=["Contacto"])
logger = logging.getLogger("murcielago")

# Un formulario público atrae robots: máximo 5 envíos por IP y hora.
_limite_contacto = LimitadorVentana(maximo=5, ventana_segundos=3600)


def _limpiar(valor: str | None) -> str | None:
    valor = " ".join((valor or "").split())
    return valor or None


class SolicitudContacto(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    email: EmailStr
    telefono: str | None = Field(default=None, max_length=20)
    escuela: str = Field(min_length=2, max_length=120)
    tipo_escuela: Literal["publica", "privada"]
    cct: str | None = Field(default=None, max_length=20)
    num_docentes: int = Field(ge=1, le=500)
    plan_interes: Literal["maestro", "docente", "escuela", "licencia", "otro"] = "otro"
    mensaje: str | None = Field(default=None, max_length=1000)
    # El formulario guarda datos personales: sin aceptar el aviso de privacidad no se guarda nada.
    acepta_privacidad: bool
    # Campo trampa: está oculto para las personas; si llega con algo, lo llenó un robot.
    sitio_web: str | None = Field(default=None, max_length=200)

    @field_validator("nombre", "escuela", "mensaje")
    @classmethod
    def _sin_espacios_de_mas(cls, valor: str | None) -> str | None:
        return _limpiar(valor)

    @field_validator("telefono")
    @classmethod
    def _telefono(cls, valor: str | None) -> str | None:
        limpio = re.sub(r"[\s().-]", "", valor or "")
        if not limpio:
            return None
        if not re.fullmatch(r"\+?\d{8,15}", limpio):
            raise ValueError("Escribe un teléfono de 10 dígitos (puede llevar lada internacional).")
        return limpio

    @field_validator("cct")
    @classmethod
    def _cct(cls, valor: str | None) -> str | None:
        return validar_cct(valor)

    @field_validator("acepta_privacidad")
    @classmethod
    def _privacidad(cls, valor: bool) -> bool:
        if not valor:
            raise ValueError("Para enviarnos tus datos debes aceptar el aviso de privacidad.")
        return valor


@router.post("", status_code=status.HTTP_201_CREATED)
async def enviar_solicitud(
    datos: SolicitudContacto,
    request: Request,
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Guarda la solicitud. No necesita sesión: la llena cualquier docente o escuela interesada."""
    exigir(_limite_contacto, ip_cliente(request), "Ya recibimos varios mensajes desde tu red. Intenta más tarde.")
    respuesta = {"mensaje": "¡Gracias! Te escribiremos pronto para platicar qué necesita tu escuela."}
    if datos.sitio_web:
        logger.info("Formulario de contacto descartado: lo llenó un robot.")
        return respuesta  # se responde igual para no darle pistas al robot
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO solicitudes_contacto
                (nombre, email, telefono, escuela, tipo_escuela, cct, num_docentes, plan_interes, mensaje)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            """,
            datos.nombre, datos.email.lower(), datos.telefono, datos.escuela, datos.tipo_escuela,
            datos.cct, datos.num_docentes, datos.plan_interes, datos.mensaje,
        )
    logger.info("Nueva solicitud de contacto (%s, %s).", datos.tipo_escuela, datos.plan_interes)
    return respuesta
