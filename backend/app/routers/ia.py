"""Generación y guardado de juegos educativos con Gemini."""

import asyncio
import hashlib
import json
import logging
import re
import uuid
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import date
from typing import Literal

import asyncpg
from fastapi import APIRouter, Body, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel, Field, ValidationError, model_validator

from app.core import planes
from app.core.config import settings
from app.core.deps import docente_actual, usuario_actual
from app.core.materias import GRADO_MAX, GRADO_MIN, GRADO_PREDETERMINADO, MATERIA_PREDETERMINADA, MateriaId, perfil_pedagogico
from app.core.limites import LimitadorVentana, exigir
from app.core.security import ROL_ALUMNO, ROL_DOCENTE
from app.db.session import get_db_pool
from app.ia import ErrorProveedor, Solicitud, obtener_proveedor
from app.ia.privacidad import encontrar_nombres, nombres_de_alumnos, ocultar_nombres


router = APIRouter(prefix="/ia", tags=["Inteligencia Artificial"])

# Los avisos salen en la misma terminal donde corre uvicorn.
logger = logging.getLogger("uvicorn.error")

# El "día" del límite diario es el de la escuela (misma zona que ZONA_ESCUELA en metricas.py).
_HOY_ESCUELA = "(now() AT TIME ZONE 'America/Mexico_City')::date"


def _mes_actual() -> date:
    return date.today().replace(day=1)


async def _plan_del_docente(conn: asyncpg.Connection, id_docente: uuid.UUID) -> planes.Plan:
    return planes.plan(await conn.fetchval("SELECT plan FROM docentes WHERE id_docente = $1", id_docente))


async def _reservar_credito(pool: asyncpg.Pool, id_docente: uuid.UUID) -> dict:
    """Cuenta atómicamente una solicitud de IA dentro de los límites mensual y diario de su plan.

    Las dos cuentas van en la misma transacción: si el día ya está lleno, tampoco se cobra el mes.
    """
    async with pool.acquire() as conn:
        async with conn.transaction():
            plan = await _plan_del_docente(conn, id_docente)
            mes = await conn.fetchval(
                """
                INSERT INTO ia_generaciones_mes (id_docente, periodo, generaciones)
                VALUES ($1, $2, 1)
                ON CONFLICT (id_docente, periodo) DO UPDATE
                SET generaciones = ia_generaciones_mes.generaciones + 1
                WHERE ia_generaciones_mes.generaciones < $3
                RETURNING generaciones
                """,
                id_docente, _mes_actual(), plan.mensual,
            )
            if mes is None:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Alcanzaste el límite mensual de {plan.mensual} créditos de IA de tu plan {plan.nombre}. "
                        "Si necesitas más, escríbenos desde la sección Planes."
                    ),
                )
            dia = await conn.fetchval(
                f"""
                INSERT INTO ia_generaciones_dia (id_docente, dia, generaciones)
                VALUES ($1, {_HOY_ESCUELA}, 1)
                ON CONFLICT (id_docente, dia) DO UPDATE
                SET generaciones = ia_generaciones_dia.generaciones + 1
                WHERE ia_generaciones_dia.generaciones < $2
                RETURNING generaciones
                """,
                id_docente, plan.diario,
            )
            if dia is None:
                raise HTTPException(
                    status_code=429,
                    detail=f"Usaste tus {plan.diario} créditos de IA de hoy. Mañana tienes más.",
                )
    return {"plan": plan, "mes": mes, "dia": dia}


async def _devolver_credito(pool: asyncpg.Pool, id_docente: uuid.UUID) -> None:
    """Devuelve el crédito cuando la IA no entregó nada: el docente no paga por un fallo."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                UPDATE ia_generaciones_mes SET generaciones = GREATEST(generaciones - 1, 0)
                 WHERE id_docente = $1 AND periodo = $2
                """,
                id_docente, _mes_actual(),
            )
            await conn.execute(
                f"""
                UPDATE ia_generaciones_dia SET generaciones = GREATEST(generaciones - 1, 0)
                 WHERE id_docente = $1 AND dia = {_HOY_ESCUELA}
                """,
                id_docente,
            )


async def _uso_actual(pool: asyncpg.Pool, id_docente: uuid.UUID) -> dict:
    async with pool.acquire() as conn:
        plan = await _plan_del_docente(conn, id_docente)
        fila = await conn.fetchrow(
            f"""
            SELECT
              (SELECT generaciones FROM ia_generaciones_mes WHERE id_docente = $1 AND periodo = $2) AS mes,
              (SELECT generaciones FROM ia_generaciones_dia WHERE id_docente = $1 AND dia = {_HOY_ESCUELA}) AS dia
            """,
            id_docente, _mes_actual(),
        )
    return {"plan": plan, "mes": fila["mes"] or 0, "dia": fila["dia"] or 0}


def _resumen_uso(uso: dict) -> dict:
    plan: planes.Plan = uso["plan"]
    return {
        "limite": plan.mensual, "usadas": uso["mes"], "disponibles": max(0, plan.mensual - uso["mes"]),
        "limite_diario": plan.diario, "usadas_hoy": uso["dia"], "disponibles_hoy": max(0, plan.diario - uso["dia"]),
        "plan": plan.id, "plan_nombre": plan.nombre,
        "demo": not obtener_proveedor().consume_creditos,
    }


