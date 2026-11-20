import { useState, useEffect } from "react";
import { BarChart3, ClipboardCheck, FolderOpen, Flag, LogOut, Sparkles, Users } from "lucide-react";
import GeneradorJuegos from "./GeneradorJuegos";
import EquiposCooperativos from "./EquiposCooperativos";
import GestionAlumnos from "./GestionAlumnos";
import MetricasGrupo from "./MetricasGrupo";
import MascotaMurcielago from "./MascotaMurcielago";
import MaterialesSesiones from "./MaterialesSesiones";
import RevisionJuegos from "./RevisionJuegos";
import { api } from "../services/api";

// Cada sección del panel con su icono, color y una frase que explica para qué sirve.
const secciones = [
  { id: "Mis alumnos", Icono: Users, color: "#dcf7f0", ayuda: "Abre tus grupos (4.º A, 4.º B…), da de alta a sus alumnos y comparte el código de aula y el PIN." },
  { id: "Equipos en misión", Icono: Flag, color: "#e3f7e8", ayuda: "Arma equipos dentro de un grupo y lanza una misión: la barra de cada equipo sube con el mejor resultado de sus integrantes." },
  { id: "Materiales y sesiones", Icono: FolderOpen, color: "#fff4cf", ayuda: "Sube tu material y la IA te propone temas para tus sesiones." },
  { id: "Crear actividad con IA", Icono: Sparkles, color: "#ece6ff", ayuda: "Elige materia, grado y tipo de juego; la IA lo arma como borrador." },
  { id: "Revisar actividades", Icono: ClipboardCheck, color: "#ffe7e3", ayuda: "Nada llega a tus alumnos hasta que tú lo apruebas y eliges qué grupos lo ven." },
  { id: "Métricas del grupo", Icono: BarChart3, color: "#e0f0ff", ayuda: "Mira cómo va cada grupo, cada actividad y cada alumno." },
];

