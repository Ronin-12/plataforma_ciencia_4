import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";

export default function MaterialesSesiones({ idDocente, token, onCrearJuego, onUsoChange }) {
  const inputRef = useRef(null);
  const folderRef = useRef(null);
  const [archivos, setArchivos] = useState([]);
  const [analisis, setAnalisis] = useState(null);
  const [sesiones, setSesiones] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  async function cargarSesiones() {
    if (!idDocente) return;
    try { setSesiones(await api.obtenerSesiones(idDocente, token)); } catch (err) { setError(err.message); }
  }

  useEffect(() => { cargarSesiones(); }, [idDocente]);

  function elegirArchivos(lista) {
    const seleccion = Array.from(lista || []);
    setError(""); setAviso(""); setAnalisis(null);
    if (seleccion.length > 10) return setError("Puedes agregar hasta 10 archivos a la vez.");
    if (seleccion.reduce((total, archivo) => total + archivo.size, 0) > 20 * 1024 * 1024) return setError("El tamaño total no puede superar 20 MB.");
    const validos = seleccion.every((archivo) => /\.pdf$|\.(png|jpe?g|webp)$/i.test(archivo.name));
    if (!validos) return setError("Usa archivos PDF, JPG, PNG o WebP.");
    setArchivos(seleccion);
  }

  async function analizar() {
    if (!archivos.length || ocupado) return;
    setOcupado(true); setError(""); setAviso("");
    try {
      const resultado = await api.analizarMateriales(idDocente, archivos, token);
      setAnalisis(resultado);
      if (resultado.uso) onUsoChange?.(resultado.uso);
    }
    catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  }

  async function guardarTema(tema) {
    setOcupado(true); setError(""); setAviso("");
    try {
      const sesion = await api.crearSesion({
        id_docente: idDocente,
        titulo: tema.titulo,
        tema: tema.titulo,
        material_nombre: analisis.archivos.join(", ").slice(0, 255),
        contexto: `${tema.titulo}: ${tema.descripcion || ""}\n${analisis.contexto || ""}`.slice(0, 16000),
      }, token);
      await cargarSesiones();
      setAviso(`Sesión «${sesion.titulo}» guardada. Ya puedes crear una actividad para ese tema.`);
    } catch (err) { setError(err.message); }
    finally { setOcupado(false); }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border-2 border-teal-100 bg-gradient-to-br from-white via-white to-amber-50 p-5 shadow-sm sm:p-7">
        <div className="mb-5">
          <p className="text-sm font-black uppercase tracking-wide text-teal-800">Biblioteca de clase</p>
          <h3 className="mt-1 text-2xl font-black text-slate-900">Sube el material y prepara una sesión</h3>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">Agrega páginas del libro en PDF o fotos. La IA propone temas para que elijas qué enseñar y guardes cada tema como una sesión.</p>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/70 p-5 sm:p-7">
          <input ref={inputRef} className="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" multiple onChange={(event) => elegirArchivos(event.target.files)} />
          <input ref={folderRef} className="sr-only" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp" multiple webkitdirectory="" onChange={(event) => elegirArchivos(event.target.files)} />
          <div className="flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-3xl shadow-sm" aria-hidden="true">📚</span>
            <p className="font-black text-slate-900">Elige PDFs o fotografías del libro</p>
            <p className="mt-1 text-sm text-slate-600">Hasta 10 archivos · 20 MB en total · PDF, JPG, PNG o WebP</p>
            <p className="mt-1 text-xs text-slate-500">Puedes seleccionar archivos sueltos o una carpeta. Se conserva el nombre y el resumen de los temas; no el archivo original.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => inputRef.current?.click()} className="min-h-12 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-5 font-black text-white transition hover:bg-teal-600 active:translate-y-1 active:border-b-0">Seleccionar archivos</button>
              <button type="button" onClick={() => folderRef.current?.click()} className="min-h-12 rounded-xl border-2 border-teal-700 bg-white px-5 font-black text-teal-900 transition hover:bg-teal-50">Seleccionar carpeta</button>
            </div>
          </div>
          {archivos.length > 0 && <ul className="mx-auto mt-5 max-w-2xl divide-y divide-teal-100 rounded-xl border border-teal-100 bg-white text-left">{archivos.map((archivo) => <li key={`${archivo.name}-${archivo.lastModified}`} className="flex justify-between gap-3 px-4 py-2.5 text-sm"><span className="truncate font-semibold text-slate-800">{archivo.webkitRelativePath || archivo.name}</span><span className="shrink-0 text-slate-500">{(archivo.size / 1024 / 1024).toFixed(1)} MB</span></li>)}</ul>}
          {archivos.length > 0 && <div className="mt-4 flex justify-center"><button type="button" disabled={ocupado} onClick={analizar} className="min-h-12 rounded-xl border-b-4 border-orange-700 bg-gradient-to-r from-orange-300 to-amber-300 px-6 font-black text-orange-950 shadow-sm disabled:opacity-60">{ocupado ? "Revisando el material…" : "✨ Detectar temas"}</button></div>}
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
        {aviso && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{aviso}</p>}

        {analisis?.temas?.length > 0 && <div className="mt-6">
          <h4 className="mb-3 text-lg font-black text-slate-900">Temas que encontré</h4>
          <div className="grid gap-3 md:grid-cols-2">{analisis.temas.map((tema, index) => <article key={`${tema.titulo}-${index}`} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h5 className="text-base font-black text-slate-900">{tema.titulo}</h5>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{tema.descripcion}</p>
            <button type="button" disabled={ocupado} onClick={() => guardarTema(tema)} className="mt-4 min-h-11 rounded-xl border-b-4 border-indigo-800 bg-indigo-700 px-4 font-bold text-white hover:bg-indigo-600 disabled:opacity-50">Guardar como sesión</button>
          </article>)}</div>
        </div>}
      </div>

      <div className="rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-indigo-700">Planeación</p><h3 className="text-xl font-black text-slate-900">Tus sesiones por tema</h3></div><button type="button" onClick={cargarSesiones} className="rounded-lg px-3 py-2 text-sm font-bold text-indigo-800 hover:bg-indigo-50">Actualizar</button></div>
        {sesiones.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sesiones.map((sesion) => <article key={sesion.id_sesion} className="flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-sky-50 p-4">
          <p className="text-xs font-black uppercase text-teal-800">{sesion.material_nombre || "Sesión de ciencias"}</p><h4 className="mt-2 text-lg font-black text-slate-900">{sesion.titulo}</h4><p className="mt-1 flex-1 text-sm text-slate-600">Tema: {sesion.tema}</p>
          <button type="button" onClick={() => onCrearJuego?.(sesion)} className="mt-4 min-h-11 rounded-xl border-b-4 border-teal-800 bg-teal-700 px-4 font-bold text-white hover:bg-teal-600">Crear juego para esta sesión</button>
        </article>)}</div> : <p className="rounded-2xl bg-slate-50 p-6 text-center font-medium text-slate-600">Aún no hay sesiones. Sube un material y guarda los temas de tu clase.</p>}
      </div>
    </section>
  );
}
