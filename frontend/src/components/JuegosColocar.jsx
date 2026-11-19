import { useState } from "react";
import { mezclar } from "../lib/azar";

// Dos juegos que se juegan igual: «toca una tarjeta y toca el lugar donde va».
// No se arrastra: así funciona con el dedo en una tableta, con el mouse y con el teclado (todo son botones).

const coloresCaja = [
  { borde: "border-sky-300", fondo: "bg-sky-50", titulo: "text-sky-900", ficha: "border-sky-200 bg-white text-sky-950" },
  { borde: "border-amber-300", fondo: "bg-amber-50", titulo: "text-amber-900", ficha: "border-amber-200 bg-white text-amber-950" },
  { borde: "border-emerald-300", fondo: "bg-emerald-50", titulo: "text-emerald-900", ficha: "border-emerald-200 bg-white text-emerald-950" },
];

const fichaBase = "min-h-12 rounded-2xl border-2 px-4 py-2 text-left text-base font-extrabold shadow-sm transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 sm:text-lg";
const botonRevisar = "mt-5 min-h-12 w-full rounded-2xl border-b-4 border-teal-800 bg-teal-700 px-5 py-3 font-black text-white transition hover:bg-teal-600 active:translate-y-1 active:border-b-0 disabled:cursor-not-allowed disabled:opacity-50";

function clasesDeFicha({ seleccionada, revisada, correcta }) {
  if (revisada) return correcta ? "border-emerald-400 bg-emerald-100 text-emerald-950" : "border-rose-400 bg-rose-100 text-rose-950";
  if (seleccionada) return "border-amber-400 bg-amber-100 text-amber-950 ring-4 ring-amber-200";
  return "border-slate-200 bg-white text-slate-900 hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50";
}

