/**
 * 🔴 NÃO É GUARDA, E NÃO RODA NO `pnpm test`.
 *
 * Renderiza a tela do cadastro para um HTML estático — para revisar **desenho e texto** sem
 * servidor, sem banco e sem Clerk. Existe porque o ambiente local não tem chave do Clerk
 * (medido em 13/09 e de novo em 14/09: `Missing publishableKey`, e a `NEXT_PUBLIC_*` é
 * substituída no BUILD, então nem pôr no `.env` resolve sem rebuildar).
 *
 * Mora em `__tests__/integracao/` porque essa pasta está no `exclude` do `vitest.config` —
 * o mesmo mecanismo que o repositório já usa para teste que só roda quando alguém pede.
 * Sem isso, ele escreveria dois arquivos a cada `pnpm test`.
 *
 * COMO RODAR:
 *   npx vitest run --config vitest.integracao.mts __tests__/integracao/previa-da-tela.test.ts
 *   CHROME=$(find ~/.cache/ms-playwright/chromium-1234 -name chrome -type f | head -1)
 *   "$CHROME" --headless --disable-gpu --no-sandbox --hide-scrollbars \
 *     --virtual-time-budget=8000 --window-size=900,2700 \
 *     --screenshot=previa-da-tela.png file://$PWD/previa-da-tela.html
 *
 * ⚠️ O `--virtual-time-budget` não é enfeite: sem ele o screenshot sai no meio das animações
 * de entrada e a tela parece "lavada", com o texto quase invisível.
 *
 * SAÍDA: `previa-da-tela.html` e `previa-da-tela.png` na raiz — os dois no `.gitignore`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, vi } from 'vitest';

// O componente importa a action, que importa `db`. O módulo só precisa CARREGAR.
process.env.DATABASE_URL = 'postgresql://previa:previa@127.0.0.1:5432/previa';

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
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useAuth: () => ({ isLoaded: true, isSignedIn: false, userId: null }),
}));

const RAIZ = join(import.meta.dirname, '..', '..');

describe('prévia', () => {
  it('escreve o HTML', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = await import('react');
    const { FormularioDeCadastro } = await import(
      '../../app/(auth)/cadastro/[token]/_components/formulario-de-cadastro'
    );
    const { pendenciasDe } = await import('../../lib/parceiros/documentos');

    const html = renderToStaticMarkup(
      React.createElement(FormularioDeCadastro, {
        token: 'previa',
        protocolo: 'SOL-000068',
        // Fluxo da teleconsulta: nada recebido, os cinco pendentes.
        pendencias: pendenciasDe(null),
        recebidos: [],
        urlDeRetorno: null,
        nomeInicial: 'Paciente Teste Dois',
        emailInicial: 'teste.fluxo2@behemp.com.br',
        telefoneInicial: '11988887777',
        cpfInicial: null,
        veioDeParceiro: false,
        jaDeclarouSobreAnvisa: false,
        jaDeclarouSobreReceita: false,
      } as never),
    );

    /**
     * 🔴 DESCOBRE OS ARQUIVOS, NÃO OS LISTA. A primeira versão fixava dois nomes — e os
     * nomes do Next são hasheados por CONTEÚDO: o build seguinte mudou os dois, o `catch`
     * devolveu string vazia, e a prévia saiu sem estilo nenhum, sem nada acusar.
     *
     * O `catch` silencioso era o agravante: ele transformou "o arquivo sumiu" em "não tem
     * CSS". Agora a ausência de CSS falha alto.
     */
    const dirCss = join(RAIZ, '.next/static/chunks');
    const css = readdirSync(dirCss)
      .filter((f) => f.endsWith('.css'))
      .map((f) => readFileSync(join(dirCss, f), 'utf8'))
      .join('\n');
    if (css.length < 10_000) {
      throw new Error(
        `CSS do build não encontrado em ${dirCss} (achei ${css.length} bytes). ` +
          'Rode `pnpm build` antes da prévia.',
      );
    }

    const saida = join(RAIZ, 'previa-da-tela.html');
    writeFileSync(
      saida,
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Prévia — fluxo da teleconsulta</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Epilogue:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<title>Prévia</title>
<style>${css}</style>
<style>
  /* As mesmas variáveis de fonte que o layout injeta — sem elas o texto cai no serif. */
  :root{--font-outfit:'Outfit',system-ui,sans-serif;--font-epilogue:'Epilogue',system-ui,sans-serif;--font-jetbrains-mono:'JetBrains Mono',ui-monospace,monospace}
  body{padding:32px 16px}
</style>
</head>
<body class="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
<div class="mx-auto w-full max-w-2xl">${html}</div>
</body></html>`,
      'utf8',
    );
    console.log('\n>>> ESCRITO EM: ' + saida + '\n');
  });
});
