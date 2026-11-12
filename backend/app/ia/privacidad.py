"""RNF-04: a la IA nunca se le envían nombres de alumnos.

Los alumnos son niños de 9 años, así que sus nombres no deben salir del sistema hacia un
proveedor externo. Este módulo busca en un texto los nombres de los alumnos del docente.

Regla de coincidencia (explicada porque tiene un matiz): un nombre cuenta solo si está escrito
con MAYÚSCULA inicial y se ignoran los acentos. Así «Sofía» y «Sofia» coinciden, pero la flor
«rosa» (minúscula) no se confunde con una alumna llamada Rosa. Nombres compuestos
(«Luis Ángel») se buscan completos y también por cada palabra de 3 letras o más.
"""

import re
import unicodedata

import asyncpg


def _sin_acentos(texto: str) -> str:
    """Quita acentos conservando la longitud (para que las posiciones coincidan con el original)."""
    salida = []
    for caracter in texto:
        base = "".join(c for c in unicodedata.normalize("NFKD", caracter) if not unicodedata.combining(c))
        salida.append(base if len(base) == 1 else caracter)
    return "".join(salida)


def _patron(candidato: str) -> re.Pattern:
    """Primera letra en mayúscula exacta; el resto, sin distinguir mayúsculas; palabras completas."""
    palabras = _sin_acentos(candidato).split()
    interior = r"\s+".join(re.escape(p) for p in [palabras[0][1:]] + palabras[1:])
    return re.compile(rf"(?<!\w){re.escape(palabras[0][0].upper())}(?i:{interior})(?!\w)")


def _candidatos(nombres: list[str]) -> list[str]:
    candidatos: set[str] = set()
    for nombre in nombres:
        nombre = " ".join(nombre.split())
        if len(nombre) >= 3:
            candidatos.add(nombre)
        candidatos.update(palabra for palabra in nombre.split() if len(palabra) >= 3)
    # Los más largos primero: «Luis Ángel» se reemplaza antes que «Luis».
    return sorted(candidatos, key=len, reverse=True)


def _coincidencias(texto: str, nombres: list[str]) -> list[tuple[int, int, str]]:
    plano = _sin_acentos(texto)
    encontradas: list[tuple[int, int, str]] = []
    for candidato in _candidatos(nombres):
        for m in _patron(candidato).finditer(plano):
            if not any(m.start() < fin and inicio < m.end() for inicio, fin, _ in encontradas):
                encontradas.append((m.start(), m.end(), texto[m.start():m.end()]))
    return sorted(encontradas)


def encontrar_nombres(texto: str, nombres: list[str]) -> list[str]:
    """Nombres de alumnos (tal como aparecen en el texto), sin repetidos, en orden de aparición."""
    return list(dict.fromkeys(parte for _, _, parte in _coincidencias(texto, nombres)))


def ocultar_nombres(texto: str, nombres: list[str]) -> tuple[str, list[str]]:
    """Cambia cada nombre de alumno por «un alumno». Devuelve (texto_limpio, nombres_encontrados)."""
    encontradas = _coincidencias(texto, nombres)
    limpio, cursor = [], 0
    for inicio, fin, _ in encontradas:
        limpio.append(texto[cursor:inicio])
        limpio.append("un alumno")
        cursor = fin
    limpio.append(texto[cursor:])
    return "".join(limpio), list(dict.fromkeys(parte for _, _, parte in encontradas))


async def nombres_de_alumnos(conn: asyncpg.Connection, id_docente) -> list[str]:
    """Nombres de pila de todos los alumnos de las aulas del docente (activos o no)."""
    filas = await conn.fetch(
        "SELECT a.nombre_pila FROM alumnos a JOIN grupos g ON g.id_grupo = a.id_grupo WHERE g.id_docente = $1",
        id_docente,
    )
    return [fila["nombre_pila"] for fila in filas]
