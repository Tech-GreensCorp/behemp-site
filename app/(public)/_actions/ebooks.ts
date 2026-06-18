'use server';

import { db } from '@/lib/db';
import { leadsEbook } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';

const leadEbookSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().min(8, 'Telefone inválido').max(20),
  ebookId: z.string().min(1, 'ID do ebook é obrigatório'),
  ebookTitle: z.string().min(1, 'Título do ebook é obrigatório'),
});

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Salva um novo lead gerado pelo download de um ebook.
 */
export async function salvarLeadEbook(
  dados: z.infer<typeof leadEbookSchema>
): Promise<ActionResult<{ leadId: string }>> {
  try {
    const parsed = leadEbookSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [novo] = await db
      .insert(leadsEbook)
      .values(parsed.data)
      .returning({ id: leadsEbook.id });

    return { sucesso: true, dados: { leadId: novo.id } };
  } catch (error) {
    console.error('[Action] Erro ao salvar lead do ebook:', error);
    return { sucesso: false, erro: 'Erro ao processar o download. Tente novamente.' };
  }
}

/**
 * Lista todos os leads capturados (apenas para administradores).
 */
export async function listarLeadsEbook(): Promise<ActionResult<typeof leadsEbook.$inferSelect[]>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro || 'Acesso não autorizado' };
    }

    const resultado = await db
      .select()
      .from(leadsEbook)
      .orderBy(desc(leadsEbook.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar leads do ebook:', error);
    return { sucesso: false, erro: 'Erro ao listar leads.' };
  }
}
