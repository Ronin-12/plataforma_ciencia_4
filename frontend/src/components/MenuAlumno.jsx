import React from "react";
import MascotaMurcielago from "./MascotaMurcielago";

const tarjetas = [
  "from-amber-200 to-orange-300 border-orange-100 text-orange-950",
  "from-cyan-200 to-sky-300 border-sky-100 text-sky-950",
  "from-lime-200 to-emerald-300 border-emerald-100 text-emerald-950",
  "from-pink-200 to-rose-300 border-rose-100 text-rose-950",
  "from-violet-200 to-fuchsia-300 border-fuchsia-100 text-violet-950",
];

export default function MenuAlumno({ nombre, avatar, puntuacion, juegos = [], onJugar, onSalir }) {
  const hayJuegos = Array.isArray(juegos) && juegos.length > 0;

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cyan-100 via-amber-50 to-pink-100 px-4 py-7 text-slate-800 sm:px-6 lg:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-32 h-72 w-72 rounded-full bg-lime-300/50 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-violet-300/40 blur-3xl" />
      <div className="relative mx-auto w-full max-w-6xl">
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border-4 border-white bg-white/85 p-5 shadow-lg backdrop-blur sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-amber-300 bg-gradient-to-br from-cyan-100 to-pink-100 text-4xl shadow-md">
              {avatar ? <img src={avatar} alt={`Avatar de ${nombre}`} className="h-full w-full object-cover" /> : <MascotaMurcielago className="h-14 w-14" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">¡Qué bueno verte, explorador!</p>
              <h1 className="text-2xl font-black text-slate-800 sm:text-3xl">{nombre}</h1>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 text-sm font-black text-amber-800">⭐ {puntuacion ?? 0} puntos</p>
            </div>
          </div>
          <button type="button" onClick={onSalir} className="min-h-12 rounded-full border-2 border-slate-200 bg-white px-5 font-bold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Salir</button>
        </header>

        <section aria-labelledby="titulo-juegos">
          <div className="mb-6 flex items-center gap-4">
            <MascotaMurcielago className="h-16 w-16 drop-shadow-sm" />
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-teal-700">Tu laboratorio te espera</p>
              <h2 id="titulo-juegos" className="text-3xl font-black text-slate-800 sm:text-4xl">¡Elige tu aventura!</h2>
            </div>
          </div>

          {hayJuegos ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {juegos.map((juego, indice) => {
                const titulo = juego?.titulo || juego?.contenido_juego?.titulo || `Aventura ${indice + 1}`;
                return (
                  <article key={juego?.id_juego ?? juego?.id ?? `${titulo}-${indice}`} className={`group relative flex min-h-64 flex-col overflow-hidden rounded-[2rem] border-4 bg-gradient-to-br p-6 shadow-lg transition duration-200 hover:-translate-y-1 hover:rotate-[.5deg] hover:shadow-xl ${tarjetas[indice % tarjetas.length]}`}>
                    <span aria-hidden="true" className="absolute -right-2 -top-5 rotate-12 text-7xl opacity-40 transition group-hover:scale-110">✨</span>
                    <div className="relative flex flex-1 flex-col">
                      <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/60 px-3 py-1 text-xs font-black uppercase tracking-wider"><span aria-hidden="true">🧪</span> Misión {indice + 1}</p>
                      <h3 className="mb-6 text-2xl font-black leading-snug">{titulo}</h3>
                      <button type="button" onClick={() => onJugar?.(juego)} className="mt-auto min-h-14 w-full rounded-2xl border-b-4 border-slate-800/20 bg-white px-5 py-3 text-lg font-black text-slate-800 shadow-md transition hover:bg-white/90 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white">
                        ¡A jugar! <span aria-hidden="true">🚀</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border-4 border-dashed border-cyan-300 bg-white/75 px-6 py-12 text-center shadow-sm">
              <MascotaMurcielago className="mx-auto mb-4 h-24 w-24" />
              <p className="text-xl font-black text-slate-800 sm:text-2xl">¡Pronto habrá nuevas aventuras!</p>
              <p className="mt-2 font-medium text-slate-600">Pídele a tu maestro que cree un juego para ti.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
