"""Proveedor real: Google Gemini."""

from google import genai
from google.genai import types
from google.genai.errors import APIError

from app.core.config import settings
from app.ia.base import ErrorProveedor, ProveedorIA, Solicitud

# Errores de un modelo ante los que se prueba el siguiente de la lista:
# 403 (sin permiso para ese modelo), 404 (no existe), 429 (cuota) y errores temporales del servidor.
CODIGOS_CON_RESPALDO = (403, 404, 429, 500, 502, 503, 504)


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

    async def generar_json(self, solicitud: Solicitud, modelo: str) -> str:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        if solicitud.archivos:
            # Primero los archivos y al final la instrucción, como espera Gemini.
            contenido = [types.Part.from_bytes(data=datos, mime_type=mime) for datos, mime in solicitud.archivos]
            contenido.append(solicitud.instruccion)
        else:
            contenido = solicitud.instruccion
        try:
            respuesta = await client.aio.models.generate_content(
                model=modelo,
                contents=contenido,
                config=types.GenerateContentConfig(response_mime_type="application/json", max_output_tokens=solicitud.max_tokens),
            )
        except APIError as exc:
            raise ErrorProveedor(exc.code, exc.code in CODIGOS_CON_RESPALDO) from exc
        return respuesta.text or ""
