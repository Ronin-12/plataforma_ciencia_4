"""
Rutas para la generación de contenido con Inteligencia Artificial (Gemini).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from google.genai.errors import ServerError
from app.core.config import settings

router = APIRouter(prefix="/ia", tags=["Inteligencia Artificial"])

class PromptJuego(BaseModel):
    texto_prompt: str

@router.post("/generar-juego")
async def generar_juego_con_ia(datos: PromptJuego):
    """
    Recibe un prompt del docente y usa Gemini para generar la estructura de un juego.
    """
    try:
        # Inicializamos el cliente con la llave del .env
        client = genai.Client(api_key=settings.GEMINI_API_KEY)
        
        # Le pedimos a Gemini que genere un JSON estricto
        instruccion = f"""
        Eres un experto en diseño de juegos educativos para niños de 4.º grado de primaria.
        El maestro te pide: "{datos.texto_prompt}"
        
        Genera un juego interactivo en formato JSON. El JSON debe tener exactamente esta estructura:
        {{
            "titulo": "Nombre del juego",
            "instrucciones": "Qué debe hacer el niño",
            "preguntas": [
                {{
                    "pregunta": "¿Pregunta 1?",
                    "opciones": ["Opción A", "Opción B", "Opción C", "Opción D"],
                    "correcta": 0
                }}
            ]
        }}
        
        Reglas:
        1. Genera exactamente 3 preguntas.
        2. El campo "correcta" debe ser el índice (0, 1, 2 o 3) de la respuesta correcta en el arreglo de opciones.
        3. Devuelve SOLO el JSON válido, sin bloques de código markdown (sin ```json), sin texto extra.
        """
        
        # Si el modelo principal está temporalmente saturado, intenta el modelo estable alternativo.
        try:
            response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=instruccion,
            )
        except ServerError as error:
            if error.code != 503 or settings.GEMINI_FALLBACK_MODEL == settings.GEMINI_MODEL:
                raise

            response = client.models.generate_content(
                model=settings.GEMINI_FALLBACK_MODEL,
                contents=instruccion,
            )

        if not response.text:
            raise HTTPException(
                status_code=502,
                detail="Gemini no devolvió contenido para generar el juego.",
            )
        
        return {"juego_generado": response.text}
        
    except HTTPException:
        raise
    except ServerError as e:
        if e.code == 503:
            raise HTTPException(
                status_code=503,
                detail="Gemini está temporalmente saturado. Intenta de nuevo en unos minutos.",
            ) from e
        raise HTTPException(status_code=502, detail=f"Error con la IA: {str(e)}") from e
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Error con la IA: {str(e)}") from e
