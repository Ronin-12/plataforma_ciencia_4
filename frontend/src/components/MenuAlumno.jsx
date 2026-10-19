import MascotaMurcielago from "./MascotaMurcielago";
import SpotlightCard from "./SpotlightCard";
import { motion, useReducedMotion } from "framer-motion";
import FondoAventura from "./FondoAventura";

const tarjetas = [
  "from-[#e879a9] to-[#d95778] border-[#bd4968] text-white",
  "from-[#e8ad48] to-[#dc7845] border-[#b95c33] text-white",
  "from-[#76b875] to-[#429873] border-[#347b61] text-white",
  "from-[#65b5ca] to-[#498db4] border-[#36728f] text-white",
  "from-[#9b80ca] to-[#7356a8] border-[#5a438c] text-white",
];

const etiquetasActividad = {
  quiz: "Quiz relámpago",
  verdadero_falso: "Cierto o falso",
  ordenar: "Ordena los pasos",
  relacionar: "Une las parejas",
  memoria: "Juego de memoria",
  completar: "Completa la frase",
};

export default function MenuAlumno({ nombre, avatar, puntuacion, juegos = [], onJugar, onSalir }) {
  const hayJuegos = Array.isArray(juegos) && juegos.length > 0;
  const reducirMovimiento = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden bg-transparent px-4 py-7 text-slate-900 sm:px-6 lg:px-8">
      <FondoAventura />
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        <header className="mb-9 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border-2 border-white/75 bg-white/75 p-5 shadow-[0_18px_55px_-30px_rgba(27,65,74,.35)] backdrop-blur-xl sm:p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300 bg-gradient-to-br from-sky-100 to-rose-100 text-4xl shadow-sm">
              {avatar ? <img src={avatar} alt={`Avatar de ${nombre}`} className="h-full w-full object-cover" /> : <MascotaMurcielago className="h-14 w-14" />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-600">¡Qué bueno verte, explorador!</p>
              <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">{nombre}</h1>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-black text-amber-900">⭐ {puntuacion ?? 0} puntos</p>
            </div>
          </div>
          <button type="button" onClick={onSalir} className="min-h-12 rounded-full border-2 border-slate-200 bg-white px-5 font-bold text-slate-700 transition hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Salir</button>
        </header>

        <section aria-labelledby="titulo-juegos">
          <div className="mb-6 flex items-center gap-4">
            <MascotaMurcielago className="h-16 w-16 drop-shadow-sm" />
            <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-teal-900">Tu laboratorio te espera</p>
              <h2 id="titulo-juegos" className="text-3xl font-black text-slate-900 sm:text-4xl">¡Elige tu aventura!</h2>
            </div>
          </div>

          {hayJuegos ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {juegos.map((juego, indice) => {
                const titulo = juego?.titulo || juego?.contenido_juego?.titulo || `Aventura ${indice + 1}`;
                const tipo = juego?.contenido_juego?.tipo_actividad || "quiz";
                return (
                  <motion.div key={juego?.id_juego ?? juego?.id ?? `${titulo}-${indice}`} initial={{ opacity: 0, y: reducirMovimiento ? 0 : 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducirMovimiento ? 0 : 0.55, delay: reducirMovimiento ? 0 : indice * 0.1, ease: "easeOut" }} whileHover={reducirMovimiento ? undefined : { scale: 1.05, y: -5, rotate: indice % 2 === 0 ? 1 : -1, rotateX: -2 }} whileTap={reducirMovimiento ? undefined : { scale: 0.985 }} style={{ transformPerspective: 900 }} className="h-full">
                    <SpotlightCard theme="dark" spotlightColor={indice % 2 === 0 ? "#ffe3a1" : "#c7f1e8"} intensity={0.1} borderGlow={0.14} className={`group flex min-h-72 h-full flex-col border-4 bg-gradient-to-br p-6 shadow-xl transition-shadow duration-300 hover:shadow-2xl ${tarjetas[indice % tarjetas.length]}`} style={{ "--spotlight-card-surface": "#303542", "--spotlight-card-shadow": "0 22px 55px -25px rgba(31,41,55,.5)" }}>
                      <span aria-hidden="true" className="absolute -right-2 -top-5 rotate-12 text-6xl opacity-25 transition group-hover:scale-105">✦</span>
                      <div className="relative flex flex-1 flex-col">
                        <p className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/35 bg-black/15 px-3 py-1 text-xs font-black uppercase tracking-wider text-white"><span aria-hidden="true">🧪</span> Misión {indice + 1}</p>
                        <h3 className="mb-6 text-2xl font-black leading-snug text-white">{titulo}</h3>
                        <p className="mb-4 text-sm font-bold text-white/95">{etiquetasActividad[tipo] || "Reto interactivo"}</p>
                        <motion.button type="button" onClick={() => onJugar?.(juego)} animate={reducirMovimiento ? undefined : { boxShadow: ["0 4px 10px rgba(40,50,70,.12)", "0 0 0 3px rgba(255,255,255,.32), 0 9px 22px rgba(40,50,70,.2)"] }} transition={reducirMovimiento ? undefined : { boxShadow: { duration: 1.7, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" } }} whileHover={reducirMovimiento ? undefined : { scale: 1.025, y: -2 }} whileTap={reducirMovimiento ? undefined : { scale: 0.97, y: 2 }} className="mt-auto min-h-14 w-full rounded-2xl border-b-4 border-slate-300 bg-white px-5 py-3 text-lg font-black text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60">
                          ¡A jugar! <span aria-hidden="true">🚀</span>
                        </motion.button>
                      </div>
                    </SpotlightCard>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-[2rem] border-2 border-dashed border-teal-500/35 bg-white/75 px-6 py-12 text-center shadow-sm backdrop-blur">
              <MascotaMurcielago className="mx-auto mb-4 h-24 w-24" />
              <p className="text-xl font-black text-slate-900 sm:text-2xl">¡Pronto habrá nuevas aventuras!</p>
              <p className="mt-2 font-medium text-slate-600">Pídele a tu maestro que cree un juego para ti.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
