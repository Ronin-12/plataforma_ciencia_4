// Lectura en voz alta con la voz del propio navegador (Web Speech API). No envía nada a internet
// desde nuestra app y no cuesta nada. Si el navegador no la trae, los botones simplemente no aparecen.

export function vozDisponible() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

function elegirVoz() {
  const voces = window.speechSynthesis.getVoices();
  // Primero español de México, luego cualquier español.
  return voces.find((v) => v.lang?.toLowerCase().replace("_", "-") === "es-mx")
    ?? voces.find((v) => v.lang?.toLowerCase().startsWith("es"))
    ?? null;
}

export function detenerLectura() {
  if (vozDisponible()) window.speechSynthesis.cancel();
}

/** Lee el texto en español, un poco más despacio de lo normal para que lo siga un niño. */
export function leerEnVozAlta(texto, { alTerminar } = {}) {
  if (!vozDisponible() || !texto?.trim()) return;
  window.speechSynthesis.cancel();
  const frase = new window.SpeechSynthesisUtterance(texto);
  frase.lang = "es-MX";
  frase.rate = 0.9;
  const voz = elegirVoz();
  if (voz) frase.voice = voz;
  if (alTerminar) { frase.onend = alTerminar; frase.onerror = alTerminar; }
  window.speechSynthesis.speak(frase);
}

/** Texto que se lee de cada reto: la pregunta y, si hay, las opciones. */
export function textoParaLeer(tipo, pregunta, titulo) {
  if (!pregunta) return "";
  const hueco = (t) => String(t ?? "").replace(/_{2,}/g, " espacio en blanco ");
  if (tipo === "quiz") {
    const opciones = (pregunta.opciones ?? []).map((o, i) => `Opción ${String.fromCharCode(65 + i)}: ${o}.`).join(" ");
    return `${pregunta.pregunta}. ${opciones}`;
  }
  if (tipo === "verdadero_falso") return `${pregunta.afirmacion}. ¿Es verdad o no es verdad?`;
  if (tipo === "completar") return hueco(pregunta.frase);
  if (tipo === "clasificar") {
    return `${pregunta.consigna}. Las cajas son: ${(pregunta.categorias ?? []).join(", ")}. Las tarjetas son: ${(pregunta.elementos ?? []).map((e) => e.texto).join(", ")}.`;
  }
  if (tipo === "linea_tiempo") {
    return `${pregunta.consigna}. Los momentos son: ${(pregunta.eventos ?? []).map((e) => e.etiqueta).join(", ")}.`;
  }
  return pregunta.consigna ?? titulo ?? "";
}
