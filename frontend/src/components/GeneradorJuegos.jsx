import { useState } from "react";
import { Check } from "lucide-react";
import VisorActividad from "./VisorActividad";
import { GRADOS, MATERIAS, nombreDeGrado } from "../lib/materias";

const formatos = [
  { id: "sorpresa", icono: "🎲", nombre: "Sorpréndeme", ayuda: "La IA elige el mejor reto" },
  { id: "quiz", icono: "🎯", nombre: "Quiz", ayuda: "Responde y gana puntos" },
  { id: "verdadero_falso", icono: "🔎", nombre: "¿Cierto o falso?", ayuda: "Descubre si es verdad" },
  { id: "ordenar", icono: "🧩", nombre: "Ordena pasos", ayuda: "Arma la secuencia correcta" },
  { id: "relacionar", icono: "🔗", nombre: "Une parejas", ayuda: "Conecta ideas relacionadas" },
  { id: "memoria", icono: "🃏", nombre: "Memoria", ayuda: "Encuentra las parejas ocultas" },
  { id: "completar", icono: "✏️", nombre: "Completa", ayuda: "Escribe la palabra que falta" },
  { id: "clasificar", icono: "🗂️", nombre: "Clasifica", ayuda: "Reparte cada cosa en su caja" },
  { id: "linea_tiempo", icono: "⏳", nombre: "Línea de tiempo", ayuda: "Coloca los sucesos en su lugar" },
];

// Ideas rápidas por materia: cambian según la materia elegida.
const ideasPorMateria = {
  ciencias: ["El ciclo del agua", "Animales vertebrados e invertebrados", "Las partes de una planta"],
  matematicas: ["Fracciones equivalentes", "Perímetro y área de figuras", "Problemas de multiplicación"],
  espanol: ["Sustantivos y adjetivos", "Partes de un cuento", "Uso de mayúsculas"],
  historia: ["La Independencia de México", "Culturas prehispánicas", "Personajes de la Revolución"],
  geografia: ["Los continentes y océanos", "Climas de México", "Leer un mapa"],
  civica: ["Mis derechos y deberes", "Resolver conflictos con diálogo", "Respeto a la diversidad"],
  ingles: ["Colors and numbers", "My family", "Animals vocabulary"],
  artes: ["Colores primarios y secundarios", "Instrumentos musicales", "Ritmo y movimiento"],
};

const etiqueta = "mb-3 block font-display text-lg font-semibold text-[#22184a]";

