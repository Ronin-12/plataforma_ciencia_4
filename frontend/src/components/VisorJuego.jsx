import { useEffect, useRef, useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";
import LogrosNuevos from "./LogrosNuevos";
import { motion, useReducedMotion } from "framer-motion";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";
import { detenerLectura, leerEnVozAlta, textoParaLeer, vozDisponible } from "../lib/voz";
import { sonarFinal, sonarRespuesta } from "../lib/sonidos";
import { mezclar } from "../lib/azar";
import { Clasificar, LineaTiempo } from "./JuegosColocar";

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
  clasificar: "Clasifica y agrupa",
  linea_tiempo: "Línea del tiempo",
};

// En un quiz las opciones se reparten al azar para que la correcta no quede siempre en el mismo lugar.
// Se mezcla ANTES de mostrar la pregunta, así la pantalla, la voz y la corrección usan el mismo orden.
function prepararPregunta(tipo, pregunta) {
  if (tipo !== "quiz" || !Array.isArray(pregunta.opciones)) return pregunta;
  const opciones = mezclar(pregunta.opciones.map((texto, indice) => ({ texto, correcta: indice === pregunta.correcta })));
  return { ...pregunta, opciones: opciones.map((o) => o.texto), correcta: opciones.findIndex((o) => o.correcta) };
}

function prepararRonda(tipo, preguntas, esRepaso = false) {
  return { preguntas: preguntas.map((pregunta) => prepararPregunta(tipo, pregunta)), esRepaso };
}

function Confeti() {
  const reducirMovimiento = useReducedMotion();
  const [piezas] = useState(() => Array.from({ length: 26 }, (_, indice) => ({
    id: indice,
    izquierda: Math.random() * 100,
    retraso: Math.random() * 0.6,
    duracion: 2.2 + Math.random() * 1.6,
    giro: 240 + Math.random() * 480,
    color: ["#f59e0b", "#14b8a6", "#f472b6", "#38bdf8", "#a78bfa", "#facc15"][indice % 6],
    forma: indice % 3 === 0 ? "rounded-full" : "rounded-sm",
  })));
  if (reducirMovimiento) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {piezas.map((pieza) => (
        <motion.span key={pieza.id} className={`absolute top-0 block h-3 w-2 ${pieza.forma}`} style={{ left: `${pieza.izquierda}%`, backgroundColor: pieza.color }}
          initial={{ y: -30, opacity: 1, rotate: 0 }} animate={{ y: 520, opacity: [1, 1, 0], rotate: pieza.giro }} transition={{ duration: pieza.duracion, delay: pieza.retraso, ease: "easeIn" }} />
      ))}
    </div>
  );
}

