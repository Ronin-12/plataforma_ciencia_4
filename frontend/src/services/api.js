// Dirección de la API. En producción se define con VITE_API_URL (archivo frontend/.env.production).
const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

export class ErrorApi extends Error {
  constructor(mensaje, estado, opciones) {
    super(mensaje, opciones);
    this.estado = estado;
  }
}

const MENSAJE_ERROR_SERVIDOR = "Error del servidor. Inténtalo de nuevo en un momento.";

// Se llama cuando el servidor responde 401 a una petición con sesión (token vencido o inválido).
let alExpirarSesion = () => {};

function mensajeDeError(detalle) {
  if (Array.isArray(detalle)) {
    return detalle.map((error) => String(error.msg ?? "").replace(/^Value error, /, "")).join(" ");
  }
  return typeof detalle === "string" ? detalle : "";
}

async function peticion(ruta, { metodo = "GET", cuerpo, token, error = "No se pudo completar la acción." } = {}) {
  const headers = {};
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch (causa) {
    throw new ErrorApi("No se pudo conectar con el servidor. Revisa que la API esté encendida.", 0, { cause: causa });
  }

  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    if (respuesta.status === 401 && token) alExpirarSesion();
    // Un 5xx sin explicación significa que la API está encendida pero algo falló por dentro.
    const respaldo = respuesta.status >= 500 ? MENSAJE_ERROR_SERVIDOR : error;
    throw new ErrorApi(mensajeDeError(datos.detail) || respaldo, respuesta.status);
  }
  return respuesta.json();
}

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
  alExpirarSesion: (funcion) => {
    alExpirarSesion = funcion;
  },

  // --- Docente ---------------------------------------------------------------
  loginDocente: async (email, password) => {
    const datos = await peticion("/docentes/login", {
      metodo: "POST",
      cuerpo: { email, password },
      error: "Credenciales incorrectas",
    });
    return { token: datos.access_token, docente: datos.docente };
  },

  registrarDocente: ({ nombre, email, password, codigoInvitacion }) =>
    peticion("/docentes/registro", {
      metodo: "POST",
      cuerpo: { nombre, email, password, codigo_invitacion: codigoInvitacion },
      error: "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    }),

  // --- Juegos (docente: los suyos; alumno: los de su docente) -----------------
  obtenerJuegos: async (token) => {
    const data = await peticion("/ia/juegos", { token, error: "No se pudieron cargar los juegos" });
    return (data.juegos ?? []).map((juego) => {
      const contenido = normalizarJuego(juego.contenido_juego ?? juego.juego);
      return {
        ...juego,
        contenido_juego: contenido,
        titulo: juego.titulo ?? contenido?.titulo ?? "Aventura de ciencias",
      };
    });
  },

  generarJuego: async (textoPrompt, token, tipoActividad = "sorpresa") => {
    const data = await peticion("/ia/generar-juego", {
      metodo: "POST",
      token,
      cuerpo: { texto_prompt: textoPrompt, tipo_actividad: tipoActividad },
      error: "Error al generar el juego",
    });
    return data.juego;
  },

  // --- Alumnos (docente) ------------------------------------------------------
  obtenerAlumnos: async (token) => {
    const data = await peticion("/alumnos/", { token, error: "Error al cargar alumnos" });
    return data.alumnos;
  },

  // Devuelve el alumno con su código de aula y su PIN. El PIN solo se muestra esta vez.
  crearAlumno: (nombre, token) =>
    peticion("/alumnos/", {
      metodo: "POST",
      token,
      cuerpo: { nombre_pila: nombre, avatar_url: null },
      error: "No se pudo crear al alumno. Revisa los datos e inténtalo de nuevo.",
    }),

  restablecerPin: (idAlumno, token) =>
    peticion(`/alumnos/${idAlumno}/restablecer-pin`, {
      metodo: "POST",
      token,
      error: "No se pudo generar un PIN nuevo.",
    }),

  // --- Resultados y métricas -----------------------------------------------------
  // puntuacion = porcentaje de aciertos (0 a 100); tiempo en segundos.
  guardarResultado: ({ idJuego, puntuacion, tiempo }, token) =>
    peticion("/resultados/", {
      metodo: "POST",
      token,
      cuerpo: { id_juego: idJuego, puntuacion_final: puntuacion, tiempo_resolucion: tiempo },
      error: "No se pudo guardar tu resultado.",
    }),

  obtenerMisPuntos: (token) =>
    peticion("/resultados/mios", { token, error: "No se pudieron cargar tus puntos." }),

  obtenerMetricas: (token) =>
    peticion("/metricas/grupo", { token, error: "No se pudieron cargar las métricas." }),

  // --- Acceso del alumno: código -> nombre -> PIN ----------------------------------
  aulaPorCodigo: async (codigo) => {
    const data = await peticion(`/alumnos/aula/${encodeURIComponent(codigo)}`, {
      error: "No encontramos esa aula. Revisa el código.",
    });
    return data.alumnos;
  },

  loginAlumno: async ({ codigo, idAlumno, pin }) => {
    const datos = await peticion("/alumnos/login", {
      metodo: "POST",
      cuerpo: { codigo_acceso: codigo, id_alumno: idAlumno, pin },
      error: "El PIN no es correcto.",
    });
    return { token: datos.access_token, alumno: datos.alumno };
  },
};
