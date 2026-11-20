import { motion, useReducedMotion } from "framer-motion";
import { emojiDeEquipo } from "../lib/equipos";

// Barra de avance de un equipo hacia la meta de la misión. El dibujo del equipo «viaja» por la barra
// y una banderita marca la meta. Se usa en el panel del docente y en la pantalla del alumno.
export default function BarraEquipo({ nombre, icono, progreso, meta, lograda, destacada = false, detalle = "" }) {
  const reducirMovimiento = useReducedMotion();
  const avance = Math.max(0, Math.min(100, progreso));
  return (
    <div className={`rounded-2xl border-[3px] p-3 sm:p-4 ${destacada ? "border-[#22184a] bg-[#fff4cf]" : "border-[#e6e1f5] bg-white"}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-base font-extrabold text-[#22184a]">
          <span aria-hidden="true" className="text-2xl">{emojiDeEquipo(icono)}</span>{nombre}
        </p>
        <p className={`rounded-full px-3 py-1 text-sm font-black ${lograda ? "bg-emerald-100 text-emerald-900" : "bg-[#ece6ff] text-[#4a3f7a]"}`}>
          {lograda ? "¡Meta lograda! 🎉" : `${avance} % de ${meta} %`}
        </p>
      </div>
      <div className="relative pt-5">
        <div
          role="progressbar" aria-label={`Avance de ${nombre}`} aria-valuenow={avance} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${avance} por ciento. La meta es ${meta} por ciento.`}
          className="h-5 overflow-hidden rounded-full border-2 border-[#22184a] bg-[#f6f4ff]"
        >
          <motion.div
            className={`h-full rounded-full ${lograda ? "bg-gradient-to-r from-emerald-400 to-teal-400" : "bg-gradient-to-r from-[#ffc93c] to-[#ff9b54]"}`}
            initial={reducirMovimiento ? false : { width: 0 }} animate={{ width: `${avance}%` }} transition={{ duration: 0.9, ease: "easeOut" }}
          />
        </div>
        <span aria-hidden="true" className="absolute top-0 -translate-x-1/2 text-lg leading-none" style={{ left: `${meta}%` }}>🏁</span>
      </div>
      {detalle && <p className="mt-2 text-sm font-semibold text-[#4a3f7a]">{detalle}</p>}
    </div>
  );
}
