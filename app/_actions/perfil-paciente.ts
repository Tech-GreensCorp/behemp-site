'use server';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';

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
