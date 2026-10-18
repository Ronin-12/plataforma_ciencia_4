import { useState } from "react";

const secciones = [
  "Mis Alumnos",
  "Crear Juego con IA",
  "Métricas del Grupo",
];

export default function PanelDocente({
  nombreDocente = "Maestro",
  onCerrarSesion = () => {},
}) {
  const [seccionActiva, setSeccionActiva] = useState("Mis Alumnos");

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-indigo-100 bg-white px-5 py-4 shadow-sm sm:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
            Equipo Murciélago
          </p>
          <h1 className="mt-1 text-2xl font-black text-indigo-950 sm:text-3xl">
            Hola, {nombreDocente}
          </h1>
        </div>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="min-h-11 rounded-xl border-2 border-indigo-200 px-4 font-bold text-indigo-900 transition hover:border-indigo-700 hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200"
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
                      ? "bg-indigo-800 text-white shadow-sm"
                      : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-900"
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
              <p className="text-sm font-semibold text-indigo-700">
                Administración del grupo
              </p>
              <h2
                id="titulo-seccion"
                className="mt-1 text-2xl font-black text-indigo-950 sm:text-3xl"
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
          ) : (
            <div className="mt-7 flex min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <p className="max-w-md text-base font-medium leading-relaxed text-slate-600">
                Esta sección estará disponible próximamente.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}