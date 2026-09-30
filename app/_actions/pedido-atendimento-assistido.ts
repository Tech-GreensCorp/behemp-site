'use server';

/**
 * Pedido de atendimento assistido da ANVISA — ADR-0029 D-02 a D-04 (`DO-71`, `DO-72`).
 *
 * O paciente não escolhe mais a procuração sozinho. Ele clica em "Atendimento com suporte", e
 * isso vira um PEDIDO; o admin vê o pedido em `/admin/anvisa` e ativa a procuração para aquela
 * autorização. Só então o botão "Be4Hope faz por mim" aparece para o paciente.
 *
 * As três perguntas (`.claude/rules/seguranca-lgpd.md`):
 *   · quem pode ler — o paciente, o PRÓPRIO pedido (a autorização é conferida contra o paciente
 *     da sessão, nunca contra um id vindo do navegador); o admin, a lista, só com o nome;
 *   · quanto tempo fica — o pedido não se apaga (`DO-72`); segue o prazo da autorização;
 *   · é auditado — pedir, ativar, desativar e listar gravam `logs_auditoria`. Ativar e desativar
 *     gravam o antes e o depois NA MESMA transação da mudança: estado mudado sem registro de quem
 *     mudou não existe.
 */

import { z } from 'zod';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidatePath } from 'next/cache';

import {
  autorizacoesAnvisa,
  logsAuditoria,
  pacientes,
  pedidosAtendimentoAssistido,
  procuracoesEspecificas,
  users,
} from '@/db/schema';
import { verificarAdmin, verificarPaciente } from '@/lib/auth/permissions';
import { db } from '@/lib/db';
import { dbTransacional } from '@/lib/db/transacional';
import {
  MENSAGEM_DA_RECUSA,
  STATUS_ABERTOS,
  STATUS_ENCERRADOS,
  transicionar,
  type StatusDoPedido,
} from '@/lib/anvisa/pedido-de-atendimento';
import { motivoLegivel } from '@/lib/erros/motivo-legivel';

interface Resultado<T = undefined> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

interface MeuPedido {
  /** O id do PRÓPRIO pedido: é o que abre a tela do atendimento (ADR-0029 D-12). */
  pedidoId: string;
  status: StatusDoPedido;
  pedidoEm: string;
}

interface PedidoNaLista {
  pedidoId: string;
  autorizacaoId: string;
  pacienteNome: string;
  status: StatusDoPedido;
  statusAutorizacao: string;
  pedidoEm: string;
  ativadoEm: string | null;
  ativadoPorNome: string | null;
  encerradoEm: string | null;
}

// `.strict()`: um `pacienteId` enviado pelo navegador é RECUSADO, não ignorado.
const entradaDaAutorizacao = z.object({ autorizacaoId: z.string().min(1).max(64) }).strict();
const entradaDoPedido = z.object({ pedidoId: z.string().min(1).max(64) }).strict();

/** Tipos do checklist que só existem porque a procuração foi escolhida (`definirModalidadeAnvisa`). */
const ITENS_DA_PROCURACAO = ['procuracao_especifica', 'laudo_medico'];

async function idDoUsuario(clerkId: string): Promise<string | null> {
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return u?.id ?? null;
}

async function pacienteDaSessao(clerkId: string): Promise<{ id: string; userId: string } | null> {
  const userId = await idDoUsuario(clerkId);
  if (!userId) return null;
  const [p] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, userId), isNull(pacientes.deletedAt)))
    .limit(1);
  return p ? { id: p.id, userId } : null;
}

async function pedidoAbertoDa(autorizacaoId: string) {
  const [p] = await db
    .select()
    .from(pedidosAtendimentoAssistido)
    .where(
      and(
        eq(pedidosAtendimentoAssistido.autorizacaoId, autorizacaoId),
        inArray(pedidosAtendimentoAssistido.status, [...STATUS_ABERTOS]),
      ),
    )
    .limit(1);
  return p ?? null;
}

/** O código do Postgres, venha o erro cru do `pg` ou embrulhado pelo Drizzle (`cause`). */
function codigoDoErro(erro: unknown): string | undefined {
  const e = erro as { code?: unknown; cause?: { code?: unknown } } | null;
  const codigo = e?.code ?? e?.cause?.code;
  return typeof codigo === 'string' ? codigo : undefined;
}

