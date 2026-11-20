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
    "clasificar": [
        {"consigna": "Clasifica cada cosa: ¿es un ser vivo o no?", "categorias": ["Ser vivo", "Sin vida"],
         "elementos": [{"texto": "Gato", "categoria": "Ser vivo"}, {"texto": "Roca", "categoria": "Sin vida"}, {"texto": "Rosa", "categoria": "Ser vivo"}, {"texto": "Nube", "categoria": "Sin vida"}, {"texto": "Pez", "categoria": "Ser vivo"}]},
        {"consigna": "¿Dónde vive cada animal?", "categorias": ["Agua", "Tierra", "Aire"],
         "elementos": [{"texto": "Delfín", "categoria": "Agua"}, {"texto": "Vaca", "categoria": "Tierra"}, {"texto": "Águila", "categoria": "Aire"}, {"texto": "Tortuga marina", "categoria": "Agua"}, {"texto": "Perro", "categoria": "Tierra"}, {"texto": "Colibrí", "categoria": "Aire"}]},
        {"consigna": "¿Qué come cada animal?", "categorias": ["Plantas", "Carne"],
         "elementos": [{"texto": "Conejo", "categoria": "Plantas"}, {"texto": "León", "categoria": "Carne"}, {"texto": "Vaca", "categoria": "Plantas"}, {"texto": "Águila", "categoria": "Carne"}]},
    ],
    "linea_tiempo": [
        {"consigna": "Coloca cada etapa en la vida de una planta.", "eventos": [{"etiqueta": "Etapa 1", "texto": "Se siembra la semilla"}, {"etiqueta": "Etapa 2", "texto": "Brota la raíz"}, {"etiqueta": "Etapa 3", "texto": "Crecen las hojas"}, {"etiqueta": "Etapa 4", "texto": "Aparece la flor"}]},
        {"consigna": "Coloca cada etapa en la vida de una mariposa.", "eventos": [{"etiqueta": "Primero", "texto": "La mariposa pone huevos"}, {"etiqueta": "Después", "texto": "Nace la oruga"}, {"etiqueta": "Luego", "texto": "La oruga forma una pupa"}, {"etiqueta": "Al final", "texto": "Sale la mariposa"}]},
        {"consigna": "Coloca los momentos del día.", "eventos": [{"etiqueta": "6:00", "texto": "Sale el sol"}, {"etiqueta": "12:00", "texto": "El sol está en lo más alto"}, {"etiqueta": "18:00", "texto": "Se pone el sol"}]},
    ],
    "completar": [
        {"frase": "Las plantas fabrican su alimento con la luz del ___.", "respuesta": "sol", "pista": "Es una estrella."},
        {"frase": "La parte de la planta que absorbe agua es la ___.", "respuesta": "raíz", "pista": "Está bajo la tierra."},
        {"frase": "Los animales que comen plantas se llaman ___.", "respuesta": "herbívoros", "pista": "Empieza con «her»."},
        {"frase": "Los seres vivos nacen, crecen, se reproducen y ___.", "respuesta": "mueren", "pista": "Es el final del ciclo."},
    ],
    "hipotesis": [
        {"escenario": "Ponemos una planta en un cuarto oscuro durante una semana y la regamos todos los días.",
         "opciones": ["Crece más verde y fuerte", "Se pone débil y pálida", "Se convierte en una flor roja"], "correcta": 1,
         "resultado": "Después de una semana las hojas están pálidas y el tallo largo y delgado.",
         "explicacion": "Sin luz la planta no puede fabricar su alimento, aunque tenga agua."},
        {"escenario": "Dejamos un vaso con agua y hielo al sol durante la tarde.",
         "opciones": ["El hielo se derrite y el vaso se moja por fuera", "El hielo se hace más grande", "El agua se congela más"], "correcta": 0,
         "resultado": "El hielo se derrite y aparecen gotitas de agua por fuera del vaso.",
         "explicacion": "El calor derrite el hielo; el vapor del aire se enfría al tocar el vaso y forma gotas."},
        {"escenario": "Ponemos una semilla de frijol en algodón húmedo, sin tierra, junto a una ventana.",
         "opciones": ["No pasa nada porque necesita tierra", "Germina y le sale una raíz", "Se convierte en piedra"], "correcta": 1,
         "resultado": "A los pocos días la semilla se abre y le sale una raíz blanca.",
         "explicacion": "Para germinar una semilla necesita agua y calor; la tierra no es obligatoria al inicio."},
    ],
    "etiquetar": [
        {"consigna": "Pon el nombre de cada parte de la planta.", "esquema": "planta",
         "puntos": [{"numero": 1, "texto": "Flor"}, {"numero": 3, "texto": "Tallo"}, {"numero": 4, "texto": "Raíz"}],
         "explicacion": "La flor produce semillas, el tallo sostiene la planta y la raíz absorbe agua."},
        {"consigna": "Ahora encuentra las hojas y el fruto.", "esquema": "planta",
         "puntos": [{"numero": 2, "texto": "Hoja"}, {"numero": 5, "texto": "Fruto"}, {"numero": 4, "texto": "Raíz"}],
         "explicacion": "Las hojas reciben la luz; el fruto protege las semillas."},
        {"consigna": "Nombra las partes de la célula.", "esquema": "celula",
         "puntos": [{"numero": 1, "texto": "Núcleo"}, {"numero": 2, "texto": "Membrana"}, {"numero": 3, "texto": "Citoplasma"}],
         "explicacion": "El núcleo dirige la célula; la membrana la protege y el citoplasma llena su interior."},
    ],
    "detective": [
        {"consigna": "Una de estas oraciones tiene un error. ¡Encuéntrala!",
         "oraciones": ["Las plantas fabrican su alimento con luz, agua y aire.", "La raíz absorbe el agua del suelo.", "Las hojas son las que absorben el agua de la tierra.", "La flor produce las semillas."],
         "error": 2, "correccion": "Las hojas reciben la luz del sol.",
         "explicacion": "El agua la absorbe la raíz; las hojas reciben la luz."},
        {"consigna": "Busca la oración equivocada sobre el ciclo del agua.",
         "oraciones": ["El sol calienta el agua y se evapora.", "El vapor sube y se enfría.", "Al enfriarse forma nubes.", "Las nubes se convierten en rocas y por eso llueve."],
         "error": 3, "correccion": "Las gotas de las nubes caen como lluvia.",
         "explicacion": "La lluvia es agua que cae de las nubes; las nubes no se vuelven rocas."},
        {"consigna": "Encuentra el error sobre los seres vivos.",
         "oraciones": ["Los seres vivos nacen y crecen.", "Los seres vivos se alimentan.", "Los seres vivos nunca mueren.", "Los seres vivos se reproducen."],
         "error": 2, "correccion": "Todos los seres vivos terminan su ciclo de vida.",
         "explicacion": "Todos los seres vivos tienen un ciclo: nacen, crecen, se reproducen y mueren."},
    ],
}

