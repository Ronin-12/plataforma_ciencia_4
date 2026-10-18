"""Generación y guardado de juegos educativos con Gemini."""

import json
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from pydantic import BaseModel, Field, ValidationError

from app.core.config import settings
from app.db.session import get_db_pool


router = APIRouter(prefix="/ia", tags=["Inteligencia Artificial"])


class PromptJuego(BaseModel):
    texto_prompt: str = Field(min_length=5, max_length=2000)
    id_docente: uuid.UUID


class PreguntaGenerada(BaseModel):
    pregunta: str = Field(min_length=1)
    opciones: list[str] = Field(min_length=4, max_length=4)
    correcta: int = Field(ge=0, le=3)


class JuegoGenerado(BaseModel):
    titulo: str = Field(min_length=1)
    instrucciones: str = Field(min_length=1)
    preguntas: list[PreguntaGenerada] = Field(min_length=3, max_length=3)


def _modelos_disponibles() -> list[str]:
    """Devuelve los modelos configurados, sin repetidos, en orden de preferencia."""
    modelos = [
        settings.GEMINI_MODEL,
        settings.GEMINI_FALLBACK_MODEL,
        settings.GEMINI_LAST_RESORT_MODEL,
    ]
    return list(dict.fromkeys(modelo.strip() for modelo in modelos if modelo.strip()))


@router.post("/generar-juego")
async def generar_juego_con_ia(
    datos: PromptJuego,
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> dict:
    """Genera un juego JSON, prueba modelos alternativos y guarda el resultado."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Falta configurar GEMINI_API_KEY en backend/.env.")

    instruccion = f"""
Eres un experto en juegos educativos para niños de 4.º grado.
Solicitud del docente: {datos.texto_prompt!r}

Devuelve un objeto JSON con esta estructura exacta:
{{
  "titulo": "Nombre del juego",
  "instrucciones": "Qué debe hacer el niño",
  "preguntas": [
    {{
      "pregunta": "¿Pregunta?",
      "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correcta": 0
    }}
  ]
}}

Reglas: incluye exactamente 3 preguntas, cada una con 4 opciones; "correcta"
debe ser el índice entero de la opción correcta (0 a 3). Devuelve solo el JSON.
"""

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    juego: dict | None = None
    errores_modelo: list[ServerError] = []

    modelos = _modelos_disponibles()
    if not modelos:
        raise HTTPException(status_code=503, detail="No hay modelos Gemini configurados.")

    for modelo in modelos:
        try:
            response = await client.aio.models.generate_content(
                model=modelo,
                contents=instruccion,
                config=types.GenerateContentConfig(response_mime_type="application/json"),
            )
            if not response.text:
                raise HTTPException(status_code=502, detail="Gemini devolvió una respuesta vacía.")
            juego = JuegoGenerado.model_validate_json(response.text).model_dump()
            break
        except ValidationError as exc:
            raise HTTPException(
                status_code=502,
                detail="Gemini respondió, pero el juego no cumple el formato requerido.",
            ) from exc
        except ServerError as exc:
            if exc.code not in (404, 429, 503):
                raise HTTPException(
                    status_code=502,
                    detail=f"Gemini rechazó la solicitud (código {exc.code}).",
                ) from exc
            errores_modelo.append(exc)
        except json.JSONDecodeError as exc:
            raise HTTPException(
                status_code=502,
                detail="Gemini respondió con un formato distinto al JSON esperado.",
            ) from exc

    if juego is None:
        if errores_modelo and all(error.code == 404 for error in errores_modelo):
            raise HTTPException(
                status_code=502,
                detail="Ninguno de los modelos configurados está disponible para esta clave de Gemini.",
            ) from errores_modelo[-1]
        if not errores_modelo:
            raise HTTPException(status_code=502, detail="No fue posible generar el juego.")
        raise HTTPException(
            status_code=503,
            detail="Gemini está temporalmente saturado. Espera un minuto e inténtalo de nuevo.",
        ) from errores_modelo[-1]

    query = """
        INSERT INTO juegos_generados (id_docente, prompt_original, contenido_juego)
        VALUES ($1, $2, $3::jsonb)
        RETURNING id_juego
    """

    try:
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                query,
                datos.id_docente,
                datos.texto_prompt,
                json.dumps(juego, ensure_ascii=False),
            )
    except asyncpg.PostgresError as exc:
        raise HTTPException(
            status_code=500,
            detail="El juego se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
        ) from exc

    return {"id_juego": str(row["id_juego"]), "juego": juego}
