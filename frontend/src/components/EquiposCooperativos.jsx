import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { ICONOS_EQUIPO, emojiDeEquipo } from "../lib/equipos";
import BarraEquipo from "./BarraEquipo";

const tarjeta = "rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-5 shadow-[5px_5px_0_#22184a]";
const campo = "min-h-11 w-full rounded-xl border-2 border-slate-200 bg-white px-3 text-base text-slate-900 outline-none focus:border-[#6b46c1] focus:ring-4 focus:ring-[#6b46c1]/20";
const botonPrimario = "min-h-11 rounded-xl border-2 border-[#22184a] bg-[#6b46c1] px-4 text-sm font-black text-white hover:bg-[#5a37b0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 disabled:opacity-60";
const botonSecundario = "min-h-11 rounded-xl border-2 border-[#22184a] bg-white px-4 text-sm font-black text-[#22184a] hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 disabled:opacity-60";
const METAS = [50, 60, 70, 80, 90, 100];
const MAX_INTEGRANTES = 6;

function SelectorIcono({ valor, onCambio, etiqueta }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex flex-wrap gap-2">
      {ICONOS_EQUIPO.map((icono) => (
        <button key={icono.id} type="button" role="radio" aria-checked={valor === icono.id} aria-label={icono.nombre} onClick={() => onCambio(icono.id)}
          className={`grid h-11 w-11 place-items-center rounded-xl border-2 text-2xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 ${valor === icono.id ? "border-[#22184a] bg-[#ffc93c]" : "border-slate-200 bg-white hover:bg-[#ece6ff]"}`}>
          <span aria-hidden="true">{icono.emoji}</span>
        </button>
      ))}
    </div>
  );
}

// Elige el grupo y muestra su panel. El panel se vuelve a montar al cambiar de grupo (key), así
// ningún formulario a medias ni dato del grupo anterior se queda en pantalla.
export default function EquiposCooperativos({ token, grupos = [], idGrupoInicial = null, onElegirGrupo = () => {} }) {
  const [idElegido, setIdElegido] = useState(idGrupoInicial);
  if (!grupos.length) {
    return <div className={tarjeta}><p className="text-lg font-semibold">Primero abre un grupo y da de alta a sus alumnos en «Mis alumnos».</p></div>;
  }
  const grupo = grupos.find((g) => g.id_grupo === idElegido) ?? grupos[0];
  return (
    <div className="space-y-6">
      {grupos.length > 1 && (
        <label className="block max-w-xs">
          <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#4a3f7a]">Grupo</span>
          <select value={grupo.id_grupo} onChange={(e) => { setIdElegido(e.target.value); onElegirGrupo(e.target.value); }} className={campo}>
            {grupos.map((g) => <option key={g.id_grupo} value={g.id_grupo}>{g.nombre}</option>)}
          </select>
        </label>
      )}
      <PanelDeGrupo key={grupo.id_grupo} token={token} grupo={grupo} />
    </div>
  );
}

