import { useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";
import VisorJuego from "./VisorJuego";

// Mini-reto de una sección: se responde una vez, da retroalimentación y NO suma puntos.
function MiniReto({ reto, onResponder, respondido }) {
  const [elegida, setElegida] = useState(null);
  const esQuiz = reto.tipo === "quiz";
  const opciones = esQuiz ? reto.opciones : ["Verdadero", "Falso"];
  const correcta = esQuiz ? reto.correcta : reto.correcta ? 0 : 1;
  const acerto = elegida === correcta;

  function elegir(indice) {
    if (elegida !== null) return;
    setElegida(indice);
    onResponder();
  }

  return (
    <div className="rounded-2xl border-2 border-sky-200 bg-sky-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-800">Mini-reto · no cuenta para tu puntaje</p>
      <h3 className="mt-2 text-xl font-black leading-snug text-slate-800">{esQuiz ? reto.pregunta : reto.afirmacion}</h3>
      <div className={`mt-4 grid gap-3 ${esQuiz ? "sm:grid-cols-2" : "grid-cols-2"}`}>
        {opciones.map((opcion, indice) => {
          let estilo = "border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-100";
          if (elegida !== null && indice === correcta) estilo = "border-emerald-500 bg-emerald-100";
          else if (elegida === indice) estilo = "border-rose-400 bg-rose-100";
          return (
            <button key={indice} type="button" disabled={respondido} onClick={() => elegir(indice)} className={`min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg font-bold text-slate-800 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${estilo}`}>
              {opcion}
            </button>
          );
        })}
      </div>
      {elegida !== null && (
        <p role="status" className={`mt-4 text-lg font-black ${acerto ? "text-emerald-700" : "text-rose-700"}`}>
          {acerto ? "¡Muy bien! 🎉" : "¡Casi! Ahora ya lo sabes. 💪"}
          {!esQuiz && reto.explicacion && <span className="mt-1 block text-base font-semibold text-slate-700">{reto.explicacion}</span>}
          {esQuiz && !acerto && <span className="mt-1 block text-base font-semibold text-slate-700">Respuesta: {reto.opciones[reto.correcta]}</span>}
        </p>
      )}
    </div>
  );
}

// Clase interactiva: recorre las secciones y termina en la evaluación (un juego normal que sí da puntos).
// onTerminar / onReiniciar / estadoResultado se pasan a la evaluación; son opcionales (vista previa).
export default function VisorClase({ juego, onTerminar, onReiniciar, estadoResultado }) {
  const secciones = Array.isArray(juego?.secciones) ? juego.secciones : [];
  const [paso, setPaso] = useState(0);
  const [respondidos, setRespondidos] = useState({});
  const enEvaluacion = paso >= secciones.length;

  if (!secciones.length || !juego?.evaluacion) {
    return (
      <section className="w-full max-w-3xl rounded-[2rem] border-4 border-white bg-white/90 p-8 text-center shadow-xl">
        <MascotaMurcielago className="mx-auto mb-3 h-24 w-24" />
        <h1 className="text-2xl font-black text-slate-800">¡Clase en pausa!</h1>
        <p className="mt-2 text-lg font-medium text-slate-600">Esta clase llegó incompleta. Pídele a tu maestro que la revise.</p>
      </section>
    );
  }

  if (enEvaluacion) {
    return (
      <div className="flex w-full flex-col items-center">
        <div className="mb-4 flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/90 px-5 py-3 shadow">
          <p className="font-black text-slate-800">📝 ¡Llegó la evaluación final! Usa lo que aprendiste.</p>
          <button type="button" onClick={() => setPaso(0)} className="min-h-11 rounded-xl border-2 border-teal-700 bg-white px-4 font-black text-teal-900 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">↩ Repasar la clase</button>
        </div>
        <VisorJuego juego={juego.evaluacion} onTerminar={onTerminar} onReiniciar={onReiniciar} estadoResultado={estadoResultado} />
      </div>
    );
  }

  const seccion = secciones[paso];
  const progreso = (paso / (secciones.length + 1)) * 100;
  const respondido = Boolean(respondidos[paso]);

  return (
    <main className="w-full max-w-4xl overflow-hidden rounded-[2rem] border-4 border-white bg-white/95 shadow-2xl">
      <header className="bg-gradient-to-r from-teal-100 via-sky-50 to-lime-100 px-6 py-5 sm:px-9">
        <div className="flex items-center gap-3">
          <MascotaMurcielago className="h-14 w-14 drop-shadow" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">Clase interactiva</p>
            <h1 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">{juego.titulo}</h1>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-black text-slate-700">Parte {paso + 1} / {secciones.length}</span>
          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-white/60" role="progressbar" aria-label="Progreso de la clase" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-300 transition-all duration-500" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      </header>

      <section className="space-y-5 p-6 sm:p-9">
        {paso === 0 && juego.instrucciones && <p className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-base font-semibold leading-relaxed text-slate-700"><span className="mr-2" aria-hidden="true">💡</span>{juego.instrucciones}</p>}
        <h2 className="text-2xl font-black leading-snug text-slate-800 sm:text-3xl">{seccion.titulo}</h2>
        <p className="text-xl leading-relaxed text-slate-700">{seccion.explicacion}</p>
        <p className="rounded-2xl bg-emerald-50 px-5 py-4 text-lg font-semibold leading-relaxed text-emerald-900"><span className="mr-2" aria-hidden="true">🌱</span>Ejemplo: {seccion.ejemplo}</p>
        <MiniReto key={paso} reto={seccion.mini_reto} respondido={respondido} onResponder={() => setRespondidos((r) => ({ ...r, [paso]: true }))} />
        <div className="flex flex-wrap justify-between gap-3">
          <button type="button" disabled={paso === 0} onClick={() => setPaso(paso - 1)} className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-5 font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-40">← Antes</button>
          <button type="button" disabled={!respondido} onClick={() => setPaso(paso + 1)} className="min-h-12 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-6 py-3 font-black text-white shadow-md transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:opacity-50">
            {paso === secciones.length - 1 ? "Ir a la evaluación 📝" : "Siguiente →"}
          </button>
        </div>
      </section>
    </main>
  );
}
