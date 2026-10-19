import {
  ArrowRight,
  Atom,
  BarChart3,
  BookOpenCheck,
  Check,
  FlaskConical,
  GraduationCap,
  Lightbulb,
  LockKeyhole,
  Sparkles,
  Telescope,
} from 'lucide-react';
import AnimatedContent from './AnimatedContent';
import SpotlightCard from './SpotlightCard';

const features = [
  {
    icon: Lightbulb,
    number: '01',
    title: 'Juegos creados con IA',
    description:
      'El docente propone un tema y recibe actividades que puede revisar, adaptar y compartir con su grupo.',
    color: 'text-amber-700 bg-amber-100',
    glow: '#fcd34d',
  },
  {
    icon: FlaskConical,
    number: '02',
    title: 'Aprender haciendo',
    description:
      'Retos breves y visuales invitan a observar, probar ideas y comprender las Ciencias Naturales.',
    color: 'text-teal-800 bg-teal-100',
    glow: '#5eead4',
  },
  {
    icon: BarChart3,
    number: '03',
    title: 'Progreso para el docente',
    description:
      'Consulta resultados del grupo y reconoce qué temas necesitan más práctica y acompañamiento.',
    color: 'text-indigo-800 bg-indigo-100',
    glow: '#a5b4fc',
  },
];

const plans = [
  {
    name: 'Plan Gratuito',
    description: 'Para comenzar a explorar la plataforma.',
    price: 'Gratis',
    features: ['Acceso al aula', 'Actividades educativas', 'Progreso del grupo'],
    featured: false,
  },
  {
    name: 'Plan Pro',
    description: 'Más herramientas para crear y acompañar.',
    price: 'Próximamente',
    features: ['Más recursos con IA', 'Nuevas modalidades de juego', 'Reportes ampliados'],
    featured: true,
  },
];