// ── Paciente: pede atendimento assistido ───────────────────────
export async function pedirAtendimentoAssistido(input: unknown): Promise<Resultado<MeuPedido>> {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const entrada = entradaDaAutorizacao.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const paciente = await pacienteDaSessao(perm.clerkId);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  const [autorizacao] = await db
    .select({ id: autorizacoesAnvisa.id })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.id, entrada.data.autorizacaoId),
        eq(autorizacoesAnvisa.pacienteId, paciente.id),
        isNull(autorizacoesAnvisa.deletedAt),
      ),
    )
    .limit(1);
  // Autorização de outro paciente e autorização inexistente dão a MESMA resposta: a diferença
  // contaria a quem tenta que aquele id existe.
  if (!autorizacao) return { sucesso: false, erro: 'Autorização não encontrada' };

  const resposta = (p: {
    id: string;
    status: StatusDoPedido;
    pedidoEm: Date;
  }): Resultado<MeuPedido> => ({
    sucesso: true,
    dados: { pedidoId: p.id, status: p.status, pedidoEm: p.pedidoEm.toISOString() },
  });

  // Idempotente: pedir de novo devolve o pedido que já existe, com a data do primeiro.
  const existente = await pedidoAbertoDa(autorizacao.id);
  if (existente) return resposta(existente);

  try {
    const [novo] = await db
      .insert(pedidosAtendimentoAssistido)
      .values({ autorizacaoId: autorizacao.id, pacienteId: paciente.id })
      .returning();

    await db
      .insert(logsAuditoria)
      .values({
        userId: paciente.userId,
        acao: 'PEDIR_ATENDIMENTO_ASSISTIDO',
        entidade: 'pedidos_atendimento_assistido',
        entidadeId: novo.id,
        dadosDepois: { status: novo.status, autorizacaoId: autorizacao.id },
      })
      .catch((erro) =>
        console.warn('[anvisa] auditoria do pedido falhou', { motivo: motivoLegivel(erro) }),
      );

    revalidatePath('/paciente/anvisa');
    revalidatePath('/admin/anvisa');
    return resposta(novo);
  } catch (erro) {
    // Dois cliques ao mesmo tempo: o índice único parcial da 0050 recusa o segundo, e o pedido
    // que venceu a corrida é a resposta certa para os dois.
    if (codigoDoErro(erro) === '23505') {
      const vencedor = await pedidoAbertoDa(autorizacao.id);
      if (vencedor) return resposta(vencedor);
    }
    console.error('[anvisa] pedido de atendimento falhou', { motivo: motivoLegivel(erro) });
    return { sucesso: false, erro: 'Não conseguimos registrar seu pedido. Tente de novo.' };
  }
}

// ── Paciente: lê o próprio pedido ──────────────────────────────
export async function lerMeuPedidoDeAtendimento(
  input: unknown,
): Promise<Resultado<MeuPedido | null>> {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const entrada = entradaDaAutorizacao.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const paciente = await pacienteDaSessao(perm.clerkId);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  const [autorizacao] = await db
    .select({ id: autorizacoesAnvisa.id })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.id, entrada.data.autorizacaoId),
        eq(autorizacoesAnvisa.pacienteId, paciente.id),
        isNull(autorizacoesAnvisa.deletedAt),
      ),
    )
    .limit(1);
  if (!autorizacao) return { sucesso: false, erro: 'Autorização não encontrada' };

  const [ultimo] = await db
    .select({
      id: pedidosAtendimentoAssistido.id,
      status: pedidosAtendimentoAssistido.status,
      pedidoEm: pedidosAtendimentoAssistido.pedidoEm,
    })
    .from(pedidosAtendimentoAssistido)
    .where(eq(pedidosAtendimentoAssistido.autorizacaoId, autorizacao.id))
    .orderBy(desc(pedidosAtendimentoAssistido.pedidoEm))
    .limit(1);

  return {
    sucesso: true,
    dados: ultimo
      ? { pedidoId: ultimo.id, status: ultimo.status, pedidoEm: ultimo.pedidoEm.toISOString() }
      : null,
  };
}

