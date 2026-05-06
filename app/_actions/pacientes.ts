'use server';

import { db } from '@/lib/db';
import { users, pacientes } from '@/db/schema';
import { eq, and, isNull, ilike, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { verificarMedicoOuAdmin } from '@/lib/auth';

/**
 * Server Actions de pacientes.
 * Todas as mutations validam role (medico ou admin).
 */

// ── Schemas ───────────────────────────────────────────────────

const criarPacienteSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  responsavelNome: z.string().optional(),
  responsavelCpf: z.string().optional(),
  tratamentoTipo: z.enum(['cbd', 'thc', 'cbd_thc']).optional(),
  endereco: z.string().optional(),
});

const atualizarPacienteSchema = criarPacienteSchema.partial().extend({
  pacienteId: z.string().min(1, 'ID do paciente é obrigatório'),
  status: z.enum(['aguardando_consulta', 'em_tratamento', 'concluido', 'arquivado']).optional(),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria um novo paciente vinculado ao médico autenticado.
 * Cria também um user base para o paciente.
 */
export async function criarPaciente(
  dados: z.infer<typeof criarPacienteSchema>,
): Promise<ActionResult<{ pacienteId: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const parsed = criarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Verificar se já existe user com esse e-mail
    const [userExistente] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    let userId: string;

    if (userExistente) {
      userId = userExistente.id;
    } else {
      // Cria user base para o paciente
      const [novoUser] = await db
        .insert(users)
        .values({
          email: parsed.data.email,
          nome: parsed.data.nome,
          role: 'paciente',
          telefone: parsed.data.telefone,
        })
        .returning({ id: users.id });
      userId = novoUser.id;
    }

    // Buscar medicoId do usuário autenticado
    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    // Criar paciente
    const [novoPaciente] = await db
      .insert(pacientes)
      .values({
        userId,
        medicoId,
        dataNascimento: parsed.data.dataNascimento,
        cpf: parsed.data.cpf,
        responsavelNome: parsed.data.responsavelNome,
        responsavelCpf: parsed.data.responsavelCpf,
        tratamentoTipo: parsed.data.tratamentoTipo,
        endereco: parsed.data.endereco,
        status: 'aguardando_consulta',
      })
      .returning({ id: pacientes.id });

    return { sucesso: true, dados: { pacienteId: novoPaciente.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar paciente:', error);
    return { sucesso: false, erro: 'Erro ao criar paciente' };
  }
}

/**
 * Atualiza dados de um paciente existente.
 */
export async function atualizarPaciente(
  dados: z.infer<typeof atualizarPacienteSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const parsed = atualizarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { pacienteId, nome, email, telefone, ...dadosPaciente } = parsed.data;

    // Atualizar dados do paciente
    const updatePaciente: Record<string, unknown> = {};
    if (dadosPaciente.dataNascimento) updatePaciente.dataNascimento = dadosPaciente.dataNascimento;
    if (dadosPaciente.cpf) updatePaciente.cpf = dadosPaciente.cpf;
    if (dadosPaciente.responsavelNome) updatePaciente.responsavelNome = dadosPaciente.responsavelNome;
    if (dadosPaciente.responsavelCpf) updatePaciente.responsavelCpf = dadosPaciente.responsavelCpf;
    if (dadosPaciente.tratamentoTipo) updatePaciente.tratamentoTipo = dadosPaciente.tratamentoTipo;
    if (dadosPaciente.endereco) updatePaciente.endereco = dadosPaciente.endereco;
    if (dadosPaciente.status) updatePaciente.status = dadosPaciente.status;

    if (Object.keys(updatePaciente).length > 0) {
      await db
        .update(pacientes)
        .set(updatePaciente)
        .where(eq(pacientes.id, pacienteId));
    }

    // Atualizar dados do user associado se necessário
    if (nome || email || telefone) {
      const [pacienteData] = await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);

      if (pacienteData) {
        const updateUser: Record<string, unknown> = {};
        if (nome) updateUser.nome = nome;
        if (email) updateUser.email = email;
        if (telefone) updateUser.telefone = telefone;

        await db
          .update(users)
          .set(updateUser)
          .where(eq(users.id, pacienteData.userId));
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar paciente:', error);
    return { sucesso: false, erro: 'Erro ao atualizar paciente' };
  }
}

/**
 * Arquiva um paciente (soft delete).
 */
export async function arquivarPaciente(
  pacienteId: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    await db
      .update(pacientes)
      .set({
        status: 'arquivado',
        deletedAt: new Date(),
      })
      .where(eq(pacientes.id, pacienteId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao arquivar paciente:', error);
    return { sucesso: false, erro: 'Erro ao arquivar paciente' };
  }
}

/**
 * Lista pacientes do médico autenticado com filtros.
 */
export async function listarPacientes(filtros?: {
  busca?: string;
  status?: string;
  tratamento?: string;
}): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  tratamentoTipo: string | null;
  dataNascimento: string | null;
  createdAt: Date;
}>>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const conditions = [isNull(pacientes.deletedAt)];

    // Se for médico (não admin), filtrar por seus pacientes
    if (auth.role === 'medico' && medicoId) {
      conditions.push(eq(pacientes.medicoId, medicoId));
    }

    if (filtros?.status && filtros.status !== 'todos') {
      conditions.push(eq(pacientes.status, filtros.status as 'aguardando_consulta' | 'em_tratamento' | 'concluido' | 'arquivado'));
    }

    if (filtros?.tratamento && filtros.tratamento !== 'todos') {
      conditions.push(eq(pacientes.tratamentoTipo, filtros.tratamento as 'cbd' | 'thc' | 'cbd_thc'));
    }

    let query = db
      .select({
        id: pacientes.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        status: pacientes.status,
        tratamentoTipo: pacientes.tratamentoTipo,
        dataNascimento: pacientes.dataNascimento,
        createdAt: pacientes.createdAt,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(pacientes.createdAt))
      .$dynamic();

    if (filtros?.busca) {
      query = query.where(
        and(...conditions, ilike(users.nome, `%${filtros.busca}%`)),
      );
    }

    const resultado = await query;

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}

/**
 * Obtém detalhes completos de um paciente pelo ID.
 */
export async function obterPaciente(
  pacienteId: string,
): Promise<ActionResult<{
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  status: string;
  tratamentoTipo: string | null;
  dataNascimento: string | null;
  cpf: string | null;
  responsavelNome: string | null;
  responsavelCpf: string | null;
  endereco: string | null;
  medicoNome: string | null;
  createdAt: Date;
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db.execute(sql`
      SELECT
        p.id,
        u.nome,
        u.email,
        u.telefone,
        p.status,
        p.tratamento_tipo as "tratamentoTipo",
        p.data_nascimento as "dataNascimento",
        p.cpf,
        p.responsavel_nome as "responsavelNome",
        p.responsavel_cpf as "responsavelCpf",
        p.endereco,
        p.created_at as "createdAt",
        um.nome as "medicoNome"
      FROM pacientes p
      INNER JOIN users u ON p.user_id = u.id
      LEFT JOIN medicos m ON p.medico_id = m.id
      LEFT JOIN users um ON m.user_id = um.id
      WHERE p.id = ${pacienteId}
        AND p.deleted_at IS NULL
      LIMIT 1
    `);

    if (!resultado.rows || resultado.rows.length === 0) {
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    return { sucesso: true, dados: resultado.rows[0] as unknown as {
      id: string;
      nome: string;
      email: string;
      telefone: string | null;
      status: string;
      tratamentoTipo: string | null;
      dataNascimento: string | null;
      cpf: string | null;
      responsavelNome: string | null;
      responsavelCpf: string | null;
      endereco: string | null;
      medicoNome: string | null;
      createdAt: Date;
    }};
  } catch (error) {
    console.error('[Action] Erro ao obter paciente:', error);
    return { sucesso: false, erro: 'Erro ao obter paciente' };
  }
}

/**
 * Obtém KPIs do dashboard do médico.
 */
export async function obterKpisMedico(): Promise<ActionResult<{
  totalPacientes: number;
  aguardandoConsulta: number;
  emTratamento: number;
  concluidos: number;
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const medicoId = await obterMedicoIdDoUsuario(auth.clerkId!);

    const medicoFilter = auth.role === 'medico' && medicoId
      ? sql`AND p.medico_id = ${medicoId}`
      : sql``;

    const resultado = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE p.deleted_at IS NULL) as "totalPacientes",
        COUNT(*) FILTER (WHERE p.status = 'aguardando_consulta' AND p.deleted_at IS NULL) as "aguardandoConsulta",
        COUNT(*) FILTER (WHERE p.status = 'em_tratamento' AND p.deleted_at IS NULL) as "emTratamento",
        COUNT(*) FILTER (WHERE p.status = 'concluido' AND p.deleted_at IS NULL) as "concluidos"
      FROM pacientes p
      WHERE 1=1 ${medicoFilter}
    `);

    const row = resultado.rows[0] as Record<string, string>;

    return {
      sucesso: true,
      dados: {
        totalPacientes: parseInt(row.totalPacientes || '0'),
        aguardandoConsulta: parseInt(row.aguardandoConsulta || '0'),
        emTratamento: parseInt(row.emTratamento || '0'),
        concluidos: parseInt(row.concluidos || '0'),
      },
    };
  } catch (error) {
    console.error('[Action] Erro ao obter KPIs:', error);
    return { sucesso: false, erro: 'Erro ao obter KPIs' };
  }
}

// ── Helpers privados ──────────────────────────────────────────

import { medicos } from '@/db/schema';

/**
 * Busca o medicoId a partir do clerkId do usuário.
 */
async function obterMedicoIdDoUsuario(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) return null;

  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id))
    .limit(1);

  return medico?.id ?? null;
}
