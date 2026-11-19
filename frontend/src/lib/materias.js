import {
  BookOpen,
  Calculator,
  FlaskConical,
  Globe2,
  HeartHandshake,
  Landmark,
  Languages,
  Palette,
  Shapes,
} from 'lucide-react';

/* ───────────── Materias de Mupi ─────────────
   Cada actividad pertenece a una materia. Así el alumno sabe de qué es cada juego
   y puede filtrar por materia en lugar de ver una lista larga y revuelta.

   CÓMO SE SABE LA MATERIA DE UN JUEGO (en este orden):
   1. `juego.materia`: el campo que guarda el backend (migración 006). Es la fuente de verdad.
   2. `contenido_juego.materia`: por si el JSON del juego ya la trae.
   3. El prefijo «Materia: X.» que añadía la versión anterior del generador al pedido
      (solo para actividades viejas; solo el docente recibe `prompt_original`).
   4. Respaldo: se adivina por palabras clave del título y las preguntas.
      Con la materia guardada en la base, este paso solo se usa en actividades antiguas. */

export const MATERIAS = [
  {
    id: 'ciencias',
    nombre: 'Ciencias Naturales',
    corto: 'Ciencias',
    Icono: FlaskConical,
    color: '#2bc4a8',
    suave: '#dcf7f0',
    tinta: '#0d5b4d',
    claves: ['ciencia', 'planta', 'animal', 'vertebrad', 'invertebrad', 'hueso', 'esqueleto', 'cuerpo humano', 'celula', 'energia', 'materia', 'mezcla', 'ecosistema', 'ciclo del agua', 'fotosintesis', 'planeta', 'sistema solar', 'luna', 'luz', 'sonido', 'iman', 'fuerza', 'aliment', 'nutricion', 'salud', 'seres vivos', 'organo', 'semilla', 'insecto', 'mamifero', 'reptil', 'experimento'],
  },
  {
    id: 'matematicas',
    nombre: 'Matemáticas',
    corto: 'Matemáticas',
    Icono: Calculator,
    color: '#6b46c1',
    suave: '#ece6ff',
    tinta: '#3d2380',
    claves: ['matemat', 'suma', 'resta', 'multiplica', 'divis', 'fraccion', 'numero', 'decimal', 'geometr', 'figura', 'triangulo', 'cuadrado', 'perimetro', 'area', 'medida', 'calcul', 'tabla del', 'problema', 'porcentaje'],
  },
  {
    id: 'espanol',
    nombre: 'Español',
    corto: 'Español',
    Icono: BookOpen,
    color: '#ff7f6e',
    suave: '#ffe7e3',
    tinta: '#8a2a1d',
    claves: ['espanol', 'lectura', 'leer', 'cuento', 'ortografia', 'gramatica', 'verbo', 'sustantivo', 'adjetivo', 'oracion', 'poema', 'leyenda', 'fabula', 'palabra', 'silaba', 'acento', 'texto', 'rima', 'signos de puntuacion'],
  },
  {
    id: 'historia',
    nombre: 'Historia',
    corto: 'Historia',
    Icono: Landmark,
    color: '#e0a400',
    suave: '#fff4cf',
    tinta: '#6b4e00',
    claves: ['historia', 'independencia', 'revolucion', 'prehispanic', 'mexica', 'azteca', 'maya', 'olmeca', 'conquista', 'colonia', 'virreinato', 'heroe', 'siglo', 'antigu', 'reforma'],
  },
  {
    id: 'geografia',
    nombre: 'Geografía',
    corto: 'Geografía',
    Icono: Globe2,
    color: '#3b9ae1',
    suave: '#e0f0ff',
    tinta: '#124a75',
    claves: ['geografia', 'mapa', 'continente', 'pais', 'relieve', 'clima', 'rio', 'montana', 'oceano', 'region', 'poblacion', 'entidad', 'capital', 'paisaje', 'coordenada'],
  },
  {
    id: 'civica',
    nombre: 'Formación Cívica y Ética',
    corto: 'Cívica y Ética',
    Icono: HeartHandshake,
    color: '#e05a9c',
    suave: '#ffe3f1',
    tinta: '#7a1f4f',
    claves: ['civica', 'etica', 'valores', 'derecho', 'convivencia', 'respeto', 'democracia', 'emocion', 'ciudadan', 'responsabilidad', 'igualdad', 'diversidad', 'acoso'],
  },
  {
    id: 'ingles',
    nombre: 'Inglés',
    corto: 'Inglés',
    Icono: Languages,
    color: '#5cc46f',
    suave: '#e4f6e6',
    tinta: '#1f5a2a',
    claves: ['ingles', 'english', 'vocabulary', 'colors', 'numbers', 'greetings', 'family members', 'verb to be'],
  },
  {
    id: 'artes',
    nombre: 'Artes',
    corto: 'Artes',
    Icono: Palette,
    color: '#f08a24',
    suave: '#ffeedd',
    tinta: '#7a3e00',
    claves: ['arte', 'musica', 'pintura', 'dibujo', 'danza', 'teatro', 'escultura', 'instrumento', 'colores primarios', 'ritmo'],
  },
];

