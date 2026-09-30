/**
 * GUARDA — o pedido de atendimento assistido é o que abre a procuração (ADR-0029, `DO-71`, `DO-72`).
 *
 * O paciente não escolhe mais "Be4Hope faz por mim" sozinho: ele pede ajuda, o admin ativa a
 * procuração, e só então ela existe para ele. Este guarda quebra o build se:
 *
 *   1. a REGRA de transição errar — ativar o que já está ativo, desativar depois da procuração
 *      assinada, concluir duas vezes, ou os 12 pacientes que já estavam na procuração antes da
 *      mudança (medido em produção em 30/09/2026) perderem o caminho. EXECUTADA, não lida;
 *   2. uma action que muda o pedido perder o papel conferido NO SERVIDOR — o paciente só pede
 *      para a PRÓPRIA autorização, e só admin ativa ou desativa (OWASP API1 e API5);
 *   3. o `pacienteId` passar a vir do navegador em vez da sessão;
 *   4. ativar ou desativar deixar de gravar o antes e o depois em `logs_auditoria` — é ali que
 *      mora o histórico de todas as vezes, porque as colunas guardam só o estado atual;
 *   5. a desativação, que muda pedido e autorização juntos, deixar de usar o cliente que
 *      suporta transação (`db` em produção é `neon-http`, e transação ali é um `throw`);
 *   6. a lista do admin passar a trazer CPF ou e-mail (LGPD art. 6º, III);
 *   7. a aprovação da ANVISA deixar de concluir o pedido.
 *
 * O que ele NÃO prova: que o fluxo roda contra o banco. Isso é o teste de integração
 * `__tests__/integracao/o-pedido-de-atendimento-abre-a-procuracao.test.ts`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { pedidoAtendimentoStatusEnum } from '@/db/schema/enums';
import {
  podeEntrarNaRepresentacao,
  transicionar,
  type AcaoNoPedido,
  type StatusDoPedido,
} from '@/lib/anvisa/pedido-de-atendimento';

import { semComentarios } from './_apoio/codigo';

const RAIZ = process.cwd();
const ler = (p: string) => semComentarios(readFileSync(join(RAIZ, p), 'utf8'));

const ACTIONS = ler('app/_actions/pedido-atendimento-assistido.ts');
const ROTA_DE_STATUS = ler('app/api/anvisa/atualizar-status/route.ts');
const CONCLUIR = ler('lib/anvisa/concluir-pedido-de-atendimento.ts');

/** O corpo de uma função nomeada — da chave que termina a assinatura até a que a fecha. */
function corpoDe(fonte: string, nome: string): string {
  const i = fonte.search(new RegExp(`function ${nome}\\s*\\(`));
  if (i < 0) return '';
  const abre = fonte.indexOf(' {\n', fonte.indexOf(')', i)) + 1;
  let nivel = 0;
  for (let j = abre; j < fonte.length; j++) {
    if (fonte[j] === '{') nivel++;
    else if (fonte[j] === '}' && --nivel === 0) return fonte.slice(abre, j + 1);
  }
  return '';
}

// Derivado do ENUM do banco, não de uma lista paralela: status novo entra na varredura sozinho.
const STATUS = pedidoAtendimentoStatusEnum.enumValues as readonly StatusDoPedido[];
const ACOES: AcaoNoPedido[] = ['ativar', 'desativar', 'concluir'];

