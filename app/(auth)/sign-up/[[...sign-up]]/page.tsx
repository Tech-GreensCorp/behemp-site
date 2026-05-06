import { SignUp } from '@clerk/nextjs';

/**
 * Página de cadastro com design premium split-screen.
 * Esquerda: branding da plataforma.
 * Direita: formulário do Clerk.
 *
 * Mesmo visual da página de login.
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      {/* ── Lado esquerdo — Branding ── */}
      <div className="relative hidden w-1/2 overflow-hidden bg-stone-900 lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Gradientes de fundo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 20% 50%, rgba(180,120,80,0.25) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(140,90,60,0.2) 0%, transparent 50%)',
          }}
        />
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, #c8956c 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full pointer-events-none opacity-15"
          style={{ background: 'radial-gradient(circle, #a07850 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <a href="/" className="inline-flex items-center">
            <img src="/logo.png" alt="Be4Hope" className="h-16 w-auto brightness-0 invert" />
          </a>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <p
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#c8956c' }}
            >
              Plataforma Médica
            </p>
            <h1 className="font-display text-4xl font-light leading-tight text-white">
              Cuidar de quem cuida<br />
              é nosso{' '}
              <em className="font-serif italic" style={{ color: '#c8956c' }}>ato de amor.</em>
            </h1>
            <p className="max-w-sm text-base leading-relaxed text-stone-400">
              Crie sua conta na plataforma Be4Hope e tenha acesso a consultas,
              pacientes e tratamentos com cannabis medicinal de forma segura.
            </p>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { num: '21', label: 'Anos de\nhistória' },
              { num: 'ONG', label: 'Sem fins\nlucrativos' },
              { num: '26', label: 'Estados\natendidos' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <p className="text-2xl font-bold" style={{ color: '#c8956c' }}>{item.num}</p>
                <p className="mt-1 whitespace-pre-line text-xs leading-snug text-stone-500">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé */}
        <div className="relative z-10">
          <p className="text-xs text-stone-600">
            © {new Date().getFullYear()} Be4Hope · Cannabis Medicinal com Ciência e Cuidado
          </p>
        </div>
      </div>

      {/* ── Lado direito — Formulário ── */}
      <div className="flex w-full flex-col items-center justify-center bg-[#f5f0eb] px-6 py-12 lg:w-1/2">
        {/* Logo mobile */}
        <div className="mb-8 lg:hidden">
          <a href="/" className="inline-flex items-center">
            <img src="/logo.png" alt="Be4Hope" className="h-16 w-auto" />
          </a>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-6 space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Criar sua conta</h2>
            <p className="text-sm text-stone-500">Preencha os dados para começar</p>
          </div>

          <SignUp
            forceRedirectUrl="/redirect"
            appearance={{
              layout: {
                logoPlacement: 'none',
                socialButtonsVariant: 'iconButton',
              },
              variables: {
                colorPrimary: '#c8956c',
                colorBackground: '#ffffff',
                colorInputBackground: '#ffffff',
                colorText: '#1c1917',
                colorTextSecondary: '#78716c',
                colorInputText: '#1c1917',
                borderRadius: '0.75rem',
                fontFamily: 'inherit',
              },
              elements: {
                card: 'shadow-md border border-stone-100 rounded-2xl',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 rounded-xl',
                formButtonPrimary:
                  'bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-xl',
                formFieldInput:
                  'border-stone-200 focus:border-stone-400 bg-white rounded-xl',
                footerActionLink: 'text-stone-700 hover:text-stone-900 font-medium',
                dividerLine: 'bg-stone-200',
                dividerText: 'text-stone-400 text-xs',
                footer: 'rounded-b-2xl',
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
