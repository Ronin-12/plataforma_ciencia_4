"""Generación y guardado de juegos educativos con Gemini."""

import json
import logging
import re
import uuid
from contextlib import asynccontextmanager
from datetime import date
from typing import Literal

import asyncpg
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File
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

async def _reservar_credito(pool: asyncpg.Pool, id_docente: uuid.UUID) -> int:
    """Cuenta atómicamente una solicitud de IA dentro del límite mensual del plan."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO ia_generaciones_mes (id_docente, periodo, generaciones)
            VALUES ($1, $2, 1)
            ON CONFLICT (id_docente, periodo) DO UPDATE
            SET generaciones = ia_generaciones_mes.generaciones + 1
            WHERE ia_generaciones_mes.generaciones < $3
            RETURNING generaciones
            """,
            id_docente, date.today().replace(day=1), settings.IA_GENERACIONES_MENSUALES_MAX,
        )
    if row is None:
        raise HTTPException(status_code=429, detail=f"Alcanzaste el límite mensual de {settings.IA_GENERACIONES_MENSUALES_MAX} créditos de IA.")
    return row["generaciones"]


async def _devolver_credito(pool: asyncpg.Pool, id_docente: uuid.UUID) -> None:
    """Devuelve el crédito cuando la IA no entregó nada: el docente no paga por un fallo."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE ia_generaciones_mes SET generaciones = GREATEST(generaciones - 1, 0)
             WHERE id_docente = $1 AND periodo = $2
            """,
            id_docente, date.today().replace(day=1),
        )


@asynccontextmanager
async def _credito_ia(pool: asyncpg.Pool, id_docente: uuid.UUID):
    """Reserva un crédito y lo devuelve si lo de adentro termina en error (de cualquier tipo)."""
    usadas = await _reservar_credito(pool, id_docente)
    try:
        yield usadas
    except BaseException:
        await _devolver_credito(pool, id_docente)
        raise


class SesionCreate(BaseModel):
    titulo: str = Field(min_length=2, max_length=160)
    tema: str = Field(min_length=2, max_length=240)
    material_nombre: str | None = Field(default=None, max_length=255)
    contexto: str = Field(default="", max_length=16000)


