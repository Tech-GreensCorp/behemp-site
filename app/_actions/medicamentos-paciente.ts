'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';

/**
 * Server Actions de medicamentos — visão do paciente autenticado.
 *
 * Busca as dosagens vinculadas ao pacienteId inferido via clerkId.
 * Calcula diasRestantes e percentual de consumo.
 */

interface MedicamentoPaciente {
  id: string;
  medicamentoNome: string;
  gotasPorDia: number;
  mlFrasco: number;
  dataInicio: string;
  dataFimPrevista: string;
  ativa: boolean;
  diasRestantes: number;
  diasTotais: number;
  percentualConsumo: number;
}

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Lista as dosagens (medicamentos) do paciente logado.
 * Inclui cálculos de consumo, dias restantes e percentual.
 */
export async function listarMeusMedicamentos(): Promise<ActionResult<MedicamentoPaciente[]>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const resultado = await db.execute(sql`
      SELECT
        d.id,
        m.nome            AS "medicamentoNome",
        d.gotas_por_dia   AS "gotasPorDia",
        d.ml_frasco       AS "mlFrasco",
        d.data_inicio     AS "dataInicio",
        d.data_fim_prevista AS "dataFimPrevista",
        d.ativa
      FROM dosagens d
      INNER JOIN medicamentos m ON m.id = d.medicamento_id
      INNER JOIN pacientes p   ON p.id = d.paciente_id
      INNER JOIN users u       ON u.id = p.user_id
      WHERE u.clerk_id = ${auth.clerkId}
        AND p.deleted_at IS NULL
      ORDER BY d.ativa DESC, d.created_at DESC
    `);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const medicamentos: MedicamentoPaciente[] = resultado.rows.map((row: any) => {
      const inicio = new Date(row.dataInicio + 'T00:00:00');
      const fim = new Date(row.dataFimPrevista + 'T00:00:00');

      const diasTotais = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)));
      const diasRestantes = Math.max(0, Math.round((fim.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)));
      const diasConsumidos = diasTotais - diasRestantes;
      const percentualConsumo = Math.min(100, Math.max(0, Math.round((diasConsumidos / diasTotais) * 100)));

      return {
        id: row.id,
        medicamentoNome: row.medicamentoNome,
        gotasPorDia: Number(row.gotasPorDia),
        mlFrasco: Number(row.mlFrasco),
        dataInicio: row.dataInicio,
        dataFimPrevista: row.dataFimPrevista,
        ativa: row.ativa,
        diasRestantes,
        diasTotais,
        percentualConsumo,
      };
    });

    return { sucesso: true, dados: medicamentos };
  } catch (error) {
    console.error('[Action] Erro ao listar medicamentos (paciente):', error);
    return { sucesso: false, erro: 'Erro ao listar medicamentos' };
  }
}
