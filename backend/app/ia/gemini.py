"""Proveedor real: Google Gemini."""

import asyncio
import logging
import time

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.ia.base import ErrorProveedor, ProveedorIA, Solicitud

logger = logging.getLogger("uvicorn.error")

# Errores de un modelo ante los que se prueba el siguiente de la lista:
# 403 (sin permiso para ese modelo), 404 (no existe), 429 (cuota) y errores temporales del servidor.
# 504 incluye el caso en que NOSOTROS cortamos la espera (ver IA_TIMEOUT_SEGUNDOS).
CODIGOS_CON_RESPALDO = (403, 404, 429, 500, 502, 503, 504)

# Tokens que se le permite "pensar" al modelo según GEMINI_PENSAMIENTO. None = no se toca (decide Google).
_PENSAMIENTO = {"nada": 0, "bajo": 512, "medio": 2048, "alto": 8192, "auto": None}

# Un solo cliente para toda la aplicación: crear uno en cada llamada repite la conexión segura (TLS).
# La clase forma parte de la llave solo para que las pruebas puedan sustituirla por un cliente falso.
_clientes: dict[tuple, "genai.Client"] = {}

# Modelos que respondieron que no aceptan la configuración de pensamiento: ya no se les envía.
_sin_pensamiento: set[str] = set()


def _cliente() -> "genai.Client":
    llave = (settings.GEMINI_API_KEY, genai.Client)
    if llave not in _clientes:
        _clientes.clear()
        _clientes[llave] = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _clientes[llave]


def _configuracion(solicitud: Solicitud, modelo: str, con_pensamiento: bool) -> types.GenerateContentConfig:
    datos: dict = {"response_mime_type": "application/json", "max_output_tokens": solicitud.max_tokens}
    presupuesto = _PENSAMIENTO.get(settings.GEMINI_PENSAMIENTO.strip().lower())
    if con_pensamiento and presupuesto is not None and modelo not in _sin_pensamiento:
        datos["thinking_config"] = types.ThinkingConfig(thinking_budget=presupuesto)
    return types.GenerateContentConfig(**datos)


class ProveedorGemini(ProveedorIA):
    nombre = "Gemini"

    def problema_de_configuracion(self) -> str | None:
        if not settings.GEMINI_API_KEY:
            return "Falta configurar GEMINI_API_KEY en backend/.env."
        return None

    def modelos(self) -> list[str]:
        """Los modelos configurados, sin repetidos, en orden de preferencia."""
        candidatos = [settings.GEMINI_MODEL, settings.GEMINI_FALLBACK_MODEL, settings.GEMINI_LAST_RESORT_MODEL]
        return list(dict.fromkeys(m.strip() for m in candidatos if m.strip()))

    async def _llamar(self, contenido, solicitud: Solicitud, modelo: str, con_pensamiento: bool):
        espera = settings.IA_TIMEOUT_ARCHIVOS_SEGUNDOS if solicitud.archivos else settings.IA_TIMEOUT_SEGUNDOS
        try:
            return await asyncio.wait_for(
                _cliente().aio.models.generate_content(
                    model=modelo, contents=contenido, config=_configuracion(solicitud, modelo, con_pensamiento)
                ),
                timeout=espera,
            )
        except asyncio.TimeoutError as exc:
            # Un modelo que no contesta a tiempo se trata como uno saturado: se pasa al siguiente.
            logger.warning("Gemini %s no respondió en %d s; se prueba otro modelo.", modelo, espera)
            raise ErrorProveedor(504, True) from exc

    async def generar_json(self, solicitud: Solicitud, modelo: str) -> str:
        if solicitud.archivos:
            # Primero los archivos y al final la instrucción, como espera Gemini.
            contenido = [types.Part.from_bytes(data=datos, mime_type=mime) for datos, mime in solicitud.archivos]
            contenido.append(solicitud.instruccion)
        else:
            contenido = solicitud.instruccion
        inicio = time.perf_counter()
        try:
            try:
                respuesta = await self._llamar(contenido, solicitud, modelo, con_pensamiento=True)
            except APIError as exc:
                # Algunos modelos no aceptan limitar el pensamiento: se reintenta sin esa opción y se recuerda.
                if exc.code != 400 or "thinking" not in str(exc).lower() or modelo in _sin_pensamiento:
                    raise
                logger.warning("Gemini %s no acepta la opción de pensamiento; se usará sin ella.", modelo)
                _sin_pensamiento.add(modelo)
                respuesta = await self._llamar(contenido, solicitud, modelo, con_pensamiento=False)
        except APIError as exc:
            raise ErrorProveedor(exc.code, exc.code in CODIGOS_CON_RESPALDO) from exc
        milisegundos = int((time.perf_counter() - inicio) * 1000)
        uso = getattr(respuesta, "usage_metadata", None)
        entrada = salida = 0
        if uso is not None:
            # La salida incluye los tokens de "pensamiento": Google también los cobra como salida.
            salida = (getattr(uso, "candidates_token_count", 0) or 0) + (getattr(uso, "thoughts_token_count", 0) or 0)
            entrada = getattr(uso, "prompt_token_count", 0) or 0
            self.anotar_consumo(modelo, entrada, salida, milisegundos)
        logger.info("IA %s: %s respondió en %.1f s (entrada %d, salida %d tokens).", solicitud.tarea, modelo, milisegundos / 1000, entrada, salida)
        return respuesta.text or ""
