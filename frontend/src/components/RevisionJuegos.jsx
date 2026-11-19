import { useEffect, useState } from "react";
import { api } from "../services/api";
import EditorJuego from "./EditorJuego";
import VisorActividad from "./VisorActividad";
import InsigniaMateria from "./InsigniaMateria";
import { gradoDelPedido, materiaDeJuego } from "../lib/materias";

const pestanas = [
  { estado: "borrador", nombre: "Por revisar", vacio: "No tienes actividades por revisar. Crea una con IA y aparecerá aquí." },
  { estado: "aprobado", nombre: "Aprobados", vacio: "Todavía no has aprobado ninguna actividad: tus alumnos no ven nada." },
  { estado: "descartado", nombre: "Descartados", vacio: "No hay actividades descartadas." },
];

const insignia = {
  borrador: "bg-amber-100 text-amber-900",
  aprobado: "bg-emerald-100 text-emerald-900",
  descartado: "bg-slate-200 text-slate-700",
};

const nombresTipo = { quiz: "Quiz", verdadero_falso: "Cierto o falso", ordenar: "Ordena pasos", relacionar: "Une parejas", memoria: "Memoria", completar: "Completa" };

const boton = "min-h-11 rounded-xl px-4 text-sm font-black focus-visible:outline-none focus-visible:ring-4 disabled:opacity-60";

