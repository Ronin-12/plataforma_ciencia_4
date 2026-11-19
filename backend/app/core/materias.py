"""Materias y grados que reconoce la plataforma (primaria, 1.º a 6.º).

Los `id` son los mismos que usa el frontend (frontend/src/lib/materias.js): si se agrega una
materia, hay que agregarla en los dos lados.
"""

from typing import Literal

MateriaId = Literal["ciencias", "matematicas", "espanol", "historia", "geografia", "civica", "ingles", "artes"]

NOMBRES_MATERIA: dict[str, str] = {
    "ciencias": "Ciencias Naturales",
    "matematicas": "Matemáticas",
    "espanol": "Español",
    "historia": "Historia",
    "geografia": "Geografía",
    "civica": "Formación Cívica y Ética",
    "ingles": "Inglés",
    "artes": "Artes",
}

GRADO_MIN, GRADO_MAX = 1, 6

# Lo que se asume cuando el docente no indica materia o grado (el piloto empezó en 4.º de Ciencias).
MATERIA_PREDETERMINADA: str = "ciencias"
GRADO_PREDETERMINADO: int = 4


def edad_del_grado(grado: int) -> int:
    """Edad típica de un grupo: 1.º de primaria ≈ 6 años, 4.º ≈ 9, 6.º ≈ 11."""
    return grado + 5


def perfil_pedagogico(materia: str, grado: int) -> str:
    """Frase que le dice a la IA para quién y de qué materia es la actividad."""
    return f"{edad_del_grado(grado)} años ({grado}.º de primaria), materia {NOMBRES_MATERIA[materia]}"
