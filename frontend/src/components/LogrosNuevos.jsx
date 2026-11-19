import { motion, useReducedMotion } from "framer-motion";
import InsigniaMedalla from "./InsigniaMedalla";

// Celebración al terminar una actividad: muestra las insignias que se ganaron justo con ese intento.
export default function LogrosNuevos({ insignias = [] }) {
  const reducirMovimiento = useReducedMotion();
  if (!insignias.length) return null;
  return (
    <motion.div
      role="status"
      initial={reducirMovimiento ? false : { opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 18, delay: reducirMovimiento ? 0 : 0.25 }}
      className="mx-auto mt-6 max-w-xl rounded-3xl border-2 border-[#66a4b9]/50 bg-gradient-to-br from-[#12213a] to-[#25507a] p-5 text-white shadow-xl"
    >
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-200">{insignias.length > 1 ? "¡Ganaste nuevas insignias!" : "¡Ganaste una insignia!"}</p>
      <ul className="mt-3 flex flex-wrap items-start justify-center gap-5">
        {insignias.map((insignia) => (
          <li key={insignia.id} className="flex w-32 flex-col items-center text-center">
            <InsigniaMedalla insignia={insignia} tamano={92} />
            <p className="mt-1 text-sm font-black leading-tight">{insignia.nombre}</p>
            <p className="mt-0.5 text-xs leading-snug text-[#cfe0ee]">{insignia.descripcion}</p>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