function PanelDeGrupo({ token, grupo }) {
  const idGrupo = grupo.id_grupo;
  const [datos, setDatos] = useState({ equipos: [], sin_equipo: [] });
  const [misiones, setMisiones] = useState({ mision: null, cerradas: [] });
  const [juegos, setJuegos] = useState([]); // actividades aprobadas y asignadas a este grupo
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const [tamano, setTamano] = useState(4);
  const [nuevo, setNuevo] = useState(null); // { nombre, icono } mientras se crea un equipo
  const [editando, setEditando] = useState(null); // { id, nombre, icono }
  const [eligiendo, setEligiendo] = useState(null); // { id, marcados: [] } integrantes de un equipo
  const [juegoElegido, setJuegoElegido] = useState("");
  const [meta, setMeta] = useState(70);

  const alumnosDelGrupo = useMemo(
    () => [
      ...datos.equipos.flatMap((e) => e.integrantes.map((p) => ({ ...p, equipo: e.nombre, id_equipo: e.id_equipo }))),
      ...datos.sin_equipo.map((p) => ({ ...p, equipo: null, id_equipo: null })),
    ].sort((a, b) => a.nombre_pila.localeCompare(b.nombre_pila, "es")),
    [datos],
  );

  const recargar = useCallback(async () => {
    if (!idGrupo) return;
    const [eq, mi] = await Promise.all([api.obtenerEquipos(idGrupo, token), api.obtenerMisiones(idGrupo, token)]);
    setDatos(eq);
    setMisiones(mi);
  }, [idGrupo, token]);

  // Carga inicial del grupo.
  useEffect(() => {
    let vigente = true;
    Promise.all([
      api.obtenerEquipos(idGrupo, token), api.obtenerMisiones(idGrupo, token), api.obtenerJuegos(token, "aprobado"),
    ]).then(([eq, mi, js]) => {
      if (!vigente) return;
      setDatos(eq); setMisiones(mi);
      const delGrupo = js.filter((j) => Array.isArray(j.grupos) && j.grupos.includes(idGrupo));
      setJuegos(delGrupo);
      setJuegoElegido(delGrupo[0]?.id_juego ?? "");
    }).catch((err) => vigente && setError(err.message)).finally(() => vigente && setCargando(false));
    return () => { vigente = false; };
  }, [idGrupo, token]);

  // Con una misión abierta, el avance se actualiza solo (los alumnos van terminando sus juegos).
  const hayMision = Boolean(misiones.mision);
  useEffect(() => {
    if (!hayMision) return undefined;
    const reloj = window.setInterval(() => { recargar().catch(() => {}); }, 15000);
    return () => window.clearInterval(reloj);
  }, [hayMision, recargar]);

  async function ejecutar(accion, mensaje = "") {
    setOcupado(true); setError(""); setAviso("");
    try {
      await accion();
      await recargar();
      if (mensaje) setAviso(mensaje);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function alAzar() {
    if (datos.equipos.length && !window.confirm("Esto reemplaza los equipos actuales por equipos nuevos al azar. ¿Continuar?")) return;
    await ejecutar(() => api.equiposAlAzar(idGrupo, tamano, token), "Equipos formados al azar. Puedes renombrarlos y cambiar integrantes.");
  }

  async function crear(e) {
    e.preventDefault();
    const ok = await ejecutar(() => api.crearEquipo({ idGrupo, nombre: nuevo.nombre, icono: nuevo.icono }, token), "Equipo creado.");
    if (ok) setNuevo(null);
  }

  async function guardarEdicion(e) {
    e.preventDefault();
    const ok = await ejecutar(() => api.actualizarEquipo(editando.id, { nombre: editando.nombre, icono: editando.icono }, token), "Equipo actualizado.");
    if (ok) setEditando(null);
  }

  async function borrar(equipo) {
    if (!window.confirm(`¿Borrar el equipo «${equipo.nombre}»? Sus integrantes quedarán sin equipo (no se borra a ningún alumno).`)) return;
    await ejecutar(() => api.eliminarEquipo(equipo.id_equipo, token), "Equipo borrado.");
  }

  async function guardarIntegrantes() {
    const ok = await ejecutar(() => api.ponerIntegrantes(eligiendo.id, eligiendo.marcados, token), "Integrantes guardados.");
    if (ok) setEligiendo(null);
  }

  function alternarIntegrante(idAlumno) {
    setEligiendo((actual) => {
      const esta = actual.marcados.includes(idAlumno);
      if (!esta && actual.marcados.length >= MAX_INTEGRANTES) return actual;
      return { ...actual, marcados: esta ? actual.marcados.filter((x) => x !== idAlumno) : [...actual.marcados, idAlumno] };
    });
  }

  async function lanzar(e) {
    e.preventDefault();
    await ejecutar(() => api.lanzarMision({ idGrupo, idJuego: juegoElegido, meta }, token), "¡Misión lanzada! Tus alumnos la verán en su menú.");
  }

  const mision = misiones.mision;
  const titulo = (j) => j.titulo ?? j.contenido_juego?.titulo ?? "Actividad";

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
      {aviso && <p role="status" className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{aviso}</p>}
      {cargando && <p role="status" className="font-semibold text-[#4a3f7a]">Cargando…</p>}

      {/* ---------------- Misión en equipo ---------------- */}
      <section aria-labelledby="titulo-mision" className={tarjeta}>
        <h3 id="titulo-mision" className="font-display text-2xl font-semibold">🏁 Misión en equipo</h3>
        {mision ? (
          <div className="mt-3 space-y-4">
            <p className="text-base font-semibold text-[#4a3f7a]">
              Actividad: <strong className="text-[#22184a]">{mision.titulo ?? "Actividad"}</strong> · Meta: <strong className="text-[#22184a]">{mision.meta} %</strong> de promedio por equipo.
            </p>
            {mision.clase_completa && <p role="status" className="rounded-xl bg-emerald-100 p-3 text-center text-lg font-black text-emerald-900">🎉 ¡Toda la clase llegó a la meta!</p>}
            <div className="space-y-3">
              {mision.equipos.filter((e) => e.integrantes > 0).map((e) => (
                <BarraEquipo key={e.id_equipo} nombre={e.nombre} icono={e.icono} progreso={e.progreso} meta={mision.meta} lograda={e.meta_lograda}
                  detalle={`${e.ya_jugaron} de ${e.integrantes} ya jugaron. Cuenta el mejor intento de cada uno.`} />
              ))}
            </div>
            <button type="button" disabled={ocupado} onClick={() => ejecutar(() => api.cerrarMision(mision.id_reto, token), "Misión cerrada.")} className={botonSecundario}>Cerrar la misión</button>
          </div>
        ) : (
          <form onSubmit={lanzar} className="mt-3 space-y-4">
            <p className="text-base text-[#4a3f7a]">Elige una actividad aprobada para este grupo y una meta. Cada alumno juega en su tableta y la barra de su equipo es el <strong>promedio de los mejores resultados</strong>: si alguien repite para mejorar, la barra sube.</p>
            {juegos.length ? (
              <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#4a3f7a]">Actividad</span>
                  <select value={juegoElegido} onChange={(e) => setJuegoElegido(e.target.value)} className={campo}>
                    {juegos.map((j) => <option key={j.id_juego} value={j.id_juego}>{titulo(j)}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#4a3f7a]">Meta del equipo</span>
                  <select value={meta} onChange={(e) => setMeta(Number(e.target.value))} className={campo}>
                    {METAS.map((m) => <option key={m} value={m}>{m} %</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <p className="rounded-xl bg-[#fff4cf] p-3 text-sm font-bold text-[#6b4b00]">Este grupo todavía no tiene actividades aprobadas. Apruébalas en «Revisar actividades» y asígnalas a este grupo.</p>
            )}
            <button type="submit" disabled={ocupado || !juegos.length || !datos.equipos.some((e) => e.integrantes.length)} className={botonPrimario}>Lanzar misión 🚀</button>
            {!datos.equipos.some((e) => e.integrantes.length) && <p className="text-sm font-semibold text-[#4a3f7a]">Arma al menos un equipo con integrantes para poder lanzarla.</p>}
          </form>
        )}
        {misiones.cerradas.length > 0 && (
          <div className="mt-5 border-t-2 border-[#e6e1f5] pt-4">
            <h4 className="text-sm font-black uppercase tracking-wide text-[#4a3f7a]">Misiones anteriores</h4>
            <ul className="mt-2 space-y-1 text-sm font-semibold text-[#22184a]">
              {misiones.cerradas.map((m) => (
                <li key={m.id_reto}>{m.titulo ?? "Actividad"} · meta {m.meta} % · {m.equipos.filter((e) => e.meta_lograda).length} de {m.equipos.filter((e) => e.integrantes > 0).length} equipos la lograron</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ---------------- Equipos ---------------- */}
      <section aria-labelledby="titulo-equipos" className={tarjeta}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id="titulo-equipos" className="font-display text-2xl font-semibold">👥 Equipos de {grupo?.nombre}</h3>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#4a3f7a]">Tamaño</span>
              <select value={tamano} onChange={(e) => setTamano(Number(e.target.value))} className={`${campo} w-28`}>
                {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} por equipo</option>)}
              </select>
            </label>
            <button type="button" disabled={ocupado} onClick={alAzar} className={botonSecundario}>🎲 Formar al azar</button>
            <button type="button" disabled={ocupado} onClick={() => setNuevo({ nombre: "", icono: "estrella" })} className={botonPrimario}>+ Nuevo equipo</button>
          </div>
        </div>

        {nuevo && (
          <form onSubmit={crear} className="mt-4 space-y-3 rounded-2xl border-2 border-dashed border-[#6b46c1] bg-[#f6f4ff] p-4">
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-[#4a3f7a]">Nombre del equipo</span>
              <input value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} maxLength={40} required className={campo} placeholder="Los Águilas" />
            </label>
            <SelectorIcono valor={nuevo.icono} onCambio={(icono) => setNuevo({ ...nuevo, icono })} etiqueta="Dibujo del equipo" />
            <div className="flex gap-2"><button type="submit" disabled={ocupado} className={botonPrimario}>Crear equipo</button><button type="button" onClick={() => setNuevo(null)} className={botonSecundario}>Cancelar</button></div>
          </form>
        )}

        {datos.equipos.length === 0 && !nuevo && <p className="mt-4 text-base text-[#4a3f7a]">Aún no hay equipos. Fórmalos al azar o crea el primero.</p>}

        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {datos.equipos.map((equipo) => (
            <li key={equipo.id_equipo} className="rounded-2xl border-[3px] border-[#22184a] bg-[#fbfaff] p-4">
              {editando?.id === equipo.id_equipo ? (
                <form onSubmit={guardarEdicion} className="space-y-3">
                  <input aria-label="Nombre del equipo" value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} maxLength={40} required className={campo} />
                  <SelectorIcono valor={editando.icono} onCambio={(icono) => setEditando({ ...editando, icono })} etiqueta="Dibujo del equipo" />
                  <div className="flex gap-2"><button type="submit" disabled={ocupado} className={botonPrimario}>Guardar</button><button type="button" onClick={() => setEditando(null)} className={botonSecundario}>Cancelar</button></div>
                </form>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex items-center gap-2 text-lg font-extrabold"><span aria-hidden="true" className="text-3xl">{emojiDeEquipo(equipo.icono)}</span>{equipo.nombre}</p>
                    <span className="rounded-full bg-[#ece6ff] px-3 py-1 text-xs font-black text-[#4a3f7a]">{equipo.integrantes.length} integrante{equipo.integrantes.length === 1 ? "" : "s"}</span>
                  </div>
                  <ul className="mt-3 flex min-h-8 flex-wrap gap-2">
                    {equipo.integrantes.length ? equipo.integrantes.map((p) => <li key={p.id_alumno} className="rounded-full border-2 border-[#22184a]/20 bg-white px-3 py-1 text-sm font-bold">{p.nombre_pila}</li>) : <li className="text-sm font-semibold text-slate-500">Sin integrantes todavía</li>}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={ocupado} onClick={() => setEligiendo({ id: equipo.id_equipo, marcados: equipo.integrantes.map((p) => p.id_alumno) })} className={botonSecundario}>Elegir integrantes</button>
                    <button type="button" disabled={ocupado} onClick={() => setEditando({ id: equipo.id_equipo, nombre: equipo.nombre, icono: equipo.icono })} className={botonSecundario}>Editar</button>
                    <button type="button" disabled={ocupado} onClick={() => borrar(equipo)} className={`${botonSecundario} text-rose-800`}>Borrar</button>
                  </div>
                </>
              )}
              {eligiendo?.id === equipo.id_equipo && (
                <fieldset className="mt-4 rounded-2xl border-2 border-dashed border-[#6b46c1] bg-white p-3">
                  <legend className="px-2 text-sm font-black text-[#4a3f7a]">Marca a los integrantes (máximo {MAX_INTEGRANTES})</legend>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {alumnosDelGrupo.map((p) => {
                      const marcado = eligiendo.marcados.includes(p.id_alumno);
                      return (
                        <li key={p.id_alumno}>
                          <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 hover:bg-[#f6f4ff]">
                            <input type="checkbox" checked={marcado} onChange={() => alternarIntegrante(p.id_alumno)} className="h-5 w-5 accent-[#6b46c1]" />
                            <span className="text-sm font-bold">{p.nombre_pila}</span>
                            {p.equipo && p.id_equipo !== equipo.id_equipo && <span className="text-xs font-semibold text-slate-500">(ahora en {p.equipo})</span>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-3 flex gap-2"><button type="button" disabled={ocupado} onClick={guardarIntegrantes} className={botonPrimario}>Guardar integrantes</button><button type="button" onClick={() => setEligiendo(null)} className={botonSecundario}>Cancelar</button></div>
                </fieldset>
              )}
            </li>
          ))}
        </ul>

        {datos.sin_equipo.length > 0 && datos.equipos.length > 0 && (
          <p className="mt-4 rounded-xl bg-[#fff4cf] p-3 text-sm font-bold text-[#6b4b00]">
            Sin equipo: {datos.sin_equipo.map((p) => p.nombre_pila).join(", ")}. No participarán en la misión hasta que los agregues a uno.
          </p>
        )}
      </section>
    </div>
  );
}
