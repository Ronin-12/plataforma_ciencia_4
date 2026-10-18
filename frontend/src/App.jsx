import { useState } from 'react';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import PanelDocente from './components/PanelDocente';
import { api } from './services/api';

function App() {
  // Vistas: "inicio", "loginAlumno", "loginDocente", "menuAlumno", "panelDocente"
  const [vista, setVista] = useState("inicio"); 
  const [alumno, setAlumno] = useState(null);
  const [docente, setDocente] = useState(null);

  // --- LÓGICA DEL ALUMNO ---
  function manejarLoginAlumno(datosAlumno) {
    setAlumno(datosAlumno);
    setVista("menuAlumno");
  }

  function salirAlumno() {
    setAlumno(null);
    setVista("inicio");
  }

  // --- LÓGICA DEL DOCENTE ---
  async function manejarLoginDocente(datos) {
    try {
      // Conexión real al backend
      const respuesta = await api.loginDocente(datos.correo, datos.contrasena);
      console.log("¡Token recibido!", respuesta.access_token);
      
      // Guardamos los datos del docente en el estado (incluyendo el token)
      setDocente({ nombre: "Maestro", token: respuesta.access_token });
      setVista("panelDocente");
    } catch (error) {
      // Si falla, lanzamos el error para que LoginDocente lo muestre en rojo
      throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.");
    }
  }

  function salirDocente() {
    setDocente(null);
    setVista("inicio");
  }

  // --- RENDERIZADO DE PANTALLAS ---

  if (vista === "menuAlumno" && alumno) {
    return <MenuAlumno nombre={alumno.nombre} onSalir={salirAlumno} />;
  }

  if (vista === "panelDocente" && docente) {
    return (
      <PanelDocente 
        nombreDocente={docente.nombre} 
        tokenDocente={docente.token} // <-- ESTO FALTABA: Le pasamos el token al panel
        onCerrarSesion={salirDocente} 
      />
    );
  }

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

  // Pantalla de Bienvenida (Elegir rol)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#171044] px-4">
      <h1 className="text-4xl font-black text-white mb-2 text-center sm:text-5xl">Plataforma Ciencias Naturales</h1>
      <p className="text-indigo-200 mb-10 text-lg sm:text-xl">Equipo Murciélago</p>
      
      <div className="flex flex-col sm:flex-row gap-6">
        <button 
          onClick={() => setVista("loginAlumno")}
          className="flex flex-col items-center justify-center w-48 h-48 bg-yellow-300 hover:bg-yellow-200 rounded-3xl shadow-[0_10px_0_rgba(0,0,0,0.3)] transition active:translate-y-2 active:shadow-none"
        >
          <span className="text-5xl mb-4">🎒</span>
          <span className="text-xl font-black text-indigo-950">Soy Alumno</span>
        </button>

        <button 
          onClick={() => setVista("loginDocente")}
          className="flex flex-col items-center justify-center w-48 h-48 bg-cyan-400 hover:bg-cyan-300 rounded-3xl shadow-[0_10px_0_rgba(0,0,0,0.3)] transition active:translate-y-2 active:shadow-none"
        >
          <span className="text-5xl mb-4">📚</span>
          <span className="text-xl font-black text-indigo-950">Soy Docente</span>
        </button>
      </div>
    </main>
  );
}

export default App;