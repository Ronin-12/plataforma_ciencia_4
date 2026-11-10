"""Generación y guardado de juegos educativos con Gemini."""

import json
import logging
import re
from typing import Literal

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types
from google.genai.errors import APIError
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.core.config import settings
from app.core.deps import docente_actual, usuario_actual
from app.core.limites import LimitadorVentana, exigir
from app.core.security import ROL_ALUMNO, ROL_DOCENTE
from app.db.session import get_db_pool


router = APIRouter(prefix="/ia", tags=["Inteligencia Artificial"])

# Los avisos salen en la misma terminal donde corre uvicorn.
logger = logging.getLogger("uvicorn.error")

# Errores de un modelo ante los que se prueba el siguiente de la lista:
# 403 (sin permiso para ese modelo), 404 (no existe), 429 (cuota) y errores temporales del servidor.
CODIGOS_CON_RESPALDO = (403, 404, 429, 500, 502, 503, 504)

# Tope de juegos por docente y hora: protege el costo de la API si alguien roba una sesión.
_limite_generacion = LimitadorVentana(maximo=settings.IA_MAX_JUEGOS_POR_HORA, ventana_segundos=3600)


class PromptJuego(BaseModel):
    texto_prompt: str = Field(min_length=5, max_length=2000)
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


class JuegoInvalido(Exception):
    """La IA respondió, pero el juego no cumple el formato. El texto explica por qué."""


# Máximo de parejas por tipo: si la IA manda de más, se descarta el excedente.
_MAX_PARES = {"relacionar": 5, "memoria": 6}


def _resumir_errores(exc: ValidationError) -> str:
    partes = []
    for error in exc.errors()[:4]:
        ruta = ".".join(str(parte) for parte in error["loc"]) or "juego"
        partes.append(f"{ruta}: {str(error['msg'])[:160]}")
    return "; ".join(partes)


def _interpretar_juego(texto: str, tipo_solicitado: str) -> dict:
    """Convierte la respuesta de la IA en un juego válido o lanza JuegoInvalido con el motivo."""
    limpio = texto.strip()
    if limpio.startswith("```"):  # a veces envuelve el JSON en un bloque de código
        limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", limpio, flags=re.IGNORECASE).strip()
    try:
        crudo = json.loads(limpio)
    except json.JSONDecodeError as exc:
        raise JuegoInvalido(f"la respuesta no es JSON válido ({exc.msg})") from exc
    if not isinstance(crudo, dict):
        raise JuegoInvalido("la respuesta no es un objeto JSON")

    # Recortes seguros: si sobran retos o parejas, se descartan los últimos.
    preguntas = crudo.get("preguntas")
    if isinstance(preguntas, list):
        crudo["preguntas"] = preguntas[:5]
        tope = _MAX_PARES.get(crudo.get("tipo_actividad"))
        if tope:
            for pregunta in crudo["preguntas"]:
                if isinstance(pregunta, dict) and isinstance(pregunta.get("pares"), list):
                    pregunta["pares"] = pregunta["pares"][:tope]

    try:
        juego = JuegoGenerado.model_validate(crudo)
    except ValidationError as exc:
        raise JuegoInvalido(_resumir_errores(exc)) from exc
    if tipo_solicitado != "sorpresa" and juego.tipo_actividad != tipo_solicitado:
        raise JuegoInvalido(f"generó '{juego.tipo_actividad}' y se pidió '{tipo_solicitado}'")
    return juego.model_dump()


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
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> dict:
    """Genera un juego JSON para el docente con sesión, prueba modelos alternativos y lo guarda."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Falta configurar GEMINI_API_KEY en backend/.env.")
    exigir(
        _limite_generacion,
        str(docente["id"]),
        "Llegaste al límite de juegos por hora. Inténtalo más tarde.",
    )

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
    errores_modelo: list[APIError] = []
    invalidos: list[str] = []

    modelos = _modelos_disponibles()
    if not modelos:
        raise HTTPException(status_code=503, detail="No hay modelos Gemini configurados.")

    for modelo in modelos:
        contenido = instruccion
        for intento in (1, 2):
            try:
                response = await client.aio.models.generate_content(
                    model=modelo,
                    contents=contenido,
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
                if not response.text:
                    raise JuegoInvalido("la respuesta llegó vacía")
                juego = _interpretar_juego(response.text, datos.tipo_actividad)
                break
            except JuegoInvalido as exc:
                # Se reintenta una vez diciéndole a la IA qué falló; si vuelve a fallar, otro modelo.
                invalidos.append(str(exc))
                logger.warning("Juego inválido de %s (intento %d): %s", modelo, intento, exc)
                contenido = (
                    instruccion
                    + f"\n\nTu respuesta anterior no cumplió el formato: {exc}. "
                    "Corrígelo y devuelve únicamente el JSON válido."
                )
            except APIError as exc:
                if exc.code not in CODIGOS_CON_RESPALDO:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Gemini rechazó la solicitud (código {exc.code}).",
                    ) from exc
                logger.warning("Gemini %s respondió %s: se prueba el siguiente modelo", modelo, exc.code)
                errores_modelo.append(exc)
                break  # este modelo no sirve ahora: pasa al siguiente
        if juego is not None:
            break

    if juego is None:
        if invalidos:
            raise HTTPException(
                status_code=502,
                detail=(
                    "La IA no logró crear un juego válido tras varios intentos. Inténtalo de nuevo; "
                    "si sigue igual, elige un tipo concreto, como Quiz, en lugar de «Sorpréndeme»."
                ),
            )
        if errores_modelo and all(error.code == 403 for error in errores_modelo):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Google rechazó la clave o el proyecto (403). Revisa GEMINI_API_KEY en backend/.env "
                    "o crea una clave nueva en aistudio.google.com/apikey."
                ),
            ) from errores_modelo[-1]
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
                docente["id"],
                datos.texto_prompt,
                json.dumps(juego, ensure_ascii=False),
            )
    except asyncpg.PostgresError as exc:
        raise HTTPException(
            status_code=500,
            detail="El juego se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
        ) from exc

    return {"id_juego": str(row["id_juego"]), "juego": juego}

@router.get("/juegos")
async def obtener_juegos(
    usuario: dict = Depends(usuario_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Juegos disponibles para quien tiene sesión: el docente ve los suyos y el alumno ve los de
    su docente. El docente se toma del token, nunca de la dirección.
    """
    if usuario["rol"] == ROL_DOCENTE:
        id_docente = usuario["id"]
    elif usuario["rol"] == ROL_ALUMNO:
        id_docente = usuario["id_docente"]
    else:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")

    query = """
        SELECT id_juego, prompt_original, contenido_juego, fecha_creacion
        FROM juegos_generados
        WHERE id_docente = $1
        ORDER BY fecha_creacion DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, id_docente)

    juegos = []
    for row in rows:
        juego = dict(row)
        if usuario["rol"] == ROL_ALUMNO:
            juego.pop("prompt_original", None)  # el alumno no necesita ver lo que pidió el docente
        juegos.append(juego)
    return {"juegos": juegos}
