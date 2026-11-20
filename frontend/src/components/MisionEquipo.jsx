import { useEffect, useState } from "react";
import { api } from "../services/api";
import { emojiDeEquipo } from "../lib/equipos";
import BarraEquipo from "./BarraEquipo";
import Confeti from "./Confeti";

const REFRESCO_MS = 10000;

// Tarjeta del menú del alumno: su equipo, la misión abierta y la barra compartida.
// No hay ranking: los otros equipos se listan por nombre y nunca se muestra quién sacó cuánto.
export default function MisionEquipo({ token, juegos = [], onJugar }) {
  const [datos, setDatos] = useState(null);

  // Se pide al abrir el menú y luego cada pocos segundos (sin WebSockets), solo con la pestaña visible.
  useEffect(() => {
    if (!token) return undefined;
    let vigente = true;
    const cargar = () => {
      if (document.visibilityState === "hidden") return;
      api.obtenerMiMision(token).then((d) => vigente && setDatos(d)).catch(() => {});
    };
    cargar();
    const reloj = window.setInterval(cargar, REFRESCO_MS);
    document.addEventListener("visibilitychange", cargar);
    return () => { vigente = false; window.clearInterval(reloj); document.removeEventListener("visibilitychange", cargar); };
  }, [token]);

  const mision = datos?.mision;
  if (!datos?.equipo || !mision) return null;

  const propio = mision.mi_equipo;
  const juego = juegos.find((j) => String(j?.id_juego ?? j?.id ?? "") === mision.id_juego);
  const mensaje = mision.clase_completa
    ? "🎉 ¡Toda la clase llegó a la meta! Ustedes lo hicieron juntos."
    : propio.meta_lograda
      ? "🎉 ¡Tu equipo llegó a la meta! Ayuda a que los demás equipos también lo logren."
      : mision.yo_ya_jugue
        ? "¡Buen aporte! Si juegas otra vez y sacas más, la barra de tu equipo sube. Ayuden a sus compañeros a mejorar."
        : "Juega tu parte: tu mejor resultado suma a la barra de tu equipo. ¡Después ayuda a tus compañeros!";

  return (
    <section aria-labelledby="titulo-mision-equipo" className="relative mt-8 overflow-hidden rounded-[2rem] border-[3px] border-[#22184a] bg-white p-5 shadow-[6px_6px_0_#22184a] sm:p-7">
      {propio.meta_lograda && <Confeti />}
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6b46c1]">Misión en equipo</p>
        <h2 id="titulo-mision-equipo" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          <span aria-hidden="true">{emojiDeEquipo(datos.equipo.icono)}</span> {datos.equipo.nombre}
        </h2>
        <p className="mt-1 text-base font-semibold text-[#4a3f7a]">Actividad: <strong className="text-[#22184a]">{mision.titulo ?? "Actividad"}</strong></p>

        <div className="mt-4">
          <BarraEquipo
            nombre={`Tu equipo`} icono={datos.equipo.icono} progreso={propio.progreso} meta={mision.meta} lograda={propio.meta_lograda} destacada
            detalle={`${propio.ya_jugaron} de ${propio.integrantes} de tu equipo ya jugaron.`}
          />
        </div>
        <p role="status" className="mt-3 text-base font-bold text-[#22184a]">{mensaje}</p>

        {juego && onJugar && (
          <button type="button" onClick={() => onJugar(juego)} className="mt-4 min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-6 font-display text-lg font-semibold text-[#22184a] shadow-[3px_3px_0_#22184a] transition hover:bg-[#ffd666] active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
            {mision.yo_ya_jugue ? "Jugar otra vez para mejorar 🔁" : "¡Jugar la misión! 🚀"}
          </button>
        )}

        {mision.otros_equipos.length > 0 && (
          <div className="mt-6 border-t-2 border-[#e6e1f5] pt-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-[#4a3f7a]">Otros equipos de tu clase</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {mision.otros_equipos.map((e) => (
                <li key={e.id_equipo}>
                  <BarraEquipo nombre={e.nombre} icono={e.icono} progreso={e.progreso} meta={mision.meta} lograda={e.meta_lograda} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
