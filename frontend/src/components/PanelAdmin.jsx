import { useCallback, useEffect, useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";
import { api } from "../services/api";

const formatoFecha = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" });

function Cifra({ etiqueta, valor, detalle }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{etiqueta}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{valor}</p>
      {detalle && <p className="mt-1 text-xs font-semibold text-slate-600">{detalle}</p>}
    </div>
  );
}

function BarraCreditos({ usados, limite }) {
  const porcentaje = limite > 0 ? Math.min(100, Math.round((usados / limite) * 100)) : 0;
  // Ámbar cuando ya casi se acaban, para que el administrador lo note de un vistazo.
  const agotando = porcentaje >= 80;
  return (
    <div className="min-w-[110px]">
      <p className="text-sm font-bold text-slate-800">{usados} de {limite}</p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className={`h-full rounded-full ${agotando ? "bg-amber-500" : "bg-teal-600"}`} style={{ width: `${porcentaje}%` }} />
      </div>
    </div>
  );
}

const formatoMxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const formatoMiles = new Intl.NumberFormat("es-MX");
const NOMBRE_TAREA = { juego: "Juegos", clase: "Clases", temas: "Análisis de material" };
const ESTADOS_SOLICITUD = [["nueva", "Nueva"], ["en_proceso", "En proceso"], ["cerrada", "Cerrada"]];
const ETIQUETA_INTERES = { maestro: "Maestro (pública)", docente: "Docente", escuela: "Escuela", licencia: "Licencia patrocinada", otro: "Otro" };