async def _anotar_tokens(pool: asyncpg.Pool, id_docente: uuid.UUID, proveedor, tarea: str) -> None:
    """Guarda los tokens y el tiempo que reportó el proveedor (también los de intentos fallidos: se cobran igual)."""
    consumos = list(getattr(proveedor, "consumos", []) or [])
    if not consumos:
        return
    try:
        async with pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO ia_uso_tokens (id_docente, tarea, modelo, tokens_entrada, tokens_salida, duracion_ms)
                VALUES ($1, $2, $3, $4, $5, $6)
                """,
                [(id_docente, tarea, c[0][:80], c[1], c[2], c[3] if len(c) > 3 else None) for c in consumos],
            )
    except asyncpg.PostgresError:
        # Medir no debe romper la generación: si falla, solo se avisa en la terminal.
        logger.exception("No se pudieron guardar los tokens de la IA")
    proveedor.consumos.clear()


def _exigir_proveedor_listo():
    """Devuelve el proveedor de IA configurado o responde 503 explicando qué falta."""
    proveedor = obtener_proveedor()
    problema = proveedor.problema_de_configuracion()
    if problema:
        raise HTTPException(status_code=503, detail=problema)
    return proveedor


def _exigir_sin_nombres(texto: str, nombres: list[str]) -> None:
    """RNF-04: si el texto del docente nombra a un alumno suyo, no se envía a la IA."""
    encontrados = encontrar_nombres(texto, nombres)
    if encontrados:
        lista = ", ".join(f"«{n}»" for n in encontrados)
        raise HTTPException(
            status_code=422,
            detail=(
                f"Tu texto menciona {lista}, que coincide con el nombre de un alumno de tu aula. "
                "Por privacidad, a la IA no se le envían nombres de alumnos: quítalo o cámbialo e inténtalo de nuevo. "
                "(Si es una palabra normal, como la flor «rosa», escríbela en minúscula.)"
            ),
        )


@asynccontextmanager
async def _credito_ia(pool: asyncpg.Pool, id_docente: uuid.UUID, proveedor=None, tarea: str = "juego"):
    """Reserva un crédito y lo devuelve si lo de adentro termina en error (de cualquier tipo).

    Al salir (bien o mal) guarda los tokens que gastó el proveedor, para conocer el costo real.
    """
    proveedor = proveedor or obtener_proveedor()
    if not proveedor.consume_creditos:  # modo demo: no cuesta nada, no se reserva ni se devuelve
        yield await _uso_actual(pool, id_docente)
        return
    uso = await _reservar_credito(pool, id_docente)
    try:
        yield uso
    except BaseException:
        await _devolver_credito(pool, id_docente)
        raise
    finally:
        await _anotar_tokens(pool, id_docente, proveedor, tarea)


class SesionCreate(BaseModel):
    titulo: str = Field(min_length=2, max_length=160)
    tema: str = Field(min_length=2, max_length=240)
    material_nombre: str | None = Field(default=None, max_length=255)
    contexto: str = Field(default="", max_length=16000)


@router.get("/uso")
async def obtener_uso_ia(docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)):
    """Créditos de IA del docente con sesión (el docente sale del token, nunca del cliente)."""
    # La interfaz avisa cuando se está en modo demo (las respuestas no son de una IA real).
    return {**_resumen_uso(await _uso_actual(pool, docente["id"])), "unidad": "créditos de IA"}


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


_INSTRUCCION_TEMAS = (
    "Analiza estos materiales para una clase de primaria (la materia y el grado son los que indique el material). "
    "Devuelve solo JSON con {\"temas\":[{\"titulo\":\"tema concreto\",\"descripcion\":\"resumen didáctico breve\","
    "\"contenido\":\"los datos, definiciones y ejemplos importantes del material sobre ese tema, en 5 a 10 oraciones sencillas\"}]}. "
    "Propón entre 1 y 8 temas basados solo en el material. No inventes datos que no estén en el material "
    "y no incluyas nombres de personas."
)


async def _no_avisar(etapa: str) -> None:
    """Aviso de etapa que no hace nada (las rutas que esperan la respuesta completa no lo necesitan)."""


async def _leer_archivos(archivos: list[UploadFile]) -> tuple[list[tuple[bytes, str]], list[str]]:
    """Lee y valida los archivos subidos. Devuelve ([(bytes, tipo)], [nombres]) o lanza HTTPException."""
    if not archivos or len(archivos) > 10:
        raise HTTPException(status_code=400, detail="Selecciona entre 1 y 10 archivos.")
    adjuntos, nombres = [], []
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
        adjuntos.append((contenido, tipo))
        nombres.append(nombre)
    return adjuntos, nombres


def _huella_material(adjuntos: list[tuple[bytes, str]]) -> str:
    """Identifica un conjunto de archivos por su contenido (no por su nombre ni su orden).

    Incluye el texto de la instrucción: si algún día se mejora el prompt, las respuestas guardadas con el
    anterior dejan de usarse solas.
    """
    huellas = sorted(hashlib.sha256(contenido).hexdigest() for contenido, _ in adjuntos)
    return hashlib.sha256(f"{_INSTRUCCION_TEMAS}|{','.join(huellas)}".encode()).hexdigest()


async def _ejecutar_analisis(pool: asyncpg.Pool, id_docente: uuid.UUID, proveedor, adjuntos, nombres, avisar=None) -> dict:
    """Pide a la IA los temas del material (la parte lenta). Si el mismo material ya se analizó, no gasta nada."""
    avisar = avisar or _no_avisar
    # El modo demo responde con ejemplos fijos: no tiene sentido guardarlos.
    usa_cache = proveedor.consume_creditos and settings.IA_CACHE_DIAS > 0
    huella = _huella_material(adjuntos)
    if usa_cache:
        async with pool.acquire() as conn:
            guardado = await conn.fetchrow(
                """
                SELECT temas, contexto FROM ia_cache_material
                 WHERE id_docente = $1 AND huella = $2 AND fecha_creacion > now() - make_interval(days => $3)
                """,
                id_docente, huella, settings.IA_CACHE_DIAS,
            )
        if guardado is not None:
            temas = guardado["temas"]
            temas = json.loads(temas) if isinstance(temas, str) else temas
            logger.info("Análisis de material: respuesta guardada, sin llamar a la IA.")
            return {
                "archivos": nombres, "temas": temas, "contexto": guardado["contexto"],
                "uso": _resumen_uso(await _uso_actual(pool, id_docente)), "desde_cache": True,
            }

    await avisar("Leyendo tu material…")
    solicitud = Solicitud(instruccion=_INSTRUCCION_TEMAS, tarea="temas", archivos=adjuntos)
    async with _credito_ia(pool, id_docente, proveedor, "temas") as credito:
        temas: list[dict] = []
        for modelo in proveedor.modelos():
            try:
                texto = await proveedor.generar_json(solicitud, modelo)
            except ErrorProveedor as exc:
                if not exc.con_respaldo:
                    raise HTTPException(status_code=502, detail=f"{proveedor.nombre} rechazó el análisis (código {exc.codigo}).") from exc
                logger.warning("Análisis de material: %s respondió %s; se prueba otro modelo.", modelo, exc.codigo)
                await avisar("El modelo tardó o está saturado; probando con otro…")
                continue
            try:
                temas = _leer_temas(texto)
            except ValueError as exc:
                logger.warning("Análisis de material: respuesta inválida de %s: %s", modelo, exc)
                await avisar("La respuesta salió con errores; pidiéndola de nuevo…")
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
    if usa_cache:
        try:
            async with pool.acquire() as conn:
                await conn.execute(
                    "DELETE FROM ia_cache_material WHERE id_docente = $1 AND fecha_creacion <= now() - make_interval(days => $2)",
                    id_docente, settings.IA_CACHE_DIAS,
                )
                await conn.execute(
                    """
                    INSERT INTO ia_cache_material (id_docente, huella, temas, contexto) VALUES ($1, $2, $3::jsonb, $4)
                    ON CONFLICT (id_docente, huella) DO UPDATE SET temas = EXCLUDED.temas, contexto = EXCLUDED.contexto, fecha_creacion = now()
                    """,
                    id_docente, huella, json.dumps(temas, ensure_ascii=False), contexto,
                )
        except asyncpg.PostgresError:
            logger.exception("No se pudo guardar el análisis en la memoria")  # la caché es un extra: no rompe nada
    return {"archivos": nombres, "temas": temas, "contexto": contexto, "uso": _resumen_uso(credito), "desde_cache": False}


@router.post("/materiales/analizar")
async def analizar_materiales(
    archivos: list[UploadFile] = File(...),
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Analiza PDF o imágenes para sugerir temas de clase (de cualquier materia de primaria)."""
    proveedor = _exigir_proveedor_listo()
    adjuntos, nombres = await _leer_archivos(archivos)
    return await _ejecutar_analisis(pool, docente["id"], proveedor, adjuntos, nombres)


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
        "clasificar",
        "linea_tiempo",
        "hipotesis",
        "etiquetar",
        "detective",
    ] = "sorpresa"
    # Materia y grado reales de la actividad. Sin ellos se asume Ciencias Naturales de 4.º (el piloto original).
    materia: MateriaId | None = None
    grado: int | None = Field(default=None, ge=GRADO_MIN, le=GRADO_MAX)


