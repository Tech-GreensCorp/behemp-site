/**
 * GUARDA — a transferência de cadastro para o parceiro não sai sem consentimento, e nasce
 * desligada.
 *
 * A CLASSE DE ERRO: esta é a única peça do sistema que manda **dado do paciente e documento**
 * para outra empresa. Tudo o mais que sai daqui diz *que* algo ficou pronto, nunca *o que* —
 * e há guarda para isso (`o-aviso-ao-parceiro-nao-se-perde`).
 *
 * Três coisas não podem regredir, e nenhuma é detalhe de implementação:
 *
 *   1. **Nasce desligada.** Sem `PARCEIRO_TRANSFERENCIA_ATIVA=1`, nada sai. Base legal e
 *      contrato de operador são decisão do Jurídico (LGPD art. 11, dado de saúde), e o store
 *      de documentos daqui ainda é público (Item 6) — uma URL assinada sobre objeto público é
 *      enfeite.
 *   2. **O consentimento é LIDO, nunca presumido.** E a finalidade específica precisa estar
 *      entre as aceitas: consentir com a avaliação médica não é consentir com o
 *      compartilhamento (LGPD art. 11, I — consentimento específico).
 *   3. **O texto e a versão viajam junto.** Sem eles, a Greens não tem como provar a que o
 *      paciente disse sim.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FINALIDADES } from '@/lib/parceiros/consentimento';
/**
 * ⚠️ Importa a REGRA, não o módulo inteiro.
 *
 * `prepararTransferencia` busca no banco, e o guarda não tem banco. A decisão de poder ou não
 * transferir é pura de propósito — quando o teste não alcança a decisão, o problema é do
 * desenho.
 */
import { explicarRecusa, podeTransferir } from '@/lib/parceiros/pode-transferir';

const MODULO = 'lib/parceiros/transferencia-de-cadastro.ts';
const codigo = readFileSync(path.join(process.cwd(), MODULO), 'utf8');
const regra = readFileSync(path.join(process.cwd(), 'lib/parceiros/pode-transferir.ts'), 'utf8');

/**
 * Tira comentários antes de procurar.
 *
 * ⚠️ O módulo EXPLICA nos comentários por que não usa base64 — e deve continuar explicando.
 * Procurar a palavra crua acusaria a própria justificativa da decisão: menção vs uso, a
 * décima segunda vez desta classe neste repositório.
 */
function semComentarios(fonte: string): string {
  return fonte
    .split('\n')
    .filter((linha) => !/^\s*(\/\/|\/\*|\*)/.test(linha))
    .join('\n');
}

const ANTES = { ...process.env };
afterEach(() => {
  process.env = { ...ANTES };
});

describe('nasce desligada, e desligada significa desligada', () => {
  beforeEach(() => {
    delete process.env.PARCEIRO_TRANSFERENCIA_ATIVA;
  });

  it('sem a variável, nada sai — nem com consentimento completo', () => {
    const r = podeTransferir([FINALIDADES.retornoAoParceiro]);
    expect(r.pode).toBe(false);
    expect(r.motivo).toBe('desligada');
  });

  it('valor diferente de "1" também é desligada — meio-termo não existe aqui', () => {
    process.env.PARCEIRO_TRANSFERENCIA_ATIVA = 'true';
    expect(podeTransferir([FINALIDADES.retornoAoParceiro]).pode).toBe(false);
  });

  it('a recusa explica o motivo — um envio que não acontece precisa ser diagnosticável', () => {
    expect(explicarRecusa('desligada')).toMatch(/base legal/i);
  });
});

describe('o consentimento é lido, nunca presumido', () => {
  beforeEach(() => {
    process.env.PARCEIRO_TRANSFERENCIA_ATIVA = '1';
  });

  /**
   * 🔴 CONSENTIR COM A AVALIAÇÃO MÉDICA NÃO É CONSENTIR COM O COMPARTILHAMENTO.
   *
   * É o art. 11, I: consentimento para dado sensível é **específico**. Tratar as finalidades
   * como um bloco só destruiria a distinção — e o caso é real: alguém pode querer se consultar
   * aqui e não querer que a Greens receba nada.
   */
  it('finalidade errada não autoriza o envio', () => {
    const r = podeTransferir([FINALIDADES.avaliacaoMedica, FINALIDADES.apoioAnvisa]);
    expect(r.pode).toBe(false);
    expect(r.motivo).toBe('sem_consentimento');
  });

  it('lista vazia também não autoriza', () => {
    const r = podeTransferir([]);
    expect(r.pode).toBe(false);
    expect(r.motivo).toBe('sem_consentimento');
  });

  it('a checagem é da finalidade ESPECÍFICA, não de "consentiu alguma coisa"', () => {
    expect(regra).toMatch(/includes\(FINALIDADES\.retornoAoParceiro\)/);
  });
});

describe('o que o corpo leva, e o que ele não leva', () => {
  it('o texto e a versão do consentimento viajam junto', () => {
    expect(codigo).toContain('VERSAO_DO_CONSENTIMENTO');
    expect(codigo).toContain('TEXTO_DO_CONSENTIMENTO');
  });

  /**
   * ⚠️ OS DOCUMENTOS VÃO POR REFERÊNCIA, NUNCA EMBUTIDOS.
   *
   * Base64 dobraria o tamanho do corpo e deixaria dado de saúde dentro de um log de requisição,
   * se alguém registrar corpo — o que é comum e ninguém lembra na hora.
   */
  it('documentos vão por URL, não em base64', () => {
    expect(semComentarios(codigo)).not.toMatch(/base64/i);
    expect(codigo).toMatch(/url: string/);
  });

  /**
   * 🔴 E A LISTA NASCE VAZIA, enquanto o store daqui for público.
   *
   * Mandar URL assinada de um bucket público é enfeite: o objeto já é legível por quem tiver o
   * endereço. Ela passa a ser preenchida junto com a correção do Item 6 — não antes.
   */
  it('a lista de documentos está vazia até o store virar privado', () => {
    expect(codigo).toMatch(/documentos: \[\],/);
    expect(codigo).toMatch(/store for público|store PÚBLICO|Item 6/);
  });

  it('não leva dado clínico — nem dosagem, nem CID, nem diagnóstico', () => {
    for (const proibido of ['dosagem', 'posologia', 'cid', 'diagnostic', 'medicament']) {
      expect(new RegExp(`${proibido}\\s*:`, 'i').test(codigo), `${proibido} no corpo`).toBe(false);
    }
  });
});

describe('controle — o guarda não pode acusar inocente', () => {
  it('o módulo existe e exporta o que o teste usa (vacuidade)', () => {
    expect(typeof podeTransferir).toBe('function');
    expect(FINALIDADES.retornoAoParceiro).toBe('retorno_ao_parceiro');
  });

  it('o motivo de cada recusa é explicável', () => {
    for (const motivo of ['desligada', 'sem_consentimento', 'sem_parceiro'] as const) {
      expect(explicarRecusa(motivo).length).toBeGreaterThan(10);
    }
  });
});
