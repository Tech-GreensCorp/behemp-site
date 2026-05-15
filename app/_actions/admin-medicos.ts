'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';

/**
 * Server Actions para visualização de médicos pelo admin.
 *
 * Permite ao admin listar todos os médicos cadastrados e ver detalhes
 * de cada um (pacientes, triagens, agenda, jornada).
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

export interface MedicoResumo {
  medicoId: string;
  nome: string;
  email: string;
  crm: string;
  especialidade: string;
  avatarUrl: string | null;
  valorConsulta: number | null;
  totalPacientes: number;
}

export interface PacienteDoMedico {
  pacienteId: string;
  nome: string;
  email: string;
  status: string;
  jornadaFase: string;
  criadoEm: string;
}

export interface TriagemDoMedico {
  triagemId: string;
  nomeContato: string | null;
  emailContato: string | null;
  telefoneContato: string | null;
  statusVisualizacao: string;
  criadoEm: string;
}

export interface ConsultaDoMedico {
  consultaId: string;
  dataHora: string;
  status: string;
  pacienteNome: string;
  pacienteEmail: string;
  googleMeetLink: string | null;
}

export interface JornadaContagem {
  fase: string;
  total: number;
}

export interface MedicoDetalhe {
  medico: {
    id: string;
    nome: string;
    email: string;
    telefone: string | null;
    crm: string;
    especialidade: string;
    bio: string | null;
    avatarUrl: string | null;
    valorConsulta: number | null;
  };
  pacientes: PacienteDoMedico[];
  triagens: TriagemDoMedico[];
  consultas: ConsultaDoMedico[];
  jornada: JornadaContagem[];
}

/**
 * Lista todos os médicos cadastrados com contagem de pacientes.
 */
export async function listarMedicosAdmin(): Promise<ActionResult<MedicoResumo[]>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const resultado = await db.execute(sql`
      SELECT
        m.id              AS "medicoId",
        u.nome,
        u.email,
        u.avatar_url      AS "avatarUrl",
        m.crm,
        m.especialidade,
        m.valor_consulta  AS "valorConsulta",
        COUNT(p.id) FILTER (WHERE p.deleted_at IS NULL)::int AS "totalPacientes"
      FROM medicos m
      INNER JOIN users u ON u.id = m.user_id
      LEFT JOIN pacientes p ON p.medico_id = m.id
      WHERE u.deleted_at IS NULL
      GROUP BY m.id, u.nome, u.email, u.avatar_url, m.crm, m.especialidade, m.valor_consulta
      ORDER BY u.nome
    `);

    const lista: MedicoResumo[] = resultado.rows.map((row: any) => ({
      medicoId: row.medicoId,
      nome: row.nome,
      email: row.email,
      crm: row.crm,
      especialidade: row.especialidade,
      avatarUrl: row.avatarUrl ?? null,
      valorConsulta: row.valorConsulta !== null ? Number(row.valorConsulta) : null,
      totalPacientes: row.totalPacientes ?? 0,
    }));

    return { sucesso: true, dados: lista };
  } catch (error) {
    console.error('[Admin] Erro ao listar médicos:', error);
    return { sucesso: false, erro: 'Erro ao carregar médicos' };
  }
}

/**
 * Detalhes completos de um médico: dados, pacientes, triagens, consultas, jornada.
 */
