import { useState } from "react";
import { ESQUEMAS } from "../lib/esquemas";
import { mezclar } from "../lib/azar";

// Tres juegos de ciencias: «hipótesis» (predice y mira qué pasa), «etiquetar» (nombres sobre un
// esquema) y «detective» (encuentra la oración equivocada). Todo se maneja con botones: sirve con el
// dedo, el mouse y el teclado. En «etiquetar» además se puede arrastrar con el mouse.

const botonRevisar = "mt-5 min-h-12 w-full rounded-2xl border-b-4 border-teal-800 bg-teal-700 px-5 py-3 font-black text-white transition hover:bg-teal-600 active:translate-y-1 active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200";
const fichaBase = "min-h-12 rounded-2xl border-2 px-4 py-2 text-left text-base font-extrabold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:text-lg";

/* ------------------------------ Laboratorio de hipótesis ------------------------------ */

export function Hipotesis({ pregunta, bloqueada, onResponder }) {
  const [elegida, setElegida] = useState(null);
  const [visto, setVisto] = useState(false);
  const congelado = bloqueada || visto;
  const acerto = elegida === pregunta.correcta;

  function ver() {
    setVisto(true);
    onResponder(acerto);
  }

  return (
    <div>
      <p className="mb-3 text-sm font-black uppercase tracking-wide text-sky-800"><span aria-hidden="true">🧪 </span>Mi hipótesis: ¿qué crees que pasará?</p>
      <ul className="grid gap-3 sm:grid-cols-1" aria-label="Predicciones">
        {pregunta.opciones.map((opcion, indice) => {
          const estado = visto ? (indice === pregunta.correcta ? "ok" : indice === elegida ? "mal" : "neutro") : indice === elegida ? "sel" : "libre";
          const clases = {
            ok: "border-emerald-400 bg-emerald-100 text-emerald-950",
            mal: "border-rose-400 bg-rose-100 text-rose-950",
            neutro: "border-slate-200 bg-slate-50 text-slate-500",
            sel: "border-amber-400 bg-amber-100 text-amber-950 ring-4 ring-amber-200",
            libre: "border-sky-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-50",
          }[estado];
          return (
            <li key={`${indice}-${opcion}`}>
              <button type="button" disabled={congelado} aria-pressed={indice === elegida} onClick={() => setElegida(indice)} className={`${fichaBase} flex w-full items-center gap-3 ${clases}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-black text-slate-700 shadow-sm">{String.fromCharCode(65 + indice)}</span>
                <span>{visto && indice === pregunta.correcta ? "✓ " : visto && indice === elegida ? "✗ " : ""}{opcion}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {!visto && (
        <button type="button" disabled={congelado || elegida === null} onClick={ver} className={botonRevisar}>
          {elegida === null ? "Elige una predicción" : "¡Ver qué pasa! 🔬"}
        </button>
      )}
      {visto && (
        <div role="status" className="mt-5 rounded-2xl border-2 border-sky-200 bg-sky-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-800">Lo que pasó en el experimento</p>
          <p className="mt-1 text-lg font-extrabold leading-snug text-slate-900">{pregunta.resultado}</p>
          <p className={`mt-2 text-sm font-bold ${acerto ? "text-emerald-800" : "text-amber-900"}`}>{acerto ? "Tu hipótesis coincide con lo que pasó." : "Tu hipótesis fue distinta, ¡y está bien! Los científicos también se equivocan y aprenden."}</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Etiquetar un esquema ------------------------------ */

export function Etiquetar({ pregunta, bloqueada, onResponder }) {
  const esquema = ESQUEMAS[pregunta.esquema] ?? ESQUEMAS.planta;
  const puntos = [...pregunta.puntos].sort((a, b) => a.numero - b.numero);
  const [orden] = useState(() => mezclar(puntos.map((p) => p.texto)));
  const [colocadas, setColocadas] = useState({}); // número del punto -> texto
  const [seleccion, setSeleccion] = useState(null);
  const [revisado, setRevisado] = useState(false);

  const congelado = bloqueada || revisado;
  const usadas = Object.values(colocadas);
  const pendientes = orden.filter((texto) => !usadas.includes(texto));
  const correctaEn = (numero) => colocadas[numero] === puntos.find((p) => p.numero === numero)?.texto;

  function poner(numero, texto = seleccion) {
    if (congelado || texto === null) return;
    setColocadas((actuales) => {
      const copia = { ...actuales };
      for (const clave of Object.keys(copia)) if (copia[clave] === texto) delete copia[clave]; // una etiqueta, un solo lugar
      copia[numero] = texto;
      return copia;
    });
    setSeleccion(null);
  }

  function quitar(numero) {
    if (congelado) return;
    setColocadas((actuales) => {
      const copia = { ...actuales };
      delete copia[numero];
      return copia;
    });
  }

  function revisar() {
    setRevisado(true);
    onResponder(puntos.every((p) => colocadas[p.numero] === p.texto));
  }

  const colorPunto = (numero) => {
    if (revisado) return correctaEn(numero) ? "bg-emerald-500 ring-emerald-200" : "bg-rose-500 ring-rose-200";
    if (colocadas[numero]) return "bg-teal-600 ring-teal-200";
    return seleccion !== null ? "bg-amber-400 text-amber-950 ring-amber-200 animate-pulse" : "bg-slate-800 ring-slate-300";
  };

  return (
    <div>
      <p aria-live="polite" className="mb-3 text-sm font-bold text-slate-600">
        {seleccion ? `Elegiste «${seleccion}». Ahora toca su número en el dibujo o en la lista.` : pendientes.length ? `Toca una etiqueta (o arrástrala al dibujo). Faltan ${pendientes.length}.` : "¡Todo está etiquetado! Revisa tu trabajo."}
      </p>

      <ul className={`flex flex-wrap gap-2 ${pendientes.length ? "mb-5" : ""}`} aria-label="Etiquetas por colocar">
        {pendientes.map((texto) => (
          <li key={texto}>
            <button type="button" draggable={!congelado} disabled={congelado} aria-pressed={seleccion === texto}
              onDragStart={(e) => { e.dataTransfer.setData("text/plain", texto); e.dataTransfer.effectAllowed = "move"; setSeleccion(texto); }}
              onClick={() => setSeleccion(seleccion === texto ? null : texto)}
              className={`${fichaBase} cursor-grab ${seleccion === texto ? "border-amber-400 bg-amber-100 text-amber-950 ring-4 ring-amber-200" : "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50"}`}>{texto}</button>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-sm">
          <svg viewBox="0 0 100 100" role="img" aria-label={`Esquema: ${esquema.nombre}. Tiene ${puntos.length} puntos numerados para etiquetar.`} className="h-full w-full rounded-3xl border-2 border-slate-200 shadow-sm">
            {esquema.dibujo}
          </svg>
          {puntos.map((p) => {
            const [x, y] = esquema.puntos[p.numero] ?? [50, 50];
            return (
              <button key={p.numero} type="button" disabled={congelado || seleccion === null}
                onClick={() => poner(p.numero)}
                onDragOver={(e) => { if (!congelado) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); poner(p.numero, e.dataTransfer.getData("text/plain") || seleccion); }}
                aria-label={`Punto ${p.numero}${colocadas[p.numero] ? `: ${colocadas[p.numero]}` : ", vacío"}`}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-base font-black text-white shadow-lg ring-4 transition focus-visible:outline-none focus-visible:ring-sky-400 disabled:cursor-default ${colorPunto(p.numero)}`}>
                {revisado ? (correctaEn(p.numero) ? "✓" : "✗") : p.numero}
              </button>
            );
          })}
        </div>

        <ol className="space-y-2" aria-label="Lista de puntos">
          {puntos.map((p) => {
            const texto = colocadas[p.numero];
            return (
              <li key={p.numero} className="flex items-center gap-3"
                onDragOver={(e) => { if (!congelado) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); poner(p.numero, e.dataTransfer.getData("text/plain") || seleccion); }}>
                <span aria-hidden="true" className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base font-black text-white ${revisado ? (correctaEn(p.numero) ? "bg-emerald-500" : "bg-rose-500") : "bg-slate-800"}`}>{p.numero}</span>
                {texto ? (
                  <button type="button" disabled={congelado} onClick={() => quitar(p.numero)}
                    aria-label={revisado ? `Punto ${p.numero}: ${texto}. ${correctaEn(p.numero) ? "Bien" : `Mal, era ${p.texto}`}` : `Punto ${p.numero}: ${texto}. Toca para quitarla`}
                    className={`${fichaBase} flex-1 ${revisado ? (correctaEn(p.numero) ? "border-emerald-400 bg-emerald-100 text-emerald-950" : "border-rose-400 bg-rose-100 text-rose-950") : "border-teal-300 bg-teal-50 text-teal-950"}`}>
                    {revisado ? (correctaEn(p.numero) ? "✓ " : "✗ ") : ""}{texto}{revisado && !correctaEn(p.numero) ? ` → ${p.texto}` : ""}
                  </button>
                ) : (
                  <button type="button" disabled={congelado || seleccion === null} onClick={() => poner(p.numero)}
                    className={`min-h-12 flex-1 rounded-2xl border-2 border-dashed px-4 py-2 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${seleccion !== null ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-slate-300 bg-slate-50 text-slate-400"}`}>
                    {seleccion !== null ? `Poner «${seleccion}» aquí` : "Espacio vacío"}
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {!revisado && <button type="button" disabled={congelado || pendientes.length > 0} onClick={revisar} className={botonRevisar}>¡Revisar mis etiquetas! 🏷️</button>}
    </div>
  );
}

/* ------------------------------ Detective de errores ------------------------------ */

export function Detective({ pregunta, bloqueada, onResponder }) {
  const [elegida, setElegida] = useState(null);
  const congelado = bloqueada || elegida !== null;

  function elegir(indice) {
    if (congelado) return;
    setElegida(indice);
    onResponder(indice === pregunta.error);
  }

  const revisado = elegida !== null;
  return (
    <div>
      <p className="mb-3 text-sm font-bold text-slate-600"><span aria-hidden="true">🔍 </span>Lee con atención y toca la oración que tiene el error.</p>
      <ol className="space-y-2 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-3" aria-label="Explicación con un error">
        {pregunta.oraciones.map((oracion, indice) => {
          const esError = indice === pregunta.error;
          const clases = revisado
            ? esError ? "border-emerald-400 bg-emerald-100 text-emerald-950" : indice === elegida ? "border-rose-400 bg-rose-100 text-rose-950" : "border-transparent bg-white text-slate-600"
            : "border-transparent bg-white text-slate-900 hover:border-amber-300 hover:bg-amber-50";
          return (
            <li key={indice}>
              <button type="button" disabled={congelado} onClick={() => elegir(indice)}
                aria-label={revisado ? `${oracion}${esError ? " Esta era la oración con el error." : indice === elegida ? " La elegiste, pero estaba bien." : ""}` : `Oración ${indice + 1}: ${oracion}`}
                className={`${fichaBase} flex w-full items-start gap-3 border-2 font-bold ${clases}`}>
                <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-black text-slate-700">{indice + 1}</span>
                <span>{revisado && esError ? "🐞 " : ""}{oracion}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {revisado && (
        <div role="status" className="mt-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-800">Así debía decir</p>
          <p className="mt-1 text-lg font-extrabold leading-snug text-slate-900">{pregunta.correccion}</p>
        </div>
      )}
    </div>
  );
}
