'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos } from '@/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';

/**
 * Server Actions para atribuição de médicos a pacientes (Admin).
 *
 * Pacientes que se auto-cadastraram via Clerk não têm médico vinculado.
 * Estas actions permitem ao admin listar e atribuir.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

interface PacienteSemMedico {
  pacienteId: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  medicoNome: string | null;
  medicoId: string | null;
  criadoEm: string;
}

interface MedicoDisponivel {
  medicoId: string;
  nome: string;
  email: string;
}

/**
 * Lista todos os pacientes com informação de médico (ou sem).
 * Permite ao admin ver quem não tem médico e quem está atribuído.
 */
export async function listarPacientesComMedico(): Promise<ActionResult<PacienteSemMedico[]>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db.execute(sql`
      SELECT
        p.id                     AS "pacienteId",
        u.nome,
        u.email,
        u.telefone,
        p.status,
        p.medico_id              AS "medicoId",
        um.nome                  AS "medicoNome",
        TO_CHAR(p.created_at, 'YYYY-MM-DD') AS "criadoEm"
      FROM pacientes p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN medicos m ON m.id = p.medico_id
      LEFT JOIN users um ON um.id = m.user_id
      WHERE p.deleted_at IS NULL
      ORDER BY
        CASE WHEN p.medico_id IS NULL THEN 0 ELSE 1 END,
        p.created_at DESC
    `);

    return { sucesso: true, dados: resultado.rows as unknown as PacienteSemMedico[] };
  } catch (error) {
    console.error('[Admin] Erro ao listar pacientes com médico:', error);
    return { sucesso: false, erro: 'Erro ao carregar pacientes' };
  }
}

/**
 * Lista médicos disponíveis para atribuição.
 */
export async function listarMedicosDisponiveis(): Promise<ActionResult<MedicoDisponivel[]>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db.execute(sql`
      SELECT
        m.id    AS "medicoId",
        u.nome,
        u.email
      FROM medicos m
      INNER JOIN users u ON u.id = m.user_id
      WHERE u.deleted_at IS NULL
      ORDER BY u.nome
    `);

    return { sucesso: true, dados: resultado.rows as unknown as MedicoDisponivel[] };
  } catch (error) {
    console.error('[Admin] Erro ao listar médicos:', error);
    return { sucesso: false, erro: 'Erro ao carregar médicos' };
  }
}

/**
 * Atribui um médico a um paciente.
 */
export async function atribuirMedicoAoPaciente(
  pacienteId: string,
  medicoId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    if (!pacienteId || !medicoId) {
      return { sucesso: false, erro: 'IDs do paciente e médico são obrigatórios' };
    }

    // Verificar se o médico existe
    const [medico] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.id, medicoId))
      .limit(1);

    if (!medico) {
      return { sucesso: false, erro: 'Médico não encontrado' };
    }

    // Verificar se o paciente existe
    const [paciente] = await db
      .select({ id: pacientes.id })
      .from(pacientes)
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!paciente) {
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    // Atualizar
    await db
      .update(pacientes)
      .set({ medicoId })
      .where(eq(pacientes.id, pacienteId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao atribuir médico:', error);
    return { sucesso: false, erro: 'Erro ao atribuir médico' };
  }
}

/**
 * Conta pacientes sem médico atribuído.
 * Usado para exibir o badge de notificação no sidebar do admin.
 */
export async function contarPacientesSemMedico(): Promise<ActionResult<number>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pacientes)
      .where(isNull(pacientes.medicoId));

    return { sucesso: true, dados: count };
  } catch (error) {
    console.error('[Admin] Erro ao contar pacientes sem médico:', error);
    return { sucesso: false, erro: 'Erro ao contar pacientes sem médico' };
  }
}
