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
  /**
   * 🔴 RETIFICADO EM 11/09/2026 — este caso exigia as CONSTANTES no corpo, e passou a acusar
   * uma correção.
   *
   * Até então a P5 mandava `VERSAO_DO_CONSENTIMENTO` e `TEXTO_DO_CONSENTIMENTO`, os valores de
   * hoje. Estava errado: se a redação mudar depois que o paciente consentiu, o corpo afirmaria
   * que ele leu um texto que nunca viu. Agora os dois saem do REGISTRO dele (art. 8º §6º).
   *
   * O que o caso garante continua sendo o mesmo — que texto e versão VIAJEM. Mudou de onde
   * saem, e essa parte quem cobre é `o-consentimento-e-colhido-antes-de-sair`.
   */
  it('o texto e a versão do consentimento viajam junto', () => {
    const corpo = codigo.slice(codigo.indexOf('consentimento: {'));
    expect(corpo).toMatch(/versao: \w+\.versao/);
    expect(corpo).toMatch(/texto: \w+\.textoApresentado/);
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
   * 🔴 RETIFICADO EM 11/09/2026 — a lista deixou de nascer vazia, e o caso passou a acusar a
   * própria entrega.
   *
   * O caso antigo exigia `documentos: []` "enquanto o store for público". Era a leitura certa
   * em 10/09: mandar URL assinada de um bucket aberto seria enfeite. O que mudou é COMO a
   * Greens acessa — não a URL do store, mas uma **rota nossa** com token HMAC de vida curta,
   * auditando cada download. O objeto do blob nunca é entregue, então o Item 6 deixa de ser
   * pré-requisito desta peça (segue sendo problema próprio).
   *
   * O que este caso garante agora é o que realmente não pode regredir: **a URL crua do blob
   * jamais sai daqui**.
   */
  it('🔴 a URL que viaja é a NOSSA rota assinada, nunca o endereço do blob', () => {
    const corpo = semComentarios(codigo);
    expect(corpo).toContain('/api/parceiros/documento/');
    // `urlBlob` é a coluna do endereço direto do arquivo. Ela não pode ser selecionada aqui.
    expect(corpo).not.toMatch(/urlBlob/);
    expect(corpo).not.toMatch(/blob\.vercel-storage/);
  });

  it('e o link é assinado, com validade — não é a rota crua com o id', () => {
    expect(semComentarios(codigo)).toContain('assinarLinkDoDocumento(');
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

/**
 * A variável só vale se chegar ao servidor.
 *
 * 🔴 CADASTRAR O SECRET NO GITHUB NÃO BASTA. O `deploy.yml` escreve uma lista FIXA de chaves
 * no `.env` — um secret fora dela fica no GitHub e nunca chega ao processo. Já aconteceu com
 * `PARCEIRO_ORIGENS_DE_DOCUMENTO` em 10/09/2026.
 *
 * Aqui o efeito seria o inverso do perigoso — a transferência ficaria desligada achando que
 * está ligada —, mas o diagnóstico é igualmente confuso: ninguém entende por que o corpo não
 * sai, e a variável "está cadastrada".
 */
describe('a chave que liga a transferência chega ao servidor', () => {
  it('o deploy escreve PARCEIRO_TRANSFERENCIA_ATIVA no .env', () => {
    const yaml = readFileSync(path.join(process.cwd(), '.github/workflows/deploy.yml'), 'utf8');
    expect(yaml).toMatch(/gravar PARCEIRO_TRANSFERENCIA_ATIVA\s+"\$\{\{ secrets\./);
  });

  /**
   * ⚠️ E A TRAVA CONTINUA NO CÓDIGO.
   *
   * O dono pediu para ligar, não para remover o mecanismo. Desligar tem de seguir sendo um
   * comando — some o secret, e o próximo deploy sai desligado, sem reverter código.
   */
  it('e a trava continua existindo — ligar é um valor, não uma remoção', () => {
    expect(regra).toContain('transferenciaAtiva()');
    expect(regra).toMatch(/=== '1'/);
  });
});
