'use server';

import { db } from '@/lib/db';
import { users, pacientes, medicos, consultas } from '@/db/schema';
import { eq, and, ne, isNull, inArray, gt, asc, desc, sql } from 'drizzle-orm';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

/**
 * Server Actions de administração de usuários.
 * Somente role admin pode acessar.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

interface UsuarioAdmin {
  id: string;
  clerkId: string | null;
  nome: string;
  email: string;
  telefone: string | null;
  role: string | null;
  createdAt: Date;
}

/**
 * Lista todos os usuários com contagem por role.
 * Suporta paginação server-side e ordenação dinâmica.
 */
export async function listarUsuariosAdmin(params?: {
  busca?: string;
  role?: string;
  pagina?: number;
  porPagina?: number;
  ordenarPor?: 'nome' | 'email' | 'createdAt';
  direcao?: 'asc' | 'desc';
}): Promise<ActionResult<{
  usuarios: UsuarioAdmin[];
  total: number;
  totalFiltrado: number;
  totalPaginas: number;
  porRole: { admins: number; medicos: number; pacientes: number };
}>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const pagina = Math.max(1, params?.pagina ?? 1);
    const porPagina = Math.min(100, Math.max(1, params?.porPagina ?? 20));
    const offset = (pagina - 1) * porPagina;

    // --- Condições de filtro ---
    // Usuário apagado (soft delete) não aparece, nem nas contagens.
    const condicoes = [sql`${users.deletedAt} IS NULL`];

    if (params?.busca) {
      condicoes.push(
        sql`(${users.nome} ILIKE ${`%${params.busca}%`} OR ${users.email} ILIKE ${`%${params.busca}%`})`,
      );
    }
    if (params?.role) {
      condicoes.push(eq(users.role, params.role as 'admin' | 'medico' | 'paciente'));
    }

    const whereClause =
      condicoes.length > 0
        ? sql`${sql.join(condicoes, sql` AND `)}`
        : undefined;

    // --- Ordenação dinâmica ---
    const colunaOrdenacao = {
      nome: users.nome,
      email: users.email,
      createdAt: users.createdAt,
    }[params?.ordenarPor ?? 'createdAt'];

    const direcaoFn = (params?.direcao ?? 'desc') === 'asc' ? asc : desc;
    const orderBy = direcaoFn(colunaOrdenacao);

    // --- Query principal com paginação ---
    const resultado = await db
      .select({
        id: users.id,
        clerkId: users.clerkId,
        nome: users.nome,
        email: users.email,
        telefone: users.telefone,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(porPagina)
      .offset(offset);

    // --- Contagem filtrada (para paginação) ---
    const [contagemFiltrada] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(users)
      .where(whereClause);

    const totalFiltrado = contagemFiltrada?.count ?? 0;
    const totalPaginas = Math.max(1, Math.ceil(totalFiltrado / porPagina));

    // --- Contagem global por role (KPIs) ---
    const contagem = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE role = 'admin')::int as admins,
        COUNT(*) FILTER (WHERE role = 'medico')::int as medicos,
        COUNT(*) FILTER (WHERE role = 'paciente')::int as pacientes,
        COUNT(*)::int as total
      FROM users
      WHERE deleted_at IS NULL
    `);

    const c = contagem.rows[0] as { admins: number; medicos: number; pacientes: number; total: number };

    return {
      sucesso: true,
      dados: {
        usuarios: resultado,
        total: c.total,
        totalFiltrado,
        totalPaginas,
        porRole: {
          admins: c.admins,
          medicos: c.medicos,
          pacientes: c.pacientes,
        },
      },
    };
  } catch (error) {
    console.error('[Admin] Erro ao listar usuários:', error);
    return { sucesso: false, erro: 'Erro ao listar usuários' };
  }
}


const atualizarUsuarioSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').max(100).optional(),
  telefone: z
    .string()
    .trim()
    .regex(/^[\d\s\(\)\-\+]{8,20}$/, 'Telefone inválido')
    .or(z.literal(''))
    .optional(),
});

/**
 * Atualiza nome e/ou telefone de um usuário (salva no banco).
 * O nome também é sincronizado com o Clerk para manter consistência.
 */
export async function atualizarUsuarioAdmin(
  usuarioId: string,
  dados: { nome?: string; telefone?: string },
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarUsuarioSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar o usuário (ativo) — e o estado ANTES, para a auditoria.
    const [usuario] = await db
      .select({ clerkId: users.clerkId, nome: users.nome, telefone: users.telefone })
      .from(users)
      .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Montar atualização no banco
    const update: Partial<{ nome: string; telefone: string | null }> = {};
    if (parsed.data.nome !== undefined) update.nome = parsed.data.nome;
    if (parsed.data.telefone !== undefined) {
      update.telefone = parsed.data.telefone === '' ? null : parsed.data.telefone;
    }

    if (Object.keys(update).length > 0) {
      await db.update(users).set(update).where(eq(users.id, usuarioId));

      await auditarUsuario(auth.clerkId, 'atualizar', usuarioId,
        { nome: usuario.nome, telefone: usuario.telefone },
        { nome: update.nome ?? usuario.nome, telefone: 'telefone' in update ? update.telefone : usuario.telefone },
      );
    }

    // Sincronizar nome com Clerk
    if (parsed.data.nome && usuario.clerkId) {
      try {
        const client = await clerkClient();
        const partes = parsed.data.nome.trim().split(' ');
        const firstName = partes[0];
        const lastName = partes.slice(1).join(' ') || '';
        await client.users.updateUser(usuario.clerkId, { firstName, lastName });
      } catch (clerkError) {
        console.warn('[Admin] Falha ao sincronizar nome com Clerk (banco atualizado):', clerkError);
      }
    }

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao atualizar usuário:', error);
    return { sucesso: false, erro: 'Erro ao atualizar usuário' };
  }
}

/**
 * Altera a role de um usuário (banco + publicMetadata do Clerk).
 * Não permite remover a própria role de admin.
 */
export async function alterarRoleUsuario(
  usuarioId: string,
  novaRole: 'admin' | 'paciente',
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = papelSchema.safeParse({ usuarioId, novaRole });
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

    const [usuario] = await db
      .select({ clerkId: users.clerkId, role: users.role })
      .from(users)
      .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Médico fica fora: virar/deixar de ser médico mexe em `medicos` e nas ~18 tabelas
    // que apontam para ela (ADR-0025 D-04). Esta tela só alterna admin ↔ paciente.
    if (usuario.role === 'medico') {
      return { sucesso: false, erro: 'O papel de um médico não pode ser alterado por esta tela' };
    }
    if (usuario.role === novaRole) return { sucesso: true };

    // A identidade de quem está logado vem do SERVIDOR (auth.clerkId), nunca do cliente.
    if (usuario.clerkId === auth.clerkId && novaRole !== 'admin') {
      return { sucesso: false, erro: 'Você não pode alterar sua própria role de admin' };
    }
    if (usuario.role === 'admin' && novaRole !== 'admin' && !(await existeOutroAdmin(usuarioId))) {
      return { sucesso: false, erro: 'Este é o único admin ativo: não pode deixar de ser admin' };
    }

    // O papel EFETIVO é lido do Clerk primeiro (obterRoleComFallback). Por isso o Clerk vai
    // antes do banco e a falha dele aborta: atualizar só o banco mudaria nada na prática.
    if (usuario.clerkId) {
      try {
        const client = await clerkClient();
        await client.users.updateUserMetadata(usuario.clerkId, {
          publicMetadata: { role: novaRole },
        });
      } catch (clerkError) {
        console.error('[Admin] Falha ao sincronizar role com Clerk:', clerkError);
        return { sucesso: false, erro: 'Não foi possível atualizar o papel no Clerk. Nada foi alterado.' };
      }
    }

    await db.update(users).set({ role: novaRole }).where(eq(users.id, usuarioId));

    // Quem vira paciente precisa de ficha ativa (o webhook do Clerk cria no cadastro; aqui
    // o usuário já existia). Sem médico: o admin atribui depois, como nos demais.
    if (novaRole === 'paciente') {
      await db
        .insert(pacientes)
        .values({ userId: usuarioId, medicoId: null, status: 'aguardando_consulta', jornadaFase: 'acolhimento' })
        .onConflictDoNothing({ target: pacientes.userId });
    }

    await auditarUsuario(auth.clerkId, 'atualizar', usuarioId, { role: usuario.role }, { role: novaRole });

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao alterar role:', error);
    return { sucesso: false, erro: 'Erro ao alterar role' };
  }
}

/**
 * Apaga a conta de um usuário (admin ou paciente) — DEFINITIVO no Clerk.
 *
 * Decisão do dono (30/09/2026): "apagar definitivo no Clerk".
 *  - Clerk: o login é apagado (não tem volta; para voltar, cadastro novo).
 *  - Banco: a linha de `users` fica como soft delete (`deletedAt`) para o histórico clínico
 *    continuar apontando para alguém, mas o E-MAIL É LIBERADO (renomeado) — o índice é único,
 *    e o webhook do Clerk religa por e-mail: sem isto, quem se cadastrasse de novo herdaria a
 *    linha apagada e invisível. Telefone e clerkId são zerados. O nome fica (histórico).
 *  - Se for paciente, a ficha é arquivada junto.
 *  - A auditoria guarda o e-mail MASCARADO: o original não sobrevive em lugar nenhum.
 *
 * Recusas: a si mesmo, e o único admin ativo (a plataforma não fica sem administrador).
 *
 * MÉDICO PODE SER APAGADO (decisão do dono, 30/09/2026 — "qualquer usuário"; retifica o
 * D-04 da ADR-0025, que o deixava de fora). `medicos` não tem `deletedAt` e ~18 tabelas
 * apontam para ela, então a linha de `medicos` FICA: só o `users` vira soft delete (as listas de
 * médico já filtram `users.deleted_at`). O que a ação faz com o que depende dele:
 *  - pacientes vinculados são DESVINCULADOS e caem na fila "Atribuir Médico";
 *  - consultas futuras NÃO são canceladas sozinhas (ADR-0025 D-05 #3): o resultado devolve a
 *    contagem para o admin reatribuir ou cancelar.
 *
 * Ordem: Clerk primeiro; falha nele aborta sem tocar no banco. Se o banco falhar depois, é só
 * repetir — o Clerk "não encontrado" é tratado como já apagado.
 */
export async function excluirUsuarioAdmin(
  usuarioId: string,
): Promise<ActionResult<{ pacientesDesvinculados: number; consultasFuturas: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };

    const parsed = z.string().min(1).max(64).safeParse(usuarioId);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

    const [usuario] = await db
      .select({ id: users.id, clerkId: users.clerkId, email: users.email, role: users.role })
      .from(users)
      .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
      .limit(1);

    if (!usuario) return { sucesso: false, erro: 'Usuário não encontrado ou já apagado' };

    if (usuario.clerkId && usuario.clerkId === auth.clerkId) {
      return { sucesso: false, erro: 'Você não pode apagar a sua própria conta' };
    }
    if (usuario.role === 'admin' && !(await existeOutroAdmin(usuarioId))) {
      return { sucesso: false, erro: 'Este é o único admin ativo e não pode ser apagado' };
    }

    if (usuario.clerkId) {
      try {
        const client = await clerkClient();
        await client.users.deleteUser(usuario.clerkId);
      } catch (clerkError) {
        const status = (clerkError as { status?: number }).status;
        if (status !== 404) {
          console.error('[Admin] Falha ao apagar usuário no Clerk:', clerkError);
          return { sucesso: false, erro: 'Não foi possível apagar o login no Clerk. Nada foi alterado.' };
        }
        // 404: já não existe no Clerk (repetição de uma tentativa anterior) — segue para o banco.
      }
    }

    // Médico: desvincula os pacientes (voltam à fila "Atribuir Médico") e conta as consultas
    // futuras, que ficam como estão. Antes do `users`, e inofensivo se repetido.
    let pacientesDesvinculados = 0;
    let consultasFuturas = 0;
    if (usuario.role === 'medico') {
      const vinculos = await vinculosDoMedico(usuarioId);
      consultasFuturas = vinculos.consultasFuturas;
      if (vinculos.medicoId) {
        const soltos = await db
          .update(pacientes)
          .set({ medicoId: null })
          .where(and(eq(pacientes.medicoId, vinculos.medicoId), isNull(pacientes.deletedAt)))
          .returning({ id: pacientes.id });
        pacientesDesvinculados = soltos.length;
      }
    }

    // Ficha de paciente arquivada primeiro (inofensivo se a etapa seguinte falhar e for repetida).
    await db
      .update(pacientes)
      .set({ status: 'arquivado', deletedAt: new Date() })
      .where(and(eq(pacientes.userId, usuarioId), isNull(pacientes.deletedAt)));

    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        email: `apagado+${usuarioId}@removido.invalid`,
        telefone: null,
        clerkId: null,
      })
      .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)));

    await auditarUsuario(
      auth.clerkId,
      'deletar',
      usuarioId,
      { role: usuario.role, email: mascararEmail(usuario.email) },
      { apagado: true, pacientesDesvinculados, consultasFuturas },
    );

    return { sucesso: true, dados: { pacientesDesvinculados, consultasFuturas } };
  } catch (error) {
    console.error('[Admin] Erro ao apagar usuário:', error);
    return { sucesso: false, erro: 'Erro ao apagar usuário' };
  }
}

/**
 * O que depende de um usuário, para o diálogo de apagar mostrar ANTES de confirmar.
 * Só admin; só números (nenhum dado de paciente sai daqui).
 */
export async function resumirVinculosDoUsuario(
  usuarioId: string,
): Promise<ActionResult<{ pacientes: number; consultasFuturas: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = z.string().min(1).max(64).safeParse(usuarioId);
    if (!parsed.success) return { sucesso: false, erro: 'Dados inválidos' };

    const v = await vinculosDoMedico(usuarioId);
    return { sucesso: true, dados: { pacientes: v.pacientes, consultasFuturas: v.consultasFuturas } };
  } catch (error) {
    console.error('[Admin] Erro ao resumir vínculos do usuário:', error);
    return { sucesso: false, erro: 'Erro ao consultar vínculos' };
  }
}

// ── Auxiliares (não exportados) ──────────────────────────────────

const papelSchema = z.object({
  usuarioId: z.string().min(1).max(64),
  novaRole: z.enum(['admin', 'paciente']),
});

/** Existe OUTRO admin ativo? Impede deixar a plataforma sem administrador. */
async function existeOutroAdmin(exceto: string): Promise<boolean> {
  const [linha] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(and(eq(users.role, 'admin'), isNull(users.deletedAt), ne(users.id, exceto)));
  return (linha?.n ?? 0) > 0;
}

/** Pacientes ativos vinculados e consultas futuras que ainda disputam horário. Zeros se não for médico. */
async function vinculosDoMedico(
  usuarioId: string,
): Promise<{ medicoId: string | null; pacientes: number; consultasFuturas: number }> {
  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, usuarioId))
    .limit(1);
  if (!medico) return { medicoId: null, pacientes: 0, consultasFuturas: 0 };

  const [p] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(pacientes)
    .where(and(eq(pacientes.medicoId, medico.id), isNull(pacientes.deletedAt)));
  const [c] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(consultas)
    .where(
      and(
        eq(consultas.medicoId, medico.id),
        gt(consultas.dataHora, new Date()),
        inArray(consultas.status, ['reservada', 'agendada', 'confirmada']),
        isNull(consultas.deletedAt),
      ),
    );
  return { medicoId: medico.id, pacientes: p?.n ?? 0, consultasFuturas: c?.n ?? 0 };
}

function mascararEmail(email: string): string {
  const [local, dominio] = email.split('@');
  return `${(local ?? '').slice(0, 2)}***@${dominio ?? ''}`;
}

/** Auditoria de administração de usuário. Falha de auditoria não derruba a operação. */
async function auditarUsuario(
  adminClerkId: string | undefined,
  acao: 'atualizar' | 'deletar',
  usuarioId: string,
  antes: Record<string, unknown>,
  depois: Record<string, unknown>,
): Promise<void> {
  if (!adminClerkId) return;
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, adminClerkId))
    .limit(1);
  if (!admin) return;
  await registrarAuditoria({
    userId: admin.id,
    acao,
    entidade: 'users',
    entidadeId: usuarioId,
    dadosAntes: antes,
    dadosDepois: depois,
  });
}


const senhaTemporariaSchema = z.object({
  senha: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .max(72, 'Senha muito longa')
    .regex(/[A-Z]/, 'Deve conter ao menos uma letra maiúscula')
    .regex(/[0-9]/, 'Deve conter ao menos um número'),
});

/**
 * Define uma senha temporária para o usuário via Clerk Backend API.
 * O usuário deverá alterar a senha no próximo acesso (recomendado comunicar por outro canal).
 * skipPasswordChecks: true permite definir senhas que não passariam pelas políticas do HIBP.
 */
export async function definirSenhaTemporaria(
  clerkId: string,
  senha: string,
): Promise<ActionResult> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    if (!clerkId) return { sucesso: false, erro: 'Usuário sem conta Clerk vinculada' };

    const parsed = senhaTemporariaSchema.safeParse({ senha });
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const client = await clerkClient();
    await client.users.updateUser(clerkId, {
      password: parsed.data.senha,
      skipPasswordChecks: true, // Bypassa checagens de HIBP para senhas temporárias
    });

    return { sucesso: true };
  } catch (error) {
    console.error('[Admin] Erro ao definir senha temporária:', error);
    return { sucesso: false, erro: 'Não foi possível definir a senha temporária' };
  }
}