export default function LandingPage({ onIrAlumno, onIrDocente, onRegistroDocente }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#f6f7fb] text-slate-900">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[700px] bg-[radial-gradient(ellipse_at_75%_15%,rgba(129,140,248,0.17),transparent_43%),radial-gradient(ellipse_at_12%_32%,rgba(45,212,191,0.13),transparent_38%)]" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#inicio" className="group inline-flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-950 text-2xl shadow-lg shadow-indigo-950/15 transition group-hover:-rotate-6">🦇</span>
          <span>
            <span className="block text-sm font-black tracking-wide text-indigo-950 sm:text-base">EQUIPO MURCIÉLAGO</span>
            <span className="block text-xs font-medium text-slate-500">Ciencias Naturales · 4.º grado</span>
          </span>
        </a>
        <button type="button" onClick={onIrDocente} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-indigo-200 bg-white px-5 text-sm font-extrabold text-indigo-950 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200">
          <LockKeyhole size={16} /> Iniciar sesión
        </button>
      </header>

      <section id="inicio" className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 md:grid-cols-[1.05fr_0.95fr] md:pb-28 md:pt-20">
        <AnimatedContent trigger="mount" distance={24} duration={0.65} ease="power3.out">
          <div className="max-w-2xl">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/80 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.12em] text-teal-900 shadow-sm sm:text-sm">
              <Sparkles size={15} className="text-amber-600" /> Una nueva forma de explorar la ciencia
            </p>
            <h1 className="text-4xl font-black leading-[1.08] tracking-tight text-indigo-950 sm:text-5xl lg:text-6xl">
              La clase de ciencias más divertida, <span className="text-teal-700">impulsada por IA.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Una plataforma para que docentes creen experiencias educativas y sus alumnos aprendan Ciencias Naturales jugando, explorando y descubriendo a su ritmo.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onIrAlumno} className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-teal-700 px-6 font-extrabold text-white shadow-lg shadow-teal-900/15 transition hover:-translate-y-0.5 hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-300">
                <Telescope size={20} /> Soy Alumno <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
              <button type="button" onClick={onIrDocente} className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-2xl bg-indigo-950 px-6 font-extrabold text-white shadow-lg shadow-indigo-950/15 transition hover:-translate-y-0.5 hover:bg-indigo-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300">
                <BookOpenCheck size={20} /> Soy Docente <ArrowRight size={18} className="transition group-hover:translate-x-1" />
              </button>
            </div>
            <p className="mt-5 text-sm text-slate-500">El alumno entra con el código del aula y su PIN. No necesita correo.</p>
            {onRegistroDocente && (
              <p className="mt-2 text-sm text-slate-600">¿Eres nuevo?{' '}
                <button type="button" onClick={onRegistroDocente} className="font-bold text-indigo-800 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">Crea tu cuenta docente</button>
              </p>
            )}
          </div>
        </AnimatedContent>

        <AnimatedContent trigger="mount" delay={0.12} distance={24} duration={0.75} className="relative mx-auto w-full max-w-[510px]">
          <div className="absolute -right-2 top-2 h-28 w-28 rounded-full bg-amber-200/60 blur-3xl sm:-right-5" />
          <div className="absolute -bottom-5 -left-4 h-36 w-36 rounded-full bg-teal-200/70 blur-3xl" />
          <SpotlightCard theme="light" spotlightColor="#818cf8" intensity={0.12} borderGlow={0.15} className="relative overflow-hidden rounded-[2rem] border border-white bg-white p-5 shadow-[0_30px_90px_-45px_rgba(30,41,89,.32)] sm:p-7" style={{ '--spotlight-card-surface': '#ffffff', '--spotlight-card-shadow': '0 30px 90px -45px rgba(30,41,89,.32)' }}>
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Exploratorio de ciencias</p><h2 className="mt-1 text-lg font-black text-indigo-950">Tu próxima aventura</h2></div>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-100 text-amber-700"><Atom size={23} /></span>
            </div>
            <div className="relative mt-6 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-teal-900 p-6 text-white sm:p-8">
              <div aria-hidden="true" className="absolute -right-8 -top-10 h-40 w-40 rounded-full border border-white/10" />
              <div aria-hidden="true" className="absolute -right-1 top-2 h-24 w-24 rounded-full border border-dashed border-amber-200/40" />
              <span className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-teal-100"><FlaskConical size={14} /> RETO DE HOY</span>
              <p className="relative mt-5 max-w-xs text-2xl font-black leading-tight sm:text-3xl">¿Qué le pasa al agua cuando el sol la calienta?</p>
              <p className="relative mt-3 max-w-sm text-sm leading-6 text-indigo-100">Observa, responde y descubre cómo funciona el ciclo del agua.</p>
              <div className="relative mt-6 flex items-center gap-2" aria-label="Progreso: 2 de 4 pasos">
                {[0, 1, 2, 3].map((step) => <span key={step} className={`h-2 flex-1 rounded-full ${step < 2 ? 'bg-amber-300' : 'bg-white/20'}`} />)}
              </div>
              <span aria-hidden="true" className="absolute bottom-6 right-7 rotate-12 text-5xl opacity-90">💧</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-teal-50 p-4"><span className="text-xs font-bold text-teal-800">APRENDE A TU RITMO</span><p className="mt-1 text-sm font-extrabold text-slate-800">Pequeños grandes hallazgos</p></div>
              <div className="rounded-2xl bg-amber-50 p-4"><span className="text-xs font-bold text-amber-800">CADA IDEA CUENTA</span><p className="mt-1 text-sm font-extrabold text-slate-800">Explora sin miedo a probar</p></div>
            </div>
          </SpotlightCard>
          <div className="absolute -left-4 top-[44%] hidden -translate-x-1/2 rounded-2xl border border-indigo-100 bg-white px-4 py-3 shadow-xl shadow-indigo-950/10 sm:block"><span className="flex items-center gap-2 text-sm font-extrabold text-indigo-950"><GraduationCap size={18} className="text-teal-700" /> Enseñar con propósito</span></div>
        </AnimatedContent>
      </section>

      <section aria-labelledby="caracteristicas" className="border-y border-slate-200/80 bg-white/70 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-800">Tecnología al servicio del aula</p>
            <h2 id="caracteristicas" className="mt-3 text-3xl font-black tracking-tight text-indigo-950 sm:text-4xl">Ideas que se convierten en descubrimientos</h2>
            <p className="mt-4 leading-7 text-slate-600">Herramientas sencillas para enseñar mejor y ayudar a cada estudiante a participar.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, number, title, description, color, glow }, index) => (
              <AnimatedContent key={number} trigger="scroll" delay={index * 0.08} distance={18} duration={0.55} className="h-full">
                <SpotlightCard theme="light" spotlightColor={glow} intensity={0.1} borderGlow={0.12} className="h-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg" style={{ '--spotlight-card-surface': '#ffffff', '--spotlight-card-shadow': '0 18px 45px -30px rgba(30,41,89,.28)' }}>
                  <div className="mb-6 flex items-center justify-between"><span className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}><Icon size={23} /></span><span className="text-xs font-black tracking-widest text-slate-300">{number}</span></div>
                  <h3 className="text-lg font-black text-indigo-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </SpotlightCard>
              </AnimatedContent>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="planes" className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="mb-10 text-center"><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">Crece con tu aula</p><h2 id="planes" className="mt-3 text-3xl font-black tracking-tight text-indigo-950 sm:text-4xl">Planes para aprender juntos</h2><p className="mt-3 text-slate-600">Elige cómo quieres comenzar. Los planes son una vista previa.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
          {plans.map((plan) => (
            <article key={plan.name} className={`relative rounded-3xl border p-6 sm:p-8 ${plan.featured ? 'border-indigo-300 bg-indigo-950 text-white shadow-xl shadow-indigo-950/15' : 'border-slate-200 bg-white text-slate-900 shadow-sm'}`}>
              {plan.featured && <span className="absolute right-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-indigo-950">Próximamente</span>}
              <p className={`text-sm font-extrabold ${plan.featured ? 'text-indigo-200' : 'text-teal-800'}`}>{plan.name}</p>
              <p className="mt-2 text-3xl font-black">{plan.price}</p>
              <p className={`mt-2 text-sm ${plan.featured ? 'text-indigo-200' : 'text-slate-600'}`}>{plan.description}</p>
              <ul className="mt-6 space-y-3">{plan.features.map((item) => <li key={item} className={`flex items-center gap-2 text-sm font-medium ${plan.featured ? 'text-slate-100' : 'text-slate-700'}`}><Check size={16} className={plan.featured ? 'text-teal-300' : 'text-teal-700'} />{item}</li>)}</ul>
              <button type="button" onClick={plan.featured ? undefined : onIrDocente} disabled={plan.featured} className={`mt-7 min-h-12 w-full rounded-xl px-4 font-extrabold transition focus-visible:outline-none focus-visible:ring-4 ${plan.featured ? 'cursor-not-allowed bg-white/10 text-indigo-200 focus-visible:ring-white/20' : 'bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-200'}`}>
                {plan.featured ? 'Disponible próximamente' : 'Comenzar gratis'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs font-medium text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© 2026 Equipo Murciélago. Todos los derechos reservados.</span>
          <span className="inline-flex items-center gap-2"><GraduationCap size={15} className="text-indigo-700" /> Ciencias Naturales para 4.º grado</span>
        </div>
      </footer>
    </main>
  );
}
