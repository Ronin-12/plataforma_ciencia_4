// Aviso de privacidad, términos y condiciones y aviso para familias de Mupi.
//
// BORRADOR: deben revisarlo un asesor legal y el equipo antes de publicar. Los datos del
// responsable están en responsable.js: cámbialos por los reales. Si cambias el texto de forma
// importante, sube VERSION_TERMINOS en backend/.env para saber qué versión aceptó cada docente.

import { RESPONSABLE } from "./responsable";

function Seccion({ titulo, children }) {
  return (
    <section className="mt-6">
      <h3 className="font-display text-xl font-semibold text-[#22184a]">{titulo}</h3>
      <div className="mt-2 space-y-2 leading-7 text-[#3b3168]">{children}</div>
    </section>
  );
}

function Lista({ items }) {
  return <ul className="list-disc space-y-1 pl-6">{items.map((t) => <li key={t}>{t}</li>)}</ul>;
}

export function AvisoPrivacidad() {
  return (
    <>
      <p>
        <strong>{RESPONSABLE.nombre}</strong> (en adelante, «Mupi»), con domicilio en {RESPONSABLE.domicilio}, es responsable
        del tratamiento de los datos personales que se recaban en la plataforma Mupi, conforme a la Ley Federal de Protección de
        Datos Personales en Posesión de los Particulares.
      </p>
      <Seccion titulo="1. Datos que tratamos">
        <p><strong>De docentes:</strong> nombre, correo electrónico, contraseña (guardada cifrada; nadie puede leerla), escuela, si es pública o privada, su Clave de Centro de Trabajo (CCT) y el uso que hace de la plataforma.</p>
        <p><strong>De alumnas y alumnos</strong> (los registra su docente): nombre de pila, avatar elegido, grupo, un PIN de acceso (guardado cifrado) y los resultados de las actividades que realizan (aciertos, tiempo e insignias). No pedimos apellidos, correo, teléfono, fotografía ni domicilio de los alumnos.</p>
        <p><strong>De quien nos escribe</strong> desde la sección Planes: nombre, correo, teléfono (opcional), escuela, CCT, número de docentes y su mensaje.</p>
        <p><strong>Materiales</strong> que el docente sube (PDF o fotos) para crear actividades.</p>
        <p>No tratamos datos personales sensibles.</p>
      </Seccion>
      <Seccion titulo="2. Para qué los usamos">
        <p>Finalidades necesarias para dar el servicio:</p>
        <Lista items={[
          "Crear y administrar las cuentas de docentes y el acceso de los alumnos.",
          "Generar, con apoyo de inteligencia artificial, las actividades que el docente solicita y que él mismo revisa y aprueba.",
          "Mostrar al docente el avance de su grupo y, a solicitud del docente, el reporte de avance para la familia.",
          "Proteger las cuentas (bloqueos por intentos fallidos, recuperación de contraseña) y prevenir abusos.",
          "Atender dudas, solicitudes y el ejercicio de derechos ARCO.",
        ]} />
        <p>Finalidades voluntarias: contactarte sobre planes cuando tú lo solicitas y elaborar estadísticas agregadas (sin identificar a nadie) para mejorar Mupi. Puedes negarte a estas finalidades escribiendo a {RESPONSABLE.correo}, sin que eso afecte el servicio.</p>
      </Seccion>
      <Seccion titulo="3. Datos de niñas y niños">
        <p>Los datos de los alumnos los registra su docente en nombre de la escuela, que es quien debe contar con la autorización de madres, padres o tutores. Mupi pone a disposición del docente un aviso para familias. Reducimos al mínimo los datos de los niños: solo nombre de pila y resultados de aprendizaje.</p>
        <p><strong>A la inteligencia artificial nunca se le envían nombres de alumnos.</strong> Si el docente escribe el nombre de un alumno en una instrucción, la plataforma lo detiene.</p>
      </Seccion>
      <Seccion titulo="4. Con quién compartimos datos">
        <p>Para operar, Mupi se apoya en proveedores que tratan datos por nuestra cuenta y bajo nuestras instrucciones. Sus servidores pueden estar fuera de México:</p>
        <Lista items={[
          "Hospedaje del sitio y de la base de datos (IONOS; centro de datos en Estados Unidos).",
          "Inteligencia artificial para crear actividades (Google, servicio Gemini en su modalidad de pago, en la que Google no usa los datos para mejorar sus productos). Solo recibe las instrucciones y materiales del docente, nunca nombres de alumnos.",
          "Envío de correos (por ejemplo, el de recuperar contraseña).",
        ]} />
        <p>No vendemos ni rentamos datos personales. Solo los entregaríamos a una autoridad cuando la ley lo exija.</p>
        <p><strong>Al aceptar este aviso, consientes que tus datos se traten mediante estos proveedores, incluso fuera de México.</strong> Si no lo aceptas, no podemos prestarte el servicio.</p>
      </Seccion>
      <Seccion titulo="5. Tus derechos (ARCO) y cómo revocar el consentimiento">
        <p>Puedes acceder a tus datos, rectificarlos, cancelarlos u oponerte a su uso, así como revocar tu consentimiento, escribiendo a <strong>{RESPONSABLE.correo}</strong> con tu nombre, el derecho que quieres ejercer y un medio para responderte. Te responderemos en los plazos que establece la ley.</p>
        <p>El docente puede, desde su panel, consultar, corregir, desactivar o borrar por completo los datos de cada alumno. Madres, padres o tutores pueden pedirlo al docente o directamente a Mupi.</p>
        <p>Si consideras que tu derecho no fue atendido, puedes acudir a la Secretaría Anticorrupción y Buen Gobierno, autoridad en materia de protección de datos personales.</p>
      </Seccion>
      <Seccion titulo="6. Cuánto tiempo los guardamos y cómo los protegemos">
        <p>Conservamos los datos mientras la cuenta esté activa o hasta que se pida su cancelación. Las copias de respaldo se borran solas en un máximo de 14 días.</p>
        <p>Usamos conexión cifrada (HTTPS), contraseñas y PIN cifrados, acceso por roles (un docente solo ve a sus alumnos; el administrador no ve nombres ni resultados de alumnos) y respaldos diarios.</p>
        <p>Mupi no usa cookies de rastreo ni publicidad. El navegador solo guarda preferencias, como tener el sonido encendido.</p>
      </Seccion>
      <Seccion titulo="7. Cambios a este aviso">
        <p>Si este aviso cambia, lo publicaremos en esta página y, si el cambio es importante, te pediremos aceptarlo de nuevo. Última actualización: {RESPONSABLE.actualizado}.</p>
      </Seccion>
    </>
  );
}

