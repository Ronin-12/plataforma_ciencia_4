import { useState } from 'react';
import LoginAlumno from './components/LoginAlumno';
import LoginDocente from './components/LoginDocente';
import MenuAlumno from './components/MenuAlumno';
import { api } from './services/api';

function App() {
  const [vista, setVista] = useState("inicio"); // "inicio", "loginAlumno", "loginDocente", "menuAlumno"
  const [alumno, setAlumno] = useState(null);

  // Cuando el alumno hace login
  function manejarLoginAlumno(datosAlumno) {
    setAlumno(datosAlumno);
    setVista("menuAlumno");
  }

  // Cuando el docente hace login
  async function manejarLoginDocente(datos) {
    try {
      // Llamamos a nuestro backend FastAPI
      const respuesta = await api.loginDocente(datos.correo, datos.contrasena);
      console.log("¡Token recibido!", respuesta.access_token);
      
      // Temporalmente, lo mandamos a una alerta (luego crearemos el PanelDocente)
      alert("¡Bienvenido Maestro! Login exitoso.");
      setVista("inicio");
    } catch (error) {
      throw new Error("Credenciales incorrectas. Verifica tu correo y contraseña.");
    }
  }

  function cerrarSesion() {
    setAlumno(null);
    setVista("inicio");
  }

  // --- RENDERIZADO DE PANTALLAS ---

  if (vista === "menuAlumno" && alumno) {
    return <MenuAlumno nombre={alumno.nombre} onSalir={cerrarSesion} />;
  }

  if (vista === "loginAlumno") {
    return (
      <div>
        <button onClick={() => setVista("inicio")} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow">
          ← Volver
        </button>
        <LoginAlumno onLoginExitoso={manejarLoginAlumno} />
      </div>
    );
  }

  if (vista === "loginDocente") {
    return (
      <div>
        <button onClick={() => setVista("inicio")} className="absolute top-4 left-4 z-50 p-2 bg-white rounded-full shadow">
          ← Volver
        </button>
        <LoginDocente onLoginExitoso={manejarLoginDocente} />
      </div>
    );
  }

  // Pantalla de Bienvenida (Elegir rol)
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#171044] px-4">
      <h1 className="text-4xl font-black text-white mb-2 text-center">Plataforma Ciencias Naturales</h1>
      <p className="text-indigo-200 mb-10 text-lg">Equipo Murciélago</p>
      
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