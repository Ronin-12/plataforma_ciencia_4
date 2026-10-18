import { useState } from "react";

export default function GeneradorJuegos({ onGenerar }) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleGenerar = async (event) => {
    event.preventDefault();

    const solicitud = texto.trim();
    if (!solicitud || cargando) return;

    setCargando(true);
    setResultado("");

    try {
      const respuesta = await onGenerar(solicitud);
      if (respuesta != null) {
        setResultado(
          typeof respuesta === "string"
            ? respuesta
            : JSON.stringify(respuesta, null, 2)
        );
      }
    } catch (error) {
      setResultado(
        error instanceof Error
          ? `No se pudo generar el juego: ${error.message}`
          : "No se pudo generar el juego. Inténtalo de nuevo."
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100/50 sm:p-8">
      <header className="mb-7">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-indigo-600">
          Panel del docente
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Crea un juego con Inteligencia Artificial
        </h1>
        <p className="mt-2 text-slate-600">
          Describe el juego que quieres crear para tu clase.
        </p>
      </header>

      <form onSubmit={handleGenerar} className="space-y-5">
        <div>
          <label
            htmlFor="descripcion-juego"
            className="mb-2 block text-sm font-semibold text-slate-800"
          >
            ¿Qué juego quieres crear?
          </label>
          <textarea
            id="descripcion-juego"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Ej. Un juego sobre el ciclo del agua para 4.º grado"
            rows={6}
            disabled={cargando}
            className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
          />
        </div>

        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {cargando ? "Creando juego..." : "Generar Juego Mágico ✨"}
        </button>
      </form>

      {resultado && (
        <section
          aria-live="polite"
          className="mt-8"
          aria-labelledby="resultado-juego"
        >
          <h2
            id="resultado-juego"
            className="mb-3 text-lg font-bold text-slate-900"
          >
            Resultado
          </h2>
          <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-100 p-5 font-mono text-sm leading-relaxed text-slate-800">
            {resultado}
          </pre>
        </section>
      )}
    </section>
  );
}