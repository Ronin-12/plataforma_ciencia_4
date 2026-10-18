import { useState } from "react";
import VisorJuego from "./VisorJuego";

export default function GeneradorJuegos({ onGenerar }) {
  const [texto, setTexto] = useState("");
  const [juego, setJuego] = useState(null); // Aquí guardaremos el OBJETO del juego
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [tipoActividad, setTipoActividad] = useState("sorpresa");
  const formatos = [
    { id: "sorpresa", icono: "🎲", nombre: "Sorpréndeme", ayuda: "La IA elige el mejor reto" },
    { id: "quiz", icono: "🎯", nombre: "Quiz", ayuda: "Responde y gana puntos" },
    { id: "verdadero_falso", icono: "🔎", nombre: "¿Cierto o falso?", ayuda: "Descubre si es verdad" },
    { id: "ordenar", icono: "🧩", nombre: "Ordena pasos", ayuda: "Arma la secuencia correcta" },
    { id: "relacionar", icono: "🔗", nombre: "Une parejas", ayuda: "Conecta ideas relacionadas" },
    { id: "memoria", icono: "🃏", nombre: "Memoria", ayuda: "Encuentra las parejas ocultas" },
    { id: "completar", icono: "✏️", nombre: "Completa", ayuda: "Escribe la palabra que falta" },
  ];
  const sugerencias = [
    "El ciclo del agua para niños de 9 años",
    "Animales vertebrados e invertebrados",
    "Las partes de una planta",
  ];

  const handleGenerar = async (event) => {
    event.preventDefault();
    const solicitud = texto.trim();
    if (!solicitud || cargando) return;

    setCargando(true);
    setError("");
    setJuego(null);

    try {
      // onGenerar ahora nos devuelve el JSON ya parseado (objeto)
      const respuesta = await onGenerar(solicitud, tipoActividad);
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
      <div className="rounded-[2rem] border-2 border-cyan-100 bg-gradient-to-br from-white via-white to-amber-50 p-6 shadow-xl shadow-cyan-100/60 sm:p-8">
        <header className="mb-7">
          <p className="mb-2 inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-sm font-black uppercase tracking-wider text-teal-800">
            🧪
            Panel del docente
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Crea un juego con Inteligencia Artificial
          </h1>
          <p className="mt-2 text-slate-600">
            Describe el juego que quieres crear para tu clase.
          </p>
        </header>

        <div className="mb-4 flex flex-wrap gap-2" aria-label="Ideas para comenzar">
          {sugerencias.map((idea) => (
            <button key={idea} type="button" disabled={cargando} onClick={() => setTexto(`Crea una actividad interactiva sobre ${idea.toLowerCase()}.`)} className="rounded-full border-2 border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-bold text-amber-900 transition hover:-translate-y-0.5 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 disabled:opacity-60">
              ✨ {idea}
            </button>
          ))}
        </div>

        <fieldset className="mb-5">
          <legend className="mb-3 text-sm font-black text-slate-800">¿Qué tipo de aventura quieres?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {formatos.map((formato) => {
              const seleccionado = tipoActividad === formato.id;
              return (
                <button key={formato.id} type="button" disabled={cargando} aria-pressed={seleccionado} onClick={() => setTipoActividad(formato.id)} className={`group flex min-h-[76px] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:opacity-60 ${seleccionado ? "border-teal-600 bg-teal-50 shadow-sm" : "border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/60"}`}>
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-2xl shadow-sm">{formato.icono}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-800">{formato.nombre}</span>
                    <span className="block text-xs leading-snug text-slate-600">{formato.ayuda}</span>
                  </span>
                  {seleccionado && <span className="ml-auto font-black text-teal-700" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </fieldset>

        <form onSubmit={handleGenerar} className="space-y-5">
          <div>
            <textarea
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              placeholder="Ej. Ayúdame a enseñar cómo crece una planta con una actividad divertida"
              rows={4}
              disabled={cargando}
              className="w-full resize-y rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <button
            type="submit"
            disabled={cargando || !texto.trim()}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl border-b-4 border-orange-700 bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-300 px-6 py-4 text-base font-black text-orange-950 shadow-md shadow-orange-200 transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {cargando ? "Creando juego mágico..." : "Generar Juego Mágico ✨"}
          </button>
        </form>

        {error && (
          <p role="alert" className="mt-4 rounded-2xl border-2 border-rose-200 bg-rose-50 p-4 font-semibold text-rose-800">
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
