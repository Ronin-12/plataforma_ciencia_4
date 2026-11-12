import { useEffect, useState } from "react";
import { api } from "../services/api";

const TIPOS = [
  { id: "", texto: "Todas las actividades" },
  { id: "clase", texto: "Clases interactivas" },
  { id: "quiz", texto: "Quiz relámpago" },
  { id: "verdadero_falso", texto: "Cierto o falso" },
  { id: "ordenar", texto: "Ordenar los pasos" },
  { id: "relacionar", texto: "Unir las parejas" },
  { id: "memoria", texto: "Juego de memoria" },
  { id: "completar", texto: "Completar la frase" },
];
const textoDeTipo = (tipo) => TIPOS.find((t) => t.id === tipo)?.texto ?? "Actividad";

// AAAA-MM-DD en la hora LOCAL del docente (toISOString() usa UTC y por la noche daría el día siguiente).
function fechaLocal(fecha) {
  const dos = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

const SIN_FILTROS = { desde: "", hasta: "", tipo: "" };

const estiloCampo = "mt-1 min-h-11 rounded-xl border-2 border-slate-300 bg-white px-3 text-sm font-semibold normal-case tracking-normal text-slate-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200";
const estiloAtajo = "min-h-11 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-50";

function formatearTiempo(segundos) {
  if (segundos == null) return "—";
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return min > 0 ? `${min} min ${seg} s` : `${seg} s`;
}

function formatearFecha(iso) {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function BarraPorcentaje({ valor, umbral }) {
  if (valor == null) return <span className="text-slate-500">Sin intentos</span>;
  const bajo = valor < umbral;
  return (
    <div className="flex items-center gap-3">
      <div className="h-2.5 w-24 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
        <div className={`h-full rounded-full ${bajo ? "bg-amber-500" : "bg-teal-600"}`} style={{ width: `${valor}%` }} />
      </div>
      <span className="font-mono text-sm font-bold text-slate-900">{valor}%</span>
    </div>
  );
}

function Tarjeta({ etiqueta, valor, nota }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-600">{etiqueta}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{valor}</p>
      {nota && <p className="mt-1 text-xs font-medium text-slate-600">{nota}</p>}
    </div>
  );
}

// Quién no ha hecho la actividad (en el periodo elegido). Solo tiene sentido si el alumno la ve (aprobada).
function FaltanPorHacer({ juego }) {
  if (juego.estado !== "aprobado") return <span className="text-slate-500">—</span>;
  if (juego.pendientes === 0) return <span className="font-bold text-emerald-800">Nadie ✓</span>;
  return (
    <details>
      <summary className="cursor-pointer whitespace-nowrap font-bold text-amber-900">{juego.pendientes} {juego.pendientes === 1 ? "alumno" : "alumnos"}</summary>
      <p className="mt-1 max-w-xs text-slate-700">{juego.faltan.join(", ")}</p>
    </details>
  );
}

function EstadoAlumno({ alumno }) {
  if (alumno.intentos === 0) {
    return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Sin actividad</span>;
  }
  if (alumno.necesita_apoyo) {
    return <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Necesita apoyo</span>;
  }
  return <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-900">Va bien</span>;
}

export default function MetricasGrupo({ token }) {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [filtros, setFiltros] = useState(SIN_FILTROS);

  const clave = JSON.stringify(filtros);
  const hayFiltros = Boolean(filtros.desde || filtros.hasta || filtros.tipo);
  const rangoInvalido = Boolean(filtros.desde && filtros.hasta && filtros.desde > filtros.hasta);
  // Mientras llega la respuesta nueva se siguen mostrando los datos anteriores (sin parpadeo).
  const actualizando = Boolean(datos) && datos.clave !== clave && !rangoInvalido && !error;

  useEffect(() => {
    if (rangoInvalido) return undefined;
    let vigente = true;
    api.obtenerMetricas(token, filtros)
      .then((respuesta) => { if (vigente) { setDatos({ ...respuesta, clave }); setError(""); } })
      .catch((err) => { if (vigente) setError(err instanceof Error ? err.message : "No se pudieron cargar las métricas."); });
    return () => { vigente = false; };
  }, [token, filtros, clave, rangoInvalido]);

  const cambiar = (campo) => (evento) => setFiltros((anteriores) => ({ ...anteriores, [campo]: evento.target.value }));
  const ultimosSieteDias = () => {
    const hoy = new Date();
    const inicio = new Date();
    inicio.setDate(hoy.getDate() - 6);
    setFiltros((anteriores) => ({ ...anteriores, desde: fechaLocal(inicio), hasta: fechaLocal(hoy) }));
  };
  const esteMes = () => {
    const hoy = new Date();
    setFiltros((anteriores) => ({ ...anteriores, desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), hasta: fechaLocal(hoy) }));
  };

  if (error && !datos) {
    return <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 font-semibold text-rose-800">{error}</p>;
  }
  if (!datos) {
    return <p role="status" className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center font-semibold text-slate-300">Cargando métricas...</p>;
  }

  const { resumen, por_juego: porJuego, por_alumno: porAlumno, umbral_apoyo: umbral, actividades_total: actividadesTotal } = datos;
  const sinDatos = resumen.intentos === 0;
  const necesitanApoyo = porAlumno.filter((alumno) => alumno.necesita_apoyo);

  return (
    <section className="space-y-6 rounded-3xl border-2 border-teal-100 bg-gradient-to-br from-white via-white to-amber-50 p-5 text-slate-900 shadow-sm sm:p-7">
      <header>
        <h2 className="text-2xl font-black text-slate-800">Seguimiento del grupo</h2>
        <p className="mt-1 text-sm text-slate-600">Resultados de los juegos y clases que tus alumnos han terminado.</p>
      </header>

      <form aria-label="Filtros de las métricas" onSubmit={(evento) => evento.preventDefault()} className="flex flex-wrap items-end gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
        <label className="flex flex-col text-xs font-bold uppercase tracking-wide text-slate-600">
          Desde
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar("desde")} className={estiloCampo} />
        </label>
        <label className="flex flex-col text-xs font-bold uppercase tracking-wide text-slate-600">
          Hasta
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar("hasta")} className={estiloCampo} />
        </label>
        <label className="flex flex-col text-xs font-bold uppercase tracking-wide text-slate-600">
          Tipo
          <select value={filtros.tipo} onChange={cambiar("tipo")} className={estiloCampo}>
            {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.texto}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={ultimosSieteDias} className={estiloAtajo}>Últimos 7 días</button>
          <button type="button" onClick={esteMes} className={estiloAtajo}>Este mes</button>
          <button type="button" onClick={() => setFiltros(SIN_FILTROS)} disabled={!hayFiltros} className={estiloAtajo}>Limpiar filtros</button>
        </div>
        {actualizando && <p role="status" className="text-sm font-semibold text-slate-600">Actualizando…</p>}
      </form>
      {rangoInvalido && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800">La fecha «Desde» no puede ser posterior a «Hasta».</p>}
      {error && <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-800">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta etiqueta="Alumnos que han jugado" valor={`${resumen.alumnos_que_jugaron} de ${resumen.alumnos_total}`} />
        <Tarjeta etiqueta="Intentos" valor={resumen.intentos} />
        <Tarjeta etiqueta="Promedio de aciertos" valor={resumen.promedio_puntuacion == null ? "—" : `${resumen.promedio_puntuacion}%`} />
        <Tarjeta etiqueta="Tiempo promedio" valor={formatearTiempo(resumen.tiempo_promedio_seg)} />
      </div>

      {sinDatos ? (
        <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-8 text-center font-medium text-slate-700">
          {hayFiltros ? "No hay resultados con estos filtros. Prueba con otro periodo o tipo de actividad." : "Aún no hay resultados. Cuando tus alumnos terminen un juego, aquí verás cómo les fue."}
        </p>
      ) : (
        necesitanApoyo.length > 0 && (
          <div role="note" className="rounded-2xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-950">
            {necesitanApoyo.length === 1 ? "1 alumno necesita apoyo" : `${necesitanApoyo.length} alumnos necesitan apoyo`}:{" "}
            {necesitanApoyo.map((alumno) => alumno.nombre_pila).join(", ")}. (Promedio menor a {umbral}%.)
          </div>
        )
      )}

      <div>
        <h3 className="mb-2 text-lg font-black text-slate-800">Por actividad</h3>
        {porJuego.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <caption className="sr-only">Resultados por actividad</caption>
              <thead className="bg-teal-50 text-sm font-bold text-slate-700">
                <tr>
                  <th scope="col" className="px-5 py-3">Actividad</th>
                  <th scope="col" className="px-5 py-3">Tipo</th>
                  <th scope="col" className="px-5 py-3">Alumnos</th>
                  <th scope="col" className="px-5 py-3">Intentos</th>
                  <th scope="col" className="px-5 py-3">Promedio de aciertos</th>
                  <th scope="col" className="px-5 py-3">Tiempo promedio</th>
                  <th scope="col" className="px-5 py-3">Les falta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {porJuego.map((juego) => (
                  <tr key={juego.id_juego} className="transition hover:bg-teal-50/50">
                    <th scope="row" className="px-5 py-3 font-semibold text-slate-900">{juego.titulo ?? "Juego sin título"}</th>
                    <td className="px-5 py-3 text-sm text-slate-800">{textoDeTipo(juego.tipo)}</td>
                    <td className="px-5 py-3 text-slate-800">{juego.alumnos}</td>
                    <td className="px-5 py-3 text-slate-800">{juego.intentos}</td>
                    <td className="px-5 py-3"><BarraPorcentaje valor={juego.promedio_puntuacion} umbral={umbral} /></td>
                    <td className="px-5 py-3 text-slate-800">{formatearTiempo(juego.tiempo_promedio_seg)}</td>
                    <td className="px-5 py-3 text-sm"><FaltanPorHacer juego={juego} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-6 text-center font-medium text-slate-700">
            Todavía no has creado juegos. Hazlo en «Crear Juego con IA».
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-lg font-black text-slate-800">Por alumno</h3>
        {porAlumno.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <caption className="sr-only">Resultados por alumno</caption>
              <thead className="bg-teal-50 text-sm font-bold text-slate-700">
                <tr>
                  <th scope="col" className="px-5 py-3">Alumno</th>
                  <th scope="col" className="px-5 py-3">Actividades hechas</th>
                  <th scope="col" className="px-5 py-3">Intentos</th>
                  <th scope="col" className="px-5 py-3">Promedio de aciertos</th>
                  <th scope="col" className="px-5 py-3">Último intento</th>
                  <th scope="col" className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {porAlumno.map((alumno) => (
                  <tr key={alumno.id_alumno} className="transition hover:bg-teal-50/50">
                    <th scope="row" className="px-5 py-3 font-semibold text-slate-900">{alumno.nombre_pila}</th>
                    <td className="px-5 py-3 text-slate-800">{alumno.juegos_jugados} de {actividadesTotal}</td>
                    <td className="px-5 py-3 text-slate-800">{alumno.intentos}</td>
                    <td className="px-5 py-3"><BarraPorcentaje valor={alumno.promedio_puntuacion} umbral={umbral} /></td>
                    <td className="px-5 py-3 text-sm text-slate-800">{formatearFecha(alumno.ultimo_intento)}</td>
                    <td className="px-5 py-3"><EstadoAlumno alumno={alumno} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-6 text-center font-medium text-slate-700">
            Aún no tienes alumnos. Agrégalos en «Mis Alumnos».
          </p>
        )}
      </div>
    </section>
  );
}
