import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert, Copy, Printer, Sparkles, X } from "lucide-react";
import { api } from "../services/api";
import InsigniaMedalla from "./InsigniaMedalla";
import MascotaMurcielago from "./MascotaMurcielago";

const TIPOS = {
  quiz: "Quiz relámpago",
  verdadero_falso: "Cierto o falso",
  ordenar: "Ordena los pasos",
  relacionar: "Une las parejas",
  memoria: "Juego de memoria",
  completar: "Completa la frase",
  clasificar: "Clasifica y agrupa",
  linea_tiempo: "Línea del tiempo",
  hipotesis: "Laboratorio de hipótesis",
  etiquetar: "Etiqueta el esquema",
  detective: "Detective de errores",
  clase: "Clase interactiva",
};

const AZUL = "#1c3157";

function fechaLarga(iso) {
  if (!iso) return "";
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function fechaCorta(iso) {
  if (!iso) return "—";
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

// Frase que resume el avance. Se arma con reglas fijas (sin IA): el reporte nunca inventa nada.
function resumenEnPalabras(r) {
  const nombre = r.alumno.nombre;
  const { realizadas, disponibles, promedio } = r.resumen;
  if (disponibles === 0) return `Por ahora no hay actividades publicadas para ${nombre}. Cuando el docente las apruebe, aquí verás su avance.`;
  if (realizadas === 0) return `${nombre} todavía no ha terminado ninguna de las ${disponibles} actividades disponibles. Cuando lo haga, aquí verás cómo le va.`;
  const base = `${nombre} ha terminado ${realizadas} de ${disponibles} actividades y su promedio de aciertos es de ${promedio} %.`;
  return r.fortalezas.length ? `${base} Le salen especialmente bien: ${r.fortalezas.map((t) => `«${t}»`).join(", ")}.` : base;
}

function consejosParaCasa(r) {
  const consejos = ["Pídele que te cuente, con sus propias palabras, qué aprendió en su última actividad."];
  if (r.para_repasar.length) consejos.push(`Dediquen unos 10 minutos a repasar juntos «${r.para_repasar[0]}»; repetir la actividad le ayuda a mejorar.`);
  else if (r.resumen.pendientes > 0) consejos.push("Anímalo a terminar las actividades que le faltan, a su ritmo y sin presión.");
  else consejos.push("Pregúntale qué le gustaría descubrir después: la curiosidad también se practica.");
  consejos.push("Celebra el esfuerzo y la constancia, no solo la calificación.");
  return consejos;
}

// Texto corto para mandar por WhatsApp u otro mensaje.
function textoParaMensaje(r) {
  const { realizadas, disponibles, promedio } = r.resumen;
  const lineas = [
    `📘 Reporte de avance${r.alumno.grupo ? ` · ${r.alumno.grupo}` : ""}`,
    `Estudiante: ${r.alumno.nombre}`,
    `✅ Actividades terminadas: ${realizadas} de ${disponibles}`,
    promedio != null ? `🎯 Promedio de aciertos: ${promedio} %` : null,
    `⭐ Puntos: ${r.puntos}`,
    `🏅 Insignias: ${r.logros.obtenidas} de ${r.logros.total} (${r.logros.nivel.nombre})`,
    r.fortalezas.length ? `💪 Le sale muy bien: ${r.fortalezas.join(", ")}` : null,
    r.para_repasar.length ? `🔁 Para repasar en casa: ${r.para_repasar.join(", ")}` : null,
    `— ${r.docente.nombre}${r.docente.escuela ? ` · ${r.docente.escuela}` : ""}`,
  ];
  return lineas.filter(Boolean).join("\n");
}

function Mosaico({ etiqueta, valor, detalle, barra }) {
  return (
    <div className="reporte-evitar-corte rounded-2xl p-4" style={{ backgroundColor: "#e3eff6" }}>
      <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "#3c5e85" }}>{etiqueta}</p>
      <p className="mt-1 text-3xl font-black leading-none" style={{ color: AZUL }}>{valor}</p>
      {detalle && <p className="mt-1 text-xs font-semibold text-slate-600">{detalle}</p>}
      {barra != null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full" style={{ width: `${barra}%`, backgroundColor: "#3c5e85" }} /></div>
      )}
    </div>
  );
}