export function Terminos() {
  return (
    <>
      <p>Al crear una cuenta en Mupi aceptas estos términos. Mupi es un proyecto en fase piloto operado por {RESPONSABLE.nombre}.</p>
      <Seccion titulo="1. El servicio">
        <p>Mupi permite a docentes de primaria convertir su material en juegos y clases con apoyo de inteligencia artificial, asignarlos a sus grupos y ver el avance de sus alumnos. Por ser un piloto, las funciones pueden cambiar y el servicio puede interrumpirse por mantenimiento.</p>
      </Seccion>
      <Seccion titulo="2. Cuentas">
        <Lista items={[
          "Las cuentas de docente se crean con un código de invitación. Eres responsable de cuidar tu contraseña.",
          "Los alumnos entran con el código de su aula y un PIN; no usan correo.",
          "Debes contar con la autorización de tu escuela y, por medio de ella, de las familias, para registrar a tus alumnos.",
        ]} />
      </Seccion>
      <Seccion titulo="3. Contenido creado con inteligencia artificial">
        <Lista items={[
          "La IA puede equivocarse. Por eso ninguna actividad llega a los alumnos hasta que el docente la revisa y la aprueba; esa revisión es responsabilidad del docente.",
          "No subas materiales con datos personales de alumnos u otras personas (nombres, fotos, calificaciones).",
          "Sube solo materiales que tengas derecho a usar. El material sigue siendo tuyo; solo lo usamos para crear tus actividades.",
        ]} />
      </Seccion>
      <Seccion titulo="4. Planes y límites">
        <p>El plan Gratis incluye un número limitado de créditos de IA al día y al mes. Mupi no cobra en línea: los planes con más capacidad se acuerdan directamente con el equipo desde la sección Planes, y sus condiciones y precio (con impuestos incluidos) se fijan por escrito antes de cualquier pago.</p>
      </Seccion>
      <Seccion titulo="5. Uso aceptable">
        <p>No está permitido usar Mupi para fines distintos a la educación, intentar acceder a cuentas ajenas, saturar el servicio o generar contenido inapropiado para menores. Podemos suspender las cuentas que lo hagan.</p>
      </Seccion>
      <Seccion titulo="6. Privacidad">
        <p>El tratamiento de datos personales se rige por el Aviso de privacidad de Mupi.</p>
      </Seccion>
      <Seccion titulo="7. Responsabilidad y ley aplicable">
        <p>Mupi se ofrece «tal como está» durante el piloto. Hacemos lo razonable por mantenerlo disponible y seguro, pero no garantizamos que funcione sin interrupciones. Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Dudas: {RESPONSABLE.correo}. Última actualización: {RESPONSABLE.actualizado}.</p>
      </Seccion>
    </>
  );
}

