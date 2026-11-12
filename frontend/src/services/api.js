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

  registrarDocente: ({ nombre, email, password, codigoInvitacion, escuela }) =>
    peticion("/docentes/registro", {
      metodo: "POST",
      cuerpo: { nombre, email, password, codigo_invitacion: codigoInvitacion, escuela: escuela || null },
      error: "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    }),

  // El docente sale siempre del token: ninguna de estas llamadas envía su id.
  obtenerUsoIA: (token) =>
    peticion("/ia/uso", { token, error: "No se pudo consultar el límite de IA." }),

  analizarMateriales: async (archivos, token) => {
    const form = new FormData();
    archivos.forEach((archivo) => form.append("archivos", archivo));
    let respuesta;
    try {
      respuesta = await fetch(`${API_URL}/ia/materiales/analizar`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    } catch (causa) {
      throw new ErrorApi("No se pudo conectar con el servidor.", 0, { cause: causa });
    }
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401 && token) alExpirarSesion();
      throw new ErrorApi(mensajeDeError(datos.detail) || "No se pudo analizar el material.", respuesta.status);
    }
    return respuesta.json();
  },

  crearSesion: (sesion, token) =>
    peticion("/ia/sesiones", { metodo: "POST", cuerpo: sesion, token, error: "No se pudo guardar la sesión." }),

  obtenerSesiones: async (token) => {
    const data = await peticion("/ia/sesiones", { token, error: "No se pudieron cargar las sesiones." });
    return data.sesiones ?? [];
  },

  // --- Juegos (docente: los suyos; alumno: los de su docente) -----------------
  // estado (solo docente): "borrador" | "aprobado" | "descartado". Sin estado = borradores y aprobados.
  obtenerJuegos: async (token, estado = null) => {
    const ruta = estado ? `/ia/juegos?estado=${encodeURIComponent(estado)}` : "/ia/juegos";
    const data = await peticion(ruta, { token, error: "No se pudieron cargar los juegos" });
    return (data.juegos ?? []).map((juego) => {
      const contenido = normalizarJuego(juego.contenido_juego ?? juego.juego);
      return {
        ...juego,
        contenido_juego: contenido,
        titulo: juego.titulo ?? contenido?.titulo ?? "Aventura de ciencias",
      };
    });
  },

  generarJuego: async (textoPrompt, token, tipoActividad = "sorpresa", idSesion = null) => {
    const data = await peticion("/ia/generar-juego", {
      metodo: "POST",
      token,
      cuerpo: { texto_prompt: textoPrompt, tipo_actividad: tipoActividad, id_sesion: idSesion },
      error: "Error al generar el juego",
    });
    return data;
  },

  // Clase interactiva a partir de una sesión (material subido); la evaluación final es un juego.
  generarClase: (idSesion, tipoEvaluacion, indicaciones, token) =>
    peticion("/ia/generar-clase", {
      metodo: "POST",
      token,
      cuerpo: { id_sesion: idSesion, tipo_evaluacion: tipoEvaluacion, indicaciones: indicaciones || "" },
      error: "No se pudo crear la clase.",
    }),

  // Aprobación del docente: el alumno solo ve los juegos aprobados.
  cambiarEstadoJuego: (idJuego, estado, token) =>
    peticion(`/ia/juegos/${idJuego}/estado`, {
      metodo: "POST",
      token,
      cuerpo: { estado },
      error: "No se pudo cambiar el estado del juego.",
    }),

  editarJuego: (idJuego, juego, token) =>
    peticion(`/ia/juegos/${idJuego}`, {
      metodo: "PUT",
      token,
      cuerpo: juego,
      error: "No se pudo guardar el juego.",
    }),

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

  // Panel de administración (solo cuentas con rol administrador).
  resumenAdmin: (token) => peticion("/admin/resumen", { token, error: "No se pudo cargar el resumen." }),
  docentesAdmin: (token) => peticion("/admin/docentes", { token, error: "No se pudo cargar la lista de docentes." }),
  cambiarEstadoDocente: (idDocente, activo, token) =>
    peticion(`/admin/docentes/${idDocente}`, { metodo: "PATCH", token, cuerpo: { activo }, error: "No se pudo cambiar el estado del docente." }),

  // Rectificación y oposición (ARCO): cambiar el nombre o activar/desactivar el acceso.
  actualizarAlumno: (idAlumno, cambios, token) =>
    peticion(`/alumnos/${idAlumno}`, {
      metodo: "PATCH",
      token,
      cuerpo: cambios,
      error: "No se pudo actualizar al alumno.",
    }),

  // Cancelación (ARCO): borra al alumno y todos sus resultados. No se puede deshacer.
  eliminarAlumno: (idAlumno, token) =>
    peticion(`/alumnos/${idAlumno}`, {
      metodo: "DELETE",
      token,
      error: "No se pudo eliminar al alumno.",
    }),

  // Acceso (ARCO): todo lo guardado de un alumno, para descargarlo como archivo.
  datosDelAlumno: (idAlumno, token) =>
    peticion(`/alumnos/${idAlumno}/datos`, { token, error: "No se pudieron obtener los datos del alumno." }),

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

  // filtros: { desde, hasta, tipo } (todos opcionales; las fechas van como AAAA-MM-DD).
  obtenerMetricas: (token, filtros = {}) => {
    const consulta = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) if (valor) consulta.set(clave, valor);
    const texto = consulta.toString();
    return peticion(`/metricas/grupo${texto ? `?${texto}` : ""}`, { token, error: "No se pudieron cargar las métricas." });
  },

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
