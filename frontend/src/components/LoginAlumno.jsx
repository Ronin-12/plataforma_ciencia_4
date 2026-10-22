import { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import MascotaMurcielago from "./MascotaMurcielago";
import AnimatedContent from "./AnimatedContent";
import FondoAventura from "./FondoAventura";

export default function LoginAlumno({ onLoginExitoso = () => {} }) {
  const [codigo, setCodigo] = useState("");
  const [pin, setPin] = useState("");
  const [campoActivo, setCampoActivo] = useState("codigo");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const codigoRef = useRef(null);
  const pinRef = useRef(null);
  const reducirMovimiento = useReducedMotion();

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

    // Acceso temporal de demostración mientras se conecta el inicio de sesión del alumno.
  window.setTimeout(() => {
    const accesoValido = codigo === "123456" && pin === "1234";
    setCargando(false);

    if (accesoValido) {
      setExito(true);
      // Notifica al padre que el login fue exitoso
      if (onLoginExitoso) {
        onLoginExitoso({
          nombre: "Sofía",           // Placeholder hasta conectar backend
          avatar: "",                 // Sin avatar por ahora
          puntuacion: 0,
        });
      }
    } else {
      setError("El acceso real aún no está conectado. En esta vista previa usa el código 123456 y el PIN 1234.");
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
    <main className="relative min-h-screen overflow-hidden bg-transparent px-3 py-5 text-slate-900 sm:px-6 sm:py-8">
      <FondoAventura />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-6xl items-center justify-center">
        <AnimatedContent trigger="mount" distance={24} duration={0.7} className="w-full">
        <section className="grid w-full overflow-hidden rounded-[2rem] border-4 border-white bg-white/80 shadow-[0_28px_90px_rgba(34,78,92,0.24)] backdrop-blur-xl sm:rounded-[2.5rem] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative isolate flex min-h-64 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-600 via-teal-600 to-emerald-700 px-6 py-8 text-center text-white sm:min-h-80 sm:px-10 lg:min-h-[690px]">
            <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rotate-12 rounded-[2.5rem] border-[18px] border-amber-100/10" />
            <div aria-hidden="true" className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full border-[20px] border-teal-100/10" />

            <motion.div animate={reducirMovimiento ? undefined : { y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }} className="relative mb-5 flex h-36 w-36 items-center justify-center rounded-[2.5rem] border-4 border-white/90 bg-gradient-to-br from-amber-200 to-orange-200 shadow-[0_8px_0_#c98436] sm:h-44 sm:w-44">
              <MascotaMurcielago className="h-32 w-32 sm:h-40 sm:w-40" />
              <span className="absolute -right-4 -top-4 flex h-12 w-12 rotate-12 items-center justify-center rounded-2xl border-2 border-white bg-[#bd7294] text-2xl font-black text-white shadow-lg" aria-hidden="true">✦</span>
            </motion.div>

            <p className="relative mb-3 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-amber-100 sm:text-sm">Equipo Murciélago</p>
            <h1 className="relative max-w-md text-4xl font-black leading-[0.95] tracking-tight drop-shadow sm:text-5xl lg:text-6xl">¡La misión<br className="hidden sm:block" /> comienza aquí!</h1>
            <p className="relative mt-4 max-w-sm text-base font-semibold leading-relaxed text-white/90 sm:text-lg">Únete a la patrulla y explora los misterios de la naturaleza.</p>

            <div className="relative mt-6 flex items-center gap-2 rounded-2xl border border-white/20 bg-indigo-950/35 px-4 py-3 text-sm font-bold shadow-lg sm:text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-200 text-lg text-[#173c49]" aria-hidden="true">?</span>
              <span>¿Listo para tu aventura?</span>
            </div>
          </aside>

          <div className="bg-white/85 px-5 py-6 backdrop-blur-lg sm:px-9 sm:py-8 lg:px-12 lg:py-10">
            <div className="mb-5 flex items-center justify-between gap-3">
            <span className="rounded-full bg-[#f6ead3] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-[#795323] sm:text-sm">Reto de acceso</span>
              <span className="text-xs font-extrabold text-slate-600 sm:text-sm">Misión 1 de 1</span>
            </div>
            <h2 className="text-center text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">¡A entrar al aula!</h2>
            <p className="mb-5 mt-2 text-center text-base font-medium text-slate-600">Usa los números de tu maestro para comenzar.</p>
            <p className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs font-semibold leading-relaxed text-amber-950">Vista previa: el acceso real se conectará al backend. Código temporal: <strong>123456</strong> · PIN: <strong>1234</strong>.</p>

            <div className="mb-5" aria-label={`Has completado ${avance} por ciento de los datos`}>
              <div className="mb-1.5 flex justify-between text-xs font-extrabold text-slate-600">
                <span>Tu misión</span><span>{avance}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500 transition-all duration-300" style={{ width: `${avance}%` }} />
              </div>
            </div>

            <form onSubmit={validarAcceso} onKeyDown={manejarTecla} className="space-y-3.5">
              <div>
                <label htmlFor="codigo-aula" className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-100 text-sm font-black text-teal-900">1</span>
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
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-2xl font-black tracking-[0.2em] text-slate-900 outline-none transition placeholder:text-sm placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-500 sm:text-3xl ${campoActivo === "codigo" ? "border-teal-600 bg-teal-50 ring-4 ring-teal-100" : "border-slate-300 bg-white"} focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:opacity-60`}
                />
                <span id="ayuda-codigo" className="sr-only">Código numérico de seis dígitos</span>
              </div>

              <div>
                <label htmlFor="pin-alumno" className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-900 sm:text-base">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-100 text-sm font-black text-violet-900">2</span>
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
                  className={`w-full rounded-2xl border-2 px-4 py-3.5 text-center text-2xl font-black tracking-[0.45em] text-slate-900 outline-none transition placeholder:text-sm placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-500 sm:text-3xl ${campoActivo === "pin" ? "border-violet-500 bg-violet-50 ring-4 ring-violet-100" : "border-slate-300 bg-white"} focus:border-violet-500 focus:ring-4 focus:ring-violet-100 disabled:opacity-60`}
                />
                <span id="ayuda-pin" className="sr-only">PIN numérico de cuatro dígitos</span>
              </div>

              <div aria-live="polite" className="min-h-7 text-center text-sm font-black">
                {error && <p className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-1.5 text-rose-800">{error}</p>}
                {exito && <p className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-emerald-800">¡Misión cumplida! Ya puedes entrar.</p>}
              </div>

              <div className="rounded-[1.5rem] border-2 border-indigo-100 bg-indigo-50/90 p-2.5" aria-label="Teclado numérico">
                <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-wide text-indigo-900">Teclado de la patrulla</p>
                <div className="grid grid-cols-3 gap-2">
                  {teclas.map((tecla, indice) => {
                    const coloresNumero = ["text-violet-700", "text-teal-700", "text-orange-700", "text-rose-700", "text-indigo-700", "text-emerald-700"];
                    if (tecla === "borrar") {
                      return <motion.button key={tecla} type="button" onClick={borrarDigito} disabled={cargando} whileHover={reducirMovimiento ? undefined : { y: -4, scale: 1.04 }} whileTap={reducirMovimiento ? undefined : { y: 3, scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 16 }} aria-label="Borrar último número" className="min-h-12 rounded-xl border-b-4 border-orange-700 bg-orange-400 text-sm font-black text-orange-950 transition hover:bg-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:opacity-50">Borrar</motion.button>;
                    }
                    if (tecla === "limpiar") {
                      return <motion.button key={tecla} type="button" onClick={limpiarFormulario} disabled={cargando} whileHover={reducirMovimiento ? undefined : { y: -4, scale: 1.04 }} whileTap={reducirMovimiento ? undefined : { y: 3, scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 16 }} aria-label="Limpiar código y PIN" className="min-h-12 rounded-xl border-b-4 border-slate-400 bg-slate-200 text-sm font-black text-slate-900 transition hover:bg-white focus:outline-none focus:ring-4 focus:ring-slate-300 disabled:opacity-50">Limpiar</motion.button>;
                    }
                    return <motion.button key={tecla} type="button" onClick={() => agregarDigito(tecla)} disabled={cargando || valorActivo.length >= longitudActiva} whileHover={reducirMovimiento ? undefined : { y: -4, scale: 1.06 }} whileTap={reducirMovimiento ? undefined : { y: 3, scale: 0.96 }} transition={{ type: "spring", stiffness: 360, damping: 16 }} aria-label={`Número ${tecla}`} className={`min-h-14 rounded-xl border-b-4 border-indigo-300 bg-white text-3xl font-black shadow-sm transition hover:border-indigo-500 hover:bg-amber-50 focus:outline-none focus:ring-4 focus:ring-indigo-300 disabled:opacity-50 ${coloresNumero[indice % coloresNumero.length]}`}>{tecla}</motion.button>;
                  })}
                </div>
              </div>

              <button type="submit" disabled={cargando || codigo.length !== 6 || pin.length !== 4} className="group min-h-14 w-full rounded-2xl border-b-[5px] border-orange-700 bg-gradient-to-r from-orange-400 to-amber-400 px-5 text-lg font-black text-orange-950 shadow-lg transition hover:-translate-y-0.5 hover:from-orange-300 hover:to-amber-300 active:translate-y-1 active:border-b-0 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:cursor-not-allowed disabled:border-slate-400 disabled:bg-slate-300 disabled:bg-none disabled:text-slate-600">
                {cargando ? "¡El murciélago está revisando!" : "¡DESPEGAR A LA AVENTURA!"}
              </button>
              <p className="text-center text-xs font-semibold text-slate-600">¿No recuerdas tus números? Pide una pista a tu maestro.</p>
            </form>
          </div>
        </section>
        </AnimatedContent>
      </div>
    </main>
  );
}
