/**
 * O ANEXO DA TRIAGEM SAI SÓ SOB DEMANDA — e só com auditoria gravada.
 *
 * 🔴 O DEFEITO, medido em 30/10/2026. O formulário público grava o relatório médico em base64
 * dentro de `triagens.dados` (até 10 MB por arquivo), e `listarTriagens` fazia `.select()` de
 * tudo. Cada abertura de `/admin/triagens` — e de `/admin`, que chama a mesma action — mandava os
 * laudos de TODAS as triagens ao navegador, sem auditoria, e a busca ainda fazia
 * `JSON.stringify` desse base64 a cada tecla. A tela "às vezes demorava muito".
 *
 * O que este guarda impede de voltar:
 *   - a listagem trazer o anexo (`.select()` vazio, ou `dados` inteiro);
 *   - a listagem e a rota discordarem sobre "há anexo" (botão para o que a rota recusa);
 *   - a rota entregar sem auditoria gravada, entregar arquivo vazio/corrompido como 200,
 *     devolver o tipo gravado pelo formulário público (XSS) ou montar `filename*` inválido;
 *   - a tela voltar a ler o base64 do `dados`, ou revogar a URL do blob no mesmo tick do clique.
 *
 * As regras puras são EXECUTADAS; o resto lê o código, fatiado por função.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  CAMPO_DO_ARQUIVO,
  MIME_DO_RELATORIO_PERMITIDOS,
  PADRAO_SQL_DO_ANEXO,
  codificarNomeRfc5987,
  decodificarConteudo,
  lerDataUrl,
  tipoDaEntrega,
} from '@/lib/triagens/anexo-do-relatorio';

const RAIZ = join(__dirname, '..', '..');
const ler = (caminho: string) => readFileSync(join(RAIZ, caminho), 'utf8');

/** Tira comentário de bloco (não-ganancioso) e de linha inteira — prosa não conta como código. */
function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** O corpo de uma função exportada: do `export async function nome(` até o próximo `export`. */
function corpoDe(fonte: string, nome: string): string {
  const inicio = fonte.indexOf(`export async function ${nome}(`);
  if (inicio < 0) return '';
  const fim = fonte.indexOf('\nexport ', inicio + 1);
  return fonte.slice(inicio, fim < 0 ? undefined : fim);
}

const ACTION = semComentarios(ler('app/(public)/_actions/triagem.ts'));
const ROTA = semComentarios(ler('app/api/triagens/[id]/relatorio/route.ts'));
const TELA = semComentarios(ler('app/(admin)/admin/triagens/page.tsx'));
const LISTAGEM = corpoDe(ACTION, 'listarTriagens');