export default function PanelDocente({
  nombreDocente = "Maestro",
  escuelaDocente = null,
  tokenDocente = "",
  onCerrarSesion = () => {},
}) {
  const [seccionActiva, setSeccionActiva] = useState("Mis alumnos");
  
  // Estado para guardar la lista de alumnos
  const [alumnos, setAlumnos] = useState([]);
  // Grupos del docente (4.º A, 4.º B...) y el que está seleccionado: se comparte entre «Mis alumnos» y las métricas.
  const [grupos, setGrupos] = useState([]);
  const [idGrupoActivo, setIdGrupoActivo] = useState(null);
  const [usoIA, setUsoIA] = useState(null);
  const [sesionParaJuego, setSesionParaJuego] = useState(null);

  // Efecto para cargar alumnos cuando entramos a la sección.
  // El servidor sabe quién eres por tu token: ya no se envía ningún id de docente.
  useEffect(() => {
    if (seccionActiva === "Mis alumnos" && tokenDocente) {
      api.obtenerAlumnos(tokenDocente)
        .then((data) => setAlumnos(data))
        .catch((err) => console.error("Error al cargar alumnos:", err));
    }
  }, [seccionActiva, tokenDocente]);

  // Los grupos se recargan al cambiar de sección: así «Revisar» y «Métricas» siempre ven los que acaba de crear.
  useEffect(() => {
    if (!tokenDocente) return;
    api.obtenerGrupos(tokenDocente).then(setGrupos).catch((err) => console.error("Error al cargar grupos:", err));
  }, [seccionActiva, tokenDocente]);

  async function recargarGrupos() {
    setGrupos(await api.obtenerGrupos(tokenDocente));
  }

  useEffect(() => {
    if (tokenDocente) api.obtenerUsoIA(tokenDocente).then(setUsoIA).catch(() => setUsoIA(null));
  }, [seccionActiva, tokenDocente]);

  async function generarJuego(prompt, tipo, idSesion, opciones) {
    const data = await api.generarJuego(prompt, tokenDocente, tipo, idSesion, opciones);
    if (data.uso) setUsoIA(data.uso);
    return data;
  }

  // Función para cuando el docente guarda un nuevo alumno.
  // Devuelve los datos recién creados (incluido el PIN, que solo se ve esta vez).
  async function manejarAgregarAlumno({ nombre, idGrupo }) {
    try {
      const creado = await api.crearAlumno(nombre, tokenDocente, idGrupo);
      setAlumnos(await api.obtenerAlumnos(tokenDocente));
      recargarGrupos().catch(() => {}); // cambia el conteo de alumnos del grupo
      return creado;
    } catch (error) {
      console.error("Error al agregar alumno:", error);
      throw error;
    }
  }

  async function recargarAlumnos() {
    setAlumnos(await api.obtenerAlumnos(tokenDocente));
    recargarGrupos().catch(() => {});
  }

  // Genera un PIN nuevo para un alumno (también se muestra una sola vez).
  async function manejarRestablecerPin(idAlumno) {
    const resultado = await api.restablecerPin(idAlumno, tokenDocente);
    setAlumnos(await api.obtenerAlumnos(tokenDocente));
    return resultado;
  }

  const actual = secciones.find((s) => s.id === seccionActiva);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f6f4ff] text-[#22184a]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-[#e3dbff]" />

      {/* Encabezado */}
      <header className="relative z-10 border-b-[3px] border-[#22184a] bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <MascotaMurcielago className="h-12 w-12" label="Mupi" />
            <div>
              <p className="font-display text-lg font-semibold leading-none text-[#6b46c1]">Mupi</p>
              <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">Hola, {nombreDocente}</h1>
              {escuelaDocente && <p className="text-sm font-semibold text-[#4a3f7a]">{escuelaDocente}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {usoIA?.demo && <p role="status" className="rounded-full border-2 border-[#e05a9c] bg-[#ffe3f1] px-4 py-2 text-sm font-extrabold text-[#7a1f4f]">🎭 Modo demo: los juegos son de ejemplo</p>}
            {usoIA && !usoIA.demo && (
              <p className="inline-flex items-center gap-2 rounded-full border-2 border-[#22184a] bg-[#fff4cf] px-4 py-2 text-sm font-extrabold">
                <Sparkles size={16} aria-hidden="true" /> {usoIA.disponibles} de {usoIA.limite} créditos de IA este mes
                {usoIA.limite_diario != null && <span className="font-semibold text-[#4a3f7a]">· {usoIA.disponibles_hoy} hoy</span>}
                {usoIA.plan_nombre && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-[#6b46c1]">Plan {usoIA.plan_nombre}</span>}
              </p>
            )}
            <button
              type="button"
              onClick={onCerrarSesion}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-[#22184a] bg-white px-4 font-bold transition hover:bg-[#ffe7e3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40"
            >
              <LogOut size={18} aria-hidden="true" /> Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[300px_1fr]">
        {/* Menú lateral */}
        <nav aria-label="Menú del panel docente" className="h-fit rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-3 shadow-[5px_5px_0_#22184a] lg:sticky lg:top-6">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {secciones.map(({ id, Icono, color }) => {
              const activa = seccionActiva === id;
              return (
                <li key={id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSeccionActiva(id)}
                    aria-current={activa ? "page" : undefined}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 sm:text-base ${activa ? "bg-[#6b46c1] text-white" : "text-[#22184a] hover:bg-[#f1ecff]"}`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-[#22184a]" style={{ backgroundColor: color }}>
                      <Icono size={18} strokeWidth={2.5} color="#22184a" aria-hidden="true" />
                    </span>
                    {id}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-labelledby="titulo-seccion" className="min-h-[420px] min-w-0">
          <div className="mb-6">
            <h2 id="titulo-seccion" className="font-display text-3xl font-semibold sm:text-4xl">{seccionActiva}</h2>
            <p className="mt-1 text-base text-[#4a3f7a] sm:text-lg">{actual?.ayuda}</p>
          </div>

          {/* RENDERIZADO DINÁMICO DE SECCIONES */}
          {seccionActiva === "Mis alumnos" ? (
            <GestionAlumnos
              listaAlumnos={alumnos.map(a => ({
                id: a.id_alumno,
                nombre: a.nombre_pila,
                codigo_acceso: a.codigo_acceso,
                bloqueado: a.bloqueado,
                activo: a.activo,
                id_grupo: a.id_grupo,
              }))}
              grupos={grupos}
              idGrupoActivo={idGrupoActivo}
              onElegirGrupo={setIdGrupoActivo}
              onCambioGrupos={recargarGrupos}
              onIrARevisar={() => setSeccionActiva("Revisar actividades")}
              token={tokenDocente}
              onCambioAlumnos={recargarAlumnos}
              onAgregarAlumno={manejarAgregarAlumno}
              onRestablecerPin={manejarRestablecerPin}
            />
          ) : seccionActiva === "Equipos en misión" ? (
            <EquiposCooperativos token={tokenDocente} grupos={grupos} idGrupoInicial={idGrupoActivo} onElegirGrupo={setIdGrupoActivo} />
          ) : seccionActiva === "Crear actividad con IA" ? (
            <GeneradorJuegos key={sesionParaJuego?.id_sesion ?? "libre"} sesion={sesionParaJuego} onGenerar={generarJuego} onIrARevisar={() => setSeccionActiva("Revisar actividades")} />
          ) : seccionActiva === "Revisar actividades" ? (
            <RevisionJuegos token={tokenDocente} grupos={grupos} onIrAGrupos={() => setSeccionActiva("Mis alumnos")} />
          ) : seccionActiva === "Materiales y sesiones" ? (
            <MaterialesSesiones token={tokenDocente} onUsoChange={setUsoIA} onIrARevisar={() => setSeccionActiva("Revisar actividades")} onCrearJuego={(sesion) => { setSesionParaJuego(sesion); setSeccionActiva("Crear actividad con IA"); }} />
          ) : (
            <MetricasGrupo token={tokenDocente} grupos={grupos} idGrupoInicial={idGrupoActivo} />
          )}
        </section>
      </div>
    </main>
  );
}
