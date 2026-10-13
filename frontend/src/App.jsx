import { useState } from 'react';
import LoginAlumno from './components/LoginAlumno';
import MenuAlumno from './components/MenuAlumno';

function App() {
  const [alumno, setAlumno] = useState(null);

  // Cuando el alumno hace login exitoso
  function manejarLogin(datosAlumno) {
    setAlumno(datosAlumno);
  }

  // Cuando el alumno sale del menú
  function manejarSalir() {
    setAlumno(null);
  }

  // Si hay alumno logueado → mostrar menú
  if (alumno) {
    return (
      <MenuAlumno
        nombre={alumno.nombre}
        avatar={alumno.avatar}
        puntuacion={alumno.puntuacion}
        onSalir={manejarSalir}
      />
    );
  }

  // Si no → mostrar login
  return <LoginAlumno onLoginExitoso={manejarLogin} />;
}

export default App;