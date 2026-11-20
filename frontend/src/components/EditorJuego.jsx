import { useState } from "react";
import { ESQUEMAS } from "../lib/esquemas";

// Formulario para corregir un juego generado por la IA. Edita una copia: nada se guarda hasta
// pulsar «Guardar cambios». El servidor vuelve a validar todo (mismas reglas que la IA).
const campo = "w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100";
const etiqueta = "mb-1 block text-xs font-black uppercase tracking-wide text-slate-600";

function Texto({ etiquetaTexto, valor, onCambio, largo = false }) {
  const Control = largo ? "textarea" : "input";
  return (
    <label className="block">
      <span className={etiqueta}>{etiquetaTexto}</span>
      <Control value={valor ?? ""} onChange={(e) => onCambio(e.target.value)} className={campo} {...(largo ? { rows: 2 } : {})} />
    </label>
  );
}

// Lo que el alumno lee después de responder. Es opcional en todos los tipos menos verdadero/falso.
function Explicacion({ p, cambiar }) {
  return <Texto etiquetaTexto="Explicación para el alumno (opcional)" valor={p.explicacion} onCambio={(v) => cambiar({ explicacion: v })} largo />;
}

function PreguntaQuiz({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Pregunta" valor={p.pregunta} onCambio={(v) => cambiar({ pregunta: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Opciones (marca la correcta)</legend>
        {p.opciones.map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`correcta-${p.__id}`} checked={p.correcta === i} onChange={() => cambiar({ correcta: i })} aria-label={`Opción ${i + 1} es la correcta`} className="h-5 w-5 accent-teal-600" />
            <input value={op} onChange={(e) => cambiar({ opciones: p.opciones.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Opción ${i + 1}`} className={campo} />
          </div>
        ))}
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaVF({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Afirmación" valor={p.afirmacion} onCambio={(v) => cambiar({ afirmacion: v })} />
      <label className="flex items-center gap-2 font-bold text-slate-800">
        <input type="checkbox" checked={!!p.correcta} onChange={(e) => cambiar({ correcta: e.target.checked })} className="h-5 w-5 accent-teal-600" />
        La afirmación es verdadera
      </label>
      <Texto etiquetaTexto="Explicación" valor={p.explicacion} onCambio={(v) => cambiar({ explicacion: v })} largo />
    </>
  );
}

function PreguntaOrdenar({ p, cambiar }) {
  // El orden correcto es la fuente de verdad; «elementos» se rellena igual al guardar.
  const pasos = p.orden_correcto;
  const poner = (nuevos) => cambiar({ orden_correcto: nuevos, elementos: [...nuevos] });
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Pasos en el orden correcto</legend>
        {pasos.map((paso, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-6 text-center font-black text-slate-500">{i + 1}</span>
            <input value={paso} onChange={(e) => poner(pasos.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Paso ${i + 1}`} className={campo} />
          </div>
        ))}
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaPares({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Parejas</legend>
        {p.pares.map((par, i) => (
          <div key={i} className="grid grid-cols-2 gap-2">
            <input value={par.izquierda} onChange={(e) => cambiar({ pares: p.pares.map((x, j) => (j === i ? { ...x, izquierda: e.target.value } : x)) })} aria-label={`Pareja ${i + 1}, izquierda`} className={campo} />
            <input value={par.derecha} onChange={(e) => cambiar({ pares: p.pares.map((x, j) => (j === i ? { ...x, derecha: e.target.value } : x)) })} aria-label={`Pareja ${i + 1}, derecha`} className={campo} />
          </div>
        ))}
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaCompletar({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Frase (usa ___ para el espacio vacío)" valor={p.frase} onCambio={(v) => cambiar({ frase: v })} />
      <Texto etiquetaTexto="Respuesta" valor={p.respuesta} onCambio={(v) => cambiar({ respuesta: v })} />
      <Texto etiquetaTexto="Pista" valor={p.pista} onCambio={(v) => cambiar({ pista: v })} />
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

const botonChico = "min-h-10 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200";

function PreguntaClasificar({ p, cambiar }) {
  const { categorias, elementos } = p;
  // Al renombrar una categoría, sus elementos se van con ella.
  const renombrar = (indice, nombre) => cambiar({
    categorias: categorias.map((c, i) => (i === indice ? nombre : c)),
    elementos: elementos.map((e) => (e.categoria === categorias[indice] ? { ...e, categoria: nombre } : e)),
  });
  const quitarCategoria = (indice) => cambiar({
    categorias: categorias.filter((_, i) => i !== indice),
    elementos: elementos.map((e) => (e.categoria === categorias[indice] ? { ...e, categoria: categorias.find((_, i) => i !== indice) } : e)),
  });
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Cajas (2 o 3 categorías)</legend>
        {categorias.map((categoria, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={categoria} onChange={(e) => renombrar(i, e.target.value)} aria-label={`Categoría ${i + 1}`} className={campo} />
            {categorias.length > 2 && <button type="button" onClick={() => quitarCategoria(i)} aria-label={`Quitar la categoría ${i + 1}`} className={botonChico}>Quitar</button>}
          </div>
        ))}
        {categorias.length < 3 && <button type="button" onClick={() => cambiar({ categorias: [...categorias, `Categoría ${categorias.length + 1}`] })} className={botonChico}>+ Agregar categoría</button>}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Tarjetas (4 a 8) y la caja donde van</legend>
        {elementos.map((el, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <input value={el.texto} onChange={(e) => cambiar({ elementos: elementos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} aria-label={`Tarjeta ${i + 1}`} className={campo} />
            <select value={el.categoria} onChange={(e) => cambiar({ elementos: elementos.map((x, j) => (j === i ? { ...x, categoria: e.target.value } : x)) })} aria-label={`Caja de la tarjeta ${i + 1}`} className={campo}>
              {categorias.map((c, k) => <option key={k} value={c}>{c}</option>)}
            </select>
            <button type="button" disabled={elementos.length <= 4} onClick={() => cambiar({ elementos: elementos.filter((_, j) => j !== i) })} aria-label={`Quitar la tarjeta ${i + 1}`} className={botonChico}>Quitar</button>
          </div>
        ))}
        <button type="button" disabled={elementos.length >= 8} onClick={() => cambiar({ elementos: [...elementos, { texto: "", categoria: categorias[0] }] })} className={botonChico}>+ Agregar tarjeta</button>
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaLineaTiempo({ p, cambiar }) {
  const { eventos } = p;
  const poner = (indice, cambios) => cambiar({ eventos: eventos.map((x, j) => (j === indice ? { ...x, ...cambios } : x)) });
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Sucesos en el orden correcto (3 a 6)</legend>
        {eventos.map((ev, i) => (
          <div key={i} className="grid grid-cols-[7rem_1fr_auto] items-center gap-2">
            <input value={ev.etiqueta} onChange={(e) => poner(i, { etiqueta: e.target.value })} aria-label={`Momento ${i + 1} (año o etapa)`} placeholder="Año o etapa" className={campo} />
            <input value={ev.texto} onChange={(e) => poner(i, { texto: e.target.value })} aria-label={`Suceso ${i + 1}`} placeholder="Qué pasó" className={campo} />
            <button type="button" disabled={eventos.length <= 3} onClick={() => cambiar({ eventos: eventos.filter((_, j) => j !== i) })} aria-label={`Quitar el suceso ${i + 1}`} className={botonChico}>Quitar</button>
          </div>
        ))}
        <button type="button" disabled={eventos.length >= 6} onClick={() => cambiar({ eventos: [...eventos, { etiqueta: "", texto: "" }] })} className={botonChico}>+ Agregar suceso</button>
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaHipotesis({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Escenario o experimento" valor={p.escenario} onCambio={(v) => cambiar({ escenario: v })} largo />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Predicciones (marca la que sí pasa)</legend>
        {p.opciones.map((op, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`correcta-${p.__id}`} checked={p.correcta === i} onChange={() => cambiar({ correcta: i })} aria-label={`Predicción ${i + 1} es la correcta`} className="h-5 w-5 accent-teal-600" />
            <input value={op} onChange={(e) => cambiar({ opciones: p.opciones.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Predicción ${i + 1}`} className={campo} />
            <button type="button" disabled={p.opciones.length <= 2} onClick={() => cambiar({ opciones: p.opciones.filter((_, j) => j !== i), correcta: p.correcta === i ? 0 : p.correcta > i ? p.correcta - 1 : p.correcta })} aria-label={`Quitar la predicción ${i + 1}`} className={botonChico}>Quitar</button>
          </div>
        ))}
        <button type="button" disabled={p.opciones.length >= 4} onClick={() => cambiar({ opciones: [...p.opciones, ""] })} className={botonChico}>+ Agregar predicción</button>
      </fieldset>
      <Texto etiquetaTexto="Lo que pasa de verdad (se muestra al elegir)" valor={p.resultado} onCambio={(v) => cambiar({ resultado: v })} largo />
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaEtiquetar({ p, cambiar }) {
  const esquema = ESQUEMAS[p.esquema] ?? ESQUEMAS.planta;
  const maximo = Object.keys(esquema.puntos).length;
  const poner = (indice, cambios) => cambiar({ puntos: p.puntos.map((x, j) => (j === indice ? { ...x, ...cambios } : x)) });
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <label className="block">
        <span className={etiqueta}>Esquema</span>
        <select value={p.esquema} onChange={(e) => cambiar({ esquema: e.target.value, puntos: p.puntos.filter((x) => x.numero <= Object.keys(ESQUEMAS[e.target.value].puntos).length) })} className={campo}>
          {Object.entries(ESQUEMAS).map(([id, es]) => <option key={id} value={id}>{es.nombre}</option>)}
        </select>
      </label>
      <div className="mx-auto aspect-square w-48">
        <svg viewBox="0 0 100 100" role="img" aria-label={`Vista previa del esquema ${esquema.nombre}`} className="h-full w-full rounded-2xl border-2 border-slate-200">
          {esquema.dibujo}
          {Object.entries(esquema.puntos).map(([n, [x, y]]) => (
            <g key={n}><circle cx={x} cy={y} r="5.5" fill="#1e293b" /><text x={x} y={y + 2} textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff">{n}</text></g>
          ))}
        </svg>
      </div>
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Partes a etiquetar (3 a 5): número del punto y su nombre</legend>
        {p.puntos.map((pt, i) => (
          <div key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2">
            <select value={pt.numero} onChange={(e) => poner(i, { numero: Number(e.target.value) })} aria-label={`Número del punto ${i + 1}`} className={campo}>
              {Array.from({ length: maximo }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <input value={pt.texto} onChange={(e) => poner(i, { texto: e.target.value })} aria-label={`Nombre de la parte ${i + 1}`} placeholder="Nombre de la parte" className={campo} />
            <button type="button" disabled={p.puntos.length <= 3} onClick={() => cambiar({ puntos: p.puntos.filter((_, j) => j !== i) })} aria-label={`Quitar la parte ${i + 1}`} className={botonChico}>Quitar</button>
          </div>
        ))}
        <button type="button" disabled={p.puntos.length >= Math.min(5, maximo)} onClick={() => cambiar({ puntos: [...p.puntos, { numero: Array.from({ length: maximo }, (_, k) => k + 1).find((n) => !p.puntos.some((x) => x.numero === n)) ?? 1, texto: "" }] })} className={botonChico}>+ Agregar parte</button>
      </fieldset>
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

function PreguntaDetective({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Consigna" valor={p.consigna} onCambio={(v) => cambiar({ consigna: v })} />
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Oraciones (4 a 6). Marca la que tiene el error</legend>
        {p.oraciones.map((oracion, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`error-${p.__id}`} checked={p.error === i} onChange={() => cambiar({ error: i })} aria-label={`La oración ${i + 1} tiene el error`} className="h-5 w-5 accent-rose-600" />
            <input value={oracion} onChange={(e) => cambiar({ oraciones: p.oraciones.map((x, j) => (j === i ? e.target.value : x)) })} aria-label={`Oración ${i + 1}`} className={campo} />
            <button type="button" disabled={p.oraciones.length <= 4} onClick={() => cambiar({ oraciones: p.oraciones.filter((_, j) => j !== i), error: p.error === i ? 0 : p.error > i ? p.error - 1 : p.error })} aria-label={`Quitar la oración ${i + 1}`} className={botonChico}>Quitar</button>
          </div>
        ))}
        <button type="button" disabled={p.oraciones.length >= 6} onClick={() => cambiar({ oraciones: [...p.oraciones, ""] })} className={botonChico}>+ Agregar oración</button>
      </fieldset>
      <Texto etiquetaTexto="Cómo debía decir la oración con error" valor={p.correccion} onCambio={(v) => cambiar({ correccion: v })} />
      <Explicacion p={p} cambiar={cambiar} />
    </>
  );
}

const porTipo = {
  hipotesis: PreguntaHipotesis,
  etiquetar: PreguntaEtiquetar,
  detective: PreguntaDetective,
  quiz: PreguntaQuiz,
  verdadero_falso: PreguntaVF,
  ordenar: PreguntaOrdenar,
  relacionar: PreguntaPares,
  memoria: PreguntaPares,
  completar: PreguntaCompletar,
  clasificar: PreguntaClasificar,
  linea_tiempo: PreguntaLineaTiempo,
};

// Título, instrucciones y retos de un juego (también es la evaluación final de una clase).
function CamposJuego({ juego, onCambio, prefijo }) {
  const Pregunta = porTipo[juego.tipo_actividad];
  const cambiarPregunta = (indice, cambios) =>
    onCambio({ ...juego, preguntas: juego.preguntas.map((p, i) => (i === indice ? { ...p, ...cambios } : p)) });
  return (
    <>
      <Texto etiquetaTexto="Título" valor={juego.titulo} onCambio={(v) => onCambio({ ...juego, titulo: v })} />
      <Texto etiquetaTexto="Instrucciones" valor={juego.instrucciones} onCambio={(v) => onCambio({ ...juego, instrucciones: v })} largo />
      {Pregunta ? (
        juego.preguntas.map((p, i) => (
          <section key={i} className="space-y-3 rounded-xl bg-slate-50 p-4">
            <h4 className="text-sm font-black text-teal-800">Reto {i + 1}</h4>
            <Pregunta p={{ ...p, __id: `${prefijo}${i}` }} cambiar={(cambios) => cambiarPregunta(i, cambios)} />
          </section>
        ))
      ) : (
        <p className="text-sm font-bold text-rose-700">Este tipo de juego no se puede editar aquí.</p>
      )}
    </>
  );
}

function CamposClase({ clase, onCambio }) {
  const cambiarSeccion = (indice, cambios) =>
    onCambio({ ...clase, secciones: clase.secciones.map((x, i) => (i === indice ? { ...x, ...cambios } : x)) });
  return (
    <>
      <Texto etiquetaTexto="Título de la clase" valor={clase.titulo} onCambio={(v) => onCambio({ ...clase, titulo: v })} />
      <Texto etiquetaTexto="Instrucciones" valor={clase.instrucciones} onCambio={(v) => onCambio({ ...clase, instrucciones: v })} largo />
      {clase.secciones.map((sec, i) => {
        const MiniReto = sec.mini_reto?.tipo === "verdadero_falso" ? PreguntaVF : PreguntaQuiz;
        return (
          <section key={i} className="space-y-3 rounded-xl bg-slate-50 p-4">
            <h4 className="text-sm font-black text-teal-800">Sección {i + 1}</h4>
            <Texto etiquetaTexto="Título de la sección" valor={sec.titulo} onCambio={(v) => cambiarSeccion(i, { titulo: v })} />
            <Texto etiquetaTexto="Explicación" valor={sec.explicacion} onCambio={(v) => cambiarSeccion(i, { explicacion: v })} largo />
            <Texto etiquetaTexto="Ejemplo" valor={sec.ejemplo} onCambio={(v) => cambiarSeccion(i, { ejemplo: v })} largo />
            <div className="space-y-3 rounded-lg border-2 border-sky-100 bg-white p-3">
              <p className="text-xs font-black uppercase text-sky-800">Mini-reto (sin calificación)</p>
              <MiniReto p={{ ...sec.mini_reto, __id: `m${i}` }} cambiar={(cambios) => cambiarSeccion(i, { mini_reto: { ...sec.mini_reto, ...cambios } })} />
            </div>
          </section>
        );
      })}
      <div className="space-y-4 rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4">
        <h3 className="font-black text-amber-900">Evaluación final</h3>
        <CamposJuego juego={clase.evaluacion} onCambio={(ev) => onCambio({ ...clase, evaluacion: ev })} prefijo="e" />
      </div>
    </>
  );
}

function limpiar(preguntas) {
  return preguntas.map((p) => {
    const copia = { ...p };
    delete copia.__id;
    return copia;
  });
}

export default function EditorJuego({ juego, onGuardar, onCancelar, guardando = false, error = "" }) {
  const [borrador, setBorrador] = useState(() => JSON.parse(JSON.stringify(juego)));
  const esClase = borrador.tipo_actividad === "clase";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (esClase) onGuardar({ ...borrador, evaluacion: { ...borrador.evaluacion, preguntas: limpiar(borrador.evaluacion.preguntas) } });
        else onGuardar({ ...borrador, preguntas: limpiar(borrador.preguntas) });
      }}
      className="space-y-5 rounded-2xl border-2 border-teal-100 bg-white p-5"
    >
      <h3 className="text-lg font-black text-slate-900">{esClase ? "Editar clase interactiva" : "Editar juego"}</h3>
      {esClase ? <CamposClase clase={borrador} onCambio={setBorrador} /> : <CamposJuego juego={borrador} onCambio={setBorrador} prefijo="r" />}
      {error && <p role="alert" className="rounded-xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      <p className="text-sm text-slate-600">Al guardar, vuelve a «Por revisar» y tendrás que aprobarlo de nuevo.</p>
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className="min-h-12 rounded-xl border-2 border-[#22184a] bg-[#6b46c1] px-5 font-black text-white hover:bg-[#5a37b0] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:opacity-60">
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-5 font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}
