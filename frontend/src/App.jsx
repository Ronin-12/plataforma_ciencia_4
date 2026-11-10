import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import PanelDocente from './components/PanelDocente';
import VisorJuego from './components/VisorJuego';
import { api } from './services/api';
import LandingPage from './components/LandingPage';
import MascotaMurcielago from './components/MascotaMurcielago';
import GradientWaves from "./components/GradientWaves";
import ClickSpark from './components/ClickSpark';

function VistaConVuelo({ children, activo }) {
  return <>
    {children}
    <AnimatePresence>
      {activo && <motion.div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[100] h-20 w-20 sm:h-28 sm:w-28" initial={{ x: "-12vw", y: "78vh", rotate: -18, scale: 0.7, opacity: 0 }} animate={{ x: ["-12vw", "36vw", "108vw"], y: ["78vh", "30vh", "-16vh"], rotate: [-18, 12, 28], scale: [0.7, 1.05, 0.82], opacity: [0, 1, 1] }} exit={{ opacity: 0, scale: 0.7 }} transition={{ duration: 1.25, ease: "easeInOut" }}>
        <MascotaMurcielago className="h-full w-full" label="Murciélago volando hacia tu aventura" />
      </motion.div>}
    </AnimatePresence>
  </>;
}

function AppContent() {
  const [vista, setVista] = useState("inicio"); 
  const [alumno, setAlumno] = useState(null);
  const [docente, setDocente] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(null);
  const [idJuegoActivo, setIdJuegoActivo] = useState(null);
  const [estadoResultado, setEstadoResultado] = useState(null); // null | guardando | ok | error
  const [puntosAlumno, setPuntosAlumno] = useState(0);
  
  const [juegosAlumno, setJuegosAlumno] = useState([]);
  const [vueloMurcielago, setVueloMurcielago] = useState(false);
  const timersVuelo = useRef([]);
  const reducirMovimiento = useReducedMotion();

  // Si el servidor dice que la sesión venció, se cierra y se vuelve a la portada.
  useEffect(() => {
    api.alExpirarSesion(() => {
      setAlumno(null);
      setDocente(null);
      setJuegoActivo(null);
      setJuegosAlumno([]);
      setPuntosAlumno(0);
      setVista("inicio");
    });
  }, []);

  useEffect(() => () => timersVuelo.current.forEach((timer) => window.clearTimeout(timer)), []);

  // --- EFECTO PARA CARGAR LOS JUEGOS DEL ALUMNO (los de su docente, según su sesión) ---
  useEffect(() => {
    if (vista === "menuAlumno" && alumno?.token) {
      api.obtenerJuegos(alumno.token)
        .then((juegos) => setJuegosAlumno(juegos))
        .catch((err) => console.error("Error cargando juegos:", err));
    }
  }, [vista, alumno]);

  // Puntos reales del alumno: se actualizan cada vez que vuelve al menú.
  useEffect(() => {
    if (vista === "menuAlumno" && alumno?.token) {
      api.obtenerMisPuntos(alumno.token)
        .then((datos) => setPuntosAlumno(datos.puntos_totales))
        .catch((err) => console.error("Error cargando puntos:", err));
    }
  }, [vista, alumno]);

  // --- LÓGICA DEL ALUMNO ---
  function manejarLoginAlumno(datosAlumno) {
    setAlumno(datosAlumno);
    if (reducirMovimiento) {
      setVista("menuAlumno");
      return;
    }
    timersVuelo.current.forEach((timer) => window.clearTimeout(timer));
    timersVuelo.current = [];
    setVueloMurcielago(true);
    timersVuelo.current.push(window.setTimeout(() => setVista("menuAlumno"), 720));
    timersVuelo.current.push(window.setTimeout(() => setVueloMurcielago(false), 1420));
  }

  function salirAlumno() {
    setAlumno(null);
    setJuegosAlumno([]);
    setPuntosAlumno(0);
    setJuegoActivo(null);
    setVista("inicio");
  }

  function jugarJuego(juego) {
    let contenido = juego?.contenido_juego ?? juego?.juego ?? juego;
    if (typeof contenido === "string") {
      try {
        contenido = JSON.parse(contenido);
      } catch {
        contenido = null;
      }
    }
    setJuegoActivo(contenido);
    setIdJuegoActivo(juego?.id_juego ?? null);
    setEstadoResultado(null);
    setVista("jugandoAlumno");
  }

  // Al terminar un juego se guarda el resultado en el servidor (RF-05).
  const guardarResultadoAlumno = useCallback(async (resultado) => {
    if (!alumno?.token || !idJuegoActivo) return;
    setEstadoResultado("guardando");
    try {
      await api.guardarResultado(
        { idJuego: idJuegoActivo, puntuacion: resultado.puntuacion, tiempo: resultado.segundos },
        alumno.token,
      );
      setEstadoResultado("ok");
    } catch (error) {
      console.error("No se pudo guardar el resultado:", error);
      setEstadoResultado("error");
    }
  }, [alumno, idJuegoActivo]);

  // --- LÓGICA DEL DOCENTE ---
  async function manejarLoginDocente(datos) {
    try {
      const { token, docente: perfil } = await api.loginDocente(datos.correo, datos.contrasena);
      if (perfil.rol !== "docente") {
        throw new Error("Esta cuenta es de administrador y el panel de administración aún no está disponible.");
      }
      setDocente({ nombre: perfil.nombre, token });
      setVista("panelDocente");
    } catch (error) {
      if (error.estado === 429) throw error; // cuenta bloqueada: se muestra el aviso del servidor
      if (error.estado === 0) throw error; // sin conexión con el servidor
      if (error.estado === 401) {
        throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.", { cause: error });
      }
      throw error;
    }
  }

  async function manejarRegistroDocente({ nombre, correo, contrasena, codigoInvitacion }) {
    await api.registrarDocente({ nombre, email: correo, password: contrasena, codigoInvitacion });
  }

  function salirDocente() {
    setDocente(null);
    setVista("inicio");
  }

  // --- RENDERIZADO DE PANTALLAS ---

  // 1. Pantalla de Juego (Para el alumno)
  if (vista === "jugandoAlumno") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-cyan-100 via-amber-50 to-rose-100 px-4 py-8">
        {/* Fondo con ondas suaves */}
        <div className="absolute inset-0 z-0 opacity-60">
          <GradientWaves waveColor="#38bdf8" amplitude={1.5} swell={20} lightAngle={90} speed={0.2} />
        </div>

        <div className="relative mx-auto flex max-w-5xl flex-col items-center z-10">
          <button 
            onClick={() => setVista("menuAlumno")} 
            className="mb-6 self-start rounded-full border-2 border-white bg-white/90 px-5 py-3 font-extrabold text-slate-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-300"
          >
            ← Volver al menú
          </button>
          
          <VisorJuego juego={juegoActivo} onTerminar={guardarResultadoAlumno} onReiniciar={() => setEstadoResultado(null)} estadoResultado={estadoResultado} />
        </div>
      </div>
    );
  }

  // 2. Menú del Alumno
  if (vista === "menuAlumno" && alumno) {
    return (
      <VistaConVuelo activo={vueloMurcielago}>
      <MenuAlumno 
        nombre={alumno.nombre}
        avatar={alumno.avatar}
        puntuacion={puntosAlumno}
        juegos={juegosAlumno}
        onJugar={jugarJuego}
        onSalir={salirAlumno} 
      />
      </VistaConVuelo>
    );
  }

  // 3. Panel del Docente
  if (vista === "panelDocente" && docente) {
    return (
      <PanelDocente 
        nombreDocente={docente.nombre} 
        tokenDocente={docente.token} 
        onCerrarSesion={salirDocente} 
      />
    );
  }

  // 4. Login Alumno
  if (vista === "loginAlumno") {
    return (
      <VistaConVuelo activo={vueloMurcielago}>
      <div className="relative min-h-screen overflow-hidden bg-[#071321]">
        <div aria-hidden="true" className="space-starfield pointer-events-none absolute inset-0 opacity-60" />
        <button onClick={() => setVista("inicio")} className="absolute left-4 top-4 z-50 rounded-full border border-white/20 bg-[#102337]/90 px-4 py-2 font-bold text-white shadow-lg backdrop-blur transition hover:bg-[#183b50] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/30">
          ← Volver
        </button>
        <div className="relative z-10">
          <LoginAlumno onLoginExitoso={manejarLoginAlumno} />
        </div>
      </div>
      </VistaConVuelo>
    );
  }

  // 5. Login Docente
  if (vista === "loginDocente" || vista === "registroDocente") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#071321]">
        <div aria-hidden="true" className="space-starfield pointer-events-none absolute inset-0 opacity-60" />
        <button onClick={() => setVista("inicio")} className="absolute left-4 top-4 z-50 rounded-full border border-white/20 bg-[#102337]/90 px-4 py-2 font-bold text-white shadow-lg backdrop-blur transition hover:bg-[#183b50] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/30">
          ← Volver
        </button>
        <div className="relative z-10">
          <LoginDocente modoInicial={vista === "registroDocente" ? "registro" : "login"} onLoginExitoso={manejarLoginDocente} onRegistro={manejarRegistroDocente} />
        </div>
      </div>
    );
  }

  // Portada de la plataforma.
  return (
    <LandingPage
      onIrAlumno={() => setVista('loginAlumno')}
      onIrDocente={() => setVista('loginDocente')}
    />
  );
}

export default function App() {
  return (
    <ClickSpark
      className="min-h-screen"
      sparkColor={["#f59e0b", "#14b8a6", "#fb7185"]}
      sparkSize={10}
      sparkRadius={28}
      sparkCount={7}
      duration={420}
      shape="star"
      layer="front"
    >
      <AppContent />
    </ClickSpark>
  );
}