function BotonEscuchar({ texto, etiqueta = "Escuchar", className = "" }) {
  const [leyendo, setLeyendo] = useState(false);
  if (!vozDisponible()) return null;
  function alternar() {
    if (leyendo) { detenerLectura(); setLeyendo(false); return; }
    setLeyendo(true);
    leerEnVozAlta(texto, { alTerminar: () => setLeyendo(false) });
  }
  return (
    <button type="button" onClick={alternar} aria-pressed={leyendo} aria-label={leyendo ? "Detener la lectura" : `${etiqueta} en voz alta`}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-sky-200 bg-sky-50 px-4 font-bold text-sky-900 transition hover:bg-sky-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-200 ${className}`}>
      <Volume2 size={18} aria-hidden="true" />{leyendo ? "Detener" : etiqueta}
    </button>
  );
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
      <button type="button" disabled={bloqueada} onClick={() => onResponder(pregunta.correcta === true)} className="min-h-32 rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 text-2xl font-black text-emerald-900 shadow-sm transition hover:-translate-y-1 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-70 xl:min-h-40 xl:text-3xl">
        <span className="mb-2 block text-5xl" aria-hidden="true">🌱</span>¡Es verdad!
      </button>
      <button type="button" disabled={bloqueada} onClick={() => onResponder(pregunta.correcta === false)} className="min-h-32 rounded-3xl border-2 border-rose-200 bg-rose-50 p-6 text-2xl font-black text-rose-900 shadow-sm transition hover:-translate-y-1 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:opacity-70 xl:min-h-40 xl:text-3xl">
        <span className="mb-2 block text-5xl" aria-hidden="true">🍂</span>¡No es verdad!
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
  if (tipo === "clasificar") return <Clasificar pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "linea_tiempo") return <LineaTiempo pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  if (tipo === "completar") return <Completar pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
  return <Quiz pregunta={pregunta} bloqueada={bloqueada} onResponder={onResponder} />;
}

function respuestaCorrecta(tipo, pregunta) {
  if (tipo === "quiz") return pregunta.opciones?.[pregunta.correcta];
  if (tipo === "verdadero_falso") return pregunta.correcta ? "Era verdadero." : "Era falso.";
  if (tipo === "ordenar") return pregunta.orden_correcto?.join(" → ");
  if (tipo === "completar") return pregunta.respuesta;
  if (tipo === "clasificar") return pregunta.categorias?.map((categoria) => `${categoria}: ${pregunta.elementos.filter((e) => e.categoria.trim().toLowerCase() === categoria.trim().toLowerCase()).map((e) => e.texto).join(", ")}`).join(" · ");
  if (tipo === "linea_tiempo") return pregunta.eventos?.map((evento) => `${evento.etiqueta}: ${evento.texto}`).join(" → ");
  if (tipo === "relacionar" || tipo === "memoria") return pregunta.pares?.map((par) => `${par.izquierda} → ${par.derecha}`).join(" · ");
  return null;
}

function tituloDeReto(tipo, pregunta) {
  if (tipo === "quiz") return pregunta.pregunta;
  if (tipo === "verdadero_falso") return pregunta.afirmacion;
  if (tipo === "completar") return pregunta.frase?.replace(/_{2,}/g, "____");
  return pregunta.consigna ?? pregunta.frase;
}

function VisorJuegoContenido({ juego, nombreAlumno, avatarAlumno, onTerminar, onReiniciar, onVolverMenu, estadoResultado, logrosNuevos, sonidoActivo, enPantallaCompleta }) {
  const tipo = nombresTipo[juego?.tipo_actividad] ? juego.tipo_actividad : "quiz";
  const [ronda, setRonda] = useState(() => prepararRonda(tipo, Array.isArray(juego?.preguntas) ? juego.preguntas : []));
  const [preguntaActual, setPreguntaActual] = useState(0);
  const [seleccion, setSeleccion] = useState(null);
  const [puntuacion, setPuntuacion] = useState(0);
  const [falladas, setFalladas] = useState([]); // retos de esta ronda que se respondieron mal
  const [racha, setRacha] = useState(0);
  const reducirMovimiento = useReducedMotion();
  const inicio = useRef(null); // momento en que empezó el juego (se fija al montar)
  const avisado = useRef(false);
  const preguntas = ronda.preguntas;
  const esRepaso = ronda.esRepaso;
  const completado = preguntas.length > 0 && preguntaActual >= preguntas.length;

  useEffect(() => {
    inicio.current = Date.now();
  }, []);

  // Al terminar el juego se avisa UNA vez con el porcentaje de aciertos y los segundos usados.
  // El repaso NO se guarda: la calificación es la del primer intento.
  useEffect(() => {
    if (!completado || avisado.current || esRepaso) return;
    avisado.current = true;
    onTerminar?.({
      puntuacion: Math.round((puntuacion / preguntas.length) * 100),
      aciertos: puntuacion,
      total: preguntas.length,
      segundos: Math.min(7200, Math.round((Date.now() - (inicio.current ?? Date.now())) / 1000)),
    });
  }, [completado, esRepaso, puntuacion, preguntas.length, onTerminar]);

  // Sonido de fin de juego y silencio de la voz al cambiar de reto o salir.
  useEffect(() => {
    if (completado && sonidoActivo) sonarFinal(Math.round((puntuacion / preguntas.length) * 100));
    // Solo al terminar: no queremos que cambiar el sonido repita la melodía.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completado]);
  useEffect(() => () => detenerLectura(), [preguntaActual, completado]);

  function responder(correcta) {
    if (seleccion !== null) return;
    setSeleccion({ correcta });
    if (correcta) {
      setPuntuacion((actual) => actual + 1);
      setRacha((actual) => actual + 1);
    } else {
      setFalladas((actuales) => [...actuales, preguntas[preguntaActual]]);
      setRacha(0);
    }
    if (sonidoActivo) sonarRespuesta(correcta);
  }

  function avanzar() {
    setPreguntaActual((actual) => actual + 1);
    setSeleccion(null);
  }

  function empezarRonda(nuevaRonda) {
    setRonda(nuevaRonda);
    setPreguntaActual(0);
    setSeleccion(null);
    setPuntuacion(0);
    setFalladas([]);
    setRacha(0);
    inicio.current = Date.now();
  }

  // «Volver a jugar»: el juego completo desde cero (se vuelve a guardar un nuevo resultado).
  function reiniciar() {
    empezarRonda(prepararRonda(tipo, Array.isArray(juego?.preguntas) ? juego.preguntas : []));
    avisado.current = false;
    onReiniciar?.();
  }

  // «Repasar»: solo los retos que se fallaron. No cambia la calificación guardada.
  function repasar() {
    empezarRonda(prepararRonda(tipo, falladas, true));
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
    const mensaje = esRepaso
      ? puntuacion === preguntas.length ? "¡Repaso logrado! Ya lo dominas." : "¡Buen repaso! Cada intento te acerca."
      : puntuacion === preguntas.length
        ? "¡Increíble, misión perfecta!"
        : puntuacion >= Math.ceil(preguntas.length / 2)
          ? "¡Gran trabajo, sigue explorando!"
          : "¡Buen intento! Cada reto te enseña algo nuevo.";
    const porcentaje = Math.round((puntuacion / preguntas.length) * 100);
    return (
      <section aria-live="polite" className={`w-full ${enPantallaCompleta ? "min-h-[calc(100vh-7rem)] max-w-[1600px]" : "max-w-6xl"} overflow-hidden rounded-[2rem] border border-white/90 bg-white shadow-[0_28px_80px_-32px_rgba(41,67,84,.4)]`}>
        <div className="grid h-full lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-amber-100 via-rose-50 to-sky-100 px-7 py-9 text-center sm:px-10 lg:px-12">
            {puntuacion === preguntas.length && <Confeti />}
            <span aria-hidden="true" className="absolute -right-4 top-4 rotate-12 text-7xl text-amber-400/40">✦</span>
            <span aria-hidden="true" className="absolute -bottom-8 -left-4 -rotate-12 text-8xl text-teal-500/15">✦</span>
            <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border-4 border-white bg-amber-300 text-6xl shadow-lg sm:h-28 sm:w-28 sm:text-7xl">🏆</div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-teal-800">{esRepaso ? "Repaso de retos" : "Bitácora de aprendizaje"}</p>
            <p className="mt-2 text-sm font-bold text-slate-600">{nombreAlumno ? `Exploración de ${nombreAlumno}` : "Exploración terminada"}</p>
            <h1 className="mt-4 text-3xl font-black leading-tight text-slate-900 sm:text-4xl">{mensaje}</h1>
            <p className="mt-4 max-w-md text-base font-medium leading-relaxed text-slate-700 sm:text-lg">Cada respuesta te ayuda a comprender un poco más el mundo natural.</p>
          </div>

          <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-10 xl:px-14">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-800">{esRepaso ? "Tu repaso" : "Tu resultado"}</p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">{puntuacion}<span className="text-3xl text-slate-400 sm:text-4xl">/{preguntas.length}</span></span>
              <span className="text-base font-bold text-slate-600 sm:text-lg">respuestas correctas</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2" aria-label={`${puntuacion} de ${preguntas.length} estrellas`}>
              {preguntas.map((_, indice) => <span key={indice} className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-sm sm:h-12 sm:w-12 ${indice < puntuacion ? "bg-amber-200" : "bg-slate-100"}`}>{indice < puntuacion ? "⭐" : "☆"}</span>)}
            </div>
            <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label="Resultado de la actividad" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-700" style={{ width: `${porcentaje}%` }} />
            </div>
            <p className="mt-2 text-sm font-bold text-slate-600">{porcentaje}% de respuestas correctas</p>
            {esRepaso && <p role="status" className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900">El repaso es para practicar: no cambia tu calificación.</p>}
            {!esRepaso && estadoResultado === "guardando" && <p role="status" className="mt-5 rounded-xl bg-sky-50 px-4 py-3 text-sm font-bold text-sky-900">Guardando tu resultado…</p>}
            {!esRepaso && estadoResultado === "ok" && <p role="status" className="mt-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">✓ Tu resultado quedó guardado.</p>}
            {!esRepaso && estadoResultado === "ok" && <LogrosNuevos insignias={logrosNuevos} />}
            {!esRepaso && estadoResultado === "error" && <p role="alert" className="mt-5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">No pudimos guardar tu resultado. Avísale a tu maestro.</p>}
            {falladas.length > 0 && (
              <div className="mt-6 rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-4">
                <p className="text-sm font-black uppercase tracking-[0.14em] text-amber-900">Para repasar ({falladas.length})</p>
                <ul className="mt-3 space-y-3">
                  {falladas.map((reto, indice) => (
                    <li key={indice} className="text-sm leading-relaxed text-slate-800">
                      <p className="font-extrabold">{tituloDeReto(tipo, reto)}</p>
                      {respuestaCorrecta(tipo, reto) && <p className="font-semibold text-emerald-800">✓ {respuestaCorrecta(tipo, reto)}</p>}
                      {reto.explicacion?.trim() && <p className="text-slate-600">{reto.explicacion}</p>}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={repasar} className="mt-4 min-h-12 w-full rounded-xl border-b-4 border-teal-800 bg-teal-700 px-5 py-3 font-black text-white shadow-md transition hover:bg-teal-600 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
                  Repasar lo que fallé ({falladas.length}) <span aria-hidden="true">🔁</span>
                </button>
              </div>
            )}
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={reiniciar} className="min-h-14 rounded-2xl border-b-4 border-amber-700 bg-amber-300 px-5 py-3 text-base font-black text-amber-950 shadow-md transition hover:bg-amber-200 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">Volver a jugar <span aria-hidden="true">↻</span></button>
              {onVolverMenu && <button type="button" onClick={onVolverMenu} className="min-h-14 rounded-2xl border-2 border-slate-200 bg-white px-5 py-3 text-base font-black text-slate-800 transition hover:border-teal-300 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">Volver a misiones</button>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const pregunta = preguntas[preguntaActual];
  const tituloReto = tituloDeReto(tipo, pregunta);
  const explicacion = typeof pregunta.explicacion === "string" ? pregunta.explicacion.trim() : "";
  const progreso = ((preguntaActual + (seleccion ? 1 : 0)) / preguntas.length) * 100;

  return (
    <main className={`w-full ${enPantallaCompleta ? "min-h-[calc(100vh-7rem)] max-w-[1600px]" : "max-w-6xl"} overflow-hidden rounded-[2rem] border border-white/90 bg-white/95 shadow-[0_28px_80px_-32px_rgba(41,67,84,.4)]`}>
      <header className="bg-gradient-to-r from-teal-100 via-sky-50 to-amber-100 px-6 py-5 sm:px-9 xl:px-12 xl:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><MascotaMurcielago className="h-14 w-14 drop-shadow sm:h-16 sm:w-16" /><div><p className="text-xs font-black uppercase tracking-[0.18em] text-teal-800">{esRepaso ? `Repaso · ${nombresTipo[tipo]}` : nombresTipo[tipo]}</p><h1 className="text-2xl font-black leading-tight text-slate-900 sm:text-3xl">{juego?.titulo || "Actividad"}</h1></div></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {nombreAlumno && <div className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white bg-white/75 py-1 pl-1.5 pr-4 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-teal-100 text-sm font-black text-teal-900">
                {avatarAlumno ? <img src={avatarAlumno} alt="" className="h-full w-full object-cover" /> : nombreAlumno.trim().slice(0, 1).toLocaleUpperCase("es")}
              </span>
              <span className="text-sm font-bold text-slate-700">Explorador: {nombreAlumno}</span>
            </div>}
            {racha >= 2 && (
              <motion.div key={racha} initial={reducirMovimiento ? false : { scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 380, damping: 14 }} className="rounded-2xl border border-orange-200 bg-orange-100 px-4 py-3 font-black text-orange-900 shadow-sm">
                <span aria-hidden="true">🔥</span> Racha de {racha}
              </motion.div>
            )}
            <div className="rounded-2xl border border-white/80 bg-white/80 px-4 py-3 font-black text-slate-800 shadow-sm" aria-live="polite">⭐ {puntuacion} puntos</div>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3 xl:mt-7"><span className="shrink-0 rounded-full bg-white/85 px-4 py-2 text-sm font-black text-slate-700 sm:text-base">Reto {preguntaActual + 1} de {preguntas.length}</span><div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-white bg-white/60" role="progressbar" aria-label="Progreso de la actividad" aria-valuenow={Math.round(progreso)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-300 transition-all duration-500" style={{ width: `${progreso}%` }} /></div></div>
      </header>

      <section className="p-6 sm:p-9 xl:p-12">
        {juego?.instrucciones && <p className="mb-7 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-base font-semibold leading-relaxed text-slate-700 sm:text-lg xl:px-7 xl:py-5"><span className="mr-2" aria-hidden="true">💡</span>{juego.instrucciones}</p>}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-800">{tipo === "completar" ? "Escribe la palabra que falta" : "Observa, conversa y decide"}</p>
          <BotonEscuchar texto={textoParaLeer(tipo, pregunta, tituloReto)} etiqueta="Escuchar el reto" />
        </div>
        {tipo !== "completar" && <h2 className="mb-7 max-w-5xl text-3xl font-black leading-tight text-slate-900 sm:text-4xl xl:text-[2.75rem]">{tituloReto}</h2>}

        <Actividad key={`${tipo}-${preguntaActual}`} tipo={tipo} pregunta={pregunta} bloqueada={Boolean(seleccion)} onResponder={responder} />

        {seleccion && (
          <motion.div
            key={`${preguntaActual}-${seleccion.correcta}`}
            aria-live="polite"
            initial={reducirMovimiento ? false : seleccion.correcta ? { opacity: 0, y: 14, scale: 0.97 } : { opacity: 0, x: -10 }}
            animate={reducirMovimiento ? { opacity: 1 } : seleccion.correcta ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, x: [0, -8, 8, -5, 5, 0] }}
            transition={seleccion.correcta ? { type: "spring", stiffness: 300, damping: 18 } : { duration: 0.45 }}
            className={`mt-6 rounded-2xl border-2 px-5 py-4 ${seleccion.correcta ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}
          >
            <p className={`text-lg font-black ${seleccion.correcta ? "text-emerald-700" : "text-rose-700"}`}>
              {seleccion.correcta ? (racha >= 3 ? `¡Lo descubriste! Racha de ${racha} 🔥` : "¡Lo descubriste! 🎉") : "¡Casi! Aprender también es intentarlo. 💪"}
            </p>
            {!seleccion.correcta && respuestaCorrecta(tipo, pregunta) && <p className="mt-1 text-sm font-semibold text-slate-700">Respuesta: {respuestaCorrecta(tipo, pregunta)}</p>}
            {explicacion && (
              <div className="mt-3 rounded-xl border border-white bg-white/80 p-3 text-slate-800">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-800">¿Por qué?</p>
                <p className="mt-1 text-base font-semibold leading-relaxed">{explicacion}</p>
              </div>
            )}
            <div className="mt-4 flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              {explicacion ? <BotonEscuchar texto={explicacion} etiqueta="Escuchar la explicación" /> : <span />}
              <button type="button" onClick={avanzar} className="min-h-14 w-full rounded-xl border-b-4 border-teal-800 bg-teal-700 px-7 py-3 text-lg font-black text-white shadow-md transition hover:bg-teal-600 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 sm:w-auto">{preguntaActual === preguntas.length - 1 ? (esRepaso ? "Ver mi repaso" : "Ver mi resultado") : "Siguiente reto →"}</button>
            </div>
          </motion.div>
        )}
      </section>
    </main>
  );
}

// onTerminar / onReiniciar / estadoResultado son opcionales: sin ellos (vista previa del docente)
// el juego funciona igual, pero no se guarda nada.
export default function VisorJuego({ juego, nombreAlumno, avatarAlumno, onTerminar, onReiniciar, onVolverMenu, estadoResultado, logrosNuevos }) {
  const contenedorRef = useRef(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [sonidoActivo, setSonidoActivo] = useState(() => {
    try { return localStorage.getItem("murcielago-sonido") === "on"; } catch { return false; }
  });

  useEffect(() => {
    function sincronizar() { setPantallaCompleta(document.fullscreenElement === contenedorRef.current); }
    document.addEventListener("fullscreenchange", sincronizar);
    return () => document.removeEventListener("fullscreenchange", sincronizar);
  }, []);

  async function cambiarPantallaCompleta() {
    if (!contenedorRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await contenedorRef.current.requestFullscreen();
    } catch { /* Puede estar restringido por el navegador o el proyector. */ }
  }

  function cambiarSonido() {
    setSonidoActivo((actual) => {
      const nuevo = !actual;
      try { localStorage.setItem("murcielago-sonido", nuevo ? "on" : "off"); } catch { /* Preferencia opcional. */ }
      return nuevo;
    });
  }

  return (
    <div ref={contenedorRef} className={`relative w-full ${pantallaCompleta ? "min-h-screen overflow-y-auto bg-[radial-gradient(ellipse_at_top_left,rgba(153,246,228,.6),transparent_42%),radial-gradient(ellipse_at_bottom_right,rgba(253,230,138,.55),transparent_40%),linear-gradient(135deg,#f0fdfa,#f8fafc_48%,#fff7ed)] p-4 sm:p-7" : ""}`}>
      <div className={`relative z-20 mb-3 flex justify-end gap-2 ${pantallaCompleta ? "mx-auto max-w-[1600px]" : ""}`}>
        <button type="button" onClick={cambiarSonido} aria-pressed={sonidoActivo} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-white bg-white/90 px-4 font-bold text-slate-800 shadow-md hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200" aria-label={sonidoActivo ? "Silenciar sonidos" : "Activar sonidos suaves"}>
          {sonidoActivo ? <Volume2 size={19} /> : <VolumeX size={19} />}{sonidoActivo ? "Sonido activado" : "Sonido apagado"}
        </button>
        <button type="button" onClick={cambiarPantallaCompleta} className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-white bg-white/90 px-4 font-bold text-slate-800 shadow-md hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
          {pantallaCompleta ? <Minimize2 size={19} /> : <Maximize2 size={19} />}{pantallaCompleta ? "Salir de pantalla completa" : "Proyectar en pantalla completa"}
        </button>
      </div>
      <div className={pantallaCompleta ? "flex min-h-[calc(100vh-5rem)] items-center justify-center" : ""}>
        <VisorJuegoContenido key={JSON.stringify(juego ?? null)} juego={juego} nombreAlumno={nombreAlumno} avatarAlumno={avatarAlumno} sonidoActivo={sonidoActivo} enPantallaCompleta={pantallaCompleta} onTerminar={onTerminar} onReiniciar={onReiniciar} onVolverMenu={onVolverMenu} estadoResultado={estadoResultado} logrosNuevos={logrosNuevos} />
      </div>
    </div>
  );
}
