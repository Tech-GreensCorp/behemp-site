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

import { urlDoVideo, VIDEO_DO_PASSO_A_PASSO } from '@/lib/anvisa/video-do-passo-a-passo';

import { semComentarios } from './_apoio/codigo';

const RAIZ = process.cwd();
const ler = (p: string) => semComentarios(readFileSync(join(RAIZ, p), 'utf8'));

const ACTIONS = ler('app/_actions/pedido-atendimento-assistido.ts');
const ROTA_DE_STATUS = ler('app/api/anvisa/atualizar-status/route.ts');
const ENCERRAR = ler('lib/anvisa/encerrar-pedido-de-atendimento.ts');
const ACTIONS_DO_PACIENTE = ler('app/(paciente)/_actions/anvisa.ts');

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
const ACOES: AcaoNoPedido[] = ['ativar', 'desativar', 'concluir', 'rejeitar'];

describe('a regra de transição do pedido — EXECUTADA', () => {
  it.each<[StatusDoPedido, AcaoNoPedido, boolean, ReturnType<typeof transicionar>]>([
    ['aguardando_ativacao', 'ativar', false, { ok: true, novo: 'pendente_autorizacao' }],
    ['pendente_autorizacao', 'ativar', false, { ok: false, motivo: 'ja_ativado' }],
    ['concluido', 'ativar', false, { ok: false, motivo: 'pedido_encerrado' }],
    ['rejeitado_anvisa', 'ativar', false, { ok: false, motivo: 'pedido_encerrado' }],
    ['pendente_autorizacao', 'desativar', false, { ok: true, novo: 'aguardando_ativacao' }],
    // DO-72: "pode" desativar — mas só antes de o paciente assinar.
    ['pendente_autorizacao', 'desativar', true, { ok: false, motivo: 'procuracao_assinada' }],
    ['aguardando_ativacao', 'desativar', false, { ok: false, motivo: 'nao_ativado' }],
    ['concluido', 'desativar', false, { ok: false, motivo: 'pedido_encerrado' }],
    ['rejeitado_anvisa', 'desativar', false, { ok: false, motivo: 'pedido_encerrado' }],
    ['aguardando_ativacao', 'concluir', false, { ok: true, novo: 'concluido' }],
    ['pendente_autorizacao', 'concluir', true, { ok: true, novo: 'concluido' }],
    ['concluido', 'concluir', false, { ok: false, motivo: 'pedido_encerrado' }],
    // DO-76: "ele fica como rejeitado anvisa".
    ['aguardando_ativacao', 'rejeitar', false, { ok: true, novo: 'rejeitado_anvisa' }],
    ['pendente_autorizacao', 'rejeitar', false, { ok: true, novo: 'rejeitado_anvisa' }],
    ['concluido', 'rejeitar', false, { ok: false, motivo: 'pedido_encerrado' }],
    ['rejeitado_anvisa', 'concluir', false, { ok: false, motivo: 'pedido_encerrado' }],
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
    ['pedido rejeitado pela ANVISA não reabre a procuração', 'guiada', 'rejeitado_anvisa', false],
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
    // A forma (`procuracaoAssinada: x` ou abreviada) não importa; importa chegar à regra.
    expect(corpo).toMatch(/transicionar\([^)]*procuracaoAssinada/);
    expect(corpo).toMatch(/procuracoesEspecificas/);
  });

  it('a lista do admin não traz CPF nem e-mail', () => {
    const corpo = corpoDe(ACTIONS, 'listarPedidosDeAtendimento');
    expect(corpo).not.toMatch(/\.cpf\b/);
    expect(corpo).not.toMatch(/\.email\b/);
    expect(corpo).toMatch(/acao:\s*'visualizar'/);
  });
});

describe('a resposta da ANVISA encerra o pedido (DO-72, DO-76)', () => {
  it('aprovado encerra como concluido', () => {
    const bloco = ROTA_DE_STATUS.slice(
      ROTA_DE_STATUS.search(/if \(status === 'aprovado' && atualizado\?\.pacienteId\)/),
    );
    expect(bloco.slice(0, 1500)).toMatch(
      /encerrarPedidoDaAutorizacao\(\s*autorizacaoId,\s*'concluido'\s*\)/,
    );
  });

  it('rejeitado encerra como rejeitado_anvisa', () => {
    const bloco = ROTA_DE_STATUS.slice(ROTA_DE_STATUS.search(/if \(status === 'rejeitado'\)/));
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco.slice(0, 300)).toMatch(
      /encerrarPedidoDaAutorizacao\(\s*autorizacaoId,\s*'rejeitado_anvisa'\s*\)/,
    );
  });

  it('o encerramento nunca lança: a resposta da ANVISA já foi gravada quando ele roda', () => {
    const corpo = corpoDe(ENCERRAR, 'encerrarPedidoDaAutorizacao');
    expect(corpo).toMatch(/try\s*\{/);
    expect(corpo).toMatch(/catch/);
    expect(corpo).not.toMatch(/\bthrow\b/);
  });
});

