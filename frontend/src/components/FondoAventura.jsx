import { motion, useReducedMotion } from 'framer-motion';

const ICONOS = [
  '🦋', '🍃', '✨', '🫧', '🚀', '🌼', '🐞', '⭐', '🌿', '🦋', '🫧', '🌱', '✨', '🪴',
  '🐝', '🍀', '🫧', '🌸', '🦋', '✦', '🚀', '🍃', '🌟', '🫧', '🐛', '🌻', '🦋', '🍀',
];

export default function FondoAventura() {
  const reducirMovimiento = useReducedMotion();

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden bg-gradient-to-br from-sky-300 via-cyan-100 to-emerald-200">
      {/* Cielo claro con luz de sol y nubes suaves, sin tonos fluorescentes. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_16%_12%,rgba(255,248,190,0.82),transparent_27%),radial-gradient(ellipse_at_83%_32%,rgba(255,255,255,0.72),transparent_24%),radial-gradient(ellipse_at_70%_90%,rgba(110,190,142,0.25),transparent_35%)]" />
      <div className="absolute -left-16 top-[16%] h-14 w-48 rounded-full bg-white/45 blur-xl sm:h-20 sm:w-64" />
      <div className="absolute right-[8%] top-[48%] h-12 w-40 rounded-full bg-white/40 blur-xl sm:h-16 sm:w-56" />
      <div className="absolute bottom-0 h-24 w-full bg-gradient-to-t from-emerald-300/35 to-transparent" />

      {ICONOS.map((icono, index) => {
        const left = (index * 37 + 4) % 100;
        const drift = index % 2 === 0 ? 180 + (index % 5) * 60 : -180 - (index % 5) * 60;
        const size = 60 + (index % 4) * 8;
        const duration = (13 + (index % 6) * 1.8) / 1.4;
        const delay = (index % 7) * 0.35;
        const startY = `${(index * 31) % 105}vh`;

        return (
          <motion.span
            key={`${icono}-${index}`}
            className="absolute select-none drop-shadow-[0_5px_8px_rgba(42,73,88,0.16)]"
            style={{ left: `${left}%`, top: 0, fontSize: `${size}px`, lineHeight: 1 }}
            initial={{ y: startY, x: 0, opacity: 0.32, rotate: 0, scale: 0.9 }}
            animate={reducirMovimiento ? {
              y: `${(index * 29) % 88}vh`, x: 0, opacity: 0.34, rotate: 0, scale: 1,
            } : {
              y: [startY, '-18vh'],
              x: [0, drift],
              opacity: [0.34, 0.76, 0],
              rotate: [0, index % 2 ? -360 : 360],
              scale: [0.9, 1.12, 0.82],
            }}
            transition={reducirMovimiento ? { duration: 0 } : {
              duration,
              delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {icono}
          </motion.span>
        );
      })}
    </div>
  );
}
