import { useState } from "react";

export default function LoginDocente({ onLoginExitoso }) {
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function manejarEnvio(evento) {
    evento.preventDefault();
    if (cargando) return;

    setCargando(true);
    setError("");

    try {
      if (typeof onLoginExitoso !== "function") {
        throw new Error("No se pudo conectar con el acceso docente.");
      }

      await onLoginExitoso({ correo, contrasena });
    } catch (err) {
      setError(
        err?.message || "Correo o contraseña incorrectos. Intenta de nuevo.",
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#171044] px-4 py-8 text-slate-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-fuchsia-600/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-12 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl"
      />

      <section className="relative w-full max-w-md rounded-[2rem] border-4 border-white bg-white p-6 shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:p-9">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-indigo-100 bg-indigo-50">
            <svg
              viewBox="0 0 160 160"
              className="h-16 w-16"
              aria-hidden="true"
            >
              <path
                fill="#4f46e5"
                d="M23 83c-2-24 2-42 11-53 16 3 29 14 38 31h16c9-17 22-28 38-31 9 11 13 29 11 53-11-10-23-14-36-10-3 22-13 39-31 51-18-12-28-29-31-51-13-4-25 0-36 10Z"
              />
              <path
                fill="#312e81"
                d="M34 30C23 20 11 18 2 23c9 9 13 20 13 33 7-8 14-12 22-13-3-5-4-9-3-13Zm92 0c11-10 23-12 32-7-9 9-13 20-13 33-7-8-14-12-22-13 3-5 4-9 3-13Z"
              />
              <circle cx="61" cy="78" r="10" fill="white" />
              <circle cx="99" cy="78" r="10" fill="white" />
              <circle cx="61" cy="78" r="4" fill="#171044" />
              <circle cx="99" cy="78" r="4" fill="#171044" />
              <path fill="#fb7185" d="m80 87-9 9 9 7 9-7-9-9Z" />
              <path
                d="M70 108q10 11 20 0"
                fill="none"
                stroke="white"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-indigo-700">
            Equipo Murciélago
          </p>
          <h1 className="text-3xl font-black tracking-tight text-indigo-950 sm:text-4xl">
            Acceso docente
          </h1>
          <p className="mt-3 text-base font-medium text-slate-600">
            Bienvenido, maestro. Tu aula te espera.
          </p>
        </header>

        <form onSubmit={manejarEnvio} className="space-y-5">
          <div>
            <label
              htmlFor="correo-docente"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Correo electrónico
            </label>
            <input
              id="correo-docente"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={correo}
              onChange={(evento) => {
                setCorreo(evento.target.value);
                setError("");
              }}
              disabled={cargando}
              placeholder="maestro@escuela.edu"
              className="min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="contrasena-docente"
              className="mb-2 block text-sm font-bold text-slate-800"
            >
              Contraseña
            </label>
            <div className="relative">
              <input
                id="contrasena-docente"
                name="password"
                type={mostrarContrasena ? "text" : "password"}
                autoComplete="current-password"
                required
                value={contrasena}
                onChange={(evento) => {
                  setContrasena(evento.target.value);
                  setError("");
                }}
                disabled={cargando}
                placeholder="Escribe tu contraseña"
                className="min-h-12 w-full rounded-xl border-2 border-slate-300 px-4 pr-14 text-base text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setMostrarContrasena((visible) => !visible)}
                aria-label={
                  mostrarContrasena
                    ? "Ocultar contraseña"
                    : "Mostrar contraseña"
                }
                aria-pressed={mostrarContrasena}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-600 transition hover:text-indigo-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-indigo-200"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {mostrarContrasena ? (
                    <>
                      <path d="M3 3l18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 5.2A11 11 0 0 1 12 5c5 0 9 5 9 7a9 9 0 0 1-2.1 3.1" />
                      <path d="M6.2 6.2C4.2 7.6 3 9.5 3 12c0 2 4 7 9 7a10 10 0 0 0 3.1-.5" />
                    </>
                  ) : (
                    <>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="min-h-14 w-full rounded-2xl border-b-[6px] border-indigo-950 bg-indigo-700 px-5 text-lg font-black text-white shadow-md transition hover:bg-indigo-600 active:translate-y-1 active:border-b-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cargando ? "Verificando..." : "Entrar al Panel"}
          </button>
        </form>
      </section>
    </main>
  );
}