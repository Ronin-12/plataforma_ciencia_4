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

// Las generaciones con IA corren en segundo plano: se pide, el servidor responde al instante con un id y
// aquí se consulta cada par de segundos hasta que termina. Así la pantalla puede mostrar en qué etapa va.
const ESPERA_MAXIMA_MS = 4 * 60 * 1000;
const pausa = (milisegundos) => new Promise((resolver) => setTimeout(resolver, milisegundos));

async function esperarTarea(idTarea, token, onEtapa, errorPorDefecto) {
  const inicio = Date.now();
  let espera = 1200;
  while (Date.now() - inicio < ESPERA_MAXIMA_MS) {
    const tarea = await peticion(`/ia/tareas/${idTarea}`, { token, error: errorPorDefecto });
    if (tarea.estado === "lista") return tarea.resultado;
    if (tarea.estado === "error") throw new ErrorApi(tarea.error?.detalle || errorPorDefecto, tarea.error?.estado ?? 500);
    onEtapa?.(tarea.etapa, tarea.segundos);
    await pausa(espera);
    espera = Math.min(espera + 300, 2500);
  }
  throw new ErrorApi("La generación está tardando más de lo normal. Revisa «Revisar actividades» en un momento: si terminó, el borrador estará ahí.", 504);
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

  registrarDocente: ({ nombre, email, password, codigoInvitacion, escuela, tipoEscuela, cct, aceptaTerminos }) =>
    peticion("/docentes/registro", {
      metodo: "POST",
      cuerpo: {
        nombre, email, password, codigo_invitacion: codigoInvitacion, escuela: escuela || null,
        tipo_escuela: tipoEscuela || null, cct: cct || null, acepta_terminos: Boolean(aceptaTerminos),
      },
      error: "No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.",
    }),

  // Recuperar contraseña: el servidor responde lo mismo exista o no la cuenta.
  recuperarPassword: (email) =>
    peticion("/docentes/recuperar", { metodo: "POST", cuerpo: { email }, error: "No se pudo enviar el enlace." }),

  restablecerPassword: (token, password) =>
    peticion("/docentes/restablecer", { metodo: "POST", cuerpo: { token, password }, error: "No se pudo cambiar la contraseña." }),

  // Formulario de la sección Planes (no necesita sesión).
  enviarContacto: (datos) =>
    peticion("/contacto", { metodo: "POST", cuerpo: datos, error: "No se pudo enviar tu mensaje. Inténtalo de nuevo." }),

  // El docente sale siempre del token: ninguna de estas llamadas envía su id.
  obtenerUsoIA: (token) =>
    peticion("/ia/uso", { token, error: "No se pudo consultar el límite de IA." }),

  analizarMateriales: async (archivos, token, { onEtapa = null } = {}) => {
    const form = new FormData();
    archivos.forEach((archivo) => form.append("archivos", archivo));
    let respuesta;
    try {
      respuesta = await fetch(`${API_URL}/ia/tareas/materiales`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    } catch (causa) {
      throw new ErrorApi("No se pudo conectar con el servidor.", 0, { cause: causa });
    }
    if (!respuesta.ok) {
      const datos = await respuesta.json().catch(() => ({}));
      if (respuesta.status === 401 && token) alExpirarSesion();
      throw new ErrorApi(mensajeDeError(datos.detail) || "No se pudo analizar el material.", respuesta.status);
    }
    const { id_tarea: idTarea } = await respuesta.json();
    return esperarTarea(idTarea, token, onEtapa, "No se pudo analizar el material.");
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
        titulo: juego.titulo ?? contenido?.titulo ?? "Actividad",
      };
    });
  },

  // materia («ciencias», «matematicas»...) y grado (1 a 6) son opcionales: sin ellos el servidor asume Ciencias de 4.º.
  // onEtapa(texto, segundos) se llama mientras la IA trabaja, para mostrar el avance.
  generarJuego: async (textoPrompt, token, tipoActividad = "sorpresa", idSesion = null, { materia = null, grado = null, onEtapa = null } = {}) => {
    const { id_tarea: idTarea } = await peticion("/ia/tareas/juego", {
      metodo: "POST",
      token,
      cuerpo: { texto_prompt: textoPrompt, tipo_actividad: tipoActividad, id_sesion: idSesion, materia, grado },
      error: "Error al generar el juego",
    });
    return esperarTarea(idTarea, token, onEtapa, "Error al generar el juego");
  },

  // Clase interactiva a partir de una sesión (material subido); la evaluación final es un juego.
  generarClase: async (idSesion, tipoEvaluacion, indicaciones, token, { onEtapa = null } = {}) => {
    const { id_tarea: idTarea } = await peticion("/ia/tareas/clase", {
      metodo: "POST",
      token,
      cuerpo: { id_sesion: idSesion, tipo_evaluacion: tipoEvaluacion, indicaciones: indicaciones || "" },
      error: "No se pudo crear la clase.",
    });
    return esperarTarea(idTarea, token, onEtapa, "No se pudo crear la clase.");
  },

  // Aprobación del docente: el alumno solo ve los juegos aprobados Y asignados a su grupo.
  // idsGrupos (opcional, solo al aprobar): a qué grupos va. Sin él: los que ya tenía o, si no tenía, todos.
  cambiarEstadoJuego: (idJuego, estado, token, idsGrupos = null) =>
    peticion(`/ia/juegos/${idJuego}/estado`, {
      metodo: "POST",
      token,
      cuerpo: idsGrupos ? { estado, ids_grupos: idsGrupos } : { estado },
      error: "No se pudo cambiar el estado del juego.",
    }),

  // Elige qué grupos ven un juego (reemplaza la selección anterior).
  asignarJuegoAGrupos: (idJuego, idsGrupos, token) =>
    peticion(`/ia/juegos/${idJuego}/grupos`, {
      metodo: "PUT",
      token,
      cuerpo: { ids_grupos: idsGrupos },
      error: "No se pudo asignar la actividad a los grupos.",
    }),

  // --- Grupos del docente (4.º A, 4.º B...) ---------------------------------------
  obtenerGrupos: async (token) => {
    const data = await peticion("/grupos/", { token, error: "No se pudieron cargar tus grupos." });
    return data.grupos ?? [];
  },
  crearGrupo: ({ nombre, grado }, token) =>
    peticion("/grupos/", { metodo: "POST", token, cuerpo: { nombre, grado }, error: "No se pudo crear el grupo." }),
  actualizarGrupo: (idGrupo, cambios, token) =>
    peticion(`/grupos/${idGrupo}`, { metodo: "PATCH", token, cuerpo: cambios, error: "No se pudo actualizar el grupo." }),
  eliminarGrupo: (idGrupo, token) =>
    peticion(`/grupos/${idGrupo}`, { metodo: "DELETE", token, error: "No se pudo borrar el grupo." }),

  // --- Equipos cooperativos y misiones en equipo ---------------------------------
  obtenerEquipos: (idGrupo, token) =>
    peticion(`/equipos/?id_grupo=${encodeURIComponent(idGrupo)}`, { token, error: "No se pudieron cargar los equipos." }),
  crearEquipo: ({ idGrupo, nombre, icono }, token) =>
    peticion("/equipos/", { metodo: "POST", token, cuerpo: { id_grupo: idGrupo, nombre, icono }, error: "No se pudo crear el equipo." }),
  actualizarEquipo: (idEquipo, cambios, token) =>
    peticion(`/equipos/${idEquipo}`, { metodo: "PATCH", token, cuerpo: cambios, error: "No se pudo actualizar el equipo." }),
  eliminarEquipo: (idEquipo, token) =>
    peticion(`/equipos/${idEquipo}`, { metodo: "DELETE", token, error: "No se pudo borrar el equipo." }),
  ponerIntegrantes: (idEquipo, idsAlumnos, token) =>
    peticion(`/equipos/${idEquipo}/integrantes`, { metodo: "PUT", token, cuerpo: { ids_alumnos: idsAlumnos }, error: "No se pudieron guardar los integrantes." }),
  equiposAlAzar: (idGrupo, tamano, token) =>
    peticion("/equipos/al-azar", { metodo: "POST", token, cuerpo: { id_grupo: idGrupo, tamano }, error: "No se pudieron formar los equipos." }),
  obtenerMisiones: (idGrupo, token) =>
    peticion(`/equipos/misiones?id_grupo=${encodeURIComponent(idGrupo)}`, { token, error: "No se pudo cargar la misión." }),
  // idsJuegos: de 1 a 5 actividades. modo: "todos" (cada quien juega todas) o "roles" (a cada quien le toca una).
  lanzarMision: ({ idGrupo, idsJuegos, meta, modo = "todos" }, token) =>
    peticion("/equipos/misiones", { metodo: "POST", token, cuerpo: { id_grupo: idGrupo, ids_juegos: idsJuegos, meta, modo }, error: "No se pudo lanzar la misión." }),
  cerrarMision: (idReto, token) =>
    peticion(`/equipos/misiones/${idReto}/cerrar`, { metodo: "POST", token, error: "No se pudo cerrar la misión." }),
  // Alumno: su equipo y la misión abierta de su grupo.
  obtenerMiMision: (token) => peticion("/equipos/mi-mision", { token, error: "No se pudo cargar tu misión." }),

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
  crearAlumno: (nombre, token, idGrupo = null) =>
    peticion("/alumnos/", {
      metodo: "POST",
      token,
      cuerpo: { nombre_pila: nombre, avatar_url: null, id_grupo: idGrupo },
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
  planesAdmin: (token) => peticion("/admin/planes", { token, error: "No se pudieron cargar los planes." }),
  cambiarPlanAdmin: (idDocente, plan, token) =>
    peticion(`/admin/docentes/${idDocente}/plan`, { metodo: "PATCH", token, cuerpo: { plan }, error: "No se pudo cambiar el plan." }),
  usoIAAdmin: (token) => peticion("/admin/uso-ia", { token, error: "No se pudo cargar el costo de la IA." }),
  solicitudesAdmin: (token) => peticion("/admin/solicitudes", { token, error: "No se pudieron cargar las solicitudes." }),
  cambiarEstadoSolicitudAdmin: (idSolicitud, estado, token) =>
    peticion(`/admin/solicitudes/${idSolicitud}`, { metodo: "PATCH", token, cuerpo: { estado }, error: "No se pudo actualizar la solicitud." }),
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

  // Reporte de avance de un alumno para su familia (solo su docente puede pedirlo).
  reporteFamiliar: (idAlumno, token) =>
    peticion(`/alumnos/${idAlumno}/reporte`, { token, error: "No se pudo preparar el reporte." }),

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

  // filtros: { desde, hasta, tipo, id_grupo } (todos opcionales; las fechas van como AAAA-MM-DD).
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