# Por qué es correcta cada respuesta (el alumno la lee después de contestar). Mismo orden que _RETOS.
_EXPLICACIONES = {
    "quiz": [
        "Con luz, agua y aire la planta fabrica su alimento.",
        "La raíz está bajo la tierra y absorbe el agua que la planta necesita.",
        "Un gato nace, crece, se alimenta y se reproduce: eso lo hace un ser vivo.",
        "Todos los animales necesitan alimento y agua para obtener energía.",
    ],
    "ordenar": [
        "Primero la semilla germina, luego crece, florece y por último da fruto.",
        "La mariposa pasa por cuatro etapas: huevo, oruga, pupa y mariposa.",
        "El frijol necesita agua y tiempo para que le salga el brote.",
    ],
    "relacionar": [
        "Cada parte de la planta cumple una tarea distinta para que viva.",
        "Cada animal come lo que su cuerpo está preparado para digerir.",
        "Cada ser vivo habita el lugar donde encuentra lo que necesita.",
    ],
    "memoria": [
        "Cada ser vivo pertenece a un grupo: plantas, animales, hongos o microbios.",
        "Cada parte de la planta tiene una función que la ayuda a vivir.",
        "Las crías de cada animal tienen un nombre especial.",
    ],
    "clasificar": [
        "Los seres vivos nacen, crecen y se reproducen; las rocas y las nubes no.",
        "Cada animal vive donde encuentra lo que necesita: los peces en el agua, las aves en el aire.",
        "Los herbívoros comen plantas y los carnívoros comen carne.",
    ],
    "linea_tiempo": [
        "Primero germina la semilla; las hojas y la flor aparecen después.",
        "La mariposa pasa por huevo, oruga, pupa y mariposa, siempre en ese orden.",
        "El sol sale en la mañana, está alto al mediodía y se oculta en la tarde.",
    ],
    "completar": [
        "La luz del sol es la energía que usan las plantas para fabricar su alimento.",
        "La raíz absorbe el agua del suelo y sujeta la planta.",
        "Herbívoro significa que se alimenta de plantas.",
        "Todos los seres vivos cumplen un ciclo: nacen, crecen, se reproducen y mueren.",
    ],
}
for _tipo, _textos in _EXPLICACIONES.items():
    for _reto, _texto in zip(_RETOS[_tipo], _textos):
        _reto["explicacion"] = _texto

_NOMBRES_TIPO = {
    "quiz": "Quiz", "verdadero_falso": "¿Cierto o falso?", "ordenar": "Ordena los pasos",
    "relacionar": "Une las parejas", "memoria": "Memoria", "completar": "Completa la frase",
    "clasificar": "Clasifica", "linea_tiempo": "Línea de tiempo",
    "hipotesis": "Laboratorio de hipótesis", "etiquetar": "Etiqueta el esquema", "detective": "Detective de errores",
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
