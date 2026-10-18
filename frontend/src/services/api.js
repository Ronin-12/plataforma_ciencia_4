const API_URL = "http://127.0.0.1:8000";

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

  // 👇 NUEVA FUNCIÓN: Conectar con Gemini
  generarJuego: async (textoPrompt) => {
    const response = await fetch(`${API_URL}/ia/generar-juego`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto_prompt: textoPrompt }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Error al generar el juego");
    }
    
    const data = await response.json();
    // El backend devuelve {"juego_generado": "..."}, extraemos solo el texto del juego
    return data.juego_generado; 
  },
};