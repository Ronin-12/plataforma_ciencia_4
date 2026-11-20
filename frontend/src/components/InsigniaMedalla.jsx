import { useId } from "react";
import { BookOpen, Lock, Moon, Radar, Repeat, Rocket, Star, TrendingUp, Trophy, Users } from "lucide-react";
import { PALETAS } from "../utils/insignias";

const ICONOS = { vuelo: Rocket, luna: Moon, radar: Radar, estrella: Star, mejora: TrendingUp, repetir: Repeat, libro: BookOpen, colonia: Trophy, equipo: Users };

// Ala de murciélago (lado derecho); la izquierda es su reflejo.
const ALA = "M84 48 C96 34 110 30 118 33 C114 40 115 47 111 53 C108 51 104 53 102 58 C99 56 95 59 94 64 C91 62 88 64 86 68 Z";
const HEXAGONO = "60,28 89,45 89,79 60,96 31,79 31,45";
const HEXAGONO_INTERIOR = "60,35 83,48.5 83,75.5 60,89 37,75.5 37,48.5";

// Medalla con cara de murciélago: orejas, alas a los lados y un hexágono con el dibujo de la insignia.
// Si todavía no se gana se ve en gris con un candado (y no se pierde la forma, para que dé ganas de conseguirla).
export default function InsigniaMedalla({ insignia, tamano = 112, className = "" }) {
  const id = useId().replace(/:/g, "");
  const paleta = PALETAS[insignia.color] ?? PALETAS.teal;
  const Icono = ICONOS[insignia.icono] ?? Star;
  const ganada = Boolean(insignia.obtenida);
  const claro = ganada ? paleta.claro : "#cbd5e1";
  const oscuro = ganada ? paleta.oscuro : "#64748b";
  const borde = ganada ? paleta.borde : "#475569";
  const ala = ganada ? paleta.ala : "#94a3b8";
  const etiqueta = ganada ? `${insignia.nombre}: conseguida` : `${insignia.nombre}: ${insignia.actual} de ${insignia.meta}`;

  return (
    <svg viewBox="0 0 120 120" width={tamano} height={tamano} role="img" aria-label={etiqueta} className={className}>
      <defs>
        <linearGradient id={`cara-${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor={claro} />
          <stop offset="1" stopColor={oscuro} />
        </linearGradient>
      </defs>
      <g fill={ala} stroke={borde} strokeWidth="2" strokeLinejoin="round" opacity={ganada ? 1 : 0.7}>
        <path d={ALA} />
        <path d={ALA} transform="translate(120 0) scale(-1 1)" />
      </g>
      <g fill={oscuro} stroke={borde} strokeWidth="3" strokeLinejoin="round">
        <path d="M41 38 L46 14 L59 30 Z" />
        <path d="M79 38 L74 14 L61 30 Z" />
      </g>
      <polygon points={HEXAGONO} fill={`url(#cara-${id})`} stroke={borde} strokeWidth="5" strokeLinejoin="round" />
      <polygon points={HEXAGONO_INTERIOR} fill="none" stroke="#fff" strokeOpacity={ganada ? 0.45 : 0.3} strokeWidth="1.8" strokeLinejoin="round" />
      <Icono x={44} y={46} width={32} height={32} color={ganada ? "#fff" : "#f1f5f9"} strokeWidth={2.3} opacity={ganada ? 1 : 0.55} aria-hidden="true" />
      {ganada ? (
        <g fill="#fff" opacity="0.9">
          <path d="M94 22 L96 27 L101 29 L96 31 L94 36 L92 31 L87 29 L92 27 Z" />
          <path d="M22 84 L23.5 87.5 L27 89 L23.5 90.5 L22 94 L20.5 90.5 L17 89 L20.5 87.5 Z" opacity="0.75" />
        </g>
      ) : (
        <g>
          <circle cx="88" cy="90" r="12" fill="#334155" stroke="#fff" strokeWidth="2.5" />
          <Lock x={81.5} y={83.5} width={13} height={13} color="#fff" strokeWidth={2.6} aria-hidden="true" />
        </g>
      )}
    </svg>
  );
}
