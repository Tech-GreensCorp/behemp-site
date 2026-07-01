'use server';

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { verificarAdmin, verificarMedicoOuAdmin } from '@/lib/auth/permissions';
import { eq } from 'drizzle-orm';
import { medicos, users } from '@/db/schema';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { clerkClient } from '@clerk/nextjs/server';

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
    configAgenda: any | null;
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
          u.clerk_id AS "clerkId", m.config_agenda AS "configAgenda"
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
        configAgenda: medicoRow.configAgenda ?? null,
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

/**
 * Atualiza a configuração de agenda do médico.
 * Pode ser chamado pelo Admin ou pelo próprio Médico.
 */
export async function atualizarConfigAgenda(medicoId: string, configAgenda: any): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    // Se for médico, garantir que só altera a si mesmo
    if (auth.role === 'medico') {
      const medicoLogado = await db.query.medicos.findFirst({
        with: { user: true },
        where: eq(medicos.id, medicoId),
      });

      if (!medicoLogado || medicoLogado.user?.clerkId !== auth.clerkId) {
        return { sucesso: false, erro: 'Acesso negado: você só pode alterar sua própria agenda' };
      }
    }

    await db
      .update(medicos)
      .set({ configAgenda })
      .where(eq(medicos.id, medicoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar configuração de agenda:', error);
    return { sucesso: false, erro: 'Erro interno ao salvar configurações' };
  }
}

// ── Schema de validação ────────────────────────────────────────

const criarMedicoSchema = z.object({
  email: z.string().email('E-mail inválido'),
  nome: z.string().min(2, 'Nome é obrigatório para novos usuários').optional(),
  senha: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(72, 'Senha muito longa')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número')
    .optional(),
  especialidade: z.string().min(2, 'Especialidade obrigatória'),
  crm: z.string().optional(),
  bio: z.string().optional(),
  ordem: z.number().int().optional(),
  valorConsulta: z.string().optional(),
  avatarUrl: z.string().url().optional(),
});

const atualizarMedicoSchema = z.object({
  medicoId: z.string().min(1),
  especialidade: z.string().min(2, 'Especialidade obrigatória'),
  crm: z.string().optional(),
  bio: z.string().optional(),
  ordem: z.number().int().optional(),
});

/**
 * Cria perfil médico para um usuário.
 * Se o usuário não existe no sistema, cria automaticamente no Clerk e no banco.
 * Se já existe, vincula o perfil médico ao user existente.
 */