TipoActividad = Literal[
    "quiz",
    "verdadero_falso",
    "ordenar",
    "relacionar",
    "memoria",
    "completar",
    "clasificar",
    "linea_tiempo",
    "hipotesis",
    "etiquetar",
    "detective",
]


class PreguntaQuiz(BaseModel):
    pregunta: str = Field(min_length=1)
    opciones: list[str] = Field(min_length=4, max_length=4)
    correcta: int = Field(ge=0, le=3)
    # Por qué es así: se muestra al alumno después de responder (opcional; los juegos viejos no lo traen).
    explicacion: str | None = Field(default=None, max_length=400)


class PreguntaVerdaderoFalso(BaseModel):
    afirmacion: str = Field(min_length=1)
    correcta: bool
    explicacion: str = Field(min_length=1)


class PreguntaOrdenar(BaseModel):
    consigna: str = Field(min_length=1)
    elementos: list[str] = Field(min_length=4, max_length=6)
    orden_correcto: list[str] = Field(min_length=4, max_length=6)
    # Por qué es así: se muestra al alumno después de responder (opcional; los juegos viejos no lo traen).
    explicacion: str | None = Field(default=None, max_length=400)


class ParRelacion(BaseModel):
    izquierda: str = Field(min_length=1)
    derecha: str = Field(min_length=1)


class PreguntaRelacionar(BaseModel):
    consigna: str = Field(min_length=1)
    pares: list[ParRelacion] = Field(min_length=3, max_length=5)
    # Por qué es así: se muestra al alumno después de responder (opcional; los juegos viejos no lo traen).
    explicacion: str | None = Field(default=None, max_length=400)


class PreguntaMemoria(BaseModel):
    consigna: str = Field(min_length=1)
    pares: list[ParRelacion] = Field(min_length=3, max_length=6)
    # Por qué es así: se muestra al alumno después de responder (opcional; los juegos viejos no lo traen).
    explicacion: str | None = Field(default=None, max_length=400)


class PreguntaCompletar(BaseModel):
    frase: str = Field(min_length=1)
    respuesta: str = Field(min_length=1)
    pista: str = Field(min_length=1)
    # Por qué es así: se muestra al alumno después de responder (opcional; los juegos viejos no lo traen).
    explicacion: str | None = Field(default=None, max_length=400)


class ElementoClasificar(BaseModel):
    texto: str = Field(min_length=1, max_length=80)
    categoria: str = Field(min_length=1, max_length=40)


class PreguntaClasificar(BaseModel):
    """Repartir elementos en 2 o 3 categorías (vivo / no vivo, sólido / líquido / gas...)."""

    consigna: str = Field(min_length=1)
    categorias: list[str] = Field(min_length=2, max_length=3)
    elementos: list[ElementoClasificar] = Field(min_length=4, max_length=8)
    explicacion: str | None = Field(default=None, max_length=400)


class EventoLinea(BaseModel):
    etiqueta: str = Field(min_length=1, max_length=40)  # el año, la etapa o el momento (se ve en la línea)
    texto: str = Field(min_length=1, max_length=120)  # lo que pasó (es la tarjeta que se coloca)


class PreguntaLineaTiempo(BaseModel):
    """Colocar cada suceso en su lugar de la línea. Los eventos vienen en el orden correcto."""

    consigna: str = Field(min_length=1)
    eventos: list[EventoLinea] = Field(min_length=3, max_length=6)
    explicacion: str | None = Field(default=None, max_length=400)


class PreguntaHipotesis(BaseModel):
    """Laboratorio: el alumno elige qué pasará y luego ve el resultado real."""

    escenario: str = Field(min_length=1, max_length=300)  # el experimento o situación
    opciones: list[str] = Field(min_length=2, max_length=4)  # predicciones posibles
    correcta: int = Field(ge=0, le=3)
    resultado: str = Field(min_length=1, max_length=300)  # lo que pasa de verdad (se revela al elegir)
    explicacion: str | None = Field(default=None, max_length=400)


# Esquemas dibujados en el frontend (lib/esquemas): cada uno tiene puntos numerados fijos.
# Aquí solo se guarda cuántos puntos tiene y qué señala cada uno (se le dice a la IA en el prompt).
ESQUEMAS_ETIQUETAR = {
    "planta": {"puntos": 5, "partes": "1 flor, 2 hoja, 3 tallo, 4 raíz, 5 fruto"},
    "celula": {"puntos": 5, "partes": "1 núcleo, 2 membrana, 3 citoplasma, 4 mitocondria, 5 pared celular"},
    "tierra": {"puntos": 4, "partes": "1 corteza, 2 manto, 3 núcleo externo, 4 núcleo interno"},
    "volcan": {"puntos": 4, "partes": "1 cráter, 2 chimenea, 3 cámara magmática, 4 ladera"},
}


class PuntoEtiqueta(BaseModel):
    numero: int = Field(ge=1, le=5)  # número del punto en el esquema
    texto: str = Field(min_length=1, max_length=40)  # nombre de la parte (es la etiqueta que se arrastra)


class PreguntaEtiquetar(BaseModel):
    """Poner nombres sobre los puntos numerados de un esquema (partes de una planta, de una célula...)."""

    consigna: str = Field(min_length=1)
    esquema: Literal["planta", "celula", "tierra", "volcan"]
    puntos: list[PuntoEtiqueta] = Field(min_length=3, max_length=5)
    explicacion: str | None = Field(default=None, max_length=400)


