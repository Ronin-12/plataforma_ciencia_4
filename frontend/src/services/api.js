const API_URL = "http://127.0.0.1:8000";

function normalizarJuego(contenido) {
  if (typeof contenido === "string") {
    try {
      return JSON.parse(contenido);
    } catch {
      return null;
    }
  }
  return contenido && typeof contenido === "object" ? contenido : null;
}

export const api = {
  loginDocente: async (email, password) => {
    const response = await fetch(`${API_URL}/docentes/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error("Credenciales incorrectas");
    return response.json();
  },
  // NUEVA FUNCIÓN: Obtener los juegos del docente para el alumno
  obtenerJuegosDocente: async (id_docente) => {
    const response = await fetch(`${API_URL}/ia/juegos/${id_docente}`);
    if (!response.ok) throw new Error("No se pudieron cargar los juegos");
    const data = await response.json();
    return (data.juegos ?? []).map((juego) => {
      const contenido = normalizarJuego(juego.contenido_juego ?? juego.juego);
      return {
        ...juego,
        contenido_juego: contenido,
        titulo: juego.titulo ?? contenido?.titulo ?? "Aventura de ciencias",
      };
    });
  },
  // Ahora recibe el token para extraer el id_docente
  generarJuego: async (textoPrompt, token) => {
    // Decodificamos el token JWT para sacar el ID (está en el campo "sub")
    const payload = JSON.parse(atob(token.split(".")[1]));
    const id_docente = payload.sub;

    const response = await fetch(`${API_URL}/ia/generar-juego`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        texto_prompt: textoPrompt,
        id_docente: id_docente 
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Error al generar el juego");
    }
    
    const data = await response.json();
    
    // 👇 AQUÍ ESTÁ EL CAMBIO:
    // Como en Python devolvemos {"id_juego": "...", "juego": {...}},
    // extraemos solo el objeto "juego" para pasárselo al VisorJuego.
    return data.juego; 
  },
};
