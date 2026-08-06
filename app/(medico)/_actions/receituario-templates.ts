'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { receituarioTemplates, logsAuditoria } from '@/db/schema';
import { verificarMedico } from '@/lib/auth/permissions';
import { redirect } from 'next/navigation';
import { eq, and, isNull } from 'drizzle-orm';

// Schemas Zod para templates
const criarTemplateSchema = z.object({
  nome: z.string().min(1, 'Nome do template é obrigatório'),
  tipo: z.enum(['simples', 'controle_especial', 'personalizado']).default('simples'),
  padrao: z.boolean().default(false),
  config: z.any().optional(),
  layoutHtml: z.string().optional(),
});

const atualizarTemplateSchema = criarTemplateSchema.partial().extend({
  id: z.string(),
});

export async function listarTemplatesMedico() {
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
    .from(receituarioTemplates)
    .where(
      and(
        eq(receituarioTemplates.medicoId, medico.id),
        eq(receituarioTemplates.ativo, true),
        isNull(receituarioTemplates.deletedAt)
      )
    )
    .orderBy(receituarioTemplates.nome);

  return { sucesso: true, dados: lista };
}

export async function criarTemplate(input: unknown) {
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const parsed = criarTemplateSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id, userId: users.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  const [template] = await db.insert(receituarioTemplates).values({
    medicoId: medico.id,
    nome: parsed.data.nome,
    tipo: parsed.data.tipo,
    padrao: parsed.data.padrao,
    config: parsed.data.config,
    layoutHtml: parsed.data.layoutHtml,
  }).returning();

  // Auditoria
  await db.insert(logsAuditoria).values({
    userId: medico.userId,
    acao: 'CRIAR',
    entidade: 'receituario_templates',
    entidadeId: template.id,
    dadosDepois: template,
    ip: 'SERVER_ACTION',
  }).catch(() => {});

  revalidatePath('/medico/receituarios');
  return { sucesso: true, dados: template };
}

export async function atualizarTemplate(input: unknown) {
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const parsed = atualizarTemplateSchema.safeParse(input);
  if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

  const { id, ...updates } = parsed.data;

  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id, userId: users.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  // Verifica dono do template
  const [templateExistente] = await db.select().from(receituarioTemplates)
    .where(and(eq(receituarioTemplates.id, id), eq(receituarioTemplates.medicoId, medico.id), isNull(receituarioTemplates.deletedAt)))
    .limit(1);
    
  if (!templateExistente) return { sucesso: false, erro: 'Template não encontrado ou sem permissão' };

  const [template] = await db.update(receituarioTemplates)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(receituarioTemplates.id, id))
    .returning();

  // Auditoria
  await db.insert(logsAuditoria).values({
    userId: medico.userId,
    acao: 'ATUALIZAR',
    entidade: 'receituario_templates',
    entidadeId: template.id,
    dadosAntes: templateExistente,
    dadosDepois: template,
    ip: 'SERVER_ACTION',
  }).catch(() => {});

  revalidatePath('/medico/receituarios');
  return { sucesso: true, dados: template };
}

export async function excluirTemplate(id: string) {
  const perm = await verificarMedico();
  if (!perm.autorizado || !perm.clerkId) redirect('/entrar');

  const { users, medicos } = await import('@/db/schema');
  const [medico] = await db
    .select({ id: medicos.id, userId: users.id })
    .from(medicos)
    .innerJoin(users, eq(medicos.userId, users.id))
    .where(eq(users.clerkId, perm.clerkId))
    .limit(1);
  if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

  const [templateExistente] = await db.select().from(receituarioTemplates)
    .where(and(eq(receituarioTemplates.id, id), eq(receituarioTemplates.medicoId, medico.id), isNull(receituarioTemplates.deletedAt)))
    .limit(1);
    
  if (!templateExistente) return { sucesso: false, erro: 'Template não encontrado ou sem permissão' };

  // Soft delete
  await db.update(receituarioTemplates)
    .set({ deletedAt: new Date(), ativo: false })
    .where(eq(receituarioTemplates.id, id));

  // Auditoria
  await db.insert(logsAuditoria).values({
    userId: medico.userId,
    acao: 'EXCLUIR',
    entidade: 'receituario_templates',
    entidadeId: id,
    dadosAntes: templateExistente,
    ip: 'SERVER_ACTION',
  }).catch(() => {});

  revalidatePath('/medico/receituarios');
  return { sucesso: true };
}
