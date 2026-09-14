'use server';

import { db } from '@/lib/db';
import { pagamentos, pacientes, medicos, medicosPagamentoConfig, users } from '@/db/schema';
import { eq, and, desc, sql, isNotNull, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedico } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';
import {
  camposDadosPagamentoMedico,
  validarCoerenciaDadosPagamento,
} from '@/lib/pagamentos/validacao-config-pagamento';

/**
 * Server Actions do próprio médico sobre pagamento das consultas — visão e configuração
 * de recebimento. Espelha app/(admin)/_actions/pagamentos.ts e pagamentos-medicos.ts,
 * mas SEM `medicoId` como parâmetro em nenhuma delas: o escopo vem sempre da sessão
 * (verificarMedico + resolverMedico), nunca do cliente — o médico só pode ler/gravar
 * o que é dele mesmo.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/** Resolve medicoId + userId interno a partir do clerkId autenticado. */
async function resolverMedico(
  clerkId: string,
): Promise<{ medicoId: string; userId: string } | null> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return null;
  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id));
  if (!medico) return null;
  return { medicoId: medico.id, userId: user.id };
}

// ── Listar pagamentos das próprias consultas ──────────────────────

export interface PagamentoMedicoListItem {
  id: string;
  status: string;
  valor: string;
  moeda: string;
  dataHora: Date;
  pacienteNome: string;
  consultaId: string | null;
  pagamentoConcluidoEm: Date | null;
  confirmadoEm: Date | null;
  erroConfirmacao: string | null;
}

export interface ResumoPagamentosMedico {
  totalRecebido: string;
  totalPendente: string;
  quantidadePendente: number;
  quantidadePaga: number;
}

export async function listarPagamentosMedico(params?: {
  status?: string;
  busca?: string;
  atencao?: boolean;
  limite?: number;
  offset?: number;
}): Promise<
  ActionResult<{
    items: PagamentoMedicoListItem[];
    total: number;
    resumo: ResumoPagamentosMedico;
  }>
> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const condicoes = [eq(pagamentos.medicoId, medico.medicoId)];
    if (params?.status) {
      condicoes.push(eq(pagamentos.status, params.status as typeof pagamentos.$inferSelect.status));
    }
    if (params?.atencao) {
      condicoes.push(isNotNull(pagamentos.erroConfirmacao), isNull(pagamentos.confirmadoEm));
    }
    if (params?.busca) {
      condicoes.push(sql`${users.nome} ILIKE ${`%${params.busca}%`}`);
    }
    const whereClause = and(...condicoes);

    const items = await db
      .select({
        id: pagamentos.id,
        status: pagamentos.status,
        valor: pagamentos.valor,
        moeda: pagamentos.moeda,
        dataHora: pagamentos.dataHora,
        pacienteNome: users.nome,
        consultaId: pagamentos.consultaId,
        pagamentoConcluidoEm: pagamentos.pagamentoConcluidoEm,
        confirmadoEm: pagamentos.confirmadoEm,
        erroConfirmacao: pagamentos.erroConfirmacao,
      })
      .from(pagamentos)
      .innerJoin(pacientes, eq(pagamentos.pacienteId, pacientes.id))
      .innerJoin(users, eq(users.id, pacientes.userId))
      .where(whereClause)
      .orderBy(desc(pagamentos.dataHora))
      .limit(params?.limite ?? 20)
      .offset(params?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pagamentos)
      .innerJoin(pacientes, eq(pagamentos.pacienteId, pacientes.id))
      .innerJoin(users, eq(users.id, pacientes.userId))
      .where(whereClause);

    // Resumo é sempre sobre TODOS os pagamentos do médico — não filtra pelos mesmos
    // parâmetros da lista, senão o card "Recebido" mudaria ao digitar uma busca.
    const [resumo] = await db
      .select({
        totalRecebido: sql<string>`coalesce(sum(${pagamentos.valor}) filter (where ${pagamentos.status} = 'pago'), 0)`,
        totalPendente: sql<string>`coalesce(sum(${pagamentos.valor}) filter (where ${pagamentos.status} = 'pendente'), 0)`,
        quantidadePendente: sql<number>`count(*) filter (where ${pagamentos.status} = 'pendente')::int`,
        quantidadePaga: sql<number>`count(*) filter (where ${pagamentos.status} = 'pago')::int`,
      })
      .from(pagamentos)
      .where(eq(pagamentos.medicoId, medico.medicoId));

    return {
      sucesso: true,
      dados: {
        items,
        total: count,
        resumo: resumo ?? {
          totalRecebido: '0',
          totalPendente: '0',
          quantidadePendente: 0,
          quantidadePaga: 0,
        },
      },
    };
  } catch (error) {
    console.error('[Medico] Erro ao listar pagamentos:', error);
    return { sucesso: false, erro: 'Erro ao listar pagamentos' };
  }
}

