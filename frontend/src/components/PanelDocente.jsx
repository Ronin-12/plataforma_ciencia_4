import { useState } from "react";
import GeneradorJuegos from "./GeneradorJuegos";
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-cyan-50 via-amber-50 to-rose-50 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b-4 border-cyan-200 bg-white px-5 py-4 shadow-sm sm:px-8">
        <div className="flex items-center gap-3">
          <MascotaMurcielago className="h-14 w-14" />
          <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">
            Equipo Murciélago
          </p>
          <h1 className="mt-1 text-2xl font-black text-slate-800 sm:text-3xl">
            Hola, {nombreDocente}
          </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="min-h-11 rounded-xl border-2 border-slate-200 px-4 font-bold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200"
        >
          Cerrar Sesión
        </button>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:grid-cols-[250px_1fr]">
        <nav
          aria-label="Menú del panel docente"
          className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
        >
          <p className="px-3 pb-2 pt-1 text-xs font-black uppercase tracking-wider text-slate-500">
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
                      ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-sm"
                      : "text-slate-700 hover:bg-amber-50 hover:text-teal-800"
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
          className="min-h-[420px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-teal-700">
                Administración del grupo
              </p>
              <h2
                id="titulo-seccion"
                className="mt-1 text-2xl font-black text-slate-800 sm:text-3xl"
              >
                {seccionActiva}
              </h2>
            </div>

            {seccionActiva === "Mis Alumnos" && (
              <button
                type="button"
                className="min-h-12 rounded-xl border-b-4 border-emerald-800 bg-emerald-600 px-5 py-2.5 font-black text-white shadow-sm transition hover:bg-emerald-500 active:translate-y-0.5 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200"
              >
                + Nuevo Alumno
              </button>
            )}
          </div>

          {/* RENDERIZADO DINÁMICO DE SECCIONES */}
          {seccionActiva === "Mis Alumnos" ? (
            <div className="mt-7 flex min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <div>
                <div
                  aria-hidden="true"
                  className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-100 text-2xl"
                >
                  👩‍🏫
                </div>
                <p className="max-w-md text-base font-semibold leading-relaxed text-slate-600">
                  Aún no tienes alumnos registrados. ¡Agrega uno para empezar!
                </p>
              </div>
            </div>
          ) : seccionActiva === "Crear Juego con IA" ? (
            <div className="mt-4">
              <GeneradorJuegos onGenerar={(prompt) => api.generarJuego(prompt, tokenDocente)} />
            </div>
          ) : (
            <div className="mt-7 flex min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <p className="max-w-md text-base font-medium leading-relaxed text-slate-600">
                Las métricas estarán disponibles próximamente.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