export async function criarMedico(
  dados: z.infer<typeof criarMedicoSchema>,
): Promise<ActionResult<{ medicoId: string }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = criarMedicoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { email, nome, senha, especialidade, crm, bio, ordem, valorConsulta, avatarUrl } = parsed.data;

    // Buscar usuário pelo e-mail
    const [userExistente] = await db
      .select({ id: users.id, role: users.role, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    let userId: string;
    let clerkId: string | null = null;

    if (userExistente) {
      // ── Usuário já existe: vincular perfil médico ────────────
      userId = userExistente.id;
      clerkId = userExistente.clerkId;

      // Verificar se já tem perfil médico
      const [perfilExistente] = await db
        .select({ id: medicos.id })
        .from(medicos)
        .where(eq(medicos.userId, userId))
        .limit(1);

      if (perfilExistente) {
        return { sucesso: false, erro: 'Este usuário já possui um perfil de médico cadastrado.' };
      }

      // Atualizar dados do user (role, nome, avatar)
      const userUpdate: Partial<{ role: 'medico'; nome: string; avatarUrl: string | null }> = {};
      if (userExistente.role !== 'medico') userUpdate.role = 'medico';
      if (nome) userUpdate.nome = nome.trim();
      if (avatarUrl) userUpdate.avatarUrl = avatarUrl;

      if (Object.keys(userUpdate).length > 0) {
        await db.update(users).set(userUpdate).where(eq(users.id, userId));
      }
    } else {
      // ── Usuário NÃO existe: criar no Clerk e no banco ───────
      if (!nome) {
        return {
          sucesso: false,
          erro: 'O nome é obrigatório para cadastrar um novo usuário.',
        };
      }

      if (!senha) {
        return {
          sucesso: false,
          erro: 'A senha é obrigatória para cadastrar um novo usuário.',
        };
      }

      // 1. Criar usuário no Clerk
      try {
        const client = await clerkClient();
        const partes = nome.trim().split(' ');
        const firstName = partes[0];
        const lastName = partes.slice(1).join(' ') || '';

        const clerkUser = await client.users.createUser({
          emailAddress: [email],
          firstName,
          lastName,
          password: senha,
          skipPasswordChecks: true,
          publicMetadata: { role: 'medico' },
        });

        clerkId = clerkUser.id;
      } catch (clerkError: unknown) {
        console.error('[Admin] Erro ao criar usuário no Clerk:', clerkError);
        const msg = clerkError instanceof Error ? clerkError.message : '';
        if (msg.includes('already exists') || msg.includes('taken')) {
          return { sucesso: false, erro: 'Este e-mail já está cadastrado no Clerk mas não no banco. Peça ao usuário para fazer login primeiro.' };
        }
        return { sucesso: false, erro: 'Erro ao criar conta do usuário. Tente novamente.' };
      }

      // 2. Criar user no banco
      const [novoUser] = await db
        .insert(users)
        .values({
          email,
          nome: nome.trim(),
          clerkId,
          role: 'medico',
          avatarUrl: avatarUrl ?? null,
        })
        .returning({ id: users.id });

      userId = novoUser.id;
    }

    // ── Sincronizar nome e senha com Clerk (user existente) ────
    if (userExistente && clerkId) {
      if (nome) {
        try {
          const client = await clerkClient();
          const partes = nome.trim().split(' ');
          const firstName = partes[0];
          const lastName = partes.slice(1).join(' ') || '';
          await client.users.updateUser(clerkId, { firstName, lastName });
        } catch (clerkError) {
          console.warn('[Admin] Falha ao sincronizar nome com Clerk:', clerkError);
        }
      }

      if (senha) {
        try {
          const client = await clerkClient();
          await client.users.updateUser(clerkId, {
            password: senha,
            skipPasswordChecks: true,
          });
        } catch (clerkError) {
          console.warn('[Admin] Falha ao definir senha via Clerk:', clerkError);
        }
      }

      // Sincronizar role no Clerk
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(clerkId, {
          publicMetadata: { role: 'medico' },
        });
      } catch (clerkError) {
        console.warn('[Admin] Falha ao sincronizar role com Clerk:', clerkError);
      }
    }

    // ── Inserir na tabela medicos ──────────────────────────────
    const [novoMedico] = await db
      .insert(medicos)
      .values({
        userId,
        especialidade,
        crm: crm || null,
        bio: bio || null,
        ordem: ordem ?? null,
        valorConsulta: valorConsulta || null,
      })
      .returning({ id: medicos.id });

    revalidatePath('/admin');
    revalidatePath('/');

    return { sucesso: true, dados: { medicoId: novoMedico.id } };
  } catch (error) {
    console.error('[Admin] Erro ao criar médico:', error);
    return { sucesso: false, erro: 'Erro interno ao criar médico' };
  }
}


/**
 * Atualiza dados do perfil profissional de um médico.
 */
export async function atualizarDadosMedico(
  dados: z.infer<typeof atualizarMedicoSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarMedicoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { medicoId, especialidade, crm, bio, ordem } = parsed.data;

    await db
      .update(medicos)
      .set({
        especialidade,
        crm: crm || null,
        bio: bio || null,
        ordem: ordem ?? null,
      })
      .where(eq(medicos.id, medicoId));

    revalidatePath('/admin');
    revalidatePath(`/admin/medicos/${medicoId}`);
    revalidatePath('/');

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao atualizar médico:', error);
    return { sucesso: false, erro: 'Erro interno ao atualizar médico' };
  }
}
