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

  return {
    clerkId: user.id,
    nome: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Usuário',
    email: user.emailAddresses[0]?.emailAddress || '',
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
