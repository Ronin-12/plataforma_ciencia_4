import { useState, useEffect } from "react";
import GeneradorJuegos from "./GeneradorJuegos";
import GestionAlumnos from "./GestionAlumnos";
import MetricasGrupo from "./MetricasGrupo";
import MascotaMurcielago from "./MascotaMurcielago";
import { api } from "../services/api";

const secciones = [
  "Mis Alumnos",
  "Crear Juego con IA",
  "Métricas del Grupo",
];

export default function PanelDocente({
  nombreDocente = "Maestro",
  tokenDocente = "",
  onCerrarSesion = () => {},
}) {
  const [seccionActiva, setSeccionActiva] = useState("Mis Alumnos");
  
  // Estado para guardar la lista de alumnos
  const [alumnos, setAlumnos] = useState([]);

  // Efecto para cargar alumnos cuando entramos a la sección.
  // El servidor sabe quién eres por tu token: ya no se envía ningún id de docente.
  useEffect(() => {
    if (seccionActiva === "Mis Alumnos" && tokenDocente) {
      api.obtenerAlumnos(tokenDocente)
        .then((data) => setAlumnos(data))
        .catch((err) => console.error("Error al cargar alumnos:", err));
    }
  }, [seccionActiva, tokenDocente]);

  // Función para cuando el docente guarda un nuevo alumno.
  // Devuelve los datos recién creados (incluido el PIN, que solo se ve esta vez).
  async function manejarAgregarAlumno({ nombre }) {
    try {
      const creado = await api.crearAlumno(nombre, tokenDocente);
      setAlumnos(await api.obtenerAlumnos(tokenDocente));
      return creado;
    } catch (error) {
      console.error("Error al agregar alumno:", error);
      throw error;
    }
  }

  // Genera un PIN nuevo para un alumno (también se muestra una sola vez).
  async function manejarRestablecerPin(idAlumno) {
    const resultado = await api.restablecerPin(idAlumno, tokenDocente);
    setAlumnos(await api.obtenerAlumnos(tokenDocente));
    return resultado;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071321] text-slate-100">
      <div aria-hidden="true" className="space-starfield pointer-events-none absolute inset-0 opacity-35" />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0b1928]/95 px-5 py-4 shadow-lg sm:px-8">
        <div className="flex items-center gap-3">
          <MascotaMurcielago className="h-14 w-14" />
          <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">
            Equipo Murciélago
          </p>
          <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">
            Hola, {nombreDocente}
          </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 font-bold text-slate-200 transition hover:border-rose-300/50 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/30"
        >
          Cerrar Sesión
        </button>
      </header>

      <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[250px_1fr]">
        <nav
          aria-label="Menú del panel docente"
          className="rounded-2xl border border-white/10 bg-[#0d1c2b] p-3 shadow-xl"
        >
          <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-wider text-slate-400">
            Panel docente
          </p>
          <div className="flex gap-2 overflow-x-auto lg:flex-col">
            {secciones.map((seccion) => {
              const activa = seccionActiva === seccion;
              return (
                <button
                  key={seccion}
                  type="button"
                  onClick={() => setSeccionActiva(seccion)}
                  aria-current={activa ? "page" : undefined}
                  className={`min-h-12 shrink-0 rounded-xl px-4 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 lg:w-full ${
                    activa
                    ? "bg-teal-300 text-[#06251f] shadow-sm"
                      : "text-slate-300 hover:bg-white/[0.07] hover:text-white"
                  }`}
                >
                  {seccion}
                </button>
              );
            })}
          </div>
        </nav>

        <section
          aria-labelledby="titulo-seccion"
          className="min-h-[420px] rounded-2xl border border-white/10 bg-[#0d1c2b]/95 p-5 shadow-xl sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-sm font-semibold text-teal-200">
                Administración del grupo
              </p>
              <h2
                id="titulo-seccion"
                className="mt-1 text-2xl font-black text-white sm:text-3xl"
              >
                {seccionActiva}
              </h2>
            </div>
          </div>

          {/* RENDERIZADO DINÁMICO DE SECCIONES */}
          {seccionActiva === "Mis Alumnos" ? (
            <div className="mt-4">
              <GestionAlumnos
                listaAlumnos={alumnos.map(a => ({
                  id: a.id_alumno,
                  nombre: a.nombre_pila,
                  codigo_acceso: a.codigo_acceso,
                  bloqueado: a.bloqueado,
                }))}
                onAgregarAlumno={manejarAgregarAlumno}
                onRestablecerPin={manejarRestablecerPin}
              />
            </div>
          ) : seccionActiva === "Crear Juego con IA" ? (
            <div className="mt-4">
              <GeneradorJuegos onGenerar={(prompt, tipo) => api.generarJuego(prompt, tokenDocente, tipo)} />
            </div>
          ) : (
            <div className="mt-4">
              <MetricasGrupo token={tokenDocente} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