export default function GeneradorJuegos({ onGenerar, sesion = null, onIrARevisar = null }) {
  // El componente se vuelve a montar al cambiar de sesión (ver key en PanelDocente), por eso
  // basta con precargar el texto aquí y no hace falta un efecto.
  const [texto, setTexto] = useState(() => (sesion ? `Crea una actividad sobre ${sesion.tema}.` : ""));
  const [idMateria, setIdMateria] = useState("ciencias");
  const [grado, setGrado] = useState(4);
  const [juego, setJuego] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [tipoActividad, setTipoActividad] = useState("sorpresa");

  const materia = MATERIAS.find((m) => m.id === idMateria);

  const handleGenerar = async (event) => {
    event.preventDefault();
    const pedido = texto.trim();
    if (!pedido || cargando) return;

    setCargando(true);
    setError("");
    setJuego(null);

    try {
      // La materia y el grado viajan como datos propios: el servidor los guarda y ajusta la edad y el
      // vocabulario que le pide a la IA.
      const respuesta = await onGenerar(pedido, tipoActividad, sesion?.id_sesion, { materia: idMateria, grado });
      setJuego(respuesta?.juego ?? respuesta);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la actividad. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <section className="w-full max-w-4xl">
      <form onSubmit={handleGenerar} className="space-y-8 rounded-[2rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[6px_6px_0_#22184a] sm:p-8">
        {sesion && <p className="inline-flex rounded-full border-2 border-[#22184a] bg-[#fff4cf] px-4 py-1.5 text-sm font-extrabold">📘 Sesión: {sesion.titulo}</p>}

        {/* 1. Materia */}
        <fieldset disabled={cargando}>
          <legend className={etiqueta}>1. ¿De qué materia es?</legend>
          <div className="flex flex-wrap gap-2">
            {MATERIAS.map((m) => {
              const activa = m.id === idMateria;
              return (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={activa}
                  onClick={() => setIdMateria(m.id)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${activa ? "border-[#22184a] shadow-[3px_3px_0_#22184a]" : "border-[#e6e1f5] hover:border-[#22184a]"}`}
                  style={{ backgroundColor: activa ? m.color : m.suave, color: activa ? "#22184a" : m.tinta }}
                >
                  <m.Icono size={16} strokeWidth={2.6} aria-hidden="true" /> {m.nombre}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Grado */}
        <div>
          <label htmlFor="grado-actividad" className={etiqueta}>2. ¿Para qué grado?</label>
          <select
            id="grado-actividad"
            value={grado}
            disabled={cargando}
            onChange={(e) => setGrado(Number(e.target.value))}
            className="min-h-12 w-full max-w-xs rounded-2xl border-2 border-[#22184a] bg-white px-4 font-bold text-[#22184a] outline-none focus:ring-4 focus:ring-[#6b46c1]/30"
          >
            {GRADOS.map((g) => <option key={g} value={g}>{nombreDeGrado(g)}</option>)}
          </select>
        </div>

        {/* 3. Tipo de juego */}
        <fieldset disabled={cargando}>
          <legend className={etiqueta}>3. ¿Qué tipo de juego?</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {formatos.map((formato) => {
              const seleccionado = tipoActividad === formato.id;
              return (
                <button key={formato.id} type="button" aria-pressed={seleccionado} onClick={() => setTipoActividad(formato.id)} className={`flex min-h-[72px] items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${seleccionado ? "border-[#22184a] bg-[#ece6ff] shadow-[3px_3px_0_#22184a]" : "border-[#e6e1f5] bg-white hover:border-[#22184a]"}`}>
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f6f4ff] text-2xl">{formato.icono}</span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-[#22184a]">{formato.nombre}</span>
                    <span className="block text-xs leading-snug text-[#4a3f7a]">{formato.ayuda}</span>
                  </span>
                  {seleccionado && <Check className="ml-auto shrink-0 text-[#6b46c1]" size={20} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 4. Tema */}
        <div>
          <label htmlFor="pedido-actividad" className={etiqueta}>4. ¿Sobre qué tema?</label>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Ideas para comenzar">
            {(ideasPorMateria[idMateria] ?? []).map((idea) => (
              <button key={idea} type="button" disabled={cargando} onClick={() => setTexto(`Crea una actividad interactiva sobre ${idea.toLowerCase()}.`)} className="rounded-full border-2 border-dashed px-3 py-2 text-left text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 disabled:opacity-60" style={{ borderColor: materia.color, color: materia.tinta, backgroundColor: materia.suave }}>
                ✨ {idea}
              </button>
            ))}
          </div>
          <textarea
            id="pedido-actividad"
            value={texto}
            onChange={(event) => setTexto(event.target.value)}
            placeholder="Ej. Ayúdame a repasar las fracciones con un juego divertido"
            rows={4}
            disabled={cargando}
            aria-describedby="aviso-privacidad-ia"
            className="w-full resize-y rounded-2xl border-2 border-[#22184a] bg-white px-4 py-3 text-[#22184a] outline-none transition placeholder:text-[#8a80b0] focus:ring-4 focus:ring-[#6b46c1]/30 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <p id="aviso-privacidad-ia" className="mt-2 text-sm text-[#4a3f7a]">🔒 No escribas nombres de alumnos: la IA no los recibe y el sistema rechaza el texto si detecta uno.</p>
        </div>

        <button
          type="submit"
          disabled={cargando || !texto.trim()}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-8 font-display text-xl font-semibold text-[#22184a] shadow-[4px_4px_0_#22184a] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {cargando ? "Creando actividad…" : "Crear actividad ✨"}
        </button>

        {error && (
          <p role="alert" className="rounded-2xl border-2 border-[#ff7f6e] bg-[#ffe7e3] p-4 font-semibold text-[#8a2a1d]">
            {error}
          </p>
        )}
      </form>

      {juego && (
        <div className="mt-8">
          <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-[#22184a] bg-[#fff4cf] p-4 font-semibold">
            <span>📝 Guardada como borrador. Tus alumnos todavía no la ven: revísala y apruébala en «Revisar actividades».</span>
            {onIrARevisar && (
              <button type="button" onClick={onIrARevisar} className="min-h-11 rounded-full border-2 border-[#22184a] bg-white px-4 text-sm font-extrabold hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
                Ir a revisar
              </button>
            )}
          </div>
          <VisorActividad juego={juego} />
        </div>
      )}
    </section>
  );
}
