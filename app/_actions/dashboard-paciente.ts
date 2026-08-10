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
  teleconsultaAtiva: {
    roomId: string;
    medicoNome: string;
    iniciadaEm: string;
  } | null;
  consultaRecenteRealizada: {
    dataHora: string;
    medicoNome: string;
    temPrescricao: boolean;
  } | null;
  userId: string | null;
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
    const [medicoRes, medicamentoRes, jornadaRes, consultaRes, documentosRes, mensagensRes, teleconsultaRes, consultaRecenteRes, userIdRes] = await Promise.all([
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

      // 7. Teleconsulta ativa
      db.execute(sql`
        SELECT
          t.room_id     AS "roomId",
          um.nome       AS "medicoNome",
          t.iniciada_em AS "iniciadaEm"
        FROM teleconsultas t
        INNER JOIN pacientes p   ON p.id = t.paciente_id
        INNER JOIN users u       ON u.id = p.user_id
        INNER JOIN medicos m     ON m.id = t.medico_id
        INNER JOIN users um      ON um.id = m.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND p.deleted_at IS NULL
          AND t.deleted_at IS NULL
          AND t.status IN ('aguardando', 'em_andamento')
        ORDER BY t.iniciada_em DESC
        LIMIT 1
      `),

      // 8. Consulta recente
      db.execute(sql`
        SELECT
          c.data_hora AS "dataHora",
          um.nome     AS "medicoNome",
          EXISTS(
            SELECT 1 FROM prescricoes pr
            WHERE pr.paciente_id = p.id
              AND pr.status = 'emitida'
              AND pr.deleted_at IS NULL
              AND pr.created_at > NOW() - INTERVAL '48 hours'
          ) AS "temPrescricao"
        FROM consultas c
        INNER JOIN pacientes p ON p.id = c.paciente_id
        INNER JOIN users u     ON u.id = p.user_id
        INNER JOIN medicos m   ON m.id = c.medico_id
        INNER JOIN users um    ON um.id = m.user_id
        WHERE u.clerk_id = ${auth.clerkId}
          AND c.deleted_at IS NULL
          AND c.status = 'realizada'
          AND c.data_hora > NOW() - INTERVAL '48 hours'
        ORDER BY c.data_hora DESC
        LIMIT 1
      `),

      // 9. User ID do Banco
      db.execute(sql`
        SELECT u.id AS "userId"
        FROM users u
        WHERE u.clerk_id = ${auth.clerkId}
        LIMIT 1
      `),
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

    const teleconsultaAtivaRow = teleconsultaRes.rows[0] as any;
    const teleconsultaAtiva = teleconsultaAtivaRow ? {
      roomId: String(teleconsultaAtivaRow.roomId),
      medicoNome: String(teleconsultaAtivaRow.medicoNome),
      iniciadaEm: String(teleconsultaAtivaRow.iniciadaEm),
    } : null;

    const consultaRecenteRow = consultaRecenteRes.rows[0] as any;
    const consultaRecenteRealizada = consultaRecenteRow ? {
      dataHora: consultaRecenteRow.dataHora instanceof Date ? consultaRecenteRow.dataHora.toISOString() : String(consultaRecenteRow.dataHora),
      medicoNome: String(consultaRecenteRow.medicoNome),
      temPrescricao: Boolean(consultaRecenteRow.temPrescricao),
    } : null;

    const userId = userIdRes.rows[0] ? String((userIdRes.rows[0] as any).userId) : null;

    return {
      sucesso: true,
      dados: {
        medicoNome,
        medicamentoAtivo,
        jornada,
        proximaConsulta,
        totalDocumentos,
        mensagensNaoLidas,
        teleconsultaAtiva,
        consultaRecenteRealizada,
        userId,
      },
    };
  } catch (error) {
    console.error('[Dashboard] Erro ao obter dados:', error);
    return { sucesso: false, erro: 'Erro ao carregar dashboard' };
  }
}