class PreguntaDetective(BaseModel):
    """Una explicación con UNA oración equivocada que el alumno debe encontrar."""

    consigna: str = Field(min_length=1)
    oraciones: list[str] = Field(min_length=4, max_length=6)
    error: int = Field(ge=0, le=5)  # posición (desde 0) de la oración equivocada
    correccion: str = Field(min_length=1, max_length=200)  # cómo debió decir esa oración
    explicacion: str | None = Field(default=None, max_length=400)


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
            "clasificar": PreguntaClasificar,
            "linea_tiempo": PreguntaLineaTiempo,
            "hipotesis": PreguntaHipotesis,
            "etiquetar": PreguntaEtiquetar,
            "detective": PreguntaDetective,
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
            if self.tipo_actividad == "clasificar":
                nombres = [c.strip().lower() for c in item.categorias]
                if any(not n for n in nombres) or len(set(nombres)) != len(nombres):
                    raise ValueError("Las categorías deben ser distintas y no estar vacías.")
                usadas = {e.categoria.strip().lower() for e in item.elementos}
                if not usadas <= set(nombres):
                    raise ValueError("Cada elemento debe pertenecer a una de las categorías.")
                if usadas != set(nombres):
                    raise ValueError("Cada categoría debe tener al menos un elemento.")
                textos = [e.texto.strip().lower() for e in item.elementos]
                if len(set(textos)) != len(textos):
                    raise ValueError("Los elementos deben ser únicos para evitar respuestas ambiguas.")
            if self.tipo_actividad == "linea_tiempo":
                etiquetas = [e.etiqueta.strip().lower() for e in item.eventos]
                textos = [e.texto.strip().lower() for e in item.eventos]
                if len(set(etiquetas)) != len(etiquetas) or len(set(textos)) != len(textos):
                    raise ValueError("Las etiquetas y los sucesos de la línea deben ser únicos.")
            if self.tipo_actividad == "hipotesis":
                if item.correcta >= len(item.opciones):
                    raise ValueError("La opción correcta debe ser una de las opciones.")
                limpias = [o.strip().lower() for o in item.opciones]
                if any(not o for o in limpias) or len(set(limpias)) != len(limpias):
                    raise ValueError("Las predicciones deben ser distintas y no estar vacías.")
            if self.tipo_actividad == "etiquetar":
                maximo = ESQUEMAS_ETIQUETAR[item.esquema]["puntos"]
                numeros = [p.numero for p in item.puntos]
                if len(set(numeros)) != len(numeros) or any(n > maximo for n in numeros):
                    raise ValueError(f"Los números de los puntos deben ser distintos y de 1 a {maximo} para este esquema.")
                nombres = [p.texto.strip().lower() for p in item.puntos]
                if len(set(nombres)) != len(nombres):
                    raise ValueError("Los nombres de las partes deben ser únicos para evitar respuestas ambiguas.")
            if self.tipo_actividad == "detective":
                if item.error >= len(item.oraciones):
                    raise ValueError("La posición del error debe ser una de las oraciones.")
                limpias = [o.strip().lower() for o in item.oraciones]
                if any(not o for o in limpias) or len(set(limpias)) != len(limpias):
                    raise ValueError("Las oraciones deben ser distintas y no estar vacías.")
                if item.correccion.strip().lower() == limpias[item.error]:
                    raise ValueError("La corrección debe ser diferente a la oración equivocada.")
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
        for pregunta in crudo["preguntas"]:
            if not isinstance(pregunta, dict):
                continue
            if tope and isinstance(pregunta.get("pares"), list):
                pregunta["pares"] = pregunta["pares"][:tope]
            if crudo.get("tipo_actividad") == "linea_tiempo" and isinstance(pregunta.get("eventos"), list):
                pregunta["eventos"] = pregunta["eventos"][:6]
            if crudo.get("tipo_actividad") == "etiquetar" and isinstance(pregunta.get("puntos"), list):
                pregunta["puntos"] = pregunta["puntos"][:5]
            if crudo.get("tipo_actividad") == "detective" and isinstance(pregunta.get("oraciones"), list):
                pregunta["oraciones"] = pregunta["oraciones"][:6]
            if crudo.get("tipo_actividad") == "hipotesis" and isinstance(pregunta.get("opciones"), list):
                pregunta["opciones"] = pregunta["opciones"][:4]
            # La explicación es opcional: si la IA la manda larga se recorta y, si viene vacía o
            # con otro tipo de dato, se quita (no vale la pena rechazar el juego completo por eso).
            if crudo.get("tipo_actividad") != "verdadero_falso" and "explicacion" in pregunta:
                texto = pregunta["explicacion"]
                if isinstance(texto, str) and texto.strip():
                    pregunta["explicacion"] = texto.strip()[:400]
                else:
                    del pregunta["explicacion"]


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


async def _pedir_juego(proveedor, solicitud: Solicitud, tipo_solicitado: str, interpretar=None, avisar=None) -> dict:
    """Pide el juego al proveedor de IA (reintentos y respaldo entre modelos).

    Devuelve un juego válido o lanza HTTPException. Por cada modelo: hasta 2 intentos si la respuesta
    no cumple el formato (la segunda vez se le dice a la IA qué falló); si el modelo falla (cuota,
    saturación), se pasa al siguiente.
    """
    interpretar = interpretar or _interpretar_juego
    avisar = avisar or _no_avisar
    juego: dict | None = None
    errores_modelo: list[ErrorProveedor] = []
    invalidos: list[str] = []

    modelos = proveedor.modelos()
    if not modelos:
        raise HTTPException(status_code=503, detail="No hay modelos de IA configurados.")

    for modelo in modelos:
        peticion = solicitud
        for intento in (1, 2):
            try:
                texto = await proveedor.generar_json(peticion, modelo)
                if not texto:
                    raise JuegoInvalido("la respuesta llegó vacía")
                juego = interpretar(texto, tipo_solicitado)
                break
            except JuegoInvalido as exc:
                invalidos.append(str(exc))
                logger.warning("Juego inválido de %s (intento %d): %s", modelo, intento, exc)
                await avisar("La respuesta salió con errores; pidiéndola de nuevo…")
                peticion = replace(
                    solicitud,
                    instruccion=solicitud.instruccion
                    + f"\n\nTu respuesta anterior no cumplió el formato: {exc}. "
                    "Corrígelo y devuelve únicamente el JSON válido.",
                )
            except ErrorProveedor as exc:
                if not exc.con_respaldo:
                    raise HTTPException(
                        status_code=502,
                        detail=f"{proveedor.nombre} rechazó la solicitud (código {exc.codigo}).",
                    ) from exc
                logger.warning("%s %s respondió %s: se prueba el siguiente modelo", proveedor.nombre, modelo, exc.codigo)
                errores_modelo.append(exc)
                await avisar("El modelo tardó o está saturado; probando con otro…")
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
        if errores_modelo and all(error.codigo == 403 for error in errores_modelo):
            raise HTTPException(
                status_code=502,
                detail=(
                    "Google rechazó la clave o el proyecto (403). Revisa GEMINI_API_KEY en backend/.env "
                    "o crea una clave nueva en aistudio.google.com/apikey."
                ),
            ) from errores_modelo[-1]
        if errores_modelo and all(error.codigo == 404 for error in errores_modelo):
            raise HTTPException(
                status_code=502,
                detail="Ninguno de los modelos configurados está disponible para esta clave.",
            ) from errores_modelo[-1]
        if not errores_modelo:
            raise HTTPException(status_code=502, detail="No fue posible generar el juego.")
        raise HTTPException(
            status_code=503,
            detail="La IA está temporalmente saturada. Espera un minuto e inténtalo de nuevo.",
        ) from errores_modelo[-1]
    return juego


