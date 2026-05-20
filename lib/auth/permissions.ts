/**
 * Helpers de autenticação e permissão — integração com Clerk.
 *
 * Usa auth() do @clerk/nextjs/server para verificar autenticação e roles.
 * O role do usuário é armazenado em publicMetadata.role no Clerk.
 *
 * Regras (CLAUDE.md):
 * - admin: acesso global (exceto dados clínicos sem necessidade)
 * - medico: acesso apenas aos próprios pacientes
 * - paciente: acesso apenas aos próprios dados
 */

import { auth, currentUser } from '@clerk/nextjs/server';
import { clerkClient } from '@clerk/nextjs/server';

export type Role = 'admin' | 'medico' | 'paciente';

/**
 * Resultado de uma verificação de permissão.
 */
interface PermissaoResult {
  autorizado: boolean;
  role?: Role;
  userId?: string;
  clerkId?: string;
  erro?: string;
}

/**
 * Obtém o usuário autenticado e seu role via Clerk.
 */
export async function obterUsuarioAtual(): Promise<PermissaoResult> {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return { autorizado: false, erro: 'Não autenticado' };
  }

  const role = (sessionClaims?.metadata as { role?: Role } | undefined)?.role;

  return {
    autorizado: true,
    role: role || 'paciente',
    clerkId: userId,
  };
}

/**
 * Obtém dados completos do usuário Clerk (nome, email, etc).
 */
export async function obterDadosUsuario() {
  const user = await currentUser();

  if (!user) {
    return null;
  }

  // Tenta buscar o nome na tabela users do banco (mais confiável que o Clerk)
  let nomeDb: string | null = null;
  try {
    const { db } = await import('@/lib/db');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [registro] = await db
      .select({ nome: users.nome })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (registro?.nome) {
      nomeDb = registro.nome;
    }
  } catch {
    // Se falhar, usa o fallback do Clerk abaixo
  }

  // Fallback: firstName + lastName do Clerk, ou email (parte antes do @)
  const nomeClerk = `${user.firstName || ''} ${user.lastName || ''}`.trim();
  const email = user.emailAddresses[0]?.emailAddress || '';
  const nomeEmail = email.split('@')[0]?.replace(/[._-]/g, ' ') || '';

  const nome = nomeDb || nomeClerk || nomeEmail || 'Usuário';

  return {
    clerkId: user.id,
    nome,
    email,
    avatarUrl: user.imageUrl,
    role: (user.publicMetadata?.role as Role) || 'paciente',
  };
}

/**
 * Verifica se o usuário tem um dos roles permitidos.
 */
export async function verificarRole(
  rolesPermitidos: Role[],
): Promise<PermissaoResult> {
  const usuario = await obterUsuarioAtual();

  if (!usuario.autorizado || !usuario.role) {
    return { autorizado: false, erro: 'Não autenticado' };
  }

  if (!rolesPermitidos.includes(usuario.role)) {
    return {
      autorizado: false,
      role: usuario.role,
      clerkId: usuario.clerkId,
      erro: `Acesso negado. Role necessário: ${rolesPermitidos.join(' ou ')}`,
    };
  }

  return usuario;
}

/**
 * Verifica se é admin.
 */
export async function verificarAdmin(): Promise<PermissaoResult> {
  return verificarRole(['admin']);
}

/**
 * Verifica se é médico.
 */
export async function verificarMedico(): Promise<PermissaoResult> {
  return verificarRole(['medico']);
}

/**
 * Verifica se é paciente.
 */
export async function verificarPaciente(): Promise<PermissaoResult> {
  return verificarRole(['paciente']);
}

/**
 * Verifica se é médico ou admin.
 */
export async function verificarMedicoOuAdmin(): Promise<PermissaoResult> {
  return verificarRole(['medico', 'admin']);
}

/**
 * Verifica se o usuário está autenticado (qualquer role).
 * Retorna { clerkId, role } ou null se não autenticado.
 */
export async function verificarUsuarioAutenticado(): Promise<{ clerkId: string; role: Role } | null> {
  const usuario = await obterUsuarioAtual();
  if (!usuario.autorizado || !usuario.clerkId) return null;
  return { clerkId: usuario.clerkId, role: usuario.role ?? 'paciente' };
}

/**
 * Obtém o role do usuário com fallback robusto.
 *
 * Estratégia (em ordem de prioridade):
 * 1. publicMetadata.role do Clerk (caso nominal)
 * 2. Banco de dados (fallback para quando webhook não disparou)
 * 3. Default 'paciente' (toda conta nova é paciente)
 *
 * Quando o fallback 2 ou 3 é usado, tenta sincronizar o role de volta
 * no publicMetadata do Clerk para que da próxima vez funcione direto.
 *
 * Uso em layouts protegidos:
 * ```ts
 * const { user, role } = await obterRoleComFallback();
 * if (!user || role !== 'paciente') redirect('/');
 * ```
 */
export async function obterRoleComFallback(): Promise<{
  user: Awaited<ReturnType<typeof currentUser>>;
  role: Role;
}> {
  const user = await currentUser();

  if (!user) {
    return { user: null, role: 'paciente' };
  }

  // Estratégia 1: publicMetadata.role do Clerk
  const clerkRole = user.publicMetadata?.role as Role | undefined;
  if (clerkRole) {
    return { user, role: clerkRole };
  }

  // Estratégia 2: buscar no banco de dados
  let roleEfetivo: Role = 'paciente'; // default
  let precisaSincronizar = true;

  try {
    const { db } = await import('@/lib/db');
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');

    const [registro] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.clerkId, user.id))
      .limit(1);

    if (registro?.role) {
      roleEfetivo = registro.role as Role;
      console.log(
        `[Auth] Role via banco para clerkId ${user.id}: ${roleEfetivo}`,
      );
    } else {
      console.warn(
        `[Auth] Nenhum registro no banco para clerkId ${user.id} — usando default 'paciente'`,
      );
    }
  } catch (dbError) {
    console.error('[Auth] Erro ao buscar role no banco:', dbError);
    precisaSincronizar = false; // não sincronizar se o banco falhou
  }

  // Sincronizar o role no publicMetadata do Clerk (fire-and-forget)
  if (precisaSincronizar) {
    try {
      const client = await clerkClient();
      await client.users.updateUserMetadata(user.id, {
        publicMetadata: { role: roleEfetivo },
      });
      console.log(
        `[Auth] ✅ publicMetadata.role='${roleEfetivo}' sincronizado para clerkId ${user.id}`,
      );
    } catch (clerkError) {
      // Não é bloqueante — o banco é a fonte de verdade
      console.warn('[Auth] ⚠️ Falha ao sincronizar role no Clerk:', clerkError);
    }
  }

  return { user, role: roleEfetivo };
}

