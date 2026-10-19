import { useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";

const coloresOpciones = [
  "border-orange-200 bg-orange-50 hover:border-orange-400 hover:bg-orange-100 text-orange-950",
  "border-sky-200 bg-sky-50 hover:border-sky-400 hover:bg-sky-100 text-sky-950",
  "border-emerald-200 bg-emerald-50 hover:border-emerald-400 hover:bg-emerald-100 text-emerald-950",
  "border-pink-200 bg-pink-50 hover:border-pink-400 hover:bg-pink-100 text-pink-950",
];

const nombresTipo = {
  quiz: "Reto de preguntas",
  verdadero_falso: "Detectives de la verdad",
  ordenar: "Ordena la aventura",
  relacionar: "Conecta las ideas",
  memoria: "Memoria científica",
  completar: "Completa la frase",
};

function mezclar(elementos) {
  const resultado = [...elementos];
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(Math.random() * (indice + 1));
    [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  }
  return resultado;
}

function normalizarTexto(texto) {
  return texto.trim().toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function Quiz({ pregunta, bloqueada, onResponder }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {pregunta.opciones.map((opcion, indice) => (
        <button key={`${indice}-${opcion}`} type="button" disabled={bloqueada} onClick={() => onResponder(indice === pregunta.correcta)} className={`group flex min-h-20 items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-lg font-extrabold shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 disabled:cursor-default sm:text-xl ${coloresOpciones[indice % coloresOpciones.length]}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-xl font-black text-slate-700 shadow-sm">{String.fromCharCode(65 + indice)}</span>
          <span>{opcion}</span>
        </button>
      ))}
    </div>
  );
}

function VerdaderoFalso({ pregunta, bloqueada, onResponder }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <button type="button" disabled={bloqueada} onClick={() => onResponder(pregunta.correcta === true)} className="min-h-28 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-5 text-xl font-black text-emerald-900 shadow-sm transition hover:-translate-y-1 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-70">
        <span className="mb-1 block text-4xl" aria-hidden="true">🌱</span>¡Es verdad!
      </button>
      <button type="button" disabled={bloqueada} onClick={() => onResponder(pregunta.correcta === false)} className="min-h-28 rounded-3xl border-2 border-rose-200 bg-rose-50 p-5 text-xl font-black text-rose-900 shadow-sm transition hover:-translate-y-1 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:opacity-70">
        <span className="mb-1 block text-4xl" aria-hidden="true">🍂</span>¡No es verdad!
      </button>
    </div>
  );
}

function Ordenar({ pregunta, bloqueada, onResponder }) {
  const [elementos, setElementos] = useState(() => mezclar(pregunta.elementos));
  const [revisado, setRevisado] = useState(false);

  function mover(indice, direccion) {
    const destino = indice + direccion;
    if (destino < 0 || destino >= elementos.length || bloqueada) return;
    setElementos((actuales) => {
      const copia = [...actuales];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });
  }

  function comprobar() {
    setRevisado(true);
    onResponder(elementos.every((elemento, indice) => elemento === pregunta.orden_correcto[indice]));
  }

  return (
    <div>
      <ol className="space-y-3">
        {elementos.map((elemento, indice) => (
          <li key={`${elemento}-${indice}`} className="flex items-center gap-3 rounded-2xl border-2 border-sky-100 bg-sky-50/70 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white font-black text-teal-800 shadow-sm">{indice + 1}</span>
            <span className="flex-1 font-bold text-slate-800">{elemento}</span>
            <button type="button" disabled={bloqueada || indice === 0} onClick={() => mover(indice, -1)} aria-label={`Mover ${elemento} arriba`} className="rounded-xl bg-white px-3 py-2 font-black text-slate-700 shadow-sm hover:bg-amber-100 disabled:opacity-40">↑</button>
            <button type="button" disabled={bloqueada || indice === elementos.length - 1} onClick={() => mover(indice, 1)} aria-label={`Mover ${elemento} abajo`} className="rounded-xl bg-white px-3 py-2 font-black text-slate-700 shadow-sm hover:bg-amber-100 disabled:opacity-40">↓</button>
          </li>
        ))}
      </ol>
      {!revisado && <button type="button" onClick={comprobar} className="mt-5 min-h-12 w-full rounded-2xl border-b-4 border-teal-800 bg-teal-700 px-5 py-3 font-black text-white transition hover:bg-teal-600 active:translate-y-1 active:border-b-0">¡Revisar mi orden! 🧭</button>}
    </div>
  );
}

function Relacionar({ pregunta, bloqueada, onResponder }) {
  const [derechas] = useState(() => mezclar(pregunta.pares.map((par) => par.derecha)));
  const [seleccionIzquierda, setSeleccionIzquierda] = useState(null);
  const [resueltas, setResueltas] = useState([]);
  const [errores, setErrores] = useState(0);
  const [aviso, setAviso] = useState("Toca una tarjeta de cada lado para unirlas.");

  function elegirDerecha(derecha) {
    if (bloqueada || !seleccionIzquierda) return;
    const pareja = pregunta.pares.find((par) => par.izquierda === seleccionIzquierda);
    if (pareja?.derecha === derecha) {
      const siguiente = [...resueltas, seleccionIzquierda];
      setResueltas(siguiente);
      setSeleccionIzquierda(null);
      setAviso("¡Pareja encontrada! Sigue buscando. ✨");
      if (siguiente.length === pregunta.pares.length) onResponder(errores === 0);
    } else {
      setErrores((actual) => actual + 1);
      setSeleccionIzquierda(null);
      setAviso("No van juntas. ¡Prueba con otras tarjetas! 💡");
    }
  }

  return (
    <div>
      <p aria-live="polite" className="mb-3 text-sm font-bold text-slate-600">{aviso} Parejas: {resueltas.length}/{pregunta.pares.length}</p>
      <div className="grid grid-cols-2 gap-3 sm:gap-5">
        <div className="space-y-2">
          {pregunta.pares.map((par) => (
            <button key={par.izquierda} type="button" disabled={bloqueada || resueltas.includes(par.izquierda)} onClick={() => setSeleccionIzquierda(par.izquierda)} className={`min-h-16 w-full rounded-2xl border-2 p-3 text-sm font-extrabold transition sm:text-base ${resueltas.includes(par.izquierda) ? "border-emerald-300 bg-emerald-100 text-emerald-900" : seleccionIzquierda === par.izquierda ? "border-amber-400 bg-amber-100 text-amber-950 ring-2 ring-amber-200" : "border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100"}`}>
              {resueltas.includes(par.izquierda) ? "✓ " : ""}{par.izquierda}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {derechas.map((derecha) => {
            const parejaResuelta = pregunta.pares.find((par) => par.derecha === derecha);
            const yaResuelta = resueltas.includes(parejaResuelta?.izquierda);
            return <button key={derecha} type="button" disabled={bloqueada || yaResuelta} onClick={() => elegirDerecha(derecha)} className={`min-h-16 w-full rounded-2xl border-2 p-3 text-sm font-extrabold transition sm:text-base ${yaResuelta ? "border-emerald-300 bg-emerald-100 text-emerald-900" : "border-orange-200 bg-orange-50 text-orange-950 hover:bg-orange-100"}`}>{yaResuelta ? "✓ " : ""}{derecha}</button>;
          })}
        </div>
      </div>
    </div>
  );
}

function Memoria({ pregunta, bloqueada, onResponder }) {
  const [cartas] = useState(() => mezclar(pregunta.pares.flatMap((par, indice) => [
    { pareja: indice, texto: par.izquierda },
    { pareja: indice, texto: par.derecha },
  ])));
  const [abiertas, setAbiertas] = useState([]);
  const [encontradas, setEncontradas] = useState([]);
  const [errores, setErrores] = useState(0);
  const [ocupada, setOcupada] = useState(false);

  function voltear(indice) {
    if (bloqueada || ocupada || abiertas.includes(indice) || encontradas.includes(indice)) return;
    if (abiertas.length === 0) {
      setAbiertas([indice]);
      return;
    }

    const primera = abiertas[0];
    const nuevaPareja = [primera, indice];
    setAbiertas(nuevaPareja);
    setOcupada(true);
    if (cartas[primera].pareja === cartas[indice].pareja) {
      const siguiente = [...encontradas, ...nuevaPareja];
      window.setTimeout(() => {
        setEncontradas(siguiente);
        setAbiertas([]);
        setOcupada(false);
        if (siguiente.length === cartas.length) onResponder(errores === 0);
      }, 450);
    } else {
      setErrores((actual) => actual + 1);
      window.setTimeout(() => {
        setAbiertas([]);
        setOcupada(false);
      }, 850);
    }
  }

  return (
    <div>
      <p aria-live="polite" className="mb-3 text-center text-sm font-bold text-slate-600">Parejas encontradas: {encontradas.length / 2}/{pregunta.pares.length}</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {cartas.map((carta, indice) => {
          const visible = abiertas.includes(indice) || encontradas.includes(indice);
          return <button key={`${carta.pareja}-${indice}`} type="button" disabled={bloqueada || encontradas.includes(indice) || ocupada} onClick={() => voltear(indice)} aria-label={visible ? carta.texto : "Voltear tarjeta"} className={`min-h-20 rounded-2xl border-2 p-2 text-center text-xs font-black transition duration-200 hover:-translate-y-0.5 sm:min-h-24 sm:text-sm ${visible ? "rotate-1 border-emerald-300 bg-emerald-50 text-emerald-950" : "border-teal-300 bg-gradient-to-br from-teal-100 to-sky-100 text-teal-800 shadow-sm hover:bg-amber-100"}`}>
            {visible ? carta.texto : <span className="text-3xl" aria-hidden="true">✦</span>}
          </button>;
        })}
      </div>
    </div>
  );
}

function Completar({ pregunta, bloqueada, onResponder }) {
  const [respuesta, setRespuesta] = useState("");
  const [pistaVisible, setPistaVisible] = useState(false);

  return (
    <form onSubmit={(evento) => {
      evento.preventDefault();
      onResponder(normalizarTexto(respuesta) === normalizarTexto(pregunta.respuesta));
    }} className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-lg font-bold leading-relaxed text-slate-800 sm:text-xl">
        {pregunta.frase.split(/(___+|____+)/g).map((parte, indice) => /___+/.test(parte)
          ? <input key={indice} aria-label="Escribe la palabra que falta" autoComplete="off" value={respuesta} onChange={(evento) => setRespuesta(evento.target.value)} disabled={bloqueada} className="min-h-12 min-w-36 flex-1 rounded-xl border-2 border-teal-300 bg-white px-3 text-center font-black text-teal-900 outline-none focus:ring-4 focus:ring-teal-100 disabled:opacity-70" />
          : <span key={indice}>{parte}</span>)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setPistaVisible((visible) => !visible)} className="rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-2 font-bold text-amber-900 hover:bg-amber-100">{pistaVisible ? "Ocultar pista" : "💡 Necesito una pista"}</button>
        {!bloqueada && <button type="submit" disabled={!respuesta.trim()} className="min-h-12 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-6 py-3 font-black text-white hover:bg-teal-600 disabled:opacity-50">Comprobar palabra ✓</button>}
      </div>
      {pistaVisible && <p className="rounded-xl bg-sky-50 p-4 font-semibold text-sky-900">Pista: {pregunta.pista}</p>}
    </form>
  );
}

function Actividad({ tipo, pregunta, bloqueada, onResponder }) {
  if (tipo === "verdadero_falso") return <VerdaderoFalso pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "ordenar") return <Ordenar pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "relacionar") return <Relacionar pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "memoria") return <Memoria pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "completar") return <Completar pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  return <Quiz pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
}

function respuestaCorrecta(tipo, pregunta) {
  if (tipo === "quiz") return pregunta.opciones?.[pregunta.correcta];
  if (tipo === "verdadero_falso") return `${pregunta.correcta ? "Verdadero" : "Falso"}. ${pregunta.explicacion}`;
  if (tipo === "ordenar") return pregunta.orden_correcto?.join(" → ");
  if (tipo === "completar") return pregunta.respuesta;
  return null;
}

function VisorJuegoContenido({ juego }) {
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [puntuacion, setPuntuacion] = useState(0);
  const preguntas = Array.isArray(juego?.preguntas) ? juego.preguntas : [];
  const tipo = nombresTipo[juego?.tipo_actividad] ? juego.tipo_actividad : "quiz";

  function responder(correcta) {
    if (seleccion !== null) return;
    setSeleccion({ correcta });
    if (correcta) setPuntuacion((actual) => actual + 1);
  }

  function avanzar() {
    setPreguntaActual((actual) => actual + 1);
    setSeleccion(null);
  }

  function reiniciar() {
    setPreguntaActual(0);
    setSeleccion(null);
    setPuntuacion(0);
  }

  if (!preguntas.length) {
    return (
      <section className="w-full max-w-3xl rounded-[2rem] border-4 border-white bg-white/90 p-8 text-center shadow-xl">
        <MascotaMurcielago className="mx-auto mb-3 h-24 w-24" />
        <h1 className="text-2xl font-black text-slate-800">¡Aventura en pausa!</h1>
        <p className="mx-auto mt-2 max-w-lg text-lg font-medium text-slate-600">Este juego llegó sin retos. Vuelve al menú y pídele a tu maestro que lo genere otra vez.</p>
      </section>
    );
  }

  const juegoCompletado = preguntaActual >= preguntas.length;
  if (juegoCompletado) {
    const mensaje = puntuacion === preguntas.length
      ? "¡Increíble, misión perfecta!"
      : puntuacion >= Math.ceil(preguntas.length / 2)
        ? "¡Gran trabajo, sigue explorando!"
        : "¡Buen intento! Cada reto te enseña algo nuevo.";
    return (
      <section aria-live="polite" className="w-full max-w-3xl overflow-hidden rounded-[2rem] border-4 border-white bg-gradient-to-br from-yellow-100 via-white to-pink-100 p-8 text-center shadow-2xl sm:p-12">
        <div className="mx-auto mb-3 flex h-24 w-24 items-center justify-center rounded-full bg-yellow-300 text-6xl shadow-lg">🏆</div>
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-700">¡Misión cumplida!</p>
        <h1 className="mt-2 text-3xl font-black text-slate-800 sm:text-4xl">{mensaje}</h1>
        <p className="mt-5 text-xl font-bold text-slate-700">Lograste <span className="text-3xl font-black text-emerald-600">{puntuacion}</span> de {preguntas.length} estrellas.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">{preguntas.map((_, indice) => <span key={indice} className={`flex h-11 w-11 items-center justify-center rounded-full text-xl ${indice < puntuacion ? "bg-emerald-300" : "bg-slate-200"}`}>{indice < puntuacion ? "⭐" : "✨"}</span>)}</div>
        <button type="button" onClick={reiniciar} className="mt-8 min-h-14 rounded-2xl border-b-4 border-orange-700 bg-gradient-to-r from-orange-300 to-yellow-200 px-8 py-3 text-lg font-black text-orange-950 shadow-lg transition hover:-translate-y-0.5 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200">¡Jugar otra vez! ↻</button>
      </section>
    );
  }

  const pregunta = preguntas[preguntaActual];
  const tituloReto = tipo === "quiz" ? pregunta.pregunta : tipo === "verdadero_falso" ? pregunta.afirmacion : pregunta.consigna ?? pregunta.frase;
  const progreso = ((preguntaActual + (seleccion ? 1 : 0)) / preguntas.length) * 100;

  return (
    <main className="w-full max-w-4xl overflow-hidden rounded-[2rem] border-4 border-white bg-white/95 shadow-2xl">
      <header className="bg-gradient-to-r from-teal-100 via-sky-50 to-lime-100 px-6 py-5 sm:px-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><MascotaMurcielago className="h-14 w-14 drop-shadow" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">{nombresTipo[tipo]}</p><h1 className="text-xl font-black leading-tight text-slate-900 sm:text-2xl">{juego?.titulo || "Aventura de ciencias"}</h1></div></div>
          <div className="rounded-full border-2 border-white/80 bg-white/80 px-4 py-2 font-black text-slate-800 shadow-sm" aria-live="polite">⭐ {puntuacion} puntos</div>
        </div>
        <div className="mt-5 flex items-center gap-3"><span className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-sm font-black text-slate-700">Reto {preguntaActual + 1} / {preguntas.length}</span><div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-white/60" role="progressbar" aria-label="Progreso de la actividad" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-300 transition-all duration-500" style={{ width: `${progreso}%` }} /></div></div>
      </header>

      <section className="p-6 sm:p-9">
        {juego?.instrucciones && <p className="mb-6 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4 text-base font-semibold leading-relaxed text-slate-700"><span className="mr-2" aria-hidden="true">💡</span>{juego.instrucciones}</p>}
        {tipo !== "completar" && <><p className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-teal-800">Piensa, prueba y descubre</p><h2 className="mb-6 text-2xl font-black leading-snug text-slate-800 sm:text-3xl">{tituloReto}</h2></>}

        <Actividad key={`${tipo}-${preguntaActual}`} tipo={tipo} pregunta={pregunta} bloqueada={Boolean(seleccion)} onResponder={responder} />

        {seleccion && (
          <div aria-live="polite" className={`mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl px-5 py-4 sm:flex-row ${seleccion.correcta ? "bg-emerald-50" : "bg-rose-50"}`}>
            <div>
              <p className={`text-lg font-black ${seleccion.correcta ? "text-emerald-700" : "text-rose-700"}`}>{seleccion.correcta ? "¡Lo descubriste! 🎉" : "¡Casi! Aprender también es intentarlo. 💪"}</p>
              {!seleccion.correcta && respuestaCorrecta(tipo, pregunta) && <p className="mt-1 text-sm font-semibold text-slate-700">Respuesta: {respuestaCorrecta(tipo, pregunta)}</p>}
            </div>
            <button type="button" onClick={avanzar} className="min-h-12 w-full rounded-xl border-b-4 border-teal-800 bg-teal-700 px-6 py-3 font-black text-white shadow-md transition hover:bg-teal-600 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 sm:w-auto">{preguntaActual === preguntas.length - 1 ? "Ver mis estrellas 🏆" : "Siguiente reto →"}</button>
          </div>
        )}
      </section>
    </main>
  );
}

export default function VisorJuego({ juego }) {
  return <VisorJuegoContenido key={JSON.stringify(juego ?? null)} juego={juego} />;
}
