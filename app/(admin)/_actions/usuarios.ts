'use server';

import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';

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
      .select()
      .from(users)
      .where(
        condicoes.length > 0
          ? sql`${sql.join(condicoes, sql` AND `)}`
          : undefined,
      )
      .orderBy(desc(users.createdAt))
      .limit(params?.limite ?? 50);

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
