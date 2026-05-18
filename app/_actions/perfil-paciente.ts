'use server';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';
import { z } from 'zod';

/**
 * Retorna nome, email e telefone do paciente autenticado
 * para pré-preencher formulários (ex: recompra).
 */
export async function obterPerfilContato(): Promise<{
  sucesso: boolean;
  dados?: { nome: string; email: string; telefone: string | null };
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const [user] = await db
      .select({ nome: users.nome, email: users.email, telefone: users.telefone })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

    return { sucesso: true, dados: { nome: user.nome, email: user.email, telefone: user.telefone } };
  } catch (error) {
    console.error('[Action] Erro ao obter perfil de contato:', error);
    return { sucesso: false, erro: 'Erro ao carregar perfil' };
  }
}

const telefoneSchema = z.object({
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s\(\)\-\+]{8,20}$/, 'Telefone inválido. Use apenas números, espaços e os caracteres ( ) - +')
    .or(z.literal('')),
});

/**
 * Atualiza o telefone do usuário autenticado diretamente na tabela users.
 * Não depende do Clerk — funciona no plano gratuito.
 */
export async function atualizarTelefonePaciente(telefone: string): Promise<{
  sucesso: boolean;
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const parsed = telefoneSchema.safeParse({ telefone });
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const telefoneFinal = parsed.data.telefone === '' ? null : parsed.data.telefone;

    await db
      .update(users)
      .set({ telefone: telefoneFinal })
      .where(eq(users.clerkId, auth.clerkId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar telefone:', error);
    return { sucesso: false, erro: 'Erro ao salvar telefone' };
  }
}
