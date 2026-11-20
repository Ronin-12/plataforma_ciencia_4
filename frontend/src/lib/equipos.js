// Dibujos que puede tener un equipo. Los identificadores son los mismos que acepta el servidor (routers/equipos.py).
export const ICONOS_EQUIPO = [
  { id: "estrella", emoji: "⭐", nombre: "Estrella" },
  { id: "cohete", emoji: "🚀", nombre: "Cohete" },
  { id: "luna", emoji: "🌙", nombre: "Luna" },
  { id: "delfin", emoji: "🐬", nombre: "Delfín" },
  { id: "aguila", emoji: "🦅", nombre: "Águila" },
  { id: "zorro", emoji: "🦊", nombre: "Zorro" },
  { id: "tortuga", emoji: "🐢", nombre: "Tortuga" },
  { id: "mariposa", emoji: "🦋", nombre: "Mariposa" },
  { id: "planta", emoji: "🌱", nombre: "Planta" },
  { id: "volcan", emoji: "🌋", nombre: "Volcán" },
];

export const emojiDeEquipo = (id) => ICONOS_EQUIPO.find((i) => i.id === id)?.emoji ?? "⭐";

// Máximo de actividades en una misión (igual que MAX_JUEGOS_MISION en routers/equipos.py).
export const MAX_JUEGOS_MISION = 5;

export const MODOS_MISION = [
  { id: "todos", nombre: "Todos juegan todo", ayuda: "Cada integrante juega todas las actividades. La barra es el promedio de todas las partes." },
  { id: "roles", nombre: "Un juego para cada quien", ayuda: "A cada integrante le toca una actividad, repartidas en orden. El equipo avanza cuando cada quien cumple su parte." },
];

// Texto corto de lo que lleva un equipo, según el modo de la misión.
export function detalleDeEquipo(equipo, modo) {
  return modo === "roles"
    ? `${equipo.ya_jugaron} de ${equipo.integrantes} ya cumplieron su parte.`
    : `${equipo.ya_jugaron} de ${equipo.integrantes} ya jugaron todo. Cuenta el mejor intento de cada uno.`;
}
