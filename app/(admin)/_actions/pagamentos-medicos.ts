'use server';

import { db } from '@/lib/db';
import { medicos, medicosPagamentoConfig, users } from '@/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { revalidatePath } from 'next/cache';
import {
  camposConfigPagamentoMedico,
  validarRegrasConfigPagamento,
} from '@/lib/pagamentos/validacao-config-pagamento';

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

export interface MedicoConfigPagamentoListItem {
  medicoId: string;
  nome: string;
  avatarUrl: string | null;
  especialidade: string;
  configurado: boolean;
}

/**
 * Lista médicos com o status da configuração de meios de pagamento — "configurado" só
 * quando existe linha em `medicos_pagamento_config` com pelo menos um método habilitado.
 */
export async function listarMedicosComConfigPagamento(): Promise<
  ActionResult<MedicoConfigPagamentoListItem[]>
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select({
        medicoId: medicos.id,
        nome: users.nome,
        avatarUrl: users.avatarUrl,
        especialidade: medicos.especialidade,
        pixHabilitado: medicosPagamentoConfig.pixHabilitado,
        boletoHabilitado: medicosPagamentoConfig.boletoHabilitado,
        cartaoCreditoHabilitado: medicosPagamentoConfig.cartaoCreditoHabilitado,
        cartaoDebitoHabilitado: medicosPagamentoConfig.cartaoDebitoHabilitado,
      })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .leftJoin(medicosPagamentoConfig, eq(medicosPagamentoConfig.medicoId, medicos.id))
      .where(isNull(users.deletedAt))
      .orderBy(users.nome);

    const lista: MedicoConfigPagamentoListItem[] = resultado.map((m) => ({
      medicoId: m.medicoId,
      nome: m.nome,
      avatarUrl: m.avatarUrl,
      especialidade: m.especialidade,
      configurado: Boolean(
        m.pixHabilitado ||
          m.boletoHabilitado ||
          m.cartaoCreditoHabilitado ||
          m.cartaoDebitoHabilitado,
      ),
    }));

    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Admin] Erro ao listar médicos com config de pagamento:', error);
    return { sucesso: false, erro: 'Erro ao carregar médicos' };
  }
}

export interface ConfigPagamentoMedico {
  medicoId: string;
  medicoNome: string;
  especialidade: string;
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

/** Config de um médico específico — cria o "esqueleto" (tudo desabilitado) se ainda não existir linha. */
export async function obterConfigPagamentoMedico(
  medicoId: string,
): Promise<ActionResult<ConfigPagamentoMedico>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [medicoRow] = await db
      .select({ nome: users.nome, especialidade: medicos.especialidade })
      .from(medicos)
      .innerJoin(users, eq(medicos.userId, users.id))
      .where(eq(medicos.id, medicoId))
      .limit(1);

    if (!medicoRow) return { sucesso: false, erro: 'Médico não encontrado' };

    const [config] = await db
      .select()
      .from(medicosPagamentoConfig)
      .where(eq(medicosPagamentoConfig.medicoId, medicoId))
      .limit(1);

    return {
      sucesso: true,
      dados: {
        medicoId,
        medicoNome: medicoRow.nome,
        especialidade: medicoRow.especialidade,
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
    console.error('[Admin] Erro ao obter config de pagamento do médico:', error);
    return { sucesso: false, erro: 'Erro ao carregar configuração' };
  }
}

const salvarConfigPagamentoMedicoSchema = z
  .object(camposConfigPagamentoMedico)
  .superRefine(validarRegrasConfigPagamento);

/**
 * Cria ou atualiza (upsert) a configuração de meios de pagamento de um médico.
 *
 * `medicoId` é o PRIMEIRO parâmetro (não um campo dentro de `dados`) de propósito: a
 * página o passa via `salvarConfigPagamentoMedico.bind(null, medicoId)`, porque uma
 * function comum não atravessa a fronteira Server → Client Component (só uma Server
 * Action, ou o bind de uma, atravessa) — e o bind também impede o client de trocar o
 * médico afetado, já que o valor fica fixado no fechamento assinado pelo servidor.
 */
export async function salvarConfigPagamentoMedico(
  medicoId: string,
  dados: z.infer<typeof salvarConfigPagamentoMedicoSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    if (!medicoId) return { sucesso: false, erro: 'Médico inválido' };

    const parsed = salvarConfigPagamentoMedicoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const valores = parsed.data;

    const [medicoExiste] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.id, medicoId))
      .limit(1);
    if (!medicoExiste) return { sucesso: false, erro: 'Médico não encontrado' };

    const [atual] = await db
      .select()
      .from(medicosPagamentoConfig)
      .where(eq(medicosPagamentoConfig.medicoId, medicoId))
      .limit(1);

    if (atual) {
      await db
        .update(medicosPagamentoConfig)
        .set(valores)
        .where(eq(medicosPagamentoConfig.medicoId, medicoId));
    } else {
      await db.insert(medicosPagamentoConfig).values({ medicoId, ...valores });
    }

    const userIdInterno = await obterUserIdInterno(auth.clerkId);
    if (userIdInterno) {
      await registrarAuditoria({
        userId: userIdInterno,
        acao: 'atualizar',
        entidade: 'medicos_pagamento_config',
        entidadeId: medicoId,
        dadosAntes: atual ?? undefined,
        dadosDepois: valores,
      });
    }

    revalidatePath('/admin/pagamentos/medicos');
    revalidatePath(`/admin/pagamentos/medicos/${medicoId}`);

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao salvar config de pagamento do médico:', error);
    return { sucesso: false, erro: 'Erro ao salvar configuração' };
  }
}