async def _preparar_juego(datos: PromptJuego, docente: dict, pool: asyncpg.Pool) -> dict:
    """Valida la petición y arma lo que se le pedirá a la IA. Aquí se rechaza todo lo rechazable
    (sin proveedor, límite por hora, nombres de alumnos, sesión inexistente) antes de gastar nada."""
    proveedor = _exigir_proveedor_listo()
    exigir(
        _limite_generacion,
        str(docente["id"]),
        "Llegaste al límite de juegos por hora. Inténtalo más tarde.",
    )
    prompt_original = datos.texto_prompt  # lo que escribió el docente, sin el material de la sesión
    materia = datos.materia or MATERIA_PREDETERMINADA
    grado = datos.grado or GRADO_PREDETERMINADO
    contexto_sesion = ""
    async with pool.acquire() as conn:
        nombres_alumnos = await nombres_de_alumnos(conn, docente["id"])
    _exigir_sin_nombres(datos.texto_prompt, nombres_alumnos)  # RNF-04: lo que el docente escribe
    if datos.id_sesion:
        async with pool.acquire() as conn:
            contexto_sesion = await conn.fetchval(
                "SELECT contexto FROM sesiones_docente WHERE id_sesion=$1 AND id_docente=$2",
                datos.id_sesion, docente["id"],
            )
        if contexto_sesion is None:
            raise HTTPException(status_code=404, detail="No se encontró la sesión seleccionada.")
    if contexto_sesion:
        # El material viene de un archivo: si trae nombres de alumnos, se ocultan antes de enviarlo.
        contexto_sesion, ocultos = ocultar_nombres(contexto_sesion, nombres_alumnos)
        if ocultos:
            logger.warning("Se ocultaron %d nombre(s) de alumnos del material antes de enviarlo a la IA.", len(ocultos))
        datos.texto_prompt = f"{datos.texto_prompt}\n\nMaterial de referencia de la sesión:\n{contexto_sesion[:16000]}"

    descripciones = {
        "quiz": "quiz: cada pregunta usa {\"pregunta\": texto, \"opciones\": [4 textos], \"correcta\": índice 0-3, \"explicacion\": una frase que enseñe por qué es la correcta}.",
        "verdadero_falso": "verdadero_falso: cada pregunta usa {\"afirmacion\": texto, \"correcta\": true/false, \"explicacion\": texto breve}.",
        "ordenar": "ordenar: cada pregunta usa {\"consigna\": texto, \"elementos\": [4-6 pasos en desorden], \"orden_correcto\": [los mismos textos en orden], \"explicacion\": una frase que explique por qué va en ese orden }.",
        "relacionar": "relacionar: cada pregunta usa {\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su relación}], \"explicacion\": una frase que explique la relación } con 3-5 parejas.",
        "memoria": "memoria: cada pregunta usa {\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su pareja}], \"explicacion\": una frase que explique las parejas } con 3-6 parejas.",
        "clasificar": "clasificar: cada pregunta usa {\"consigna\": texto, \"categorias\": [2 o 3 nombres cortos], \"elementos\": [{\"texto\": cosa a clasificar, \"categoria\": una de las categorías}] con 4-8 elementos, todas las categorías con al menos uno, \"explicacion\": una frase que enseñe el criterio}.",
        "linea_tiempo": "linea_tiempo: cada pregunta usa {\"consigna\": texto, \"eventos\": [{\"etiqueta\": año, etapa o momento (corto), \"texto\": qué pasó}] con 3-6 eventos YA en orden correcto, \"explicacion\": una frase que explique la secuencia}.",
        "hipotesis": "hipotesis: cada pregunta usa {\"escenario\": experimento o situación en 1-2 oraciones, \"opciones\": [3 predicciones distintas de qué pasará], \"correcta\": índice 0-2 de la predicción acertada, \"resultado\": lo que pasa de verdad contado como observación, \"explicacion\": el porqué científico en una frase}. Ideal para ciencias.",
        "etiquetar": "etiquetar: cada pregunta usa {\"consigna\": texto, \"esquema\": uno de planta|celula|tierra|volcan, \"puntos\": [{\"numero\": número del punto, \"texto\": nombre de la parte}] con 3-5 puntos, \"explicacion\": frase breve}. Puntos de cada esquema: planta (1 flor, 2 hoja, 3 tallo, 4 raíz, 5 fruto); celula (1 núcleo, 2 membrana, 3 citoplasma, 4 mitocondria, 5 pared celular); tierra (1 corteza, 2 manto, 3 núcleo externo, 4 núcleo interno); volcan (1 cráter, 2 chimenea, 3 cámara magmática, 4 ladera). El texto de cada punto es el nombre de la parte que corresponde a ese número. Solo para temas que encajen con un esquema.",
        "detective": "detective: cada pregunta usa {\"consigna\": texto, \"oraciones\": [4-6 oraciones cortas que juntas explican un tema], \"error\": posición (desde 0) de la ÚNICA oración equivocada, \"correccion\": cómo debería decir esa oración, \"explicacion\": por qué estaba mal}. Las demás oraciones deben ser verdaderas y el error debe ser un error conceptual real, no de redacción.",
        "completar": "completar: cada pregunta usa {\"frase\": texto con un espacio marcado ___, \"respuesta\": palabra/frase esperada, \"pista\": ayuda breve, \"explicacion\": una frase que explique la respuesta}.",
    }
    formatos = "\n".join(f"- {nombre}: {descripcion}" for nombre, descripcion in descripciones.items())
    tipo_solicitado = datos.tipo_actividad
    instruccion = f"""
Eres un diseñador pedagógico y creador de juegos para niñas y niños de {perfil_pedagogico(materia, grado)}.
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

La "explicacion" de cada reto se le muestra al niño después de responder: 1 oración sencilla (máximo 200 caracteres) que enseñe el porqué, sin regañar.
Si el formato solicitado es "sorpresa", elige el tipo que mejor enseñe el tema y evita quiz si ordenar, relacionar, memoria, completar, clasificar o linea_tiempo tienen más sentido (clasificar para agrupar por una característica; linea_tiempo para historia o procesos con fechas o etapas).
Si el docente pidió un tipo concreto, usa exactamente ese tipo: {tipo_solicitado!r}.
Usa vocabulario sencillo, una sola idea por reto, contenido correcto y adecuado a la edad.
Para ordenar, mezcla los elementos y conserva una lista orden_correcto con los mismos textos en la secuencia correcta.
Para relacionar y memoria, evita parejas duplicadas o ambiguas.
Para completar, incluye ___ exactamente donde va la respuesta. Devuelve de 3 a 5 retos. No agregues markdown.
"""

    return {
        "proveedor": proveedor, "instruccion": instruccion, "tipo": tipo_solicitado,
        "prompt_original": prompt_original, "materia": materia, "grado": grado, "id_sesion": datos.id_sesion,
    }


async def _ejecutar_juego(listo: dict, id_docente: uuid.UUID, pool: asyncpg.Pool, avisar=None) -> dict:
    """Pide el juego a la IA y lo guarda como borrador (la parte lenta). `avisar` informa en qué etapa va."""
    avisar = avisar or _no_avisar
    proveedor, tipo_solicitado = listo["proveedor"], listo["tipo"]
    async with _credito_ia(pool, id_docente, proveedor, "juego") as credito:
        await avisar("Creando las preguntas…")
        solicitud = Solicitud(instruccion=listo["instruccion"], tarea="juego", tipo=tipo_solicitado, tema=listo["prompt_original"])
        juego = await _pedir_juego(proveedor, solicitud, tipo_solicitado, avisar=avisar)
        await avisar("Guardando el borrador…")

        query = """
            INSERT INTO juegos_generados (id_docente, id_sesion, prompt_original, contenido_juego, materia, grado)
            VALUES ($1, $2, $3, $4::jsonb, $5, $6)
            RETURNING id_juego, estado
        """

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    query,
                    id_docente,
                    listo["id_sesion"],
                    listo["prompt_original"],
                    json.dumps(juego, ensure_ascii=False),
                    listo["materia"],
                    listo["grado"],
                )
        except asyncpg.PostgresError as exc:
            raise HTTPException(
                status_code=500,
                detail="El juego se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
            ) from exc

    # El juego nace como borrador: los alumnos no lo ven hasta que el docente lo apruebe.
    return {
        "id_juego": str(row["id_juego"]), "estado": row["estado"], "materia": listo["materia"], "grado": listo["grado"],
        "juego": juego, "uso": _resumen_uso(credito),
    }


