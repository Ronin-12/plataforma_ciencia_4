import { useState, useEffect } from 'react';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import PanelDocente from './components/PanelDocente';
import VisorJuego from './components/VisorJuego';
import { api } from './services/api';
import LandingPage from './components/LandingPage';
import GradientWaves from "./components/GradientWaves";
import ClickSpark from './components/ClickSpark';

function AppContent() {
  const [vista, setVista] = useState("inicio"); 
  const [alumno, setAlumno] = useState(null);
  const [docente, setDocente] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(null);
  
  const [juegosAlumno, setJuegosAlumno] = useState([]);

  // --- EFECTO PARA CARGAR LOS JUEGOS DEL ALUMNO ---
  useEffect(() => {
    if (vista === "menuAlumno") {
      const ID_DOCENTE_PRUEBA = "800a38f2-387d-4a89-9850-ff58c5294366"; 
      
      api.obtenerJuegosDocente(ID_DOCENTE_PRUEBA)
        .then((juegos) => setJuegosAlumno(juegos))
        .catch((err) => console.error("Error cargando juegos:", err));
    }
  }, [vista]);

  // --- LÓGICA DEL ALUMNO ---
  function manejarLoginAlumno(datosAlumno) {
    setAlumno(datosAlumno);
    setVista("menuAlumno");
  }

  function salirAlumno() {
    setAlumno(null);
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
    setVista("jugandoAlumno");
  }

  // --- LÓGICA DEL DOCENTE ---
  async function manejarLoginDocente(datos) {
    try {
      const respuesta = await api.loginDocente(datos.correo, datos.contrasena);
      setDocente({ nombre: "Maestro", token: respuesta.access_token });
      setVista("panelDocente");
    } catch (error) {
      throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.", { cause: error });
    }
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
          
          <VisorJuego juego={juegoActivo} />
        </div>
      </div>
    );
  }

  // 2. Menú del Alumno
  if (vista === "menuAlumno" && alumno) {
    return (
      <MenuAlumno 
        nombre={alumno.nombre} 
        juegos={juegosAlumno}
        onJugar={jugarJuego}
        onSalir={salirAlumno} 
      />
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
      <div className="relative min-h-screen overflow-hidden bg-[#071321]">
        <div aria-hidden="true" className="space-starfield pointer-events-none absolute inset-0 opacity-60" />
        <button onClick={() => setVista("inicio")} className="absolute left-4 top-4 z-50 rounded-full border border-white/20 bg-[#102337]/90 px-4 py-2 font-bold text-white shadow-lg backdrop-blur transition hover:bg-[#183b50] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200/30">
          ← Volver
        </button>
        <div className="relative z-10">
          <LoginAlumno onLoginExitoso={manejarLoginAlumno} />
        </div>
      </div>
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
          <LoginDocente modoInicial={vista === "registroDocente" ? "registro" : "login"} onLoginExitoso={manejarLoginDocente} />
        </div>
      </div>
    );
  }

  // Portada de la plataforma.
  return (
    <LandingPage
      onIrAlumno={() => setVista('loginAlumno')}
      onIrDocente={() => setVista('loginDocente')}
      onRegistroDocente={() => setVista('registroDocente')}
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
