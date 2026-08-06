'use server';

import { z } from 'zod';
import { db } from '@/lib/db';
import { autorizacoesAnvisa, logsAuditoria } from '@/db/schema';
import { verificarPaciente } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull, desc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { addBusinessDays, format } from 'date-fns';

// ── Iniciar processo ANVISA ────────────────────────────────────
export async function iniciarAutorizacaoAnvisa(prescricaoId?: string) {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const { users, pacientes, prescricoes } = await import('@/db/schema');

  // 1. Buscar user
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

  // 2. Buscar paciente
  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  // 3. GUARD — verificar se tem prescrição válida (emitida ou assinada)
  let prescricao: { id: string; medicoId: string; status: string } | undefined;

  if (prescricaoId) {
    const [presc] = await db
      .select({ id: prescricoes.id, medicoId: prescricoes.medicoId, status: prescricoes.status })
      .from(prescricoes)
      .where(
        and(
          eq(prescricoes.id, prescricaoId),
          eq(prescricoes.pacienteId, paciente.id),
          inArray(prescricoes.status, ['emitida', 'assinada']),
          isNull(prescricoes.deletedAt),
        ),
      )
      .limit(1);
    prescricao = presc;
  } else {
    // Buscar prescrição mais recente válida
    const [presc] = await db
      .select({ id: prescricoes.id, medicoId: prescricoes.medicoId, status: prescricoes.status })
      .from(prescricoes)
      .where(
        and(
          eq(prescricoes.pacienteId, paciente.id),
          inArray(prescricoes.status, ['emitida', 'assinada']),
          isNull(prescricoes.deletedAt),
        ),
      )
      .orderBy(desc(prescricoes.createdAt))
      .limit(1);
    prescricao = presc;
  }

  // BLOQUEIO — sem prescrição válida, não pode iniciar
  if (!prescricao) {
    return {
      sucesso: false,
      erro: 'sem_prescricao',
      mensagem: 'Você precisa ter uma consulta realizada e uma prescrição emitida pelo seu médico antes de iniciar o processo ANVISA.',
    };
  }

  // 4. Verificar se já existe processo em aberto para esta prescrição
  const [existente] = await db
    .select({ id: autorizacoesAnvisa.id, status: autorizacoesAnvisa.status })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.prescricaoId, prescricao.id),
        eq(autorizacoesAnvisa.pacienteId, paciente.id),
        isNull(autorizacoesAnvisa.deletedAt),
      ),
    )
    .limit(1);
  if (existente) return { sucesso: true, dados: existente };

  // 5. Checklist inicial
  const checklistInicial = [
    { tipo: 'receita_medica', enviado: false, validado: false, urlBlob: null, nomeArquivo: null },
    { tipo: 'rg_paciente', enviado: false, validado: false, urlBlob: null, nomeArquivo: null },
    { tipo: 'comprovante_residencia', enviado: false, validado: false, urlBlob: null, nomeArquivo: null },
  ];

  // 6. Criar autorização com medicoId e prescricaoId da prescrição real
  const [autorizacao] = await db
    .insert(autorizacoesAnvisa)
    .values({
      pacienteId: paciente.id,
      medicoId: prescricao.medicoId,
      prescricaoId: prescricao.id,
      status: 'pendente',
      documentos: checklistInicial,
    })
    .returning();

  await db
    .insert(logsAuditoria)
    .values({
      acao: 'CRIAR',
      entidade: 'autorizacoes_anvisa',
      entidadeId: autorizacao.id,
    })
    .catch(() => {});

  revalidatePath('/paciente/anvisa');
  return { sucesso: true, dados: autorizacao };
}

// ── Listar autorizações do paciente ───────────────────────────
export async function listarAutorizacoesAnvisa() {
  const perm = await verificarPaciente();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const { users, pacientes } = await import('@/db/schema');

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!user) return { sucesso: false, erro: 'Usuário não encontrado' } as const;

  const [paciente] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' } as const;

  const lista = await db
    .select()
    .from(autorizacoesAnvisa)
    .where(and(eq(autorizacoesAnvisa.pacienteId, paciente.id), isNull(autorizacoesAnvisa.deletedAt)))
    .orderBy(autorizacoesAnvisa.createdAt);

  return { sucesso: true, dados: lista } as const;
}