describe('a regra de transição do pedido — EXECUTADA', () => {
  it.each<[StatusDoPedido, AcaoNoPedido, boolean, ReturnType<typeof transicionar>]>([
    ['aguardando_ativacao', 'ativar', false, { ok: true, novo: 'pendente_autorizacao' }],
    ['pendente_autorizacao', 'ativar', false, { ok: false, motivo: 'ja_ativado' }],
    ['concluido', 'ativar', false, { ok: false, motivo: 'pedido_concluido' }],
    ['pendente_autorizacao', 'desativar', false, { ok: true, novo: 'aguardando_ativacao' }],
    // DO-72: "pode" desativar — mas só antes de o paciente assinar.
    ['pendente_autorizacao', 'desativar', true, { ok: false, motivo: 'procuracao_assinada' }],
    ['aguardando_ativacao', 'desativar', false, { ok: false, motivo: 'nao_ativado' }],
    ['concluido', 'desativar', false, { ok: false, motivo: 'pedido_concluido' }],
    ['aguardando_ativacao', 'concluir', false, { ok: true, novo: 'concluido' }],
    ['pendente_autorizacao', 'concluir', true, { ok: true, novo: 'concluido' }],
    ['concluido', 'concluir', false, { ok: false, motivo: 'pedido_concluido' }],
  ])('%s + %s (assinada=%s)', (atual, acao, assinada, esperado) => {
    expect(transicionar(atual, acao, { procuracaoAssinada: assinada })).toEqual(esperado);
  });

  it('cobertura: toda combinação de status do enum × ação tem resposta definida', () => {
    const semResposta = STATUS.flatMap((s) =>
      ACOES.flatMap((a) =>
        [false, true]
          .map((assinada) => ({
            s,
            a,
            assinada,
            r: transicionar(s, a, { procuracaoAssinada: assinada }),
          }))
          .filter(({ r }) => !r || typeof r.ok !== 'boolean')
          .map(({ s, a, assinada }) => `${s}+${a}+${assinada}`),
      ),
    );
    expect(STATUS.length).toBeGreaterThan(0);
    expect({ semResposta }).toEqual({ semResposta: [] });
  });

  it('ativar nunca pula direto para concluído, e desativar nunca conclui', () => {
    for (const s of STATUS) {
      for (const assinada of [false, true]) {
        const ativ = transicionar(s, 'ativar', { procuracaoAssinada: assinada });
        const desat = transicionar(s, 'desativar', { procuracaoAssinada: assinada });
        if (ativ.ok) expect(ativ.novo).toBe('pendente_autorizacao');
        if (desat.ok) expect(desat.novo).toBe('aguardando_ativacao');
      }
    }
  });
});

describe('quem pode entrar na procuração — EXECUTADO', () => {
  it.each<[string, 'guiada' | 'representacao', StatusDoPedido | null, boolean]>([
    ['sem pedido, no passo a passo', 'guiada', null, false],
    ['pediu, e o admin ainda não ativou', 'guiada', 'aguardando_ativacao', false],
    ['o admin ativou', 'guiada', 'pendente_autorizacao', true],
    ['pedido concluído não reabre a procuração', 'guiada', 'concluido', false],
    // Os 12 medidos em produção em 30/09: já em `representacao`, sem pedido. D-08: seguem como estão.
    ['já estava na procuração antes da mudança, sem pedido', 'representacao', null, true],
    [
      'já estava na procuração, com pedido desativado',
      'representacao',
      'aguardando_ativacao',
      true,
    ],
  ])('%s', (_, modalidadeAtual, statusDoPedido, esperado) => {
    expect(podeEntrarNaRepresentacao({ modalidadeAtual, statusDoPedido })).toBe(esperado);
  });
});

