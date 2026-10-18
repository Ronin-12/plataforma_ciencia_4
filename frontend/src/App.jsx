import { useState, useEffect } from 'react';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import PanelDocente from './components/PanelDocente';
import VisorJuego from './components/VisorJuego';
import MascotaMurcielago from './components/MascotaMurcielago';
import { api } from './services/api';

function App() {
  const [vista, setVista] = useState("inicio"); 
  const [alumno, setAlumno] = useState(null);
  const [docente, setDocente] = useState(null);
  const [juegoActivo, setJuegoActivo] = useState(null);
  
  // Estado para guardar los juegos que le llegan al alumno
  const [juegosAlumno, setJuegosAlumno] = useState([]);

  // --- EFECTO PARA CARGAR LOS JUEGOS DEL ALUMNO ---
  useEffect(() => {
    if (vista === "menuAlumno") {
      // PEGAMOS TU ID DE DOCENTE AQUÍ
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
      throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.");
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
        <div aria-hidden="true" className="pointer-events-none absolute -left-16 top-28 h-56 w-56 rounded-full bg-lime-300/40 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 bottom-10 h-64 w-64 rounded-full bg-pink-300/40 blur-3xl" />
        <div className="relative mx-auto flex max-w-5xl flex-col items-center">
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
      <div className="relative">
        <button onClick={() => setVista("inicio")} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow font-bold text-indigo-900 hover:bg-slate-100">
          ← Volver
        </button>
        <LoginAlumno onLoginExitoso={manejarLoginAlumno} />
      </div>
    );
  }

  // 5. Login Docente
  if (vista === "loginDocente") {
    return (
      <div className="relative">
        <button onClick={() => setVista("inicio")} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow font-bold text-indigo-900 hover:bg-slate-100">
          ← Volver
        </button>
        <LoginDocente onLoginExitoso={manejarLoginDocente} />
      </div>
    );
  }

  // 6. Pantalla de Bienvenida (Elegir rol)
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sky-400 via-cyan-300 to-emerald-300 px-4 py-12">
      <div aria-hidden="true" className="absolute -left-16 top-12 h-72 w-72 rounded-full bg-yellow-300/70 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-pink-300/60 blur-3xl" />
      <div className="relative mb-4 rounded-[2rem] border-4 border-white/80 bg-white/70 p-3 shadow-xl backdrop-blur">
        <MascotaMurcielago className="h-28 w-28 sm:h-36 sm:w-36" />
      </div>
      <p className="relative mb-2 rounded-full bg-white/80 px-5 py-2 text-sm font-black uppercase tracking-[0.18em] text-indigo-800 shadow-sm">Equipo Murciélago</p>
      <h1 className="relative mb-3 text-center text-4xl font-black text-slate-800 sm:text-5xl">¡La ciencia es una aventura!</h1>
      <p className="relative mb-10 max-w-xl text-center text-lg font-semibold text-slate-700 sm:text-xl">Aprende, juega y descubre algo increíble cada día.</p>
      
      <div className="relative flex flex-col gap-6 sm:flex-row">
        <button 
          onClick={() => setVista("loginAlumno")}
          className="flex h-48 w-52 flex-col items-center justify-center rounded-[2rem] border-4 border-white bg-gradient-to-br from-yellow-200 to-orange-300 shadow-[0_10px_0_rgba(120,70,20,0.25)] transition hover:-translate-y-1 hover:rotate-1 active:translate-y-2 active:shadow-none"
        >
          <span className="mb-3 text-5xl">🧪</span>
          <span className="text-xl font-black text-slate-800">¡Soy explorador!</span>
        </button>

        <button 
          onClick={() => setVista("loginDocente")}
          className="flex h-48 w-52 flex-col items-center justify-center rounded-[2rem] border-4 border-white bg-gradient-to-br from-teal-200 to-emerald-300 shadow-[0_10px_0_rgba(20,90,70,0.25)] transition hover:-translate-y-1 hover:-rotate-1 active:translate-y-2 active:shadow-none"
        >
          <span className="text-5xl mb-4">📚</span>
          <span className="text-xl font-black text-slate-800">Soy Docente</span>
        </button>
      </div>
    </main>
  );
}

export default App;