// ── Admin: ativa a procuração ──────────────────────────────────
export async function ativarProcuracaoAnvisa(input: unknown): Promise<Resultado> {
  const perm = await verificarAdmin();
  if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const entrada = entradaDoPedido.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const adminId = await idDoUsuario(perm.clerkId);
  if (!adminId) return { sucesso: false, erro: 'Não autorizado' };

  const resultado = await dbTransacional().transaction(async (tx): Promise<Resultado> => {
    // `for update`: duas abas do admin agindo no mesmo pedido esperam uma pela outra.
    const [pedido] = await tx
      .select()
      .from(pedidosAtendimentoAssistido)
      .where(eq(pedidosAtendimentoAssistido.id, entrada.data.pedidoId))
      .for('update');
    if (!pedido) return { sucesso: false, erro: 'Pedido não encontrado' };

    // Revisão de 30/09/2026: autorização apagada não se ativa — o pedido ficou órfão dela.
    const [autorizacaoViva] = await tx
      .select({ id: autorizacoesAnvisa.id })
      .from(autorizacoesAnvisa)
      .where(
        and(eq(autorizacoesAnvisa.id, pedido.autorizacaoId), isNull(autorizacoesAnvisa.deletedAt)),
      );
    if (!autorizacaoViva)
      return { sucesso: false, erro: 'A autorização deste pedido foi apagada.' };

    const t = transicionar(pedido.status, 'ativar', { procuracaoAssinada: false });
    if (!t.ok) return { sucesso: false, erro: MENSAGEM_DA_RECUSA[t.motivo] };

    const agora = new Date();
    await tx
      .update(pedidosAtendimentoAssistido)
      .set({ status: t.novo, ativadoPor: adminId, ativadoEm: agora })
      .where(eq(pedidosAtendimentoAssistido.id, pedido.id));

    await tx.insert(logsAuditoria).values({
      userId: adminId,
      acao: 'ATIVAR_PROCURACAO',
      entidade: 'pedidos_atendimento_assistido',
      entidadeId: pedido.id,
      dadosAntes: { status: pedido.status },
      dadosDepois: {
        status: t.novo,
        autorizacaoId: pedido.autorizacaoId,
        ativadoEm: agora.toISOString(),
      },
    });
    return { sucesso: true };
  });

  if (resultado.sucesso) {
    revalidatePath('/admin/anvisa');
    revalidatePath('/paciente/anvisa');
  }
  return resultado;
}

// ── Admin: desativa a procuração, só antes da assinatura ───────
export async function desativarProcuracaoAnvisa(input: unknown): Promise<Resultado> {
  const perm = await verificarAdmin();
  if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const entrada = entradaDoPedido.safeParse(input);
  if (!entrada.success) return { sucesso: false, erro: 'Dados inválidos' };

  const adminId = await idDoUsuario(perm.clerkId);
  if (!adminId) return { sucesso: false, erro: 'Não autorizado' };

  const resultado = await dbTransacional().transaction(async (tx): Promise<Resultado> => {
    const [pedido] = await tx
      .select()
      .from(pedidosAtendimentoAssistido)
      .where(eq(pedidosAtendimentoAssistido.id, entrada.data.pedidoId))
      .for('update');
    if (!pedido) return { sucesso: false, erro: 'Pedido não encontrado' };

    const procuracoes = await tx
      .select({
        status: procuracoesEspecificas.docusignStatus,
        envelope: procuracoesEspecificas.docusignEnvelopeId,
        assinadoEm: procuracoesEspecificas.assinadoEm,
        pdfAssinado: procuracoesEspecificas.urlPdfAssinado,
      })
      .from(procuracoesEspecificas)
      .where(
        and(
          eq(procuracoesEspecificas.autorizacaoId, pedido.autorizacaoId),
          isNull(procuracoesEspecificas.deletedAt),
        ),
      );
    const procuracaoAssinada = procuracoes.some(
      (p) =>
        p.assinadoEm !== null ||
        p.pdfAssinado !== null ||
        p.status === 'assinado' ||
        p.status === 'concluido',
    );
    // Envelope enviado e ainda não recusado nem expirado: o paciente pode assinar a qualquer hora.
    const procuracaoEmAssinatura = procuracoes.some(
      (p) => p.envelope !== null && (p.status === 'enviado' || p.status === 'visualizado'),
    );

    const t = transicionar(pedido.status, 'desativar', {
      procuracaoAssinada,
      procuracaoEmAssinatura,
    });
    if (!t.ok) return { sucesso: false, erro: MENSAGEM_DA_RECUSA[t.motivo] };

    const [autorizacao] = await tx
      .select({
        modalidade: autorizacoesAnvisa.modalidade,
        documentos: autorizacoesAnvisa.documentos,
      })
      .from(autorizacoesAnvisa)
      .where(eq(autorizacoesAnvisa.id, pedido.autorizacaoId))
      .for('update');

    /**
     * ADR-0029 D-04 ⚠️: se o paciente já tinha clicado em "Be4Hope faz por mim", a autorização
     * está em `representacao`. Desativar a volta para `guiada` e tira do checklist a procuração e
     * o laudo que só estavam ali por causa dela — e SÓ os que ainda não foram enviados. Documento
     * enviado é do paciente, e não sai por desativação.
     */
    const docs = (autorizacao?.documentos as { tipo: string; enviado?: boolean }[] | null) ?? [];
    const voltaParaGuiada = autorizacao?.modalidade === 'representacao';
    const docsDepois = voltaParaGuiada
      ? docs.filter((d) => !(ITENS_DA_PROCURACAO.includes(d.tipo) && d.enviado !== true))
      : docs;

    const agora = new Date();
    await tx
      .update(pedidosAtendimentoAssistido)
      .set({ status: t.novo, desativadoPor: adminId, desativadoEm: agora })
      .where(eq(pedidosAtendimentoAssistido.id, pedido.id));

    if (voltaParaGuiada) {
      await tx
        .update(autorizacoesAnvisa)
        .set({ modalidade: 'guiada', documentos: docsDepois })
        .where(eq(autorizacoesAnvisa.id, pedido.autorizacaoId));
    }

    await tx.insert(logsAuditoria).values({
      userId: adminId,
      acao: 'DESATIVAR_PROCURACAO',
      entidade: 'pedidos_atendimento_assistido',
      entidadeId: pedido.id,
      dadosAntes: {
        status: pedido.status,
        modalidade: autorizacao?.modalidade ?? null,
        itensDoChecklist: docs.map((d) => d.tipo),
      },
      dadosDepois: {
        status: t.novo,
        modalidade: voltaParaGuiada ? 'guiada' : (autorizacao?.modalidade ?? null),
        itensDoChecklist: docsDepois.map((d) => d.tipo),
        desativadoEm: agora.toISOString(),
      },
    });
    return { sucesso: true };
  });

  if (resultado.sucesso) {
    revalidatePath('/admin/anvisa');
    revalidatePath('/paciente/anvisa');
  }
  return resultado;
}

