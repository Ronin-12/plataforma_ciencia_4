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
  const buscar = (id) => juegos.find((j) => String(j?.id_juego ?? j?.id ?? "") === id);
  const varios = mision.juegos.length > 1;
  const roles = mision.modo === "roles";
  const pendientes = mision.juegos.filter((j) => !j.hecho).length;
  const mensaje = mision.clase_completa
    ? "🎉 ¡Toda la clase llegó a la meta! Ustedes lo hicieron juntos."
    : propio.meta_lograda
      ? "🎉 ¡Tu equipo llegó a la meta! Ayuda a que los demás equipos también lo logren."
      : mision.yo_ya_jugue
        ? "¡Buen aporte! Si juegas otra vez y sacas más, la barra de tu equipo sube. Ayuden a sus compañeros a mejorar."
        : roles
          ? "Esta es tu parte de la misión: tu mejor resultado suma a la barra de tu equipo. ¡Después ayuda a tus compañeros!"
          : varios
            ? `Te faltan ${pendientes} ${pendientes === 1 ? "actividad" : "actividades"}: cada una suma a la barra de tu equipo.`
            : "Juega tu parte: tu mejor resultado suma a la barra de tu equipo. ¡Después ayuda a tus compañeros!";
  const juego = buscar(mision.id_juego);

  return (
    <section aria-labelledby="titulo-mision-equipo" className="relative mt-8 overflow-hidden rounded-[2rem] border-[3px] border-[#22184a] bg-white p-5 shadow-[6px_6px_0_#22184a] sm:p-7">
      {propio.meta_lograda && <Confeti />}
      <div className="relative">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#6b46c1]">Misión en equipo</p>
        <h2 id="titulo-mision-equipo" className="mt-1 font-display text-2xl font-semibold sm:text-3xl">
          <span aria-hidden="true">{emojiDeEquipo(datos.equipo.icono)}</span> {datos.equipo.nombre}
        </h2>
        {!varios && !roles && <p className="mt-1 text-base font-semibold text-[#4a3f7a]">Actividad: <strong className="text-[#22184a]">{mision.titulo ?? "Actividad"}</strong></p>}

        <div className="mt-4">
          <BarraEquipo
            nombre={`Tu equipo`} icono={datos.equipo.icono} progreso={propio.progreso} meta={mision.meta} lograda={propio.meta_lograda} destacada
            detalle={roles ? `${propio.ya_jugaron} de ${propio.integrantes} de tu equipo ya cumplieron su parte.` : varios ? `${propio.ya_jugaron} de ${propio.integrantes} de tu equipo ya jugaron todas las actividades.` : `${propio.ya_jugaron} de ${propio.integrantes} de tu equipo ya jugaron.`}
          />
        </div>
        <p role="status" className="mt-3 text-base font-bold text-[#22184a]">{mensaje}</p>

        {mision.insignia_ganada && (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-[#22184a] bg-[#fff4cf] px-4 py-3 text-base font-black text-[#22184a]">
            <span aria-hidden="true" className="text-2xl">🏅</span> ¡Ganaste la insignia «Equipo estrella»! La verás en tu vitrina.
          </p>
        )}

        {(varios || roles) && (
          <div className="mt-4">
            <h3 className="text-sm font-black uppercase tracking-wide text-[#4a3f7a]">{roles ? "Tu parte" : "Actividades de la misión"}</h3>
            <ol className="mt-2 space-y-2">
              {mision.juegos.map((j, i) => {
                const objeto = buscar(j.id_juego);
                return (
                  <li key={j.id_juego} className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 px-4 py-3 ${j.hecho ? "border-emerald-300 bg-emerald-50" : "border-[#22184a] bg-white"}`}>
                    <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-sm font-black ${j.hecho ? "border-emerald-600 bg-emerald-500 text-white" : "border-[#22184a] bg-[#ffc93c] text-[#22184a]"}`}>{j.hecho ? "✓" : i + 1}</span>
                    <span className="min-w-0 flex-1 text-base font-extrabold text-[#22184a]">{j.titulo ?? "Actividad"}<span className="sr-only">{j.hecho ? " (ya la jugaste)" : " (pendiente)"}</span></span>
                    {objeto && onJugar && (
                      <button type="button" onClick={() => onJugar(objeto)} className="min-h-11 rounded-full border-2 border-[#22184a] bg-white px-4 text-sm font-black text-[#22184a] hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
                        {j.hecho ? "Jugar otra vez 🔁" : "¡Jugar! 🚀"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {!varios && !roles && juego && onJugar && (
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
