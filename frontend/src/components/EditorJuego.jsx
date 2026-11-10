import { useState } from "react";

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
    </>
  );
}

function PreguntaCompletar({ p, cambiar }) {
  return (
    <>
      <Texto etiquetaTexto="Frase (usa ___ para el espacio vacío)" valor={p.frase} onCambio={(v) => cambiar({ frase: v })} />
      <Texto etiquetaTexto="Respuesta" valor={p.respuesta} onCambio={(v) => cambiar({ respuesta: v })} />
      <Texto etiquetaTexto="Pista" valor={p.pista} onCambio={(v) => cambiar({ pista: v })} />
    </>
  );
}

const porTipo = {
  quiz: PreguntaQuiz,
  verdadero_falso: PreguntaVF,
  ordenar: PreguntaOrdenar,
  relacionar: PreguntaPares,
  memoria: PreguntaPares,
  completar: PreguntaCompletar,
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
        <button type="submit" disabled={guardando} className="min-h-12 rounded-xl bg-teal-600 px-5 font-black text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:opacity-60">
          {guardando ? "Guardando..." : "Guardar cambios"}
        </button>
        <button type="button" onClick={onCancelar} disabled={guardando} className="min-h-12 rounded-xl border-2 border-slate-300 bg-white px-5 font-black text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200">
          Cancelar
        </button>
      </div>
    </form>
  );
}
