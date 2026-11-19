import { motion } from 'framer-motion';
import InsigniaMateria from '../InsigniaMateria';
import { MATERIAS } from '../../lib/materias';
import { Check, FileText, Image as ImageIcon, Pencil, Sparkles } from 'lucide-react';

/* Mini pantallas de ejemplo para la sección «Cómo funciona».
   Son dibujos hechos con HTML (no capturas): muestran la idea de cada paso
   sin depender de datos reales y se ven bien en cualquier tamaño. */

function Marco({ children, className = '' }) {
  return (
    <div className={`relative rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-5 shadow-[8px_8px_0_#22184a] sm:p-6 ${className}`}>
      {children}
    </div>
  );
}

export function PantallaMaterial() {
  return (
    <Marco>
      <p className="font-display text-lg font-semibold text-[#22184a]">Tu material de clase</p>
      <ul className="mt-3 space-y-2">
        <li className="flex items-center gap-3 rounded-xl bg-[#f1ecff] px-3 py-2 text-sm font-bold text-[#22184a]">
          <FileText size={18} className="text-[#6b46c1]" aria-hidden="true" /> plantas-y-fotosintesis.pdf
        </li>
        <li className="flex items-center gap-3 rounded-xl bg-[#f1ecff] px-3 py-2 text-sm font-bold text-[#22184a]">
          <ImageIcon size={18} className="text-[#6b46c1]" aria-hidden="true" /> foto-del-pizarron.jpg
        </li>
      </ul>
      <p className="mt-5 flex items-center gap-2 text-sm font-bold text-[#4a3f7a]">
        <Sparkles size={16} className="text-[#e0a400]" aria-hidden="true" /> La IA te propone estos temas:
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {['Partes de la planta', 'Fotosíntesis', 'Cadenas alimenticias'].map((t) => (
          <span key={t} className="rounded-full border-2 border-[#22184a] bg-[#d9f6ef] px-3 py-1 text-sm font-bold text-[#22184a]">{t}</span>
        ))}
      </div>
    </Marco>
  );
}

export function PantallaAprobar() {
  return (
    <Marco>
      <div className="flex items-center justify-between gap-3">
        <InsigniaMateria materia={MATERIAS[0]} corta />
        <span className="rounded-full bg-[#fff1c7] px-3 py-1 text-xs font-extrabold text-[#7a5600]">Borrador</span>
      </div>
      <p className="mt-3 font-display text-lg font-semibold text-[#22184a]">¿Qué necesita una planta?</p>
      <ul className="mt-4 grid gap-2 text-sm font-bold">
        <li className="rounded-xl border-2 border-[#e6e1f5] px-3 py-2 text-[#22184a]">Solo tierra</li>
        <li className="flex items-center justify-between rounded-xl border-2 border-[#2bc4a8] bg-[#e3faf4] px-3 py-2 text-[#22184a]">
          Agua, luz y aire <Check size={18} className="text-[#139a82]" aria-label="Respuesta correcta" />
        </li>
        <li className="rounded-xl border-2 border-[#e6e1f5] px-3 py-2 text-[#22184a]">Solo oscuridad</li>
      </ul>
      <div className="mt-5 flex gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#5cc46f] px-4 py-2 text-sm font-extrabold text-[#0f3b18]">
          <Check size={16} aria-hidden="true" /> Aprobar
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#22184a] px-4 py-2 text-sm font-extrabold text-[#22184a]">
          <Pencil size={14} aria-hidden="true" /> Editar
        </span>
      </div>
    </Marco>
  );
}

export function PantallaAlumno() {
  return (
    <Marco className="mx-auto max-w-sm">
      <p className="text-center font-display text-lg font-semibold text-[#22184a]">Código de tu aula</p>
      <div className="mt-3 flex justify-center gap-1.5">
        {['4', '8', '2', '9', '1', '3'].map((c, i) => (
          <span key={i} className="grid h-11 w-9 place-items-center rounded-lg border-2 border-[#22184a] bg-[#f1ecff] font-display text-xl font-bold text-[#22184a]">{c}</span>
        ))}
      </div>
      <p className="mt-5 text-center text-sm font-bold text-[#4a3f7a]">¿Quién eres?</p>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {[['🦊', 'Ana'], ['🐢', 'Leo'], ['🦉', 'Sofi']].map(([a, n], i) => (
          <span key={n} className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold ${i === 1 ? 'border-[#6b46c1] bg-[#6b46c1] text-white' : 'border-[#e6e1f5] text-[#22184a]'}`}>
            <span aria-hidden="true">{a}</span>{n}
          </span>
        ))}
      </div>
      <p className="mt-5 text-center text-sm font-bold text-[#4a3f7a]">Tu PIN</p>
      <div className="mt-2 flex justify-center gap-3" aria-label="PIN de cuatro números">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-4 w-4 rounded-full border-2 border-[#22184a] ${i < 3 ? 'bg-[#22184a]' : ''}`} />
        ))}
      </div>
    </Marco>
  );
}

export function PantallaAvance() {
  const filas = [
    { nombre: 'Partes de la planta', valor: 86, color: '#5cc46f' },
    { nombre: 'Fotosíntesis', valor: 72, color: '#2bc4a8' },
    { nombre: 'Cadenas alimenticias', valor: 54, color: '#ffc93c' },
  ];
  return (
    <Marco>
      <p className="font-display text-lg font-semibold text-[#22184a]">Avance del grupo</p>
      <ul className="mt-4 space-y-4">
        {filas.map((f, i) => (
          <li key={f.nombre}>
            <div className="flex justify-between text-sm font-bold text-[#22184a]">
              <span>{f.nombre}</span><span>{f.valor}%</span>
            </div>
            <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-[#efeaf9]">
              <motion.div
                className="h-full origin-left rounded-full"
                style={{ width: `${f.valor}%`, backgroundColor: f.color }}
                initial={{ scaleX: 0.1 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ duration: 0.9, delay: i * 0.15, ease: [0.2, 0.8, 0.2, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-5 rounded-xl bg-[#fff1c7] px-3 py-2 text-sm font-bold text-[#5c4100]">
        Cadenas alimenticias: 3 alumnos necesitan apoyo.
      </p>
    </Marco>
  );
}