// ── Definir modalidade da autorização ─────────────────────────
export async function definirModalidadeAnvisa(
  autorizacaoId: string,
  modalidade: 'guiada' | 'representacao',
) {
  const perm = await verificarPaciente();
  if (!perm.autorizado) redirect('/entrar');

  // Verificar que pertence ao paciente autenticado
  const { users, pacientes } = await import('@/db/schema');
  const [user] = await db.select({ id: users.id }).from(users)
    .where(eq(users.clerkId, perm.clerkId!)).limit(1);
  if (!user) return { sucesso: false, erro: 'Não autorizado' };

  const [paciente] = await db.select({ id: pacientes.id }).from(pacientes)
    .where(and(eq(pacientes.userId, user.id), isNull(pacientes.deletedAt))).limit(1);
  if (!paciente) return { sucesso: false, erro: 'Não autorizado' };

  const [autorizacao] = await db.select({ id: autorizacoesAnvisa.id })
    .from(autorizacoesAnvisa)
    .where(and(
      eq(autorizacoesAnvisa.id, autorizacaoId),
      eq(autorizacoesAnvisa.pacienteId, paciente.id),
      isNull(autorizacoesAnvisa.deletedAt),
    )).limit(1);
  if (!autorizacao) return { sucesso: false, erro: 'Autorização não encontrada' };

  if (modalidade === 'representacao') {
    const [autorizacaoAtual] = await db
      .select({ documentos: autorizacoesAnvisa.documentos })
      .from(autorizacoesAnvisa)
      .where(eq(autorizacoesAnvisa.id, autorizacaoId))
      .limit(1);

    const docsExistentes = (autorizacaoAtual?.documentos as { tipo: string }[]) ?? [];
    const tiposExistentes = new Set(docsExistentes.map((d: any) => d.tipo));

    const novosItens = [];
    if (!tiposExistentes.has('procuracao_especifica')) {
      novosItens.push({ tipo: 'procuracao_especifica', enviado: false, validado: false, urlBlob: null, nomeArquivo: null });
    }
    if (!tiposExistentes.has('laudo_medico')) {
      novosItens.push({ tipo: 'laudo_medico', enviado: false, validado: false, urlBlob: null, nomeArquivo: null });
    }

    if (novosItens.length > 0) {
      await db.update(autorizacoesAnvisa)
        .set({ modalidade, documentos: [...docsExistentes, ...novosItens] })
        .where(eq(autorizacoesAnvisa.id, autorizacaoId));
    } else {
      await db.update(autorizacoesAnvisa)
        .set({ modalidade })
        .where(eq(autorizacoesAnvisa.id, autorizacaoId));
    }
  } else {
    await db.update(autorizacoesAnvisa)
      .set({ modalidade })
      .where(eq(autorizacoesAnvisa.id, autorizacaoId));
  }

  await db.insert(logsAuditoria).values({
    acao: 'DEFINIR_MODALIDADE',
    entidade: 'autorizacoes_anvisa',
    entidadeId: autorizacaoId,
  }).catch(() => {});

  revalidatePath('/paciente/anvisa');
  return { sucesso: true };
}

// ── Salvar formulário 8833 ────────────────────────────────────
const formularioSchema = z
  .object({
    autorizacaoId: z.string().min(1),
    campos: z.record(z.string()),
  })
  .strict();

export async function salvarFormulario8833(input: unknown) {
  const perm = await verificarPaciente();
  if (!perm.autorizado) redirect('/entrar');

  const parsed = formularioSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

  await db
    .update(autorizacoesAnvisa)
    .set({ formulario8833: parsed.data.campos })
    .where(eq(autorizacoesAnvisa.id, parsed.data.autorizacaoId));

  revalidatePath('/paciente/anvisa');
  return { sucesso: true };
}

// ── Confirmar envio à ANVISA ──────────────────────────────────
export async function confirmarEnvioAnvisa(autorizacaoId: string) {
  const perm = await verificarPaciente();
  if (!perm.autorizado) redirect('/entrar');

  const prazoEstimado = format(addBusinessDays(new Date(), 10), 'yyyy-MM-dd');

  await db
    .update(autorizacoesAnvisa)
    .set({
      status: 'documentos_enviados',
      dataEnvio: new Date(),
      prazoEstimado,
    })
    .where(eq(autorizacoesAnvisa.id, autorizacaoId));

  await db
    .insert(logsAuditoria)
    .values({
      acao: 'ENVIAR',
      entidade: 'autorizacoes_anvisa',
      entidadeId: autorizacaoId,
    })
    .catch(() => {});

  revalidatePath('/paciente/anvisa');
  return { sucesso: true, dados: { prazoEstimado } };
}
