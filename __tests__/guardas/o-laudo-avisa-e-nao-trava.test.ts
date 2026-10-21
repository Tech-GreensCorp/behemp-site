/**
 * O LAUDO MÉDICO AVISA, NÃO TRAVA.
 *
 * 🔴 Decisão do dono em 23/09/2026, olhando a tela: _"o laudo médico não é obrigatório"_.
 *
 * A tela da ANVISA fazia duas coisas erradas com ele:
 *
 *   1. mostrava o item **sem marcação**, idêntico aos obrigatórios;
 *   2. 🔴 **travava o envio**: `todosEnviados` era `documentos.every((d) => d.enviado)`, e esse
 *      valor alimenta `disabled=` do botão que envia a documentação. Sem o laudo, o paciente
 *      não conseguia avançar — esperando um papel que ninguém vai cobrar dele.
 *
 * O vocabulário do parceiro já dizia o contrário desde antes: `lib/parceiros/documentos.ts:26`
 * — _"laudo_medico — opcional de verdade: pode nunca existir, e ninguém vai cobrar"_. A tela
 * é que não sabia.
 *
 * ⚠️ Este guarda é ESTRUTURAL: ele lê o arquivo. Ele prova que a regra está escrita, não que a
 * tela roda — mas o que precisa não voltar aqui é uma condição, e condição se lê.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const TELA = join(RAIZ, 'app/(paciente)/paciente/anvisa/page.tsx');
const VOCABULARIO = join(RAIZ, 'lib/parceiros/documentos.ts');

const tela = readFileSync(TELA, 'utf8');

/**
 * 🔴 O CÓDIGO SEM OS COMENTÁRIOS — e isto não é detalhe.
 *
 * Uma checagem de AUSÊNCIA que lê o arquivo inteiro confunde **menção** com **uso**: o
 * comentário que explica _por que_ a frase antiga saiu contém a frase antiga, e o guarda
 * acusaria a própria correção. Aconteceu na primeira rodada deste arquivo.
 *
 * ⚠️ Remove só LINHAS que são comentário — `//` no começo, ou ` * ` de bloco. Não tenta
 * parsear strings nem `/* *​/` no meio de uma linha de código: um limpador ganancioso já
 * comeu metade de um arquivo neste repositório, e um guarda que apaga código deixa de
 * proteger o que sobrou.
 */
const telaSemComentarios = tela
  .split('\n')
  .filter((l) => {
    const s = l.trim();
    return !s.startsWith('//') && !s.startsWith('*') && !s.startsWith('/**');
  })
  .join('\n');

/** O bloco de `DOC_LABELS`, de onde a tela tira rótulo e opcionalidade. */
function blocoDeRotulos(): string {
  const i = tela.indexOf('const DOC_LABELS');
  expect(i).toBeGreaterThan(-1);
  const fim = tela.indexOf('\n};', i);
  expect(fim).toBeGreaterThan(i);
  return tela.slice(i, fim);
}

