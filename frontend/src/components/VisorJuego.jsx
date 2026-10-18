import { useEffect, useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";

const coloresOpciones = [
  "border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 text-orange-950",
  "border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100 text-sky-950",
  "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-950",
  "border-pink-200 bg-pink-50 hover:border-pink-400 hover:bg-pink-100 text-pink-950",
];

export default function VisorJuego({ juego }) {
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [puntuacion, setPuntuacion] = useState(0);

  useEffect(() => {
    setPreguntaActual(0);
    setSeleccion(null);
    setPuntuacion(0);
  }, [juego]);

  const preguntas = Array.isArray(juego?.preguntas) ? juego.preguntas : [];

  if (!preguntas.length) {
    return (
      <section className="w-full max-w-3xl rounded-[2rem] border-4 border-white bg-white/90 p-8 text-center shadow-xl">
        <MascotaMurcielago className="mx-auto mb-3 h-24 w-24" />
        <h1 className="text-2xl font-black text-slate-800">¡Aventura en pausa!</h1>
        <p className="mx-auto mt-2 max-w-lg text-lg font-medium text-slate-600">
          Este juego llegó sin preguntas. Vuelve al menú y pídele a tu maestro que lo genere otra vez.
        </p>
      </section>
    );
  }

  const juegoCompletado = preguntaActual >= preguntas.length;
  const avanzar = () => {
    setPreguntaActual((actual) => actual + 1);
    setSeleccion(null);
  };
  const reiniciar = () => {
    setPreguntaActual(0);
    setSeleccion(null);
    setPuntuacion(0);
  };

  if (juegoCompletado) {
    const mensaje = puntuacion === preguntas.length
      ? "¡Increíble, respuesta perfecta!"
      : puntuacion >= Math.ceil(preguntas.length / 2)
        ? "¡Gran trabajo, sigue explorando!"
        : "¡Buen intento! Cada pregunta te enseña algo nuevo.";

    return (
      <section aria-live="polite" className="w-full max-w-3xl overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-yellow-100 via-white to-pink-100 p-8 text-center shadow-2xl sm:p-12">
        <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-300 text-6xl shadow-lg">🏆</div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-700">¡Misión cumplida!</p>
        <h1 className="mt-2 text-3xl font-black text-slate-800 sm:text-4xl">{mensaje}</h1>
        <p className="mt-5 text-xl font-bold text-slate-700">
          Lograste <span className="text-3xl font-black text-emerald-600">{puntuacion}</span> de {preguntas.length} respuestas correctas.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {preguntas.map((_, index) => (
            <span key={index} aria-label={`Pregunta ${index + 1} completada`} className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${index < puntuacion ? "bg-emerald-400" : "bg-slate-200"}`}>
              {index < puntuacion ? "⭐" : "✨"}
            </span>
          ))}
        </div>
        <button type="button" onClick={reiniciar} className="mt-8 min-h-14 rounded-2xl border-b-4 border-orange-700 bg-gradient-to-r from-orange-400 to-yellow-300 px-8 py-3 text-lg font-black text-orange-950 shadow-lg transition hover:-translate-y-0.5 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200">
          ¡Jugar otra vez! ↻
        </button>
      </section>
    );
  }

  const pregunta = preguntas[preguntaActual];
  if (!pregunta || !Array.isArray(pregunta.opciones)) {
    return (
      <section role="alert" className="w-full max-w-3xl rounded-[2rem] border-4 border-rose-200 bg-white p-8 text-center shadow-xl">
        <p className="text-xl font-black text-rose-700">Esta pregunta tiene un formato incompleto.</p>
        <p className="mt-2 text-slate-600">Regresa al menú y vuelve a intentarlo.</p>
      </section>
    );
  }

  const progreso = ((preguntaActual + (seleccion ? 1 : 0)) / preguntas.length) * 100;

  return (
    <main className="w-full max-w-4xl overflow-hidden rounded-[2rem] border-4 border-white bg-white/95 shadow-2xl">
      <div className="bg-gradient-to-r from-cyan-400 via-sky-300 to-lime-300 px-6 py-5 sm:px-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <MascotaMurcielago className="h-14 w-14 drop-shadow" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-700">Reto de ciencias</p>
              <h1 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">{juego?.titulo || "Aventura de ciencias"}</h1>
            </div>
          </div>
          <div className="rounded-full border-2 border-white/80 bg-white/80 px-4 py-2 font-black text-slate-800 shadow-sm" aria-live="polite">
            ⭐ {puntuacion} puntos
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-black text-slate-700">{preguntaActual + 1} / {preguntas.length}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-white/60" role="progressbar" aria-label="Progreso del juego" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-pink-400 transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      </div>

      <div className="p-6 sm:p-9">
        {juego?.instrucciones && (
          <p className="mb-6 rounded-2xl border-2 border-yellow-200 bg-yellow-50 px-5 py-4 text-base font-semibold leading-relaxed text-slate-700">
            <span className="mr-2" aria-hidden="true">💡</span>{juego.instrucciones}
          </p>
        )}
        <p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-sky-700">Piensa como científico</p>
        <h2 className="text-2xl font-black leading-snug text-slate-800 sm:text-3xl">{pregunta.pregunta}</h2>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {pregunta.opciones.map((opcion, indice) => {
            const seleccionada = indice === seleccion?.indice;
            const esCorrecta = indice === pregunta.correcta;
            const estado = seleccion !== null
              ? esCorrecta
                ? "border-emerald-500 bg-emerald-500 text-white shadow-emerald-200"
                : seleccionada
                  ? "border-rose-500 bg-rose-500 text-white shadow-rose-200"
                  : "border-slate-200 bg-slate-100 text-slate-500 opacity-70"
              : coloresOpciones[indice % coloresOpciones.length];

            return (
              <button key={`${indice}-${opcion}`} type="button" onClick={() => {
                if (seleccion !== null) return;
                const correcta = indice === pregunta.correcta;
                setSeleccion({ indice, correcta });
                if (correcta) setPuntuacion((actual) => actual + 1);
              }} disabled={seleccion !== null} aria-pressed={seleccionada} className={`group flex min-h-20 items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-lg font-extrabold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-default disabled:hover:translate-y-0 sm:text-xl ${estado}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black shadow-sm ${seleccionada && seleccion ? seleccion.correcta ? "text-emerald-700" : "text-rose-700" : "text-slate-700"}`}>
                  {seleccion !== null && esCorrecta ? "✓" : seleccionada && seleccion ? "×" : String.fromCharCode(65 + indice)}
                </span>
                <span>{opcion}</span>
              </button>
            );
          })}
        </div>

        {seleccion && (
          <div aria-live="polite" className={`mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-row ${seleccion.correcta ? "bg-emerald-50" : "bg-rose-50"}`}>
            <p className={`text-lg font-black ${seleccion.correcta ? "text-emerald-700" : "text-rose-700"}`}>
              {seleccion.correcta ? "¡Eso es! ¡Lo descubriste! 🎉" : "¡Casi! La respuesta correcta está marcada. 💪"}
            </p>
            <button type="button" onClick={avanzar} className="min-h-13 w-full rounded-xl border-b-4 border-indigo-800 bg-indigo-600 px-6 py-3 font-black text-white shadow-md transition hover:bg-indigo-500 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 sm:w-auto">
              {preguntaActual === preguntas.length - 1 ? "Ver mis estrellas 🏆" : "Siguiente reto →"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