function EstadoActividad({ actividad, umbral }) {
  if (!actividad.realizada) return <span className="whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">Pendiente</span>;
  if (actividad.mejor < umbral) return <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">Por repasar</span>;
  return <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">Realizada</span>;
}

function Hoja({ r }) {
  const { resumen, logros, umbral_apoyo: umbral } = r;
  const porcentajeHecho = resumen.disponibles ? Math.round((resumen.realizadas / resumen.disponibles) * 100) : 0;
  const ganadas = logros.insignias.filter((i) => i.obtenida);

  return (
    <article className="reporte-hoja mx-auto my-6 w-full max-w-[820px] overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
      <header className="flex flex-wrap items-center justify-between gap-4 px-8 py-6 text-white print:py-3" style={{ backgroundColor: AZUL }}>
        <div className="flex items-center gap-4">
          <MascotaMurcielago className="h-16 w-16 shrink-0" />
          <div>
            <p className="text-lg font-black leading-tight">Equipo Murciélago</p>
            <p className="text-sm font-semibold" style={{ color: "#a0c3d9" }}>{r.alumno.grupo ? `Grupo ${r.alumno.grupo}` : "Mi grupo"} · {r.alumno.grado}.º de primaria</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#a0c3d9" }}>Reporte de avance</p>
          <p className="text-sm font-semibold">{fechaLarga(r.generado)}</p>
        </div>
      </header>

      <div className="space-y-7 px-8 py-8 print:space-y-4 print:py-5">
        <section className="reporte-evitar-corte flex flex-wrap items-end justify-between gap-3 border-b-2 pb-5" style={{ borderColor: "#a0c3d9" }}>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Estudiante</p>
            <h2 className="text-4xl font-black leading-tight print:text-3xl" style={{ color: AZUL }}>{r.alumno.nombre}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">Docente: {r.docente.nombre}{r.docente.escuela ? ` · ${r.docente.escuela}` : ""}</p>
          </div>
          <p className="rounded-full px-4 py-1.5 text-sm font-black" style={{ backgroundColor: "#fef3c7", color: "#78350f" }}>{logros.nivel.nombre}</p>
        </section>

        <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mosaico etiqueta="Actividades" valor={`${resumen.realizadas} de ${resumen.disponibles}`} detalle="terminadas" barra={porcentajeHecho} />
          <Mosaico etiqueta="Promedio" valor={resumen.promedio != null ? `${resumen.promedio} %` : "—"} detalle="de aciertos (mejor intento)" />
          <Mosaico etiqueta="Puntos" valor={r.puntos} detalle="acumulados" />
          <Mosaico etiqueta="Constancia" valor={resumen.dias_activos} detalle={resumen.dias_activos === 1 ? "día practicando" : "días practicando"} />
        </section>

        <p className="reporte-evitar-corte text-lg font-medium leading-relaxed text-slate-800 print:text-base">{resumenEnPalabras(r)}</p>

        <section className="reporte-evitar-corte grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 print:p-3">
            <h3 className="flex items-center gap-2 text-base font-black text-emerald-900"><Check size={18} aria-hidden="true" /> Lo que ya domina</h3>
            {r.fortalezas.length ? (
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-emerald-950">{r.fortalezas.map((t) => <li key={t}>• {t}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm font-medium text-emerald-950/80">Aquí aparecerán las actividades en las que logre {r.umbral_fortaleza} % o más.</p>
            )}
          </div>
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 print:p-3">
            <h3 className="flex items-center gap-2 text-base font-black text-amber-900"><CircleAlert size={18} aria-hidden="true" /> Para repasar juntos</h3>
            {r.para_repasar.length ? (
              <ul className="mt-2 space-y-1.5 text-sm font-semibold text-amber-950">{r.para_repasar.map((t) => <li key={t}>• {t}</li>)}</ul>
            ) : (
              <p className="mt-2 text-sm font-medium text-amber-950/80">{resumen.realizadas ? "Por ahora no hay nada que repasar." : "Todavía no hay resultados para repasar."}</p>
            )}
            {resumen.pendientes > 0 && <p className="mt-3 text-xs font-bold text-amber-900">Actividades por hacer: {resumen.pendientes}</p>}
          </div>
        </section>

        <section aria-labelledby="detalle-actividades">
          <h3 id="detalle-actividades" className="mb-2 text-base font-black" style={{ color: AZUL }}>Detalle por actividad</h3>
          {r.actividades.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse text-left text-sm">
                <thead style={{ backgroundColor: "#e3eff6", color: AZUL }}>
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-bold">Actividad</th>
                    <th scope="col" className="px-3 py-2.5 font-bold">Estado</th>
                    <th scope="col" className="px-3 py-2.5 font-bold">Mejor resultado</th>
                    <th scope="col" className="px-3 py-2.5 text-center font-bold">Intentos</th>
                    <th scope="col" className="px-3 py-2.5 font-bold">Último</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {r.actividades.map((a) => (
                    <tr key={a.id_juego} className="reporte-evitar-corte">
                      <td className="px-4 py-2.5 print:py-1.5"><span className="font-bold text-slate-900">{a.titulo}</span><span className="block text-xs font-medium text-slate-500">{TIPOS[a.tipo] ?? "Actividad"}</span></td>
                      <td className="px-3 py-2.5"><EstadoActividad actividad={a} umbral={umbral} /></td>
                      <td className="px-3 py-2.5">
                        {a.realizada ? (
                          <span className="flex items-center gap-2 whitespace-nowrap font-bold text-slate-900">{a.mejor} %<span className="h-2 w-16 overflow-hidden rounded-full bg-slate-200"><span className="block h-full rounded-full" style={{ width: `${a.mejor}%`, backgroundColor: a.mejor >= r.umbral_fortaleza ? "#059669" : a.mejor >= umbral ? "#3c5e85" : "#d97706" }} /></span></span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2.5 text-center font-semibold text-slate-700">{a.intentos || "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-600">{fechaCorta(a.ultimo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-5 text-sm font-medium text-slate-600">Todavía no hay actividades publicadas.</p>}
        </section>

        <section className="reporte-evitar-corte" aria-labelledby="titulo-insignias-reporte">
          <h3 id="titulo-insignias-reporte" className="mb-2 flex items-center gap-2 text-base font-black" style={{ color: AZUL }}><Sparkles size={18} aria-hidden="true" /> Insignias conseguidas ({logros.obtenidas} de {logros.total})</h3>
          {ganadas.length ? (
            <ul className="flex flex-wrap gap-4">
              {ganadas.map((i) => (
                <li key={i.id} className="flex w-24 flex-col items-center text-center">
                  <InsigniaMedalla insignia={i} tamano={72} />
                  <span className="text-xs font-black leading-tight text-slate-800">{i.nombre}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm font-medium text-slate-600">Todavía no ha ganado insignias; llegarán con la práctica.</p>}
        </section>

        <section className="reporte-evitar-corte rounded-2xl p-5 print:p-3" style={{ backgroundColor: "#e3eff6" }}>
          <h3 className="text-base font-black" style={{ color: AZUL }}>Cómo apoyar en casa</h3>
          <ul className="mt-2 space-y-1.5 text-sm font-medium text-slate-800">{consejosParaCasa(r).map((c) => <li key={c}>• {c}</li>)}</ul>
        </section>

        <section className="reporte-evitar-corte">
          <h3 className="text-base font-black" style={{ color: AZUL }}>Comentario del docente</h3>
          <div aria-hidden="true" className="mt-2">{[0, 1, 2].map((n) => <div key={n} className="h-8 border-b border-slate-300 print:h-6" />)}</div>
          <div className="mt-6 grid grid-cols-2 gap-8 text-xs print:mt-4 font-semibold text-slate-600">
            <p className="border-t border-slate-400 pt-1.5">Firma del docente</p>
            <p className="border-t border-slate-400 pt-1.5">Enterado(a), madre, padre o tutor</p>
          </div>
        </section>

        <footer className="border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
          Este reporte resume la práctica del estudiante en la plataforma y no sustituye una calificación oficial. Contiene únicamente datos de {r.alumno.nombre}, ninguna comparación con otros estudiantes, y solo debe compartirse con su familia.
        </footer>
      </div>
    </article>
  );
}

// Reporte de avance de un alumno, para imprimir o compartir con su familia. Se dibuja encima de todo
// (en el <body>) para poder imprimirlo solo: al imprimir se oculta la aplicación y queda únicamente la hoja.
export default function ReporteFamiliar({ idAlumno, token, onCerrar }) {
  const [reporte, setReporte] = useState(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState("");

  const [intento, setIntento] = useState(0);

  // Pide el reporte al servidor. `intento` sube al pulsar «Reintentar» y vuelve a lanzar la petición.
  useEffect(() => {
    let vigente = true;
    api.reporteFamiliar(idAlumno, token)
      .then((datos) => { if (vigente) setReporte(datos); })
      .catch((err) => { if (vigente) setError(err instanceof Error ? err.message : "No se pudo cargar el reporte."); });
    return () => { vigente = false; };
  }, [idAlumno, token, intento]);

  function reintentar() {
    setError("");
    setReporte(null);
    setIntento((n) => n + 1);
  }

  useEffect(() => {
    document.body.dataset.reporteAbierto = "true";
    const alTeclear = (evento) => { if (evento.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alTeclear);
    return () => {
      delete document.body.dataset.reporteAbierto;
      document.removeEventListener("keydown", alTeclear);
    };
  }, [onCerrar]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoParaMensaje(reporte));
      setCopiado("¡Copiado! Pégalo en tu mensaje.");
    } catch {
      setCopiado("No se pudo copiar. Usa «Imprimir» y guarda el PDF.");
    }
    window.setTimeout(() => setCopiado(""), 3500);
  }

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Reporte de avance para la familia" className="reporte-capa fixed inset-0 z-[70] overflow-y-auto bg-slate-900/70 px-3 pb-10 backdrop-blur-sm">
      <div className="reporte-no-imprimir sticky top-0 z-10 -mx-3 mb-2 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-[#0d1c2b]/95 px-4 py-3 backdrop-blur">
        <p className="text-sm font-black text-white">Reporte para la familia</p>
        <div className="flex flex-wrap items-center gap-2">
          {copiado && <span role="status" className="text-sm font-bold text-teal-200">{copiado}</span>}
          <button type="button" disabled={!reporte} onClick={copiar} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/50 disabled:opacity-50"><Copy size={16} aria-hidden="true" /> Copiar para WhatsApp</button>
          <button type="button" disabled={!reporte} onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-b-4 border-teal-800 bg-teal-400 px-4 text-sm font-black text-[#06251f] transition hover:bg-teal-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/60 disabled:opacity-50"><Printer size={16} aria-hidden="true" /> Imprimir o guardar PDF</button>
          <button type="button" autoFocus onClick={onCerrar} aria-label="Cerrar reporte" className="grid h-11 w-11 place-items-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/50"><X size={18} aria-hidden="true" /></button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="reporte-no-imprimir mx-auto mt-10 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-bold text-rose-900">{error}</p>
          <button type="button" onClick={reintentar} className="mt-4 min-h-11 rounded-xl border-b-4 border-rose-900 bg-rose-700 px-5 font-bold text-white hover:bg-rose-600">Reintentar</button>
        </div>
      ) : !reporte ? (
        <p role="status" className="reporte-no-imprimir mx-auto mt-16 max-w-sm rounded-2xl bg-white/10 p-6 text-center font-semibold text-white">Preparando el reporte...</p>
      ) : (
        <Hoja r={reporte} />
      )}
    </div>,
    document.body,
  );
}
