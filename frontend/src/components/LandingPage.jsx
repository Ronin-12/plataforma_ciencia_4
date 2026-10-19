import { ArrowRight, GraduationCap, Sparkles } from 'lucide-react';
import AnimatedContent from './AnimatedContent';
import SpotlightCard from './SpotlightCard';

const features = [
  {
    icon: '🧠',
    title: 'Juegos con IA',
    description: 'El docente describe un tema y Gemini genera un juego educativo para llevarlo al aula.',
    color: '#a78bfa',
  },
  {
    icon: '🚀',
    title: 'Aprendizaje Gamificado',
    description: 'Una experiencia intuitiva y divertida para que niñas y niños de 4.º grado aprendan explorando.',
    color: '#5eead4',
  },
  {
    icon: '📊',
    title: 'Control Total',
    description: 'El docente consulta los avances de su grupo y acompaña el aprendizaje de cada alumno.',
    color: '#fbbf24',
  },
];

export default function LandingPage({ onIrAlumno, onIrDocente }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08090d] text-white selection:bg-violet-300/30">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-[-24rem] h-[46rem] w-[64rem] -translate-x-1/2 rounded-full bg-violet-700/15 blur-[120px]" />
        <div className="absolute -left-48 top-[34rem] h-[28rem] w-[28rem] rounded-full bg-teal-500/[0.08] blur-[110px]" />
        <div className="absolute -right-48 top-[52rem] h-[30rem] w-[30rem] rounded-full bg-amber-500/[0.07] blur-[120px]" />
        <div className="space-starfield absolute inset-0 opacity-35" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <a href="#inicio" className="group inline-flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300">
          <span className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-2xl transition group-hover:border-white/25 group-hover:bg-white/[0.08]">🦇</span>
          <span className="text-sm font-bold tracking-wide text-white sm:text-base">Equipo Murciélago</span>
        </a>
        <button type="button" onClick={onIrDocente} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-[#111217] transition hover:-translate-y-0.5 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30">
          Iniciar Sesión <ArrowRight size={16} />
        </button>
      </header>

      <section id="inicio" className="relative mx-auto flex min-h-[570px] max-w-7xl flex-col items-center justify-center px-5 pb-20 pt-14 text-center sm:px-8 sm:pt-16 md:min-h-[640px]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
          <div className="landing-float absolute left-[8%] top-[19%] grid h-28 w-36 -rotate-12 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/15 to-emerald-950/50 text-4xl shadow-2xl shadow-black/30">🌿</div>
          <div className="landing-float landing-float-delay absolute right-[8%] top-[24%] grid h-28 w-36 rotate-12 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-sky-300/15 to-indigo-950/60 text-4xl shadow-2xl shadow-black/30">🌎</div>
          <div className="landing-float landing-float-slow absolute bottom-[13%] left-[17%] grid h-24 w-32 rotate-6 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-amber-300/15 to-orange-950/50 text-4xl shadow-2xl shadow-black/30">🦋</div>
          <div className="landing-float landing-float-delay absolute bottom-[12%] right-[17%] grid h-24 w-32 -rotate-6 place-items-center rounded-3xl border border-white/10 bg-gradient-to-br from-violet-300/15 to-violet-950/60 text-4xl shadow-2xl shadow-black/30">🔬</div>
        </div>

        <AnimatedContent trigger="mount" distance={20} duration={0.7} ease="power3.out" className="relative z-10 flex flex-col items-center">
          <p className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold tracking-wide text-slate-300 shadow-lg shadow-black/10 sm:text-sm">
            <Sparkles size={15} className="text-amber-300" /> Ciencias Naturales · 4.º grado
          </p>
          <h1 className="max-w-4xl text-5xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            El futuro de las ciencias <span className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-teal-200 bg-clip-text text-transparent">empieza aquí.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
            Una plataforma donde los docentes crean juegos interactivos con Inteligencia Artificial y los alumnos aprenden explorando.
          </p>
          <div className="mt-9 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
            <button type="button" onClick={onIrAlumno} className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-white px-7 font-extrabold text-[#111217] shadow-[0_12px_40px_rgba(255,255,255,.08)] transition hover:-translate-y-0.5 hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30">
              Soy Alumno <ArrowRight size={18} className="transition group-hover:translate-x-1" />
            </button>
            <button type="button" onClick={onIrDocente} className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full border border-white/20 bg-white/[0.03] px-7 font-extrabold text-white transition hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20">
              Soy Docente <ArrowRight size={18} className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-white" />
            </button>
          </div>
          <p className="mt-5 text-xs text-slate-500">El alumno accede con el código de su aula y su PIN.</p>
        </AnimatedContent>
        <a href="#caracteristicas" aria-label="Conoce las características" className="absolute bottom-5 left-1/2 hidden h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-white/30 hover:text-white sm:flex">
          <span aria-hidden="true" className="animate-bounce">↓</span>
        </a>
      </section>

      <section id="caracteristicas" aria-labelledby="titulo-caracteristicas" className="mx-auto max-w-7xl px-5 pb-20 pt-8 sm:px-8 sm:pb-24">
        <div className="mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">Una plataforma para descubrir</p>
            <h2 id="titulo-caracteristicas" className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">Aprender ciencia puede sentirse como una aventura.</h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-400">Recursos para crear, jugar y acompañar el progreso desde el aula.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <AnimatedContent key={feature.title} trigger="scroll" delay={index * 0.08} distance={18} duration={0.55} className="h-full">
              <SpotlightCard theme="dark" spotlightColor={feature.color} intensity={0.16} borderGlow={0.18} className="h-full rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15" style={{ '--spotlight-card-surface': 'rgba(255,255,255,0.035)', '--spotlight-card-shadow': '0 20px 60px -40px rgba(0,0,0,.8)' }}>
                <div className="mb-6 flex items-center justify-between"><span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.05] text-2xl">{feature.icon}</span><span className="text-xs font-bold tracking-[0.16em] text-slate-600">0{index + 1}</span></div>
                <h3 className="text-lg font-bold text-white">{feature.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{feature.description}</p>
              </SpotlightCard>
            </AnimatedContent>
          ))}
        </div>
      </section>

      <footer className="border-t border-white/[0.08]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© 2026 Equipo Murciélago - Plataforma Piloto</span>
          <span className="inline-flex items-center gap-2"><GraduationCap size={15} /> Ciencias Naturales para 4.º grado</span>
        </div>
      </footer>
    </main>
  );
}
