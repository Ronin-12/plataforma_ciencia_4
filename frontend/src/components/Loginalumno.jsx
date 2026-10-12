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

  function actualizarCampo(valor) {
    if (campoActivo === "codigo") {
      setCodigo(valor.slice(0, 6));
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
    const soloDigitos = evento.target.value.replace(/\D/g, "");
    actualizarCampo(soloDigitos);
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
      console.log("Validación de alumno simulada:", {
        codigo,
        pin,
        accesoValido,
      });
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

  const teclas = [
    "1", "2", "3",
    "4", "5", "6",
    "7", "8", "9",
    "borrar", "0", "limpiar",
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-sky-100 via-yellow-50 to-pink-100 px-4 py-6 text-slate-900 sm:px-6 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-4 ring-white sm:grid-cols-[0.9fr_1.1fr]">
          <div className="flex flex-col items-center justify-center bg-indigo-700 px-6 py-8 text-center text-white sm:px-8 sm:py-12">
            <div
              className="mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-yellow-300 shadow-lg sm:h-36 sm:w-36"
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 128 128"
                className="h-20 w-20 sm:h-28 sm:w-28"
                role="img"
                aria-label="Murciélago"
              >
                <path
                  fill="#1e1b4b"
                  d="M64 31c-10-14-30-17-42-9 8 8 9 17 7 25-8-8-18-10-25-7 7 8 9 18 8 28 9-5 18-5 27 0 4 16 13 28 25 34 12-6 21-18 25-34 9-5 18-5 27 0-1-10 1-20 8-28-7-3-17-1-25 7-2-8-1-17 7-25-12-8-32-5-42 9Z"
                />
                <path
                  fill="#fef08a"
                  d="M47 54a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm34 0a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z"
                />
                <circle cx="47" cy="61" r="3" fill="#111827" />
                <circle cx="81" cy="61" r="3" fill="#111827" />
                <path
                  d="M58 74q6 7 12 0"
                  fill="none"
                  stroke="#fff"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
            </div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-yellow-200">
              Equipo Murciélago
            </p>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl">
              ¡Hola, explorador!
            </h1>
            <p className="mt-3 max-w-xs text-base text-indigo-100 sm:text-lg">
              Entra a tu aula y descubre los secretos de la naturaleza.
            </p>
          </div>

          <div className="px-5 py-7 sm:px-10 sm:py-10">
            <h2 className="text-center text-2xl font-black text-indigo-950 sm:text-3xl">
              Entrada de alumno
            </h2>
            <p className="mb-6 mt-2 text-center text-slate-600">
              Escribe los números que te dio tu maestro.
            </p>

            <form
              onSubmit={validarAcceso}
              onKeyDown={manejarTecla}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="codigo-aula"
                  className="mb-1.5 block text-sm font-extrabold text-slate-800"
                >
                  Código del aula (6 números)
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
                  placeholder="••••••"
                  className="w-full rounded-2xl border-2 border-indigo-200 bg-indigo-50 px-4 py-3 text-center text-2xl font-black tracking-[0.45em] text-indigo-950 outline-none transition focus:border-indigo-600 focus:ring-4 focus:ring-indigo-200 disabled:opacity-60"
                />
                <span id="ayuda-codigo" className="sr-only">
                  Código numérico de seis dígitos
                </span>
              </div>

              <div>
                <label
                  htmlFor="pin-alumno"
                  className="mb-1.5 block text-sm font-extrabold text-slate-800"
                >
                  Tu PIN secreto (4 números)
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
                  placeholder="••••"
                  className="w-full rounded-2xl border-2 border-pink-200 bg-pink-50 px-4 py-3 text-center text-2xl font-black tracking-[0.55em] text-indigo-950 outline-none transition focus:border-pink-600 focus:ring-4 focus:ring-pink-200 disabled:opacity-60"
                />
                <span id="ayuda-pin" className="sr-only">
                  PIN numérico de cuatro dígitos
                </span>
              </div>

              <div aria-live="polite" className="min-h-6 text-center text-sm font-bold">
                {error && <p className="text-red-700">{error}</p>}
                {exito && (
                  <p className="text-green-800">
                    ¡Muy bien! Ya puedes entrar a tu aula.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5" aria-label="Teclado numérico">
                {teclas.map((tecla) => {
                  if (tecla === "borrar") {
                    return (
                      <button
                        key={tecla}
                        type="button"
                        onClick={borrarDigito}
                        disabled={cargando}
                        aria-label="Borrar último número"
                        className="min-h-14 rounded-2xl border-2 border-orange-300 bg-orange-100 text-sm font-extrabold text-orange-950 shadow-sm transition hover:bg-orange-200 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-50"
                      >
                        Borrar
                      </button>
                    );
                  }
                  if (tecla === "limpiar") {
                    return (
                      <button
                        key={tecla}
                        type="button"
                        onClick={limpiarFormulario}
                        disabled={cargando}
                        aria-label="Limpiar código y PIN"
                        className="min-h-14 rounded-2xl border-2 border-slate-300 bg-slate-100 text-sm font-extrabold text-slate-900 shadow-sm transition hover:bg-slate-200 focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:opacity-50"
                      >
                        Limpiar
                      </button>
                    );
                  }
                  return (
                    <button
                      key={tecla}
                      type="button"
                      onClick={() => agregarDigito(tecla)}
                      disabled={cargando}
                      className="min-h-14 rounded-2xl border-2 border-indigo-200 bg-white text-2xl font-black text-indigo-950 shadow-sm transition hover:border-indigo-500 hover:bg-indigo-50 active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-50"
                    >
                      {tecla}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                disabled={cargando || codigo.length !== 6 || pin.length !== 4}
                className="min-h-14 w-full rounded-2xl bg-emerald-600 px-5 text-lg font-black text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-300 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {cargando ? "Revisando..." : "¡Entrar al aula!"}
              </button>
              <p className="text-center text-xs text-slate-600">
                ¿No recuerdas tus números? Pide ayuda a tu maestro.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}