describe('a listagem não traz o anexo', () => {
  it('a função existe e foi fatiada (vacuidade)', () => {
    expect(LISTAGEM.length).toBeGreaterThan(300);
    expect(LISTAGEM).toContain('.from(triagens)');
  });

  it('não usa `.select()` vazio — que traz `dados` inteiro, com o base64', () => {
    expect(LISTAGEM).not.toMatch(/\.select\(\s*\)/);
  });

  it('tira o campo do anexo de `dados` na própria query', () => {
    expect(LISTAGEM).toMatch(/\$\{triagens\.dados\}\s*-\s*\$\{CAMPO_DO_ARQUIVO\}/);
  });

  it('`temRelatorio` usa o mesmo padrão que a rota aceita, e não `length()`', () => {
    expect(LISTAGEM).toMatch(/temRelatorio:[^\n]*PADRAO_SQL_DO_ANEXO/);
    expect(LISTAGEM).not.toMatch(/temRelatorio:[^\n]*length\(/);
  });

  it('a lista de tipos permitidos não é redeclarada na action (fonte única)', () => {
    expect(ACTION).not.toContain("'application/pdf'");
    expect(ACTION).toContain('MIME_DO_RELATORIO_PERMITIDOS');
  });
});

describe('a rota entrega só com auditoria gravada', () => {
  const posicao = (trecho: string | RegExp) =>
    typeof trecho === 'string' ? ROTA.indexOf(trecho) : (ROTA.match(trecho)?.index ?? -1);

  const decodifica = posicao('decodificarConteudo(');
  const audita = posicao(/db\.insert\(logsAuditoria\)/);
  const entrega = posicao('new NextResponse(');

  it('as três peças existem (vacuidade)', () => {
    expect(decodifica).toBeGreaterThan(-1);
    expect(audita).toBeGreaterThan(-1);
    expect(entrega).toBeGreaterThan(-1);
  });

  it('não usa `registrarAuditoria` — o helper engole a falha e o arquivo sairia sem registro', () => {
    expect(ROTA).not.toContain('registrarAuditoria(');
  });

  it('valida o arquivo ANTES de auditar, e audita ANTES de entregar', () => {
    expect(decodifica).toBeLessThan(audita);
    expect(audita).toBeLessThan(entrega);
  });

  it('a auditoria está dentro do `try` que responde 500 — falhar impede a entrega', () => {
    const abre = ROTA.lastIndexOf('try {', audita);
    const fecha = ROTA.indexOf('} catch', audita);
    expect(abre).toBeGreaterThan(-1);
    expect(fecha).toBeGreaterThan(entrega);
  });

  it('o `content-type` passa por `tipoDaEntrega`, nunca vem cru do banco', () => {
    expect(ROTA).toMatch(/'content-type':\s*tipoDaEntrega\(/);
  });

  it('o `filename*` usa a codificação RFC 5987, não `encodeURIComponent` puro', () => {
    expect(ROTA).toMatch(/filename\*=UTF-8''\$\{codificarNomeRfc5987\(/);
    expect(ROTA).not.toContain('encodeURIComponent(');
  });
});

describe('a tela não lê o base64 e não perde o download', () => {
  it('não indexa `dados` pelo campo do anexo', () => {
    expect(TELA).not.toMatch(/\[\s*['"]relatorio_medico_arquivo['"]\s*\]/);
    expect(TELA).toContain('temRelatorio');
  });

  it('baixa pela rota autenticada', () => {
    expect(TELA).toMatch(/\/api\/triagens\/\$\{encodeURIComponent\(triagem\.id\)\}\/relatorio/);
  });

  it('o botão do relatório trava enquanto baixa', () => {
    expect(TELA).toMatch(/disabled=\{baixandoRelatorio\}/);
  });

  it('toda revogação de URL de blob é adiada (vacuidade: existe ao menos uma)', () => {
    const revogacoes = TELA.match(/[^\n]*URL\.revokeObjectURL\([^\n]*/g) ?? [];
    expect(revogacoes.length).toBeGreaterThan(0);
    for (const linha of revogacoes) expect(linha).toMatch(/setTimeout\(/);
  });
});

describe('as regras puras do anexo', () => {
  it('lê data URL e recusa o que não é', () => {
    expect(lerDataUrl('data:application/pdf;base64,JVBERi0x')).toEqual({
      mimeType: 'application/pdf',
      conteudo: 'JVBERi0x',
    });
    expect(lerDataUrl('data:;base64,JVBERi0x')).toEqual({ mimeType: '', conteudo: 'JVBERi0x' });
    expect(lerDataUrl('https://exemplo.com/laudo.pdf')).toBeNull();
    expect(lerDataUrl('data:text/plain,ola')).toBeNull();
    expect(lerDataUrl('')).toBeNull();
  });

  it('decodifica base64 válido, com ou sem quebra de linha', () => {
    expect(decodificarConteudo('JVBERi0x')?.toString('latin1')).toBe('%PDF-1');
    expect(decodificarConteudo('JVBE\nRi0x')?.toString('latin1')).toBe('%PDF-1');
    expect(decodificarConteudo('JVBERg==')?.toString('latin1')).toBe('%PDF');
  });

  it.each([
    ['vazio', ''],
    ['só padding', '===='],
    ['tamanho que não é múltiplo de 4', 'JVBERi0'],
    ['caractere fora do alfabeto', 'JVB$Ri0x'],
    ['padding no meio', 'JV==Ri0x'],
  ])('recusa base64 %s (Buffer.from devolveria lixo com 200)', (_, conteudo) => {
    expect(decodificarConteudo(conteudo)).toBeNull();
  });

  it('entrega como o tipo gravado só o que está na lista', () => {
    for (const tipo of MIME_DO_RELATORIO_PERMITIDOS) expect(tipoDaEntrega(tipo)).toBe(tipo);
    expect(MIME_DO_RELATORIO_PERMITIDOS.size).toBeGreaterThan(0);
  });

  it.each(['text/html', 'image/svg+xml', 'application/javascript', '', 'TEXT/HTML'])(
    'tipo fora da lista (%s) vira application/octet-stream',
    (tipo) => {
      expect(tipoDaEntrega(tipo)).toBe('application/octet-stream');
    },
  );

  it.each(["laudo D'Avila (1)*.pdf", 'relatório médico.pdf', 'exame!.png'])(
    '`filename*` de %s só tem attr-char e %%XX, e volta igual',
    (nome) => {
      const codificado = codificarNomeRfc5987(nome);
      expect(codificado).toMatch(/^[A-Za-z0-9!#$&+\-.^_`|~%]*$/);
      expect(codificado).not.toMatch(/['()*]/);
      expect(decodeURIComponent(codificado)).toBe(nome);
    },
  );

  it('o padrão da listagem (SQL LIKE) e o leitor da rota concordam', () => {
    // LIKE → regex: `%` é qualquer sequência (inclusive vazia e com quebra de linha), `_` é um caractere.
    const comoRegex = new RegExp(
      `^${PADRAO_SQL_DO_ANEXO.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '[\\s\\S]*')
        .replace(/_/g, '[\\s\\S]')}$`,
    );
    const amostras = [
      'data:application/pdf;base64,JVBERi0x',
      'data:;base64,JVBERi0x',
      'data:a,b;base64,JVBERi0x',
      'data:x;base64,',
      'data:text/plain,ola',
      'DATA:application/pdf;base64,JVBERi0x',
      'https://exemplo.com/laudo.pdf',
      '{"arquivo":"x"}',
      '',
    ];
    for (const valor of amostras) {
      expect([valor, comoRegex.test(valor)]).toEqual([valor, lerDataUrl(valor) !== null]);
    }
  });

  it('o campo é o que o formulário grava', () => {
    expect(CAMPO_DO_ARQUIVO).toBe('relatorio_medico_arquivo');
    expect(ler('components/shared/triagem-form.tsx')).toContain(`['${CAMPO_DO_ARQUIVO}']`);
  });
});