export const MATERIA_GENERAL = {
  id: 'general',
  nombre: 'Otras actividades',
  corto: 'Otras',
  Icono: Shapes,
  color: '#8a80b0',
  suave: '#efedf7',
  tinta: '#3b3561',
  claves: [],
};

// Grados que reconoce el backend (1 a 6 de primaria). El número es el que se guarda en la base.
export const GRADOS = [1, 2, 3, 4, 5, 6];

/** «4.º de primaria» a partir del número de grado. */
export const nombreDeGrado = (grado) => (grado ? `${grado}.º de primaria` : null);

const porId = Object.fromEntries([...MATERIAS, MATERIA_GENERAL].map((m) => [m.id, m]));

/** Quita acentos y pasa a minúsculas para comparar palabras sin importar cómo se escribieron. */
export function normalizar(texto) {
  return String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca una materia por id o por nombre («Matemáticas», «matematicas», «Ciencias»...). */
export function buscarMateria(valor) {
  if (!valor) return null;
  if (porId[valor]) return porId[valor];
  const v = normalizar(valor);
  return MATERIAS.find((m) => normalizar(m.nombre) === v || normalizar(m.corto) === v || v.startsWith(normalizar(m.corto))) ?? null;
}

/** Lee «Materia: X.» del pedido original del docente, si lo tiene. */
function materiaDelPedido(prompt) {
  const coincidencia = /Materia:\s*([^.\n]+)\./i.exec(String(prompt ?? ''));
  return coincidencia ? buscarMateria(coincidencia[1].trim()) : null;
}

/** Lee «Grado: X.» del pedido original del docente, si lo tiene. */
export function gradoDelPedido(prompt) {
  const coincidencia = /Grado:\s*([^\n]+?)\.(\s|$)/i.exec(String(prompt ?? ''));
  return coincidencia ? coincidencia[1].trim() : null;
}

/** Junta todo el texto visible de un juego (título, instrucciones, preguntas) para adivinar su materia. */
function textoDelJuego(juego) {
  const contenido = juego?.contenido_juego ?? {};
  const partes = [juego?.titulo, contenido.titulo, contenido.instrucciones];
  const preguntas = contenido.preguntas ?? contenido.evaluacion?.preguntas ?? [];
  for (const p of preguntas) partes.push(typeof p === 'string' ? p : Object.values(p ?? {}).flat().join(' '));
  for (const s of contenido.secciones ?? []) partes.push(s?.titulo, s?.explicacion);
  return normalizar(partes.filter(Boolean).join(' '));
}

function adivinarMateria(juego) {
  const texto = textoDelJuego(juego);
  let mejor = null;
  let puntos = 0;
  for (const materia of MATERIAS) {
    // La clave debe empezar una palabra: así «arte» no coincide con «parte» ni «rio» con «misterio».
    const aciertos = materia.claves.reduce((total, clave) => total + (new RegExp(`(^|[^a-z])${clave}`).test(texto) ? 1 : 0), 0);
    if (aciertos > puntos) {
      mejor = materia;
      puntos = aciertos;
    }
  }
  return mejor;
}

/** Materia de un juego (ver el orden de prioridad arriba). Nunca devuelve null. */
export function materiaDeJuego(juego) {
  return (
    buscarMateria(juego?.materia) ??
    buscarMateria(juego?.contenido_juego?.materia) ??
    materiaDelPedido(juego?.prompt_original) ??
    adivinarMateria(juego) ??
    MATERIA_GENERAL
  );
}
