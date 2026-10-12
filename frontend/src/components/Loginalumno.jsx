import { useRef, useState } from "react";

export default function LoginAlumno() {
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [campoActivo, setCampoActivo] = useState("codigo");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const codigoRef = useRef(null);
  const pinRef = useRef(null);

  const valorActivo = campoActivo === "codigo" ? codigo : pin;
  const longitudActiva = campoActivo === "codigo" ? 6 : 4;
  const avance = Math.round(((codigo.length + pin.length) / 10) * 100);

  function actualizarCampo(valor) {
    if (campoActivo === "codigo") {
      const nuevoCodigo = valor.slice(0, 6);
      setCodigo(nuevoCodigo);
      if (nuevoCodigo.length === 6) {
        setCampoActivo("pin");
        window.setTimeout(() => pinRef.current?.focus(), 0);
      }
    } else {
      setPin(valor.slice(0, 4));
    }
    setError("");
    setExito(false);
  }

  function agregarDigito(digito) {
    if (cargando || valorActivo.length >= longitudActiva) return;
    actualizarCampo(valorActivo + digito);
  }

  function borrarDigito() {
    if (cargando) return;
    actualizarCampo(valorActivo.slice(0, -1));
  }

  function manejarCambio(evento) {
    actualizarCampo(evento.target.value.replace(/\D/g, ""));
  }

  function manejarTecla(evento) {
    if (evento.key === "Enter") {
      evento.preventDefault();
      validarAcceso();
    }
  }

  function validarAcceso(evento) {
    evento?.preventDefault();
    if (codigo.length !== 6 || pin.length !== 4 || cargando) return;

    setCargando(true);
    setError("");
    setExito(false);

    // Simula una respuesta mientras conectamos el acceso al sistema del aula.
    window.setTimeout(() => {
      const accesoValido = codigo === "123456" && pin === "1234";
      console.log("Validación de alumno simulada:", { codigo, pin, accesoValido });
      setCargando(false);

      if (accesoValido) {
        setExito(true);
      } else {
        setError("Código incorrecto, intenta de nuevo.");
        setPin("");
        setCampoActivo("pin");
        window.setTimeout(() => pinRef.current?.focus(), 0);
      }
    }, 700);
  }

  function limpiarFormulario() {
    setCodigo("");
    setPin("");
    setError("");
    setExito(false);
    setCampoActivo("codigo");
    window.setTimeout(() => codigoRef.current?.focus(), 0);
  }

  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "borrar", "0", "limpiar"];

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#171044] px-3 py-5 text-slate-950 sm:px-6 sm:py-8">
      {/* Formas decorativas para que el fondo se sienta como una aventura. */}
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-fuchsia-600/30 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:rounded-[2.5rem] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative isolate flex min-h-64 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-800 px-6 py-8 text-center text-white sm:min-h-80 sm:px-10 lg:min-h-[690px]">
            <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rotate-12 rounded-[2.5rem] border-[18px] border-yellow-300/20" />
            <div aria-hidden="true" className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full border-[20px] border-cyan-300/20" />

            <div className="relative mb-5 flex h-36 w-36 items-center justify-center rounded-[2.5rem] border-4 border-white bg-yellow-300 shadow-[0_12px_0_#e89a00] motion-safe:animate-[bounce_3s_ease-in-out_infinite] sm:h-44 sm:w-44" aria-hidden="true">
              <svg viewBox="0 0 160 160" className="h-32 w-32 sm:h-40 sm:w-40" role="img" aria-label="Murciélago explorador">
                <path fill="#4f46e5" d="M23 83c-2-24 2-42 11-53 16 3 29 14 38 31h16c9-17 22-28 38-31 9 11 13 29 11 53-11-10-23-14-36-10-3 22-13 39-31 51-18-12-28-29-31-51-13-4-25 0-36 10Z" />
                <path fill="#312e81" d="M34 30c-11-10-23-12-32-7 9 9 13 20 13 33 7-8 14-12 22-13-3-5-4-9-3-13Zm92 0c11-10 23-12 32-7-9 9-13 20-13 33-7-8-14-12-22-13 3-5 4-9 3-13Z" />
                <path fill="#fff" d="M57 67a11 11 0 1 0 0 22 11 11 0 0 0 0-22Zm46 0a11 11 0 1 0 0 22 11 11 0 0 0 0-22Z" />
                <circle cx="61" cy="78" r="5" fill="#171044" />
                <circle cx="99" cy="78" r="5" fill="#171044" />
                <path fill="#fb7185" d="m80 87-9 9 9 7 9-7-9-9Z" />
                <path d="M70 108q10 11 20 0" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="5" />
                <path d="m53 118-5 14m59-14 5 14" stroke="#f97316" strokeLinecap="round" strokeWidth="8" />
              </svg>
              <span className="absolute -right-4 -top-4 flex h-12 w-12 rotate-12 items-center justify-center rounded-2xl border-2 border-white bg-orange-500 text-2xl font-black text-white shadow-lg" aria-hidden="true">!</span>
            </div>

            <p className="relative mb-3 rounded-full border-2 border-white/30 bg-white/15 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-yellow-200 sm:text-sm">Equipo Murciélago</p>
            <h1 className="relative max-w-md text-4xl font-black leading-[0.95] tracking-tight drop-shadow sm:text-5xl lg:text-6xl">¡La misión<br className="hidden sm:block" /> comienza aquí!</h1>
            <p className="relative mt-4 max-w-sm text-base font-semibold leading-relaxed text-white/90 sm:text-lg">Únete a la patrulla y explora los misterios de la naturaleza.</p>

            <div className="relative mt-6 flex items-center gap-2 rounded-2xl border border-white/20 bg-indigo-950/35 px-4 py-3 text-sm font-bold shadow-lg sm:text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-lg text-indigo-950" aria-hidden="true">?</span>
              <span>¿Listo para tu aventura?</span>
            </div>
          </aside>

          <div className="px-5 py-6 sm:px-9 sm:py-8 lg:px-12 lg:py-10">
            <div className="mb-5 flex items-center justify-between gap-3">
              <span className="rounded-full bg-orange-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-orange-900 sm:text-sm">Reto de acceso</span>
              <span className="text-xs font-extrabold text-slate-600 sm:text-sm">Misión 1 de 1</span>
            </div>
            <h2 className="text-center text-3xl font-black tracking-tight text-indigo-950 sm:text-4xl">¡A entrar al aula!</h2>
            <p className="mb-5 mt-2 text-center text-base font-medium text-slate-600">Usa los números de tu maestro para comenzar.</p>

            <div className="mb-5" aria-label={`Has completado ${avance} por ciento de los datos`}>
              <div className="mb-1.5 flex justify-between text-xs font-extrabold text-slate-600">
                <span>Tu misión</span><span>{avance}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-600 to-fuchsia-600 transition-all duration-300" style={{ width: `${avance}%` }} />
              </div>
            </div>

            <form onSubmit={validarAcceso} onKeyDown={manejarTecla} className="space-y-3.5">
              <div>
                <label htmlFor="codigo-aula" className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-200 text-sm font-black text-cyan-950">1</span>
                  Código del aula <span className="text-slate-600">(6 números)</span>
                </label>
                <input
                  ref={codigoRef}
                  id="codigo-aula"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={codigo}
                  onChange={manejarCambio}
                  onFocus={() => setCampoActivo("codigo")}
                  aria-describedby="ayuda-codigo"
                  aria-invalid={Boolean(error)}
                  disabled={cargando}
                  placeholder="Toca aquí o usa el teclado"
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-xl font-black tracking-[0.2em] outline-none transition placeholder:text-sm placeholder:font-bold placeholder:tracking-normal sm:text-2xl ${campoActivo === "codigo" ? "border-cyan-500 bg-cyan-50 ring-4 ring-cyan-100" : "border-slate-300 bg-white"} focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100 disabled:opacity-60`}
                />
                <span id="ayuda-codigo" className="sr-only">Código numérico de seis dígitos</span>
              </div>

              <div>
                <label htmlFor="pin-alumno" className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-200 text-sm font-black text-fuchsia-950">2</span>
                  Tu PIN secreto <span className="text-slate-600">(4 números)</span>
                </label>
                <input
                  ref={pinRef}
                  id="pin-alumno"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={manejarCambio}
                  onFocus={() => setCampoActivo("pin")}
                  aria-describedby="ayuda-pin"
                  aria-invalid={Boolean(error)}
                  disabled={cargando}
                  placeholder="Tu clave secreta"
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-xl font-black tracking-[0.45em] outline-none transition placeholder:text-sm placeholder:font-bold placeholder:tracking-normal sm:text-2xl ${campoActivo === "pin" ? "border-fuchsia-500 bg-fuchsia-50 ring-4 ring-fuchsia-100" : "border-slate-300 bg-white"} focus:border-fuchsia-600 focus:ring-4 focus:ring-fuchsia-100 disabled:opacity-60`}
                />
                <span id="ayuda-pin" className="sr-only">PIN numérico de cuatro dígitos</span>
              </div>

              <div aria-live="polite" className="min-h-7 text-center text-sm font-black">
                {error && <p className="rounded-xl bg-red-100 px-3 py-1.5 text-red-800">{error}</p>}
                {exito && <p className="rounded-xl bg-green-100 px-3 py-1.5 text-green-900">¡Misión cumplida! Ya puedes entrar.</p>}
              </div>

              <div className="rounded-[1.5rem] border-2 border-indigo-100 bg-indigo-50 p-2.5 shadow-inner" aria-label="Teclado numérico">
                <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-wide text-indigo-900">Teclado de la patrulla</p>
                <div className="grid grid-cols-3 gap-2">
                  {teclas.map((tecla) => {
                    if (tecla === "borrar") {
                      return <button key={tecla} type="button" onClick={borrarDigito} disabled={cargando} aria-label="Borrar último número" className="min-h-12 rounded-xl border-b-4 border-orange-700 bg-orange-400 text-sm font-black text-orange-950 transition hover:bg-orange-300 active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-50">Borrar</button>;
                    }
                    if (tecla === "limpiar") {
                      return <button key={tecla} type="button" onClick={limpiarFormulario} disabled={cargando} aria-label="Limpiar código y PIN" className="min-h-12 rounded-xl border-b-4 border-slate-400 bg-slate-200 text-sm font-black text-slate-900 transition hover:bg-white active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:opacity-50">Limpiar</button>;
                    }
                    return <button key={tecla} type="button" onClick={() => agregarDigito(tecla)} disabled={cargando || valorActivo.length >= longitudActiva} aria-label={`Número ${tecla}`} className="min-h-12 rounded-xl border-b-4 border-indigo-300 bg-white text-2xl font-black text-indigo-950 shadow-sm transition hover:border-fuchsia-400 hover:bg-yellow-100 active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-50">{tecla}</button>;
                  })}
                </div>
              </div>

              <button type="submit" disabled={cargando || codigo.length !== 6 || pin.length !== 4} className="group min-h-14 w-full rounded-2xl border-b-[6px] border-orange-700 bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-300 px-5 text-lg font-black text-orange-950 shadow-lg transition hover:brightness-105 active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:cursor-not-allowed disabled:border-slate-500 disabled:bg-slate-400 disabled:bg-none disabled:text-white">
                {cargando ? "¡El murciélago está revisando!" : "¡DESPEGAR A LA AVENTURA!"}
              </button>
              <p className="text-center text-xs font-semibold text-slate-600">¿No recuerdas tus números? Pide una pista a tu maestro.</p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
