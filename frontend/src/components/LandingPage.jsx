import { useState } from 'react';
import { ArrowRight, Check, ChevronDown, GraduationCap, Sparkles } from 'lucide-react';
import AnimatedContent from './AnimatedContent';
import SpotlightCard from './SpotlightCard';
import MascotaMurcielago from './MascotaMurcielago';

/* ───────────────────────── Contenido ─────────────────────────
   Todo el texto vive aquí arriba para que lo edites sin tocar el JSX.
   Revisa que cada afirmación coincida con lo que tu plataforma hace hoy. */

const navLinks = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#para-quien', label: 'Para quién' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  { href: '#preguntas', label: 'Preguntas' },
];

const features = [
  {
    icon: '🗂️',
    title: 'Planea con claridad',
    description: 'Organiza temas y materiales; la IA te propone actividades para preparar sesiones con objetivos claros.',
    color: '#3c5e85',
  },
  {
    icon: '🙋‍♀️',
    title: 'Activa la participación',
    description: 'Crea actividades que invitan a cada estudiante a pensar, colaborar y aprender haciendo.',
    color: '#66a4b9',
  },
  {
    icon: '📈',
    title: 'Acompaña el progreso',
    description: 'Consulta el avance del grupo y descubre qué temas necesitan más atención.',
    color: '#1c3157',
  },
];

const marqueeItems = [
  'Educación pública y privada',
  'Planeación con apoyo de IA',
  'Actividades participativas',
  'Seguimiento del grupo',
  'Acceso con código de aula y PIN',
  'Un solo espacio para el aula',
];

const profiles = [
  {
    key: 'docente',
    emoji: '👩‍🏫',
    title: 'Para docentes',
    description: 'Menos tiempo preparando, más tiempo enseñando.',
    color: '#a0c3d9',
    points: [
      'Planea sesiones con objetivos claros',
      'Recibe propuestas de actividades con apoyo de IA',
      'Consulta qué temas necesitan más atención',
    ],
    hint: 'Inicia sesión para entrar a tu espacio.',
  },
  {
    key: 'alumno',
    emoji: '🧑‍🎓',
    title: 'Para estudiantes',
    description: 'Aprender se siente mejor cuando participas.',
    color: '#66a4b9',
    points: [
      'Entra con el código de tu aula y tu PIN',
      'Participa en actividades pensadas para tu grupo',
      'Piensa, colabora y aprende haciendo',
    ],
    hint: 'Tu docente te comparte el código de aula y el PIN.',
  },
];

const steps = [
  {
    title: 'El docente prepara el aula',
    description: 'Organiza temas y materiales, y apóyate en la IA para armar actividades con propósito.',
    color: '#3c5e85',
  },
  {
    title: 'Los estudiantes entran',
    description: 'Cada estudiante accede con el código de su aula y su PIN, sin complicaciones.',
    color: '#66a4b9',
  },
  {
    title: 'Se aprende y se da seguimiento',
    description: 'El grupo participa en las actividades y el docente ve el avance para decidir qué reforzar.',
    color: '#1c3157',
  },
];

const faqs = [
  {
    q: '¿Para quién es la plataforma?',
    a: 'Está pensada para docentes y estudiantes de educación pública y privada. Cada quien entra a su propio espacio según su rol.',
  },
  {
    q: '¿Cómo entra un estudiante?',
    a: 'Con el código de su aula y su PIN. En la parte superior de la página solo tiene que elegir la opción “Soy Alumno”.',
  },
  {
    q: '¿Qué puede hacer un docente?',
    a: 'Planear sesiones, crear actividades participativas y consultar el avance de su grupo desde un solo lugar.',
  },
  {
    q: '¿Cómo ayuda la inteligencia artificial?',
    a: 'Propone actividades a partir de los temas y materiales que organizas, para que prepares tus sesiones con objetivos claros. Tú decides qué usar.',
  },
  {
    q: '¿Cómo empiezo?',
    a: 'Elige tu rol en la parte superior de la página. Si eres docente, usa “Soy Docente” o “Iniciar Sesión”; si eres estudiante, “Soy Alumno”.',
  },
];

/* ───────────────────────── Piezas pequeñas ───────────────────────── */

