import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import murcielagoSprite from "../assets/murcielago-sprite.webp";

const FRASES = [
  "¡Vamos a descubrir algo nuevo!",
  "¡Tú puedes, explorador!",
  "¿Listo para otra aventura?",
  "¡Cada pregunta nos enseña!",
];

/** Mascota compartida: aletea y responde cuando el alumno la toca o activa. */
export default function MascotaMurcielago({
  className = "h-16 w-16",
  label = "Murciélago guía",
}) {
  const reducirMovimiento = useReducedMotion();
  const [frase, setFrase] = useState("");
  const [frame, setFrame] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  function interactuar() {
    setFrame((actual) => (actual + 1) % FRASES.length);
    setFrase(FRASES[frame % FRASES.length]);
    window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setFrase(""), 2600);
  }

  return (
    <motion.button
      type="button"
      aria-label={`${label}. Tócame para escuchar un mensaje.`}
      title="¡Tócame!"
      onClick={interactuar}
      whileHover={reducirMovimiento ? undefined : { y: -4, rotate: -3, scale: 1.06 }}
      whileTap={reducirMovimiento ? undefined : { y: 2, scale: 0.94 }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-visible border-0 bg-transparent p-0 outline-none focus-visible:rounded-2xl focus-visible:ring-4 focus-visible:ring-amber-300 ${className}`}
    >
      <span
        aria-hidden="true"
        className={`bat-sprite block h-full w-full ${reducirMovimiento ? "bat-sprite-still" : ""}`}
        style={{ "--bat-sprite-url": `url("${murcielagoSprite}")` }}
      />
      <AnimatePresence>
        {frase && (
          <motion.span
            role="status"
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-[calc(100%-0.25rem)] left-1/2 z-50 w-max max-w-56 -translate-x-1/2 rounded-2xl border border-indigo-100 bg-white px-3 py-2 text-center text-xs font-extrabold leading-4 text-indigo-950 shadow-xl"
          >
            {frase}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
