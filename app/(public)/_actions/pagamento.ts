'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { consultas, pacientes, users } from '@/db/schema';
import { verificarPaciente } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  criarCobranca,
  type MotivoDaFalha,
  type StatusLocalDoPagamento,
} from '@/lib/mercadopago/cobranca';

/**
 * INICIAR A COBRANÇA — a action que o Payment Brick chama no `onSubmit` (Parte 2, Fase 2).
 *
 * 🔴 ESTE ARQUIVO É `'use server'`: tudo que ele exporta é endpoint público. Por isso a action
 * só confere identidade e posse — sessão de paciente, paciente cadastrado, consulta DELE — e
 * delega. O que cobra mora em `lib/mercadopago/cobranca.ts`, que não é exportado daqui.
 *
 * O que NÃO vem do cliente: o valor (sai de `pagamentos.valor`), o médico (sai da consulta) e
 * o pagador do PIX (sai do cadastro). Do cliente vem só a escolha do meio e, no cartão, o que
 * o Brick tokenizou.
 */

const esquemaCartao = z.object({
  token: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1).max(40),
  issuerId: z
    .union([z.string().max(40), z.number().int()])
    .optional()
    .nullable(),
  installments: z.number().int().min(1).max(12),
  payer: z.object({
    email: z.string().email().max(254),
    identification: z
      .object({ type: z.string().min(1).max(10), number: z.string().min(1).max(20) })
      .optional()
      .nullable(),
  }),
});

const esquemaEntrada = z
  .object({
    consultaId: z.string().min(1).max(64),
    metodo: z.enum(['pix', 'cartao']),
    dadosCartao: esquemaCartao.optional(),
  })
  .refine((d) => d.metodo !== 'cartao' || d.dadosCartao !== undefined, {
    message: 'Dados do cartão ausentes',
  });

export type EntradaIniciarCobranca = z.input<typeof esquemaEntrada>;

export type ResultadoIniciarCobranca =
  | {
      sucesso: true;
      dados: {
        status: StatusLocalDoPagamento;
        statusMp: string;
        statusDetailMp: string | null;
        pix?: { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; validoAte: string };
      };
    }
  | { sucesso: false; erro: string; motivo?: MotivoDaFalha };

export async function iniciarCobranca(
  entrada: EntradaIniciarCobranca,
): Promise<ResultadoIniciarCobranca> {
  const parsed = esquemaEntrada.safeParse(entrada);
  if (!parsed.success) {
    return { sucesso: false, erro: 'Dados de pagamento inválidos.' };
  }
  const { consultaId, metodo, dadosCartao } = parsed.data;

  const auth = await verificarPaciente();
  if (!auth.autorizado || !auth.clerkId) {
    return { sucesso: false, erro: 'Autenticação necessária para pagar.' };
  }

  const [userInterno] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, auth.clerkId))
    .limit(1);
  if (!userInterno) {
    return { sucesso: false, erro: 'Usuário não encontrado no sistema.' };
  }

  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, userInterno.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) {
    return { sucesso: false, erro: 'Seu cadastro de paciente não foi encontrado.' };
  }

  // Posse: a consulta tem de ser DESTE paciente. "Não existe" e "não é sua" respondem igual —
  // responder diferente viraria oráculo de enumeração de consultas.
  const [consulta] = await db
    .select({ id: consultas.id, medicoId: consultas.medicoId })
    .from(consultas)
    .where(
      and(
        eq(consultas.id, consultaId),
        eq(consultas.pacienteId, paciente.id),
        isNull(consultas.deletedAt),
      ),
    )
    .limit(1);
  if (!consulta) {
    return { sucesso: false, erro: 'Reserva não encontrada.' };
  }

  try {
    const resultado = await criarCobranca(
      consulta.id,
      consulta.medicoId,
      userInterno.id,
      metodo,
      dadosCartao
        ? {
            ...dadosCartao,
            issuerId: dadosCartao.issuerId == null ? null : String(dadosCartao.issuerId),
          }
        : undefined,
    );

    if (!resultado.ok) {
      return { sucesso: false, erro: resultado.mensagem, motivo: resultado.motivo };
    }

    revalidatePath('/admin/pagamentos');
    return {
      sucesso: true,
      dados: {
        status: resultado.status,
        statusMp: resultado.statusMp,
        statusDetailMp: resultado.statusDetailMp,
        ...(resultado.pix
          ? { pix: { ...resultado.pix, validoAte: resultado.pix.validoAte.toISOString() } }
          : {}),
      },
    };
  } catch (erro) {
    console.error('[Action] Erro ao iniciar cobrança:', erro);
    return { sucesso: false, erro: 'Erro interno ao processar o pagamento.' };
  }
}
