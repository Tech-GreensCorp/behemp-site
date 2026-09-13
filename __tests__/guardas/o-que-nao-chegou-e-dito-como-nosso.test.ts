/**
 * O QUE O PARCEIRO ENVIOU E NÃO CHEGOU É DITO — e como problema NOSSO.
 *
 * 🔴 ADR-0022, R6 e S8.4. O dono viu o painel dizer **"0 enviados"** e parou:
 * _"nenhum dos documentos que eu enviei chegaram na minha conta"_.
 *
 * ⚠️ O PAINEL NÃO MENTIA SOBRE O BANCO — mentia sobre o MUNDO. Havia zero linhas em
 * `documentos`, e isso era verdade. Mas a Greens tinha entregado quatro, e a materialização
 * falhou **em silêncio**: `materializar-documentos.ts` devolve `{ inseridos: 0 }` e nunca
 * lança, por decisão (um erro ao copiar não pode desfazer um cadastro que deu certo).
 *
 * 🔴 SÃO TRÊS ESTADOS, e a tela dizia o mesmo para os três:
 *
 *   1. você não enviou       → cobrar faz sentido
 *   2. recebemos             → nada a fazer
 *   3. veio e não chegou     → é problema NOSSO
 *
 * Cobrar do paciente um documento que ele já entregou é o pior dos três: ele sabe que
 * enviou, o sistema afirma que não, e a conversa começa com ele tendo de provar algo.
 *
 * ⚠️ E A ORDEM NA TELA É PARTE DA CORREÇÃO. Este aviso vem **antes** dos que pedem coisas ao
 * paciente — senão ele lê "faltam 4 documentos" primeiro, e a explicação chega tarde.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..', '..');
const ler = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const AVISO_FONTE = ler('components/paciente/AvisoDoQueNaoChegou.tsx');
const AVISO = semComentarios(AVISO_FONTE);
const TELA = semComentarios(ler('app/(paciente)/paciente/page.tsx'));
const ACTION = semComentarios(ler('app/_actions/dashboard-paciente.ts'));
const SENTINELA = semComentarios(ler('lib/fluxo/sentinela.ts'));

describe('o que não chegou é dito como nosso', () => {
  it('⚠️ VACUIDADE: a sentinela sabe produzir este ponto', () => {
    // Sem o ponto, o aviso nunca apareceria e os casos abaixo seriam vácuo.
    expect(SENTINELA).toMatch(/ponto:\s*'documentos_nao_materializados'/);
  });

  it('🔴 o DASHBOARD entrega a situação — a tela não decide sozinha', () => {
    expect(ACTION).toContain('situacaoDoFluxo');
    expect(ACTION).toMatch(/situacao,/);
  });

  it('🔴 a TELA renderiza — componente órfão não avisa ninguém', () => {
    /**
     * A classe mais repetida deste repositório: o `AvisoDaProcuracao` passou quatro semanas
     * importado e nunca renderizado.
     */
    expect(TELA).toContain('AvisoDoQueNaoChegou');
    expect(TELA).toMatch(/<AvisoDoQueNaoChegou/);
  });

  it('🔴 e vem ANTES dos avisos que pedem coisas ao paciente', () => {
    const naoChegou = TELA.indexOf('<AvisoDoQueNaoChegou');
    const pendente = TELA.indexOf('<AvisoDeCadastroPendente');
    const procuracao = TELA.indexOf('<AvisoDaProcuracao');
    expect(naoChegou).toBeGreaterThan(-1);
    expect(pendente, 'o aviso de pendência vem antes').toBeGreaterThan(naoChegou);
    expect(procuracao, 'o aviso da procuração vem antes').toBeGreaterThan(naoChegou);
  });

  it('🔴 só aparece no ponto certo — não é aviso permanente', () => {
    expect(AVISO).toMatch(/if \(ponto !== 'documentos_nao_materializados'\) return null;/);
  });

  it('🔴 o texto diz que o problema é NOSSO — e isso não é delicadeza', () => {
    /**
     * É a diferença entre o paciente reenviar (trabalho dele, por falha nossa) e nós
     * resolvermos. Um texto neutro empurra o trabalho para quem não errou.
     */
    expect(AVISO_FONTE).toMatch(/isso é com a gente/i);
    expect(AVISO_FONTE).toMatch(/não com\s*\n?\s*você/i);
  });

  it('⚠️ e mostra o PORQUÊ da sentinela, em vez de inventar texto', () => {
    // Texto fixo envelhece; o motivo vem de quem decidiu o ponto.
    expect(AVISO).toMatch(/\{porque\}/);
  });

  it('⚠️ reenviar é opção, nunca obrigação — e vem em segundo lugar', () => {
    const falar = AVISO_FONTE.indexOf('Falar com a gente');
    const reenviar = AVISO_FONTE.indexOf('Prefiro enviar de novo');
    expect(falar).toBeGreaterThan(-1);
    expect(reenviar, 'reenviar aparece antes de falar com a gente').toBeGreaterThan(falar);
  });

  it('⚠️ AVISA, NÃO BLOQUEIA — nada na tela depende deste ponto para renderizar', () => {
    expect(TELA).not.toMatch(/if \(dados\?\.situacao.*return null/);
    expect(TELA).not.toMatch(/disabled=\{dados\?\.situacao/);
  });
});
