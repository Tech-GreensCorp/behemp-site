'use server';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

/**
 * Server Actions de administração de usuários.
 * Somente role admin pode acessar.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

interface UsuarioAdmin {
  id: string;
  clerkId: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  role: string | null;
  createdAt: Date;
}

/**
 * Lista todos os usuários com contagem por role.
 */
export async function listarUsuariosAdmin(params?: {
  busca?: string;
  role?: string;
  limite?: number;
}): Promise<ActionResult<{
  usuarios: UsuarioAdmin[];
  total: number;
  porRole: { admins: number; medicos: number; pacientes: number };
}>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const condicoes = [];

    if (params?.busca) {
      condicoes.push(
        sql`(${users.nome} ILIKE ${`%${params.busca}%`} OR ${users.email} ILIKE ${`%${params.busca}%`})`,
      );
    }
    if (params?.role) {
      condicoes.push(eq(users.role, params.role as 'admin' | 'medico' | 'paciente'));
    }

    // Buscar usuários
    const resultado = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        condicoes.length > 0
          ? sql`${sql.join(condicoes, sql` AND `)}`
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(params?.limite ?? 200);

    // Contagem por role
    const contagem = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
        COUNT(*) FILTER (WHERE role = 'medico')::int as medicos,
        COUNT(*) FILTER (WHERE role = 'paciente')::int as pacientes,
        COUNT(*)::int as total
      FROM users
    `);

    const c = contagem.rows[0] as { admins: number; medicos: number; pacientes: number; total: number };

    return {
      sucesso: true,
      dados: {
        usuarios: resultado,
        total: c.total,
        porRole: {
          admins: c.admins,
          medicos: c.medicos,
          pacientes: c.pacientes,
        },
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao listar usuários:', error);
    return { sucesso: false, erro: 'Erro ao listar usuários' };
  }
}

const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100).optional(),
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s\(\)\-\+]{8,20}$/, 'Telefone inválido')
    .or(z.literal(''))
    .optional(),
});

/**
 * Atualiza nome e/ou telefone de um usuário (salva no banco).
 * O nome também é sincronizado com o Clerk para manter consistência.
 */
export async function atualizarUsuarioAdmin(
  usuarioId: string,
  dados: { nome?: string; telefone?: string },
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarUsuarioSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar clerkId do usuário
    const [usuario] = await db
      .select({ clerkId: users.clerkId })
      .from(users)
      .where(eq(users.id, usuarioId))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Montar atualização no banco
    const update: Partial<{ nome: string; telefone: string | null }> = {};
    if (parsed.data.nome !== undefined) update.nome = parsed.data.nome;
    if (parsed.data.telefone !== undefined) {
      update.telefone = parsed.data.telefone === '' ? null : parsed.data.telefone;
    }

    if (Object.keys(update).length > 0) {
      await db.update(users).set(update).where(eq(users.id, usuarioId));
    }

    // Sincronizar nome com Clerk
    if (parsed.data.nome && usuario.clerkId) {
      try {
        const client = await clerkClient();
        const partes = parsed.data.nome.trim().split(' ');
        const firstName = partes[0];
        const lastName = partes.slice(1).join(' ') || '';
        await client.users.updateUser(usuario.clerkId, { firstName, lastName });
      } catch (clerkError) {
        console.warn('[Admin] Falha ao sincronizar nome com Clerk (banco atualizado):', clerkError);
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao atualizar usuário:', error);
    return { sucesso: false, erro: 'Erro ao atualizar usuário' };
  }
}

/**
 * Altera a role de um usuário (banco + publicMetadata do Clerk).
 * Não permite remover a própria role de admin.
 */
export async function alterarRoleUsuario(
  usuarioId: string,
  novaRole: 'admin' | 'medico' | 'paciente',
  adminClerkId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [usuario] = await db
      .select({ clerkId: users.clerkId, role: users.role })
      .from(users)
      .where(eq(users.id, usuarioId))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Segurança: admin não pode rebaixar a si mesmo
    if (usuario.clerkId === adminClerkId && novaRole !== 'admin') {
      return { sucesso: false, erro: 'Você não pode alterar sua própria role de admin' };
    }

    await db.update(users).set({ role: novaRole }).where(eq(users.id, usuarioId));

    // Sincronizar publicMetadata no Clerk
    if (usuario.clerkId) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(usuario.clerkId, {
          publicMetadata: { role: novaRole },
        });
      } catch (clerkError) {
        console.warn('[Admin] Falha ao sincronizar role com Clerk (banco atualizado):', clerkError);
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao alterar role:', error);
    return { sucesso: false, erro: 'Erro ao alterar role' };
  }
}


const senhaTemporariaSchema = z.object({
  senha: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(72, 'Senha muito longa')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
});

/**
 * Define uma senha temporária para o usuário via Clerk Backend API.
 * O usuário deverá alterar a senha no próximo acesso (recomendado comunicar por outro canal).
 * skipPasswordChecks: true permite definir senhas que não passariam pelas políticas do HIBP.
 */
export async function definirSenhaTemporaria(
  clerkId: string,
  senha: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    if (!clerkId) return { sucesso: false, erro: 'Usuário sem conta Clerk vinculada' };

    const parsed = senhaTemporariaSchema.safeParse({ senha });
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const client = await clerkClient();
    await client.users.updateUser(clerkId, {
      password: parsed.data.senha,
      skipPasswordChecks: true, // Bypassa checagens de HIBP para senhas temporárias
    });

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao definir senha temporária:', error);
    return { sucesso: false, erro: 'Não foi possível definir a senha temporária' };
  }
}

