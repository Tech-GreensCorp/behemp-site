/**
 * GUARDA — toda `NEXT_PUBLIC_*` que o código usa existe no build do CI.
 *
 * A CLASSE DE ERRO: `NEXT_PUBLIC_*` é substituída pelo VALOR durante o `next build` e viaja
 * dentro do JavaScript que o navegador baixa. Uma que não existe no momento do build não vira
 * valor — vira acesso a propriedade que, no navegador, é `undefined`.
 *
 * O que isso custou em 10/09/2026: o build em produção tinha sido feito à mão no servidor, onde
 * o `.env` completo existia, e as chaves do Pusher estavam congeladas dentro dele. Quando o
 * deploy passou a entregar o build do CI — que recebia só `NEXT_PUBLIC_APP_URL` — o bundle saiu
 * com `if (!t || !s) throw Error("[Pusher Client] …")` e a teleconsulta morreu em "Erro ao
 * iniciar a sala". Sem erro no servidor: a falha acontece no navegador.
 *
 * ⚠️ Escrever a variável no `.env` do servidor NÃO resolve. O `.env` alimenta o código que roda
 * no servidor; o navegador só recebe o que foi embutido no build.
 *
 * DE DUAS PONTAS: a lista de variáveis sai do PRÓPRIO CÓDIGO, nunca de um rol paralelo — rol
 * paralelo é o que desatualiza e aprova o errado. Variável nova no código, sem entrada no
 * workflow, fica vermelha aqui nomeando qual.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const raiz = process.cwd();
const DEPLOY = '.github/workflows/deploy.yml';

/** Variáveis lidas em runtime pelo SDK a partir do servidor, não congeladas no bundle. */
const LIDAS_EM_RUNTIME = new Set([
  // O ClerkProvider é Server Component: lê a chave no servidor e a entrega ao client por prop.
  // Medido em 10/09/2026 — o servidor standalone acusou "Missing secretKey" ao subir com um
  // `.env` de teste, provando que a leitura é em runtime.
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  // Estas têm `.default()` no `lib/env.ts`: a ausência não quebra, cai no padrão.
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL',
]);

/**
 * Varre os fontes da aplicação em Node puro.
 *
 * ⚠️ Sem depender de `rg`: um guarda que precisa de binário externo falha por motivo que não é
 * o defeito que ele vigia — foi o que aconteceu na primeira versão deste arquivo.
 */
function arquivosDeFonte(dir: string, achados: string[] = []): string[] {
  const IGNORAR = new Set([
    'node_modules',
    '.next',
    '.git',
    '__tests__',
    'scripts',
    'docs',
    '__fixtures__',
  ]);
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome) || nome.startsWith('.')) continue;
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) arquivosDeFonte(caminho, achados);
    else if (/\.tsx?$/.test(nome)) achados.push(caminho);
  }
  return achados;
}

/** As `NEXT_PUBLIC_*` que o código de aplicação de fato lê. Derivado, não listado. */
function usadasNoCodigo(): string[] {
  const nomes = new Set<string>();
  for (const arquivo of arquivosDeFonte(raiz)) {
    const texto = readFileSync(arquivo, 'utf8');
    for (const m of texto.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      nomes.add(m[1]);
    }
  }
  return [...nomes].sort();
}

/**
 * O bloco `env:` do passo de build do workflow, **sem os comentários**.
 *
 * 🔴 O FILTRO NÃO É COSMÉTICO. O comentário desse passo explica o incidente e cita
 * `NEXT_PUBLIC_PUSHER_KEY` no meio do texto. Sem tirar comentário, apagar a declaração real
 * deixava o guarda VERDE — porque a menção bastava para o `toContain`. Foi exatamente o que
 * a sabotagem mostrou, e é a nona vez que esta classe aparece no repositório.
 */
function envDoBuild(): string {
  const yaml = readFileSync(path.join(raiz, DEPLOY), 'utf8');
  const inicio = yaml.indexOf('- name: Build do projeto (Next.js)');
  expect(inicio).toBeGreaterThan(-1);
  const depois = yaml.indexOf('- name:', inicio + 10);
  const passo = yaml.slice(inicio, depois === -1 ? undefined : depois);
  return passo
    .split('\n')
    .filter((linha) => !/^\s*#/.test(linha))
    .join('\n');
}

describe('toda NEXT_PUBLIC_ usada no código chega ao build do CI', () => {
  const usadas = usadasNoCodigo();
  const bloco = envDoBuild();

  it('o guarda enxerga variáveis de verdade (vacuidade — sem isto os casos abaixo são vazios)', () => {
    expect(usadas.length).toBeGreaterThan(2);
    expect(usadas).toContain('NEXT_PUBLIC_APP_URL');
  });

  it('o passo de build tem um bloco `env:` (vacuidade)', () => {
    expect(bloco).toContain('env:');
    expect(bloco).toContain('run: pnpm build');
  });

  it.each(
    usadasNoCodigo()
      .filter((v) => !LIDAS_EM_RUNTIME.has(v))
      .map((v) => [v] as const),
  )('%s está declarada no passo de build', (variavel) => {
    expect(bloco).toContain(variavel);
  });

  /**
   * O Pusher é o caso que quebrou, e o único cuja ausência lança em vez de degradar:
   * `lib/integrations/pusher/client.ts` faz `throw` quando a chave falta. Um `it.each` que
   * um dia deixe de varrer o Pusher passaria despercebido — este caso nomeia.
   */
  it('as chaves do Pusher estão lá — foram as que derrubaram a teleconsulta', () => {
    expect(bloco).toContain('NEXT_PUBLIC_PUSHER_KEY');
    expect(bloco).toContain('NEXT_PUBLIC_PUSHER_CLUSTER');
  });

  it('e o cliente do Pusher continua LANÇANDO quando falta — falha silenciosa seria pior', () => {
    const cliente = readFileSync(path.join(raiz, 'lib/integrations/pusher/client.ts'), 'utf8');
    expect(cliente).toMatch(/throw new Error|throw Error/);
    expect(cliente).toContain('NEXT_PUBLIC_PUSHER_KEY');
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('não exige no build as que o servidor entrega em runtime', () => {
    // O ClerkProvider passa a publishable key do servidor para o client. Exigi-la no build
    // seria acusar quem está certo.
    expect(LIDAS_EM_RUNTIME.has('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY')).toBe(true);
  });

  it('o filtro de comentários funciona — sem ele, a MENÇÃO no comentário aprovaria o ausente', () => {
    const cru = readFileSync(path.join(raiz, DEPLOY), 'utf8');
    const inicio = cru.indexOf('- name: Build do projeto (Next.js)');
    const passoCru = cru.slice(inicio, cru.indexOf('- name:', inicio + 10));
    // o comentário do passo cita a variável de propósito, ao explicar o incidente
    expect(passoCru).toMatch(/#[^\n]*NEXT_PUBLIC_PUSHER_KEY/);
    // e o bloco filtrado não pode mais conter essa linha de comentário
    expect(envDoBuild()).not.toMatch(/#[^\n]*NEXT_PUBLIC_PUSHER_KEY/);
  });

  it('a lista de exceções é pequena e justificada, não um cesto', () => {
    // Se alguém começar a "resolver" falhas acrescentando nomes aqui, este caso fica vermelho.
    expect(LIDAS_EM_RUNTIME.size).toBeLessThanOrEqual(6);
  });
});
