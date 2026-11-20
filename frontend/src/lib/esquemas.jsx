// Esquemas dibujados para el juego «Etiqueta el esquema». Todo es SVG (sin imágenes externas), así que
// se ve nítido en cualquier pantalla y no hay derechos de autor de por medio.
// Cada esquema tiene puntos numerados FIJOS: el docente (o la IA) escribe qué parte es cada número.
// Debe coincidir con ESQUEMAS_ETIQUETAR de backend/app/routers/ia.py.

export const ESQUEMAS = {
  planta: {
    nombre: "Planta",
    puntos: { 1: [50, 11], 2: [72, 42], 3: [50, 58], 4: [50, 88], 5: [22, 30] },
    dibujo: (
      <>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#e0f2fe" />
        <rect x="0" y="68" width="100" height="32" fill="#a16207" opacity=".85" />
        <path d="M50 68 C50 80 44 88 36 96 M50 68 C50 80 56 88 66 95 M50 68 L50 94" stroke="#78350f" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M50 68 L50 22" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="66" cy="44" rx="14" ry="6.5" transform="rotate(-28 66 44)" fill="#22c55e" />
        <ellipse cx="34" cy="52" rx="13" ry="6" transform="rotate(25 34 52)" fill="#4ade80" />
        {[0, 72, 144, 216, 288].map((g) => <ellipse key={g} cx="50" cy="9" rx="4.4" ry="7" transform={`rotate(${g} 50 16)`} fill="#f9a8d4" />)}
        <circle cx="50" cy="16" r="4.5" fill="#facc15" />
        <path d="M33 33 C28 33 26 38 28 42" stroke="#16a34a" strokeWidth="1.6" fill="none" />
        <circle cx="26" cy="46" r="6" fill="#ef4444" />
      </>
    ),
  },
  celula: {
    nombre: "Célula vegetal",
    puntos: { 1: [50, 46], 2: [86, 50], 3: [68, 74], 4: [30, 70], 5: [6, 50] },
    dibujo: (
      <>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#f0fdf4" />
        <rect x="9" y="14" width="86" height="72" rx="9" fill="#bbf7d0" stroke="#15803d" strokeWidth="3.4" />
        <rect x="14" y="19" width="76" height="62" rx="7" fill="#fef9c3" stroke="#ec4899" strokeWidth="1.6" />
        <circle cx="50" cy="46" r="13" fill="#c4b5fd" stroke="#6d28d9" strokeWidth="1.6" />
        <circle cx="50" cy="46" r="4" fill="#6d28d9" />
        <ellipse cx="30" cy="70" rx="8" ry="4.5" fill="#fdba74" stroke="#c2410c" strokeWidth="1.2" />
        <path d="M24 70 q3 -3 6 0 t6 0" stroke="#c2410c" strokeWidth="1" fill="none" />
        <circle cx="72" cy="30" r="2.2" fill="#fde047" opacity=".9" />
        <circle cx="66" cy="62" r="1.6" fill="#fde047" opacity=".9" />
      </>
    ),
  },
  tierra: {
    nombre: "Capas de la Tierra",
    puntos: { 1: [50, 8], 2: [84, 50], 3: [50, 70], 4: [50, 50] },
    dibujo: (
      <>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#0f172a" />
        <circle cx="50" cy="50" r="44" fill="#16a34a" />
        <circle cx="50" cy="50" r="40.5" fill="#b45309" />
        <circle cx="50" cy="50" r="30" fill="#ea580c" />
        <circle cx="50" cy="50" r="19" fill="#facc15" />
        <circle cx="50" cy="50" r="9" fill="#fef9c3" />
      </>
    ),
  },
  volcan: {
    nombre: "Volcán",
    puntos: { 1: [50, 19], 2: [50, 46], 3: [50, 78], 4: [24, 66] },
    dibujo: (
      <>
        <rect x="0" y="0" width="100" height="100" rx="6" fill="#e0f2fe" />
        <polygon points="6,92 38,30 62,30 94,92" fill="#92400e" />
        <polygon points="38,30 62,30 66,38 34,38" fill="#78350f" />
        <rect x="46" y="32" width="8" height="46" fill="#dc2626" />
        <ellipse cx="50" cy="82" rx="16" ry="8" fill="#f97316" />
        <path d="M40 24 q4 -12 10 -6 q4 -10 10 0" stroke="#f97316" strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="62" cy="12" r="5" fill="#94a3b8" opacity=".7" />
        <circle cx="70" cy="6" r="4" fill="#94a3b8" opacity=".5" />
        <rect x="0" y="92" width="100" height="8" fill="#15803d" />
      </>
    ),
  },
};

export const ESQUEMA_IDS = Object.keys(ESQUEMAS);
