'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { prescricoes, logsAuditoria } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull } from 'drizzle-orm';
import { addDays } from 'date-fns';

// Schema de criação de prescrição
const criarPrescricaoSchema = z.object({
  pacienteId: z.string().min(1),
  consultaId: z.string().optional(),
  templateId: z.string().optional(),
  tipo: z.enum(['simples', 'controle_especial', 'personalizado']).default('simples'),
  medicamentos: z.array(z.object({
    nome: z.string().min(1),
    dose: z.string().optional(),
    forma: z.string().optional(),
    posologia: z.string().optional(),
    quantidade: z.string().optional(),
  })).min(1, 'Pelo menos um medicamento é obrigatório'),
  diagnostico: z.string().optional(),
  cid: z.string().optional(),
  observacoes: z.string().optional(),
  orientacoes: z.string().optional(),
  validadeDias: z.number().default(30),
}).strict();

export async function criarPrescricao(input: unknown) {
  // 1. Auth
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  // 2. Validar
  const parsed = criarPrescricaoSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

  // 3. Buscar medicoId pelo clerkId
  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id, userId: users.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  // 4. Verificar que paciente pertence ao médico
  const { pacientes } = await import('@/db/schema');
  const [paciente] = await db
    .select({ id: pacientes.id, patologia: pacientes.patologia })
    .from(pacientes)
    .where(and(eq(pacientes.id, parsed.data.pacienteId), eq(pacientes.medicoId, medico.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!paciente) return { sucesso: false, erro: 'Paciente não encontrado' };

  // 5. Criar prescrição
  const validade = addDays(new Date(), parsed.data.validadeDias);
  const [prescricao] = await db.insert(prescricoes).values({
    medicoId: medico.id,
    pacienteId: parsed.data.pacienteId,
    consultaId: parsed.data.consultaId,
    templateId: parsed.data.templateId,
    tipo: parsed.data.tipo,
    status: 'emitida',
    medicamentos: parsed.data.medicamentos,
    diagnostico: parsed.data.diagnostico,
    cid: parsed.data.cid,
    observacoes: parsed.data.observacoes,
    orientacoes: parsed.data.orientacoes,
    validade,
  }).returning();

  // Desbloqueio ANVISA após prescrição emitida
  try {
    const { autorizacoesAnvisa, notificacoes } = await import('@/db/schema');
    const [autorizacao] = await db
      .select({ id: autorizacoesAnvisa.id, documentos: autorizacoesAnvisa.documentos })
      .from(autorizacoesAnvisa)
      .where(
        and(
          eq(autorizacoesAnvisa.pacienteId, prescricao.pacienteId),
          eq(autorizacoesAnvisa.status, 'pendente'),
          isNull(autorizacoesAnvisa.deletedAt),
        ),
      )
      .limit(1);

    if (autorizacao) {
      // Atualizar item receita_medica no checklist
      const docs = (autorizacao.documentos as { tipo: string; enviado: boolean; validado?: boolean }[]) ?? [];
      const docsAtualizados = docs.map((d) =>
        d.tipo === 'receita_medica'
          ? { ...d, enviado: true, validado: true }
          : d
      );

      await db.update(autorizacoesAnvisa)
        .set({ documentos: docsAtualizados })
        .where(eq(autorizacoesAnvisa.id, autorizacao.id));

      // Notificar paciente que ANVISA foi desbloqueada
      const [pacienteUser] = await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .where(eq(pacientes.id, prescricao.pacienteId))
        .limit(1);

      if (pacienteUser) {
        await db.insert(notificacoes).values({
          userId: pacienteUser.userId,
          tipo: 'geral',
          titulo: '📋 Prescrição disponível',
          mensagem: 'Sua prescrição médica foi emitida. Acesse o portal para dar início à autorização ANVISA.',
          lida: false,
          linkAcao: '/paciente/anvisa',
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Prescrição] Erro ao atualizar ANVISA:', err);
  }

  // 6. Auditoria
  await db.insert(logsAuditoria).values({
    userId: medico.userId,
    acao: 'CRIAR',
    entidade: 'prescricoes',
    entidadeId: prescricao.id,
    dadosDepois: prescricao,
    ip: 'SERVER_ACTION', // ou coletar via headers se possível
  }).catch((e) => console.error('Erro na auditoria:', e));

  // 7. Revalidar
  revalidatePath(`/medico/pacientes/${parsed.data.pacienteId}`);

  return { sucesso: true, dados: prescricao };
}

export async function listarPrescricoesPaciente(pacienteId: string) {
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  const lista = await db
    .select()
    .from(prescricoes)
    .where(and(
      eq(prescricoes.pacienteId, pacienteId),
      eq(prescricoes.medicoId, medico.id),
      isNull(prescricoes.deletedAt)
    ))
    .orderBy(prescricoes.createdAt);

  return { sucesso: true, dados: lista };
}
