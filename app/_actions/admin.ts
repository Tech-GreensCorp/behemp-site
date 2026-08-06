'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos, triagens } from '@/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';

/**
 * Server Actions para o painel administrativo.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * KPIs gerais do admin — contagens reais do banco.
 */
export async function obterKpisAdmin(): Promise<ActionResult<{
  totalUsuarios: number;
  totalMedicos: number;
  totalPacientes: number;
  triagensPendentes: number;
  porRole: { admins: number; medicos: number; pacientes: number };
}>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE u.deleted_at IS NULL) AS "totalUsuarios",
        COUNT(*) FILTER (WHERE u.role = 'admin' AND u.deleted_at IS NULL) AS "admins",
        COUNT(*) FILTER (WHERE u.role = 'medico' AND u.deleted_at IS NULL) AS "medicos",
        COUNT(*) FILTER (WHERE u.role = 'paciente' AND u.deleted_at IS NULL) AS "pacientes"
      FROM users u
    `);

    const row = resultado.rows[0] as Record<string, string>;

    const triagensPendentes = await db
      .select()
      .from(triagens)
      .where(eq(triagens.statusVisualizacao, 'pendente'));

    return {
      sucesso: true,
      dados: {
        totalUsuarios: parseInt(row.totalUsuarios || '0'),
        totalMedicos: parseInt(row.medicos || '0'),
        totalPacientes: parseInt(row.pacientes || '0'),
        triagensPendentes: triagensPendentes.length,
        porRole: {
          admins: parseInt(row.admins || '0'),
          medicos: parseInt(row.medicos || '0'),
          pacientes: parseInt(row.pacientes || '0'),
        },
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao obter KPIs admin:', error);
    return { sucesso: false, erro: 'Erro ao carregar dados do painel' };
  }
}

/**
 * Lista últimas triagens para o feed de atividade recente.
 */
export async function obterAtividadeRecente(): Promise<ActionResult<Array<{
  tipo: string;
  descricao: string;
  data: Date;
  urgente: boolean;
}>>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const ultimasTriagens = await db
      .select({
        id: triagens.id,
        nomeContato: triagens.nomeContato,
        status: triagens.statusVisualizacao,
        createdAt: triagens.createdAt,
      })
      .from(triagens)
      .orderBy(sql`${triagens.createdAt} DESC`)
      .limit(5);

    const atividades = ultimasTriagens.map((t) => ({
      tipo: 'triagem',
      descricao: `Nova triagem recebida — ${t.nomeContato || 'Sem nome'}`,
      data: t.createdAt,
      urgente: t.status === 'pendente',
    }));

    return { sucesso: true, dados: atividades };
  } catch (error) {
    console.error('[Action] Erro ao obter atividade recente:', error);
    return { sucesso: false, erro: 'Erro ao carregar atividade recente' };
  }
}

/**
 * Lista todos os usuários para o painel de gerenciamento.
 */
export async function listarUsuarios(): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  email: string;
  role: string;
  telefone: string | null;
  createdAt: Date;
}>>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db
      .select({
        id: users.id,
        nome: users.nome,
        email: users.email,
        role: users.role,
        telefone: users.telefone,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(isNull(users.deletedAt))
      .orderBy(sql`${users.createdAt} DESC`);

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar usuários:', error);
    return { sucesso: false, erro: 'Erro ao listar usuários' };
  }
}
