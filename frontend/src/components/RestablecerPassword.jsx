import { useState } from "react";
import MascotaMurcielago from "./MascotaMurcielago";
import { api } from "../services/api";

const CAMPO = "min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-600 focus:ring-4 focus:ring-teal-100";

// Pantalla a la que llega el docente desde el enlace del correo «Mupi: crea una contraseña nueva».
export default function RestablecerPassword({ token, onIrALogin }) {
  const [contrasena, setContrasena] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");

  async function enviar(evento) {
    evento.preventDefault();
    if (cargando) return;
    setError("");
    if (contrasena !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const respuesta = await api.restablecerPassword(token, contrasena);
      setListo(respuesta.mensaje);
    } catch (err) {
      setError(err?.message || "No se pudo cambiar la contraseña.");
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f4ff] px-4 py-16">
      <section className="w-full max-w-md rounded-[2rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[8px_8px_0_#22184a] sm:p-9">
        <header className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-[#22184a] bg-[#ece6ff]">
            <MascotaMurcielago className="h-16 w-16" label="Mupi" />
          </div>
          <h1 className="font-display text-3xl font-semibold text-[#22184a]">Crea tu contraseña nueva</h1>
          <p className="mt-2 text-slate-600">Al cambiarla se cierran las sesiones que tengas abiertas en otros equipos.</p>
        </header>

        {listo ? (
          <div className="space-y-5 text-center">
            <p role="status" className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 font-semibold text-teal-900">{listo}</p>
            <button type="button" onClick={onIrALogin} className="min-h-14 w-full rounded-full border-[3px] border-[#22184a] bg-[#6b46c1] px-5 font-display text-xl font-semibold text-white shadow-[4px_4px_0_#22184a]">
              Iniciar sesión
            </button>
          </div>
        ) : (
          <form onSubmit={enviar} className="space-y-5">
            <div>
              <label htmlFor="nueva-contrasena" className="mb-2 block text-sm font-bold text-slate-800">Contraseña nueva</label>
              <input id="nueva-contrasena" type="password" autoComplete="new-password" required minLength={8} value={contrasena} onChange={(e) => { setContrasena(e.target.value); setError(""); }} placeholder="Mínimo 8 caracteres" className={CAMPO} />
            </div>
            <div>
              <label htmlFor="confirmar-nueva" className="mb-2 block text-sm font-bold text-slate-800">Escríbela otra vez</label>
              <input id="confirmar-nueva" type="password" autoComplete="new-password" required minLength={8} value={confirmar} onChange={(e) => { setConfirmar(e.target.value); setError(""); }} className={CAMPO} />
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
            <button type="submit" disabled={cargando} className="min-h-14 w-full rounded-full border-[3px] border-[#22184a] bg-[#6b46c1] px-5 font-display text-xl font-semibold text-white shadow-[4px_4px_0_#22184a] disabled:opacity-70">
              {cargando ? "Guardando..." : "Guardar contraseña"}
            </button>
            <button type="button" onClick={onIrALogin} className="w-full text-sm font-bold text-[#6b46c1] underline">Volver a iniciar sesión</button>
          </form>
        )}
      </section>
    </main>
  );
}
