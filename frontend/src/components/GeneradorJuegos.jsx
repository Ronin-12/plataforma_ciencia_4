import { useState } from "react";
import VisorJuego from "./VisorJuego";

export default function GeneradorJuegos({ onGenerar }) {
  const [texto, setTexto] = useState("");
  const [juego, setJuego] = useState(null); // Aquí guardaremos el OBJETO del juego
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const handleGenerar = async (event) => {
    event.preventDefault();
    const solicitud = texto.trim();
    if (!solicitud || cargando) return;

    setCargando(true);
    setError("");
    setJuego(null);

    try {
      // onGenerar ahora nos devuelve el JSON ya parseado (objeto)
      const respuesta = await onGenerar(solicitud);
      setJuego(respuesta); 
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo generar el juego. Inténtalo de nuevo."
      );
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-4xl">
      {/* Formulario para pedir el juego */}
      <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg shadow-indigo-100/50 sm:p-8">
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
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Ej. Un juego sobre las partes de la planta para 4.º grado"
              rows={4}
              disabled={cargando}
              className="w-full resize-y rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || !texto.trim()}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-4 text-base font-bold text-white shadow-md shadow-indigo-200 transition hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {cargando ? "Creando juego mágico..." : "Generar Juego Mágico ✨"}
          </button>
        </form>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-700 font-semibold">
            {error}
          </p>
        )}
      </div>

      {/* Aquí mostramos el juego generado */}
      {juego && (
        <div className="mt-8 animate-fade-in">
          <VisorJuego juego={juego} />
        </div>
      )}
    </section>
  );
}