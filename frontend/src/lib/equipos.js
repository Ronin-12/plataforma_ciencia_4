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