describe('o laudo médico avisa, e não trava', () => {
  it('o laudo é declarado opcional na tela', () => {
    const bloco = blocoDeRotulos();
    const laudo = bloco.slice(bloco.indexOf('laudo_medico:'));
    expect(laudo).toMatch(/opcional:\s*true/);
  });

  it('🔴 o envio NÃO é travado por documento opcional', () => {
    const i = tela.indexOf('const todosEnviados');
    expect(i).toBeGreaterThan(-1);
    const linha = tela.slice(i, tela.indexOf(';', i));

    // A forma antiga — `every((d) => d.enviado)` sem escape para o opcional — é o defeito.
    expect(linha).toMatch(/opcional/);
    expect(linha).not.toMatch(/every\(\(d\) => d\.enviado\)\s*$/);
  });

  it('o botão de enviar continua ligado a `todosEnviados` — o guarda não vale se ele soltar', () => {
    // Controle contra vacuidade: se alguém trocar a condição do botão, o caso acima passa a
    // proteger uma variável que ninguém lê.
    expect(tela).toMatch(/disabled=\{!todosEnviados/);
  });

  it('a tela CONTINUA mostrando o laudo — opcional não é invisível', () => {
    // Ele é útil quando existe; some-lo tiraria do paciente a chance de mandá-lo.
    expect(blocoDeRotulos()).toContain('laudo_medico:');
  });

  it('a tela concorda com o vocabulário do parceiro sobre o que é opcional', () => {
    // Duas fontes que discordam sobre "é obrigatório?" fazem a tela cobrar o que a regra
    // dispensa — em silêncio, e do lado do paciente.
    const vocabulario = readFileSync(VOCABULARIO, 'utf8');
    const i = vocabulario.indexOf('DOCUMENTOS_OPCIONAIS');
    const declaracao = vocabulario.slice(i, vocabulario.indexOf(';', i));
    expect(declaracao).toContain('laudo_medico');

    const bloco = blocoDeRotulos();
    const laudo = bloco.slice(bloco.indexOf('laudo_medico:'));
    expect(laudo).toMatch(/opcional:\s*true/);
  });

  /**
   * 🔴 QUEM AGE DEPOIS DO ENVIO É A EQUIPE, NÃO A ANVISA — 23/09/2026.
   *
   * `confirmarEnvioAnvisa` põe o status em `documentos_enviados`, e nada é enviado à ANVISA
   * ali: o processo espera um ADMIN conferir e protocolar (`/admin/anvisa`, seletor de status
   * → `em_analise`). A tela dizia _"Iniciando análise ANVISA"_ e _"Pronto para análise"_ —
   * duas afirmações sobre um passo que ainda não aconteceu.
   *
   * ⚠️ O custo não é cosmético: o prazo de 10 dias úteis que a tela mostra é contado **a
   * partir do protocolo**. Dizer que a análise começou faz o paciente cobrar no dia errado.
   */
  it('a tela não afirma que a análise da ANVISA começou sozinha', () => {
    // No CÓDIGO, não no comentário que explica a mudança.
    expect(telaSemComentarios).not.toContain('Iniciando análise ANVISA');
    // Vacuidade: se o filtro comesse o arquivo, esta asserção não provaria nada.
    expect(telaSemComentarios).toContain('toast.success');

    const i = tela.indexOf("key: 'documentos_enviados'");
    expect(i).toBeGreaterThan(-1);
    const etapa = tela.slice(i, tela.indexOf('},', i));
    // `descricao` é o que o paciente lê; o comentário acima dela não entra.
    // A etapa tem de nomear quem age em seguida.
    expect(etapa).toMatch(/Be4Hope|equipe/i);
    expect(etapa).not.toMatch(/Pronto para análise/);
  });

  it('o caminho para o acompanhamento continua existindo', () => {
    // Controle: o paciente sai do checklist e vai acompanhar assim que o status deixa de ser
    // `pendente`. Sem isto ele ficaria na tela de upload sem saber que terminou.
    const i = tela.indexOf('const recarregarAutorizacao');
    expect(i).toBeGreaterThan(-1);
    const corpo = tela.slice(i, i + 900);
    expect(corpo).toMatch(/status !== 'pendente'/);
    expect(corpo).toMatch(/setEtapa\('acompanhamento'\)/);
  });

  it('nenhum documento que a ANVISA exige virou opcional por tabela', () => {
    /**
     * A ponta oposta, e ela importa mais que a primeira: marcar receita, RG ou comprovante
     * como opcional destravaria o envio de um processo que a ANVISA vai recusar — e o
     * paciente só descobre semanas depois.
     */
    const bloco = blocoDeRotulos();
    for (const tipo of ['receita_medica', 'rg', 'rg_paciente', 'comprovante_residencia']) {
      const trecho = bloco.slice(bloco.indexOf(`${tipo}:`));
      const ate = trecho.indexOf('},');
      expect(trecho.slice(0, ate)).not.toMatch(/opcional:\s*true/);
    }
  });
});