@router.get("/uso")
async def obtener_uso_ia(docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Créditos de IA del docente con sesión (el docente sale del token, nunca del cliente)."""
    async with pool.acquire() as conn:
        usadas = await conn.fetchval(
            "SELECT generaciones FROM ia_generaciones_mes WHERE id_docente=$1 AND periodo=$2",
            docente["id"], date.today().replace(day=1),
        ) or 0
    limite = settings.IA_GENERACIONES_MENSUALES_MAX
    return {"limite": limite, "usadas": usadas, "disponibles": max(0, limite - usadas), "unidad": "créditos de IA"}


def _leer_temas(texto: str) -> list[dict]:
    """Extrae la lista de temas de la respuesta de la IA, o lanza ValueError con el motivo.

    Acepta el JSON suelto, envuelto en un bloque ```json o como lista directa, y descarta
    los elementos que no traen título.
    """
    limpio = (texto or "").strip()
    if limpio.startswith("```"):
        limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", limpio, flags=re.IGNORECASE).strip()
    try:
        datos = json.loads(limpio)
    except json.JSONDecodeError as exc:
        raise ValueError(f"no es JSON válido (¿respuesta cortada?): {exc}") from exc
    lista = datos.get("temas") if isinstance(datos, dict) else datos
    if not isinstance(lista, list):
        raise ValueError("no trae una lista de temas")
    temas = [
        {
            "titulo": str(t["titulo"]).strip()[:240],
            "descripcion": str(t.get("descripcion", "")).strip()[:600],
            # Puntos clave fieles al material: con ellos se arma después la clase interactiva.
            "contenido": str(t.get("contenido", "")).strip()[:2500],
        }
        for t in lista
        if isinstance(t, dict) and str(t.get("titulo", "")).strip()
    ]
    return temas


MAX_BYTES_MATERIAL = 20 * 1024 * 1024  # total por análisis


def _tipo_real(contenido: bytes) -> str | None:
    """Tipo del archivo según sus primeros bytes. No se confía en la extensión ni en el tipo declarado."""
    if contenido.startswith(b"%PDF-"):
        return "application/pdf"
    if contenido.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if contenido.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp"
    return None


@router.post("/materiales/analizar")
async def analizar_materiales(
    archivos: list[UploadFile] = File(...),
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Analiza PDF o imágenes para sugerir temas de Ciencias Naturales de cuarto grado."""
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Falta configurar GEMINI_API_KEY en backend/.env.")
    if not archivos or len(archivos) > 10:
        raise HTTPException(status_code=400, detail="Selecciona entre 1 y 10 archivos.")
    partes, nombres = [], []
    total_bytes = 0
    for archivo in archivos:
        nombre = (archivo.filename or "material").replace("\\", "/").split("/")[-1][:255]
        # Se lee solo hasta el tope restante: un archivo enorme nunca se carga completo en memoria.
        restante = MAX_BYTES_MATERIAL - total_bytes
        contenido = await archivo.read(restante + 1)
        if len(contenido) > restante:
            raise HTTPException(status_code=413, detail="El conjunto de archivos supera 20 MB.")
        total_bytes += len(contenido)
        tipo = _tipo_real(contenido)
        if tipo is None:
            raise HTTPException(status_code=415, detail=f"{nombre}: usa PDF, JPG, PNG o WebP.")
        partes.append(types.Part.from_bytes(data=contenido, mime_type=tipo))
        nombres.append(nombre)
    partes.append(
        "Analiza estos materiales para una clase de Ciencias Naturales de 4.º de primaria. "
        "Devuelve solo JSON con {\"temas\":[{\"titulo\":\"tema concreto\",\"descripcion\":\"resumen didáctico breve\","
        "\"contenido\":\"los datos, definiciones y ejemplos importantes del material sobre ese tema, en 5 a 10 oraciones sencillas\"}]}. "
        "Propón entre 1 y 8 temas basados solo en el material. No inventes datos que no estén en el material "
        "y no incluyas nombres de personas."
    )
    async with _credito_ia(pool, docente["id"]) as credito:
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        temas: list[dict] = []
        for modelo in _modelos_disponibles():
            try:
                respuesta = await client.aio.models.generate_content(
                    model=modelo, contents=partes,
                    config=types.GenerateContentConfig(response_mime_type="application/json", max_output_tokens=4096),
                )
            except APIError as exc:
                if exc.code not in CODIGOS_CON_RESPALDO:
                    raise HTTPException(status_code=502, detail=f"Gemini rechazó el análisis (código {exc.code}).") from exc
                logger.warning("Análisis de material: %s respondió %s; se prueba otro modelo.", modelo, exc.code)
                continue
            try:
                temas = _leer_temas(respuesta.text)
            except ValueError as exc:
                logger.warning("Análisis de material: respuesta inválida de %s: %s", modelo, exc)
                continue
            if temas:
                break
        if not temas:
            raise HTTPException(
                status_code=502,
                detail="La IA no logró leer el material esta vez. Inténtalo de nuevo o prueba con menos páginas.",
            )
    contexto = "\n".join(f"{item.get('titulo', '')}: {item.get('descripcion', '')}" for item in temas)[:16000]
    temas = temas[:8]
    limite = settings.IA_GENERACIONES_MENSUALES_MAX
    return {"archivos": nombres, "temas": temas[:8], "contexto": contexto, "uso": {"limite": limite, "usadas": credito, "disponibles": max(0, limite - credito)}}


@router.get("/sesiones")
async def obtener_sesiones(docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id_sesion,titulo,tema,material_nombre,fecha_creacion FROM sesiones_docente WHERE id_docente=$1 ORDER BY fecha_creacion DESC", docente["id"])
    return {"sesiones": [dict(row) for row in rows]}


@router.post("/sesiones", status_code=201)
async def crear_sesion(datos: SesionCreate, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO sesiones_docente (id_docente,titulo,tema,material_nombre,contexto) VALUES ($1,$2,$3,$4,$5) RETURNING id_sesion,titulo,tema,material_nombre,fecha_creacion",
            docente["id"], datos.titulo.strip(), datos.tema.strip(), datos.material_nombre, datos.contexto,
        )
    return dict(row)

# Tope de juegos por docente y hora: protege el costo de la API si alguien roba una sesión.
_limite_generacion = LimitadorVentana(maximo=settings.IA_MAX_JUEGOS_POR_HORA, ventana_segundos=3600)


class PromptJuego(BaseModel):
    texto_prompt: str = Field(min_length=5, max_length=2000)
    id_sesion: uuid.UUID | None = None
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


class SeccionClase(BaseModel):
    titulo: str = Field(min_length=1, max_length=160)
    explicacion: str = Field(min_length=1, max_length=900)
    ejemplo: str = Field(min_length=1, max_length=500)
    # Mini-reto sin calificación: {"tipo": "quiz" | "verdadero_falso", ...campos de ese tipo}.
    mini_reto: dict

    @model_validator(mode="after")
    def validar_mini_reto(self):
        tipo = self.mini_reto.get("tipo")
        modelo = {"quiz": PreguntaQuiz, "verdadero_falso": PreguntaVerdaderoFalso}.get(tipo)
        if modelo is None:
            raise ValueError("El mini-reto debe ser de tipo quiz o verdadero_falso.")
        modelo.model_validate(self.mini_reto)
        return self


class ClaseGenerada(BaseModel):
    """Clase interactiva: secciones con mini-retos y una evaluación final (un juego normal)."""

    titulo: str = Field(min_length=1)
    instrucciones: str = Field(min_length=1)
    tipo_actividad: Literal["clase"]
    secciones: list[SeccionClase] = Field(min_length=3, max_length=5)
    evaluacion: JuegoGenerado


def validar_contenido(contenido: dict) -> dict:
    """Valida un juego o una clase guardados (según su tipo). Lanza ValidationError si no cumplen."""
    if isinstance(contenido, dict) and contenido.get("tipo_actividad") == "clase":
        return ClaseGenerada.model_validate(contenido).model_dump()
    return JuegoGenerado.model_validate(contenido).model_dump()


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


def _cargar_json(texto: str) -> dict:
    """Lee la respuesta de la IA como objeto JSON o lanza JuegoInvalido con el motivo."""
    limpio = texto.strip()
    if limpio.startswith("```"):  # a veces envuelve el JSON en un bloque de código
        limpio = re.sub(r"^```(?:json)?\s*|\s*```$", "", limpio, flags=re.IGNORECASE).strip()
    try:
        crudo = json.loads(limpio)
    except json.JSONDecodeError as exc:
        raise JuegoInvalido(f"la respuesta no es JSON válido ({exc.msg})") from exc
    if not isinstance(crudo, dict):
        raise JuegoInvalido("la respuesta no es un objeto JSON")
    return crudo


def _recortar_juego(crudo: dict) -> None:
    """Recortes seguros: si sobran retos o parejas, se descartan los últimos."""
    preguntas = crudo.get("preguntas")
    if isinstance(preguntas, list):
        crudo["preguntas"] = preguntas[:5]
        tope = _MAX_PARES.get(crudo.get("tipo_actividad"))
        if tope:
            for pregunta in crudo["preguntas"]:
                if isinstance(pregunta, dict) and isinstance(pregunta.get("pares"), list):
                    pregunta["pares"] = pregunta["pares"][:tope]


def _interpretar_juego(texto: str, tipo_solicitado: str) -> dict:
    """Convierte la respuesta de la IA en un juego válido o lanza JuegoInvalido con el motivo."""
    crudo = _cargar_json(texto)
    _recortar_juego(crudo)
    try:
        juego = JuegoGenerado.model_validate(crudo)
    except ValidationError as exc:
        raise JuegoInvalido(_resumir_errores(exc)) from exc
    if tipo_solicitado != "sorpresa" and juego.tipo_actividad != tipo_solicitado:
        raise JuegoInvalido(f"generó '{juego.tipo_actividad}' y se pidió '{tipo_solicitado}'")
    return juego.model_dump()


def _interpretar_clase(texto: str, tipo_evaluacion: str) -> dict:
    """Convierte la respuesta de la IA en una clase válida o lanza JuegoInvalido con el motivo."""
    crudo = _cargar_json(texto)
    crudo["tipo_actividad"] = "clase"
    if isinstance(crudo.get("secciones"), list):
        crudo["secciones"] = crudo["secciones"][:5]
    if isinstance(crudo.get("evaluacion"), dict):
        _recortar_juego(crudo["evaluacion"])
    try:
        clase = ClaseGenerada.model_validate(crudo)
    except ValidationError as exc:
        raise JuegoInvalido(_resumir_errores(exc)) from exc
    if clase.evaluacion.tipo_actividad != tipo_evaluacion:
        raise JuegoInvalido(f"la evaluación es '{clase.evaluacion.tipo_actividad}' y se pidió '{tipo_evaluacion}'")
    return clase.model_dump()


def _modelos_disponibles() -> list[str]:
    """Devuelve los modelos configurados, sin repetidos, en orden de preferencia."""
    modelos = [
        settings.GEMINI_MODEL,
        settings.GEMINI_FALLBACK_MODEL,
        settings.GEMINI_LAST_RESORT_MODEL,
    ]
    return list(dict.fromkeys(modelo.strip() for modelo in modelos if modelo.strip()))


async def _pedir_juego(instruccion: str, tipo_solicitado: str, interpretar=None, max_tokens: int = 4096) -> dict:
    """Pide el juego a Gemini (reintentos y respaldo entre modelos). Devuelve un juego válido o lanza HTTPException."""
    interpretar = interpretar or _interpretar_juego
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
                    config=types.GenerateContentConfig(response_mime_type="application/json", max_output_tokens=max_tokens),
                )
                if not response.text:
                    raise JuegoInvalido("la respuesta llegó vacía")
                juego = interpretar(response.text, tipo_solicitado)
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
    return juego


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
    prompt_original = datos.texto_prompt  # lo que escribió el docente, sin el material de la sesión
    contexto_sesion = ""
    if datos.id_sesion:
        async with pool.acquire() as conn:
            contexto_sesion = await conn.fetchval(
                "SELECT contexto FROM sesiones_docente WHERE id_sesion=$1 AND id_docente=$2",
                datos.id_sesion, docente["id"],
            )
        if contexto_sesion is None:
            raise HTTPException(status_code=404, detail="No se encontró la sesión seleccionada.")
    if contexto_sesion:
        datos.texto_prompt = f"{datos.texto_prompt}\n\nMaterial de referencia de la sesión:\n{contexto_sesion[:16000]}"

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

    async with _credito_ia(pool, docente["id"]) as credito:
        juego = await _pedir_juego(instruccion, datos.tipo_actividad)

        query = """
            INSERT INTO juegos_generados (id_docente, id_sesion, prompt_original, contenido_juego)
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING id_juego, estado
        """

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    query,
                    docente["id"],
                    datos.id_sesion,
                    prompt_original,
                    json.dumps(juego, ensure_ascii=False),
                )
        except asyncpg.PostgresError as exc:
            raise HTTPException(
                status_code=500,
                detail="El juego se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
            ) from exc

    limite = settings.IA_GENERACIONES_MENSUALES_MAX
    # El juego nace como borrador: los alumnos no lo ven hasta que el docente lo apruebe.
    return {"id_juego": str(row["id_juego"]), "estado": row["estado"], "juego": juego, "uso": {"limite": limite, "usadas": credito, "disponibles": max(0, limite - credito)}}

class PromptClase(BaseModel):
    id_sesion: uuid.UUID
    tipo_evaluacion: Literal["quiz", "verdadero_falso", "ordenar", "relacionar", "memoria", "completar"] = "quiz"
    indicaciones: str = Field(default="", max_length=500)


_FORMATOS_EVALUACION = {
    "quiz": "{\"pregunta\": texto, \"opciones\": [4 textos], \"correcta\": índice 0-3}",
    "verdadero_falso": "{\"afirmacion\": texto, \"correcta\": true/false, \"explicacion\": texto breve}",
    "ordenar": "{\"consigna\": texto, \"elementos\": [4-6 pasos en desorden], \"orden_correcto\": [los mismos textos en orden]}",
    "relacionar": "{\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su relación}]} con 3-5 parejas",
    "memoria": "{\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su pareja}]} con 3-6 parejas",
    "completar": "{\"frase\": texto con un espacio marcado ___, \"respuesta\": palabra esperada, \"pista\": ayuda breve}",
}


@router.post("/generar-clase")
async def generar_clase_con_ia(
    datos: PromptClase,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> dict:
    """
    Crea una clase interactiva a partir de una sesión (el material que subió el docente):
    secciones con mini-retos y una evaluación final. Queda en borrador hasta que se apruebe.
    """
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Falta configurar GEMINI_API_KEY en backend/.env.")
    exigir(_limite_generacion, str(docente["id"]), "Llegaste al límite de juegos por hora. Inténtalo más tarde.")
    async with pool.acquire() as conn:
        sesion = await conn.fetchrow(
            "SELECT titulo, tema, contexto FROM sesiones_docente WHERE id_sesion=$1 AND id_docente=$2",
            datos.id_sesion, docente["id"],
        )
    if sesion is None:
        raise HTTPException(status_code=404, detail="No se encontró la sesión seleccionada.")
    material = (sesion["contexto"] or "")[:16000]
    indicaciones = f"\nIndicaciones extra del docente: {datos.indicaciones!r}" if datos.indicaciones.strip() else ""
    tipo = datos.tipo_evaluacion
    instruccion = f"""
Eres un diseñador pedagógico. Crea una CLASE INTERACTIVA para niñas y niños de 9 años (4.º de primaria, Ciencias Naturales).
Tema: {sesion['tema']!r}.{indicaciones}
Usa SOLO los datos del siguiente material de la clase; no inventes hechos que no estén ahí y no incluyas nombres de personas:
---
{material}
---

Devuelve únicamente un JSON con esta estructura:
{{
  "titulo": "Título corto y atractivo de la clase",
  "instrucciones": "Una frase amable que le diga al niño cómo avanzar por la clase",
  "tipo_actividad": "clase",
  "secciones": [
    {{
      "titulo": "Nombre corto de esta parte",
      "explicacion": "2 a 4 oraciones sencillas (máximo 600 caracteres)",
      "ejemplo": "Un ejemplo cotidiano y concreto (máximo 300 caracteres)",
      "mini_reto": {{"tipo": "quiz", "pregunta": texto, "opciones": [4 textos], "correcta": índice 0-3}}
         o {{"tipo": "verdadero_falso", "afirmacion": texto, "correcta": true/false, "explicacion": texto breve}}
    }}
  ],
  "evaluacion": {{
    "titulo": "Título de la evaluación final",
    "instrucciones": "Una regla clara y breve",
    "tipo_actividad": "{tipo}",
    "preguntas": [4 retos con este formato: {_FORMATOS_EVALUACION[tipo]}]
  }}
}}

Haz de 3 a 4 secciones, cada una con una sola idea. La evaluación final debe comprobar lo que se enseñó en las secciones.
Vocabulario sencillo y contenido correcto. No agregues markdown.
"""
    async with _credito_ia(pool, docente["id"]) as credito:
        clase = await _pedir_juego(instruccion, tipo, interpretar=_interpretar_clase, max_tokens=8192)
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO juegos_generados (id_docente, id_sesion, prompt_original, contenido_juego)
                    VALUES ($1, $2, $3, $4::jsonb)
                    RETURNING id_juego, estado
                    """,
                    docente["id"], datos.id_sesion, f"Clase: {sesion['titulo']}"[:2000],
                    json.dumps(clase, ensure_ascii=False),
                )
        except asyncpg.PostgresError as exc:
            raise HTTPException(
                status_code=500,
                detail="La clase se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
            ) from exc
    limite = settings.IA_GENERACIONES_MENSUALES_MAX
    return {
        "id_juego": str(row["id_juego"]), "estado": row["estado"], "juego": clase,
        "uso": {"limite": limite, "usadas": credito, "disponibles": max(0, limite - credito)},
    }


EstadoJuego = Literal["borrador", "aprobado", "descartado"]


@router.get("/juegos")
async def obtener_juegos(
    estado: EstadoJuego | None = None,
    usuario: dict = Depends(usuario_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Juegos disponibles para quien tiene sesión. El docente ve los suyos (sin los descartados,
    salvo que pida `?estado=descartado`) y el alumno ve SOLO los juegos aprobados de su docente.
    El docente se toma del token, nunca de la dirección.
    """
    if usuario["rol"] == ROL_DOCENTE:
        id_docente = usuario["id"]
    elif usuario["rol"] == ROL_ALUMNO:
        id_docente = usuario["id_docente"]
        estado = "aprobado"  # un alumno nunca ve borradores ni descartados, pida lo que pida
    else:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")

    query = """
        SELECT id_juego, prompt_original, contenido_juego, fecha_creacion, estado, fecha_aprobacion
        FROM juegos_generados
        WHERE id_docente = $1
          AND (($2::text IS NULL AND estado <> 'descartado') OR estado = $2::text)
        ORDER BY fecha_creacion DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, id_docente, estado)

    juegos = []
    for row in rows:
        juego = dict(row)
        if usuario["rol"] == ROL_ALUMNO:
            # El alumno no necesita ver lo que pidió el docente ni el estado de revisión.
            for campo in ("prompt_original", "estado", "fecha_aprobacion"):
                juego.pop(campo, None)
        juegos.append(juego)
    return {"juegos": juegos}


class CambioEstado(BaseModel):
    estado: EstadoJuego


def _contenido_como_dict(valor) -> dict:
    """asyncpg devuelve el JSONB como texto: se convierte a diccionario."""
    return json.loads(valor) if isinstance(valor, str) else valor


@router.post("/juegos/{id_juego}/estado")
async def cambiar_estado_juego(
    id_juego: uuid.UUID,
    datos: CambioEstado,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Aprobar (lo ven los alumnos), volver a borrador (retirar) o descartar. Solo el docente
    dueño del juego; para aprobar, el contenido guardado debe seguir siendo un juego válido.
    """
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            "SELECT contenido_juego FROM juegos_generados WHERE id_juego = $1 AND id_docente = $2",
            id_juego, docente["id"],
        )
        if fila is None:
            raise HTTPException(status_code=404, detail="Ese juego no existe.")
        if datos.estado == "aprobado":
            try:
                validar_contenido(_contenido_como_dict(fila["contenido_juego"]))
            except ValidationError as exc:
                raise HTTPException(
                    status_code=422,
                    detail=f"El juego tiene errores y no se puede aprobar: {_resumir_errores(exc)}",
                ) from exc
        resultado = await conn.fetchrow(
            """
            UPDATE juegos_generados
               SET estado = $3::varchar,
                   fecha_aprobacion = CASE WHEN $3::varchar = 'aprobado' THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE id_juego = $1 AND id_docente = $2
            RETURNING id_juego, estado, fecha_aprobacion
            """,
            id_juego, docente["id"], datos.estado,
        )
    return {**dict(resultado), "id_juego": str(resultado["id_juego"])}


@router.put("/juegos/{id_juego}")
async def editar_juego(
    id_juego: uuid.UUID,
    contenido: dict = Body(...),
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """
    Guarda el juego corregido por el docente. Se valida igual que lo que genera la IA y no se
    puede cambiar su tipo. Un juego editado vuelve a borrador: hay que aprobarlo otra vez.
    """
    try:
        juego = validar_contenido(contenido)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=_resumir_errores(exc)) from exc
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            "SELECT contenido_juego, estado FROM juegos_generados WHERE id_juego = $1 AND id_docente = $2",
            id_juego, docente["id"],
        )
        if fila is None:
            raise HTTPException(status_code=404, detail="Ese juego no existe.")
        if fila["estado"] == "descartado":
            raise HTTPException(status_code=409, detail="Restaura el juego antes de editarlo.")
        tipo_actual = _contenido_como_dict(fila["contenido_juego"]).get("tipo_actividad")
        if tipo_actual and tipo_actual != juego["tipo_actividad"]:
            raise HTTPException(status_code=400, detail="No se puede cambiar el tipo de actividad de un juego.")
        resultado = await conn.fetchrow(
            """
            UPDATE juegos_generados
               SET contenido_juego = $3::jsonb, estado = 'borrador', fecha_aprobacion = NULL
             WHERE id_juego = $1 AND id_docente = $2
            RETURNING id_juego, estado, contenido_juego
            """,
            id_juego, docente["id"], json.dumps(juego, ensure_ascii=False),
        )
    return {
        "id_juego": str(resultado["id_juego"]),
        "estado": resultado["estado"],
        "juego": _contenido_como_dict(resultado["contenido_juego"]),
    }
