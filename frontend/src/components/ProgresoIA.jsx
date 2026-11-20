import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

// Panel que acompaña a una generación con IA: dice en qué etapa va y cuánto lleva.
// La espera real es la misma; lo que cambia es que el docente sabe que sigue avanzando.
export default function ProgresoIA({ etapa, titulo = "La IA está trabajando" }) {
  const [segundos, setSegundos] = useState(0);
  const sinMovimiento = useReducedMotion();

  useEffect(() => {
    const reloj = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(reloj);
  }, []);

  return (
    <div role="status" aria-live="polite" className="rounded-2xl border-2 border-[#22184a] bg-[#f6f4ff] p-4">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffc93c] text-[#22184a]">
          <Sparkles size={20} strokeWidth={2.6} className={sinMovimiento ? "" : "animate-pulse"} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-[#22184a]">{titulo}</p>
          <p className="truncate text-sm font-semibold text-[#4a3f7a]">{etapa || "Preparando…"}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black tabular-nums text-[#22184a]">{segundos} s</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e6e1f5]" aria-hidden="true">
        {sinMovimiento ? (
          <div className="h-full w-1/2 rounded-full bg-[#6b46c1]" />
        ) : (
          <motion.div
            className="h-full w-1/3 rounded-full bg-[#6b46c1]"
            animate={{ x: ["-100%", "300%"] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
      {segundos >= 12 && (
        <p className="mt-3 text-xs font-semibold text-[#4a3f7a]">
          Un material largo puede tardar un poco más. Si sales de esta pantalla, el borrador se guardará igual en «Revisar actividades».
        </p>
      )}
    </div>
  );
}