@router.post("/generar-juego")
async def generar_juego_con_ia(
    datos: PromptJuego,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
) -> dict:
    """Genera un juego JSON para el docente con sesión, prueba modelos alternativos y lo guarda."""
    listo = await _preparar_juego(datos, docente, pool)
    return await _ejecutar_juego(listo, docente["id"], pool)


class PromptClase(BaseModel):
    id_sesion: uuid.UUID
    tipo_evaluacion: Literal[
        "quiz", "verdadero_falso", "ordenar", "relacionar", "memoria", "completar", "clasificar", "linea_tiempo",
        "hipotesis", "etiquetar", "detective",
    ] = "quiz"
    indicaciones: str = Field(default="", max_length=500)
    materia: MateriaId | None = None
    grado: int | None = Field(default=None, ge=GRADO_MIN, le=GRADO_MAX)


_FORMATOS_EVALUACION = {
    "quiz": "{\"pregunta\": texto, \"opciones\": [4 textos], \"correcta\": índice 0-3, \"explicacion\": frase breve que enseñe por qué}",
    "verdadero_falso": "{\"afirmacion\": texto, \"correcta\": true/false, \"explicacion\": texto breve}",
    "ordenar": "{\"consigna\": texto, \"elementos\": [4-6 pasos en desorden], \"orden_correcto\": [los mismos textos en orden], \"explicacion\": frase breve}",
    "relacionar": "{\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su relación}], \"explicacion\": frase breve} con 3-5 parejas",
    "memoria": "{\"consigna\": texto, \"pares\": [{\"izquierda\": texto, \"derecha\": su pareja}], \"explicacion\": frase breve} con 3-6 parejas",
    "clasificar": "{\"consigna\": texto, \"categorias\": [2-3 nombres cortos], \"elementos\": [{\"texto\": cosa, \"categoria\": una de las categorías}] con 4-8 elementos y todas las categorías usadas, \"explicacion\": frase breve}",
    "linea_tiempo": "{\"consigna\": texto, \"eventos\": [{\"etiqueta\": año o etapa corta, \"texto\": qué pasó}] con 3-6 eventos en orden correcto, \"explicacion\": frase breve}",
    "hipotesis": "{\"escenario\": situación experimental, \"opciones\": [3 predicciones], \"correcta\": índice 0-2, \"resultado\": lo que pasa de verdad, \"explicacion\": frase breve}",
    "etiquetar": "{\"consigna\": texto, \"esquema\": planta|celula|tierra|volcan, \"puntos\": [{\"numero\": 1-5, \"texto\": nombre de la parte}] con 3-5 puntos (planta: 1 flor, 2 hoja, 3 tallo, 4 raíz, 5 fruto; celula: 1 núcleo, 2 membrana, 3 citoplasma, 4 mitocondria, 5 pared celular; tierra: 1 corteza, 2 manto, 3 núcleo externo, 4 núcleo interno; volcan: 1 cráter, 2 chimenea, 3 cámara magmática, 4 ladera), \"explicacion\": frase breve}",
    "detective": "{\"consigna\": texto, \"oraciones\": [4-6 oraciones, solo UNA equivocada], \"error\": posición desde 0 de la equivocada, \"correccion\": cómo debería decir esa oración, \"explicacion\": por qué estaba mal}",
    "completar": "{\"frase\": texto con un espacio marcado ___, \"respuesta\": palabra esperada, \"pista\": ayuda breve, \"explicacion\": frase breve}",
}