export function Clasificar({ pregunta, bloqueada, onResponder }) {
  const [orden] = useState(() => mezclar(pregunta.elementos.map((e) => e.texto)));
  const [colocados, setColocados] = useState({}); // texto -> índice de categoría
  const [seleccion, setSeleccion] = useState(null);
  const [revisado, setRevisado] = useState(false);

  const congelado = bloqueada || revisado;
  const categoriaCorrecta = Object.fromEntries(pregunta.elementos.map((e) => [e.texto, pregunta.categorias.findIndex((c) => c.trim().toLowerCase() === e.categoria.trim().toLowerCase())]));
  const pendientes = orden.filter((texto) => colocados[texto] === undefined);

  function poner(indiceCategoria) {
    if (congelado || seleccion === null) return;
    setColocados((actuales) => ({ ...actuales, [seleccion]: indiceCategoria }));
    setSeleccion(null);
  }

  function devolver(texto) {
    if (congelado) return;
    setColocados((actuales) => {
      const copia = { ...actuales };
      delete copia[texto];
      return copia;
    });
  }

  function revisar() {
    setRevisado(true);
    onResponder(orden.every((texto) => colocados[texto] === categoriaCorrecta[texto]));
  }

  return (
    <div>
      <p aria-live="polite" className="mb-3 text-sm font-bold text-slate-600">
        {seleccion ? `Elegiste «${seleccion}». Ahora toca la caja donde va.` : pendientes.length ? `Toca una tarjeta para elegirla. Faltan ${pendientes.length}.` : "¡Todo está en una caja! Revisa tu trabajo."}
      </p>

      <ul className={`flex flex-wrap gap-2 ${pendientes.length ? "mb-5" : ""}`} aria-label="Tarjetas por clasificar">
        {pendientes.map((texto) => (
          <li key={texto}>
            <button type="button" disabled={congelado} aria-pressed={seleccion === texto} onClick={() => setSeleccion(seleccion === texto ? null : texto)} className={`${fichaBase} ${clasesDeFicha({ seleccionada: seleccion === texto })}`}>{texto}</button>
          </li>
        ))}
      </ul>

      <div className={`grid gap-4 ${pregunta.categorias.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
        {pregunta.categorias.map((nombre, indice) => {
          const color = coloresCaja[indice % coloresCaja.length];
          const dentro = orden.filter((texto) => colocados[texto] === indice);
          return (
            <section key={nombre} aria-label={`Caja ${nombre}`} className={`rounded-3xl border-2 border-dashed p-4 ${color.borde} ${color.fondo}`}>
              <h3 className={`text-lg font-black ${color.titulo}`}>{nombre}</h3>
              <button type="button" disabled={congelado || seleccion === null} onClick={() => poner(indice)} className={`mt-2 min-h-11 w-full rounded-xl border-2 border-dashed px-3 text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${seleccion !== null && !congelado ? "border-amber-400 bg-white text-amber-900 hover:bg-amber-100" : "border-transparent bg-transparent text-slate-400"}`}>
                {seleccion !== null && !congelado ? `Poner «${seleccion}» aquí` : "Elige una tarjeta"}
              </button>
              <ul className="mt-3 space-y-2">
                {dentro.map((texto) => (
                  <li key={texto}>
                    <button type="button" disabled={congelado} onClick={() => devolver(texto)} aria-label={revisado ? `${texto}: ${colocados[texto] === categoriaCorrecta[texto] ? "bien" : "mal"}` : `${texto}. Toca para sacarla de la caja`} className={`${fichaBase} w-full ${clasesDeFicha({ revisada: revisado, correcta: colocados[texto] === categoriaCorrecta[texto] })}`}>
                      {revisado ? (colocados[texto] === categoriaCorrecta[texto] ? "✓ " : "✗ ") : ""}{texto}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {!revisado && <button type="button" disabled={congelado || pendientes.length > 0} onClick={revisar} className={botonRevisar}>¡Revisar mis cajas! 📦</button>}
    </div>
  );
}

export function LineaTiempo({ pregunta, bloqueada, onResponder }) {
  const total = pregunta.eventos.length;
  const [orden] = useState(() => mezclar(pregunta.eventos.map((e) => e.texto)));
  const [colocadas, setColocadas] = useState(() => Array(total).fill(null)); // por posición: texto o null
  const [seleccion, setSeleccion] = useState(null);
  const [revisado, setRevisado] = useState(false);

  const congelado = bloqueada || revisado;
  const pendientes = orden.filter((texto) => !colocadas.includes(texto));

  function colocarEn(posicion) {
    if (congelado || seleccion === null) return;
    setColocadas((actuales) => actuales.map((actual, i) => (i === posicion ? seleccion : actual)));
    setSeleccion(null);
  }

  function devolver(posicion) {
    if (congelado) return;
    setColocadas((actuales) => actuales.map((actual, i) => (i === posicion ? null : actual)));
  }

  function revisar() {
    setRevisado(true);
    onResponder(pregunta.eventos.every((evento, i) => colocadas[i] === evento.texto));
  }

  return (
    <div>
      <p aria-live="polite" className="mb-3 text-sm font-bold text-slate-600">
        {seleccion ? `Elegiste «${seleccion}». Ahora toca el lugar de la línea donde va.` : pendientes.length ? `Toca un suceso para elegirlo. Faltan ${pendientes.length}.` : "¡La línea está completa! Revisa tu trabajo."}
      </p>

      <ul className={`flex flex-wrap gap-2 ${pendientes.length ? "mb-6" : ""}`} aria-label="Sucesos por colocar">
        {pendientes.map((texto) => (
          <li key={texto}>
            <button type="button" disabled={congelado} aria-pressed={seleccion === texto} onClick={() => setSeleccion(seleccion === texto ? null : texto)} className={`${fichaBase} ${clasesDeFicha({ seleccionada: seleccion === texto })}`}>{texto}</button>
          </li>
        ))}
      </ul>

      <ol className="relative space-y-3 border-l-4 border-teal-200 pl-6" aria-label="Línea del tiempo">
        {pregunta.eventos.map((evento, posicion) => {
          const texto = colocadas[posicion];
          const correcta = texto === evento.texto;
          return (
            <li key={evento.etiqueta} className="relative">
              <span aria-hidden="true" className={`absolute -left-[2.15rem] top-3 flex h-6 w-6 items-center justify-center rounded-full border-4 border-white text-[0.65rem] font-black text-white shadow ${revisado ? (correcta ? "bg-emerald-500" : "bg-rose-500") : "bg-teal-600"}`}>{posicion + 1}</span>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <p className="w-full shrink-0 rounded-xl bg-teal-100 px-3 py-2 text-sm font-black uppercase tracking-wide text-teal-900 sm:w-44">{evento.etiqueta}</p>
                {texto ? (
                  <button type="button" disabled={congelado} onClick={() => devolver(posicion)} aria-label={revisado ? `${evento.etiqueta}: ${texto}. ${correcta ? "Bien" : "Mal"}` : `${evento.etiqueta}: ${texto}. Toca para quitarlo`} className={`${fichaBase} flex-1 ${clasesDeFicha({ revisada: revisado, correcta })}`}>
                    {revisado ? (correcta ? "✓ " : "✗ ") : ""}{texto}
                  </button>
                ) : (
                  <button type="button" disabled={congelado || seleccion === null} onClick={() => colocarEn(posicion)} className={`min-h-12 flex-1 rounded-2xl border-2 border-dashed px-4 py-2 text-left text-sm font-black transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200 ${seleccion !== null ? "border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100" : "border-slate-300 bg-slate-50 text-slate-400"}`}>
                    {seleccion !== null ? `Poner «${seleccion}» aquí` : "Espacio vacío"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {!revisado && <button type="button" disabled={congelado || pendientes.length > 0} onClick={revisar} className={botonRevisar}>¡Revisar mi línea! ⏳</button>}
    </div>
  );
}