const tones = {
  dark: { eyebrow: 'text-[#a0c3d9]', title: 'text-white', text: 'text-[#a0c3d9]' },
  brand: { eyebrow: 'text-[#a0c3d9]', title: 'text-white', text: 'text-[#e3eff6]' },
  light: { eyebrow: 'text-[#3c5e85]', title: 'text-[#1c3157]', text: 'text-[#3c5e85]' },
};

function SectionHeading({ eyebrow, title, id, tone = 'light', center = false, children }) {
  const t = tones[tone];
  return (
    <div className={`mb-12 flex flex-col gap-4 ${center ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between'}`}>
      <div>
        <p className={`text-sm font-extrabold uppercase tracking-[0.16em] sm:text-base ${t.eyebrow}`}>{eyebrow}</p>
        <h2 id={id} className={`mt-3 max-w-4xl text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl ${t.title}`}>{title}</h2>
      </div>
      {children ? <p className={`max-w-xl text-base leading-7 sm:text-lg sm:leading-8 ${t.text}`}>{children}</p> : null}
    </div>
  );
}

function FaqItem({ item, open, onToggle, id }) {
  return (
    <div className={`rounded-2xl border bg-white transition ${open ? 'border-[#66a4b9] shadow-lg shadow-[#1c3157]/10' : 'border-[#a0c3d9] hover:border-[#3c5e85]'}`}>
      <h3>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          id={`${id}-button`}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left text-base font-bold leading-7 text-[#1c3157] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3c5e85] sm:text-lg"
        >
          {item.q}
          <ChevronDown size={18} className={`shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-[#3c5e85]' : 'text-[#66a4b9]'}`} />
        </button>
      </h3>
      <div
        id={`${id}-panel`}
        role="region"
        aria-labelledby={`${id}-button`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-base leading-7 text-[#3c5e85] sm:text-lg sm:leading-8">{item.a}</p>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Página ───────────────────────── */

export default function LandingPage({ onIrAlumno, onIrDocente }) {
  const [openFaq, setOpenFaq] = useState(0);

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#1c3157] text-white selection:bg-[#a0c3d9]/40">
      <style>{`
        @keyframes landing-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .landing-marquee-track { animation: landing-marquee 32s linear infinite; }
        .landing-marquee:hover .landing-marquee-track { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) { .landing-marquee-track { animation: none; } }
      `}</style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60rem] overflow-hidden">
        <div className="absolute left-1/2 top-[-24rem] h-[46rem] w-[64rem] -translate-x-1/2 rounded-full bg-[#3c5e85]/40 blur-[120px]" />
        <div className="absolute -left-48 top-[34rem] h-[28rem] w-[28rem] rounded-full bg-[#66a4b9]/20 blur-[110px]" />
        <div className="absolute -right-48 top-[52rem] h-[30rem] w-[30rem] rounded-full bg-[#a0c3d9]/20 blur-[120px]" />
        <div className="space-starfield absolute inset-0 opacity-35" />
      </div>

      {/* Header: un solo botón de acceso */}
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 sm:py-6">
        <div className="inline-flex items-center gap-3">
          <MascotaMurcielago className="h-12 w-12" label="Murciélago del Equipo Murciélago" />
          <a href="#inicio" className="rounded-full text-base font-extrabold tracking-wide text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a0c3d9] sm:text-lg">Equipo Murciélago</a>
        </div>
        <nav aria-label="Secciones de la página" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} className="rounded-full px-4 py-3 text-base font-semibold text-[#e3eff6] transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a0c3d9]">
              {link.label}
            </a>
          ))}
        </nav>
        <button type="button" onClick={onIrDocente} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#a0c3d9] px-6 text-base font-extrabold text-[#1c3157] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a0c3d9]/40">
          Iniciar Sesión <ArrowRight size={16} />
        </button>
      </header>

      {/* Hero (oscuro) — aquí viven los dos accesos principales */}
      <section id="inicio" className="relative mx-auto flex min-h-[650px] max-w-7xl flex-col items-center justify-center px-5 pb-24 pt-20 text-center sm:px-8 sm:pt-20 md:min-h-[740px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
          <div className="landing-float absolute left-[8%] top-[19%] grid h-28 w-36 -rotate-12 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-[#66a4b9]/30 to-[#1c3157]/80 text-4xl shadow-2xl shadow-black/30">🗂️</div>
          <div className="landing-float landing-float-delay absolute right-[8%] top-[24%] grid h-28 w-36 rotate-12 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-[#a0c3d9]/30 to-[#3c5e85]/80 text-4xl shadow-2xl shadow-black/30">💡</div>
          <div className="landing-float landing-float-slow absolute bottom-[13%] left-[17%] grid h-24 w-32 rotate-6 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-[#a0c3d9]/30 to-[#1c3157]/80 text-4xl shadow-2xl shadow-black/30">✍️</div>
          <div className="landing-float landing-float-delay absolute bottom-[12%] right-[17%] grid h-24 w-32 -rotate-6 place-items-center rounded-3xl border border-white/15 bg-gradient-to-br from-[#66a4b9]/30 to-[#3c5e85]/80 text-4xl shadow-2xl shadow-black/30">🤝</div>
        </div>

        <AnimatedContent trigger="mount" distance={20} duration={0.7} ease="power3.out" className="relative z-10 flex flex-col items-center">
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-[#a0c3d9]/30 bg-white/[0.06] px-5 py-3 text-sm font-bold tracking-wide text-[#e3eff6] shadow-lg shadow-black/10 sm:text-base">
            <Sparkles size={15} className="text-[#a0c3d9]" /> Herramientas para enseñar y aprender
          </p>
          <h1 className="max-w-5xl text-5xl font-extrabold leading-[1.04] tracking-[-0.04em] text-white sm:text-6xl md:text-7xl xl:text-8xl">
            Ideas para enseñar. <span className="bg-gradient-to-r from-[#a0c3d9] via-white to-[#66a4b9] bg-clip-text text-transparent">Experiencias para aprender.</span>
          </h1>
          <p className="mt-7 max-w-3xl text-lg leading-8 text-[#e3eff6] sm:text-xl sm:leading-9 lg:text-2xl">
            Planea sesiones, crea actividades participativas y acompaña el avance de tu grupo desde un solo espacio.
          </p>
          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <button type="button" onClick={onIrAlumno} className="group inline-flex min-h-16 items-center justify-center gap-3 rounded-full bg-[#a0c3d9] px-8 text-lg font-extrabold text-[#1c3157] shadow-[0_12px_40px_rgba(160,195,217,.2)] transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a0c3d9]/40">
              Soy Alumno <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={onIrDocente} className="group inline-flex min-h-16 items-center justify-center gap-3 rounded-full border border-[#a0c3d9]/50 bg-[#3c5e85]/40 px-8 text-lg font-extrabold text-white transition hover:-translate-y-0.5 hover:border-[#a0c3d9] hover:bg-[#3c5e85] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a0c3d9]/30">
              Soy Docente <ArrowRight size={18} className="text-[#a0c3d9] transition group-hover:translate-x-1 group-hover:text-white" />
            </button>
          </div>
          <p className="mt-5 text-sm text-[#e3eff6] sm:text-base">El estudiante entra con el código de su aula y su PIN.</p>
        </AnimatedContent>
        <a href="#caracteristicas" aria-label="Conoce las características" className="absolute bottom-5 left-1/2 hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-[#a0c3d9]/30 text-[#a0c3d9] transition hover:border-[#a0c3d9] hover:text-white sm:flex">
          <span aria-hidden="true" className="animate-bounce">↓</span>
        </a>
      </section>

      {/* Franja turquesa en movimiento */}
      <section aria-label="Lo esencial de la plataforma" className="landing-marquee bg-[#66a4b9] py-5 text-[#1c3157]">
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="landing-marquee-track flex w-max items-center gap-4 pr-4">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 ? 'true' : undefined} className="flex shrink-0 items-center gap-4">
                {marqueeItems.map((item) => (
                  <li key={`${copy}-${item}`} className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/75 px-6 py-3 text-base font-bold sm:text-lg">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#3c5e85]" />
                    {item}
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      {/* Características (azul claro) */}
      <section id="caracteristicas" aria-labelledby="titulo-caracteristicas" className="bg-[#a0c3d9]/25 text-[#1c3157]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="Un espacio pensado para el aula" title="Una mejor experiencia para cada clase." id="titulo-caracteristicas">
            Planeación, actividades y seguimiento para que cada clase tenga más participación y propósito.
          </SectionHeading>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <AnimatedContent key={feature.title} trigger="scroll" delay={index * 0.08} distance={18} duration={0.55} className="h-full">
                <article className="group relative h-full overflow-hidden rounded-[2rem] border border-[#a0c3d9] bg-white p-7 shadow-sm shadow-[#1c3157]/10 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#1c3157]/15 sm:p-9">
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: feature.color }} />
                  <div className="mb-6 flex items-center justify-between">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl transition group-hover:scale-110" style={{ backgroundColor: `${feature.color}1f` }}>{feature.icon}</span>
                    <span className="text-xs font-bold tracking-[0.16em] text-[#3c5e85]/60">0{index + 1}</span>
                  </div>
                  <h3 className="text-xl font-extrabold text-[#1c3157] sm:text-2xl">{feature.title}</h3>
                  <p className="mt-3 text-base leading-7 text-[#3c5e85] sm:text-lg sm:leading-8">{feature.description}</p>
                </article>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién — sin botones: los accesos ya están arriba */}
      <section id="para-quien" aria-labelledby="titulo-para-quien" className="relative overflow-hidden bg-gradient-to-br from-[#1c3157] via-[#3c5e85] to-[#1c3157] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#66a4b9]/30 blur-[90px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-[#a0c3d9]/25 blur-[90px]" />
        <div className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="Una plataforma, dos experiencias" title="Cada quien entra a su propio espacio." id="titulo-para-quien" tone="brand">
            Docentes y estudiantes comparten la misma plataforma, con herramientas pensadas para lo que cada uno necesita.
          </SectionHeading>
          <div className="grid gap-6 md:grid-cols-2">
            {profiles.map((profile, index) => (
              <AnimatedContent key={profile.key} trigger="scroll" delay={index * 0.1} distance={18} duration={0.55} className="h-full">
                <SpotlightCard theme="dark" spotlightColor={profile.color} intensity={0.2} borderGlow={0.22} className="flex h-full flex-col rounded-[2rem] border border-white/15 bg-white/[0.07] p-8 transition duration-300 hover:-translate-y-1 hover:border-white/30 sm:p-10" style={{ '--spotlight-card-surface': 'rgba(255,255,255,0.07)', '--spotlight-card-shadow': '0 20px 60px -40px rgba(0,0,0,.7)' }}>
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border border-white/15 bg-white/10 text-4xl">{profile.emoji}</span>
                  <h3 className="mt-6 text-2xl font-bold text-white sm:text-3xl">{profile.title}</h3>
                  <p className="mt-2 text-lg leading-8 text-[#e3eff6]">{profile.description}</p>
                  <ul className="mt-7 space-y-4">
                    {profile.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-base leading-7 text-white sm:text-lg sm:leading-8">
                        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${profile.color}33`, color: profile.color === '#66a4b9' ? '#a0c3d9' : profile.color }}>
                          <Check size={15} strokeWidth={3} />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-8 border-t border-white/15 pt-5 text-base leading-7 text-[#e3eff6] sm:text-lg">{profile.hint}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>

          <AnimatedContent trigger="scroll" distance={18} duration={0.55} className="mt-5">
            <div className="flex flex-col gap-6 rounded-[2rem] bg-[#a0c3d9] p-8 text-[#1c3157] sm:flex-row sm:items-center sm:justify-between sm:p-10">
              <div className="flex items-start gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/75 text-3xl">🏫</span>
                <div>
                  <h3 className="text-xl font-extrabold sm:text-2xl">Educación pública y privada</h3>
                  <p className="mt-2 max-w-2xl text-base leading-7 text-[#1c3157] sm:text-lg sm:leading-8">Pensada para docentes y estudiantes de escuelas públicas y privadas, para que más aulas tengan herramientas para enseñar y aprender mejor.</p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <span className="rounded-full bg-[#1c3157] px-5 py-3 text-sm font-bold text-white sm:text-base">Escuela pública</span>
                <span className="rounded-full bg-white px-5 py-3 text-sm font-bold text-[#1c3157] sm:text-base">Escuela privada</span>
              </div>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* Cómo funciona (azul claro) */}
      <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="bg-[#66a4b9]/20 text-[#1c3157]">
        <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="Cómo funciona" title="De la planeación al aula en tres pasos." id="titulo-como-funciona">
            Un recorrido simple para que empieces a usar la plataforma desde la primera clase.
          </SectionHeading>
          <ol className="grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="h-full">
                <AnimatedContent trigger="scroll" delay={index * 0.1} distance={18} duration={0.55} className="h-full">
                  <div className="relative h-full overflow-hidden rounded-[2rem] border border-[#a0c3d9] bg-white p-8 shadow-sm shadow-[#1c3157]/10 transition duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-[#1c3157]/15 sm:p-9">
                    <span aria-hidden="true" className="pointer-events-none absolute -right-2 -top-6 select-none text-[7rem] font-black leading-none tracking-tighter" style={{ color: `${step.color}14` }}>{index + 1}</span>
                    <span className={`relative grid h-12 w-12 place-items-center rounded-full text-base font-extrabold ${step.color === '#66a4b9' ? 'text-[#1c3157]' : 'text-white'}`} style={{ backgroundColor: step.color }}>{index + 1}</span>
                    <h3 className="relative mt-6 text-xl font-bold leading-snug text-[#1c3157] sm:text-2xl">{step.title}</h3>
                    <p className="relative mt-3 text-base leading-7 text-[#3c5e85] sm:text-lg sm:leading-8">{step.description}</p>
                  </div>
                </AnimatedContent>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Preguntas frecuentes (azul claro) */}
      <section id="preguntas" aria-labelledby="titulo-preguntas" className="bg-[#a0c3d9]/25 text-[#1c3157]">
        <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8 sm:py-28">
          <SectionHeading eyebrow="Preguntas frecuentes" title="Todo lo que quieres saber." id="titulo-preguntas" center />
          <div className="space-y-4">
            {faqs.map((item, index) => (
              <FaqItem key={item.q} id={`faq-${index}`} item={item} open={openFaq === index} onToggle={() => setOpenFaq(openFaq === index ? -1 : index)} />
            ))}
          </div>
        </div>
      </section>

      {/* Llamado final (degradado de marca) — un solo botón que lleva al hero */}
      <section aria-labelledby="titulo-cta" className="relative overflow-hidden bg-gradient-to-br from-[#1c3157] via-[#3c5e85] to-[#3c5e85] text-white">
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-[#a0c3d9]/20 blur-[70px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-white/15 blur-[70px]" />
        <AnimatedContent trigger="scroll" distance={20} duration={0.6}>
          <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center sm:px-8 sm:py-24">
            <MascotaMurcielago className="h-16 w-16" label="Murciélago del Equipo Murciélago" />
            <h2 id="titulo-cta" className="mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">Haz de cada clase una experiencia que se recuerde.</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/95 sm:text-xl sm:leading-9">Elige tu rol y empieza a planear, participar y acompañar el avance de tu grupo.</p>
            <a href="#inicio" className="group mt-8 inline-flex min-h-16 items-center justify-center gap-3 rounded-full bg-[#a0c3d9] px-9 text-lg font-extrabold text-[#1c3157] shadow-xl shadow-black/10 transition hover:-translate-y-0.5 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#a0c3d9]/50">
              Elegir mi acceso <ArrowRight size={18} className="transition group-hover:-translate-y-0.5 group-hover:-rotate-45" />
            </a>
          </div>
        </AnimatedContent>
      </section>

      {/* Footer (oscuro) */}
      <footer className="bg-[#1c3157]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-3">
              <MascotaMurcielago className="h-10 w-10" label="Murciélago del Equipo Murciélago" />
              <span className="text-sm font-bold text-white">Equipo Murciélago</span>
            </div>
            <p className="mt-4 max-w-md text-base leading-7 text-[#e3eff6]">Plataforma educativa con herramientas para enseñar y aprender, para escuelas públicas y privadas.</p>
          </div>
          <nav aria-label="Pie de página">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#a0c3d9]">Explora</p>
            <ul className="mt-4 grid grid-cols-2 gap-4 text-base">
              {navLinks.map((link) => (
                <li key={link.href}><a href={link.href} className="text-[#e3eff6] transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a0c3d9]">{link.label}</a></li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/[0.08]">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-sm text-[#e3eff6] sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <span>© 2026 Equipo Murciélago · Plataforma educativa</span>
            <span className="inline-flex items-center gap-2"><GraduationCap size={15} /> Recursos para el aula</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