describe('a trava na action que liga a procuração (D-04.3)', () => {
  it('definirModalidadeAnvisa decide com podeEntrarNaRepresentacao ANTES de gravar', () => {
    const corpo = corpoDe(ACTIONS_DO_PACIENTE, 'definirModalidadeAnvisa');
    const decide = corpo.search(/podeEntrarNaRepresentacao\(/);
    const grava = corpo.search(/(db|tx)\s*\.update\(autorizacoesAnvisa\)/);
    expect(decide).toBeGreaterThanOrEqual(0);
    expect(grava).toBeGreaterThan(decide);
  });

  it('a decisão usa a modalidade GRAVADA, não uma vinda do navegador', () => {
    const corpo = corpoDe(ACTIONS_DO_PACIENTE, 'definirModalidadeAnvisa');
    expect(corpo).toMatch(/modalidadeAtual:\s*autorizacaoAtual\.modalidade/);
  });
});

const TELA = ler('app/(paciente)/paciente/anvisa/page.tsx');
const SUPORTE = ler('components/paciente/anvisa/AtendimentoComSuporte.tsx');
const VIDEO = ler('components/paciente/anvisa/VideoDoPassoAPasso.tsx');
const TELA_ADMIN = ler('app/(admin)/admin/anvisa/page.tsx');
const LISTA_ADMIN = ler('components/admin/anvisa/PedidosDeAtendimento.tsx');
const AVISO = ler('components/paciente/AvisoDaProcuracao.tsx');

/** O trecho JSX de uma etapa da tela: de `etapa === 'x' &&` até a próxima etapa. */
function etapa(nome: string): string {
  const i = TELA.indexOf(`etapa === '${nome}' && autorizacao && (`);
  if (i < 0) return '';
  const j = TELA.indexOf("etapa === '", i + 20);
  return TELA.slice(i, j < 0 ? undefined : j);
}

describe('a tela do paciente (D-01, D-06, D-07)', () => {
  it('a etapa "Como prefere fazer?" não volta: nenhum setEtapa, tipo ou JSX de escolha', () => {
    expect(TELA).not.toMatch(/'escolha'/);
    expect(TELA).not.toMatch(/Como prefere fazer/);
  });

  it('o passo a passo existe (vacuidade dos casos abaixo)', () => {
    expect(etapa('guiada').length).toBeGreaterThan(500);
  });

  it('o passo a passo abre pelo vídeo, antes do link do Gov.br', () => {
    const g = etapa('guiada');
    const video = g.indexOf('<VideoDoPassoAPasso');
    const govbr = g.indexOf('Abrir portal Gov.br');
    expect(video).toBeGreaterThanOrEqual(0);
    expect(govbr).toBeGreaterThan(video);
  });

  it('o suporte vem no FIM, depois do "Após concluir o processo no Gov.br"', () => {
    const g = etapa('guiada');
    const apos = g.indexOf('Após concluir o processo no Gov.br');
    const suporte = g.indexOf('<AtendimentoComSuporte');
    expect(apos).toBeGreaterThanOrEqual(0);
    expect(suporte).toBeGreaterThan(apos);
  });

  it('a modalidade que o suporte recebe é a GRAVADA, e o clique na procuração lê a resposta do servidor', () => {
    expect(etapa('guiada')).toMatch(/modalidadeAtual=\{modalidade \?\? 'guiada'\}/);
    const corpo =
      corpoDe(TELA, 'handleBe4HopeFazPorMim') ||
      TELA.slice(
        TELA.indexOf('const handleBe4HopeFazPorMim'),
        TELA.indexOf('const handleConfirmarEnvio'),
      );
    expect(corpo).toMatch(/definirModalidadeAnvisa\(autorizacao\.id, 'representacao'\)/);
    expect(corpo).toMatch(/if \(!res\.sucesso\)/);
  });
});

describe('o fim do passo a passo (D-02, D-06)', () => {
  it('"Be4Hope faz por mim" só aparece LIBERADA, e liberada vem da regra executada no guarda', () => {
    expect(SUPORTE).toMatch(/const liberada = podeEntrarNaRepresentacao\(/);
    const bloco = SUPORTE.slice(SUPORTE.indexOf('{liberada && ('));
    expect(bloco.length).toBeGreaterThan(0);
    expect(bloco).toMatch(/Be4Hope faz por mim/);
    expect(SUPORTE.split('Be4Hope faz por mim').length - 1).toBe(1);
  });

  it('o botão da procuração vem DEPOIS do "Atendimento com suporte"', () => {
    const suporte = SUPORTE.indexOf('Atendimento com suporte');
    const procuracao = SUPORTE.indexOf('Be4Hope faz por mim');
    expect(suporte).toBeGreaterThanOrEqual(0);
    expect(procuracao).toBeGreaterThan(suporte);
  });

  it('o clique no suporte tem retorno: pedido aberto mostra a confirmação no lugar do botão', () => {
    expect(SUPORTE).toMatch(/pedirAtendimentoAssistido\(\{ autorizacaoId \}\)/);
    expect(SUPORTE).toMatch(/pedidoAberto \? \(/);
    expect(SUPORTE).toMatch(/Recebemos seu pedido/);
  });
});

describe('a área de vídeo (D-07)', () => {
  it.each<[string, string | null]>([
    ['', null],
    ['   ', null],
    [
      'https://abc123.public.blob.vercel-storage.com/anvisa/passo.mp4',
      'https://abc123.public.blob.vercel-storage.com/anvisa/passo.mp4',
    ],
    ['/videos/passo.mp4', '/videos/passo.mp4'],
    // O CSP bloquearia estes, e o player ficaria quebrado: melhor o "em breve".
    ['https://www.youtube.com/watch?v=x', null],
    ['http://abc.public.blob.vercel-storage.com/x.mp4', null],
    ['https://public.blob.vercel-storage.com.evil.com/x.mp4', null],
    ['//outro-site.com/x.mp4', null],
  ])('urlDoVideo(%j)', (entrada, esperado) => {
    expect(urlDoVideo(entrada)).toBe(esperado);
  });

  it('a URL configurada hoje é tocável ou vazia — nunca uma que o CSP bloqueia', () => {
    for (const u of [VIDEO_DO_PASSO_A_PASSO.url, VIDEO_DO_PASSO_A_PASSO.legenda]) {
      expect(u.trim() === '' || urlDoVideo(u) !== null).toBe(true);
    }
  });

  it('sem vídeo, a área diz que está em breve (nunca um player vazio)', () => {
    expect(VIDEO).toMatch(/if \(!url\)/);
    expect(VIDEO).toMatch(/em breve/);
    expect(VIDEO).toMatch(/<video\b[\s\S]*controls/);
  });
});

describe('a tela do admin (D-03)', () => {
  it('a seção de pedidos é RENDERIZADA na tela, não só importada', () => {
    expect(TELA_ADMIN).toMatch(
      /import \{ PedidosDeAtendimento \} from '@\/components\/admin\/anvisa\/PedidosDeAtendimento'/,
    );
    expect(TELA_ADMIN).toMatch(/<PedidosDeAtendimento\s*\/>/);
  });

  it('a lista é um Accordion (item que abre e fecha), sem <Table>', () => {
    expect(LISTA_ADMIN).toMatch(/<Accordion\b/);
    expect(LISTA_ADMIN).toMatch(/<AccordionItem\b/);
    expect(LISTA_ADMIN).not.toMatch(/<Table\b/);
  });

  it('a lista não mostra CPF nem e-mail', () => {
    expect(LISTA_ADMIN).not.toMatch(/\bcpf\b|\bemail\b/i);
  });

  it('erro ao carregar NÃO aparece como lista vazia', () => {
    const erro = LISTA_ADMIN.indexOf(') : erro ? (');
    const vazio = LISTA_ADMIN.indexOf('Nenhum pedido de atendimento');
    expect(erro).toBeGreaterThanOrEqual(0);
    expect(vazio).toBeGreaterThan(erro);
  });

  it('cada botão aparece só na situação em que a ação vale', () => {
    expect(LISTA_ADMIN).toMatch(
      /p\.status === 'aguardando_ativacao' && \([\s\S]*?Ativar procuração/,
    );
    expect(LISTA_ADMIN).toMatch(/p\.status === 'pendente_autorizacao' && \([\s\S]*?Desativar/);
  });
});

describe('o aviso do painel não promete a procuração (D-10, DO-73)', () => {
  it('o texto aprovado está lá, e a promessa antiga não', () => {
    expect(AVISO).toMatch(/Veja o passo a passo para fazer pelo[\s\S]*Gov\.br/);
    expect(AVISO).not.toMatch(/você só confere e assina/);
    expect(AVISO).not.toMatch(/Fazer a procuração agora/);
  });
});

const ROTA_DA_PROCURACAO = ler('app/api/anvisa/procuracao/route.ts');

describe('a revisão de 30/09/2026 — os desvios que ela achou não voltam', () => {
  it('ALTA: a rota que gera a procuração recusa quem não está em representacao, ANTES de gerar ou enviar', () => {
    const trava = ROTA_DA_PROCURACAO.search(/if \(autorizacao\.modalidade !== 'representacao'\)/);
    const upload = ROTA_DA_PROCURACAO.search(/await put\(/);
    const envelope = ROTA_DA_PROCURACAO.search(/criarEnvelopeEmbedded\(/);
    expect(trava).toBeGreaterThanOrEqual(0);
    if (upload >= 0) expect(upload).toBeGreaterThan(trava);
    if (envelope >= 0) expect(envelope).toBeGreaterThan(trava);
  });

  it.each<[boolean, boolean, ReturnType<typeof transicionar>]>([
    [false, true, { ok: false, motivo: 'procuracao_em_assinatura' }],
    [true, true, { ok: false, motivo: 'procuracao_assinada' }],
    [false, false, { ok: true, novo: 'aguardando_ativacao' }],
  ])('MÉDIA: desativar com assinada=%s e em assinatura=%s', (assinada, emAssinatura, esperado) => {
    expect(
      transicionar('pendente_autorizacao', 'desativar', {
        procuracaoAssinada: assinada,
        procuracaoEmAssinatura: emAssinatura,
      }),
    ).toEqual(esperado);
  });

  it('MÉDIA: desativar passa o envelope enviado para a regra', () => {
    const corpo = corpoDe(ACTIONS, 'desativarProcuracaoAnvisa');
    expect(corpo).toMatch(/procuracaoEmAssinatura/);
    expect(corpo).toMatch(/'enviado'/);
  });

  it('MÉDIA: a entrada na procuração confere e grava numa transação, trancando o pedido', () => {
    const corpo = corpoDe(ACTIONS_DO_PACIENTE, 'definirModalidadeAnvisa');
    expect(corpo).toMatch(/dbTransacional\(\)\.transaction\(/);
    // A trava tem de estar na consulta do PEDIDO: casar qualquer `.for('update')` depois dela
    // aceitaria a trava da autorização no lugar (sabotagem 22, 30/09/2026, sobreviveu assim).
    const i = corpo.indexOf('from(pedidosAtendimentoAssistido)');
    const consultaDoPedido = corpo.slice(i, corpo.indexOf('from(autorizacoesAnvisa)', i));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(consultaDoPedido).toMatch(/\.for\('update'\)/);
    // Nada de gravar a autorização fora da transação quando o pedido é de procuração.
    const bloco = corpo.slice(
      corpo.indexOf("if (modalidade === 'representacao')"),
      corpo.indexOf('} else {'),
    );
    expect(bloco).not.toMatch(/\bdb\s*\.update\(/);
  });

  it('BAIXA: ativar confere que a autorização do pedido não foi apagada', () => {
    const corpo = corpoDe(ACTIONS, 'ativarProcuracaoAnvisa');
    expect(corpo).toMatch(/isNull\(autorizacoesAnvisa\.deletedAt\)/);
  });

  it('BAIXA: falha de rede não trava a tela — os carregamentos têm catch', () => {
    expect(SUPORTE).toMatch(/lerMeuPedidoDeAtendimento\([\s\S]*?\.catch\(/);
    expect(SUPORTE).toMatch(/\.finally\(/);
    expect(LISTA_ADMIN).toMatch(/listarPedidosDeAtendimento\(\)[\s\S]*?\.catch\(/);
    expect(LISTA_ADMIN).toMatch(/\.finally\(/);
  });
});
