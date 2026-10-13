import { useEffect, useState } from "react";

const actividades = [
  { id: "agua", titulo: "El ciclo del agua", color: "cyan", avance: 0, Icono: IconoGota },
  { id: "seres-vivos", titulo: "Los seres vivos", color: "green", avance: 50, Icono: IconoHoja },
  { id: "cuerpo", titulo: "El cuerpo humano", color: "rose", avance: 100, Icono: IconoCorazon },
];

const estilos = {
  cyan: { borde: "border-cyan-400", fondo: "bg-cyan-100", icono: "text-cyan-700", barra: "bg-cyan-500", boton: "border-cyan-800 bg-cyan-600 hover:bg-cyan-500", foco: "focus-visible:ring-cyan-300" },
  green: { borde: "border-green-400", fondo: "bg-green-100", icono: "text-green-700", barra: "bg-green-500", boton: "border-green-800 bg-green-600 hover:bg-green-500", foco: "focus-visible:ring-green-300" },
  rose: { borde: "border-rose-400", fondo: "bg-rose-100", icono: "text-rose-700", barra: "bg-rose-500", boton: "border-rose-800 bg-rose-600 hover:bg-rose-500", foco: "focus-visible:ring-rose-300" },
};

export default function MenuAlumno({ nombre = "Explorador", avatar = "", puntuacion = 0, progreso, onSalir = () => {} }) {
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!mensaje) return undefined;
    const temporizador = window.setTimeout(() => setMensaje(""), 2200);
    return () => window.clearTimeout(temporizador);
  }, [mensaje]);

  function abrirActividad(actividad) {
    console.log("Actividad seleccionada:", actividad.titulo);
    setMensaje(`¡${actividad.titulo}: próximamente!`);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171044] px-4 py-5 text-slate-950 sm:px-7 sm:py-8">
      {/* Luces de color que mantienen el ambiente de aventura del acceso. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-12 h-64 w-64 rounded-full bg-fuchsia-600/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />

      <div className="relative mx-auto w-full max-w-7xl">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-white/20 bg-indigo-950/70 p-4 text-white shadow-xl sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 border-white bg-yellow-300 text-3xl font-black text-indigo-950" aria-label="Avatar del alumno">
              {typeof avatar === "string" && avatar.startsWith("http") ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : (avatar || nombre.slice(0, 1).toUpperCase())}
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Equipo Murciélago</p>
              <p className="text-xl font-black sm:text-2xl">{nombre}</p>
            </div>
          </div>

          <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
            <p className="rounded-2xl border border-yellow-200/50 bg-yellow-300 px-4 py-2 text-center font-black text-indigo-950" aria-label={`Puntuación total: ${puntuacion} puntos`}>
              <span className="block text-[10px] uppercase tracking-wide">Tus puntos</span>
              <span className="text-xl">{puntuacion}</span>
            </p>
            <button type="button" onClick={onSalir} className="min-h-11 rounded-xl border-2 border-white/50 bg-white/10 px-4 font-black text-white transition hover:bg-white hover:text-indigo-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300">
              Salir
            </button>
          </div>
        </header>

        <section aria-labelledby="saludo" className="mb-8 flex items-center justify-between gap-4 rounded-[2rem] border-4 border-white bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-700 px-5 py-6 text-white shadow-[0_12px_0_rgba(0,0,0,0.2)] sm:px-9 sm:py-8">
          <div>
            <h1 id="saludo" className="text-3xl font-black leading-tight sm:text-5xl">¡Hola, {nombre}!<br />¿Qué quieres explorar hoy?</h1>
            <p className="mt-3 text-base font-semibold text-white/90 sm:text-lg">Elige una misión y aprende algo increíble.</p>
          </div>
          <div className="hidden shrink-0 items-center justify-center rounded-full border-4 border-white bg-yellow-300 p-2 shadow-lg sm:flex" aria-hidden="true">
            <Murcielago className="h-20 w-20" />
          </div>
        </section>

        <section aria-label="Actividades para explorar" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {actividades.map((actividad) => {
            const avance = progreso?.[actividad.id] ?? actividad.avance;
            const estilo = estilos[actividad.color];
            return (
              <article key={actividad.id} className={`flex flex-col rounded-[2rem] border-4 ${estilo.borde} bg-white p-5 shadow-[0_10px_0_rgba(0,0,0,0.2)] sm:p-7`}>
                <div className={`mb-5 flex h-28 items-center justify-center rounded-3xl ${estilo.fondo}`}>
                  <actividad.Icono className={`h-20 w-20 ${estilo.icono}`} />
                </div>
                <h2 className="text-2xl font-black leading-tight text-indigo-950 sm:text-3xl">{actividad.titulo}</h2>
                <div className="mt-5" aria-label={`Progreso: ${avance}%`}>
                  <div className="mb-2 flex justify-between text-sm font-black text-slate-800"><span>Tu avance</span><span>{avance}%</span></div>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${estilo.barra} transition-all`} style={{ width: `${avance}%` }} />
                  </div>
                </div>
                <button type="button" onClick={() => abrirActividad(actividad)} aria-label={`Jugar: ${actividad.titulo}`} className={`mt-6 min-h-14 w-full rounded-2xl border-b-[6px] px-5 text-lg font-black text-white shadow-md transition active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 ${estilo.boton} ${estilo.foco}`}>
                  ¡Jugar!
                </button>
              </article>
            );
          })}
        </section>
        <p role="status" aria-live="polite" className={`fixed bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-2xl border-2 border-white bg-indigo-950 px-6 py-3 text-center font-black text-white shadow-2xl transition-opacity ${mensaje ? "opacity-100" : "pointer-events-none opacity-0"}`}>
          {mensaje}
        </p>
      </div>
    </main>
  );
}

function IconoGota({ className }) {
  return <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true"><path d="M50 8C39 27 20 47 20 65a30 30 0 0 0 60 0C80 47 61 27 50 8Z" fill="currentColor" /><path d="M37 68c1 8 6 12 14 14" stroke="white" strokeWidth="6" strokeLinecap="round" /></svg>;
}

function IconoHoja({ className }) {
  return <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true"><path d="M82 15C48 16 22 27 19 55c-2 18 12 29 27 25 27-7 37-34 36-65Z" fill="currentColor" /><path d="M21 82c14-22 29-36 50-52M43 59l-2-18m17 3 15 1" stroke="white" strokeWidth="5" strokeLinecap="round" /></svg>;
}

function IconoCorazon({ className }) {
  return <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true"><path d="M50 83S13 61 13 36c0-19 24-27 37-8 13-19 37-11 37 8 0 25-37 47-37 47Z" fill="currentColor" /><path d="M19 51h18l8-16 12 31 8-15h16" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Murcielago({ className }) {
  return <svg viewBox="0 0 160 160" className={className} fill="none" aria-hidden="true"><path fill="#4f46e5" d="M23 83c-2-24 2-42 11-53 16 3 29 14 38 31h16c9-17 22-28 38-31 9 11 13 29 11 53-11-10-23-14-36-10-3 22-13 39-31 51-18-12-28-29-31-51-13-4-25 0-36 10Z"/><path fill="#312e81" d="M34 30C23 20 11 18 2 23c9 9 13 20 13 33 7-8 14-12 22-13-3-5-4-9-3-13Zm92 0c11-10 23-12 32-7-9 9-13 20-13 33-7-8-14-12-22-13 3-5 4-9 3-13Z"/><circle cx="61" cy="78" r="10" fill="white"/><circle cx="99" cy="78" r="10" fill="white"/><circle cx="61" cy="78" r="4" fill="#171044"/><circle cx="99" cy="78" r="4" fill="#171044"/><path fill="#fb7185" d="m80 87-9 9 9 7 9-7-9-9Z"/><path d="M70 108q10 11 20 0" stroke="white" strokeWidth="5" strokeLinecap="round"/></svg>;
}
