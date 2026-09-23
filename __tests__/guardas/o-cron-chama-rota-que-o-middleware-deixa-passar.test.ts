/**
 * GUARDA — toda rota que o `filas.yml` chama é pública NO MIDDLEWARE.
 *
 * ## A CLASSE DE ERRO, e esta é a segunda vez
 *
 *   · 09/09/2026 — as rotas do ChatPro (Item 21): o servidor deles recebia redirect para o
 *     login, e o log da aplicação não mostrava nada, porque a requisição nunca chegava à rota.
 *   · 23/09/2026 — `GET /api/mercadopago/processar` (Fase 3 do Mercado Pago, PR #122). Medido
 *     em produção logo depois do deploy: `307 → /entrar`. O cron do `filas.yml` exige 200, e
 *     a conciliação dos pagamentos nunca rodaria. Os testes de integração estavam verdes
 *     porque chamam o handler DIRETO — o middleware fica de fora.
 *
 * Quem chama estas rotas é uma máquina, sem sessão. A autenticação delas é própria
 * (`CRON_SECRET`, segredo de cabeçalho). Sem a linha no `isPublicRoute`, o Clerk responde
 * 307 antes de a rota existir — e o 401 que diria "segredo errado" nunca aparece.
 *
 * 🔴 DERIVA DOS DOIS LADOS: as URLs saem do `filas.yml`, os padrões saem do `middleware.ts`,
 * e o casamento é feito pelo `createRouteMatcher` DO CLERK — a mesma função que decide em
 * produção. Reescrever a semântica de `(.*)` aqui seria uma segunda implementação, e é a
 * segunda que desatualiza.
 *
 * ⚠️ E O CONTRÁRIO TAMBÉM É REGRA: abrir o prefixo `/api/mercadopago(.*)` "resolveria" este
 * guarda e tiraria o login de toda rota futura com esse prefixo. A autorização do dono em
 * 23/09/2026 é para o caminho EXATO — o controle abaixo fica vermelho com o prefixo.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { createRouteMatcher } from '@clerk/nextjs/server';
import { describe, expect, it } from 'vitest';

const ler = (p: string) => readFileSync(path.join(process.cwd(), p), 'utf8');

/** Sem comentários: o middleware EXPLICA rotas em comentário, e menção não é padrão. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** Os padrões do `createRouteMatcher([...])` que define `isPublicRoute`. */
function padroesPublicos(): string[] {
  const codigo = semComentarios(ler('middleware.ts'));
  const bloco = codigo.match(/const isPublicRoute = createRouteMatcher\(\[([\s\S]*?)\]\);/);
  if (!bloco) return [];
  return [...bloco[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Os caminhos que o `filas.yml` chama — de toda URL do site, em qualquer passo. */
function caminhosDoCron(): string[] {
  const yml = ler('.github/workflows/filas.yml')
    .split('\n')
    .filter((l) => !/^\s*#/.test(l))
    .join('\n');
  return [...yml.matchAll(/https:\/\/be4hope\.org(\/[^"'\s]*)/g)].map((m) => m[1].split('?')[0]);
}

const padroes = padroesPublicos();
const ehPublica = createRouteMatcher(padroes);
const publica = (pathname: string) =>
  ehPublica({ nextUrl: { pathname } } as unknown as Parameters<typeof ehPublica>[0]);
const caminhos = caminhosDoCron();

// ─────────────────────────────────────────────────────────────────────────────
describe('o guarda tem o que medir (vacuidade)', () => {
  it('extrai os padrões públicos do middleware', () => {
    expect(padroes.length).toBeGreaterThan(10);
    expect(padroes).toContain('/');
  });

  it('extrai as URLs do filas.yml — as três filas', () => {
    expect(caminhos).toEqual(
      expect.arrayContaining(['/api/chatpro/processar', '/api/parceiros/enviar']),
    );
    expect(caminhos.length).toBeGreaterThanOrEqual(3);
  });

  it('o matcher do Clerk recusa rota protegida — sem isto, "tudo público" passaria', () => {
    expect(publica('/medico/agenda')).toBe(false);
    expect(publica('/api/medico/mercadopago/conectar')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('toda rota chamada pelo cron passa pelo middleware sem sessão', () => {
  it.each(caminhos.map((c) => [c] as const))('%s é pública no middleware', (caminho) => {
    expect(
      publica(caminho),
      `${caminho} é chamada pelo filas.yml e NÃO é pública no middleware.ts — o cron ` +
        `receberia 307 para /entrar antes de a rota rodar. Acrescente o caminho EXATO ao ` +
        `isPublicRoute (nunca o prefixo), com a autenticação própria da rota explicada.`,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('🔴 o processador do Mercado Pago é público pelo caminho EXATO, não pelo prefixo', () => {
  it('o processador passa', () => {
    expect(publica('/api/mercadopago/processar')).toBe(true);
  });

  it.each([
    '/api/mercadopago/outra-rota',
    '/api/mercadopago/processar-tudo',
    '/api/mercadopago/processar/extra',
    '/api/mercadopago',
  ])('%s continua exigindo sessão', (caminho) => {
    expect(publica(caminho)).toBe(false);
  });
});
