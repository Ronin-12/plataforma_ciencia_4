import VisorClase from "./VisorClase";
import VisorJuego from "./VisorJuego";

// Elige el visor según el contenido: las clases interactivas tienen el suyo; el resto son juegos.
export default function VisorActividad(props) {
  return props.juego?.tipo_actividad === "clase" ? <VisorClase {...props} /> : <VisorJuego {...props} />;
}
