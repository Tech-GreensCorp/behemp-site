'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos } from '@/db/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';
import { criarNotificacao } from '@/app/(medico)/_actions/notificacoes';
import { enviarEmailMedicoNovoPaciente } from '@/lib/email/notificacoes';

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
 * Lista pacientes com paginação, busca e ordenação.
 * Filtra por status de atribuição (todos, sem médico, com médico).
 */
export async function listarPacientesComMedicoPaginado(params?: {
  busca?: string;
  filtro?: 'todos' | 'sem_medico' | 'com_medico';
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'nome' | 'criadoEm';
  direcao?: 'asc' | 'desc';
}): Promise<ActionResult<{
  pacientes: PacienteSemMedico[];
  total: number;
  totalPaginas: number;
  semMedico: number;
  comMedico: number;
}>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const pagina = Math.max(1, params?.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, params?.porPagina ?? 20));
    const offset = (pagina - 1) * porPagina;

    const buscaTerm = params?.busca ? `%${params.busca}%` : null;
    const filtro = params?.filtro ?? 'todos';

    // --- Ordenação dinâmica ---
    const colunasOrdenacao: Record<string, string> = {
      nome: 'u.nome',
      criadoEm: 'p.created_at',
    };
    const coluna = colunasOrdenacao[params?.ordenarPor ?? 'criadoEm'] ?? 'p.created_at';
    const direcao = (params?.direcao ?? 'desc') === 'asc' ? 'ASC' : 'DESC';

    // --- Filtro de atribuição ---
    const filtroAtribuicao =
      filtro === 'sem_medico' ? sql`AND p.medico_id IS NULL` :
      filtro === 'com_medico' ? sql`AND p.medico_id IS NOT NULL` :
      sql``;

    // --- Query principal ---
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
        ${filtroAtribuicao}
        ${buscaTerm ? sql`AND (u.nome ILIKE ${buscaTerm} OR u.email ILIKE ${buscaTerm})` : sql``}
      ORDER BY
        CASE WHEN p.medico_id IS NULL THEN 0 ELSE 1 END,
        ${sql.raw(`${coluna} ${direcao}`)}
      LIMIT ${porPagina}
      OFFSET ${offset}
    `);

    // --- Contagem filtrada ---
    const contagemRes = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM pacientes p
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.deleted_at IS NULL
        ${filtroAtribuicao}
        ${buscaTerm ? sql`AND (u.nome ILIKE ${buscaTerm} OR u.email ILIKE ${buscaTerm})` : sql``}
    `);

    const total = (contagemRes.rows[0] as { total: number })?.total ?? 0;
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

    // --- Contagens globais de atribuição ---
    const statsRes = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE p.medico_id IS NULL)::int AS "semMedico",
        COUNT(*) FILTER (WHERE p.medico_id IS NOT NULL)::int AS "comMedico"
      FROM pacientes p
      WHERE p.deleted_at IS NULL
    `);
    const stats = statsRes.rows[0] as { semMedico: number; comMedico: number };

    return {
      sucesso: true,
      dados: {
        pacientes: resultado.rows as unknown as PacienteSemMedico[],
        total,
        totalPaginas,
        semMedico: stats.semMedico,
        comMedico: stats.comMedico,
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao listar pacientes paginado:', error);
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

    // ── Notificar médico (email + in-app) — não bloqueia em caso de falha
    try {
      const dadosRes = await db.execute(sql`
        SELECT
          um.id       AS "medicoUserId",
          um.nome     AS "medicoNome",
          um.email    AS "medicoEmail",
          up.nome     AS "pacienteNome",
          up.email    AS "pacienteEmail",
          up.telefone AS "pacienteTelefone"
        FROM medicos m
        INNER JOIN users um ON um.id = m.user_id
        INNER JOIN pacientes p ON p.id = ${pacienteId}
        INNER JOIN users up ON up.id = p.user_id
        WHERE m.id = ${medicoId}
        LIMIT 1
      `);

      const dados = dadosRes.rows[0] as any;
      if (dados) {
        // In-app + Pusher realtime
        await criarNotificacao({
          userId: dados.medicoUserId,
          tipo: 'geral',
          titulo: 'Novo paciente atribuído',
          mensagem: `${dados.pacienteNome} foi atribuído a você.`,
          linkAcao: '/medico/pacientes',
        });

        // Email (já tem try/catch interno, mas envolvido aqui também por segurança)
        await enviarEmailMedicoNovoPaciente({
          emailMedico: dados.medicoEmail,
          nomeMedico: dados.medicoNome,
          pacienteNome: dados.pacienteNome,
          pacienteEmail: dados.pacienteEmail,
          pacienteTelefone: dados.pacienteTelefone ?? null,
        });
      }
    } catch (notifError) {
      console.error('[Admin] Falha ao notificar médico (atribuição salva):', notifError);
    }

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

/**
 * Reatribui múltiplos pacientes para um único médico de uma vez.
 *
 * @param medicoDestinoId - ID do médico que receberá os pacientes
 * @param medicoOrigemId  - (Opcional) Se informado, reatribui apenas os pacientes
 *                          desse médico específico. Se null/undefined, reatribui TODOS
 *                          os pacientes (com ou sem médico).
 */
export async function reatribuirTodosPacientes(
  medicoDestinoId: string,
  medicoOrigemId?: string | null,
): Promise<ActionResult<{ total: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    if (!medicoDestinoId) {
      return { sucesso: false, erro: 'ID do médico de destino é obrigatório' };
    }

    // Verificar se o médico destino existe
    const [medicoDestino] = await db
      .select({ id: medicos.id })
      .from(medicos)
      .where(eq(medicos.id, medicoDestinoId))
      .limit(1);

    if (!medicoDestino) {
      return { sucesso: false, erro: 'Médico de destino não encontrado' };
    }

    // Montar condição: todos os pacientes OU apenas os de um médico específico
    let resultado;

    if (medicoOrigemId) {
      // Reatribuir apenas pacientes de um médico específico
      resultado = await db
        .update(pacientes)
        .set({ medicoId: medicoDestinoId })
        .where(eq(pacientes.medicoId, medicoOrigemId))
        .returning({ id: pacientes.id });
    } else {
      // Reatribuir TODOS os pacientes (inclusive sem médico)
      resultado = await db
        .update(pacientes)
        .set({ medicoId: medicoDestinoId })
        .returning({ id: pacientes.id });
    }

    const total = resultado.length;

    // Notificar o médico destino (fire-and-forget)
    try {
      const [medicoUser] = await db.execute(sql`
        SELECT u.id AS "userId", u.nome, u.email
        FROM medicos m
        INNER JOIN users u ON u.id = m.user_id
        WHERE m.id = ${medicoDestinoId}
        LIMIT 1
      `).then((r) => r.rows);

      if (medicoUser) {
        const dados = medicoUser as any;
        await criarNotificacao({
          userId: dados.userId,
          tipo: 'geral',
          titulo: 'Pacientes reatribuídos em lote',
          mensagem: `${total} paciente(s) foram atribuídos a você pelo administrador.`,
          linkAcao: '/medico/pacientes',
        });
      }
    } catch (notifError) {
      console.error('[Admin] Falha ao notificar médico na reatribuição em lote:', notifError);
    }

    return { sucesso: true, dados: { total } };
  } catch (error) {
    console.error('[Admin] Erro ao reatribuir pacientes em lote:', error);
    return { sucesso: false, erro: 'Erro ao reatribuir pacientes' };
  }
}

