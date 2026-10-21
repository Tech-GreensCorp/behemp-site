/**
 * 🔴 NÃO É GUARDA, E NÃO RODA NO `pnpm test`. É a PRÉVIA das possibilidades da ADR-0028.
 *
 * Mesma técnica de `previa-da-tela.test.ts`: renderiza o formulário REAL do cadastro para HTML
 * estático, com o Clerk simulado e o CSS do build — porque o ambiente local não tem chave do
 * Clerk, e a página de verdade não renderiza sem ela. O que se vê aqui são os mesmos componentes
 * que vão para produção, não uma cópia.
 *
 * Gera UMA prévia por possibilidade da etapa 1, e um índice que abre todas:
 *
 *   1. nada bateu                         → o "Continuar" de sempre
 *   2. veio da Greens, nada bateu         → "Confirme seus dados"
 *   3. CPF na ficha de outra conta        → suporte da BeHemp, com o protocolo (DO-62)
 *   4. o e-mail já tem conta              → "Entrar na minha conta" (ADR-0016 D-07)
 *   5. o telefone é de outra conta        → o campo trava: "este número está em uso" (DO-68)
 *   6. logado em OUTRA conta              → "É você?", com Sair que fica na página (DO-60)
 *   7. logado na PRÓPRIA conta            → "Você já está logado", sem senha
 *
 * ⚠️ O QUE A PRÉVIA NÃO MOSTRA: o clique. É HTML estático — os botões aparecem, não funcionam.
 * O que o clique faz está provado na integração e no guarda; ver a tela reagindo exige a
 * `CLERK_SECRET_KEY` de desenvolvimento.
 *
 * COMO RODAR (depois de `pnpm build`, que gera o CSS):
 *   npx vitest run --config vitest.integracao.mts __tests__/integracao/previa-da-identidade.test.ts
 *   python3 -m http.server 4410 --directory previa-da-identidade
 *   → http://localhost:4410
 *
 * SAÍDA: a pasta `previa-da-identidade/` na raiz — no `.gitignore`.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, vi } from 'vitest';

// O componente importa a action, que importa `db`. O módulo só precisa CARREGAR.
process.env.DATABASE_URL = 'postgresql://previa:previa@127.0.0.1:5432/previa';

/** O estado da sessão simulada — cada cenário ajusta antes de renderizar. */
const sessao = { logada: false, email: '' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/cadastro/previa',
}));
vi.mock('@clerk/nextjs/legacy', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: null, setActive: async () => {} }),
}));
vi.mock('@clerk/nextjs', () => ({
  useSignUp: () => ({ isLoaded: true, signUp: null, setActive: async () => {} }),
  useClerk: () => ({ signOut: async () => {} }),
  useUser: () => ({
    isLoaded: true,
    isSignedIn: sessao.logada,
    user: sessao.logada ? { primaryEmailAddress: { emailAddress: sessao.email } } : null,
  }),
  useAuth: () => ({
    isLoaded: true,
    isSignedIn: sessao.logada,
    userId: sessao.logada ? 'user_previa' : null,
    sessionId: sessao.logada ? 'sess_previa' : null,
  }),
}));

const RAIZ = join(import.meta.dirname, '..', '..');
const SAIDA = join(RAIZ, 'previa-da-identidade');

/** Dados sintéticos. CPF de teste com dígito verificador válido. */
const DO_BOT = {
  nomeInicial: 'Paciente de Teste',
  emailInicial: 'paciente.teste@exemplo.invalid',
  telefoneInicial: '5511987654321',
  cpfInicial: null,
  veioDeParceiro: false,
};
const DA_GREENS = { ...DO_BOT, cpfInicial: '52998224725', veioDeParceiro: true };

