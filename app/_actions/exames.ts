'use server';

import { db } from '@/lib/db';
import { exames } from '@/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { put } from '@vercel/blob';

const criarExameSchema = z.object({
  pacienteId: z.string().min(1),
  nomeExame: z.string().min(1, 'Nome do exame é obrigatório'),
  dataExame: z.string().min(1, 'Data do exame é obrigatória'),
  observacoes: z.string().optional(),
});

export async function criarExame(formData: FormData) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const dados = {
      pacienteId: formData.get('pacienteId') as string,
      nomeExame: formData.get('nomeExame') as string,
      dataExame: formData.get('dataExame') as string,
      observacoes: formData.get('observacoes') as string,
    };

    const parsed = criarExameSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    let urlArquivo: string | null = null;
    let nomeArquivo: string | null = null;

    const file = formData.get('arquivo') as File;
    if (file && file.size > 0) {
      if (file.size > 10 * 1024 * 1024) return { sucesso: false, erro: 'Arquivo excede 10MB' };
      const blob = await put(`exames/${parsed.data.pacienteId}/${Date.now()}-${file.name}`, file, { access: 'public' });
      urlArquivo = blob.url;
      nomeArquivo = file.name;
    }

    const [exame] = await db.insert(exames).values({
      pacienteId: parsed.data.pacienteId,
      nomeExame: parsed.data.nomeExame,
      dataExame: parsed.data.dataExame,
      observacoes: parsed.data.observacoes || null,
      urlArquivo,
      nomeArquivo,
    }).returning();

    return { sucesso: true, dados: exame };
  } catch (error) {
    console.error('[Action] Erro ao criar exame:', error);
    return { sucesso: false, erro: 'Erro ao criar exame' };
  }
}

export async function listarExames(pacienteId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };
    const lista = await db.select().from(exames)
      .where(and(eq(exames.pacienteId, pacienteId), isNull(exames.deletedAt)))
      .orderBy(desc(exames.dataExame));
    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Action] Erro ao listar exames:', error);
    return { sucesso: false, erro: 'Erro ao listar exames' };
  }
}

/**
 * Exclui um exame via soft delete.
 * O arquivo no Blob Storage é mantido para fins de auditoria.
 */
export async function excluirExame(exameId: string) {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    await db
      .update(exames)
      .set({ deletedAt: new Date() })
      .where(and(eq(exames.id, exameId), isNull(exames.deletedAt)));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao excluir exame:', error);
    return { sucesso: false, erro: 'Erro ao excluir exame' };
  }
}
