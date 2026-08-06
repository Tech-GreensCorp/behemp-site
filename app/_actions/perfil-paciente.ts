'use server';

import { db } from '@/lib/db';
import { users, pacientes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { obterUsuarioAtual } from '@/lib/auth';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Retorna nome, email e telefone do paciente autenticado
 * para pré-preencher formulários (ex: recompra).
 */
export async function obterPerfilContato(): Promise<{
  sucesso: boolean;
  dados?: { nome: string; email: string; telefone: string | null };
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const [user] = await db
      .select({ nome: users.nome, email: users.email, telefone: users.telefone })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

    return { sucesso: true, dados: { nome: user.nome, email: user.email, telefone: user.telefone } };
  } catch (error) {
    console.error('[Action] Erro ao obter perfil de contato:', error);
    return { sucesso: false, erro: 'Erro ao carregar perfil' };
  }
}

const telefoneSchema = z.object({
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s\(\)\-\+]{8,20}$/, 'Telefone inválido. Use apenas números, espaços e os caracteres ( ) - +')
    .or(z.literal('')),
});

/**
 * Atualiza o telefone do usuário autenticado diretamente na tabela users.
 * Não depende do Clerk — funciona no plano gratuito.
 */
export async function atualizarTelefonePaciente(telefone: string): Promise<{
  sucesso: boolean;
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const parsed = telefoneSchema.safeParse({ telefone });
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const telefoneFinal = parsed.data.telefone === '' ? null : parsed.data.telefone;

    await db
      .update(users)
      .set({ telefone: telefoneFinal })
      .where(eq(users.clerkId, auth.clerkId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar telefone:', error);
    return { sucesso: false, erro: 'Erro ao salvar telefone' };
  }
}

const perfilCompletoSchema = z.object({
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s\(\)\-\+]{8,20}$/, 'Telefone inválido. Use apenas números, espaços e os caracteres ( ) - +')
    .or(z.literal(''))
    .nullable()
    .optional(),
  cep: z.string().trim().max(20, 'CEP inválido').or(z.literal('')).nullable().optional(),
  endereco: z.string().trim().max(300, 'Endereço muito longo').or(z.literal('')).nullable().optional(),
  cidade: z.string().trim().max(150, 'Cidade muito longa').or(z.literal('')).nullable().optional(),
  uf: z.string().trim().max(10, 'UF inválida').or(z.literal('')).nullable().optional(),
  cpf: z.string().trim().max(30, 'CPF inválido').or(z.literal('')).nullable().optional(),
  rg: z.string().trim().max(30, 'RG inválido').or(z.literal('')).nullable().optional(),
  genero: z.string().trim().max(50, 'Gênero inválido').or(z.literal('')).nullable().optional(),
  dataNascimento: z.string().trim().or(z.literal('')).nullable().optional(),
});

export async function obterPerfilCompletoPaciente(): Promise<{
  sucesso: boolean;
  dados?: {
    id: string;
    pacienteId: string | null;
    nome: string;
    email: string;
    telefone: string | null;
    cep: string | null;
    endereco: string | null;
    cidade: string | null;
    uf: string | null;
    cpf: string | null;
    rg: string | null;
    genero: string | null;
    dataNascimento: string | null;
  };
  erro?: string;
}> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const [user] = await db
      .select({
        id: users.id,
        pacienteId: pacientes.id,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        cep: pacientes.cep,
        endereco: pacientes.endereco,
        cidade: pacientes.cidade,
        uf: pacientes.uf,
        cpf: pacientes.cpf,
        rg: pacientes.rg,
        genero: pacientes.genero,
        dataNascimento: pacientes.dataNascimento,
      })
      .from(users)
      .leftJoin(pacientes, eq(users.id, pacientes.userId))
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

    return { sucesso: true, dados: user };
  } catch (error) {
    console.error('[Action] Erro ao obter perfil completo do paciente:', error);
    return { sucesso: false, erro: 'Erro ao carregar perfil completo' };
  }
}

export async function atualizarPerfilCompletoPaciente(dados: {
  telefone?: string | null;
  cep?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cpf?: string | null;
  rg?: string | null;
  genero?: string | null;
  dataNascimento?: string | null;
}): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const parsed = perfilCompletoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    if (!user) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Atualizar users
    const updateUserData: { telefone?: string | null } = {};
    if (parsed.data.telefone !== undefined) {
      updateUserData.telefone = parsed.data.telefone === '' ? null : parsed.data.telefone;
    }

    if (Object.keys(updateUserData).length > 0) {
      await db.update(users).set(updateUserData).where(eq(users.id, user.id));
    }

    // Atualizar pacientes
    const updatePacienteData: Record<string, unknown> = {};
    if (parsed.data.cep !== undefined) updatePacienteData.cep = parsed.data.cep === '' ? null : parsed.data.cep;
    if (parsed.data.endereco !== undefined) updatePacienteData.endereco = parsed.data.endereco === '' ? null : parsed.data.endereco;
    if (parsed.data.cidade !== undefined) updatePacienteData.cidade = parsed.data.cidade === '' ? null : parsed.data.cidade;
    if (parsed.data.uf !== undefined) updatePacienteData.uf = parsed.data.uf === '' ? null : parsed.data.uf;
    if (parsed.data.cpf !== undefined) updatePacienteData.cpf = parsed.data.cpf === '' ? null : parsed.data.cpf;
    if (parsed.data.rg !== undefined) updatePacienteData.rg = parsed.data.rg === '' ? null : parsed.data.rg;
    if (parsed.data.genero !== undefined) updatePacienteData.genero = parsed.data.genero === '' ? null : parsed.data.genero;
    if (parsed.data.dataNascimento !== undefined) {
      updatePacienteData.dataNascimento = parsed.data.dataNascimento === '' ? null : parsed.data.dataNascimento;
    }

    if (Object.keys(updatePacienteData).length > 0) {
      const [paciente] = await db
        .select({ id: pacientes.id })
        .from(pacientes)
        .where(eq(pacientes.userId, user.id))
        .limit(1);

      if (paciente) {
        await db
          .update(pacientes)
          .set(updatePacienteData)
          .where(eq(pacientes.id, paciente.id));
      } else {
        await db.insert(pacientes).values({
          userId: user.id,
          ...updatePacienteData,
        });
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar perfil completo do paciente:', error);
    return { sucesso: false, erro: 'Erro ao salvar perfil completo' };
  }
}

export async function excluirMinhaConta(): Promise<{ sucesso: boolean; erro?: string }> {
  try {
    const auth = await obterUsuarioAtual();
    if (!auth.autorizado || !auth.clerkId) {
      return { sucesso: false, erro: 'Não autenticado' };
    }

    const client = await clerkClient();

    // 1. Buscar usuário no banco
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId))
      .limit(1);

    // 2. Deletar no Clerk
    await client.users.deleteUser(auth.clerkId);

    // 3. Soft delete no banco (users e pacientes)
    if (user) {
      const agora = new Date();
      await db
        .update(users)
        .set({ deletedAt: agora })
        .where(eq(users.id, user.id));

      await db
        .update(pacientes)
        .set({ deletedAt: agora })
        .where(eq(pacientes.userId, user.id));
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao excluir conta própria:', error);
    return { sucesso: false, erro: 'Erro ao excluir conta' };
  }
}