export function AvisoFamilias() {
  return (
    <>
      <p className="rounded-xl border-2 border-dashed border-[#6b46c1] bg-[#f6f4ff] p-3 text-sm">
        Formato para que la escuela lo entregue a las familias (puedes imprimirlo con el botón de abajo). Llena los datos entre corchetes.
      </p>
      <p className="mt-4">Estimada familia:</p>
      <p>En el grupo <strong>[GRUPO]</strong> de la escuela <strong>[ESCUELA]</strong> usaremos <strong>Mupi</strong>, una plataforma en la que su hija o hijo practica lo visto en clase con juegos que prepara y revisa su maestra o maestro.</p>
      <Seccion titulo="¿Qué datos se usan?">
        <Lista items={[
          "Solo el nombre de pila de su hija o hijo (sin apellidos) y un avatar.",
          "Los resultados de las actividades: aciertos, tiempo e insignias ganadas.",
          "No se piden correo, teléfono, fotografía ni domicilio.",
        ]} />
      </Seccion>
      <Seccion titulo="¿Cómo se cuidan?">
        <Lista items={[
          "Solo la maestra o el maestro del grupo ve el avance de cada alumno; no hay rankings entre niños.",
          "La inteligencia artificial ayuda al docente a crear las actividades, pero nunca recibe el nombre de su hija o hijo.",
          "Ninguna actividad llega a los niños sin que el docente la revise y apruebe.",
        ]} />
      </Seccion>
      <Seccion titulo="Sus derechos">
        <p>Puede pedir en cualquier momento ver, corregir o borrar los datos de su hija o hijo, o que deje de usar la plataforma, con la maestra o el maestro, o escribiendo a {RESPONSABLE.correo}. El aviso de privacidad completo está en el sitio de Mupi.</p>
      </Seccion>
      <div className="mt-8 space-y-6 rounded-xl border-2 border-[#22184a] p-4">
        <p>Nombre de la alumna o alumno: ____________________________________</p>
        <p>☐ Autorizo que mi hija o hijo use Mupi en los términos descritos.</p>
        <p>Nombre y firma de madre, padre o tutor: ____________________________ Fecha: ____________</p>
      </div>
    </>
  );
}
