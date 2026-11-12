"""Proveedor de demostración: respuestas de ejemplo, sin internet, sin clave y sin gastar créditos.

Sirve para presentar el proyecto o probar la interfaz. Todo lo que produce lleva «(demo)» en el
título para que nadie lo confunda con contenido generado por una IA real.
"""

import json

from app.ia.base import ProveedorIA, Solicitud

# Cuatro retos por tipo, sobre «los seres vivos». El docente puede editarlos como cualquier borrador.
_RETOS = {
    "quiz": [
        {"pregunta": "¿Qué necesitan las plantas para fabricar su alimento?", "opciones": ["Luz, agua y aire", "Solo tierra", "Plástico", "Ruido"], "correcta": 0},
        {"pregunta": "¿Qué parte de la planta absorbe el agua?", "opciones": ["La flor", "La raíz", "El fruto", "La semilla"], "correcta": 1},
        {"pregunta": "¿Cuál de estos es un ser vivo?", "opciones": ["Una piedra", "Un río", "Un gato", "Una nube"], "correcta": 2},
        {"pregunta": "¿Qué necesitan todos los animales para vivir?", "opciones": ["Alimento y agua", "Zapatos", "Juguetes", "Televisión"], "correcta": 0},
    ],
    "verdadero_falso": [
        {"afirmacion": "Las plantas son seres vivos.", "correcta": True, "explicacion": "Nacen, crecen, se reproducen y mueren."},
        {"afirmacion": "Las rocas necesitan alimento para vivir.", "correcta": False, "explicacion": "Las rocas no son seres vivos."},
        {"afirmacion": "Los animales respiran.", "correcta": True, "explicacion": "Todos los animales necesitan respirar."},
        {"afirmacion": "Las plantas no necesitan agua.", "correcta": False, "explicacion": "Sin agua, las plantas se marchitan."},
    ],
    "ordenar": [
        {"consigna": "Ordena el ciclo de vida de una planta.", "elementos": ["Flor", "Semilla", "Planta joven", "Fruto"], "orden_correcto": ["Semilla", "Planta joven", "Flor", "Fruto"]},
        {"consigna": "Ordena cómo crece una mariposa.", "elementos": ["Mariposa", "Huevo", "Pupa", "Oruga"], "orden_correcto": ["Huevo", "Oruga", "Pupa", "Mariposa"]},
        {"consigna": "Ordena los pasos para germinar un frijol.", "elementos": ["Regar", "Poner el frijol en algodón", "Esperar", "Ver el brote"], "orden_correcto": ["Poner el frijol en algodón", "Regar", "Esperar", "Ver el brote"]},
    ],
    "relacionar": [
        {"consigna": "Une cada parte de la planta con su función.", "pares": [{"izquierda": "Raíz", "derecha": "Absorbe agua"}, {"izquierda": "Hoja", "derecha": "Recibe la luz"}, {"izquierda": "Tallo", "derecha": "Sostiene la planta"}, {"izquierda": "Flor", "derecha": "Produce semillas"}]},
        {"consigna": "Une cada animal con su alimento.", "pares": [{"izquierda": "Vaca", "derecha": "Pasto"}, {"izquierda": "León", "derecha": "Carne"}, {"izquierda": "Abeja", "derecha": "Néctar"}]},
        {"consigna": "Une cada ser vivo con su hogar.", "pares": [{"izquierda": "Pez", "derecha": "Agua"}, {"izquierda": "Ave", "derecha": "Nido"}, {"izquierda": "Topo", "derecha": "Tierra"}]},
    ],
    "memoria": [
        {"consigna": "Encuentra las parejas de seres vivos y su grupo.", "pares": [{"izquierda": "Rosa", "derecha": "Planta"}, {"izquierda": "Perro", "derecha": "Animal"}, {"izquierda": "Champiñón", "derecha": "Hongo"}, {"izquierda": "Bacteria", "derecha": "Microbio"}]},
        {"consigna": "Encuentra la pareja de cada parte y su función.", "pares": [{"izquierda": "Hoja", "derecha": "Luz"}, {"izquierda": "Raíz", "derecha": "Agua"}, {"izquierda": "Flor", "derecha": "Semillas"}]},
        {"consigna": "Encuentra la pareja animal-cría.", "pares": [{"izquierda": "Gallina", "derecha": "Pollito"}, {"izquierda": "Vaca", "derecha": "Becerro"}, {"izquierda": "Perra", "derecha": "Cachorro"}]},
    ],
    "completar": [
        {"frase": "Las plantas fabrican su alimento con la luz del ___.", "respuesta": "sol", "pista": "Es una estrella."},
        {"frase": "La parte de la planta que absorbe agua es la ___.", "respuesta": "raíz", "pista": "Está bajo la tierra."},
        {"frase": "Los animales que comen plantas se llaman ___.", "respuesta": "herbívoros", "pista": "Empieza con «her»."},
        {"frase": "Los seres vivos nacen, crecen, se reproducen y ___.", "respuesta": "mueren", "pista": "Es el final del ciclo."},
    ],
}