describe('as actions do pedido — o papel é conferido no servidor', () => {
  it("o arquivo é 'use server' e só exporta função assíncrona", () => {
    expect(ACTIONS.trimStart().startsWith("'use server'")).toBe(true);
    const exportsNaoAsync = [...ACTIONS.matchAll(/^export\s+(?!async function)(\S+\s+\S+)/gm)].map(
      (m) => m[1],
    );
    expect({ exportsNaoAsync }).toEqual({ exportsNaoAsync: [] });
  });

  it('as cinco actions existem (vacuidade: sem elas, os casos abaixo não diriam nada)', () => {
    const faltando = [
      'pedirAtendimentoAssistido',
      'lerMeuPedidoDeAtendimento',
      'ativarProcuracaoAnvisa',
      'desativarProcuracaoAnvisa',
      'listarPedidosDeAtendimento',
    ].filter((n) => corpoDe(ACTIONS, n) === '');
    expect({ faltando }).toEqual({ faltando: [] });
  });

  it.each(['pedirAtendimentoAssistido', 'lerMeuPedidoDeAtendimento'])(
    '%s: confere o PACIENTE e filtra pela autorização DELE',
    (nome) => {
      const corpo = corpoDe(ACTIONS, nome);
      expect(corpo).toMatch(/verificarPaciente\(\)/);
      // A autorização precisa pertencer ao paciente da SESSÃO.
      expect(corpo).toMatch(/eq\(autorizacoesAnvisa\.pacienteId,\s*paciente\.id\)/);
      expect(corpo).toMatch(/isNull\(autorizacoesAnvisa\.deletedAt\)/);
    },
  );

  it.each(['ativarProcuracaoAnvisa', 'desativarProcuracaoAnvisa', 'listarPedidosDeAtendimento'])(
    '%s: confere ADMIN antes de tocar no banco',
    (nome) => {
      const corpo = corpoDe(ACTIONS, nome);
      const papel = corpo.search(/verificarAdmin\(\)/);
      const banco = corpo.search(
        /\b(db|tx|dbTransacional\(\))\s*\.\s*(select|insert|update|delete|transaction)\b/,
      );
      expect(papel).toBeGreaterThanOrEqual(0);
      expect(banco).toBeGreaterThan(papel);
    },
  );

  it('o pacienteId nunca vem do navegador: nenhum schema de entrada o declara', () => {
    const schemas = [...ACTIONS.matchAll(/z\s*\.\s*object\(\{([^}]*)\}\)/g)].map((m) => m[1]);
    expect(schemas.length).toBeGreaterThan(0);
    const comPacienteId = schemas.filter((s) => /pacienteId/.test(s));
    expect({ comPacienteId }).toEqual({ comPacienteId: [] });
  });

  it.each(['ativarProcuracaoAnvisa', 'desativarProcuracaoAnvisa'])(
    '%s: grava o antes E o depois em logs_auditoria, com quem fez',
    (nome) => {
      const corpo = corpoDe(ACTIONS, nome);
      expect(corpo).toMatch(/insert\(logsAuditoria\)/);
      expect(corpo).toMatch(/dadosAntes:/);
      expect(corpo).toMatch(/dadosDepois:/);
      expect(corpo).toMatch(/userId:/);
    },
  );

  it('desativar muda pedido e autorização numa transação do cliente que a suporta', () => {
    const corpo = corpoDe(ACTIONS, 'desativarProcuracaoAnvisa');
    expect(corpo).toMatch(/dbTransacional\(\)\s*\.transaction\(/);
    expect(ACTIONS).not.toMatch(/\bdb\.transaction\(/);
  });

  it('desativar confere a procuração ASSINADA antes de decidir', () => {
    const corpo = corpoDe(ACTIONS, 'desativarProcuracaoAnvisa');
    expect(corpo).toMatch(/procuracaoAssinada:/);
    expect(corpo).toMatch(/procuracoesEspecificas/);
  });

  it('a lista do admin não traz CPF nem e-mail', () => {
    const corpo = corpoDe(ACTIONS, 'listarPedidosDeAtendimento');
    expect(corpo).not.toMatch(/\.cpf\b/);
    expect(corpo).not.toMatch(/\.email\b/);
    expect(corpo).toMatch(/acao:\s*'visualizar'/);
  });
});

describe('a aprovação da ANVISA conclui o pedido', () => {
  it('a rota de status chama a conclusão quando o status é aprovado', () => {
    const bloco = ROTA_DE_STATUS.slice(
      ROTA_DE_STATUS.search(/if \(status === 'aprovado' && atualizado\?\.pacienteId\)/),
    );
    expect(bloco.slice(0, 1500)).toMatch(/concluirPedidoDaAutorizacao\(\s*autorizacaoId\s*\)/);
  });

  it('a conclusão nunca lança: a aprovação já foi gravada quando ela roda', () => {
    const corpo = corpoDe(CONCLUIR, 'concluirPedidoDaAutorizacao');
    expect(corpo).toMatch(/try\s*\{/);
    expect(corpo).toMatch(/catch/);
    expect(corpo).not.toMatch(/\bthrow\b/);
  });
});