// ── Detalhe de um pagamento (só o próprio) ─────────────────────────

export interface PagamentoMedicoDetalhe {
  id: string;
  status: string;
  valor: string;
  moeda: string;
  gatewayProvider: string | null;
  pagoEm: Date | null;
  observacoes: string | null;
  dataHora: Date;
  pacienteNome: string;
  consultaId: string | null;
  iniciadoEm: Date;
  pagamentoIniciadoEm: Date | null;
  pagamentoConcluidoEm: Date | null;
  pagamentoErroEm: Date | null;
  confirmadoEm: Date | null;
  erroConfirmacao: string | null;
}

/**
 * `id` vem da URL (`/medico/pagamentos/[id]`) — por isso o WHERE combina
 * `pagamentos.id` **e** `pagamentos.medicoId` do médico logado na mesma condição.
 * Um médico não pode ler o pagamento de outro só trocando o id na URL.
 */
export async function obterPagamentoMedico(
  id: string,
): Promise<ActionResult<PagamentoMedicoDetalhe>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const [pagamento] = await db
      .select()
      .from(pagamentos)
      .where(and(eq(pagamentos.id, id), eq(pagamentos.medicoId, medico.medicoId)))
      .limit(1);

    if (!pagamento) return { sucesso: false, erro: 'Pagamento não encontrado' };

    const [pacienteRow] = await db
      .select({ nome: users.nome })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, pagamento.pacienteId))
      .limit(1);

    return {
      sucesso: true,
      dados: {
        id: pagamento.id,
        status: pagamento.status,
        valor: pagamento.valor,
        moeda: pagamento.moeda,
        gatewayProvider: pagamento.gatewayProvider,
        pagoEm: pagamento.pagoEm,
        observacoes: pagamento.observacoes,
        dataHora: pagamento.dataHora,
        pacienteNome: pacienteRow?.nome ?? '—',
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
    console.error('[Medico] Erro ao obter pagamento:', error);
    return { sucesso: false, erro: 'Erro ao obter pagamento' };
  }
}

// ── Evolução mensal do recebido (últimos 6 meses) ──────────────────

export interface RecebidoMensal {
  mes: string;
  total: number;
}

export async function obterEvolucaoRecebidosMedico(): Promise<ActionResult<RecebidoMensal[]>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const linhas = await db
      .select({
        chave: sql<string>`to_char(date_trunc('month', ${pagamentos.pagoEm}), 'YYYY-MM')`,
        total: sql<string>`sum(${pagamentos.valor})`,
      })
      .from(pagamentos)
      .where(
        and(
          eq(pagamentos.medicoId, medico.medicoId),
          eq(pagamentos.status, 'pago'),
          sql`${pagamentos.pagoEm} >= date_trunc('month', now()) - interval '5 months'`,
        ),
      )
      .groupBy(sql`date_trunc('month', ${pagamentos.pagoEm})`);

    const porMes = new Map(linhas.map((l) => [l.chave, Number(l.total)]));

    const hoje = new Date();
    const serie: RecebidoMensal[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rotulo = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
      serie.push({
        mes: rotulo.charAt(0).toUpperCase() + rotulo.slice(1),
        total: porMes.get(chave) ?? 0,
      });
    }

    return { sucesso: true, dados: serie };
  } catch (error) {
    console.error('[Medico] Erro ao obter evolução de recebidos:', error);
    return { sucesso: false, erro: 'Erro ao carregar evolução de recebidos' };
  }
}

// ── Distribuição por status (para o donut) ─────────────────────────

export interface StatusDistribuicaoItem {
  status: string;
  quantidade: number;
}

export async function obterDistribuicaoStatusMedico(): Promise<
  ActionResult<StatusDistribuicaoItem[]>
> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const linhas = await db
      .select({ status: pagamentos.status, quantidade: sql<number>`count(*)::int` })
      .from(pagamentos)
      .where(eq(pagamentos.medicoId, medico.medicoId))
      .groupBy(pagamentos.status);

    return { sucesso: true, dados: linhas };
  } catch (error) {
    console.error('[Medico] Erro ao obter distribuição por status:', error);
    return { sucesso: false, erro: 'Erro ao carregar distribuição por status' };
  }
}

