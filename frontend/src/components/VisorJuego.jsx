import { useEffect, useState } from "react";

export default function VisorJuego({ juego }) {
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [puntuacion, setPuntuacion] = useState(0);

  useEffect(() => {
    setPreguntaActual(0);
    setSeleccion(null);
    setPuntuacion(0);
  }, [juego]);

  if (!juego || !Array.isArray(juego.preguntas) || juego.preguntas.length === 0) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-3xl bg-sky-50 p-8 text-center shadow-lg">
        <p className="text-xl font-bold text-slate-700">
          Este juego todavía no tiene preguntas.
        </p>
      </section>
    );
  }

  const preguntas = juego.preguntas;
  const juegoCompletado = preguntaActual >= preguntas.length;

  const avanzar = () => {
    setPreguntaActual((actual) => actual + 1);
    setSeleccion(null);
  };

  if (juegoCompletado) {
    return (
      <section
        aria-live="polite"
        className="mx-auto w-full max-w-3xl rounded-3xl border-4 border-yellow-300 bg-gradient-to-br from-yellow-50 via-white to-orange-50 p-8 text-center shadow-xl sm:p-12"
      >
        <div className="mb-4 text-6xl" aria-hidden="true">
          🎉
        </div>
        <h1 className="text-3xl font-black text-indigo-800 sm:text-4xl">
          ¡Juego Completado!
        </h1>
        <p className="mt-4 text-xl font-bold text-slate-700">
          Obtuviste{" "}
          <span className="text-2xl text-emerald-600">{puntuacion}</span> de{" "}
          <span className="text-2xl text-indigo-600">{preguntas.length}</span>{" "}
          respuestas correctas.
        </p>
      </section>
    );
  }

  const pregunta = preguntas[preguntaActual];
  const indiceSeleccionado = seleccion?.indice;

  const elegirOpcion = (indice) => {
    if (seleccion !== null) return;

    const esCorrecta = indice === pregunta.correcta;
    setSeleccion({ indice, esCorrecta });

    if (esCorrecta) {
      setPuntuacion((actual) => actual + 1);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl rounded-3xl border-4 border-sky-200 bg-white p-6 shadow-xl sm:p-10">
      <header className="mb-8">
        <p className="mb-2 text-sm font-extrabold uppercase tracking-widest text-sky-600">
          Pregunta {preguntaActual + 1} de {preguntas.length}
        </p>
        <h1 className="text-3xl font-black leading-tight text-indigo-900 sm:text-4xl">
          {juego.titulo}
        </h1>
        {juego.instrucciones && (
          <p className="mt-3 rounded-2xl bg-yellow-50 p-4 text-lg font-medium leading-relaxed text-slate-700">
            {juego.instrucciones}
          </p>
        )}
      </header>

      <section aria-labelledby="pregunta-juego" className="space-y-5">
        <h2
          id="pregunta-juego"
          className="text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl"
        >
          {pregunta.pregunta}
        </h2>

        <div className="grid gap-3">
          {Array.isArray(pregunta.opciones) &&
            pregunta.opciones.map((opcion, indice) => {
              const seleccionada = indice === indiceSeleccionado;
              const clasesResultado =
                seleccion !== null && seleccionada
                  ? seleccion.esCorrecta
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-rose-500 bg-rose-500 text-white"
                  : "border-sky-200 bg-sky-50 text-slate-800 hover:border-sky-400 hover:bg-sky-100";

              return (
                <button
                  key={`${indice}-${opcion}`}
                  type="button"
                  onClick={() => elegirOpcion(indice)}
                  disabled={seleccion !== null}
                  aria-pressed={seleccionada}
                  className={`min-h-16 rounded-2xl border-2 px-5 py-4 text-left text-lg font-bold shadow-sm transition focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:hover:bg-inherit sm:text-xl ${clasesResultado}`}
                >
                  <span className="mr-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/80 text-base font-black text-indigo-700">
                    {String.fromCharCode(65 + indice)}
                  </span>
                  {opcion}
                </button>
              );
            })}
        </div>

        {seleccion !== null && (
          <div aria-live="polite" className="space-y-4 pt-2">
            <p
              className={`text-xl font-black ${
                seleccion.esCorrecta ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {seleccion.esCorrecta ? "¡Correcto!" : "¡Inténtalo en la próxima!"}
            </p>
            <button
              type="button"
              onClick={avanzar}
              className="min-h-14 w-full rounded-2xl bg-indigo-600 px-6 py-4 text-lg font-extrabold text-white shadow-lg transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300"
            >
              {preguntaActual === preguntas.length - 1
                ? "Ver resultado"
                : "Siguiente Pregunta"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}