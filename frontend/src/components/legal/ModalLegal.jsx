import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AvisoFamilias, AvisoPrivacidad, Terminos } from "./documentosLegales";

const DOCUMENTOS = {
  privacidad: { titulo: "Aviso de privacidad", Contenido: AvisoPrivacidad },
  terminos: { titulo: "Términos y condiciones", Contenido: Terminos },
  familias: { titulo: "Aviso para familias", Contenido: AvisoFamilias },
};

// Muestra un documento legal (privacidad, términos o aviso para familias) encima de la pantalla.
// Se cierra con Escape, con el botón o tocando fuera. El de familias se puede imprimir.
export default function ModalLegal({ documento, onCerrar }) {
  const cerrar = useRef(null);
  const alCerrar = useRef(onCerrar);
  const doc = DOCUMENTOS[documento];

  useEffect(() => { alCerrar.current = onCerrar; }, [onCerrar]);

  useEffect(() => {
    if (!doc) return undefined;
    cerrar.current?.focus();
    const alTeclear = (e) => { if (e.key === "Escape") alCerrar.current(); };
    document.addEventListener("keydown", alTeclear);
    // Al imprimir solo debe salir el documento, no la página de atrás (ver index.css).
    document.body.dataset.legalAbierto = "";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      delete document.body.dataset.legalAbierto;
    };
  }, [doc]);

  if (!doc) return null;
  const { titulo, Contenido } = doc;

  return createPortal(
    <div
      className="legal-capa fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#22184a]/60 p-4 sm:p-8 print:static print:bg-white print:p-0"
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-legal"
        className="documento-legal relative w-full max-w-3xl rounded-[2rem] border-[3px] border-[#22184a] bg-white p-6 text-left shadow-[8px_8px_0_#22184a] sm:p-10 print:border-0 print:shadow-none"
      >
        <header className="flex items-start justify-between gap-4">
          <h2 id="titulo-legal" className="font-display text-3xl font-semibold text-[#22184a]">{titulo}</h2>
          <button
            ref={cerrar}
            type="button"
            onClick={onCerrar}
            className="shrink-0 rounded-full border-[3px] border-[#22184a] bg-[#f1ecff] px-4 py-2 font-bold text-[#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 print:hidden"
          >
            Cerrar
          </button>
        </header>
        <div className="mt-4 text-base">
          <Contenido />
        </div>
        <footer className="mt-8 flex flex-wrap gap-3 print:hidden">
          {documento === "familias" && (
            <button type="button" onClick={() => window.print()} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-5 font-display font-semibold shadow-[3px_3px_0_#22184a]">
              Imprimir o guardar como PDF
            </button>
          )}
          <button type="button" onClick={onCerrar} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-white px-5 font-display font-semibold shadow-[3px_3px_0_#22184a]">
            Volver
          </button>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
