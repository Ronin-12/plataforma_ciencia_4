import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import InsigniaMedalla from "./InsigniaMedalla";
import { PALETAS } from "../utils/insignias";
import MascotaMurcielago from "./MascotaMurcielago";

// Vitrina de insignias del alumno: su nivel, cuántas lleva y cómo conseguir las que faltan.
export default function PanelInsignias({ logros, onCerrar }) {
  const reducirMovimiento = useReducedMotion();
  const botonCerrar = useRef(null);
  const { insignias, obtenidas, total, nivel } = logros;
  const porcentaje = total ? Math.round((obtenidas / total) * 100) : 0;

  useEffect(() => {
    botonCerrar.current?.focus();
    const alTeclear = (evento) => { if (evento.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(evento) => { if (evento.target === evento.currentTarget) onCerrar(); }}>
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-insignias"
        initial={reducirMovimiento ? false : { opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="relative max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-t-[2rem] border-2 border-[#66a4b9]/40 bg-gradient-to-br from-[#0f1d36] via-[#1c3157] to-[#173f55] p-5 text-white shadow-2xl sm:rounded-[2rem] sm:p-8"
      >
        <button ref={botonCerrar} type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/10 transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/60">
          <X size={22} aria-hidden="true" />
        </button>

        <header className="flex flex-wrap items-center gap-4 pr-14">
          <MascotaMurcielago className="h-20 w-20 shrink-0 drop-shadow" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#a0c3d9]">Tu colección nocturna</p>
            <h2 id="titulo-insignias" className="text-3xl font-black sm:text-4xl">Mis insignias</h2>
            <p className="mt-1 inline-flex items-center rounded-full border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-sm font-black text-amber-200">{nivel.nombre}</p>
          </div>
        </header>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-lg font-black">{obtenidas} de {total} insignias</p>
            <p className="text-sm font-semibold text-[#e3eff6]">
              {nivel.faltan_para_subir == null
                ? "¡Llegaste al nivel más alto!"
                : `${nivel.faltan_para_subir === 1 ? "Te falta 1 insignia" : `Te faltan ${nivel.faltan_para_subir} insignias`} para subir de nivel`}
            </p>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={obtenidas} aria-label="Insignias conseguidas" className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-gradient-to-r from-teal-300 via-sky-300 to-amber-300 transition-all duration-700" style={{ width: `${porcentaje}%` }} />
          </div>
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {insignias.map((insignia, indice) => {
            const color = PALETAS[insignia.color]?.ala ?? "#5eead4";
            return (
              <motion.li
                key={insignia.id}
                initial={reducirMovimiento ? false : { opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reducirMovimiento ? 0 : 0.05 * indice, duration: 0.3 }}
                className={`flex flex-col items-center rounded-2xl border p-3 text-center sm:p-4 ${insignia.obtenida ? "bg-white/[0.09]" : "border-white/10 bg-white/[0.03]"}`}
                style={insignia.obtenida ? { borderColor: `${color}99`, boxShadow: `0 0 28px -10px ${color}` } : undefined}
              >
                <InsigniaMedalla insignia={insignia} tamano={104} />
                <h3 className={`mt-1 text-base font-black leading-tight ${insignia.obtenida ? "text-white" : "text-slate-300"}`}>{insignia.nombre}</h3>
                <p className="mt-1 text-sm leading-snug text-[#cfe0ee]">{insignia.descripcion}</p>
                {insignia.obtenida ? (
                  <p className="mt-2 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-black text-emerald-200">¡Conseguida!</p>
                ) : (
                  <div className="mt-2 w-full">
                    <div className="h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[#66a4b9]" style={{ width: `${Math.round((insignia.actual / insignia.meta) * 100)}%` }} /></div>
                    <p className="mt-1 text-xs font-bold text-slate-300">{insignia.actual} de {insignia.meta}</p>
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      </motion.section>
    </div>
  );
}
