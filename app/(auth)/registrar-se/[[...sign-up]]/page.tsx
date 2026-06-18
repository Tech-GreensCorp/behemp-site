'use client';

import { SignUp } from '@clerk/nextjs';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  HeartPulse,
  MapPinned,
  UserPlus,
  Users,
} from 'lucide-react';

/* ── Dados dos KPIs ───────────────────────────────── */
const STATS = [
  {
    num: 24,
    suffix: '',
    label: 'anos de histórias reais',
    icon: CalendarDays,
  },
  {
    num: null,
    text: 'ONG',
    suffix: '',
    label: 'sem fins lucrativos',
    icon: HeartPulse,
  },
  {
    num: 26,
    suffix: '',
    label: 'estados atendidos',
    icon: MapPinned,
  },
  {
    num: null,
    text: '8.000+',
    suffix: '',
    label: 'Pacientes atendidos',
    icon: Users,
  },
];

/* ── Partícula ───────────────────────────────────── */
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

/* ── Contador animado ────────────────────────────── */
function AnimatedCounter({ target, duration = 4000 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) setStarted(true);
      },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [started, target, duration]);

  return <span ref={ref}>{count}</span>;
}

/* ── Componente principal ────────────────────────── */
export default function SignUpPage() {
  const [mounted, setMounted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect_url') || '/redirect';

  useEffect(() => {
    setMounted(true);
    setParticles(
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 6 + 2,
        duration: Math.random() * 8 + 6,
        delay: Math.random() * 4,
        opacity: Math.random() * 0.25 + 0.05,
      }))
    );
  }, []);

  return (
    <div className="mt-24 flex h-[calc(100vh-6rem)] overflow-hidden">
      {/* ════════════════════════════════════
          LADO ESQUERDO — BRANDING PREMIUM
          ════════════════════════════════════ */}
      <div
        className="relative hidden w-[55%] overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{ background: 'linear-gradient(145deg, #ffffff 0%, #fffbf9 50%, #fff7f4 100%)' }}
      >
        {/* ── Partículas flutuantes ── */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              background: '#EA5429',
              opacity: p.opacity,
              animation: `particle-float ${p.duration}s ease-in-out ${p.delay}s infinite`,
            }}
          />
        ))}

        {/* ── Círculo decorativo grande ── */}
        <div
          className="absolute -top-32 -right-32 rounded-full pointer-events-none"
          style={{
            width: 520,
            height: 520,
            background: 'radial-gradient(circle, rgba(234,84,41,0.07) 0%, transparent 70%)',
            animation: 'spin-slow 30s linear infinite',
          }}
        />
        <div
          className="absolute -top-32 -right-32 rounded-full border border-orange-100 pointer-events-none"
          style={{
            width: 520,
            height: 520,
            animation: 'spin-slow 30s linear infinite reverse',
          }}
        />
        <div
          className="absolute -top-32 -right-32 rounded-full border border-orange-50 pointer-events-none"
          style={{
            width: 420,
            height: 420,
            marginTop: 50,
            marginRight: 50,
          }}
        />

        {/* ── Gradiente inferior esquerdo ── */}
        <div
          className="absolute -bottom-40 -left-40 rounded-full pointer-events-none"
          style={{
            width: 480,
            height: 480,
            background: 'radial-gradient(circle, rgba(234,84,41,0.06) 0%, transparent 70%)',
            animation: 'particle-float 12s ease-in-out infinite reverse',
          }}
        />

        {/* ── Barra lateral laranja ── */}
        <div
          className="absolute left-0 top-0 w-1.5 h-full pointer-events-none"
          style={{
            background:
              'linear-gradient(to bottom, transparent 5%, #EA5429 30%, #EA5429 70%, transparent 95%)',
          }}
        />

        {/* ── Padrão de pontos ── */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(234,84,41,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage:
              'radial-gradient(ellipse at 80% 20%, rgba(0,0,0,0.15) 0%, transparent 60%)',
          }}
        />

        {/* ── Logo (escondido pois o header já possui a logo) ── */}
        <div
          className="relative z-10 invisible"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(-24px)',
            transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
          }}
        >
          <div className="h-14 w-auto" />
        </div>

        {/* ── Conteúdo central ── */}
        <div className="relative z-10 space-y-10">
          {/* Texto principal */}
          <div
            className="space-y-5"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateX(0)' : 'translateX(-30px)',
              transition: 'opacity 0.8s ease-out 0.15s, transform 0.8s ease-out 0.15s',
            }}
          >
            <div className="flex items-center gap-2 -mt-20">
              <div className="h-px w-8" style={{ background: '#EA5429' }} />
              <p
                className="text-xs font-semibold uppercase tracking-[0.3em]"
                style={{ color: '#EA5429' }}
              >
                Plataforma Médica
              </p>
            </div>

            <h1 className="font-display text-[2.6rem] font-bold leading-[1.08] tracking-tight text-gray-900">
              Cuidar de quem cuida
              <br />
              é nosso{' '}
              <span className="text-accent-italic relative">
                ato de amor.
                <span
                  className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #EA5429, transparent)',
                    opacity: 0.4,
                  }}
                />
              </span>
            </h1>

            <p className="max-w-xs text-[0.95rem] leading-relaxed text-gray-500">
              Crie sua conta e acesse tratamentos com Medicina Endocanabinóide de forma
              segura, humanizada e sem custo.
            </p>
          </div>

          {/* ── KPIs com ícones ── */}
          <div
            className="grid grid-cols-2 gap-3"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(24px)',
              transition: 'opacity 0.8s ease-out 0.35s, transform 0.8s ease-out 0.35s',
            }}
          >
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white/70 p-4 backdrop-blur-sm transition-all duration-400 hover:-translate-y-1 hover:border-orange-200 hover:bg-white hover:shadow-lg hover:shadow-orange-100/50"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl"
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,84,41,0.04) 0%, transparent 60%)',
                  }}
                />
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(234,84,41,0.08)' }}
                  >
                    {(() => { const DynIcon = stat.icon; return <DynIcon size={18} />; })()}
                  </div>
                  <div>
                    <p
                      className="text-[1.6rem] font-bold leading-none tracking-tight"
                      style={{ color: '#EA5429' }}
                    >
                      {stat.num !== null ? (
                        <AnimatedCounter target={stat.num} duration={4000} />
                      ) : (
                        stat.text
                      )}
                    </p>
                    <p className="mt-1 text-[0.72rem] leading-snug text-gray-400 font-medium">
                      {stat.label}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Selo de confiança ── */}
          <div
            className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white/60 px-4 py-3 backdrop-blur-sm"
            style={{
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: 'opacity 0.8s ease-out 0.55s, transform 0.8s ease-out 0.55s',
            }}
          >
            <div className="flex -space-x-2">
              {['#EA5429', '#c8956c', '#2D4F3C'].map((color, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white"
                  style={{ background: color }}
                >
                  {['M', 'P', 'A'][i]}
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700">Junte-se à nossa rede</p>
              <p className="text-[0.68rem] text-gray-400">Médicos · Pacientes · Administração</p>
            </div>
            <div className="ml-auto flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg key={s} className="h-3 w-3" viewBox="0 0 12 12" fill="#EA5429">
                  <path d="M6 1l1.39 2.82L10.5 4.23l-2.25 2.19.53 3.08L6 7.82l-2.78 1.48.53-3.08L1.5 4.23l3.11-.41z" />
                </svg>
              ))}
            </div>
          </div>
        </div>

        {/* ── Rodapé ── */}
        <div
          className="relative z-10 flex items-center justify-between"
          style={{
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.8s ease-out 0.7s',
          }}
        >
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} Be4Hope · Medicina Endocanabinóide com Ciência e Cuidado
          </p>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[0.65rem] text-gray-400">Cadastros abertos</span>
          </div>
        </div>

        {/* ── Onda decorativa ── */}
        <svg
          className="absolute right-0 top-1/2 -translate-y-1/2 h-full opacity-[0.04] pointer-events-none"
          viewBox="0 0 80 600"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M80 0 C40 100, 80 150, 40 200 C0 250, 80 300, 40 350 C0 400, 80 450, 40 500 C0 550, 80 580, 80 600"
            fill="none"
            stroke="#EA5429"
            strokeWidth="60"
          />
        </svg>
      </div>

      {/* ════════════════════════════════════
          LADO DIREITO — FORMULÁRIO
          ════════════════════════════════════ */}
      <div className="relative flex w-full flex-col items-center justify-center bg-[#F5F2ED] px-6 py-12 lg:w-[45%]">
        <div
          className="absolute top-0 right-0 h-72 w-72 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(234,84,41,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-0 left-0 h-56 w-56 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at bottom left, rgba(234,84,41,0.05) 0%, transparent 70%)',
          }}
        />

        {/* Logo mobile (escondido pois o header já possui a logo) */}
        <div className="mb-8 lg:hidden hidden">
          <a href="/">
            <img src="/logo.png" alt="Be4Hope" className="h-14 w-auto" />
          </a>
        </div>

        {/* Formulário */}
        <div
          className="relative z-10 w-full max-w-sm"
          style={{
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(28px)',
            transition: 'opacity 0.8s ease-out 0.25s, transform 0.8s ease-out 0.25s',
          }}
        >
          {/* Cabeçalho — contexto de REGISTRO */}
          <div className="mb-8 space-y-1">
            <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
              Crie sua conta.
            </h2>
            <p className="text-sm text-gray-400">Preencha os dados para começar sua jornada.</p>
          </div>

          <SignUp
            forceRedirectUrl={redirectUrl}
            appearance={{
              options: {
                logoPlacement: 'none',
                socialButtonsVariant: 'iconButton',
              },
              variables: {
                colorPrimary: '#EA5429',
                colorBackground: '#ffffff',
                colorInput: '#ffffff',
                colorForeground: '#1A1612',
                colorMutedForeground: '#8A7F73',
                colorInputForeground: '#1A1612',
                borderRadius: '0.75rem',
                fontFamily: 'inherit',
              },
              elements: {
                card: 'shadow-xl shadow-gray-200/60 border border-gray-100/80 rounded-2xl',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-xl transition-all duration-200 hover:shadow-sm hover:border-gray-300',
                formButtonPrimary:
                  'bg-[#EA5429] hover:bg-[#D64319] text-white font-semibold rounded-full px-8 tracking-wide transition-colors duration-200',
                formFieldInput:
                  'h-12 border-gray-200 focus:border-[#EA5429] focus:ring-2 focus:ring-[#EA5429]/20 bg-white rounded-xl transition-colors duration-200',
                footerActionLink: 'text-[#EA5429] hover:text-[#D64319] font-semibold',
                dividerLine: 'bg-gray-200',
                dividerText: 'text-gray-400 text-xs',
                footer: 'rounded-b-2xl',
                formFieldLabel: 'text-gray-700 font-medium text-sm',
              },
            }}
          />
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes particle-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          33%       { transform: translateY(-18px) scale(1.1); }
          66%       { transform: translateY(-8px) scale(0.95); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
