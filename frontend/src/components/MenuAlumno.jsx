import { useMemo, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { LogOut, Star } from "lucide-react";
import MascotaMurcielago from "./MascotaMurcielago";
import PanelInsignias from "./PanelInsignias";
import InsigniaMateria from "./InsigniaMateria";
import { MATERIAS, MATERIA_GENERAL, materiaDeJuego } from "../lib/materias";

const etiquetasActividad = {
  quiz: "Quiz relámpago",
  verdadero_falso: "Cierto o falso",
  ordenar: "Ordena los pasos",
  relacionar: "Une las parejas",
  memoria: "Juego de memoria",
  completar: "Completa la frase",
  clasificar: "Clasifica y agrupa",
  linea_tiempo: "Línea del tiempo",
  clase: "Clase interactiva",
};

const filtrosEstado = [
  { id: "todas", texto: "Todas" },
  { id: "pendientes", texto: "Por hacer" },
  { id: "realizadas", texto: "Realizadas" },
];

const ORDEN_MATERIAS = [...MATERIAS, MATERIA_GENERAL];

// `avance` es { [id_juego]: { mejor, intentos } } y viene de /resultados/mios: una actividad
// está "realizada" cuando el alumno ya terminó al menos un intento (en una clase, su evaluación).
export default function MenuAlumno({ nombre, avatar, puntuacion, juegos = [], avance = {}, logros = null, onJugar, onSalir }) {
  const lista = useMemo(() => (Array.isArray(juegos) ? juegos : []), [juegos]);
  const hayJuegos = lista.length > 0;
  const [filtro, setFiltro] = useState("todas");
  const [verInsignias, setVerInsignias] = useState(false);
  const [materiaActiva, setMateriaActiva] = useState("todas");

  const idDe = (juego) => String(juego?.id_juego ?? juego?.id ?? "");
  const estaRealizada = (juego) => Boolean(avance[idDe(juego)]);
  const totalRealizadas = lista.filter(estaRealizada).length;
  const porcentaje = hayJuegos ? Math.round((totalRealizadas / lista.length) * 100) : 0;

  // Cada juego conserva su número de misión original aunque se filtre, para no confundir al niño.
  const conMateria = useMemo(
    () => lista.map((juego, indice) => ({ juego, indice, materia: materiaDeJuego(juego) })),
    [lista],
  );

  // Solo se muestran las materias que tienen actividades, en un orden fijo.
  const materiasPresentes = ORDEN_MATERIAS.filter((m) => conMateria.some((j) => j.materia.id === m.id));

  const cumpleEstado = ({ juego }) =>
    filtro === "todas" ? true : filtro === "realizadas" ? estaRealizada(juego) : !estaRealizada(juego);
  const visibles = conMateria.filter((j) => (materiaActiva === "todas" || j.materia.id === materiaActiva) && cumpleEstado(j));

  // En «Todas» se agrupan por materia, como estantes de un librero.
  const grupos = materiaActiva === "todas"
    ? materiasPresentes.map((m) => ({ materia: m, items: visibles.filter((j) => j.materia.id === m.id) })).filter((g) => g.items.length)
    : [{ materia: materiasPresentes.find((m) => m.id === materiaActiva), items: visibles }];

  const pendientesDe = (idMateria) =>
    conMateria.filter((j) => (idMateria === "todas" || j.materia.id === idMateria) && !estaRealizada(j.juego)).length;

  return (
    <MotionConfig reducedMotion="user">
      <main className="relative min-h-screen overflow-hidden bg-[#f6f4ff] text-[#22184a]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#e3dbff]" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-8 sm:py-7">
          {/* Barra superior */}
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MascotaMurcielago className="h-12 w-12" label="Mupi, tu murciélago guía" />
              <span className="font-display text-2xl font-semibold">Mupi</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-4 font-display text-lg font-semibold">
                <Star size={18} fill="currentColor" aria-hidden="true" /> {puntuacion ?? 0} <span className="sr-only">puntos</span><span aria-hidden="true" className="hidden sm:inline">puntos</span>
              </span>
              {logros && (
                <button type="button" onClick={() => setVerInsignias(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[3px] border-[#22184a] bg-[#22184a] px-4 text-sm font-extrabold text-white transition hover:bg-[#3a2c78] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
                  <span aria-hidden="true">🦇</span> {logros.nivel.nombre} · {logros.obtenidas}/{logros.total} insignias
                </button>
              )}
              <button type="button" onClick={onSalir} className="inline-flex min-h-11 items-center gap-2 rounded-full border-[3px] border-[#22184a] bg-white px-4 font-bold transition hover:bg-[#ffe7e3] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
                <LogOut size={18} aria-hidden="true" /> Salir
              </button>
            </div>
          </header>

          {/* Bienvenida con progreso */}
          <section className="relative mt-6 overflow-hidden rounded-[2rem] border-[3px] border-[#22184a] bg-[#6b46c1] p-6 text-white shadow-[6px_6px_0_#22184a] sm:p-8">
            <div aria-hidden="true" className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-[#7d5ad0]" />
            <div className="relative flex flex-wrap items-center gap-5">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-[#22184a] bg-[#fff4cf]">
                {avatar ? <img src={avatar} alt={`Avatar de ${nombre}`} className="h-full w-full object-cover" /> : <MascotaMurcielago className="h-16 w-16" label="Mupi" />}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">¡Hola, {nombre}!</h1>
                <p className="mt-1 text-lg text-[#ece6ff]">¿Qué quieres aprender hoy?</p>
              </div>
            </div>
            {hayJuegos && (
              <div className="relative mt-6 max-w-xl">
                <p className="mb-2 font-bold" aria-live="polite">
                  {totalRealizadas === lista.length ? "¡Terminaste todas tus actividades! 🎉" : `Llevas ${totalRealizadas} de ${lista.length} actividades`}
                </p>
                <div className="h-4 overflow-hidden rounded-full border-2 border-[#22184a] bg-white" role="progressbar" aria-label="Actividades realizadas" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-[#ffc93c] transition-all duration-700" style={{ width: `${porcentaje}%` }} />
                </div>
              </div>
            )}
          </section>

          {hayJuegos ? (
            <>
              {/* Pestañas de materia */}
              <section aria-labelledby="titulo-materias" className="mt-8">
                <h2 id="titulo-materias" className="font-display text-2xl font-semibold">Elige una materia</h2>
                <div role="group" aria-label="Filtrar por materia" className="mt-4 flex gap-3 overflow-x-auto pb-3">
                  <BotonMateria activa={materiaActiva === "todas"} onClick={() => setMateriaActiva("todas")} titulo="Todas" pendientes={pendientesDe("todas")} color="#22184a" suave="#ffffff" />
                  {materiasPresentes.map((m) => (
                    <BotonMateria key={m.id} activa={materiaActiva === m.id} onClick={() => setMateriaActiva(m.id)} titulo={m.corto} pendientes={pendientesDe(m.id)} color={m.color} suave={m.suave} Icono={m.Icono} />
                  ))}
                </div>
              </section>

              {/* Filtro por estado */}
              <div role="group" aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2">
                {filtrosEstado.map((f) => (
                  <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id} className={`min-h-11 rounded-full border-2 px-4 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${filtro === f.id ? "border-[#22184a] bg-[#22184a] text-white" : "border-[#d8d0f0] bg-white text-[#4a3f7a] hover:border-[#22184a]"}`}>
                    {f.texto}
                  </button>
                ))}
              </div>

              {/* Actividades */}
              {visibles.length === 0 ? (
                <div className="mt-6 rounded-[2rem] border-[3px] border-dashed border-[#b9a5f0] bg-white px-6 py-10 text-center">
                  <p className="font-display text-2xl font-semibold">{filtro === "pendientes" ? "¡Lo hiciste todo aquí! 🎉" : "Todavía no hay actividades aquí."}</p>
                  <p className="mt-2 text-[#4a3f7a]">{filtro === "pendientes" ? "Prueba otra materia o repite una actividad." : "Cuando termines una, aparecerá en esta lista."}</p>
                </div>
              ) : (
                <div className="mt-6 space-y-10">
                  {grupos.map(({ materia, items }) => (
                    <section key={materia.id} aria-label={materia.nombre}>
                      {materiaActiva === "todas" && (
                        <div className="mb-4 flex items-center gap-3">
                          <span className="grid h-11 w-11 place-items-center rounded-2xl border-[3px] border-[#22184a]" style={{ backgroundColor: materia.color }}>
                            <materia.Icono size={22} strokeWidth={2.5} color="#22184a" aria-hidden="true" />
                          </span>
                          <h3 className="font-display text-2xl font-semibold">{materia.nombre}</h3>
                        </div>
                      )}
                      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(({ juego, indice }, i) => (
                          <TarjetaActividad
                            key={idDe(juego) || `${indice}`}
                            juego={juego}
                            indice={indice}
                            orden={i}
                            materia={materia}
                            realizada={estaRealizada(juego)}
                            mejor={avance[idDe(juego)]?.mejor}
                            onJugar={onJugar}
                          />
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="mt-8 rounded-[2rem] border-[3px] border-dashed border-[#b9a5f0] bg-white px-6 py-12 text-center">
              <MascotaMurcielago className="mx-auto mb-4 h-24 w-24" label="Mupi" />
              <p className="font-display text-2xl font-semibold">¡Pronto habrá nuevas actividades!</p>
              <p className="mt-2 text-[#4a3f7a]">Tu maestro todavía no ha publicado ninguna. Vuelve más tarde.</p>
            </div>
          )}
        </div>
      {verInsignias && logros && <PanelInsignias logros={logros} onCerrar={() => setVerInsignias(false)} />}
      </main>
    </MotionConfig>
  );
}

function BotonMateria({ activa, onClick, titulo, pendientes, color, suave, Icono }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={`flex min-h-20 min-w-40 shrink-0 items-center gap-3 rounded-3xl border-[3px] border-[#22184a] px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${activa ? "-translate-y-1 shadow-[5px_5px_0_#22184a]" : "shadow-[2px_2px_0_#22184a] hover:-translate-y-0.5"}`}
      style={{ backgroundColor: activa ? color : suave }}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 border-[#22184a] bg-white">
        {Icono ? <Icono size={22} strokeWidth={2.5} color="#22184a" aria-hidden="true" /> : <span aria-hidden="true" className="text-xl">✨</span>}
      </span>
      <span>
        <span className={`block font-display text-lg font-semibold leading-tight ${activa && color === "#22184a" ? "text-white" : "text-[#22184a]"}`}>{titulo}</span>
        <span className={`block text-xs font-bold ${activa && color === "#22184a" ? "text-[#ded6ff]" : "text-[#4a3f7a]"}`}>
          {pendientes === 0 ? "¡Al día!" : `${pendientes} por hacer`}
        </span>
      </span>
    </button>
  );
}

function TarjetaActividad({ juego, indice, orden, materia, realizada, mejor, onJugar }) {
  const titulo = juego?.titulo || juego?.contenido_juego?.titulo || `Actividad ${indice + 1}`;
  const tipo = juego?.contenido_juego?.tipo_actividad || "quiz";
  return (
    <motion.li
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(orden, 8) * 0.05 }}
      className="flex flex-col overflow-hidden rounded-[1.75rem] border-[3px] border-[#22184a] bg-white shadow-[5px_5px_0_#22184a]"
    >
      <div className="relative flex items-center justify-between gap-2 px-5 py-4" style={{ backgroundColor: materia.suave }}>
        <InsigniaMateria materia={materia} corta />
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold text-[#22184a]">Misión {indice + 1}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h4 className="font-display text-2xl font-semibold leading-tight">{titulo}</h4>
        <p className="mt-2 text-sm font-bold text-[#4a3f7a]">{etiquetasActividad[tipo] || "Reto interactivo"}</p>
        {realizada && (
          <p className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-[#e3faf4] px-3 py-1 text-sm font-extrabold text-[#0d5b4d]">
            <span aria-hidden="true">✓</span> Realizada{typeof mejor === "number" ? ` · ${mejor}%` : ""}
          </p>
        )}
        <button
          type="button"
          onClick={() => onJugar?.(juego)}
          className={`mt-5 min-h-14 w-full rounded-2xl border-[3px] border-[#22184a] font-display text-xl font-semibold shadow-[3px_3px_0_#22184a] transition hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${realizada ? "bg-white text-[#22184a]" : "bg-[#6b46c1] text-white"}`}
          aria-label={`${realizada ? "Repetir" : "Jugar"}: ${titulo}`}
        >
          {realizada ? "Repetir 🔁" : "¡A jugar! 🚀"}
        </button>
      </div>
    </motion.li>
  );
}