export async function obterMedicoDetalhe(medicoId: string): Promise<ActionResult<MedicoDetalhe>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    if (!medicoId) {
      return { sucesso: false, erro: 'ID do médico é obrigatório' };
    }

    const [medicoRes, pacientesRes, triagensRes, consultasRes, jornadaRes] = await Promise.all([
      // 1. Dados do médico
      db.execute(sql`
        SELECT
          m.id, u.nome, u.email, u.telefone, u.avatar_url AS "avatarUrl",
          m.crm, m.especialidade, m.bio, m.valor_consulta AS "valorConsulta",
          u.clerk_id AS "clerkId"
        FROM medicos m
        INNER JOIN users u ON u.id = m.user_id
        WHERE m.id = ${medicoId}
        LIMIT 1
      `),

      // 2. Pacientes do médico
      db.execute(sql`
        SELECT
          p.id              AS "pacienteId",
          u.nome,
          u.email,
          p.status,
          p.jornada_fase    AS "jornadaFase",
          TO_CHAR(p.created_at, 'YYYY-MM-DD') AS "criadoEm"
        FROM pacientes p
        INNER JOIN users u ON u.id = p.user_id
        WHERE p.medico_id = ${medicoId}
          AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
      `),

      // 3. Triagens do médico (via clerk_id)
      db.execute(sql`
        SELECT
          t.id                  AS "triagemId",
          t.nome_contato        AS "nomeContato",
          t.email_contato       AS "emailContato",
          t.telefone_contato    AS "telefoneContato",
          t.status_visualizacao AS "statusVisualizacao",
          TO_CHAR(t.created_at, 'YYYY-MM-DD') AS "criadoEm"
        FROM triagens t
        INNER JOIN medicos m ON m.id = ${medicoId}
        INNER JOIN users um ON um.id = m.user_id
        WHERE t.medico_clerk_id = um.clerk_id
        ORDER BY t.created_at DESC
        LIMIT 50
      `),

      // 4. Consultas do médico (futuras + recentes)
      db.execute(sql`
        SELECT
          c.id                AS "consultaId",
          c.data_hora         AS "dataHora",
          c.status,
          up.nome             AS "pacienteNome",
          up.email            AS "pacienteEmail",
          c.google_meet_link  AS "googleMeetLink"
        FROM consultas c
        INNER JOIN pacientes p ON p.id = c.paciente_id
        INNER JOIN users up    ON up.id = p.user_id
        WHERE c.medico_id = ${medicoId}
          AND c.deleted_at IS NULL
        ORDER BY c.data_hora DESC
        LIMIT 50
      `),

      // 5. Jornada agregada por fase
      db.execute(sql`
        SELECT
          p.jornada_fase AS "fase",
          COUNT(*)::int  AS "total"
        FROM pacientes p
        WHERE p.medico_id = ${medicoId}
          AND p.deleted_at IS NULL
        GROUP BY p.jornada_fase
        ORDER BY p.jornada_fase
      `),
    ]);

    if (medicoRes.rows.length === 0) {
      return { sucesso: false, erro: 'Médico não encontrado' };
    }

    const medicoRow = medicoRes.rows[0] as any;

    const detalhe: MedicoDetalhe = {
      medico: {
        id: medicoRow.id,
        nome: medicoRow.nome,
        email: medicoRow.email,
        telefone: medicoRow.telefone ?? null,
        crm: medicoRow.crm,
        especialidade: medicoRow.especialidade,
        bio: medicoRow.bio ?? null,
        avatarUrl: medicoRow.avatarUrl ?? null,
        valorConsulta: medicoRow.valorConsulta !== null ? Number(medicoRow.valorConsulta) : null,
      },
      pacientes: pacientesRes.rows.map((row: any) => ({
        pacienteId: row.pacienteId,
        nome: row.nome,
        email: row.email,
        status: row.status,
        jornadaFase: row.jornadaFase,
        criadoEm: row.criadoEm,
      })),
      triagens: triagensRes.rows.map((row: any) => ({
        triagemId: row.triagemId,
        nomeContato: row.nomeContato ?? null,
        emailContato: row.emailContato ?? null,
        telefoneContato: row.telefoneContato ?? null,
        statusVisualizacao: row.statusVisualizacao,
        criadoEm: row.criadoEm,
      })),
      consultas: consultasRes.rows.map((row: any) => ({
        consultaId: row.consultaId,
        dataHora: row.dataHora instanceof Date ? row.dataHora.toISOString() : String(row.dataHora),
        status: row.status,
        pacienteNome: row.pacienteNome,
        pacienteEmail: row.pacienteEmail,
        googleMeetLink: row.googleMeetLink ?? null,
      })),
      jornada: jornadaRes.rows.map((row: any) => ({
        fase: row.fase,
        total: row.total,
      })),
    };

    return { sucesso: true, dados: detalhe };
  } catch (error) {
    console.error('[Admin] Erro ao obter detalhe do médico:', error);
    return { sucesso: false, erro: 'Erro ao carregar detalhes do médico' };
  }
}
