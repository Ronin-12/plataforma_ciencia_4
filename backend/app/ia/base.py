"""Contrato común de los proveedores de IA (RNF-08: poder cambiar de proveedor).

El resto de la aplicación (rutas, validación de juegos, créditos) solo conoce esta interfaz.
Para añadir otro proveedor (OpenAI, un modelo local...) basta con crear una clase que la
cumpla y registrarla en `app/ia/__init__.py`; no hay que tocar las rutas.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal

Tarea = Literal["juego", "clase", "temas"]


@dataclass
class Solicitud:
    """Lo que la aplicación le pide a la IA."""

    instruccion: str
    tarea: Tarea
    max_tokens: int = 4096
    # Datos que solo usa el modo demo para elegir una respuesta de ejemplo; Gemini los ignora.
    tipo: str | None = None
    tema: str | None = None
    # Archivos (bytes, tipo MIME) que la IA debe leer, por ejemplo un PDF del docente.
    archivos: list[tuple[bytes, str]] = field(default_factory=list)


class ErrorProveedor(Exception):
    """Fallo al hablar con el proveedor.

    codigo: código HTTP/estado del proveedor, si lo hay (403, 429, 503...).
    con_respaldo: True si conviene probar con otro modelo (error temporal o de ese modelo).
    """

    def __init__(self, codigo: int | None, con_respaldo: bool):
        super().__init__(f"error del proveedor ({codigo})")
        self.codigo = codigo
        self.con_respaldo = con_respaldo


class ProveedorIA(ABC):
    nombre: str = "IA"
    # Si es False, usar este proveedor no gasta créditos del plan mensual (p. ej. el modo demo).
    consume_creditos: bool = True

    @abstractmethod
    def problema_de_configuracion(self) -> str | None:
        """Texto que explica qué falta configurar, o None si está listo para usarse."""

    @abstractmethod
    def modelos(self) -> list[str]:
        """Variantes a probar, en orden de preferencia (si una falla, se pasa a la siguiente)."""

    @abstractmethod
    async def generar_json(self, solicitud: Solicitud, modelo: str) -> str:
        """Devuelve el texto de la respuesta (se espera JSON). Lanza ErrorProveedor si falla."""