export default function RevisionJuegos({ token }) {
  const [juegos, setJuegos] = useState([]);
  const [pestana, setPestana] = useState("borrador");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState(null); // id del juego en vista previa
  const [editando, setEditando] = useState(null); // id del juego en edición
  const [errorEdicion, setErrorEdicion] = useState("");

  const [version, setVersion] = useState(0); // al subirlo se vuelve a pedir la lista
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    let vigente = true;
    // Se piden las dos listas: la de «descartados» solo sale con ?estado=descartado.
    Promise.all([api.obtenerJuegos(token), api.obtenerJuegos(token, "descartado")])
      .then(([vivos, descartados]) => {
        if (!vigente) return;
        setJuegos([...vivos, ...descartados]);
        setError("");
        setCargando(false);
      })
      .catch((causa) => {
        if (!vigente) return;
        setError(causa.message);
        setCargando(false);
      });
    return () => { vigente = false; };
  }, [token, version]);

  async function cambiarEstado(juego, estado) {
    setOcupado(true);
    setError("");
    try {
      await api.cambiarEstadoJuego(juego.id_juego, estado, token);
      setVistaPrevia(null);
      recargar();
    } catch (causa) {
      setError(causa.message);
    } finally {
      setOcupado(false);
    }
  }

  async function guardarEdicion(juegoEditado) {
    setOcupado(true);
    setErrorEdicion("");
    try {
      await api.editarJuego(editando, juegoEditado, token);
      setEditando(null);
      setVistaPrevia(null);
      setPestana("borrador");
      recargar();
    } catch (causa) {
      setErrorEdicion(causa.message);
    } finally {
      setOcupado(false);
    }
  }

  const visibles = juegos.filter((j) => j.estado === pestana);
  const conteo = (estado) => juegos.filter((j) => j.estado === estado).length;
  const juegoEnEdicion = juegos.find((j) => j.id_juego === editando);

  if (juegoEnEdicion) {
    return (
      <EditorJuego
        juego={juegoEnEdicion.contenido_juego}
        guardando={ocupado}
        error={errorEdicion}
        onGuardar={guardarEdicion}
        onCancelar={() => { setEditando(null); setErrorEdicion(""); }}
      />
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-base text-[#4a3f7a]">
        Las actividades de la IA nacen como borrador. Revísalas, corrige lo que haga falta y apruébalas: <strong className="text-[#22184a]">solo las aprobadas las ven tus alumnos</strong>.
      </p>
      <div role="tablist" aria-label="Estado de los juegos" className="flex flex-wrap gap-2">
        {pestanas.map((p) => (
          <button key={p.estado} type="button" role="tab" aria-selected={pestana === p.estado} onClick={() => { setPestana(p.estado); setVistaPrevia(null); }} className={`${boton} focus-visible:ring-teal-200 border-2 ${pestana === p.estado ? "border-[#22184a] bg-[#6b46c1] text-white" : "border-[#d8d0f0] bg-white text-[#22184a] hover:border-[#22184a]"}`}>
            {p.nombre} ({conteo(p.estado)})
          </button>
        ))}
      </div>

      {error && <p role="alert" className="rounded-xl border-2 border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      {cargando && <p className="font-bold text-[#4a3f7a]">Cargando actividades…</p>}
      {!cargando && visibles.length === 0 && <p className="rounded-2xl border-2 border-dashed border-[#b9a5f0] bg-white p-5 text-[#4a3f7a]">{pestanas.find((p) => p.estado === pestana).vacio}</p>}

      <ul className="space-y-3">
        {visibles.map((juego) => (
          <li key={juego.id_juego} className="rounded-[1.5rem] border-[3px] border-[#22184a] bg-white p-5 shadow-[4px_4px_0_#22184a]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <InsigniaMateria materia={materiaDeJuego(juego)} corta />
                  {gradoDelPedido(juego.prompt_original) && <span className="rounded-full bg-[#f1ecff] px-3 py-1 text-xs font-extrabold text-[#3d2380]">{gradoDelPedido(juego.prompt_original)}</span>}
                </div>
                <h3 className="font-display text-xl font-semibold text-[#22184a]">{juego.titulo}</h3>
                <p className="text-xs text-slate-600">{juego.contenido_juego?.tipo_actividad === "clase" ? `clase interactiva · ${juego.contenido_juego.secciones?.length ?? 0} secciones + evaluación` : `${nombresTipo[juego.contenido_juego?.tipo_actividad] ?? "Juego"} · ${juego.contenido_juego?.preguntas?.length ?? 0} retos`}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${insignia[juego.estado]}`}>{juego.estado === "borrador" ? "Por revisar" : juego.estado}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setVistaPrevia(vistaPrevia === juego.id_juego ? null : juego.id_juego)} className={`${boton} bg-indigo-100 text-indigo-900 hover:bg-indigo-200 focus-visible:ring-indigo-200`}>
                {vistaPrevia === juego.id_juego ? "Cerrar vista previa" : "Vista previa"}
              </button>
              {juego.estado !== "descartado" && (
                <button type="button" onClick={() => { setEditando(juego.id_juego); setErrorEdicion(""); }} className={`${boton} bg-sky-100 text-sky-900 hover:bg-sky-200 focus-visible:ring-sky-200`}>Editar</button>
              )}
              {juego.estado === "borrador" && (
                <button type="button" disabled={ocupado} onClick={() => cambiarEstado(juego, "aprobado")} className={`${boton} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-200`}>Aprobar</button>
              )}
              {juego.estado === "aprobado" && (
                <button type="button" disabled={ocupado} onClick={() => cambiarEstado(juego, "borrador")} className={`${boton} bg-amber-100 text-amber-900 hover:bg-amber-200 focus-visible:ring-amber-200`}>Retirar</button>
              )}
              {juego.estado === "descartado" ? (
                <button type="button" disabled={ocupado} onClick={() => cambiarEstado(juego, "borrador")} className={`${boton} bg-slate-200 text-slate-800 hover:bg-slate-300 focus-visible:ring-slate-200`}>Restaurar</button>
              ) : (
                <button type="button" disabled={ocupado} onClick={() => cambiarEstado(juego, "descartado")} className={`${boton} bg-rose-100 text-rose-900 hover:bg-rose-200 focus-visible:ring-rose-200`}>Descartar</button>
              )}
            </div>
            {vistaPrevia === juego.id_juego && juego.contenido_juego && (
              <div className="mt-4"><VisorActividad juego={juego.contenido_juego} /></div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
