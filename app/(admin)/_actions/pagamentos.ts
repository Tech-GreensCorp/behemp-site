'use server';

import { db } from '@/lib/db';
import { medicos, pacientes, pagamentos, pagamentosConfig, users } from '@/db/schema';
import { eq, and, or, isNotNull, isNull, sql, desc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';

// users é referenciado duas vezes (paciente e médico) — alias evita ambiguidade no join.
const pacienteUsers = alias(users, 'paciente_users');
const medicoUsers = alias(users, 'medico_users');

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/** verificarAdmin() não popula `userId` — resolve pelo clerkId, para auditoria. */
async function obterUserIdInterno(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

export interface PagamentoListItem {
  id: string;
  status: string;
  valor: string;
  moeda: string;
  dataHora: Date;
  pacienteNome: string | null;
  medicoNome: string | null;
  consultaId: string | null;
  iniciadoEm: Date;
  pagamentoIniciadoEm: Date | null;
  pagamentoConcluidoEm: Date | null;
  pagamentoErroEm: Date | null;
  confirmadoEm: Date | null;
  erroConfirmacao: string | null;
}

/**
 * Lista tentativas de agendamento/pagamento com filtros e paginação — mesmo padrão de
 * app/(admin)/_actions/invoices.ts. `atencao: true` filtra as que pagaram a etapa mas
 * a confirmação falhou (`erroConfirmacao` preenchido e sem `confirmadoEm`) — são as que
 * precisam de ação manual do admin.
 */
export async function listarPagamentos(params?: {
  status?: string;
  busca?: string;
  atencao?: boolean;
  limite?: number;
  offset?: number;
}): Promise<ActionResult<{ items: PagamentoListItem[]; total: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const conditions = [];
    if (params?.status) {
      conditions.push(
        eq(pagamentos.status, params.status as typeof pagamentos.$inferSelect.status),
      );
    }
    if (params?.atencao) {
      conditions.push(and(isNotNull(pagamentos.erroConfirmacao), isNull(pagamentos.confirmadoEm)));
    }
    if (params?.busca) {
      const termo = `%${params.busca}%`;
      conditions.push(
        or(sql`${pacienteUsers.nome} ILIKE ${termo}`, sql`${medicoUsers.nome} ILIKE ${termo}`),
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const resultado = await db
      .select({
        id: pagamentos.id,
        status: pagamentos.status,
        valor: pagamentos.valor,
        moeda: pagamentos.moeda,
        dataHora: pagamentos.dataHora,
        pacienteNome: pacienteUsers.nome,
        medicoNome: medicoUsers.nome,
        consultaId: pagamentos.consultaId,
        iniciadoEm: pagamentos.iniciadoEm,
        pagamentoIniciadoEm: pagamentos.pagamentoIniciadoEm,
        pagamentoConcluidoEm: pagamentos.pagamentoConcluidoEm,
        pagamentoErroEm: pagamentos.pagamentoErroEm,
        confirmadoEm: pagamentos.confirmadoEm,
        erroConfirmacao: pagamentos.erroConfirmacao,
      })
      .from(pagamentos)
      .innerJoin(pacientes, eq(pagamentos.pacienteId, pacientes.id))
      .innerJoin(pacienteUsers, eq(pacienteUsers.id, pacientes.userId))
      .innerJoin(medicos, eq(pagamentos.medicoId, medicos.id))
      .innerJoin(medicoUsers, eq(medicoUsers.id, medicos.userId))
      .where(whereClause)
      .orderBy(desc(pagamentos.iniciadoEm))
      .limit(params?.limite ?? 20)
      .offset(params?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pagamentos)
      .innerJoin(pacientes, eq(pagamentos.pacienteId, pacientes.id))
      .innerJoin(pacienteUsers, eq(pacienteUsers.id, pacientes.userId))
      .innerJoin(medicos, eq(pagamentos.medicoId, medicos.id))
      .innerJoin(medicoUsers, eq(medicoUsers.id, medicos.userId))
      .where(whereClause);

    return { sucesso: true, dados: { items: resultado, total: count } };
  } catch (error) {
    console.error('[Admin] Erro ao listar pagamentos:', error);
    return { sucesso: false, erro: 'Erro ao listar pagamentos' };
  }
}

/**
 * Detalhe de uma tentativa de agendamento/pagamento — inclui paciente, médico e o
 * rastreamento completo do funil.
 */
export async function obterPagamento(id: string): Promise<
  ActionResult<{
    id: string;
    status: string;
    valor: string;
    moeda: string;
    gatewayProvider: string | null;
    gatewayReferenciaId: string | null;
    createdAt: Date;
    pagoEm: Date | null;
    observacoes: string | null;
    dataHora: Date;
    pacienteNome: string;
    medicoNome: string;
    consultaId: string | null;
    iniciadoEm: Date;
    pagamentoIniciadoEm: Date | null;
    pagamentoConcluidoEm: Date | null;
    pagamentoErroEm: Date | null;
    confirmadoEm: Date | null;
    erroConfirmacao: string | null;
  }>
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [pagamento] = await db.select().from(pagamentos).where(eq(pagamentos.id, id)).limit(1);

    if (!pagamento) return { sucesso: false, erro: 'Pagamento não encontrado' };

    const [pacienteRow] = await db
      .select({ nome: users.nome })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pagamento.pacienteId))
      .limit(1);

    const [medicoRow] = await db
      .select({ nome: users.nome })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, pagamento.medicoId))
      .limit(1);

    return {
      sucesso: true,
      dados: {
        id: pagamento.id,
        status: pagamento.status,
        valor: pagamento.valor,
        moeda: pagamento.moeda,
        gatewayProvider: pagamento.gatewayProvider,
        gatewayReferenciaId: pagamento.gatewayReferenciaId,
        createdAt: pagamento.createdAt,
        pagoEm: pagamento.pagoEm,
        observacoes: pagamento.observacoes,
        dataHora: pagamento.dataHora,
        pacienteNome: pacienteRow?.nome ?? '—',
        medicoNome: medicoRow?.nome ?? '—',
        consultaId: pagamento.consultaId,
        iniciadoEm: pagamento.iniciadoEm,
        pagamentoIniciadoEm: pagamento.pagamentoIniciadoEm,
        pagamentoConcluidoEm: pagamento.pagamentoConcluidoEm,
        pagamentoErroEm: pagamento.pagamentoErroEm,
        confirmadoEm: pagamento.confirmadoEm,
        erroConfirmacao: pagamento.erroConfirmacao,
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao obter pagamento:', error);
    return { sucesso: false, erro: 'Erro ao obter pagamento' };
  }
}