_NOMBRES_TIPO = {
    "quiz": "Quiz", "verdadero_falso": "¿Cierto o falso?", "ordenar": "Ordena los pasos",
    "relacionar": "Une las parejas", "memoria": "Memoria", "completar": "Completa la frase",
}

_TEMAS = [
    {"titulo": "Los seres vivos", "descripcion": "Qué distingue a un ser vivo de algo sin vida.",
     "contenido": "Los seres vivos nacen, crecen, se alimentan, respiran, se reproducen y mueren. Las plantas y los animales son seres vivos. Las rocas y el agua no lo son."},
    {"titulo": "Las plantas", "descripcion": "Partes de la planta y cómo fabrica su alimento.",
     "contenido": "La raíz absorbe agua y sujeta la planta. El tallo la sostiene. Las hojas reciben la luz del sol. Con luz, agua y aire, la planta fabrica su alimento. La flor produce semillas."},
    {"titulo": "El ciclo del agua", "descripcion": "Cómo el agua cambia de estado y vuelve a caer.",
     "contenido": "El sol calienta el agua y se evapora. El vapor sube y se enfría formando nubes. Las gotas caen como lluvia. El agua vuelve a ríos y mares y el ciclo continúa."},
]


def _juego(tipo: str, titulo: str) -> dict:
    return {
        "titulo": f"{titulo} (demo)",
        "instrucciones": "Lee con calma y elige tu respuesta. ¡Tú puedes!",
        "tipo_actividad": tipo,
        "preguntas": _RETOS[tipo],
    }


def _clase(tipo: str, titulo: str) -> dict:
    return {
        "titulo": f"{titulo} (demo)",
        "instrucciones": "Lee cada parte, responde el mini-reto y avanza.",
        "tipo_actividad": "clase",
        "secciones": [
            {"titulo": "Seres vivos y cosas sin vida", "explicacion": "Los seres vivos nacen, crecen, se alimentan y mueren. Las rocas no hacen nada de eso.",
             "ejemplo": "Un gato crece y come; una piedra siempre es igual.",
             "mini_reto": {"tipo": "verdadero_falso", "afirmacion": "Una roca es un ser vivo.", "correcta": False, "explicacion": "Las rocas no nacen ni crecen."}},
            {"titulo": "Cómo comen las plantas", "explicacion": "Las plantas fabrican su alimento con luz, agua y aire.",
             "ejemplo": "Una planta en la ventana crece hacia la luz.",
             "mini_reto": {"tipo": "quiz", "pregunta": "¿Qué necesita una planta para fabricar su alimento?", "opciones": ["Luz, agua y aire", "Solo tierra", "Plástico", "Ruido"], "correcta": 0}},
            {"titulo": "Las partes de la planta", "explicacion": "La raíz absorbe agua, el tallo sostiene y las hojas reciben la luz.",
             "ejemplo": "En una lechuga comemos sobre todo las hojas.",
             "mini_reto": {"tipo": "quiz", "pregunta": "¿Qué parte absorbe el agua?", "opciones": ["La flor", "La raíz", "El fruto", "La hoja"], "correcta": 1}},
        ],
        "evaluacion": {**_juego(tipo, "Evaluación final"), "titulo": "Evaluación final (demo)"},
    }


class ProveedorDemo(ProveedorIA):
    nombre = "el modo demo"
    consume_creditos = False

    def problema_de_configuracion(self) -> str | None:
        return None

    def modelos(self) -> list[str]:
        return ["demo"]

    async def generar_json(self, solicitud: Solicitud, modelo: str) -> str:
        tipo = solicitud.tipo if solicitud.tipo in _RETOS else "quiz"  # «sorpresa» → quiz
        titulo = (solicitud.tema or "Ciencias Naturales").strip()[:60]
        if solicitud.tarea == "temas":
            return json.dumps({"temas": _TEMAS}, ensure_ascii=False)
        if solicitud.tarea == "clase":
            return json.dumps(_clase(tipo, titulo), ensure_ascii=False)
        return json.dumps(_juego(tipo, titulo), ensure_ascii=False)
