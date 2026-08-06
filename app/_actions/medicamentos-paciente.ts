'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';

/**
 * Server Actions de medicamentos — visão do paciente autenticado.
 *
 * Busca os ajustes de dosagem (ajustes_dosagem + itens_ajuste_dosagem)
 * vinculados ao pacienteId inferido via clerkId.
 * É a mesma fonte de dados que o médico usa ao registrar dosagens.
 */

export interface ItemMedicamentoPaciente {
  id: string;            // id do item
  ajusteId: string;
  tipoCanabinoide: string;
  novaDosagem: string;
  dosagemAnterior: string | null;
  frequencia: string;
  concentracaoTHC: string | null;
  concentracaoCBD: string | null;
  viaAdministracao: string | null;
  dataAjuste: string;
  proximaRevisao: string | null;
  motivoAjuste: string;
}

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Lista os ajustes de dosagem (medicamentos) do paciente logado.
 * Busca das tabelas ajustes_dosagem e itens_ajuste_dosagem,
 * que é onde o médico registra as prescrições.
 */
export async function listarMeusMedicamentos(): Promise<ActionResult<ItemMedicamentoPaciente[]>> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const resultado = await db.execute(sql`
      SELECT
        iad.id,
        iad.ajuste_id        AS "ajusteId",
        iad.tipo_canabinoide AS "tipoCanabinoide",
        iad.nova_dosagem     AS "novaDosagem",
        iad.dosagem_anterior AS "dosagemAnterior",
        iad.frequencia,
        iad.concentracao_thc AS "concentracaoTHC",
        iad.concentracao_cbd AS "concentracaoCBD",
        iad.via_administracao AS "viaAdministracao",
        ad.data_ajuste       AS "dataAjuste",
        ad.proxima_revisao   AS "proximaRevisao",
        ad.motivo_ajuste     AS "motivoAjuste"
      FROM itens_ajuste_dosagem iad
      INNER JOIN ajustes_dosagem ad ON ad.id = iad.ajuste_id
      INNER JOIN pacientes p        ON p.id  = ad.paciente_id
      INNER JOIN users u            ON u.id  = p.user_id
      WHERE u.clerk_id = ${auth.clerkId}
        AND p.deleted_at IS NULL
        AND ad.deleted_at IS NULL
      ORDER BY ad.data_ajuste DESC, iad.created_at DESC
    `);

    const medicamentos: ItemMedicamentoPaciente[] = resultado.rows.map((row: any) => ({
      id: row.id,
      ajusteId: row.ajusteId,
      tipoCanabinoide: row.tipoCanabinoide,
      novaDosagem: row.novaDosagem,
      dosagemAnterior: row.dosagemAnterior ?? null,
      frequencia: row.frequencia,
      concentracaoTHC: row.concentracaoTHC ?? null,
      concentracaoCBD: row.concentracaoCBD ?? null,
      viaAdministracao: row.viaAdministracao ?? null,
      dataAjuste: row.dataAjuste,
      proximaRevisao: row.proximaRevisao ?? null,
      motivoAjuste: row.motivoAjuste,
    }));

    return { sucesso: true, dados: medicamentos };
  } catch (error) {
    console.error('[Action] Erro ao listar medicamentos (paciente):', error);
    return { sucesso: false, erro: 'Erro ao listar medicamentos' };
  }
}
