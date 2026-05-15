'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';
import { contarMensagensNaoLidas } from '@/app/_actions/chat';

/**
 * Carrega todos os dados necessários para o dashboard do paciente
 * em uma única chamada, evitando waterfalls.
 *
 * Fontes de dados:
 * - Medicamento: itens_ajuste_dosagem + ajustes_dosagem (mesma fonte de /paciente/medicamentos)
 * - Jornada: pacientes.jornada_fase + pacientes.status
 * - Próxima consulta: consultas (futuras, status agendada/confirmada)
 */
export interface DadosDashboard {
  medicoNome: string | null;
  medicamentoAtivo: {
    tipoCanabinoide: string;
    novaDosagem: string;
    frequencia: string;
    concentracaoTHC: string | null;
    concentracaoCBD: string | null;
    viaAdministracao: string | null;
    dataAjuste: string;
    proximaRevisao: string | null;
  } | null;
  jornada: {
    fase: string;
    status: string;
  };
  proximaConsulta: {
    dataHora: string;
    meetLink: string | null;
    medicoNome: string;
    status: string;
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
    const [medicoRes, medicamentoRes, jornadaRes, consultaRes, documentosRes, mensagensRes] = await Promise.all([
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

      // 2. Medicamento atual — item do ajuste mais recente
      db.execute(sql`
        SELECT
          iad.tipo_canabinoide   AS "tipoCanabinoide",
          iad.nova_dosagem       AS "novaDosagem",
          iad.frequencia,
          iad.concentracao_thc   AS "concentracaoTHC",
          iad.concentracao_cbd   AS "concentracaoCBD",
          iad.via_administracao  AS "viaAdministracao",
          ad.data_ajuste         AS "dataAjuste",
          ad.proxima_revisao     AS "proximaRevisao"
        FROM itens_ajuste_dosagem iad
        INNER JOIN ajustes_dosagem ad ON ad.id = iad.ajuste_id
        INNER JOIN pacientes p        ON p.id  = ad.paciente_id
        INNER JOIN users u            ON u.id  = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND p.deleted_at IS NULL
          AND ad.deleted_at IS NULL
        ORDER BY ad.data_ajuste DESC, iad.created_at DESC
        LIMIT 1
      `),

      // 3. Jornada e status do paciente
      db.execute(sql`
        SELECT
          p.jornada_fase AS "fase",
          p.status
        FROM pacientes p
        INNER JOIN users u ON u.id = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND p.deleted_at IS NULL
        LIMIT 1
      `),

      // 4. Próxima consulta agendada
      db.execute(sql`
        SELECT
          c.data_hora           AS "dataHora",
          c.google_meet_link    AS "meetLink",
          c.status,
          um.nome               AS "medicoNome"
        FROM consultas c
        INNER JOIN pacientes p ON p.id = c.paciente_id
        INNER JOIN users u     ON u.id = p.user_id
        INNER JOIN medicos m   ON m.id = c.medico_id
        INNER JOIN users um    ON um.id = m.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND c.deleted_at IS NULL
          AND c.data_hora >= NOW()
          AND c.status IN ('agendada', 'confirmada')
        ORDER BY c.data_hora ASC
        LIMIT 1
      `),

      // 5. Total de documentos do paciente
      db.execute(sql`
        SELECT COUNT(*) AS total
        FROM documentos d
        INNER JOIN pacientes p ON p.id = d.paciente_id
        INNER JOIN users u     ON u.id = p.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND d.deleted_at IS NULL
      `),

      // 6. Mensagens não lidas
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
      medicamentoAtivo = {
        tipoCanabinoide: row.tipoCanabinoide,
        novaDosagem: row.novaDosagem,
        frequencia: row.frequencia,
        concentracaoTHC: row.concentracaoTHC ?? null,
        concentracaoCBD: row.concentracaoCBD ?? null,
        viaAdministracao: row.viaAdministracao ?? null,
        dataAjuste: row.dataAjuste,
        proximaRevisao: row.proximaRevisao ?? null,
      };
    }

    // Processar jornada
    const jornadaRow = jornadaRes.rows[0] as any;
    const jornada = {
      fase: (jornadaRow?.fase ?? 'acolhimento') as string,
      status: (jornadaRow?.status ?? 'aguardando_consulta') as string,
    };

    // Processar próxima consulta
    let proximaConsulta: DadosDashboard['proximaConsulta'] = null;
    if (consultaRes.rows.length > 0) {
      const row = consultaRes.rows[0] as any;
      proximaConsulta = {
        dataHora: row.dataHora instanceof Date ? row.dataHora.toISOString() : String(row.dataHora),
        meetLink: row.meetLink ?? null,
        medicoNome: row.medicoNome,
        status: row.status,
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
        jornada,
        proximaConsulta,
        totalDocumentos,
        mensagensNaoLidas,
      },
    };
  } catch (error) {
    console.error('[Dashboard] Erro ao obter dados:', error);
    return { sucesso: false, erro: 'Erro ao carregar dashboard' };
  }
}