async def _preparar_clase(datos: PromptClase, docente: dict, pool: asyncpg.Pool) -> dict:
    """Valida la petición de una clase y arma lo que se le pedirá a la IA (ver _preparar_juego)."""
    proveedor = _exigir_proveedor_listo()
    exigir(_limite_generacion, str(docente["id"]), "Llegaste al límite de juegos por hora. Inténtalo de nuevo más tarde.")
    async with pool.acquire() as conn:
        nombres_alumnos = await nombres_de_alumnos(conn, docente["id"])
        sesion = await conn.fetchrow(
            "SELECT titulo, tema, contexto FROM sesiones_docente WHERE id_sesion=$1 AND id_docente=$2",
            datos.id_sesion, docente["id"],
        )
    if sesion is None:
        raise HTTPException(status_code=404, detail="No se encontró la sesión seleccionada.")
    # RNF-04: lo que escribió el docente se rechaza si nombra a un alumno; el material (de un archivo) se limpia.
    _exigir_sin_nombres(f"{sesion['tema']}\n{datos.indicaciones}", nombres_alumnos)
    material, ocultos = ocultar_nombres((sesion["contexto"] or "")[:16000], nombres_alumnos)
    if ocultos:
        logger.warning("Se ocultaron %d nombre(s) de alumnos del material antes de enviarlo a la IA.", len(ocultos))
    indicaciones = f"\nIndicaciones extra del docente: {datos.indicaciones!r}" if datos.indicaciones.strip() else ""
    materia = datos.materia or MATERIA_PREDETERMINADA
    grado = datos.grado or GRADO_PREDETERMINADO
    tipo = datos.tipo_evaluacion
    instruccion = f"""
Eres un diseñador pedagógico. Crea una CLASE INTERACTIVA para niñas y niños de {perfil_pedagogico(materia, grado)}.
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
    return {
        "proveedor": proveedor, "instruccion": instruccion, "tipo": tipo, "tema": sesion["tema"], "titulo": sesion["titulo"],
        "materia": materia, "grado": grado, "id_sesion": datos.id_sesion,
    }


async def _ejecutar_clase(listo: dict, id_docente: uuid.UUID, pool: asyncpg.Pool, avisar=None) -> dict:
    """Pide la clase a la IA y la guarda como borrador (la parte lenta). `avisar` informa en qué etapa va."""
    avisar = avisar or _no_avisar
    proveedor, tipo = listo["proveedor"], listo["tipo"]
    async with _credito_ia(pool, id_docente, proveedor, "clase") as credito:
        await avisar("Escribiendo las secciones y la evaluación…")
        solicitud = Solicitud(instruccion=listo["instruccion"], tarea="clase", tipo=tipo, tema=listo["tema"], max_tokens=8192)
        clase = await _pedir_juego(proveedor, solicitud, tipo, interpretar=_interpretar_clase, avisar=avisar)
        await avisar("Guardando el borrador…")
        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO juegos_generados (id_docente, id_sesion, prompt_original, contenido_juego, materia, grado)
                    VALUES ($1, $2, $3, $4::jsonb, $5, $6)
                    RETURNING id_juego, estado
                    """,
                    id_docente, listo["id_sesion"], f"Clase: {listo['titulo']}"[:2000],
                    json.dumps(clase, ensure_ascii=False), listo["materia"], listo["grado"],
                )
        except asyncpg.PostgresError as exc:
            raise HTTPException(
                status_code=500,
                detail="La clase se generó, pero no se pudo guardar. Revisa la tabla juegos_generados.",
            ) from exc
    return {
        "id_juego": str(row["id_juego"]), "estado": row["estado"], "materia": listo["materia"], "grado": listo["grado"],
        "juego": clase, "uso": _resumen_uso(credito),
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
    listo = await _preparar_clase(datos, docente, pool)
    return await _ejecutar_clase(listo, docente["id"], pool)


# ------------------------------------------------------------ tareas en segundo plano
# Generar con IA puede tardar medio minuto. En lugar de dejar la petición abierta, se anota una tarea,
# se responde al instante con su id (202) y la pantalla consulta cada par de segundos en qué etapa va.
# El estado vive en la base de datos (ia_tareas); el trabajo corre en este mismo proceso de la API.

_TAREAS_VIVAS: set[asyncio.Task] = set()  # evita que Python descarte una tarea que sigue corriendo
MAX_TAREAS_SIMULTANEAS = 2
MINUTOS_MAXIMOS_TAREA = 10  # pasado este tiempo, una tarea "en proceso" se da por perdida (p. ej. se reinició la API)


async def _cerrar_tarea(pool: asyncpg.Pool, id_tarea: uuid.UUID, resultado: dict | None = None, error: tuple[int, str] | None = None) -> None:
    try:
        async with pool.acquire() as conn:
            if error is None:
                await conn.execute(
                    "UPDATE ia_tareas SET estado = 'lista', etapa = 'Listo', resultado = $2::jsonb, fecha_fin = now() WHERE id_tarea = $1",
                    id_tarea, json.dumps(resultado, ensure_ascii=False, default=str),
                )
            else:
                await conn.execute(
                    "UPDATE ia_tareas SET estado = 'error', etapa = 'Error', error_estado = $2, error_detalle = $3, fecha_fin = now() WHERE id_tarea = $1",
                    id_tarea, error[0], error[1][:1000],
                )
    except asyncpg.PostgresError:
        logger.exception("No se pudo cerrar la tarea de IA %s", id_tarea)


async def _correr_tarea(pool: asyncpg.Pool, id_tarea: uuid.UUID, ejecutar) -> None:
    """Ejecuta el trabajo y anota cómo terminó. Nunca deja escapar una excepción: nadie la recibiría."""

    async def avisar(etapa: str) -> None:
        try:
            async with pool.acquire() as conn:
                await conn.execute("UPDATE ia_tareas SET etapa = $2 WHERE id_tarea = $1 AND estado = 'en_proceso'", id_tarea, etapa[:120])
        except asyncpg.PostgresError:
            logger.exception("No se pudo anotar la etapa de la tarea %s", id_tarea)

    try:
        resultado = await ejecutar(avisar)
    except HTTPException as exc:
        await _cerrar_tarea(pool, id_tarea, error=(exc.status_code, str(exc.detail)))
    except asyncio.CancelledError:
        await _cerrar_tarea(pool, id_tarea, error=(503, "El servidor se reinició mientras trabajaba. Inténtalo de nuevo."))
        raise
    except Exception:
        logger.exception("Falló la tarea de IA %s", id_tarea)
        await _cerrar_tarea(pool, id_tarea, error=(500, "Ocurrió un error inesperado. Inténtalo de nuevo."))
    else:
        await _cerrar_tarea(pool, id_tarea, resultado=resultado)


_ERROR_TAREA_PERDIDA = (504, "La generación tardó demasiado y se canceló. Inténtalo de nuevo.")


async def _abrir_tarea(pool: asyncpg.Pool, id_docente: uuid.UUID, tipo: str, ejecutar) -> uuid.UUID:
    """Anota la tarea y la deja corriendo. `ejecutar(avisar)` es el trabajo; devuelve el id para consultarla."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Un docente a la vez: sin este candado, dos peticiones simultáneas podrían saltarse el tope.
            await conn.execute("SELECT pg_advisory_xact_lock(hashtext($1))", f"ia_tareas:{id_docente}")
            await conn.execute(
                """
                UPDATE ia_tareas SET estado = 'error', etapa = 'Error', error_estado = $3, error_detalle = $4, fecha_fin = now()
                 WHERE id_docente = $1 AND estado = 'en_proceso' AND fecha_creacion < now() - make_interval(mins => $2)
                """,
                id_docente, MINUTOS_MAXIMOS_TAREA, *_ERROR_TAREA_PERDIDA,
            )
            en_curso = await conn.fetchval("SELECT COUNT(*) FROM ia_tareas WHERE id_docente = $1 AND estado = 'en_proceso'", id_docente)
            if en_curso >= MAX_TAREAS_SIMULTANEAS:
                raise HTTPException(
                    status_code=429,
                    detail=f"Ya tienes {MAX_TAREAS_SIMULTANEAS} generaciones en curso. Espera a que termine una e inténtalo de nuevo.",
                )
            id_tarea = await conn.fetchval("INSERT INTO ia_tareas (id_docente, tipo) VALUES ($1, $2) RETURNING id_tarea", id_docente, tipo)
    tarea = asyncio.get_running_loop().create_task(_correr_tarea(pool, id_tarea, ejecutar))
    _TAREAS_VIVAS.add(tarea)
    tarea.add_done_callback(_TAREAS_VIVAS.discard)
    return id_tarea


@router.post("/tareas/juego", status_code=202)
async def iniciar_juego(datos: PromptJuego, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)) -> dict:
    """Igual que /generar-juego, pero responde al instante con un id_tarea para ir viendo el avance."""
    listo = await _preparar_juego(datos, docente, pool)  # los rechazos llegan aquí, de inmediato
    id_docente = docente["id"]
    return {"id_tarea": str(await _abrir_tarea(pool, id_docente, "juego", lambda avisar: _ejecutar_juego(listo, id_docente, pool, avisar)))}


@router.post("/tareas/clase", status_code=202)
async def iniciar_clase(datos: PromptClase, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)) -> dict:
    """Igual que /generar-clase, pero en segundo plano."""
    listo = await _preparar_clase(datos, docente, pool)
    id_docente = docente["id"]
    return {"id_tarea": str(await _abrir_tarea(pool, id_docente, "clase", lambda avisar: _ejecutar_clase(listo, id_docente, pool, avisar)))}


@router.post("/tareas/materiales", status_code=202)
async def iniciar_analisis(
    archivos: list[UploadFile] = File(...), docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)
) -> dict:
    """Igual que /materiales/analizar, pero en segundo plano. Los archivos se leen aquí: al responder se cierran."""
    proveedor = _exigir_proveedor_listo()
    adjuntos, nombres = await _leer_archivos(archivos)
    id_docente = docente["id"]
    ejecutar = lambda avisar: _ejecutar_analisis(pool, id_docente, proveedor, adjuntos, nombres, avisar)  # noqa: E731
    return {"id_tarea": str(await _abrir_tarea(pool, id_docente, "temas", ejecutar))}


@router.get("/tareas/{id_tarea}")
async def estado_de_tarea(id_tarea: uuid.UUID, docente: dict = Depends(docente_actual), pool: asyncpg.Pool = Depends(get_db_pool)) -> dict:
    """En qué va una tarea. Solo la ve quien la pidió. Que la IA falle NO es un error de esta consulta:
    se responde 200 con estado 'error' y el motivo."""
    async with pool.acquire() as conn:
        fila = await conn.fetchrow(
            """
            SELECT estado, etapa, resultado, error_estado, error_detalle,
                   EXTRACT(EPOCH FROM (COALESCE(fecha_fin, now()) - fecha_creacion))::int AS segundos
              FROM ia_tareas WHERE id_tarea = $1 AND id_docente = $2
            """,
            id_tarea, docente["id"],
        )
    if fila is None:
        raise HTTPException(status_code=404, detail="No se encontró esa generación.")
    estado, etapa = fila["estado"], fila["etapa"]
    if estado == "en_proceso" and fila["segundos"] > MINUTOS_MAXIMOS_TAREA * 60:
        await _cerrar_tarea(pool, id_tarea, error=_ERROR_TAREA_PERDIDA)
        estado, etapa = "error", "Error"
        fila = {**dict(fila), "error_estado": _ERROR_TAREA_PERDIDA[0], "error_detalle": _ERROR_TAREA_PERDIDA[1]}
    respuesta = {"estado": estado, "etapa": etapa, "segundos": fila["segundos"]}
    if estado == "lista":
        resultado = fila["resultado"]
        respuesta["resultado"] = json.loads(resultado) if isinstance(resultado, str) else resultado
    elif estado == "error":
        respuesta["error"] = {"estado": fila["error_estado"] or 500, "detalle": fila["error_detalle"] or "No se pudo completar la generación."}
    return respuesta


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

    Un alumno ve solo lo aprobado Y asignado a SU grupo: las actividades de otros grupos del
    mismo docente no le aparecen. El docente ve además a qué grupos asignó cada una (`grupos`).
    """
    id_grupo = None
    if usuario["rol"] == ROL_DOCENTE:
        id_docente = usuario["id"]
    elif usuario["rol"] == ROL_ALUMNO:
        id_docente = usuario["id_docente"]
        id_grupo = usuario["id_grupo"]
        estado = "aprobado"  # un alumno nunca ve borradores ni descartados, pida lo que pida
    else:
        raise HTTPException(status_code=403, detail="No tienes permiso para esta acción.")

    query = """
        SELECT j.id_juego, j.prompt_original, j.contenido_juego, j.fecha_creacion, j.estado, j.fecha_aprobacion,
               j.materia, j.grado,
               COALESCE((SELECT array_agg(jg.id_grupo::text ORDER BY jg.id_grupo)
                           FROM juegos_grupos jg WHERE jg.id_juego = j.id_juego), '{}') AS grupos
        FROM juegos_generados j
        WHERE j.id_docente = $1
          AND (($2::text IS NULL AND j.estado <> 'descartado') OR j.estado = $2::text)
          AND ($3::uuid IS NULL OR EXISTS (
                SELECT 1 FROM juegos_grupos jg WHERE jg.id_juego = j.id_juego AND jg.id_grupo = $3::uuid))
        ORDER BY j.fecha_creacion DESC
    """
    async with pool.acquire() as conn:
        rows = await conn.fetch(query, id_docente, estado, id_grupo)

    juegos = []
    for row in rows:
        juego = dict(row)
        if usuario["rol"] == ROL_ALUMNO:
            # El alumno no necesita ver lo que pidió el docente ni el estado de revisión.
            for campo in ("prompt_original", "estado", "fecha_aprobacion", "grupos"):
                juego.pop(campo, None)
        juegos.append(juego)
    return {"juegos": juegos}


class CambioEstado(BaseModel):
    estado: EstadoJuego
    # Solo al aprobar: a qué grupos se asigna. Sin indicarlo, se conservan los que ya tenía y, si no
    # tenía ninguno, se asigna a todos los grupos del docente (así «aprobar» funciona como siempre).
    ids_grupos: list[uuid.UUID] | None = Field(default=None, max_length=100)


async def _grupos_del_docente(conn: asyncpg.Connection, id_docente: uuid.UUID, ids: list[uuid.UUID]) -> list[uuid.UUID]:
    """Comprueba que TODOS los grupos pedidos son del docente; si alguno no lo es, responde como si no existiera."""
    unicos = list(dict.fromkeys(ids))
    propios = await conn.fetch(
        "SELECT id_grupo FROM grupos WHERE id_docente = $1 AND id_grupo = ANY($2::uuid[])", id_docente, unicos
    )
    if len(propios) != len(unicos):
        raise HTTPException(status_code=404, detail="Alguno de los grupos no existe.")
    return unicos


async def _reemplazar_asignacion(conn: asyncpg.Connection, id_juego: uuid.UUID, ids_grupos: list[uuid.UUID]) -> None:
    await conn.execute("DELETE FROM juegos_grupos WHERE id_juego = $1", id_juego)
    if ids_grupos:
        await conn.execute(
            "INSERT INTO juegos_grupos (id_juego, id_grupo) SELECT $1, UNNEST($2::uuid[])", id_juego, ids_grupos
        )


async def _asignar_al_aprobar(
    conn: asyncpg.Connection, id_juego: uuid.UUID, id_docente: uuid.UUID, ids_grupos: list[uuid.UUID] | None
) -> None:
    if ids_grupos is not None:
        await _reemplazar_asignacion(conn, id_juego, await _grupos_del_docente(conn, id_docente, ids_grupos))
    elif not await conn.fetchval("SELECT 1 FROM juegos_grupos WHERE id_juego = $1 LIMIT 1", id_juego):
        await conn.execute(
            "INSERT INTO juegos_grupos (id_juego, id_grupo) SELECT $1, id_grupo FROM grupos WHERE id_docente = $2",
            id_juego, id_docente,
        )


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
        async with conn.transaction():
            if datos.estado == "aprobado":
                await _asignar_al_aprobar(conn, id_juego, docente["id"], datos.ids_grupos)
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
            grupos = await conn.fetchval(
                "SELECT COALESCE(array_agg(id_grupo::text ORDER BY id_grupo), '{}') FROM juegos_grupos WHERE id_juego = $1",
                id_juego,
            )
    return {**dict(resultado), "id_juego": str(resultado["id_juego"]), "grupos": grupos}


class AsignacionGrupos(BaseModel):
    ids_grupos: list[uuid.UUID] = Field(max_length=100)


@router.put("/juegos/{id_juego}/grupos")
async def asignar_juego_a_grupos(
    id_juego: uuid.UUID,
    datos: AsignacionGrupos,
    docente: dict = Depends(docente_actual),
    pool: asyncpg.Pool = Depends(get_db_pool),
):
    """Elige qué grupos del docente ven este juego (reemplaza la selección anterior; vacía = ninguno)."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            existe = await conn.fetchval(
                "SELECT 1 FROM juegos_generados WHERE id_juego = $1 AND id_docente = $2 FOR UPDATE",
                id_juego, docente["id"],
            )
            if not existe:
                raise HTTPException(status_code=404, detail="Ese juego no existe.")
            ids = await _grupos_del_docente(conn, docente["id"], datos.ids_grupos)
            await _reemplazar_asignacion(conn, id_juego, ids)
    return {"id_juego": str(id_juego), "grupos": [str(i) for i in ids]}


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
