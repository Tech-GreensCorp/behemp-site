'use server';

import { db } from '@/lib/db';
import { consultas, pacientes, medicos, users } from '@/db/schema';
import { eq, and, or, desc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { verificarAdmin } from '@/lib/auth/permissions';

/**
 * Listagem de teleconsultas para `/admin/teleconsulta` — separada de `/admin/pagamentos`
 * (que fica só com o financeiro) porque são categorias diferentes de informação: uma é
 * dinheiro, a outra é agenda/atendimento clínico.
 */

const pacienteUsers = alias(users, 'teleconsulta_paciente_users');
const medicoUsers = alias(users, 'teleconsulta_medico_users');

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

export interface TeleconsultaListItem {
  id: string;
  status: string;
  dataHora: Date;
  googleMeetLink: string | null;
  pacienteNome: string;
  medicoNome: string;
  medicoId: string;
}

export async function listarTeleconsultasAdmin(params?: {
  status?: string;
  medicoId?: string;
  busca?: string;
  limite?: number;
  offset?: number;
}): Promise<ActionResult<{ items: TeleconsultaListItem[]; total: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const conditions = [];
    if (params?.status) {
      conditions.push(eq(consultas.status, params.status as typeof consultas.$inferSelect.status));
    }
    if (params?.medicoId) {
      conditions.push(eq(consultas.medicoId, params.medicoId));
    }
    if (params?.busca) {
      const termo = `%${params.busca}%`;
      conditions.push(
        or(sql`${pacienteUsers.nome} ILIKE ${termo}`, sql`${medicoUsers.nome} ILIKE ${termo}`),
      );
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const resultado = await db
      .select({
        id: consultas.id,
        status: consultas.status,
        dataHora: consultas.dataHora,
        googleMeetLink: consultas.googleMeetLink,
        pacienteNome: pacienteUsers.nome,
        medicoNome: medicoUsers.nome,
        medicoId: consultas.medicoId,
      })
      .from(consultas)
      .innerJoin(pacientes, eq(consultas.pacienteId, pacientes.id))
      .innerJoin(pacienteUsers, eq(pacienteUsers.id, pacientes.userId))
      .innerJoin(medicos, eq(consultas.medicoId, medicos.id))
      .innerJoin(medicoUsers, eq(medicoUsers.id, medicos.userId))
      .where(whereClause)
      .orderBy(desc(consultas.dataHora))
      .limit(params?.limite ?? 20)
      .offset(params?.offset ?? 0);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(consultas)
      .innerJoin(pacientes, eq(consultas.pacienteId, pacientes.id))
      .innerJoin(pacienteUsers, eq(pacienteUsers.id, pacientes.userId))
      .innerJoin(medicos, eq(consultas.medicoId, medicos.id))
      .innerJoin(medicoUsers, eq(medicoUsers.id, medicos.userId))
      .where(whereClause);

    return { sucesso: true, dados: { items: resultado, total: count } };
  } catch (error) {
    console.error('[Admin] Erro ao listar teleconsultas:', error);
    return { sucesso: false, erro: 'Erro ao listar teleconsultas' };
  }
}
