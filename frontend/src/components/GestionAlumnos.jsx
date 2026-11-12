import { useState } from "react";
import { api } from "../services/api";

export default function GestionAlumnos({ listaAlumnos = [], onAgregarAlumno, onRestablecerPin, token = "", onCambioAlumnos }) {
  const [modalAbierto, setModalAbierto] = useState(false);
  // Datos de acceso recién generados. El PIN solo existe aquí: el servidor ya no lo guarda en claro.
  const [credencial, setCredencial] = useState(null);
  const [restableciendoId, setRestableciendoId] = useState(null);
  const [errorLista, setErrorLista] = useState("");
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [enlaceCopiado, setEnlaceCopiado] = useState("");
  const [editando, setEditando] = useState(null); // alumno cuyo nombre se corrige
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [borrando, setBorrando] = useState(null); // alumno que se va a eliminar
  const [confirmacion, setConfirmacion] = useState("");
  const [trabajando, setTrabajando] = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [aviso, setAviso] = useState("");

  // Ejecuta una acción sobre un alumno, recarga la lista y muestra el error si falla.
  async function ejecutar(accion, mensajeOk = "") {
    setTrabajando(true);
    setErrorModal("");
    setErrorLista("");
    try {
      await accion();
      await onCambioAlumnos?.();
      setAviso(mensajeOk);
      return true;
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "No se pudo completar la acción.";
      setErrorModal(mensaje);
      setErrorLista(mensaje);
      return false;
    } finally {
      setTrabajando(false);
    }
  }

  async function guardarNombre(event) {
    event.preventDefault();
    const limpio = nombreNuevo.trim();
    if (!limpio || trabajando) return;
    if (await ejecutar(() => api.actualizarAlumno(editando.id, { nombre_pila: limpio }, token), "Nombre actualizado.")) setEditando(null);
  }

  function alternarActivo(alumno) {
    if (trabajando) return;
    const activar = alumno.activo === false;
    ejecutar(
      () => api.actualizarAlumno(alumno.id, { activo: activar }, token),
      activar ? `${alumno.nombre} puede volver a entrar.` : `${alumno.nombre} ya no puede entrar y no cuenta en las métricas. Sus datos se conservan.`,
    );
  }

  async function confirmarBorrado(event) {
    event.preventDefault();
    if (trabajando || confirmacion.trim().toLowerCase() !== borrando.nombre.trim().toLowerCase()) return;
    const nombreBorrado = borrando.nombre;
    if (await ejecutar(() => api.eliminarAlumno(borrando.id, token), `Se eliminó a ${nombreBorrado} y todos sus resultados.`)) {
      setBorrando(null);
      setConfirmacion("");
    }
  }

  async function descargarDatos(alumno) {
    if (trabajando) return;
    setTrabajando(true);
    setErrorLista("");
    try {
      const datos = await api.datosDelAlumno(alumno.id, token);
      const archivo = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(archivo);
      // Nombre de archivo solo con letras y números (sin acentos), para que cualquier sistema lo acepte.
      const nombreSeguro = alumno.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
      enlace.download = `datos-${nombreSeguro}.json`;
      document.body.appendChild(enlace); // Firefox lo exige para descargar
      enlace.click();
      enlace.remove();
      // Se libera la memoria después: si se hiciera en seguida, el navegador podría cancelar la descarga.
      window.setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "No se pudieron descargar los datos.");
    } finally {
      setTrabajando(false);
    }
  }

  async function copiarAcceso(codigo) {
    const enlace = `${window.location.origin}/?aula=${encodeURIComponent(codigo)}`;
    try {
      await navigator.clipboard.writeText(enlace);
      setEnlaceCopiado(codigo);
      window.setTimeout(() => setEnlaceCopiado(""), 2500);
    } catch {
      setError("No se pudo copiar. Copia el código del aula y compártelo con el grupo.");
    }
  }

  async function guardarAlumno(event) {
    event.preventDefault();
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || !onAgregarAlumno || guardando) return;

    setGuardando(true);
    setError("");
    try {
      const creado = await onAgregarAlumno({ nombre: nombreLimpio });
      if (creado?.pin) {
        setCredencial({ nombre: nombreLimpio, codigo: creado.codigo_acceso, pin: creado.pin });
      }
      setNombre("");
      setModalAbierto(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar al alumno. Inténtalo de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function restablecer(alumno) {
    if (!onRestablecerPin || restableciendoId) return;
    setRestableciendoId(alumno.id);
    setErrorLista("");
    try {
      const resultado = await onRestablecerPin(alumno.id);
      setCredencial({ nombre: alumno.nombre, codigo: alumno.codigo_acceso, pin: resultado.pin });
    } catch (err) {
      setErrorLista(err instanceof Error ? err.message : "No se pudo generar un PIN nuevo.");
    } finally {
      setRestableciendoId(null);
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

      {credencial && (
        <div role="status" className="mb-6 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
          <p className="text-sm font-black uppercase tracking-wide text-amber-900">Datos de acceso de {credencial.nombre}</p>
          <div className="mt-3 flex flex-wrap gap-6">
            <div>
              <p className="text-xs font-bold text-slate-600">Código del aula</p>
              <p className="font-mono text-3xl font-black tracking-widest text-teal-800">{credencial.codigo}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-600">PIN secreto</p>
              <p className="font-mono text-3xl font-black tracking-widest text-orange-800">{credencial.pin}</p>
            </div>
          </div>
          <p className="mt-3 text-sm font-semibold text-amber-950">
            Anótalos ahora y entrégalos al alumno. Por seguridad, este PIN no se volverá a mostrar; si se pierde, usa «Nuevo PIN».
          </p>
          <button type="button" onClick={() => setCredencial(null)} className="mt-3 min-h-11 rounded-xl border-b-4 border-amber-700 bg-amber-500 px-5 font-bold text-amber-950 transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200">
            Listo, ya lo anoté
          </button>
        </div>
      )}

      {aviso && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{aviso}</p>}
      {errorLista && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorLista}</p>}

      {listaAlumnos.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead className="bg-teal-50 text-sm font-bold text-slate-700">
              <tr>
                <th scope="col" className="px-5 py-3">Nombre del alumno</th>
                <th scope="col" className="px-5 py-3">Código del aula</th>
                <th scope="col" className="px-5 py-3">PIN de acceso</th>
                <th scope="col" className="px-5 py-3">Acceso y acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {listaAlumnos.map((alumno, indice) => (
                <tr key={alumno.id ?? alumno._id ?? `${alumno.nombre}-${indice}`} className={`transition hover:bg-teal-50/50 ${alumno.activo === false ? "bg-slate-50 opacity-70" : ""}`}>
                  <td className="px-5 py-4 font-semibold text-slate-900">{alumno.nombre}{alumno.activo === false && <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">Inactivo</span>}</td>
                  <td className="px-5 py-4 font-mono font-bold tracking-widest text-teal-800">{alumno.codigo_acceso ?? "—"}</td>
                  <td className="px-5 py-4">
                    <span className="mr-2 font-mono font-bold tracking-widest text-slate-400" aria-label="PIN oculto">••••</span>
                    {alumno.bloqueado && <span className="mr-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">Bloqueado</span>}
                    <button type="button" onClick={() => restablecer(alumno)} disabled={restableciendoId !== null} className="rounded-lg border border-orange-300 px-3 py-1.5 text-sm font-semibold text-orange-800 transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-200 disabled:opacity-60">
                      {restableciendoId === alumno.id ? "Generando..." : "Nuevo PIN"}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <button type="button" onClick={() => copiarAcceso(alumno.codigo_acceso)} className="mr-2 mb-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-900 hover:bg-teal-100">{enlaceCopiado === alumno.codigo_acceso ? "Enlace copiado ✓" : "Copiar acceso rápido"}</button>
                    <button type="button" onClick={() => { setErrorModal(""); setNombreNuevo(alumno.nombre); setEditando(alumno); }} className="mr-2 mb-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-bold text-sky-900 hover:bg-sky-100">Editar nombre</button>
                    <button type="button" disabled={trabajando} onClick={() => alternarActivo(alumno)} className="mr-2 mb-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 disabled:opacity-60">{alumno.activo === false ? "Reactivar" : "Desactivar"}</button>
                    <button type="button" disabled={trabajando} onClick={() => descargarDatos(alumno)} className="mr-2 mb-1 rounded-lg border border-indigo-200 px-3 py-1.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 disabled:opacity-60">Descargar datos</button>
                    <button type="button" onClick={() => { setErrorModal(""); setConfirmacion(""); setBorrando(alumno); }} className="mb-1 rounded-lg border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-800 hover:bg-rose-50">Eliminar</button>
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

      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="titulo-editar" className="w-full max-w-md rounded-3xl border-2 border-sky-100 bg-white p-6 shadow-2xl">
            <h3 id="titulo-editar" className="text-xl font-black text-slate-800">Corregir el nombre</h3>
            <form onSubmit={guardarNombre} className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-800">Nombre del alumno
                <input autoFocus required maxLength={60} value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)} className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-base text-slate-900 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
              </label>
              {errorModal && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorModal}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setEditando(null)} disabled={trabajando} className="min-h-11 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={!nombreNuevo.trim() || trabajando} className="min-h-11 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-5 font-bold text-white hover:bg-teal-600 disabled:opacity-60">{trabajando ? "Guardando..." : "Guardar"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {borrando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <section role="alertdialog" aria-modal="true" aria-labelledby="titulo-borrar" className="w-full max-w-md rounded-3xl border-2 border-rose-200 bg-white p-6 shadow-2xl">
            <h3 id="titulo-borrar" className="text-xl font-black text-rose-900">Eliminar a {borrando.nombre}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">Se borrarán su acceso y <strong>todos sus resultados</strong>. No se puede deshacer. Si solo quieres que deje de entrar, usa «Desactivar». Para descargar sus datos antes, usa «Descargar datos».</p>
            <form onSubmit={confirmarBorrado} className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-slate-800">Para confirmar, escribe su nombre: <span className="font-black">{borrando.nombre}</span>
                <input autoFocus value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="off" className="mt-2 min-h-12 w-full rounded-xl border-2 border-slate-200 px-4 text-base text-slate-900 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-100" />
              </label>
              {errorModal && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorModal}</p>}
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setBorrando(null)} disabled={trabajando} className="min-h-11 rounded-xl border border-slate-300 px-5 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={trabajando || confirmacion.trim().toLowerCase() !== borrando.nombre.trim().toLowerCase()} className="min-h-11 rounded-xl border-b-4 border-rose-900 bg-rose-700 px-5 font-bold text-white hover:bg-rose-600 disabled:opacity-50">{trabajando ? "Eliminando..." : "Eliminar para siempre"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}