// ── Configuração de recebimento (PIX/boleto/cartão) do próprio médico ──

export interface ConfigPagamentoMedicoLogado {
  pixHabilitado: boolean;
  pixTipoChave: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria' | null;
  pixChave: string | null;
  boletoHabilitado: boolean;
  cartaoCreditoHabilitado: boolean;
  cartaoDebitoHabilitado: boolean;
  bancoNome: string | null;
  bancoAgencia: string | null;
  bancoConta: string | null;
  bancoContaTipo: 'corrente' | 'poupanca' | null;
  bancoTitularNome: string | null;
  bancoTitularDocumento: string | null;
  observacoes: string | null;
}

export async function obterConfigPagamentoMedicoLogado(): Promise<
  ActionResult<ConfigPagamentoMedicoLogado>
> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const [config] = await db
      .select()
      .from(medicosPagamentoConfig)
      .where(eq(medicosPagamentoConfig.medicoId, medico.medicoId))
      .limit(1);

    return {
      sucesso: true,
      dados: {
        pixHabilitado: config?.pixHabilitado ?? false,
        pixTipoChave: config?.pixTipoChave ?? null,
        pixChave: config?.pixChave ?? null,
        boletoHabilitado: config?.boletoHabilitado ?? false,
        cartaoCreditoHabilitado: config?.cartaoCreditoHabilitado ?? false,
        cartaoDebitoHabilitado: config?.cartaoDebitoHabilitado ?? false,
        bancoNome: config?.bancoNome ?? null,
        bancoAgencia: config?.bancoAgencia ?? null,
        bancoConta: config?.bancoConta ?? null,
        bancoContaTipo: config?.bancoContaTipo ?? null,
        bancoTitularNome: config?.bancoTitularNome ?? null,
        bancoTitularDocumento: config?.bancoTitularDocumento ?? null,
        observacoes: config?.observacoes ?? null,
      },
    };
  } catch (error) {
    console.error('[Medico] Erro ao obter config de pagamento:', error);
    return { sucesso: false, erro: 'Erro ao carregar configuração' };
  }
}

const salvarConfigPagamentoMedicoLogadoSchema = z
  .object(camposDadosPagamentoMedico)
  .superRefine(validarCoerenciaDadosPagamento);

/**
 * Upsert dos próprios DADOS de recebimento — nunca aceita `medicoId` do cliente, e
 * também não aceita `pixHabilitado`/`boletoHabilitado`/`cartaoXHabilitado`: quem decide
 * o que fica ativo na tela do paciente é o admin (`salvarConfigPagamentoMedico`, em
 * app/(admin)/_actions/pagamentos-medicos.ts). O médico só alimenta o dado; se a linha
 * ainda não existe, o insert nasce com os quatro habilitados em `false` (default da
 * coluna) até o admin revisar e ativar.
 */
export async function salvarConfigPagamentoMedicoLogado(
  dados: z.infer<typeof salvarConfigPagamentoMedicoLogadoSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const parsed = salvarConfigPagamentoMedicoLogadoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [atual] = await db
      .select()
      .from(medicosPagamentoConfig)
      .where(eq(medicosPagamentoConfig.medicoId, medico.medicoId))
      .limit(1);

    if (atual) {
      await db
        .update(medicosPagamentoConfig)
        .set(parsed.data)
        .where(eq(medicosPagamentoConfig.medicoId, medico.medicoId));
    } else {
      await db
        .insert(medicosPagamentoConfig)
        .values({ medicoId: medico.medicoId, ...parsed.data });
    }

    // Dado bancário é sensível e muda de estado — sempre auditado, mesmo sendo o
    // próprio médico alterando os próprios dados (mesmo padrão do admin em
    // app/(admin)/_actions/pagamentos-medicos.ts).
    await registrarAuditoria({
      userId: medico.userId,
      acao: 'atualizar',
      entidade: 'medicos_pagamento_config',
      entidadeId: medico.medicoId,
      dadosAntes: atual ?? undefined,
      dadosDepois: parsed.data,
    });

    revalidatePath('/medico/pagamentos');
    revalidatePath('/medico/pagamentos/config');

    return { sucesso: true };
  } catch (error) {
    console.error('[Medico] Erro ao salvar config de pagamento:', error);
    return { sucesso: false, erro: 'Erro ao salvar configuração' };
  }
}
