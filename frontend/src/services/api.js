const API_URL = "http://127.0.0.1:8000";

export const api = {
  loginDocente: async (email, password) => {
    const response = await fetch(`${API_URL}/docentes/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }), // Enviamos exactamente lo que pide el backend
    });

    if (!response.ok) {
      throw new Error("Credenciales incorrectas");
    }
    return response.json();
  },
};