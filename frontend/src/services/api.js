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
  // 1. LOGIN DOCENTE
  loginDocente: async (email, password) => {
    const response = await fetch(`${API_URL}/docentes/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error("Credenciales incorrectas");
    return response.json();
  },

  // 2. OBTENER JUEGOS (Para el alumno)
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

  // 3. GENERAR JUEGO CON IA (Para el docente)
  generarJuego: async (textoPrompt, token, tipoActividad = "sorpresa") => {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const id_docente = payload.sub;

    const response = await fetch(`${API_URL}/ia/generar-juego`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        texto_prompt: textoPrompt,
        id_docente,
        tipo_actividad: tipoActividad,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Error al generar el juego");
    }
    
    const data = await response.json();
    return data.juego; 
  },

  // 4. OBTENER ALUMNOS DEL DOCENTE
  obtenerAlumnos: async (idDocente) => {
    const response = await fetch(`${API_URL}/alumnos/docente/${idDocente}`);
    if (!response.ok) throw new Error("Error al cargar alumnos");
    const data = await response.json();
    return data.alumnos;
  },

  // 5. CREAR UN NUEVO ALUMNO
  crearAlumno: async (nombre, idDocente) => {
    const response = await fetch(`${API_URL}/alumnos/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        nombre_pila: nombre,
        avatar_url: null,
        id_docente: idDocente,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const detalle = Array.isArray(errorData.detail)
        ? errorData.detail.map((error) => error.msg).join(" ")
        : errorData.detail;
      throw new Error(detalle || "No se pudo crear al alumno. Revisa los datos e inténtalo de nuevo.");
    }
    return response.json();
  },
};
