import { useEffect, useState } from "react";
import { api } from "../services/api";

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

  useEffect(() => {
    let vigente = true;
    api.obtenerMetricas(token)
      .then((respuesta) => { if (vigente) setDatos(respuesta); })
      .catch((err) => { if (vigente) setError(err instanceof Error ? err.message : "No se pudieron cargar las métricas."); });
    return () => { vigente = false; };
  }, [token]);

  if (error) {
    return <p role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 font-semibold text-rose-800">{error}</p>;
  }
  if (!datos) {
    return <p role="status" className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-8 text-center font-semibold text-slate-300">Cargando métricas...</p>;
  }

  const { resumen, por_juego: porJuego, por_alumno: porAlumno, umbral_apoyo: umbral } = datos;
  const sinDatos = resumen.intentos === 0;
  const necesitanApoyo = porAlumno.filter((alumno) => alumno.necesita_apoyo);

  return (
    <section className="space-y-6 rounded-3xl border-2 border-teal-100 bg-gradient-to-br from-white via-white to-amber-50 p-5 text-slate-900 shadow-sm sm:p-7">
      <header>
        <h2 className="text-2xl font-black text-slate-800">Seguimiento del grupo</h2>
        <p className="mt-1 text-sm text-slate-600">Resultados de los juegos que tus alumnos han terminado.</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta etiqueta="Alumnos que han jugado" valor={`${resumen.alumnos_que_jugaron} de ${resumen.alumnos_total}`} />
        <Tarjeta etiqueta="Intentos" valor={resumen.intentos} />
        <Tarjeta etiqueta="Promedio de aciertos" valor={resumen.promedio_puntuacion == null ? "—" : `${resumen.promedio_puntuacion}%`} />
        <Tarjeta etiqueta="Tiempo promedio" valor={formatearTiempo(resumen.tiempo_promedio_seg)} />
      </div>

      {sinDatos ? (
        <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-8 text-center font-medium text-slate-700">
          Aún no hay resultados. Cuando tus alumnos terminen un juego, aquí verás cómo les fue.
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
        <h3 className="mb-2 text-lg font-black text-slate-800">Por juego</h3>
        {porJuego.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <caption className="sr-only">Resultados por juego</caption>
              <thead className="bg-teal-50 text-sm font-bold text-slate-700">
                <tr>
                  <th scope="col" className="px-5 py-3">Juego</th>
                  <th scope="col" className="px-5 py-3">Alumnos</th>
                  <th scope="col" className="px-5 py-3">Intentos</th>
                  <th scope="col" className="px-5 py-3">Promedio de aciertos</th>
                  <th scope="col" className="px-5 py-3">Tiempo promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {porJuego.map((juego) => (
                  <tr key={juego.id_juego} className="transition hover:bg-teal-50/50">
                    <th scope="row" className="px-5 py-3 font-semibold text-slate-900">{juego.titulo ?? "Juego sin título"}</th>
                    <td className="px-5 py-3 text-slate-800">{juego.alumnos}</td>
                    <td className="px-5 py-3 text-slate-800">{juego.intentos}</td>
                    <td className="px-5 py-3"><BarraPorcentaje valor={juego.promedio_puntuacion} umbral={umbral} /></td>
                    <td className="px-5 py-3 text-slate-800">{formatearTiempo(juego.tiempo_promedio_seg)}</td>
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
                  <th scope="col" className="px-5 py-3">Juegos</th>
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
                    <td className="px-5 py-3 text-slate-800">{alumno.juegos_jugados}</td>
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
