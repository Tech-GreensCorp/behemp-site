/**
 * O REENVIO DO PARCEIRO NÃO É PORTA FECHADA PARA DADO NOVO.
 *
 * 🔴 ACHADO PELA EQUIPE DA GREENS EM 13/09/2026, e eles mandaram a hipótese pronta depois de
 * medir o próprio banco. Quatro medições deles, todas contra produção:
 *
 *   1. os pedidos TÊM os quatro arquivos (SENT_TO_BEHEMP, `arquivos: 4` cada)
 *   2. todos os MIME viajam — png 45 · jpeg 23 · pdf 9 · webp 1, nenhum acima de 8 MB
 *   3. zero arquivos sem tipo classificado
 *   4. zero documentos recusados do lado deles (`semUrl` vazio)
 *
 * **E o nosso banco tinha 67 itens sem arquivo nenhum.** Tudo elegível lá, nada chegando aqui.
 *
 * ## A causa, que é nossa
 *
 * O `eventoId` é o `medicationRequest.id`, **estável entre tentativas** — decisão dos dois
 * lados, e foi ela que em 11/09 impediu o "Tentar de novo" do paciente de duplicar cadastros
 * aqui. Mas ela faz **todo** reenvio cair no caminho `porEvento`, e o `reemitir` só trocava
 * token, prazo e status.
 *
 * ⚠️ O manifesto congelava na PRIMEIRA versão para sempre. E a primeira é de antes de 10/09
 * 19:54, quando a Greens ainda mandava só os nomes. Ela passou a mandar `{ tipo, url }` e nós
 * nunca soubemos — por semanas, com os arquivos do outro lado o tempo todo.
 *
 * 🔴 **A solução NÃO é tornar o `eventoId` variável** — a própria Greens descartou, e com razão:
 * trocaria este defeito por cadastro duplicado, com gateway e desconto errados lá (ADR-0016
 * deles). A idempotência fica: mesma solicitação, mesmo protocolo. O que muda é que ela deixa
 * de descartar o que chegou junto.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const FONTE = readFileSync(join(RAIZ, 'lib/parceiros/handoff.ts'), 'utf8');
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** O corpo de `reemitir`, que é onde o reenvio é atendido. */
function corpoDoReemitir(): string {
  const i = CODIGO.indexOf('private async reemitir(');
  expect(i, 'não achei o reemitir').toBeGreaterThan(-1);
  return CODIGO.slice(
    i,
    CODIGO.indexOf('\n  }', CODIGO.indexOf('.where(eq(solicitacoesCadastro.id, id))', i)),
  );
}

describe('o reenvio do parceiro não é porta fechada', () => {
  it('⚠️ VACUIDADE: o caminho por evento ainda existe e ainda reemite', () => {
    // Se ele sumir, a idempotência some junto — e aí é outro problema, maior.
    expect(CODIGO).toMatch(/if \(porEvento\)/);
    expect(CODIGO).toMatch(/this\.reemitir\(/);
  });

  it('🔴 o reenvio RECEBE o corpo novo — antes só trocava o token', () => {
    /**
     * A assinatura antiga era `(id, protocolo, reenvio)`. Sem o corpo, não havia o que
     * atualizar nem como decidir: o dado novo era descartado antes de ser olhado.
     */
    /**
     * ⚠️ DEFEITO MEU, achado pela sabotagem: fatiar 400 caracteres depois de `if (porEvento)` e
     * procurar `entrada` alcançava o CAMINHO 2, que usa `entrada` legitimamente em toda linha.
     * O guarda passava com a correção desfeita. **Menção não é uso** — e é a classe que mais me
     * pegou nesta sessão.
     *
     * O que se mede agora é a CHAMADA: ela tem de levar um quarto argumento com o corpo novo.
     */
    const i = CODIGO.indexOf('this.reemitir(porEvento.id');
    expect(i, 'o caminho por evento não chama mais o reemitir').toBeGreaterThan(-1);
    const chamada = CODIGO.slice(i, CODIGO.indexOf(');', i) + 2);

    expect(chamada, 'o reenvio voltou a ser chamado sem o corpo que chegou').toMatch(/entrada/);
    expect(chamada, 'o reenvio não informa se já temos arquivo').toMatch(/jaTemArquivo/);
  });

  it('🔴 e o manifesto é ATUALIZADO quando o reenvio traz arquivo', () => {
    expect(corpoDoReemitir(), 'o reemitir não toca no manifesto — o dado novo se perde').toMatch(
      /documentosDoParceiro:/,
    );
  });

  it('🔴 mas NUNCA sobrescreve arquivo com ausência de arquivo', () => {
    /**
     * A regra decidida com a Greens: atualizar quando o corpo trouxer arquivo, não mexer quando
     * não trouxer. Sem esta condição, um reenvio pobre — o parceiro chama de novo sem anexar —
     * apagaria os arquivos que já baixamos e re-hospedamos. Seria trocar um defeito por um pior,
     * porque a URL original já teria expirado e não haveria como recuperar.
     */
    /**
     * ⚠️ SEGUNDO DEFEITO MEU NO MESMO GUARDA. A versão anterior procurava `trazArquivo` e
     * `jaTemArquivo` em qualquer lugar do corpo — e as duas continuavam lá (uma na declaração,
     * outra no parâmetro) mesmo com a condição removida do `set`.
     *
     * O que decide é a EXPRESSÃO que grava o manifesto: ela tem de depender das duas.
     */
    const corpo = corpoDoReemitir();
    const i = corpo.indexOf('documentosDoParceiro:');
    expect(i, 'o manifesto não é gravado').toBeGreaterThan(-1);

    // A condição do spread vem ANTES do campo — é o `...(cond ? { campo } : {})`.
    const condicao = corpo.slice(corpo.lastIndexOf('...(', i), i);
    expect(condicao, 'o manifesto é sobrescrito sem checar se o reenvio traz arquivo').toMatch(
      /trazArquivo/,
    );
    expect(condicao, 'não há guarda contra reenvio pobre apagar arquivo existente').toMatch(
      /jaTemArquivo/,
    );
  });

  it('🔴 o eventoId CONTINUA estável — a correção não pode virar cadastro duplicado', () => {
    /**
     * ⚠️ O jeito errado de consertar isto seria tornar o `eventoId` variável, para o reenvio
     * criar solicitação nova. A Greens descartou antes de propor, e está certa: duplicaria
     * cadastro lá, com gateway e desconto errados — o risco da ADR-0016 deles.
     *
     * Este caso existe para que ninguém "resolva" por esse caminho depois.
     */
    const i = CODIGO.indexOf('eq(solicitacoesCadastro.eventoDoParceiro');
    expect(i, 'a busca por evento sumiu — a idempotência foi embora').toBeGreaterThan(-1);
    expect(CODIGO.slice(i, i + 120), 'o evento deixou de vir da entrada').toMatch(
      /entrada\.eventoId/,
    );
  });

  it('⚠️ e os dados do paciente também são atualizados — mesma razão do caminho 2', () => {
    /**
     * O parceiro pode ter corrigido um nome ou um CPF entre uma tentativa e outra. O caminho 2
     * (reaproveitamento por contato) já atualizava; este ignorava. **Dois caminhos para o mesmo
     * fim com regras diferentes é como a divergência nasce** — e nasceu.
     */
    const corpo = corpoDoReemitir();
    expect(corpo, 'o reenvio ignora correção de nome').toMatch(/nomeCompleto/);
    expect(corpo, 'o reenvio ignora correção de CPF').toMatch(/cpf/);
  });
});
