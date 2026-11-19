import { useState } from 'react';
import { MotionConfig, motion } from 'framer-motion';
import { ChevronDown, EyeOff, KeyRound, Menu, ShieldCheck, Trash2, X } from 'lucide-react';
import { MATERIAS } from '../lib/materias';
import { fotoAlumnos, fotoDocente, fotoHero, fotosAula } from './landing/fotos';
import './landing/landing.css';
import AnimatedContent from './AnimatedContent';
import MascotaMurcielago from './MascotaMurcielago';
import { Atomo, Brillo, Garabato, Lupa, Mariposa, Matraz, Planeta, Planta } from './landing/Ilustraciones';
import { PantallaAlumno, PantallaAprobar, PantallaAvance, PantallaMaterial } from './landing/MiniPantallas';

/* ───────────────────────── Contenido ─────────────────────────
   Todo el texto vive aquí arriba para que lo edites sin tocar el JSX.
   Cada afirmación describe algo que la plataforma ya hace (ver CLAUDE.md).
   Mupi nació para 4.º de primaria, pero el docente puede crear actividades de cualquier materia y grado. */

const navLinks = [
  { href: '#inicio', label: 'Inicio' },
  { href: '#materias', label: 'Materias' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#para-quien', label: 'Para quién' },
  { href: '#preguntas', label: 'Preguntas' },
  { href: '#precio', label: 'Planes' },
];

// Stickers que giran alrededor de la mascota en el hero. `angulo` en grados (0 = derecha).
const stickersHero = [
  { Ilustracion: Planeta, angulo: -60, fondo: '#fff4cf' },
  { Ilustracion: Matraz, angulo: 0, fondo: '#dcf7f0' },
  { Ilustracion: Planta, angulo: 60, fondo: '#e4f6e6' },
  { Ilustracion: Atomo, angulo: 120, fondo: '#ffe4df' },
  { Ilustracion: Lupa, angulo: 180, fondo: '#e9e2ff' },
  { Ilustracion: Mariposa, angulo: 240, fondo: '#fff4cf' },
];

// Temas de ejemplo para cada materia (tarjetas de la sección «Materias»).
const ejemplosMateria = {
  ciencias: 'Seres vivos, cuerpo humano, materia y energía.',
  matematicas: 'Fracciones, figuras, medidas y problemas.',
  espanol: 'Lectura, cuentos, ortografía y gramática.',
  historia: 'Culturas prehispánicas, Independencia y Revolución.',
  geografia: 'Mapas, continentes, climas y regiones.',
  civica: 'Derechos, valores, emociones y convivencia.',
  ingles: 'Vocabulario, colores, números y saludos.',
  artes: 'Colores, música, danza y teatro.',
};

const grados = ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'];

const pasos = [
  {
    titulo: 'Sube tu material de clase',
    texto: 'Un PDF o fotos del pizarrón bastan. La IA lee el material y te propone temas para trabajar.',
    color: '#6b46c1',
    forma: 'rounded-full',
    Pantalla: PantallaMaterial,
  },
  {
    titulo: 'Revisa y aprueba cada juego',
    texto: 'Cada juego o clase nace como borrador. Lo editas si hace falta y solo llega a tus alumnos cuando tú lo apruebas.',
    color: '#ffc93c',
    forma: 'rounded-[3rem] rotate-6',
    Pantalla: PantallaAprobar,
  },
  {
    titulo: 'Tus alumnos entran y juegan',
    texto: 'Sin correo ni contraseña: escriben el código del aula, eligen su nombre y ponen su PIN de 4 números.',
    color: '#2bc4a8',
    forma: 'rounded-[40%_60%_55%_45%/55%_45%_55%_45%]',
    Pantalla: PantallaAlumno,
  },
  {
    titulo: 'Mira cómo avanza el grupo',
    texto: 'Ve el resultado por actividad y por alumno, quién no ha jugado todavía y qué tema conviene reforzar.',
    color: '#ff7f6e',
    forma: 'rounded-[3rem] -rotate-6',
    Pantalla: PantallaAvance,
  },
];

const perfiles = [
  {
    titulo: 'Para docentes',
    texto: 'Menos tiempo preparando, más tiempo enseñando.',
    foto: fotoDocente,
    fondo: '#e9e2ff',
    puntos: [
      'Juegos y clases de cualquier materia, a partir de tu material',
      'Tú decides qué se publica',
      'Métricas del grupo con filtros por fecha y tipo',
      'Genera reportes de avance con insignias para compartir con la familia',
      'Altas, cambios y bajas de alumnos en un solo lugar',
    ],
    Ilustracion: Lupa,
    accion: 'docente',
  },
  {
    titulo: 'Para alumnos',
    texto: 'Aprender jugando, a tu ritmo y por materia.',
    foto: fotoAlumnos,
    fondo: '#fff4cf',
    puntos: [
      'Entras con el código de tu aula y tu PIN',
      'Tus actividades ordenadas por materia',
      'Ganas puntos y ves qué actividades ya hiciste',
      'Desbloqueas insignias por tus avances y constancia',
      'Mupi, tu murciélago guía, te acompaña',
    ],
    Ilustracion: Planeta,
    accion: 'alumno',
  },
];

const garantias = [
  { Icono: ShieldCheck, titulo: 'Un adulto aprueba todo', texto: 'Ningún contenido de la IA llega a los niños sin la revisión del docente.' },
  { Icono: EyeOff, titulo: 'Los nombres no salen del aula', texto: 'A la IA nunca se le envían los nombres de los alumnos.' },
  { Icono: KeyRound, titulo: 'Acceso pensado para niños', texto: 'Código de aula y PIN. El PIN se bloquea unos minutos tras 5 intentos fallidos.' },
  { Icono: Trash2, titulo: 'Datos que se pueden borrar', texto: 'El docente puede consultar, corregir o eliminar los datos de cada alumno.' },
];


const faqs = [
  {
    q: '¿Para quién está diseñada Mupi?',
    a: '¡Para pequeños exploradores y grandes educadores! Mupi está diseñada para docentes y estudiantes de 1.º a 6.º de primaria, tanto de escuelas públicas como privadas. Nuestra aventura comienza en 4.º de primaria, pero la plataforma permite crear actividades para cualquier grado y materia de primaria.',
  },
  {
    q: '¿Qué materias puedo aprender con Mupi?',
    a: '¡Cada materia es una nueva aventura! Los docentes pueden crear actividades de Matemáticas, Español, Ciencias Naturales y muchas más. Cada materia tiene su propio color e icono para que los estudiantes identifiquen fácilmente sus actividades y disfruten aprendiendo.',
  },
  {
    q: '¿Cómo pueden ingresar los estudiantes?',
    a: '¡Entrar a Mupi es muy sencillo! Solo deben seleccionar «Soy alumno», escribir el código de 6 caracteres de su aula, elegir su nombre e ingresar su PIN de 4 dígitos. El docente les proporcionará los datos necesarios para comenzar su aventura.',
  },
  {
    q: '¿La inteligencia artificial crea actividades automáticamente?',
    a: '¡Sí, pero el docente siempre tiene el control! Mupi utiliza inteligencia artificial para ayudar a crear actividades educativas. Cada actividad se guarda como borrador para que el docente pueda revisarla, personalizarla y aprobarla antes de compartirla con sus estudiantes.',
  },
  {
    q: '¿Mupi protege la información de los estudiantes?',
    a: '¡La privacidad de los pequeños exploradores es una prioridad! Mupi no envía los nombres de los estudiantes a la inteligencia artificial y alerta al docente cuando detecta nombres en las instrucciones utilizadas para generar actividades.',
  },
  {
    q: '¿Cuántas actividades puedo crear con inteligencia artificial?',
    a: 'Cada docente dispone de 15 generaciones de inteligencia artificial al mes para diseñar experiencias educativas. Si ocurre un error y la IA no genera una actividad, el intento no se descuenta.',
  },
];


/* ───────────────────────── Piezas pequeñas ───────────────────────── */

function Encabezado({ id, titulo, children, centrado = false, claro = false }) {
  return (
    <div className={`mb-12 max-w-3xl ${centrado ? 'mx-auto text-center' : ''}`}>
      <h2 id={id} className={`font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl ${claro ? 'text-white' : 'text-[#22184a]'}`}>
        {titulo}
      </h2>
      <Garabato className={`mt-4 h-5 w-32 ${centrado ? 'mx-auto' : ''}`} color={claro ? '#ffc93c' : '#2bc4a8'} />
      {children ? <p className={`mt-5 text-lg leading-8 ${claro ? 'text-[#ded6ff]' : 'text-[#4a3f7a]'}`}>{children}</p> : null}
    </div>
  );
}

function BotonAlumno({ onClick, amarillo = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-full border-[3px] border-[#22184a] px-8 font-display text-xl font-semibold shadow-[5px_5px_0_#22184a] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#22184a] active:translate-y-0.5 active:shadow-[2px_2px_0_#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#ffc93c] ${amarillo ? 'bg-[#ffc93c] text-[#22184a]' : 'bg-[#6b46c1] text-white'}`}
    >
      <span aria-hidden="true">🎒</span> Soy alumno
    </button>
  );
}

function BotonDocente({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-16 items-center justify-center gap-3 rounded-full border-[3px] border-[#22184a] bg-white px-8 font-display text-xl font-semibold text-[#22184a] shadow-[5px_5px_0_#22184a] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#22184a] active:translate-y-0.5 active:shadow-[2px_2px_0_#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40`}
    >
      <span aria-hidden="true">🍎</span> Soy docente
    </button>
  );
}

function FaqItem({ item, open, onToggle, id }) {
  return (
    <div className={`rounded-3xl border-[3px] border-[#22184a] bg-white transition-shadow ${open ? 'shadow-[6px_6px_0_#6b46c1]' : 'shadow-[3px_3px_0_#22184a]'}`}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 rounded-3xl px-6 py-5 text-left font-display text-lg font-semibold leading-7 text-[#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 sm:text-xl"
        >
          {item.q}
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-[#22184a] transition-[transform,background-color] duration-300 ${open ? 'rotate-180 bg-[#ffc93c]' : 'bg-[#f1ecff]'}`}>
            <ChevronDown size={18} aria-hidden="true" />
          </span>
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-base leading-7 text-[#4a3f7a] sm:text-lg sm:leading-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

/** Escena del hero: la mascota al centro y los stickers de ciencia girando alrededor. */
function EscenaLaboratorio() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[34rem]">
      {/* Fondo: círculo de color con anillos */}
      <div aria-hidden="true" className="absolute inset-[14%] rounded-full border-[3px] border-[#22184a] bg-[#6b46c1]" />
      <div aria-hidden="true" className="absolute inset-[22%] rounded-full bg-[#7d5ad0]" />
      <div aria-hidden="true" className="absolute inset-[4%] rounded-full border-[3px] border-dashed border-[#22184a]/25" />

      <Brillo className="lp-titilar absolute left-[6%] top-[8%] h-8 w-8" />
      <Brillo className="lp-titilar lp-titilar-2 absolute bottom-[6%] right-[10%] h-10 w-10" color="#2bc4a8" />
      <Brillo className="lp-titilar absolute right-[2%] top-[30%] h-6 w-6" color="#ff7f6e" />

      {/* Mascota (se puede tocar: dice frases) */}
      <motion.div
        className="absolute inset-0 grid place-items-center"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.15 }}
      >
        <MascotaMurcielago className="h-[46%] w-[46%]" label="Mupi, el murciélago guía" />
      </motion.div>

      {/* Foto del aula: mezcla lo real con lo ilustrado, como un recuerdo pegado en el cuaderno */}
      <motion.figure
        className="absolute -bottom-6 -left-4 z-10 w-[36%] -rotate-6 overflow-hidden rounded-3xl border-[3px] border-[#22184a] bg-white p-1.5 shadow-[5px_5px_0_#22184a] sm:-left-10"
        initial={{ opacity: 0, y: 20, rotate: -14 }}
        animate={{ opacity: 1, y: 0, rotate: -6 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 140, damping: 14 }}
      >
        <img src={fotoHero.src} alt={fotoHero.alt} className="aspect-[4/3] w-full rounded-[1.1rem] object-cover" loading="eager" />
      </motion.figure>

      {/* Órbita: el contenedor gira; cada sticker gira al revés para no quedar de cabeza */}
      <div aria-hidden="true" className="lp-orbita pointer-events-none absolute inset-0">
        {stickersHero.map(({ Ilustracion, angulo, fondo }, i) => {
          const rad = (angulo * Math.PI) / 180;
          const left = 50 + 46 * Math.cos(rad);
          const top = 50 + 46 * Math.sin(rad);
          return (
            <div key={angulo} className="absolute h-[21%] w-[21%] -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%`, top: `${top}%` }}>
              <div className="lp-orbita-item h-full w-full">
                <motion.div
                  className="grid h-full w-full place-items-center rounded-full border-[3px] border-[#22184a] shadow-[4px_4px_0_#22184a]"
                  style={{ backgroundColor: fondo }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.45 + i * 0.1 }}
                >
                  <Ilustracion className="h-[72%] w-[72%]" />
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

const aparecer = {
  oculto: { opacity: 0, y: 18 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.55, delay: 0.1 + i * 0.1, ease: [0.2, 0.8, 0.2, 1] } }),
};

export default function LandingPage({ onIrAlumno, onIrDocente }) {
  const [openFaq, setOpenFaq] = useState(0);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const acciones = { alumno: onIrAlumno, docente: onIrDocente };

  return (
    // reducedMotion="user": framer-motion apaga sus animaciones si el sistema lo pide.
    <MotionConfig reducedMotion="user">
      <main className="relative isolate min-h-screen overflow-x-clip bg-[#f6f4ff] text-[#22184a] selection:bg-[#ffc93c]/60">
        {/* Header */}
        <header className="sticky top-0 z-50 mx-auto flex w-full max-w-7xl items-center justify-between gap-3 bg-[#f6f4ff]/95 px-5 py-3 shadow-[0_3px_0_rgba(34,24,74,0.12)] backdrop-blur-md sm:px-8 sm:py-4">
          <div className="inline-flex items-center gap-2">
            <MascotaMurcielago className="h-10 w-10 sm:h-12 sm:w-12" label="Mupi, el murciélago guía" />
            <a href="#inicio" className="whitespace-nowrap rounded-full font-display text-lg font-semibold text-[#22184a] sm:text-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
              Mupi
            </a>
          </div>
          <nav id="menu-secciones" aria-label="Secciones de la página" className={`${menuAbierto ? 'flex' : 'hidden'} absolute left-0 right-0 top-full z-50 flex-col gap-1 border-b-[3px] border-[#22184a] bg-[#f6f4ff] p-4 shadow-lg lg:static lg:flex lg:flex-row lg:items-center lg:justify-center lg:gap-1 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}>
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuAbierto(false)} className="rounded-full px-4 py-2.5 text-base font-bold text-[#4a3f7a] transition hover:bg-[#e9e2ff] hover:text-[#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
                {link.label}
              </a>
            ))}
          </nav>
          <button type="button" onClick={() => setMenuAbierto((abierto) => !abierto)} aria-label={menuAbierto ? 'Cerrar menú' : 'Abrir menú'} aria-expanded={menuAbierto} aria-controls="menu-secciones" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-[#22184a] bg-white text-[#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40 lg:hidden">
            {menuAbierto ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
          <button type="button" onClick={onIrDocente} className="inline-flex min-h-12 shrink-0 items-center whitespace-nowrap rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-4 font-display text-base sm:px-5 sm:text-lg font-semibold text-[#22184a] shadow-[3px_3px_0_#22184a] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">
            Iniciar sesión
          </button>
        </header>

        {/* Hero */}
        <section id="inicio" aria-labelledby="titulo-hero" className="relative scroll-mt-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="lp-flotar absolute -left-16 top-24 h-40 w-40 rounded-[2.5rem] bg-[#ffc93c]/50" style={{ '--rot': '18deg' }} />
            <div className="absolute -right-40 -top-32 h-[30rem] w-[30rem] rounded-full bg-[#e3dbff]" />
          </div>

          <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6 lg:pb-28 lg:pt-10">
            <div className="text-center lg:text-left">
              <motion.p custom={0} variants={aparecer} initial="oculto" animate="visible" className="inline-flex items-center gap-2 rounded-full border-2 border-[#22184a] bg-white px-4 py-2 text-sm font-extrabold text-[#22184a] sm:text-base">
                <span aria-hidden="true">🎒</span> Mupi nace para transformar el aprendizaje
              </motion.p>
              <motion.h1 id="titulo-hero" custom={1} variants={aparecer} initial="oculto" animate="visible" className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-[#22184a] sm:text-6xl xl:text-7xl">
                Cada clase, convertida en una aventura.
              </motion.h1>
              <motion.p custom={2} variants={aparecer} initial="oculto" animate="visible" className="mx-auto mt-6 max-w-xl text-lg leading-8 text-[#4a3f7a] sm:text-xl sm:leading-9 lg:mx-0">
                Con Mupi, el docente convierte su material en juegos de cualquier materia con apoyo de IA. Los alumnos aprenden jugando y saben siempre de qué materia es cada reto.
              </motion.p>
              <motion.div custom={3} variants={aparecer} initial="oculto" animate="visible" className="mt-9 flex flex-col justify-center gap-4 sm:flex-row lg:justify-start">
                <BotonAlumno onClick={onIrAlumno} />
                <BotonDocente onClick={onIrDocente} />
              </motion.div>
              <motion.p custom={4} variants={aparecer} initial="oculto" animate="visible" className="mt-5 text-base text-[#4a3f7a]">
                Para entrar como alumno necesitas el código de tu aula y tu PIN.
              </motion.p>
            </div>
            <EscenaLaboratorio />
          </div>
        </section>

        {/* Marquesina de materias */}
        <section aria-label="Materias" className="lp-marquesina relative -left-[5%] w-[110%] -rotate-1 border-y-[3px] border-[#22184a] bg-[#22184a] py-4">
          <div className="overflow-hidden">
            <div className="lp-marquesina-pista flex w-max items-center">
              {[0, 1].map((copia) => (
                <ul key={copia} aria-hidden={copia === 1 ? 'true' : undefined} className="flex shrink-0 items-center gap-3 pr-3">
                  {MATERIAS.map(({ id, nombre, Icono, color }) => (
                    <li key={`${copia}-${id}`} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/10 py-2 pl-2 pr-5 font-display text-lg font-medium text-white">
                      <span className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: color }}><Icono size={20} strokeWidth={2.5} color="#22184a" aria-hidden="true" /></span>
                      {nombre}
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* Fotos del aula (carrusel continuo) */}
        <section aria-label="Mupi en el aula" className="lp-marquesina overflow-hidden py-14">
          <ul className="lp-marquesina-pista lp-marquesina-lenta flex w-max items-center gap-6 px-3">
            {[...fotosAula, ...fotosAula].map((foto, i) => (
              <li key={i} aria-hidden={i >= fotosAula.length ? 'true' : undefined} className={`shrink-0 overflow-hidden rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-1.5 shadow-[5px_5px_0_#22184a] ${i % 2 ? 'rotate-2' : '-rotate-2'}`}>
                <img src={foto.src} alt={i >= fotosAula.length ? '' : foto.alt} loading="lazy" className="h-52 w-72 rounded-[1.25rem] object-cover sm:h-60 sm:w-80" />
              </li>
            ))}
          </ul>
        </section>

        {/* Materias y grados */}
        <section id="materias" aria-labelledby="titulo-materias" className="mx-auto max-w-7xl scroll-mt-24 px-5 pb-24 pt-10 sm:px-8 sm:pb-28">
          <Encabezado id="titulo-materias" titulo="💡 ¡Grandes aventuras comienzan con pequeños aprendizajes!">
           Explora, crea y aprende sin límites. Desde Ciencias Naturales hasta Matemáticas, Español y mucho más. Mupi transforma cada actividad en una experiencia divertida, dinámica y llena de descubrimientos.
Los docentes tienen la libertad de crear actividades para cualquier materia y grado escolar, mientras los estudiantes disfrutan de un espacio colorido, intuitivo y diseñado para despertar su curiosidad.
✨ ¡Porque aprender puede ser tan emocionante como jugar!
          </Encabezado>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {MATERIAS.map(({ id, nombre, Icono, color, suave }) => (
              <li key={id} className="group relative overflow-hidden rounded-[2rem] border-[3px] border-[#22184a] p-6 shadow-[5px_5px_0_#22184a]" style={{ backgroundColor: suave }}>
                <div aria-hidden="true" className="absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-70" style={{ backgroundColor: color }} />
                <span className="relative grid h-14 w-14 place-items-center rounded-2xl border-[3px] border-[#22184a] bg-white transition-transform duration-300 group-hover:-rotate-6">
                  <Icono size={28} strokeWidth={2.4} color="#22184a" aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 font-display text-2xl font-semibold leading-tight">{nombre}</h3>
                <p className="relative mt-2 text-base leading-7 text-[#4a3f7a]">{ejemplosMateria[id]}</p>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-col gap-4 rounded-[2rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[5px_5px_0_#22184a] sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="font-display text-2xl font-semibold">Con Mupi, cada grado trae nuevos retos, conocimientos y aventuras. </h3>
              <p className="mt-1 text-[#4a3f7a]">El docente elige el grado y la IA ajusta el lenguaje y la dificultad.</p>
            </div>
            <ul className="flex flex-wrap gap-2" aria-label="Grados">
              {grados.map((g, i) => (
                <li key={`${g}-${i}`} className={`rounded-full border-2 border-[#22184a] px-3 py-1 text-sm font-extrabold ${g.startsWith('4.º') ? 'bg-[#ffc93c]' : i < 6 ? 'bg-[#ece6ff]' : 'bg-[#dcf7f0]'}`}>{g}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* Cómo funciona: pasos en zigzag con mini pantallas */}
        <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="scroll-mt-24 border-y-[3px] border-[#22184a] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-28">
            <Encabezado id="titulo-como-funciona" titulo="Del material del docente al juego del alumno" centrado>
              Cuatro pasos, y el docente tiene el control en cada uno.
            </Encabezado>
            <ol className="space-y-20 lg:space-y-28">
              {pasos.map(({ titulo, texto, color, forma, Pantalla }, i) => (
                <li key={titulo} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                  <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                    <span className="grid h-14 w-14 place-items-center rounded-full border-[3px] border-[#22184a] font-display text-2xl font-bold text-[#22184a]" style={{ backgroundColor: color }}>
                      {i + 1}
                    </span>
                    <h3 className="mt-5 font-display text-3xl font-semibold leading-tight sm:text-4xl">{titulo}</h3>
                    <p className="mt-4 max-w-lg text-lg leading-8 text-[#4a3f7a]">{texto}</p>
                  </div>
                  <AnimatedContent trigger="scroll" distance={40} direction="horizontal" reverse={i % 2 === 1} duration={0.7} className="relative px-4 py-6 sm:px-8">
                    <div aria-hidden="true" className={`absolute inset-x-6 inset-y-0 opacity-30 ${forma}`} style={{ backgroundColor: color }} />
                    <div className="relative">
                      <Pantalla />
                    </div>
                  </AnimatedContent>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Para quién */}
        <section id="para-quien" aria-labelledby="titulo-para-quien" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-28">
          <Encabezado id="titulo-para-quien" titulo="Una plataforma, dos espacios">
            Docentes y alumnos usan la misma plataforma, pero cada quien ve solo lo que necesita.
          </Encabezado>
          <div className="grid gap-8 md:grid-cols-2">
            {perfiles.map(({ titulo, texto, fondo, puntos, Ilustracion, accion, foto }) => (
              <article key={titulo} className="relative flex flex-col overflow-hidden rounded-[2.5rem] border-[3px] border-[#22184a] p-6 shadow-[8px_8px_0_#22184a] sm:p-8" style={{ backgroundColor: fondo }}>
                <div className="relative mb-7">
                  <img src={foto.src} alt={foto.alt} loading="lazy" className="aspect-[16/9] w-full rounded-[1.75rem] border-[3px] border-[#22184a] object-cover" />
                  <Ilustracion className="lp-flotar absolute -bottom-8 -right-3 h-24 w-24 sm:h-28 sm:w-28" />
                </div>
                <h3 className="relative font-display text-3xl font-semibold sm:text-4xl">{titulo}</h3>
                <p className="relative mt-2 text-lg leading-8 text-[#4a3f7a]">{texto}</p>
                <ul className="relative mt-7 flex-1 space-y-3">
                  {puntos.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-base font-semibold leading-7 sm:text-lg">
                      <span aria-hidden="true" className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-[#22184a] bg-white text-sm">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="relative mt-8">
                  {accion === 'alumno' ? <BotonAlumno onClick={acciones.alumno} /> : <BotonDocente onClick={acciones.docente} />}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Familias */}
        <section aria-labelledby="titulo-familias" className="border-y-[3px] border-[#22184a] bg-[#e9e2ff]/70">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
            <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="mb-4 inline-flex rounded-full border-2 border-[#22184a] bg-[#ffc93c] px-4 py-2 text-sm font-extrabold uppercase tracking-wider">PARA QUIENES ACOMPAÑAN</p>
                <h2 id="titulo-familias" className="font-display text-4xl font-semibold leading-[1.08] tracking-tight text-[#22184a] sm:text-5xl">
                  La familia también acompaña cada logro.
                </h2>
                <Garabato className="mt-4 h-5 w-32" color="#2bc4a8" />
                <p className="mt-6 text-lg leading-8 text-[#4a3f7a]">
                  Cuando el docente comparte el reporte de aprendizaje, las familias pueden conocer las actividades realizadas y pendientes, los avances, las fortalezas, las insignias obtenidas y los temas que conviene reforzar.
                </p>
                <p className="mt-4 text-lg leading-8 text-[#4a3f7a]">
                  Madres, padres y tutores pueden acompañar desde casa, conversar sobre lo aprendido y encontrar ideas sencillas para practicar. Aprender es mucho más que una calificación: también es crecer y avanzar a su propio ritmo.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[4px_4px_0_#22184a]">
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#22184a] bg-[#dcf7f0] text-2xl">📚</span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-[#22184a]">Ver su avance</h3>
                  <p className="mt-2 leading-7 text-[#4a3f7a]">Actividades terminadas y pendientes, con un resumen claro de cómo le ha ido.</p>
                </article>
                <article className="rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[4px_4px_0_#22184a]">
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#22184a] bg-[#fff4cf] text-2xl">✨</span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-[#22184a]">Reconocer sus fortalezas</h3>
                  <p className="mt-2 leading-7 text-[#4a3f7a]">Identificar qué se le facilita y celebrar las insignias que obtiene con su esfuerzo.</p>
                </article>
                <article className="rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[4px_4px_0_#22184a]">
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#22184a] bg-[#ffe4df] text-2xl">💡</span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-[#22184a]">Saber qué repasar</h3>
                  <p className="mt-2 leading-7 text-[#4a3f7a]">Consultar los temas que conviene practicar y algunas ideas sencillas para hacerlo en casa.</p>
                </article>
                <article className="rounded-[1.75rem] border-[3px] border-[#22184a] bg-white p-6 shadow-[4px_4px_0_#22184a]">
                  <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-[#22184a] bg-[#e9e2ff] text-2xl">💬</span>
                  <h3 className="mt-4 font-display text-xl font-semibold text-[#22184a]">Compartir el reporte</h3>
                  <p className="mt-2 leading-7 text-[#4a3f7a]">El docente puede compartirlo por WhatsApp o imprimirlo y guardarlo como PDF.</p>
                </article>
              </div>
            </div>
          </div>
        </section>

        {/* Planes: propuesta para el piloto; no publicar precios hasta definirlos. */}
        <section id="precio" aria-labelledby="titulo-precio" className="scroll-mt-24 border-y-[3px] border-[#22184a] bg-[#fff9e8]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
            <Encabezado id="titulo-precio" titulo="Un plan para cada forma de enseñar" centrado>
              Empieza gratis y escala cuando tu aula o escuela lo necesite. Precios sugeridos para validar con docentes y escuelas durante el piloto.
            </Encabezado>
            <div className="grid items-stretch gap-6 lg:grid-cols-3">
              <article className="flex flex-col rounded-[2rem] border-[3px] border-[#22184a] bg-white p-7 shadow-[5px_5px_0_#22184a]">
                <span className="text-4xl" aria-hidden="true">🌱</span>
                <p className="mt-4 text-sm font-extrabold uppercase tracking-wider text-[#6b46c1]">Para comenzar</p>
                <h3 className="mt-1 font-display text-3xl font-semibold">Gratis</h3><p className="mt-2 font-display text-4xl font-bold">$0 <span className="text-base font-semibold">MXN</span></p>
                <p className="mt-2 min-h-14 text-[#4a3f7a]">Explora Mupi con tu grupo, sin costo durante el piloto.</p>
                <ul className="my-6 flex-1 space-y-3 text-[#22184a]">
                  <li>✓ Un espacio para tu aula</li><li>✓ Actividades creadas desde tu material</li><li>✓ Revisión y aprobación docente</li><li>✓ Seguimiento del avance del grupo</li><li>✓ 15 generaciones de IA al mes por docente</li>
                </ul>
                <button type="button" onClick={onIrDocente} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#dcf7f0] px-5 font-display font-semibold shadow-[3px_3px_0_#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">Probar Mupi</button>
              </article>
              <article className="relative flex flex-col rounded-[2rem] border-[3px] border-[#22184a] bg-[#e9e2ff] p-7 shadow-[7px_7px_0_#6b46c1]">
                <span className="absolute right-5 top-5 rounded-full border-2 border-[#22184a] bg-[#ffc93c] px-3 py-1 text-xs font-extrabold uppercase">Recomendado</span>
                <span className="text-4xl" aria-hidden="true">🍎</span>
                <p className="mt-4 text-sm font-extrabold uppercase tracking-wider text-[#6b46c1]">Para una práctica docente</p>
                <h3 className="mt-1 font-display text-3xl font-semibold">Docente</h3><p className="mt-2 font-display text-4xl font-bold">$99 <span className="text-base font-semibold">MXN / mes</span></p><p className="text-sm text-[#4a3f7a]">o $990 MXN al año</p>
                <p className="mt-2 min-h-14 text-[#4a3f7a]">Más capacidad y organización para trabajar con tus grupos.</p>
                <ul className="my-6 flex-1 space-y-3 text-[#22184a]">
                  <li>✓ Todo lo incluido en Gratis</li><li>✓ Más generaciones de IA</li><li>✓ Organización de varios grupos</li><li>✓ Historial y seguimiento ampliados</li><li>✓ Prioridad de soporte</li>
                </ul>
                <button type="button" onClick={onIrDocente} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#ffc93c] px-5 font-display font-semibold shadow-[3px_3px_0_#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">Quiero conocerlo</button>
              </article>
              <article className="flex flex-col rounded-[2rem] border-[3px] border-[#22184a] bg-white p-7 shadow-[5px_5px_0_#22184a]">
                <span className="text-4xl" aria-hidden="true">🏫</span>
                <p className="mt-4 text-sm font-extrabold uppercase tracking-wider text-[#6b46c1]">Para comunidades escolares</p>
                <h3 className="mt-1 font-display text-3xl font-semibold">Escuela</h3><p className="mt-2 font-display text-4xl font-bold">$1,499 <span className="text-base font-semibold">MXN / mes</span></p><p className="text-sm text-[#4a3f7a]">hasta 10 docentes; después, cotización</p>
                <p className="mt-2 min-h-14 text-[#4a3f7a]">Una propuesta para coordinar varios docentes y grupos.</p>
                <ul className="my-6 flex-1 space-y-3 text-[#22184a]">
                  <li>✓ Todo lo incluido en Docente</li><li>✓ Acompañamiento de implementación</li><li>✓ Incorporación de varios docentes</li><li>✓ Capacitación inicial para el equipo</li><li>✓ Alcance y precio según tamaño de la escuela</li>
                </ul>
                <button type="button" onClick={onIrDocente} className="min-h-12 rounded-full border-[3px] border-[#22184a] bg-[#f1ecff] px-5 font-display font-semibold shadow-[3px_3px_0_#22184a] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#6b46c1]/40">Solicitar información</button>
              </article>
            </div>
            <p className="mx-auto mt-7 max-w-3xl text-center text-sm leading-6 text-[#4a3f7a]">La plataforma ya ofrece 15 generaciones de IA mensuales por docente. Precios y límites de Docente y Escuela son una propuesta inicial; confirmen costos reales de IA, infraestructura e impuestos antes de publicarlos como oferta activa.</p>
          </div>
        </section>
        {/* Garantías de seguridad */}
        <section aria-labelledby="titulo-seguridad" className="relative overflow-hidden bg-[#22184a] text-white">
          <Brillo className="lp-titilar absolute left-[6%] top-16 h-10 w-10" />
          <Brillo className="lp-titilar lp-titilar-2 absolute bottom-16 right-[8%] h-8 w-8" color="#2bc4a8" />
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
            <Encabezado id="titulo-seguridad" titulo="Hecha para el aula, con los niños cuidados" claro>
              Reglas que la plataforma cumple siempre, no solo cuando alguien se acuerda.
            </Encabezado>
            <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {garantias.map(({ Icono, titulo, texto }) => (
                <li key={titulo} className="rounded-[2rem] border-2 border-white/15 bg-white/[0.06] p-6">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#ffc93c] text-[#22184a]">
                    <Icono size={28} strokeWidth={2.4} aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold">{titulo}</h3>
                  <p className="mt-2 text-base leading-7 text-[#ded6ff]">{texto}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Preguntas frecuentes */}
        <section id="preguntas" aria-labelledby="titulo-preguntas" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-24 sm:px-8 sm:py-28">
          <Encabezado id="titulo-preguntas" titulo="Preguntas frecuentes" centrado />
          <div className="space-y-4">
            {faqs.map((item, index) => (
              <FaqItem key={item.q} id={`faq-${index}`} item={item} open={openFaq === index} onToggle={() => setOpenFaq(openFaq === index ? -1 : index)} />
            ))}
          </div>
        </section>

        {/* Llamado final */}
        <section aria-labelledby="titulo-cta" className="px-5 pb-24 sm:px-8">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[3rem] border-[3px] border-[#22184a] bg-[#6b46c1] px-6 py-16 text-center text-white shadow-[10px_10px_0_#22184a] sm:px-12 sm:py-20">
            <Planeta className="lp-flotar absolute -left-8 -top-8 hidden h-40 w-40 sm:block" />
            <Matraz className="lp-flotar lp-flotar-lento absolute -bottom-6 -right-4 hidden h-36 w-36 sm:block" />
            <Brillo className="lp-titilar absolute right-[18%] top-10 h-8 w-8" />
            <div className="relative flex flex-col items-center">
              <MascotaMurcielago className="h-28 w-28" label="Mupi, el murciélago guía" />
              <h2 id="titulo-cta" className="mt-4 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">¿Listos para explorar?</h2>
              <p className="mt-4 max-w-xl text-lg leading-8 text-[#ece6ff]">Elige cómo quieres entrar.</p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                <BotonAlumno onClick={onIrAlumno} amarillo />
                <BotonDocente onClick={onIrDocente} />
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-[3px] border-[#22184a] bg-[#22184a] text-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="inline-flex items-center gap-2">
                <MascotaMurcielago className="h-12 w-12" label="Mupi, el murciélago guía" />
                <span className="font-display text-xl font-semibold">Mupi</span>
              </div>
              <p className="mt-4 max-w-md text-base leading-7 text-[#ded6ff]">Juegos y clases con IA para cualquier materia y grado, creados desde el material del docente. Proyecto piloto del Equipo Murciélago (UNITEC).</p>
            </div>
            <nav aria-label="Pie de página">
              <p className="font-display text-lg font-semibold text-[#ffc93c]">Explora</p>
              <ul className="mt-4 grid grid-cols-2 gap-4 text-base">
                {navLinks.map((link) => (
                  <li key={link.href}><a href={link.href} className="rounded text-[#ded6ff] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc93c]">{link.label}</a></li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="border-t border-white/10">
            <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-sm text-[#ded6ff] sm:flex-row sm:justify-between sm:px-8">
              <p>© 2026 Mupi</p>
              <p>Fotos: <a href="https://www.pexels.com" target="_blank" rel="noreferrer" className="underline hover:text-white">Pexels</a></p>
            </div>
          </div>
        </footer>
      </main>
    </MotionConfig>
  );
}
