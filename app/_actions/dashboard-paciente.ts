'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';
import { contarMensagensNaoLidas } from '@/app/_actions/chat';

/**
 * Carrega todos os dados necessários para o dashboard do paciente
 * em uma única chamada, evitando waterfalls.
 */
export interface DadosDashboard {
  medicoNome: string | null;
  medicamentoAtivo: {
    nome: string;
    gotasPorDia: number;
    mlFrasco: number;
    dataInicio: string;
    dataFimPrevista: string;
    diasRestantes: number;
    diasTotais: number;
    percentualConsumo: number;
    diasEmTratamento: number;
  } | null;
  totalDocumentos: number;
  mensagensNaoLidas: number;
}

export async function obterDadosDashboard(): Promise<{
  sucesso: boolean;
  dados?: DadosDashboard;
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    // Executa todas as queries em paralelo
    const [medicoRes, medicamentoRes, documentosRes, mensagensRes] = await Promise.all([
      // 1. Médico vinculado ao paciente
      db.execute(sql`
        SELECT um.nome AS "medicoNome"
        FROM pacientes p
        INNER JOIN medicos m  ON m.id = p.medico_id
        INNER JOIN users um   ON um.id = m.user_id
        INNER JOIN users u    ON u.id = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND p.deleted_at IS NULL
        LIMIT 1
      `),

      // 2. Medicamento ativo (dosagem mais recente ativa)
      db.execute(sql`
        SELECT
          med.nome              AS "nome",
          d.gotas_por_dia       AS "gotasPorDia",
          d.ml_frasco           AS "mlFrasco",
          d.data_inicio         AS "dataInicio",
          d.data_fim_prevista   AS "dataFimPrevista"
        FROM dosagens d
        INNER JOIN medicamentos med ON med.id = d.medicamento_id
        INNER JOIN pacientes p      ON p.id = d.paciente_id
        INNER JOIN users u          ON u.id = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND d.ativa = true
          AND p.deleted_at IS NULL
        ORDER BY d.created_at DESC
        LIMIT 1
      `),

      // 3. Total de documentos do paciente
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM documentos d
        INNER JOIN pacientes p ON p.id = d.paciente_id
        INNER JOIN users u     ON u.id = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND d.deleted_at IS NULL
      `),

      // 4. Mensagens não lidas
      contarMensagensNaoLidas(),
    ]);

    // Processar médico
    const medicoNome = medicoRes.rows.length > 0
      ? (medicoRes.rows[0] as any).medicoNome as string
      : null;

    // Processar medicamento
    let medicamentoAtivo: DadosDashboard['medicamentoAtivo'] = null;
    if (medicamentoRes.rows.length > 0) {
      const row = medicamentoRes.rows[0] as any;
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const inicio = new Date(row.dataInicio + 'T00:00:00');
      const fim = new Date(row.dataFimPrevista + 'T00:00:00');

      const diasTotais = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / 86400000));
      const diasRestantes = Math.max(0, Math.round((fim.getTime() - hoje.getTime()) / 86400000));
      const diasConsumidos = diasTotais - diasRestantes;
      const percentualConsumo = Math.min(100, Math.max(0, Math.round((diasConsumidos / diasTotais) * 100)));
      const diasEmTratamento = Math.max(0, Math.round((hoje.getTime() - inicio.getTime()) / 86400000));

      medicamentoAtivo = {
        nome: row.nome,
        gotasPorDia: Number(row.gotasPorDia),
        mlFrasco: Number(row.mlFrasco),
        dataInicio: row.dataInicio,
        dataFimPrevista: row.dataFimPrevista,
        diasRestantes,
        diasTotais,
        percentualConsumo,
        diasEmTratamento,
      };
    }

    // Processar documentos
    const totalDocumentos = parseInt((documentosRes.rows[0] as any)?.total ?? '0');

    // Processar mensagens
    const mensagensNaoLidas = mensagensRes.sucesso ? (mensagensRes.dados ?? 0) : 0;

    return {
      sucesso: true,
      dados: {
        medicoNome,
        medicamentoAtivo,
        totalDocumentos,
        mensagensNaoLidas,
      },
    };
  } catch (error) {
    console.error('[Dashboard] Erro ao obter dados:', error);
    return { sucesso: false, erro: 'Erro ao carregar dashboard' };
  }
}
