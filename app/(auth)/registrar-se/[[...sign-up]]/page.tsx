'use client';

import { useSignUp } from '@clerk/nextjs/legacy';
import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, HeartPulse, MapPinned, Users, Loader2, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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
      { threshold: 0.1 },
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
  const router = useRouter();
  const redirectUrl = searchParams.get('redirect_url') || '/redirect';

  const { isLoaded, signUp, setActive } = useSignUp();

  // Form states
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showSenha, setShowSenha] = useState(false);
  const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

  // Verification state
  const [pendingVerification, setPendingVerification] = useState(false);
  const [codigoVerificacao, setCodigoVerificacao] = useState('');

  // Status states
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    requestAnimationFrame(() => {
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
        })),
      );
    });
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const translateClerkError = (err: any): string => {
    const msg = err?.message || err?.errors?.[0]?.message || '';
    const code = err?.code || err?.errors?.[0]?.code || '';

    if (code === 'form_password_length_too_short') {
      return 'A senha deve conter no mínimo 8 caracteres.';
    }
    if (code === 'form_identifier_exists') {
      return 'Este endereço de e-mail já está em uso.';
    }
    if (code === 'form_param_format_invalid') {
      const paramName = err?.errors?.[0]?.meta?.paramName || '';
      if (paramName === 'email_address') {
        return 'Por favor, insira um e-mail válido.';
      }
      if (paramName === 'phone_number') {
        return 'Por favor, insira um telefone válido com DDD.';
      }
    }
    if (msg.toLowerCase().includes('password must be at least 8 characters')) {
      return 'A senha deve conter no mínimo 8 caracteres.';
    }
    if (msg.toLowerCase().includes('already in use') || msg.toLowerCase().includes('exists')) {
      return 'Este endereço de e-mail já está em uso.';
    }
    if (
      msg.toLowerCase().includes('invalid code') ||
      msg.toLowerCase().includes('incorrect code')
    ) {
      return 'Código de verificação inválido ou expirado.';
    }
    return msg || 'Ocorreu um erro. Por favor, verifique os dados e tente novamente.';
  };

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const digits = input.replace(/\D/g, '');

    let formatted = '';
    if (digits.length > 0) {
      if (digits.length <= 2) {
        formatted = `(${digits}`;
      } else if (digits.length <= 6) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else if (digits.length <= 10) {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
      } else {
        formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
      }
    }
    setTelefone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    if (senha !== confirmarSenha) {
      setErro('As senhas não coincidem.');
      return;
    }

    const nameParts = nomeCompleto.trim().split(/\s+/);
    if (nameParts.length < 2) {
      setErro('Por favor, informe seu nome completo (nome e sobrenome).');
      return;
    }

    const phoneDigits = telefone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      setErro('Por favor, insira um telefone válido com DDD (10 ou 11 dígitos).');
      return;
    }

    setLoading(true);
    setErro('');

    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ');
    const cleanPhone = `+55${phoneDigits}`;

    try {
      await signUp.create({
        emailAddress: email,
        password: senha,
        firstName,
        lastName,
        unsafeMetadata: {
          phone: cleanPhone,
        },
      });

      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err) {
      console.error(err);
      setErro(translateClerkError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);
    setErro('');

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: codigoVerificacao,
      });

      if (completeSignUp.status === 'complete') {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push(redirectUrl);
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
        setErro('A verificação não pôde ser concluída. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      setErro(translateClerkError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVoltar = () => {
    setPendingVerification(false);
    setErro('');
  };

  const handleGoogleSignUp = async () => {
    if (!isLoaded) return;
    setLoading(true);
    setErro('');
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/redirect',
        redirectUrlComplete: '/redirect',
      });
    } catch (err) {
      setErro(translateClerkError(err));
      setLoading(false);
    }
  };

  return (
    <div className="mt-24 flex min-h-[calc(100vh-6rem)]">
      {/* ════════════════════════════════════
          LADO ESQUERDO — BRANDING PREMIUM
          ════════════════════════════════════ */}
      <div
        className="relative hidden w-[55%] overflow-hidden lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-6rem)] lg:flex-col lg:justify-between lg:p-12"
        style={{ background: 'linear-gradient(145deg, #ffffff 0%, #fffbf9 50%, #fff7f4 100%)' }}
      >
        {/* ── Partículas flutuantes ── */}
        {particles.map((p) => (
          <div
            key={p.id}
            className="pointer-events-none absolute rounded-full"
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
          className="pointer-events-none absolute -top-32 -right-32 rounded-full"
          style={{
            width: 520,
            height: 520,
            background: 'radial-gradient(circle, rgba(234,84,41,0.07) 0%, transparent 70%)',
            animation: 'spin-slow 30s linear infinite',
          }}
        />
        <div
          className="pointer-events-none absolute -top-32 -right-32 rounded-full border border-orange-100"
          style={{
            width: 520,
            height: 520,
            animation: 'spin-slow 30s linear infinite reverse',
          }}
        />
        <div
          className="pointer-events-none absolute -top-32 -right-32 rounded-full border border-orange-50"
          style={{
            width: 420,
            height: 420,
            marginTop: 50,
            marginRight: 50,
          }}
        />

        {/* ── Gradiente inferior esquerdo ── */}
        <div
          className="pointer-events-none absolute -bottom-40 -left-40 rounded-full"
          style={{
            width: 480,
            height: 480,
            background: 'radial-gradient(circle, rgba(234,84,41,0.06) 0%, transparent 70%)',
            animation: 'particle-float 12s ease-in-out infinite reverse',
          }}
        />

        {/* ── Barra lateral laranja ── */}
        <div
          className="pointer-events-none absolute top-0 left-0 h-full w-1.5"
          style={{
            background:
              'linear-gradient(to bottom, transparent 5%, #EA5429 30%, #EA5429 70%, transparent 95%)',
          }}
        />

        {/* ── Padrão de pontos ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(234,84,41,0.08) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at 80% 20%, rgba(0,0,0,0.15) 0%, transparent 60%)',
          }}
        />

        {/* ── Logo (escondido pois o header já possui a logo) ── */}
        <div
          className="invisible relative z-10"
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
            <div className="-mt-20 flex items-center gap-2">
              <div className="h-px w-8" style={{ background: '#EA5429' }} />
              <p
                className="text-xs font-semibold tracking-[0.3em] uppercase"
                style={{ color: '#EA5429' }}
              >
                Plataforma do médico e do paciente
              </p>
            </div>

            <h1 className="font-display text-[2.6rem] leading-[1.08] font-bold tracking-tight text-gray-900">
              <span className="text-accent-italic relative">
                Você{' '}
                <span
                  className="absolute -bottom-1 left-0 h-0.5 w-full rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #EA5429, transparent)',
                    opacity: 0.4,
                  }}
                />
              </span>
              não precisa
              <br />
              enfrentar isso sozinho.
            </h1>

            <p className="max-w-xs text-[0.95rem] leading-relaxed text-gray-500">
              Há mais de duas décadas conectando pessoas ao cuidado com Medicina Endocanabinóide,
              responsabilidade, acolhimento e do seu lado em cada etapa.
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
                  className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-400 group-hover:opacity-100"
                  style={{
                    background: 'linear-gradient(135deg, rgba(234,84,41,0.04) 0%, transparent 60%)',
                  }}
                />
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110"
                    style={{ background: 'rgba(234,84,41,0.08)' }}
                  >
                    {(() => {
                      const DynIcon = stat.icon;
                      return <DynIcon size={18} />;
                    })()}
                  </div>
                  <div>
                    <p
                      className="text-[1.6rem] leading-none font-bold tracking-tight"
                      style={{ color: '#EA5429' }}
                    >
                      {stat.num !== null ? (
                        <AnimatedCounter target={stat.num} duration={4000} />
                      ) : (
                        stat.text
                      )}
                    </p>
                    <p className="mt-1 text-[0.72rem] leading-snug font-medium text-gray-400">
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
        </div>

        {/* ── Onda decorativa ── */}
        <svg
          className="pointer-events-none absolute top-1/2 right-0 h-full -translate-y-1/2 opacity-[0.04]"
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
          className="pointer-events-none absolute top-0 right-0 h-72 w-72"
          style={{
            background:
              'radial-gradient(circle at top right, rgba(234,84,41,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-56 w-56"
          style={{
            background:
              'radial-gradient(circle at bottom left, rgba(234,84,41,0.05) 0%, transparent 70%)',
          }}
        />

        {/* Logo mobile (escondido pois o header já possui a logo) */}
        <div className="mb-8 hidden lg:hidden">
          <Link href="/">
            <img src="/logo.png" alt="Be4Hope" className="h-14 w-auto" />
          </Link>
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
          <div className="mb-6 space-y-1">
            <h2 className="font-display text-2xl font-bold tracking-tight text-gray-900">
              {pendingVerification ? 'Verifique seu e-mail' : 'Crie sua conta.'}
            </h2>
            <p className="text-sm text-gray-400">
              {pendingVerification
                ? 'Enviamos um código de verificação para o seu e-mail.'
                : 'Preencha os dados para começar sua jornada.'}
            </p>
          </div>

          {/* Elemento requerido pelo Clerk para proteção de Bot (CAPTCHA) */}
          <div id="clerk-captcha" />

          {erro && (
            <div className="mb-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">
              {erro}
            </div>
          )}

          {!pendingVerification ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
                <div className="space-y-1.5">
                  <Label htmlFor="nomeCompleto" className="text-xs font-medium text-gray-700">
                    Nome Completo
                  </Label>
                  <Input
                    id="nomeCompleto"
                    type="text"
                    required
                    placeholder="Nome e sobrenome"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    className="h-12 rounded-xl border-gray-200 bg-white transition-colors duration-200 focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="telefone" className="text-xs font-medium text-gray-700">
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    type="text"
                    required
                    placeholder="(DD) 99999-9999"
                    value={telefone}
                    onChange={handleTelefoneChange}
                    className="h-12 rounded-xl border-gray-200 bg-white transition-colors duration-200 focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-gray-700">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-gray-200 bg-white transition-colors duration-200 focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="senha" className="text-xs font-medium text-gray-700">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="senha"
                      type={showSenha ? 'text' : 'password'}
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      className="h-12 rounded-xl border-gray-200 bg-white pr-10 transition-colors duration-200 focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenha(!showSenha)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmarSenha" className="text-xs font-medium text-gray-700">
                    Confirmar Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmarSenha"
                      type={showConfirmarSenha ? 'text' : 'password'}
                      required
                      placeholder="Confirme sua senha"
                      value={confirmarSenha}
                      onChange={(e) => setConfirmarSenha(e.target.value)}
                      className="h-12 rounded-xl border-gray-200 bg-white pr-10 transition-colors duration-200 focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmarSenha(!showConfirmarSenha)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#EA5429] font-semibold tracking-wide text-white transition-colors duration-200 hover:bg-[#D64319]"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Criar Conta'}
                </Button>
              </div>

              {/* Botão de cadastro alternativo / Google */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <span className="text-[11px] font-medium tracking-wider text-gray-400 uppercase">
                    ou
                  </span>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>

                <Button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={loading}
                  className="flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border border-gray-200 bg-white font-medium text-gray-700 transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  Registrar com Google
                </Button>

                <p className="text-center text-xs text-gray-500">
                  Já possui uma conta?{' '}
                  <Link
                    href="/entrar"
                    className="font-semibold text-[#EA5429] hover:text-[#D64319] hover:underline"
                  >
                    Entrar
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/40">
                <div className="space-y-1.5">
                  <Label htmlFor="codigoVerificacao" className="text-xs font-medium text-gray-700">
                    Código de 6 dígitos
                  </Label>
                  <Input
                    id="codigoVerificacao"
                    type="text"
                    required
                    placeholder="000000"
                    maxLength={6}
                    value={codigoVerificacao}
                    onChange={(e) => setCodigoVerificacao(e.target.value.replace(/\D/g, ''))}
                    className="h-12 rounded-xl border-gray-200 bg-white text-center text-lg font-bold tracking-[0.5em] transition-colors duration-200 placeholder:tracking-normal focus-visible:border-[#EA5429] focus-visible:ring-3 focus-visible:ring-[#EA5429]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[#EA5429] font-semibold tracking-wide text-white transition-colors duration-200 hover:bg-[#D64319]"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Confirmar Código'}
                </Button>

                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVoltar}
                    disabled={loading}
                    className="flex h-10 w-full cursor-pointer items-center justify-center rounded-full border border-gray-200 tracking-wide text-gray-500 transition-colors duration-200 hover:bg-gray-50"
                  >
                    Voltar para o cadastro
                  </Button>
                </div>
              </div>
            </form>
          )}
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
