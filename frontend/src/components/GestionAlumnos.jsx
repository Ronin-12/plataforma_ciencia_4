import { useState } from "react";

export default function GestionAlumnos({ listaAlumnos = [], onAgregarAlumno }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  async function guardarAlumno(event) {
    event.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || !onAgregarAlumno || guardando) return;

    setGuardando(true);
    setError("");
    try {
      await onAgregarAlumno({ nombre: nombreLimpio });
      setNombre("");
      setModalAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar al alumno. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    setNombre("");
    setError("");
    setModalAbierto(false);
  }

  return (
    <section className="rounded-3xl border-2 border-teal-100 bg-gradient-to-br from-white via-white to-amber-50 p-5 shadow-sm sm:p-7">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Mis alumnos</h2>
          <p className="mt-1 text-sm text-slate-600">Administra a los exploradores de tu aula.</p>
        </div>
        <button type="button" onClick={() => { setError(""); setModalAbierto(true); }} className="min-h-11 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-5 font-bold text-white shadow-sm transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200">
          + Nuevo alumno
        </button>
      </header>

      {listaAlumnos.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="bg-teal-50 text-sm font-bold text-slate-700">
              <tr>
                <th scope="col" className="px-5 py-3">Nombre del alumno</th>
                <th scope="col" className="px-5 py-3">Código del aula</th>
                <th scope="col" className="px-5 py-3">PIN de acceso</th>
                <th scope="col" className="px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {listaAlumnos.map((alumno, indice) => (
                <tr key={alumno.id ?? alumno._id ?? `${alumno.nombre}-${indice}`} className="transition hover:bg-teal-50/50">
                  <td className="px-5 py-4 font-semibold text-slate-900">{alumno.nombre}</td>
                  <td className="px-5 py-4 font-mono font-bold tracking-widest text-teal-800">{alumno.codigo_acceso ?? "—"}</td>
                  <td className="px-5 py-4 font-mono font-bold tracking-widest text-orange-800">{alumno.pin ?? alumno.PIN ?? "—"}</td>
                  <td className="px-5 py-4">
                    <button type="button" disabled aria-label={`Eliminar a ${alumno.nombre} (próximamente)`} className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm font-semibold text-rose-700 opacity-60">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/70 px-5 py-8 text-center font-medium text-slate-600">
          Aún no tienes alumnos registrados. ¡Agrega uno para empezar!
        </p>
      )}

      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !guardando) cancelar(); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="titulo-modal-alumno" className="w-full max-w-md rounded-3xl border-2 border-teal-100 bg-gradient-to-br from-white to-amber-50 p-6 shadow-2xl sm:p-8">
            <h3 id="titulo-modal-alumno" className="text-xl font-black text-slate-800">Nuevo alumno</h3>
            <p className="mt-1 text-sm text-slate-600">Le asignaremos su código de aula y un PIN de acceso.</p>

            <form onSubmit={guardarAlumno} className="mt-5 space-y-5">
              <div>
                <label htmlFor="nombre-alumno" className="mb-2 block text-sm font-bold text-slate-800">Nombre del alumno</label>
                <input id="nombre-alumno" type="text" autoFocus required maxLength={60} value={nombre} onChange={(event) => { setNombre(event.target.value); setError(""); }} placeholder="Ej. Sofía" className="min-h-12 w-full rounded-xl border-2 border-slate-200 bg-white px-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100" />
              </div>

              {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-relaxed text-rose-800">{error}</p>}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={cancelar} disabled={guardando} className="min-h-11 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-200 disabled:opacity-60">Cancelar</button>
                <button type="submit" disabled={!nombre.trim() || guardando} className="min-h-11 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-5 font-bold text-white transition hover:bg-teal-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60">{guardando ? "Guardando..." : "Guardar alumno"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
