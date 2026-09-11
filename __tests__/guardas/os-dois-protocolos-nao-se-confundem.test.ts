/**
 * GUARDA — o paciente que veio de parceiro vê OS DOIS protocolos, não só o nosso.
 *
 * A CLASSE DE ERRO, medida em 11/09/2026 ao responder uma pergunta da Greens. Eles escreveram:
 *
 *   _"o protocolo da Greens continua aparecendo na primeira tela? … agora ele é o elo entre as
 *   duas telas na cabeça do paciente"_
 *
 * 🔴 E A PREMISSA ESTAVA ERRADA. Eles viram `SOL-000045` na nossa demonstração e concluíram
 * que era o `pedidoDoParceiro`. **Não era.** É o NOSSO protocolo, gerado por
 * `proximoProtocolo()` — e os dois sistemas numeram com o **mesmo formato** `SOL-000000`, em
 * sequências independentes.
 *
 * O paciente vê `SOL-000019` na tela da Greens e `SOL-000045` na nossa. Dois números iguais em
 * forma, diferentes em valor, sem nada dizendo que são sistemas diferentes. Dois desfechos, os
 * dois ruins: ele acha que perdeu o pedido, ou cita o número errado ao atendimento — o que
 * manda a pessoa certa procurar no lugar errado.
 *
 * ⚠️ REJEITADO: mudar o nosso prefixo para `BEH-`. Resolveria a confusão para quem vier
 * depois, e quebraria a referência de **todos os protocolos já emitidos** — inclusive os que
 * pacientes anotaram. A correção que não descarta o passado é mostrar os dois.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

function ler(c: string): string {
  return readFileSync(path.join(process.cwd(), c), 'utf8');
}
function semComentarios(f: string): string {
  return f
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(l))
    .join('\n');
}

const token = semComentarios(ler('lib/chatpro/token-de-cadastro.ts'));
const pagina = semComentarios(ler('app/(auth)/cadastro/[token]/page.tsx'));
const form = semComentarios(
  ler('app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx'),
);

// ─────────────────────────────────────────────────────────────────────────────
describe('o número do parceiro chega até a tela', () => {
  it('a validação do token o devolve', () => {
    expect(token).toMatch(/pedidoDoParceiro: string \| null/);
    expect(token).toContain('pedidoDoParceiro: linha.pedidoDoParceiro ?? null');
  });

  it('a página o repassa', () => {
    expect(pagina).toContain('pedidoDoParceiro={resultado.pedidoDoParceiro}');
  });

  it('o formulário o aceita', () => {
    expect(form).toMatch(/pedidoDoParceiro\?: string \| null/);
  });

  it('🔴 e o cabeçalho o EXIBE — receber e não mostrar é o mesmo que não receber', () => {
    const cabecalho = form.slice(form.indexOf('Protocolo {protocolo}'));
    expect(cabecalho).toContain('{pedidoDoParceiro ?');
    expect(cabecalho).toMatch(/pedido \{pedidoDoParceiro\}/);
  });

  it('o nosso protocolo continua aparecendo — não é substituição', () => {
    expect(form).toContain('Protocolo {protocolo}');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('quem não veio de parceiro não vê ruído', () => {
  it('🔴 sem pedido do parceiro, nada é renderizado', () => {
    const cabecalho = form.slice(form.indexOf('Protocolo {protocolo}'));
    // Ternário com `null` no else: ausência não vira "pedido undefined" nem separador solto.
    expect(cabecalho).toMatch(/\{pedidoDoParceiro \?[\s\S]{0,240}: null\}/);
  });

  it('o padrão da prop é null, não string vazia', () => {
    expect(form).toMatch(/pedidoDoParceiro = null/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('a causa da confusão continua existindo, e é o motivo deste guarda', () => {
  /**
   * ⚠️ Este caso não protege um comportamento: ele documenta o FATO que torna o resto
   * necessário. Se um dia os prefixos divergirem, ele fica vermelho — e aí a exibição dupla
   * pode ser revista, com esta conversa à mão.
   */
  it('o nosso protocolo usa o prefixo SOL-, igual ao da Greens', () => {
    const servico = semComentarios(ler('lib/chatpro/solicitacao.ts'));
    expect(servico).toMatch(/`SOL-\$\{String\(proximo\)\.padStart\(6, '0'\)\}`/);
  });

  it('e a numeração é NOSSA — não vem do parceiro', () => {
    const servico = semComentarios(ler('lib/chatpro/solicitacao.ts'));
    const fn = servico.slice(
      servico.indexOf('export async function proximoProtocolo'),
      servico.indexOf('export function montarLink'),
    );
    expect(fn).toContain('solicitacoesCadastro.protocolo');
    expect(fn).not.toContain('pedidoDoParceiro');
  });
});
