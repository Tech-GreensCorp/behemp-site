/**
 * A REVOGAÇÃO PARA A FILA — e não só o enfileiramento.
 *
 * 🔴 O ACHADO MAIS GRAVE DA INVESTIGAÇÃO DE 12/09/2026, e é de LGPD. ADR-0022 §23, G9, D-14.
 *
 * O consentimento era conferido **uma vez**, quando o evento entrava na fila
 * (`enfileirar-transferencia.ts` → `pode-transferir.ts`). O `enviador` pegava o `payload`
 * gravado e mandava. **Entre os dois momentos o paciente pode revogar — e o dado saía assim
 * mesmo.**
 *
 * ⚠️ E A JANELA NÃO É TEÓRICA. Medido: a fila anda por GitHub Actions a cada 5 minutos, com
 * até 6 tentativas e backoff de até 60 minutos. Um evento pode sair **horas** depois de
 * enfileirado.
 *
 * 🔴 LGPD art. 8º §5º: a revogação é _"a qualquer momento, mediante manifestação expressa, por
 * procedimento gratuito e facilitado"_. Um consentimento que só vale até a fila rodar **não é
 * revogável a qualquer momento** — é revogável até um instante que o paciente não conhece, e
 * sobre o qual não tem controle.
 *
 * ⚠️ NÃO É EXPERIÊNCIA RUIM: é dado de saúde saindo da empresa sem autorização válida. Por
 * isso este item precede todos os outros da Sprint 8, inclusive os que corrigem telas quebradas.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ENVIADOR = semComentarios(ler('lib/parceiros/enviador.ts'));
const MODULO = semComentarios(ler('lib/parceiros/consentimento-ainda-vale.ts'));

/** O corpo de `entregar`, que é onde o POST acontece. */
function corpoDoEntregar(): string {
  const i = ENVIADOR.indexOf('private async entregar(');
  expect(i, 'não achei o entregar').toBeGreaterThan(-1);
  return ENVIADOR.slice(i, i + 3000);
}

describe('a revogação para a fila', () => {
  it('⚠️ VACUIDADE: o enviador ainda faz o POST que precisa ser barrado', () => {
    expect(corpoDoEntregar()).toMatch(/fetch\(/);
  });

  it('🔴 o consentimento é RELIDO antes do POST', () => {
    const corpo = corpoDoEntregar();
    const checagem = corpo.indexOf('consentimentoAindaVale(');
    const envio = corpo.indexOf('fetch(');
    expect(checagem, 'o enviador não relê o consentimento').toBeGreaterThan(-1);
    expect(envio, 'o POST acontece ANTES da checagem').toBeGreaterThan(checagem);
  });

  it('🔴 e a releitura vai ao BANCO — não ao payload congelado', () => {
    /**
     * O `payload` é imutável de propósito: é o que o parceiro recebe, e reescrevê-lo mudaria
     * o que foi autorizado. Por isso a checagem não pode sair dele.
     */
    expect(MODULO).toMatch(/finalidadesVigentes\(/);
    expect(MODULO).toMatch(/from\(solicitacoesCadastro\)/);
    const i = MODULO.indexOf('export async function consentimentoAindaVale');
    expect(MODULO.slice(i), 'a decisão saiu do payload').not.toMatch(/payload/);
  });

  it('🔴 revogado NÃO REAGENDA — revogação não é falha transitória', () => {
    /**
     * Reagendar faria o sistema tentar de novo, e de novo, contra uma decisão do paciente que
     * não vai mudar sozinha. É o tipo de retry que transforma respeito em insistência.
     */
    /**
     * ⚠️ Defeito meu, achado ao rodar: fatiar 700 caracteres a partir da checagem alcançava o
     * `reagendar` do bloco SEGUINTE (o do segredo ausente), e o guarda acusava um inocente.
     * O recorte agora termina onde o `if` termina — a granularidade do defeito, não uma
     * janela arbitrária.
     */
    const corpo = corpoDoEntregar();
    const i = corpo.indexOf('if (evento.solicitacaoId)');
    expect(i, 'não achei o bloco da checagem').toBeGreaterThan(-1);
    // O bloco vai até o `const corpo =`, que é a primeira linha depois dele.
    const bloco = corpo.slice(i, corpo.indexOf('const corpo =', i));

    expect(bloco).toMatch(/marcarFalha/);
    expect(bloco, 'revogação está sendo reagendada').not.toMatch(/this\.reagendar/);
  });

  it('⚠️ e o motivo fica registrado — "falhou" sem motivo não se distingue de rede caída', () => {
    const corpo = corpoDoEntregar();
    const i = corpo.indexOf('consentimentoAindaVale(');
    expect(corpo.slice(i, i + 700)).toMatch(/consentimento: \$\{veredicto\.motivo\}/);
  });

  it('🔴 FALHA FECHADA: tipo de evento sem finalidade declarada não é enviado', () => {
    // Um tipo novo que ninguém mapeou sairia sob uma finalidade que ninguém autorizou.
    expect(MODULO).toMatch(/tipo_desconhecido/);
    const i = MODULO.indexOf('const finalidade = FINALIDADE_POR_TIPO[tipo]');
    expect(MODULO.slice(i, i + 200)).toMatch(/if \(!finalidade\) return \{ pode: false/);
  });

  it('🔴 e ficha apagada também barra — exclusão é revogação por outra porta', () => {
    expect(MODULO).toMatch(/isNull\(pacientes\.deletedAt\)/);
  });

  it('⚠️ o log NÃO carrega paciente nem conteúdo — só o fato e o motivo', () => {
    /**
     * ⚠️ Mesmo defeito do caso acima: 300 caracteres passavam do fecho do `console.warn` e
     * alcançavam `marcarFalha`/`corpo`, onde `solicitacaoId` aparece legitimamente. O recorte
     * agora é o objeto do log, e só ele.
     */
    const corpo = corpoDoEntregar();
    const i = corpo.indexOf('envio barrado pelo consentimento');
    expect(i, 'não achei o log').toBeGreaterThan(-1);
    const bloco = corpo.slice(i, corpo.indexOf('});', i));

    expect(bloco).toMatch(/motivo: veredicto\.motivo/);
    expect(bloco, 'o log carrega dado do paciente').not.toMatch(/pacienteId|payload/);
  });

  it('⚠️ o evento CARREGA a solicitação — sem ela a checagem não teria como acontecer', () => {
    // O `RETURNING` do claim precisa trazê-la, senão `solicitacaoId` chega sempre nulo e a
    // trava vira decorativa.
    expect(ENVIADOR).toMatch(/RETURNING[^\n]*solicitacao_id/);
    expect(ENVIADOR).toMatch(/solicitacaoId:/);
  });

  it('🔴 a finalidade exigida é a MESMA do enfileiramento — senão as duas divergem', () => {
    // Se o envio exigisse outra finalidade que o cadastro colhe, ou tudo passaria, ou nada.
    expect(MODULO).toMatch(/FINALIDADES\.retornoAoParceiro/);
    expect(ler('lib/parceiros/pode-transferir.ts')).toMatch(
      /retornoAoParceiro|retorno_ao_parceiro/,
    );
  });
});