const CENARIOS: {
  arquivo: string;
  titulo: string;
  explica: string;
  props: Record<string, unknown>;
  logada?: string;
}[] = [
  {
    arquivo: '1-livre.html',
    titulo: '1 · Nada bateu',
    explica: 'Chegou pelo bot, sem CPF. O "Continuar" confere no servidor e segue.',
    props: { ...DO_BOT, vereditoInicial: 'livre' },
  },
  {
    arquivo: '2-greens-livre.html',
    titulo: '2 · Veio da Greens, nada bateu',
    explica: 'Os quatro dados chegaram do formulário da Greens: a tela confirma em vez de pedir.',
    props: { ...DA_GREENS, vereditoInicial: 'livre' },
  },
  {
    arquivo: '3-cpf-em-outra-conta.html',
    titulo: '3 · CPF na ficha de outra conta → suporte (DO-62)',
    explica:
      'O cadastro para aqui, e a senha não é pedida. A tela não diz que o CPF existe: diz o que fazer, com o protocolo no WhatsApp.',
    props: { ...DA_GREENS, vereditoInicial: 'cpf_em_outra_conta' },
  },
  {
    arquivo: '4-conta-pelo-email.html',
    titulo: '4 · O e-mail já tem conta → login',
    explica: 'Antes aparecia só no fim, depois de preencher tudo. Agora é na etapa 1.',
    props: { ...DA_GREENS, vereditoInicial: 'conta_pelo_email' },
  },
  {
    arquivo: '5-telefone-conhecido.html',
    titulo: '5 · O telefone é de outra conta → o campo trava (DO-68)',
    explica:
      'O aviso aparece na própria caixa do telefone, e o "Continuar" espera outro número. Vindo da Greens, a confirmação abre os campos para a troca.',
    props: { ...DO_BOT, vereditoInicial: 'telefone_conhecido' },
  },
  {
    arquivo: '6-sessao-de-outra-pessoa.html',
    titulo: '6 · Logado em OUTRA conta → "É você?" (DO-60)',
    explica:
      'Abre a etapa 1. "Não sou eu, sair" desloga e continua no formulário; o "Continuar" espera a escolha.',
    props: { ...DO_BOT, vereditoInicial: 'sessao_alheia' },
    logada: 'outra.pessoa@exemplo.invalid',
  },
  {
    arquivo: '7-sessao-propria.html',
    titulo: '7 · Logado na PRÓPRIA conta',
    explica: 'Não cria conta de novo nem pede senha — só conclui o cadastro.',
    props: { ...DO_BOT, vereditoInicial: 'sessao_propria' },
    logada: 'paciente.teste@exemplo.invalid',
  },
];

function pagina(titulo: string, css: string, corpo: string) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Epilogue:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${css}</style>
<style>
  :root{--font-outfit:'Outfit',system-ui,sans-serif;--font-epilogue:'Epilogue',system-ui,sans-serif;--font-jetbrains-mono:'JetBrains Mono',ui-monospace,monospace}
  body{padding:24px 16px}
  .previa-topo{max-width:42rem;margin:0 auto 20px;font-size:14px}
  .previa-topo a{text-decoration:underline}
</style>
</head>
<body class="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">${corpo}</body></html>`;
}

describe('prévia das possibilidades da identidade', () => {
  it('escreve um HTML por cenário, e o índice', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = await import('react');
    const { FormularioDeCadastro } = await import(
      '../../app/(auth)/cadastro/[token]/_components/formulario-de-cadastro'
    );
    const { pendenciasDe } = await import('../../lib/parceiros/documentos');

    const dirCss = join(RAIZ, '.next/static/chunks');
    const css = readdirSync(dirCss)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(dirCss, f), 'utf8'))
      .join('\n');
    if (css.length < 10_000) {
      throw new Error(`CSS do build não encontrado em ${dirCss}. Rode \`pnpm build\` antes.`);
    }

    mkdirSync(SAIDA, { recursive: true });

    for (const c of CENARIOS) {
      sessao.logada = Boolean(c.logada);
      sessao.email = c.logada ?? '';

      const html = renderToStaticMarkup(
        React.createElement(FormularioDeCadastro, {
          token: 'previa',
          protocolo: 'SOL-000099',
          pendencias: pendenciasDe(null),
          recebidos: [],
          urlDeRetorno: null,
          linkDoSuporte: 'https://wa.me/5511932047360',
          jaDeclarouSobreAnvisa: false,
          jaDeclarouSobreReceita: false,
          ...c.props,
        } as never),
      );

      const topo = `<div class="previa-topo"><a href="index.html">← todas as possibilidades</a>
<h1 class="font-display mt-3 text-xl font-semibold">${c.titulo}</h1>
<p class="text-muted-foreground mt-1">${c.explica}</p></div>`;
      writeFileSync(
        join(SAIDA, c.arquivo),
        pagina(c.titulo, css, `${topo}<div class="mx-auto w-full max-w-2xl">${html}</div>`),
        'utf8',
      );
    }

    const lista = CENARIOS.map(
      (c) =>
        `<li class="border-border/60 bg-card rounded-2xl border p-4"><a class="font-display text-base font-semibold underline" href="${c.arquivo}">${c.titulo}</a><p class="text-muted-foreground mt-1 text-sm">${c.explica}</p></li>`,
    ).join('\n');
    writeFileSync(
      join(SAIDA, 'index.html'),
      pagina(
        'Prévia — identidade na etapa 1',
        css,
        `<main class="mx-auto w-full max-w-2xl space-y-4">
<h1 class="font-display text-2xl font-semibold">Identidade na etapa 1 — as possibilidades</h1>
<p class="text-muted-foreground text-sm">ADR-0028 · o formulário REAL, renderizado com o Clerk simulado. Os botões aparecem; o clique não funciona nesta prévia.</p>
<ul class="space-y-3">${lista}</ul></main>`,
      ),
      'utf8',
    );

    console.log('\n>>> ESCRITO EM: ' + SAIDA + '\n');
  });
});