const atualizarStatusSchema = z.object({
  pagamentoId: z.string().min(1),
  novoStatus: z.enum(['pendente', 'pago', 'isento', 'cancelado', 'estornado']),
});

/**
 * Troca o status de um pagamento. Escrita financeira — sempre auditada.
 */
export async function atualizarStatusPagamento(
  dados: z.infer<typeof atualizarStatusSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarStatusSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [atual] = await db
      .select()
      .from(pagamentos)
      .where(eq(pagamentos.id, parsed.data.pagamentoId))
      .limit(1);

    if (!atual) return { sucesso: false, erro: 'Pagamento não encontrado' };

    await db
      .update(pagamentos)
      .set({
        status: parsed.data.novoStatus,
        pagoEm: parsed.data.novoStatus === 'pago' ? new Date() : atual.pagoEm,
      })
      .where(eq(pagamentos.id, parsed.data.pagamentoId));

    const userIdInterno = await obterUserIdInterno(auth.clerkId);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'atualizar',
        entidade: 'pagamentos',
        entidadeId: parsed.data.pagamentoId,
        dadosAntes: { status: atual.status },
        dadosDepois: { status: parsed.data.novoStatus },
      });
    }

    revalidatePath('/admin/pagamentos');
    revalidatePath(`/admin/pagamentos/${parsed.data.pagamentoId}`);

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao atualizar status do pagamento:', error);
    return { sucesso: false, erro: 'Erro ao atualizar status' };
  }
}

const configPagamentosSchema = z.object({
  valorConsultaPadrao: z.coerce.number().positive('Valor deve ser maior que zero'),
  moedaPadrao: z.string().min(1),
});

export async function buscarConfigPagamentos(): Promise<
  ActionResult<{
    valorConsultaPadrao: string;
    moedaPadrao: string;
  }>
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const config = await db.query.pagamentosConfig.findFirst();
    if (!config) {
      return {
        sucesso: true,
        dados: { valorConsultaPadrao: '150.00', moedaPadrao: 'BRL' },
      };
    }

    return {
      sucesso: true,
      dados: {
        valorConsultaPadrao: config.valorConsultaPadrao,
        moedaPadrao: config.moedaPadrao,
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao buscar config de pagamentos:', error);
    return { sucesso: false, erro: 'Erro ao buscar configuração' };
  }
}

export async function salvarConfigPagamentos(
  dados: z.infer<typeof configPagamentosSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = configPagamentosSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const valores = {
      valorConsultaPadrao: parsed.data.valorConsultaPadrao.toFixed(2),
      moedaPadrao: parsed.data.moedaPadrao,
    };

    const atual = await db.query.pagamentosConfig.findFirst();

    if (atual) {
      await db.update(pagamentosConfig).set(valores).where(eq(pagamentosConfig.id, atual.id));
    } else {
      await db.insert(pagamentosConfig).values(valores);
    }

    const userIdInterno = await obterUserIdInterno(auth.clerkId);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'atualizar',
        entidade: 'pagamentos_config',
        dadosAntes: atual ?? undefined,
        dadosDepois: valores,
      });
    }

    revalidatePath('/admin/pagamentos/configuracoes');

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao salvar config de pagamentos:', error);
    return { sucesso: false, erro: 'Erro ao salvar configuração' };
  }
}
