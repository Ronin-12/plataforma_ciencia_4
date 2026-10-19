import { useState, useEffect } from "react";
import GeneradorJuegos from "./GeneradorJuegos";
import GestionAlumnos from "./GestionAlumnos";
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

  // Extraemos el ID del docente desde el token JWT
  let idDocente = null;
  try {
    if (tokenDocente) {
      const segmento = tokenDocente.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
      idDocente = JSON.parse(atob(segmento)).sub ?? null;
    }
  } catch {
    idDocente = null;
  }

  // Efecto para cargar alumnos cuando entramos a la sección
  useEffect(() => {
    if (seccionActiva === "Mis Alumnos" && idDocente) {
      api.obtenerAlumnos(idDocente)
        .then((data) => setAlumnos(data))
        .catch((err) => console.error("Error al cargar alumnos:", err));
    }
  }, [seccionActiva, idDocente]);

  // Función para cuando el docente guarda un nuevo alumno
  async function manejarAgregarAlumno({ nombre }) {
    try {
      // 1. Creamos el alumno en el backend
      await api.crearAlumno(nombre, idDocente);
      
      // 2. Volvemos a pedir la lista actualizada a la base de datos
      const listaActualizada = await api.obtenerAlumnos(idDocente);
      setAlumnos(listaActualizada);
    } catch (error) {
      console.error("Error al agregar alumno:", error);
      throw error;
    }
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
                idDocente={idDocente}
                token={tokenDocente}
                listaAlumnos={alumnos.map(a => ({ 
                  id: a.id_alumno, 
                  nombre: a.nombre_pila, 
                  pin: a.pin_seguridad,
                  codigo_acceso: a.codigo_acceso,
                }))}
                onAgregarAlumno={manejarAgregarAlumno}
              />
            </div>
          ) : seccionActiva === "Crear Juego con IA" ? (
            <div className="mt-4">
              <GeneradorJuegos onGenerar={(prompt, tipo) => api.generarJuego(prompt, tokenDocente, tipo)} />
            </div>
          ) : (
            <div className="mt-7 flex min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.03] px-5 py-10 text-center">
              <p className="max-w-md text-base font-medium leading-relaxed text-slate-300">
                Las métricas del grupo estarán disponibles próximamente.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
