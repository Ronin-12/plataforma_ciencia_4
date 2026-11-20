import { useState, useEffect, useCallback } from 'react';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import PanelAdmin from './components/PanelAdmin';
import PanelDocente from './components/PanelDocente';
import VisorActividad from './components/VisorActividad';
import { api } from './services/api';
import LandingPage from './components/LandingPage';
import GradientWaves from "./components/GradientWaves";
import ClickSpark from './components/ClickSpark';

function AppContent() {
  const [vista, setVista] = useState("inicio"); 
  const [alumno, setAlumno] = useState(null);
  const [docente, setDocente] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(null);
  const [idJuegoActivo, setIdJuegoActivo] = useState(null);
  const [estadoResultado, setEstadoResultado] = useState(null); // null | guardando | ok | error
  const [puntosAlumno, setPuntosAlumno] = useState(0);
  // Avance por juego: { [id_juego]: { mejor, intentos } }. Sirve para marcar lo ya realizado.
  const [avanceAlumno, setAvanceAlumno] = useState({});
  // Insignias del alumno (nivel y progreso) y las que ganó justo con la última actividad.
  const [logrosAlumno, setLogrosAlumno] = useState(null);
  const [logrosNuevos, setLogrosNuevos] = useState([]);
  
  const [juegosAlumno, setJuegosAlumno] = useState([]);

  // Si el servidor dice que la sesión venció, se cierra y se vuelve a la portada.
  useEffect(() => {
    api.alExpirarSesion(() => {
      setAlumno(null);
      setDocente(null);
      setAdmin(null);
      setJuegoActivo(null);
      setJuegosAlumno([]);
      setPuntosAlumno(0);
      setAvanceAlumno({});
      setLogrosAlumno(null);
      setLogrosNuevos([]);
      setVista("inicio");
    });
  }, []);

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
        .then((datos) => {
          setPuntosAlumno(datos.puntos_totales);
          // Se indexa por id para que cada tarjeta consulte "¿ya la hice?" sin recorrer listas.
          setAvanceAlumno(Object.fromEntries((datos.por_juego ?? []).map((f) => [f.id_juego, { mejor: f.mejor, intentos: f.intentos }])));
          setLogrosAlumno(datos.logros ?? null);
        })
        .catch((err) => console.error("Error cargando puntos:", err));
    }
  }, [vista, alumno]);

  // --- LÓGICA DEL ALUMNO ---
  function manejarLoginAlumno(datosAlumno) {
    setAlumno(datosAlumno);
    setVista("menuAlumno");
  }

  function salirAlumno() {
    setAlumno(null);
    setJuegosAlumno([]);
    setPuntosAlumno(0);
    setAvanceAlumno({});
    setLogrosAlumno(null);
    setLogrosNuevos([]);
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
    setLogrosNuevos([]);
    setVista("jugandoAlumno");
  }

  // Al terminar un juego se guarda el resultado en el servidor (RF-05).
  const guardarResultadoAlumno = useCallback(async (resultado) => {
    if (!alumno?.token || !idJuegoActivo) return;
    setEstadoResultado("guardando");
    try {
      const guardado = await api.guardarResultado(
        { idJuego: idJuegoActivo, puntuacion: resultado.puntuacion, tiempo: resultado.segundos },
        alumno.token,
      );
      setLogrosNuevos(guardado?.logros_nuevos ?? []);
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
      if (perfil.rol === "administrador") {
        setAdmin({ nombre: perfil.nombre, token });
        setVista("panelAdmin");
        return;
      }
      if (perfil.rol !== "docente") {
        throw new Error("Esta cuenta no tiene un panel disponible.");
      }
      setDocente({ nombre: perfil.nombre, escuela: perfil.escuela, token });
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

  async function manejarRegistroDocente({ nombre, correo, contrasena, codigoInvitacion, escuela }) {
    await api.registrarDocente({ nombre, email: correo, password: contrasena, codigoInvitacion, escuela });
  }

  function salirDocente() {
    setDocente(null);
    setAdmin(null);
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

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center">
          <button 
            onClick={() => setVista("menuAlumno")} 
            className="mb-6 self-start rounded-full border-[3px] border-[#22184a] bg-white px-5 py-3 font-extrabold text-[#22184a] shadow-[3px_3px_0_#22184a] transition hover:-translate-y-0.5 hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40"
          >
            ← Volver al menú
          </button>
          
          <VisorActividad
            juego={juegoActivo}
            nombreAlumno={alumno?.nombre}
            avatarAlumno={alumno?.avatar}
            onTerminar={guardarResultadoAlumno}
            onReiniciar={() => { setEstadoResultado(null); setLogrosNuevos([]); }}
            onVolverMenu={() => setVista("menuAlumno")}
            estadoResultado={estadoResultado}
            logrosNuevos={logrosNuevos}
          />
        </div>
      </div>
    );
  }

  // 2. Menú del Alumno
  if (vista === "menuAlumno" && alumno) {
    return (
      <MenuAlumno 
        nombre={alumno.nombre}
        avatar={alumno.avatar}
        puntuacion={puntosAlumno}
        juegos={juegosAlumno}
        avance={avanceAlumno}
        logros={logrosAlumno}
        token={alumno.token}
        onJugar={jugarJuego}
        onSalir={salirAlumno} 
      />
    );
  }

  // 3a. Panel del Administrador
  if (vista === "panelAdmin" && admin) {
    return <PanelAdmin nombreAdmin={admin.nombre} tokenAdmin={admin.token} onCerrarSesion={salirDocente} />;
  }

  // 3. Panel del Docente
  if (vista === "panelDocente" && docente) {
    return (
      <PanelDocente 
        nombreDocente={docente.nombre} 
        escuelaDocente={docente.escuela} 
        tokenDocente={docente.token} 
        onCerrarSesion={salirDocente} 
      />
    );
  }

  // 4. Login Alumno
  if (vista === "loginAlumno") {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#f6f4ff]">
        <button onClick={() => setVista("inicio")} className="absolute left-4 top-4 z-50 rounded-full border-[3px] border-[#22184a] bg-white px-4 py-2 font-bold text-[#22184a] shadow-[3px_3px_0_#22184a] transition hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
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
      <div className="relative min-h-screen overflow-hidden bg-[#f6f4ff]">
        <button onClick={() => setVista("inicio")} className="absolute left-4 top-4 z-50 rounded-full border-[3px] border-[#22184a] bg-white px-4 py-2 font-bold text-[#22184a] shadow-[3px_3px_0_#22184a] transition hover:bg-[#ece6ff] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
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
      sparkColor={["#ffc93c", "#2bc4a8", "#6b46c1"]}
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