// Costo real de la IA en el mes: sirve para comprobar si los planes acordados dejan margen.
function CostoIA({ uso }) {
  return (
    <div className="space-y-3 rounded-3xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-xl font-black">Costo de la IA este mes (estimado)</h3>
        <p className="text-xs font-medium text-slate-600">
          Con {uso.precios.entrada_usd_mtok} / {uso.precios.salida_usd_mtok} USD por millón de tokens (entrada / salida) y {uso.precios.tipo_cambio_mxn} MXN por dólar. Ajusta los precios en .env.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cifra etiqueta="Costo del mes" valor={formatoMxn.format(uso.costo_mxn)} detalle={`${uso.costo_usd} USD`} />
        <Cifra etiqueta="Por crédito usado" valor={uso.costo_por_generacion_mxn != null ? formatoMxn.format(uso.costo_por_generacion_mxn) : "—"} detalle={`${uso.generaciones_cobradas} créditos usados`} />
        <Cifra etiqueta="Tokens de entrada" valor={formatoMiles.format(uso.tokens_entrada)} />
        <Cifra etiqueta="Tokens de salida" valor={formatoMiles.format(uso.tokens_salida)} detalle="incluye el «pensamiento» del modelo" />
      </div>
      {uso.por_tarea.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {uso.por_tarea.map((t) => (
            <li key={t.tarea} className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 font-semibold">
              {NOMBRE_TAREA[t.tarea] ?? t.tarea}: {t.llamadas} llamadas · {t.costo_usd} USD
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PanelAdmin({ nombreAdmin = "Administrador", tokenAdmin = "", onCerrarSesion = () => {} }) {
  const [resumen, setResumen] = useState(null);
  const [docentes, setDocentes] = useState(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [confirmando, setConfirmando] = useState(null); // id del docente a desactivar
  const [ocupado, setOcupado] = useState(null);
  const [aviso, setAviso] = useState("");
  const [planes, setPlanes] = useState([]);
  const [usoIA, setUsoIA] = useState(null);
  const [solicitudes, setSolicitudes] = useState(null);

  const cargar = useCallback(async () => {
    const [r, d] = await Promise.all([api.resumenAdmin(tokenAdmin), api.docentesAdmin(tokenAdmin)]);
    setResumen(r);
    setDocentes(d.docentes);
    setError("");
  }, [tokenAdmin]);

  useEffect(() => {
    let vigente = true;
    Promise.all([api.resumenAdmin(tokenAdmin), api.docentesAdmin(tokenAdmin)])
      .then(([r, d]) => { if (vigente) { setResumen(r); setDocentes(d.docentes); setError(""); } })
      .catch((err) => { if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el panel."); });
    return () => { vigente = false; };
  }, [tokenAdmin]);

  // Planes, costo de IA y solicitudes se cargan aparte: si alguno falla, el resto del panel sigue.
  useEffect(() => {
    let vigente = true;
    api.planesAdmin(tokenAdmin).then((r) => { if (vigente) setPlanes(r.planes); }).catch(() => {});
    api.usoIAAdmin(tokenAdmin).then((r) => { if (vigente) setUsoIA(r); }).catch(() => {});
    api.solicitudesAdmin(tokenAdmin).then((r) => { if (vigente) setSolicitudes(r.solicitudes); }).catch(() => {});
    return () => { vigente = false; };
  }, [tokenAdmin]);

  async function cambiarPlan(docente, plan) {
    setOcupado(docente.id_docente);
    setAviso("");
    try {
      await api.cambiarPlanAdmin(docente.id_docente, plan, tokenAdmin);
      await cargar();
      const nombre = planes.find((p) => p.id === plan)?.nombre ?? plan;
      setAviso(`${docente.nombre} ahora tiene el plan ${nombre}.`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo cambiar el plan.");
    } finally {
      setOcupado(null);
    }
  }

  async function cambiarSolicitud(solicitud, estado) {
    try {
      await api.cambiarEstadoSolicitudAdmin(solicitud.id_solicitud, estado, tokenAdmin);
      setSolicitudes((lista) => lista.map((s) => (s.id_solicitud === solicitud.id_solicitud ? { ...s, estado } : s)));
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo actualizar la solicitud.");
    }
  }

  async function cambiarEstado(docente, activo) {
    setOcupado(docente.id_docente);
    setAviso("");
    try {
      await api.cambiarEstadoDocente(docente.id_docente, activo, tokenAdmin);
      setConfirmando(null);
      await cargar();
      setAviso(activo ? `Se reactivó la cuenta de ${docente.nombre}.` : `Se desactivó la cuenta de ${docente.nombre}. Ya no puede iniciar sesión.`);
    } catch (err) {
      setAviso(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setOcupado(null);
    }
  }

  const termino = busqueda.trim().toLowerCase();
  const visibles = (docentes ?? []).filter((d) =>
    !termino || [d.nombre, d.email, d.escuela].some((campo) => (campo ?? "").toLowerCase().includes(termino)),
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071321] text-slate-100">
      <div aria-hidden="true" className="space-starfield pointer-events-none absolute inset-0 opacity-35" />
      <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-[#0b1928]/95 px-5 py-4 shadow-lg sm:px-8">
        <div className="flex items-center gap-3">
          <MascotaMurcielago className="h-14 w-14" />
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">Equipo Murciélago · Administración</p>
            <h1 className="mt-1 text-2xl font-black text-white sm:text-3xl">Hola, {nombreAdmin}</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={onCerrarSesion}
          className="min-h-11 rounded-xl border border-white/15 bg-white/[0.04] px-4 font-bold text-slate-200 transition hover:border-rose-300/50 hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/30"
        >
          Cerrar Sesión
        </button>
      </header>

      <section aria-labelledby="titulo-admin" className="relative z-10 mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div>
          <p className="text-sm font-semibold text-teal-200">Panel del piloto</p>
          <h2 id="titulo-admin" className="mt-1 text-2xl font-black text-white sm:text-3xl">Docentes y uso de la plataforma</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Aquí ves las cuentas de docentes y cifras generales. Los nombres y resultados de los alumnos no están disponibles para el administrador.
          </p>
        </div>

        {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 font-semibold text-rose-800">{error}</p>}
        {!error && !resumen && <p role="status" className="rounded-2xl bg-white/95 px-5 py-6 font-semibold text-slate-700">Cargando panel…</p>}

        {resumen && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Cifra etiqueta="Docentes activos" valor={resumen.docentes_activos} detalle={`${resumen.docentes_inactivos} desactivados`} />
            <Cifra etiqueta="Grupos" valor={resumen.grupos} />
            <Cifra etiqueta="Alumnos activos" valor={resumen.alumnos_activos} />
            <Cifra etiqueta="Actividades" valor={resumen.actividades} detalle="aprobadas" />
            <Cifra etiqueta="Intentos" valor={resumen.intentos} detalle="de alumnos activos" />
            <Cifra etiqueta="Créditos IA del mes" valor={resumen.creditos_usados_mes} detalle={`plan Gratis: ${resumen.creditos_por_docente} por docente`} />
          </div>
        )}

        {usoIA && <CostoIA uso={usoIA} />}

        {solicitudes && (
          <div className="space-y-3 rounded-3xl bg-white p-5 text-slate-900 shadow-xl sm:p-6">
            <h3 className="text-xl font-black">Solicitudes de la sección Planes</h3>
            {solicitudes.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-6 text-center font-medium text-slate-700">Todavía no llegan solicitudes.</p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {solicitudes.map((s) => (
                  <li key={s.id_solicitud} className={`flex flex-wrap items-start justify-between gap-3 py-3 ${s.estado === "cerrada" ? "opacity-60" : ""}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-black">{s.nombre} · {s.escuela}</p>
                      <p className="text-sm text-slate-700">
                        <a className="underline" href={`mailto:${s.email}`}>{s.email}</a>
                        {s.telefono && <> · <a className="underline" href={`tel:${s.telefono}`}>{s.telefono}</a></>}
                      </p>
                      <p className="text-sm text-slate-600">
                        {s.tipo_escuela === "publica" ? "Pública" : "Privada"}{s.cct ? ` · ${s.cct}` : ""} · {s.num_docentes} docente(s) · Le interesa: {ETIQUETA_INTERES[s.plan_interes] ?? s.plan_interes} · {formatoFecha.format(new Date(s.fecha_creacion))}
                      </p>
                      {s.mensaje && <p className="mt-1 whitespace-pre-line text-sm text-slate-800">“{s.mensaje}”</p>}
                    </div>
                    <label className="flex flex-col text-xs font-bold uppercase tracking-wide text-slate-600">
                      Estado
                      <select value={s.estado} onChange={(e) => cambiarSolicitud(s, e.target.value)} className="mt-1 min-h-10 rounded-xl border-2 border-slate-300 bg-white px-2 text-sm font-bold normal-case tracking-normal text-slate-800">
                        {ESTADOS_SOLICITUD.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {docentes && (
          <div className="space-y-4 rounded-3xl bg-gradient-to-br from-white to-teal-50 p-5 text-slate-900 shadow-xl sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="flex flex-col text-xs font-bold uppercase tracking-wide text-slate-600">
                Buscar docente
                <input
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Nombre, correo o escuela"
                  className="mt-1 min-h-11 w-72 max-w-full rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                />
              </label>
              <p className="max-w-md text-xs font-medium text-slate-600">
                Cambia el plan cuando llegues a un acuerdo con el docente o su escuela. Desactivar una cuenta impide que inicie sesión; no borra sus grupos, juegos ni alumnos, y se puede revertir.
              </p>
            </div>

            {aviso && <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-900">{aviso}</p>}

            {docentes.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-8 text-center font-medium text-slate-700">Aún no hay docentes registrados.</p>
            ) : visibles.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-8 text-center font-medium text-slate-700">Ningún docente coincide con la búsqueda.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-teal-100 bg-white">
                <table className="w-full min-w-[1120px] border-collapse text-left">
                  <caption className="sr-only">Docentes del piloto</caption>
                  <thead className="bg-teal-50/80 text-xs font-black uppercase tracking-wide text-slate-700">
                    <tr>
                      <th scope="col" className="px-4 py-3">Docente</th>
                      <th scope="col" className="px-4 py-3">Estado</th>
                      <th scope="col" className="px-4 py-3">Plan</th>
                      <th scope="col" className="px-4 py-3">Grupos</th>
                      <th scope="col" className="px-4 py-3">Alumnos</th>
                      <th scope="col" className="px-4 py-3">Actividades</th>
                      <th scope="col" className="px-4 py-3">Intentos</th>
                      <th scope="col" className="px-4 py-3">Créditos IA del mes</th>
                      <th scope="col" className="px-4 py-3">Última actividad</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibles.map((d) => (
                      <tr key={d.id_docente} className={d.activo ? "" : "bg-slate-50"}>
                        <th scope="row" className="px-4 py-3 text-left">
                          <span className="block font-black text-slate-900">{d.nombre}</span>
                          <span className="block text-xs font-medium text-slate-600">{d.email}</span>
                          {d.escuela && <span className="block text-xs font-medium text-slate-600">{d.escuela}</span>}
                          {(d.tipo_escuela || d.cct) && (
                            <span className="block text-xs font-medium text-slate-600">
                              {d.tipo_escuela === "publica" ? "Pública" : d.tipo_escuela === "privada" ? "Privada" : ""}{d.tipo_escuela && d.cct ? " · " : ""}{d.cct}
                            </span>
                          )}
                        </th>
                        <td className="px-4 py-3">
                          <span className={`inline-block rounded-full border px-3 py-1 text-xs font-black ${d.activo ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-300 bg-slate-100 text-slate-700"}`}>
                            {d.activo ? "Activo" : "Desactivado"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <label className="sr-only" htmlFor={`plan-${d.id_docente}`}>Plan de {d.nombre}</label>
                          <select
                            id={`plan-${d.id_docente}`}
                            value={d.plan ?? "gratis"}
                            disabled={ocupado === d.id_docente || planes.length === 0}
                            onChange={(e) => cambiarPlan(d, e.target.value)}
                            className="min-h-10 rounded-xl border-2 border-slate-300 bg-white px-2 text-sm font-bold text-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200"
                          >
                            {(planes.length ? planes : [{ id: d.plan ?? "gratis", nombre: d.plan ?? "Gratis" }]).map((p) => (
                              <option key={p.id} value={p.id}>{p.nombre}{p.mensual ? ` (${p.mensual}/mes)` : ""}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-slate-800">{d.grupos}</td>
                        <td className="px-4 py-3 text-slate-800">{d.alumnos}</td>
                        <td className="px-4 py-3 text-slate-800">{d.actividades}</td>
                        <td className="px-4 py-3 text-slate-800">{d.intentos}</td>
                        <td className="px-4 py-3"><BarraCreditos usados={d.creditos_usados} limite={d.creditos_limite} /></td>
                        <td className="px-4 py-3 text-sm text-slate-800">{d.ultima_actividad ? formatoFecha.format(new Date(d.ultima_actividad)) : <span className="text-slate-500">Sin actividad</span>}</td>
                        <td className="px-4 py-3">
                          {!d.activo ? (
                            <button type="button" disabled={ocupado === d.id_docente} onClick={() => cambiarEstado(d, true)} className="min-h-11 rounded-xl border-2 border-teal-600 bg-white px-4 text-sm font-black text-teal-800 transition hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:opacity-50">
                              Reactivar
                            </button>
                          ) : confirmando === d.id_docente ? (
                            <div role="group" aria-label={`Confirmar desactivar a ${d.nombre}`} className="flex flex-wrap gap-2">
                              <button type="button" disabled={ocupado === d.id_docente} onClick={() => cambiarEstado(d, false)} className="min-h-11 rounded-xl bg-rose-700 px-4 text-sm font-black text-white transition hover:bg-rose-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:opacity-50">
                                Sí, desactivar
                              </button>
                              <button type="button" onClick={() => setConfirmando(null)} className="min-h-11 rounded-xl border-2 border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setConfirmando(d.id_docente)} className="min-h-11 rounded-xl border-2 border-rose-300 bg-white px-4 text-sm font-black text-rose-800 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200">
                              Desactivar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
