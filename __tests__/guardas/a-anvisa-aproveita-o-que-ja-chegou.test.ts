/**
 * A TELA DA ANVISA APROVEITA O QUE JÁ CHEGOU — e fala o vocabulário da coluna.
 *
 * 🔴 O DEFEITO, medido em 12/09/2026. O checklist da autorização nascia assim:
 *
 *     { tipo: 'receita_medica',         enviado: false, … }
 *     { tipo: 'rg_paciente',            enviado: false, … }
 *     { tipo: 'comprovante_residencia', enviado: false, … }
 *
 * `enviado: false` fixo, e nenhuma consulta à tabela `documentos`. O paciente do fluxo 1 da
 * Greens chega aqui com RG, comprovante e receita **já materializados**
 * (`lib/parceiros/materializar-documentos.ts:116`) — e a tela pedia os três de novo.
 *
 * ⚠️ E A TELA ANTERIOR TINHA PROMETIDO O CONTRÁRIO. O texto do destino da ANVISA diz _"Os
 * documentos que você já enviou vêm junto"_, e o `AvisoDaProcuracao` repete. Prometer e não
 * cumprir na tela seguinte é pior que não prometer: o paciente conclui que os documentos se
 * perderam, e é o tipo de dúvida que faz ele parar e ligar.
 *
 * 🔴 A CAUSA DE FUNDO SÃO TRÊS VOCABULÁRIOS PARA O MESMO DOCUMENTO:
 *
 *     documento_identidade   ← o que o fluxo da Greens manda
 *     rg                     ← o que a coluna `documentos.tipo` aceita (enum)
 *     rg_paciente            ← o que este checklist inventava, e que NÃO existe no enum
 *
 * Três nomes, nenhum lugar onde se encontrassem, e nenhum erro em runtime — o JSON aceita
 * qualquer string. É a mesma família do defeito que `o-painel-diz-o-que-falta` fecha, e por
 * isso os dois guardas exigem a mesma coisa: **todo tipo citado existe no enum**.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ACTION = semComentarios(ler('app/(paciente)/_actions/anvisa.ts'));
const TELA = semComentarios(ler('app/(paciente)/paciente/anvisa/page.tsx'));

/** Os valores que a coluna `documentos.tipo` aceita — lidos do enum, nunca listados. */
function tiposDoEnum(): Set<string> {
  const fonte = ler('db/schema/enums.ts');
  const i = fonte.indexOf('documentoTipoEnum');
  const bloco = fonte.slice(i, fonte.indexOf(']', i));
  return new Set([...bloco.matchAll(/'([^']+)'/g)].map((m) => m[1]).slice(1));
}

/** Os tipos que o checklist inicial declara. */
function tiposDoChecklist(): string[] {
  const i = ACTION.indexOf('const EXIGIDOS');
  expect(i, 'não achei EXIGIDOS no checklist inicial').toBeGreaterThan(-1);
  const trecho = ACTION.slice(i, ACTION.indexOf(']', i));
  return [...trecho.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('a ANVISA aproveita o que já chegou', () => {
  it('⚠️ VACUIDADE: o enum tem tipos e o checklist declara tipos', () => {
    expect(tiposDoEnum().size).toBeGreaterThan(3);
    expect(tiposDoChecklist().length).toBe(3);
  });

  it('🔴 o checklist CONSULTA a tabela `documentos` — não nasce zerado', () => {
    // Sem esta consulta, `enviado` seria sempre false e a promessa da tela anterior mentiria.
    expect(ACTION).toMatch(/\.from\(documentos\)/);
    expect(ACTION).toMatch(/eq\(documentos\.pacienteId/);
  });

  it('🔴 e `enviado` deriva do que foi achado, nunca de um literal `false`', () => {
    const i = ACTION.indexOf('const checklistInicial');
    const bloco = ACTION.slice(i, ACTION.indexOf('});', i));
    expect(bloco).toMatch(/enviado:\s*doc\s*!==\s*undefined/);
    expect(bloco).not.toMatch(/enviado:\s*false/);
  });

  it('⚠️ a consulta ignora documento apagado — soft delete é regra do domínio', () => {
    expect(ACTION).toMatch(/isNull\(documentos\.deletedAt\)/);
  });

  it('🔴 TODO tipo do checklist existe no enum `documento_tipo`', () => {
    // `rg_paciente` não existia, e por isso a busca nunca casava — em silêncio, porque a
    // coluna `documentos` é JSON e aceita qualquer string.
    const aceitos = tiposDoEnum();
    for (const tipo of tiposDoChecklist()) {
      expect(aceitos.has(tipo), `'${tipo}' não existe no enum documento_tipo`).toBe(true);
    }
  });

  it('🔴 a TELA sabe rotular todo tipo que o checklist produz', () => {
    // Tipo sem rótulo aparece como chave crua para o paciente — ou não aparece.
    const i = TELA.indexOf('const DOC_LABELS');
    const bloco = TELA.slice(i, TELA.indexOf('\n};', i));
    for (const tipo of tiposDoChecklist()) {
      expect(bloco).toMatch(new RegExp(`\\b${tipo}\\s*:`));
    }
  });

  it('⚠️ e continua rotulando `rg_paciente` — as autorizações já gravadas usam esse nome', () => {
    // Tirar o nome antigo faria o rótulo sumir para quem tem autorização em andamento.
    expect(TELA).toMatch(/\brg_paciente\s*:/);
  });

  it('🔴 validado NÃO vem do banco — quem valida é gente', () => {
    // Achar o arquivo prova que ele chegou, não que está correto. Marcar validado aqui
    // pularia o ato humano, que é o que sustenta o processo (DO-29, DO-33).
    const i = ACTION.indexOf('const checklistInicial');
    const bloco = ACTION.slice(i, ACTION.indexOf('});', i));
    expect(bloco).toMatch(/validado:\s*false/);
  });
});