// ── Admin: lista os pedidos ────────────────────────────────────
export async function listarPedidosDeAtendimento(): Promise<Resultado<PedidoNaLista[]>> {
  const perm = await verificarAdmin();
  if (!perm.autorizado || !perm.clerkId) return { sucesso: false, erro: 'Não autorizado' };

  const adminId = await idDoUsuario(perm.clerkId);
  const ativador = alias(users, 'ativador');

  // Só o necessário para o admin agir: nome, situação e datas. CPF, e-mail e documentos ficam fora
  // (LGPD art. 6º, III) — o cartão da autorização, na mesma tela, continua sendo o lugar deles.
  const linhas = await db
    .select({
      pedidoId: pedidosAtendimentoAssistido.id,
      autorizacaoId: pedidosAtendimentoAssistido.autorizacaoId,
      pacienteNome: users.nome,
      status: pedidosAtendimentoAssistido.status,
      statusAutorizacao: autorizacoesAnvisa.status,
      pedidoEm: pedidosAtendimentoAssistido.pedidoEm,
      ativadoEm: pedidosAtendimentoAssistido.ativadoEm,
      ativadoPorNome: ativador.nome,
      encerradoEm: pedidosAtendimentoAssistido.encerradoEm,
    })
    .from(pedidosAtendimentoAssistido)
    .innerJoin(
      autorizacoesAnvisa,
      eq(autorizacoesAnvisa.id, pedidosAtendimentoAssistido.autorizacaoId),
    )
    .innerJoin(pacientes, eq(pacientes.id, pedidosAtendimentoAssistido.pacienteId))
    .innerJoin(users, eq(users.id, pacientes.userId))
    .leftJoin(ativador, eq(ativador.id, pedidosAtendimentoAssistido.ativadoPor))
    // Paciente arquivado (PR #140, `deletedAt`) sai da lista: não há atendimento a fazer por ele.
    .where(and(isNull(autorizacoesAnvisa.deletedAt), isNull(pacientes.deletedAt)))
    .orderBy(desc(pedidosAtendimentoAssistido.pedidoEm));

  await db
    .insert(logsAuditoria)
    .values({
      userId: adminId,
      acao: 'visualizar',
      entidade: 'pedidos_atendimento_assistido',
      dadosDepois: { quantidade: linhas.length },
    })
    .catch((erro) =>
      console.warn('[anvisa] auditoria da lista falhou', { motivo: motivoLegivel(erro) }),
    );

  // Abertos primeiro; dentro de cada grupo, o pedido mais recente em cima.
  const ordem = (s: StatusDoPedido) => (STATUS_ENCERRADOS.includes(s) ? 1 : 0);
  const dados = linhas
    .map((l) => ({
      ...l,
      pedidoEm: l.pedidoEm.toISOString(),
      ativadoEm: l.ativadoEm?.toISOString() ?? null,
      encerradoEm: l.encerradoEm?.toISOString() ?? null,
    }))
    .sort((a, b) => ordem(a.status) - ordem(b.status));

  return { sucesso: true, dados };
}
