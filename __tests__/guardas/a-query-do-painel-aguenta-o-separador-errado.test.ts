/**
 * GUARDA — as rotas que o painel do ChatPro chama aguentam `?` usado como separador.
 *
 * A CLASSE DE ERRO, prevista pela Greens e **medida em produção** por mim em 11/09/2026.
 *
 * A URL configurada no painel já leva query (`?tem=receita_medica`). Quando o painel emenda os
 * parâmetros dele, pode usar `?` outra vez:
 *
 *     .../bot-link?tem=receita_medica?sessionId=abc
 *
 * O `URLSearchParams` lê isso como **um** parâmetro — `tem` = `receita_medica?sessionId=abc`.
 * O manifesto morre, e o `sessionId` junto.
 *
 * 🔴 E FALHA DO PIOR JEITO: em silêncio. Medi os dois contra produção, mesmo segredo,
 * telefones diferentes:
 *
 *     ?tem=receita_medica?sessionId=…  →  HTTP 200 · link válido · "já recebemos": 0 seções
 *     ?tem=receita_medica&sessionId=…  →  HTTP 200 · link válido · "já recebemos": 1 seção
 *
 * Ninguém vê erro. O paciente abre o link e a tela pede documento que ele já mandou — e o
 * atendimento vai procurar defeito no upload.
 *
 * ⚠️ REJEITADA a saída de criar **uma rota por fluxo** para nenhuma URL precisar de query.
 * Multiplicar endpoints por limitação de UI de terceiro é pagar para sempre por um problema de
 * uma tela. Uma query válida **nunca** tem `?` depois do primeiro: tratá-lo como separador não
 * é adivinhação, é a única leitura possível.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { parametrosDoPainel, separadorFoiCorrigido } from '@/lib/chatpro/query-do-painel';
import { lerManifestoDaUrl } from '@/lib/chatpro/manifesto-da-url';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
    .join('\n');
}

const BASE = 'https://be4hope.org/api/chatpro/bot-link';

// ─────────────────────────────────────────────────────────────────────────────
describe('a leitura tolera o separador errado', () => {
  it('🔴 com `?` no lugar de `&`, TODOS os parâmetros sobrevivem', () => {
    const p = parametrosDoPainel(new URL(`${BASE}?tem=receita_medica?sessionId=abc?name=Ana`));
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('sessionId')).toBe('abc');
    expect(p.get('name')).toBe('Ana');
  });

  it('e com `&` correto continua idêntico — a correção não muda o caminho feliz', () => {
    const p = parametrosDoPainel(new URL(`${BASE}?tem=receita_medica&sessionId=abc&name=Ana`));
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('sessionId')).toBe('abc');
    expect(p.get('name')).toBe('Ana');
  });

  it('mistura de `?` e `&` também', () => {
    const p = parametrosDoPainel(new URL(`${BASE}?tem=receita_medica&name=Ana?sessionId=abc`));
    expect(p.get('tem')).toBe('receita_medica');
    expect(p.get('name')).toBe('Ana');
    expect(p.get('sessionId')).toBe('abc');
  });

  it('sem query nenhuma não estoura', () => {
    expect(parametrosDoPainel(new URL(BASE)).get('tem')).toBeNull();
  });

  it('🔴 e o manifesto volta a ser lido — que é o que se perdia', () => {
    const p = parametrosDoPainel(
      new URL(`${BASE}?tem=receita_medica,documento_identidade?sessionId=abc`),
    );
    const m = lerManifestoDaUrl(p);
    expect(m.documentos).toEqual(['receita_medica', 'documento_identidade']);
    expect(m.declarado).toBe(true);
  });

  it('⚠️ sem a correção, o manifesto morria — a prova de que o caso é real', () => {
    // `searchParams` cru é o comportamento de antes.
    const cru = new URL(`${BASE}?tem=receita_medica?sessionId=abc`).searchParams;
    expect(cru.get('tem')).toBe('receita_medica?sessionId=abc');
    expect(lerManifestoDaUrl(cru).declarado).toBe(false);
  });

  it('a correção é detectável, para o log poder avisar', () => {
    expect(separadorFoiCorrigido(new URL(`${BASE}?a=1?b=2`))).toBe(true);
    expect(separadorFoiCorrigido(new URL(`${BASE}?a=1&b=2`))).toBe(false);
    expect(separadorFoiCorrigido(new URL(BASE))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('as três rotas do painel usam a leitura tolerante', () => {
  const rotas = {
    'bot-link': 'app/api/chatpro/bot-link/route.ts',
    start: 'app/api/chatpro/start/route.ts',
    triagem: 'app/api/chatpro/triagem/route.ts',
  };

  it.each(Object.entries(rotas))('%s lê pelo helper', (_nome, caminho) => {
    const codigo = semComentarios(ler(caminho));
    expect(codigo).toContain('parametrosDoPainel(');
  });

  it.each(Object.entries(rotas))('%s não lê `searchParams` cru', (_nome, caminho) => {
    const codigo = semComentarios(ler(caminho));
    expect(codigo).not.toMatch(/\.searchParams\b/);
  });

  it('o bot-link avisa no log quando corrigiu — senão ninguém descobre o painel errado', () => {
    const codigo = semComentarios(ler(rotas['bot-link']));
    expect(codigo).toContain('separadorFoiCorrigido(');
    expect(codigo).toMatch(/console\.warn\([^)]*`\?` no lugar de `&`/);
  });

  /**
   * ⚠️ FRONTEIRA DE PALAVRA, não substring. A primeira versão acusou o log legítimo:
   * `request.nextUrl.pathname` **contém** `name`. É "menção vs uso" outra vez, agora na forma
   * de substring — e um guarda que acusa inocente é um guarda que alguém desliga.
   */
  it('e esse log não leva dado pessoal', () => {
    const codigo = semComentarios(ler(rotas['bot-link']));
    const logs = codigo.match(/console\.warn\([^;]*\)/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const l of logs) {
      for (const proibido of ['telefone', 'phone', 'email', 'nome', 'name', 'cpf']) {
        expect(l, `${proibido} em: ${l}`).not.toMatch(new RegExp(`\\b${proibido}\\b`, 'i'));
      }
    }
  });
});
