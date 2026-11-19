// Sonidos suaves hechos con el propio navegador (sin archivos de audio). Si no hay soporte, no pasa nada.
let contexto = null;

function obtenerContexto() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return null;
  if (!contexto || contexto.state === "closed") contexto = new Contexto();
  if (contexto.state === "suspended") contexto.resume?.();
  return contexto;
}

function nota(audio, frecuencia, inicio, duracion, volumen = 0.1, tipo = "sine") {
  const oscilador = audio.createOscillator();
  const ganancia = audio.createGain();
  oscilador.type = tipo;
  oscilador.frequency.value = frecuencia;
  const t0 = audio.currentTime + inicio;
  ganancia.gain.setValueAtTime(0.0001, t0);
  ganancia.gain.exponentialRampToValueAtTime(volumen, t0 + 0.03);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, t0 + duracion);
  oscilador.connect(ganancia);
  ganancia.connect(audio.destination);
  oscilador.start(t0);
  oscilador.stop(t0 + duracion + 0.02);
}

/** Acierto: dos notas que suben. Error: una nota grave y corta (nunca un sonido fuerte ni burlón). */
export function sonarRespuesta(correcta) {
  try {
    const audio = obtenerContexto();
    if (!audio) return;
    if (correcta) { nota(audio, 660, 0, 0.16); nota(audio, 880, 0.12, 0.22); }
    else nota(audio, 300, 0, 0.22, 0.08);
  } catch { /* El juego funciona igual sin sonido. */ }
}

/** Final del juego: arpegio alegre si salió muy bien, una sola nota amable si no. */
export function sonarFinal(porcentaje) {
  try {
    const audio = obtenerContexto();
    if (!audio) return;
    if (porcentaje >= 80) [523, 659, 784, 1047].forEach((f, i) => nota(audio, f, i * 0.12, 0.3, 0.1));
    else nota(audio, 440, 0, 0.35, 0.08);
  } catch { /* Opcional. */ }
}
