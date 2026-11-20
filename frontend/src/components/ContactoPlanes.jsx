import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../services/api";

const CAMPO = "min-h-12 w-full rounded-xl border-2 border-[#d9d3ee] bg-white px-4 text-base text-[#22184a] outline-none transition placeholder:text-slate-400 focus:border-[#6b46c1] focus:ring-4 focus:ring-[#6b46c1]/20";
const ETIQUETA = "mb-1.5 block text-sm font-bold text-[#22184a]";

const PLANES_CONTACTO = [
  ["maestro", "Maestro (docente de escuela pública)"],
  ["docente", "Docente"],
  ["escuela", "Escuela (varios docentes)"],
  ["licencia", "Licencia para escuelas públicas (gobierno o fundación)"],
  ["otro", "Otro / tengo dudas"],
];

const VACIO = {
  nombre: "", email: "", telefono: "", escuela: "", tipo_escuela: "", cct: "",
  num_docentes: 1, mensaje: "", sitio_web: "", acepta_privacidad: false,
};

// Formulario de «Hablemos» de la sección Planes. Mupi no cobra en línea: con estos datos el equipo
// se pone en contacto para llegar a un acuerdo.
export default function ContactoPlanes({ planInicial, onCerrar, onVerPrivacidad }) {
  const [datos, setDatos] = useState({ ...VACIO, plan_interes: planInicial || "otro" });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [listo, setListo] = useState("");
  const primerCampo = useRef(null);
  const alCerrar = useRef(onCerrar);

  useEffect(() => { alCerrar.current = onCerrar; }, [onCerrar]);
  useEffect(() => {
    primerCampo.current?.focus();
    const alTeclear = (e) => { if (e.key === "Escape") alCerrar.current(); };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  const cambiar = (campo) => (e) => {
    const valor = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setDatos((d) => ({ ...d, [campo]: valor }));
    setError("");
  };

  async function enviar(evento) {
    evento.preventDefault();
    if (enviando) return;
    if (!datos.tipo_escuela) return setError("Indica si tu escuela es pública o privada.");
    if (!datos.acepta_privacidad) return setError("Para enviarnos tus datos debes aceptar el aviso de privacidad.");
    setEnviando(true);
    try {
      const respuesta = await api.enviarContacto({
        ...datos,
        telefono: datos.telefono.trim() || null,
        cct: datos.cct.trim() || null,
        mensaje: datos.mensaje.trim() || null,
        num_docentes: Number(datos.num_docentes) || 1,
        sitio_web: datos.sitio_web || null,
      });
      setListo(respuesta.mensaje);
    } catch (err) {
      setError(err?.message || "No se pudo enviar tu mensaje.");
    } finally {
      setEnviando(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[#22184a]/60 p-4 sm:p-8" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="titulo-contacto" className="relative w-full max-w-2xl rounded-[2rem] border-[3px] border-[#22184a] bg-[#fffdf7] p-6 text-[#22184a] shadow-[8px_8px_0_#22184a] sm:p-9">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-contacto" className="font-display text-3xl font-semibold">Hablemos de tu escuela</h2>
            <p className="mt-2 leading-7 text-[#4a3f7a]">Cuéntanos qué necesitas y te escribimos para acordar el plan. No cobramos en línea: cualquier precio se acuerda por escrito, con impuestos incluidos.</p>
          </div>
          <button type="button" onClick={onCerrar} className="shrink-0 rounded-full border-[3px] border-[#22184a] bg-white px-4 py-2 font-bold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">Cerrar</button>
        </header>

        {listo ? (
          <div className="mt-8 space-y-6 text-center">
            <p role="status" className="rounded-2xl border-[3px] border-[#22184a] bg-[#dcf7f0] px-5 py-4 text-lg font-semibold">{listo}</p>
            <button type="button" onClick={onCerrar} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-6 font-display font-semibold shadow-[3px_3px_0_#22184a]">Listo</button>
          </div>
        ) : (
          <form onSubmit={enviar} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="c-nombre" className={ETIQUETA}>Tu nombre</label>
              <input ref={primerCampo} id="c-nombre" required minLength={2} maxLength={100} autoComplete="name" value={datos.nombre} onChange={cambiar("nombre")} className={CAMPO} />
            </div>
            <div>
              <label htmlFor="c-email" className={ETIQUETA}>Correo</label>
              <input id="c-email" type="email" required maxLength={255} autoComplete="email" value={datos.email} onChange={cambiar("email")} className={CAMPO} />
            </div>
            <div>
              <label htmlFor="c-tel" className={ETIQUETA}>Teléfono o WhatsApp <span className="font-medium text-[#6b6290]">(opcional)</span></label>
              <input id="c-tel" type="tel" maxLength={20} autoComplete="tel" value={datos.telefono} onChange={cambiar("telefono")} placeholder="10 dígitos" className={CAMPO} />
            </div>
            <div>
              <label htmlFor="c-escuela" className={ETIQUETA}>Escuela</label>
              <input id="c-escuela" required minLength={2} maxLength={120} autoComplete="organization" value={datos.escuela} onChange={cambiar("escuela")} className={CAMPO} />
            </div>
            <fieldset className="sm:col-span-2">
              <legend className={ETIQUETA}>Tu escuela es</legend>
              <div className="grid grid-cols-2 gap-2">
                {[["publica", "Pública"], ["privada", "Privada"]].map(([valor, etiqueta]) => (
                  <label key={valor} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 font-bold ${datos.tipo_escuela === valor ? "border-[#6b46c1] bg-[#f1ecff]" : "border-[#d9d3ee] bg-white"}`}>
                    <input type="radio" name="c-tipo" value={valor} checked={datos.tipo_escuela === valor} onChange={cambiar("tipo_escuela")} className="sr-only" />
                    {etiqueta}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="c-cct" className={ETIQUETA}>CCT <span className="font-medium text-[#6b6290]">(opcional)</span></label>
              <input id="c-cct" maxLength={12} value={datos.cct} onChange={(e) => setDatos((d) => ({ ...d, cct: e.target.value.toUpperCase() }))} placeholder="Ej. 09DPR1234X" className={`${CAMPO} uppercase`} />
            </div>
            <div>
              <label htmlFor="c-docentes" className={ETIQUETA}>¿Cuántos docentes la usarían?</label>
              <input id="c-docentes" type="number" min={1} max={500} required value={datos.num_docentes} onChange={cambiar("num_docentes")} className={CAMPO} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="c-plan" className={ETIQUETA}>Me interesa</label>
              <select id="c-plan" value={datos.plan_interes} onChange={cambiar("plan_interes")} className={CAMPO}>
                {PLANES_CONTACTO.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="c-mensaje" className={ETIQUETA}>Mensaje <span className="font-medium text-[#6b6290]">(opcional)</span></label>
              <textarea id="c-mensaje" rows={3} maxLength={1000} value={datos.mensaje} onChange={cambiar("mensaje")} placeholder="¿Qué grados y materias? ¿Tienen computadoras o proyector?" className={`${CAMPO} py-3`} />
            </div>
            {/* Campo trampa para robots: las personas no lo ven ni lo llenan. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="c-web">No llenes este campo</label>
              <input id="c-web" tabIndex={-1} autoComplete="off" value={datos.sitio_web} onChange={cambiar("sitio_web")} />
            </div>
            <div className="flex items-start gap-3 sm:col-span-2">
              <input id="c-privacidad" type="checkbox" checked={datos.acepta_privacidad} onChange={cambiar("acepta_privacidad")} className="mt-1 h-5 w-5 shrink-0 accent-[#6b46c1]" />
              <label htmlFor="c-privacidad" className="text-sm leading-6 text-[#4a3f7a]">
                Acepto que Mupi use estos datos para contactarme, según el{" "}
                <button type="button" onClick={onVerPrivacidad} className="font-bold text-[#6b46c1] underline">aviso de privacidad</button>.
              </label>
            </div>
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:col-span-2">{error}</p>}
            <button type="submit" disabled={enviando} className="min-h-14 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-6 font-display text-lg font-semibold shadow-[4px_4px_0_#22184a] disabled:opacity-70 sm:col-span-2">
              {enviando ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}
      </section>
    </div>,
    document.body,
  );
}
