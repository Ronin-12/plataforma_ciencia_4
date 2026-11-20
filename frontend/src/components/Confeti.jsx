import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Lluvia de confeti para celebrar. No se muestra si el sistema pide «reducir movimiento».
export default function Confeti() {
  const reducirMovimiento = useReducedMotion();
  const [piezas] = useState(() => Array.from({ length: 26 }, (_, indice) => ({
    id: indice,
    izquierda: Math.random() * 100,
    retraso: Math.random() * 0.6,
    duracion: 2.2 + Math.random() * 1.6,
    giro: 240 + Math.random() * 480,
    color: ["#f59e0b", "#14b8a6", "#f472b6", "#38bdf8", "#a78bfa", "#facc15"][indice % 6],
    forma: indice % 3 === 0 ? "rounded-full" : "rounded-sm",
  })));
  if (reducirMovimiento) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {piezas.map((pieza) => (
        <motion.span key={pieza.id} className={`absolute top-0 block h-3 w-2 ${pieza.forma}`} style={{ left: `${pieza.izquierda}%`, backgroundColor: pieza.color }}
          initial={{ y: -30, opacity: 1, rotate: 0 }} animate={{ y: 520, opacity: [1, 1, 0], rotate: pieza.giro }} transition={{ duration: pieza.duracion, delay: pieza.retraso, ease: "easeIn" }} />
      ))}
    </div>
  );
}
