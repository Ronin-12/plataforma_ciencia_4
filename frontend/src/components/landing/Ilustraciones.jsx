/* Ilustraciones de ciencia para la portada.
   Están dibujadas en SVG (código, no fotos): pesan casi nada, se ven nítidas
   en cualquier pantalla y se pueden animar parte por parte con CSS.
   Usan el mismo estilo que la mascota: contorno grueso morado oscuro y colores planos.
   Las animaciones viven en landing.css (clases que empiezan con "il-"). */

const INK = '#22184a';
const MORADO = '#6b46c1';
const LILA = '#c9b8f5';
const GEMA = '#2bc4a8';
const SOL = '#ffc93c';
const CORAL = '#ff7f6e';
const HOJA = '#5cc46f';
const BLANCO = '#ffffff';

const trazo = { stroke: INK, strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' };

function Svg({ className = '', children, viewBox = '0 0 120 120' }) {
  return (
    <svg viewBox={viewBox} className={className} aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      {children}
    </svg>
  );
}

/** Planeta con anillo y una luna que gira a su alrededor. */
export function Planeta({ className }) {
  return (
    <Svg className={className}>
      <g className="il-orbita-luna" style={{ transformOrigin: '60px 60px' }}>
        <circle cx="108" cy="60" r="7" fill={LILA} {...trazo} strokeWidth={3} />
      </g>
      {/* Mitad trasera del anillo, luego el planeta, luego la mitad delantera: así el anillo "abraza" al planeta. */}
      <path d="M10 62a50 13 0 0 1 100 0" fill="none" {...trazo} transform="rotate(-14 60 62)" />
      <circle cx="60" cy="60" r="30" fill={SOL} {...trazo} />
      <path d="M38 50c8 4 18 2 26-4M44 72c10-2 18 2 26-2" fill="none" stroke="#e8a91c" strokeWidth="4" strokeLinecap="round" />
      <path d="M10 62a50 13 0 0 0 100 0" fill="none" {...trazo} transform="rotate(-14 60 62)" />
    </Svg>
  );
}

/** Matraz de laboratorio con burbujas que suben. */
export function Matraz({ className }) {
  return (
    <Svg className={className}>
      <g className="il-burbujas">
        <circle className="il-burbuja" cx="54" cy="40" r="5" fill={BLANCO} {...trazo} strokeWidth={3} />
        <circle className="il-burbuja il-burbuja-2" cx="68" cy="34" r="4" fill={BLANCO} {...trazo} strokeWidth={3} />
        <circle className="il-burbuja il-burbuja-3" cx="60" cy="24" r="3" fill={BLANCO} {...trazo} strokeWidth={3} />
      </g>
      <path d="M48 46V22h24v24l24 42a8 8 0 0 1-7 12H31a8 8 0 0 1-7-12z" fill={BLANCO} {...trazo} />
      <path d="M36 74h48l10 18a3 3 0 0 1-3 4H29a3 3 0 0 1-3-4z" fill={GEMA} />
      <path d="M48 46V22h24v24l24 42a8 8 0 0 1-7 12H31a8 8 0 0 1-7-12z" fill="none" {...trazo} />
      <path d="M44 22h32" {...trazo} />
      <circle cx="50" cy="86" r="4" fill={BLANCO} opacity=".8" />
      <circle cx="64" cy="82" r="2.5" fill={BLANCO} opacity=".8" />
    </Svg>
  );
}

/** Plantita en maceta: las hojas se mecen. */
export function Planta({ className }) {
  return (
    <Svg className={className}>
      <g className="il-mecer" style={{ transformOrigin: '60px 74px' }}>
        <path d="M60 74V36" fill="none" {...trazo} />
        <path d="M60 52c-4-14-18-20-30-16 2 14 16 20 30 16z" fill={HOJA} {...trazo} />
        <path d="M60 42c4-14 18-20 30-16-2 14-16 20-30 16z" fill={HOJA} {...trazo} />
        <path d="M44 42l10 6M76 32l-10 6" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      </g>
      <path d="M36 74h48l-6 32H42z" fill={CORAL} {...trazo} />
      <path d="M32 72h56v10H32z" fill={CORAL} {...trazo} />
    </Svg>
  );
}

/** Átomo: tres órbitas con electrones que giran. */
export function Atomo({ className }) {
  return (
    <Svg className={className}>
      {[0, 60, 120].map((angulo, i) => (
        <g key={angulo} transform={`rotate(${angulo} 60 60)`}>
          <ellipse cx="60" cy="60" rx="48" ry="17" fill="none" {...trazo} strokeWidth={3.5} />
          {/* offset-path hace que el electrón recorra la elipse exacta, no un círculo. */}
          <circle className={`il-electron il-electron-${i}`} cx="0" cy="0" r="6" fill={i === 1 ? SOL : GEMA} {...trazo} strokeWidth={3} />

        </g>
      ))}
      <circle cx="60" cy="60" r="11" fill={CORAL} {...trazo} />
    </Svg>
  );
}

/** Lupa con un destello que cruza el cristal. */
export function Lupa({ className }) {
  return (
    <Svg className={className}>
      <defs>
        <clipPath id="il-lupa-cristal">
          <circle cx="50" cy="50" r="27" />
        </clipPath>
      </defs>
      <path d="M71 71l30 30" stroke={INK} strokeWidth="16" strokeLinecap="round" />
      <path d="M71 71l30 30" stroke={MORADO} strokeWidth="8" strokeLinecap="round" />
      <circle cx="50" cy="50" r="31" fill="#dff7f2" {...trazo} />
      <g clipPath="url(#il-lupa-cristal)">
        <rect className="il-destello" x="10" y="0" width="12" height="100" fill={BLANCO} opacity=".85" transform="rotate(30 50 50)" />
      </g>
      <circle cx="50" cy="50" r="31" fill="none" {...trazo} />
    </Svg>
  );
}

/** Mariposa que aletea. */
export function Mariposa({ className }) {
  return (
    <Svg className={className}>
      <g className="il-ala-izq" style={{ transformOrigin: '60px 60px' }}>
        <path d="M58 56C46 30 18 28 20 48c1 10 14 14 36 12z" fill={MORADO} {...trazo} />
        <path d="M58 64C40 66 26 76 34 90c8 10 22-4 24-22z" fill={LILA} {...trazo} />
        <circle cx="36" cy="46" r="5" fill={SOL} />
      </g>
      <g className="il-ala-der" style={{ transformOrigin: '60px 60px' }}>
        <path d="M62 56c12-26 40-28 38-8-1 10-14 14-36 12z" fill={MORADO} {...trazo} />
        <path d="M62 64c18 2 32 12 24 26-8 10-22-4-24-22z" fill={LILA} {...trazo} />
        <circle cx="84" cy="46" r="5" fill={SOL} />
      </g>
      <rect x="55" y="40" width="10" height="44" rx="5" fill={INK} />
      <path d="M58 41c-4-10-10-14-14-14M62 41c4-10 10-14 14-14" fill="none" {...trazo} strokeWidth={3} />
    </Svg>
  );
}

/** Gota de agua con brillo. */
export function Gota({ className }) {
  return (
    <Svg className={className}>
      <path d="M60 14C48 34 30 52 30 74a30 30 0 0 0 60 0c0-22-18-40-30-60z" fill="#7cc8ff" {...trazo} />
      <path d="M46 72c0 10 6 16 14 18" fill="none" stroke={BLANCO} strokeWidth="6" strokeLinecap="round" />
    </Svg>
  );
}

/** Corazón (cuerpo humano) con latido. */
export function Corazon({ className }) {
  return (
    <Svg className={className}>
      <g className="il-latido" style={{ transformOrigin: '60px 64px' }}>
        <path d="M60 100S18 76 18 46c0-14 10-24 22-24 9 0 16 5 20 13 4-8 11-13 20-13 12 0 22 10 22 24 0 30-42 54-42 54z" fill={CORAL} {...trazo} />
        <path d="M30 60h16l6-12 8 24 6-12h24" fill="none" stroke={BLANCO} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Svg>
  );
}

/** Imán (fuerzas y materia). */
export function Iman({ className }) {
  return (
    <Svg className={className}>
      <path d="M30 22v42a30 30 0 0 0 60 0V22H70v42a10 10 0 0 1-20 0V22z" fill={CORAL} {...trazo} />
      <path d="M30 22h20v16H30zM70 22h20v16H70z" fill={BLANCO} {...trazo} />
      <path className="il-chispa" d="M18 50l-8-4M16 64H6M102 50l8-4M104 64h10" stroke={SOL} strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

/** Estrella de cuatro puntas (brillito decorativo). */
export function Brillo({ className, color = SOL }) {
  return (
    <Svg className={className} viewBox="0 0 40 40">
      <path d="M20 2c2 11 7 16 18 18-11 2-16 7-18 18-2-11-7-16-18-18C13 18 18 13 20 2z" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </Svg>
  );
}

/** Garabato decorativo (como trazo de plumón). */
export function Garabato({ className, color = GEMA }) {
  return (
    <Svg className={className} viewBox="0 0 160 40">
      <path d="M4 24c14-18 26-18 34 0s22 18 34 0 22-18 34 0 22 18 34 0 14-12 16-10" fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
    </Svg>
  );
}
