"""Generación y guardado de juegos educativos con Gemini."""

import json
import uuid
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types
from google.genai.errors import ServerError
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.core.config import settings
from app.db.session import get_db_pool


router = APIRouter(prefix="/ia", tags=["Inteligencia Artificial"])


class PromptJuego(BaseModel):
    texto_prompt: str = Field(min_length=5, max_length=2000)
    id_docente: uuid.UUID
    tipo_actividad: Literal[
        "sorpresa",
        "quiz",
        "verdadero_falso",
        "ordenar",
        "relacionar",
        "memoria",
        "completar",
    ] = "sorpresa"


TipoActividad = Literal[
    "quiz",
    "verdadero_falso",
    "ordenar",
    "relacionar",
    "memoria",
    "completar",
]


class PreguntaQuiz(BaseModel):
    pregunta: str = Field(min_length=1)
    opciones: list[str] = Field(min_length=4, max_length=4)
    correcta: int = Field(ge=0, le=3)


class PreguntaVerdaderoFalso(BaseModel):
    afirmacion: str = Field(min_length=1)
    correcta: bool
    explicacion: str = Field(min_length=1)


class PreguntaOrdenar(BaseModel):
    consigna: str = Field(min_length=1)
    elementos: list[str] = Field(min_length=4, max_length=6)
    orden_correcto: list[str] = Field(min_length=4, max_length=6)


class ParRelacion(BaseModel):
    izquierda: str = Field(min_length=1)
    derecha: str = Field(min_length=1)


class PreguntaRelacionar(BaseModel):
    consigna: str = Field(min_length=1)
    pares: list[ParRelacion] = Field(min_length=3, max_length=5)


class PreguntaMemoria(BaseModel):
    consigna: str = Field(min_length=1)
    pares: list[ParRelacion] = Field(min_length=3, max_length=6)


class PreguntaCompletar(BaseModel):
    frase: str = Field(min_length=1)
    respuesta: str = Field(min_length=1)
    pista: str = Field(min_length=1)


class JuegoGenerado(BaseModel):
    titulo: str = Field(min_length=1)
    instrucciones: str = Field(min_length=1)
    tipo_actividad: TipoActividad
    preguntas: list[dict] = Field(min_length=3, max_length=5)

    @model_validator(mode="after")
    def validar_preguntas_por_tipo(self):
        modelos = {
            "quiz": PreguntaQuiz,
            "verdadero_falso": PreguntaVerdaderoFalso,
            "ordenar": PreguntaOrdenar,
            "relacionar": PreguntaRelacionar,
            "memoria": PreguntaMemoria,
            "completar": PreguntaCompletar,
        }
        modelo = modelos[self.tipo_actividad]
        for pregunta in self.preguntas:
            item = modelo.model_validate(pregunta)
            if self.tipo_actividad == "ordenar":
                if sorted(item.elementos) != sorted(item.orden_correcto):
                    raise ValueError("Los pasos y el orden correcto deben contener los mismos elementos.")
            if self.tipo_actividad in {"relacionar", "memoria"}:
                lados_izquierdos = [par.izquierda for par in item.pares]
                lados_derechos = [par.derecha for par in item.pares]
                if len(set(lados_izquierdos)) != len(lados_izquierdos) or len(set(lados_derechos)) != len(lados_derechos):
                    raise ValueError("Los pares deben ser únicos para evitar respuestas ambiguas.")
            if self.tipo_actividad == "completar" and "___" not in item.frase and "____" not in item.frase:
                raise ValueError("La frase debe contener el espacio vacío representado con guiones bajos.")
        return self


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

    descripciones = {
        "quiz": "quiz: cada pregunta usa {\"pregunta\": texto, \"opciones\": [4 textos], \"correcta\": índice 0-3}.",
        "verdadero_falso": "verdadero_falso: cada pregunta usa {\"afirmacion\": texto, \"correcta\": true/false, \"explicacion\": texto breve}.",
        "ordenar": "ordenar: cada pregunta usa {\"consigna\": texto, \"elementos\": [4-6 pasos en desorden], \"orden_correcto\": [los mismos textos en orden] }.",
        "relacionar": "relacionar: cada pregunta usa {\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su relación}] } con 3-5 parejas.",
        "memoria": "memoria: cada pregunta usa {\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su pareja}] } con 3-6 parejas.",
        "completar": "completar: cada pregunta usa {\"frase\": texto con un espacio marcado ___, \"respuesta\": palabra/frase esperada, \"pista\": ayuda breve}.",
    }
    formatos = "\n".join(f"- {nombre}: {descripcion}" for nombre, descripcion in descripciones.items())
    tipo_solicitado = datos.tipo_actividad
    instruccion = f"""
Eres un diseñador pedagógico y creador de juegos para niñas y niños de 9 años (4.º grado).
Tema o idea del docente: {datos.texto_prompt!r}
Formato solicitado: {tipo_solicitado!r}.

Elige EXACTAMENTE un tipo de actividad de esta lista:
{formatos}

Devuelve únicamente un JSON con esta estructura:
{{
  "titulo": "Título corto y divertido",
  "instrucciones": "Una regla clara, amable y breve para el niño",
  "tipo_actividad": "uno de los tipos anteriores",
  "preguntas": [3 o 4 retos con el formato del tipo seleccionado]
}}

Si el formato solicitado es "sorpresa", elige el tipo que mejor enseñe el tema y evita quiz si ordenar, relacionar, memoria o completar tienen más sentido.
Si el docente pidió un tipo concreto, usa exactamente ese tipo: {tipo_solicitado!r}.
Usa vocabulario sencillo, una sola idea por reto, contenido correcto y adecuado a la edad.
Para ordenar, mezcla los elementos y conserva una lista orden_correcto con los mismos textos en la secuencia correcta.
Para relacionar y memoria, evita parejas duplicadas o ambiguas.
Para completar, incluye ___ exactamente donde va la respuesta. Devuelve de 3 a 5 retos. No agregues markdown.
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
            juego_validado = JuegoGenerado.model_validate_json(response.text)
            if datos.tipo_actividad != "sorpresa" and juego_validado.tipo_actividad != datos.tipo_actividad:
                raise HTTPException(
                    status_code=502,
                    detail="La IA generó un formato distinto al que seleccionaste. Intenta generarlo otra vez.",
                )
            juego = juego_validado.model_dump()
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

@router.get("/juegos/{id_docente}")
async def obtener_juegos_docente(id_docente: str, pool: asyncpg.Pool = Depends(get_db_pool)):
    """
    Devuelve todos los juegos generados por un docente específico.
    """
    query = """
        SELECT id_juego, prompt_original, contenido_juego, fecha_creacion
        FROM juegos_generados
        WHERE id_docente = $1
        ORDER BY fecha_creacion DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, uuid.UUID(id_docente))
        
    # Convertimos el resultado a una lista de diccionarios
    juegos = [dict(row) for row in rows]
    return {"juegos": juegos}
