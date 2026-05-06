'use server';

import { db } from '@/lib/db';
import { pacientes, users, medicos, anamneses, evolucoes } from '@/db/schema';
import { eq, and, isNull, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Server Actions de gestão de pacientes.
 */

// ── Schemas ───────────────────────────────────────────────────

const criarPacienteSchema = z.object({
  nome: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  cpf: z.string().optional(),
  responsavelNome: z.string().optional(),
  responsavelCpf: z.string().optional(),
  medicoId: z.string().optional(),
  tratamentoTipo: z.enum(['cbd', 'thc', 'cbd_thc']).optional(),
  endereco: z.string().optional(),
});

const atualizarPacienteSchema = criarPacienteSchema
  .partial()
  .extend({ pacienteId: z.string().min(1) });

const criarAnamneseSchema = z.object({
  pacienteId: z.string().min(1),
  conteudo: z.string().min(1, 'Conteúdo da anamnese é obrigatório'),
  criadoPor: z.string().min(1, 'Médico é obrigatório'),
});

const criarEvolucaoSchema = z.object({
  pacienteId: z.string().min(1),
  data: z.string().min(1),
  conteudo: z.string().min(1),
  nivelDor: z.number().int().min(0).max(10).optional(),
  qualidadeSono: z.number().int().min(0).max(10).optional(),
  bemEstar: z.number().int().min(0).max(10).optional(),
  criadoPor: z.string().min(1),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria um novo paciente (cria user + registro de paciente).
 */
export async function criarPaciente(
  dados: z.infer<typeof criarPacienteSchema>,
): Promise<ActionResult<{ pacienteId: string }>> {
  try {
    const parsed = criarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Verificar se já existe user com esse email
    const [existente] = await db
      .select()
      .from(users)
      .where(eq(users.email, parsed.data.email))
      .limit(1);

    let userId: string;

    if (existente) {
      userId = existente.id;
    } else {
      // Criar user
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

    // Criar paciente
    const [novoPaciente] = await db
      .insert(pacientes)
      .values({
        userId,
        medicoId: parsed.data.medicoId,
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
    return { sucesso: false, erro: 'Erro interno ao criar paciente' };
  }
}

/**
 * Atualiza dados de um paciente.
 */
export async function atualizarPaciente(
  dados: z.infer<typeof atualizarPacienteSchema>,
): Promise<ActionResult> {
  try {
    const parsed = atualizarPacienteSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { pacienteId, nome, email, telefone, ...dadosPaciente } = parsed.data;

    // Atualizar dados do paciente
    await db
      .update(pacientes)
      .set({
        ...dadosPaciente,
        updatedAt: new Date(),
      })
      .where(eq(pacientes.id, pacienteId));

    // Atualizar dados do user se fornecidos
    if (nome || email || telefone) {
      const [paciente] = await db
        .select({ userId: pacientes.userId })
        .from(pacientes)
        .where(eq(pacientes.id, pacienteId))
        .limit(1);

      if (paciente) {
        const updateUser: Record<string, unknown> = {};
        if (nome) updateUser.nome = nome;
        if (email) updateUser.email = email;
        if (telefone) updateUser.telefone = telefone;

        await db
          .update(users)
          .set(updateUser)
          .where(eq(users.id, paciente.userId));
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar paciente:', error);
    return { sucesso: false, erro: 'Erro ao atualizar paciente' };
  }
}

/**
 * Lista pacientes de um médico com filtros.
 */
export async function listarPacientes(params: {
  medicoId?: string;
  busca?: string;
  status?: string;
  tratamento?: string;
}): Promise<ActionResult> {
  try {
    const condicoes = [isNull(pacientes.deletedAt)];

    if (params.medicoId) {
      condicoes.push(eq(pacientes.medicoId, params.medicoId));
    }
    if (params.status) {
      condicoes.push(
        eq(
          pacientes.status,
          params.status as 'aguardando_consulta' | 'em_tratamento' | 'concluido' | 'arquivado',
        ),
      );
    }
    if (params.tratamento) {
      condicoes.push(
        eq(
          pacientes.tratamentoTipo,
          params.tratamento as 'cbd' | 'thc' | 'cbd_thc',
        ),
      );
    }

    let query = db
      .select({
        paciente: pacientes,
        user: users,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(and(...condicoes))
      .orderBy(desc(pacientes.createdAt));

    // Filtro de busca por nome
    if (params.busca) {
      query = db
        .select({
          paciente: pacientes,
          user: users,
        })
        .from(pacientes)
        .innerJoin(users, eq(pacientes.userId, users.id))
        .where(and(...condicoes, ilike(users.nome, `%${params.busca}%`)))
        .orderBy(desc(pacientes.createdAt));
    }

    const resultado = await query;
    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar pacientes:', error);
    return { sucesso: false, erro: 'Erro ao listar pacientes' };
  }
}

/**
 * Busca detalhes completos de um paciente.
 */
export async function buscarPaciente(
  pacienteId: string,
): Promise<ActionResult> {
  try {
    const [resultado] = await db
      .select({
        paciente: pacientes,
        user: users,
        medico: medicos,
      })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .leftJoin(medicos, eq(pacientes.medicoId, medicos.id))
      .where(eq(pacientes.id, pacienteId))
      .limit(1);

    if (!resultado) {
      return { sucesso: false, erro: 'Paciente não encontrado' };
    }

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao buscar paciente:', error);
    return { sucesso: false, erro: 'Erro ao buscar paciente' };
  }
}

/**
 * Cria anamnese para um paciente.
 */
export async function criarAnamnese(
  dados: z.infer<typeof criarAnamneseSchema>,
): Promise<ActionResult<{ anamneseId: string }>> {
  try {
    const parsed = criarAnamneseSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [nova] = await db
      .insert(anamneses)
      .values({
        pacienteId: parsed.data.pacienteId,
        conteudo: parsed.data.conteudo,
        criadoPor: parsed.data.criadoPor,
      })
      .returning({ id: anamneses.id });

    return { sucesso: true, dados: { anamneseId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar anamnese:', error);
    return { sucesso: false, erro: 'Erro ao criar anamnese' };
  }
}

/**
 * Cria evolução clínica para um paciente.
 */
export async function criarEvolucao(
  dados: z.infer<typeof criarEvolucaoSchema>,
): Promise<ActionResult<{ evolucaoId: string }>> {
  try {
    const parsed = criarEvolucaoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [nova] = await db
      .insert(evolucoes)
      .values({
        pacienteId: parsed.data.pacienteId,
        data: parsed.data.data,
        conteudo: parsed.data.conteudo,
        nivelDor: parsed.data.nivelDor,
        qualidadeSono: parsed.data.qualidadeSono,
        bemEstar: parsed.data.bemEstar,
        criadoPor: parsed.data.criadoPor,
      })
      .returning({ id: evolucoes.id });

    return { sucesso: true, dados: { evolucaoId: nova.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar evolução:', error);
    return { sucesso: false, erro: 'Erro ao criar evolução' };
  }
}

/**
 * Lista evoluções de um paciente.
 */
export async function listarEvolucoes(
  pacienteId: string,
): Promise<ActionResult<typeof evolucoes.$inferSelect[]>> {
  try {
    const resultado = await db
      .select()
      .from(evolucoes)
      .where(
        and(eq(evolucoes.pacienteId, pacienteId), isNull(evolucoes.deletedAt)),
      )
      .orderBy(desc(evolucoes.data));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar evoluções:', error);
    return { sucesso: false, erro: 'Erro ao listar evoluções' };
  }
}
