'use server';

import { db } from '@/lib/db';
import { users, pacientes } from '@/db/schema';
import { and, eq, isNull, notLike, sql } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { verificarAdmin } from '@/lib/auth';
import { registrarAuditoria } from '@/lib/utils/audit';
import { garantirContaDeAcesso } from '@/lib/pacientes/conta-de-acesso';
import {
  CHAVE_LOGIN_SIMPLIFICADO,
  senhaDoPacienteSchema,
  temLoginSimplificado,
} from '@/lib/auth/login-simplificado';

/**
 * Acesso do paciente ao sistema — só ADMIN.
 *
 *   · `consultarAcessoDoUsuario`  — o estado, para o diálogo da tela de usuários
 *   · `criarAcessoDoUsuario`      — cria o login de quem foi cadastrado pela equipe e nunca teve um
 *   · `criarAcessosPendentes`     — o mesmo em lote, para os que já estavam sem login
 *   · `definirSenhaDoPaciente`    — define/redefine a senha (o admin comunica por outro canal)
 *   · `alterarLoginSimplificado`  — libera/revoga a entrada só com senha (sem o código por e-mail)
 *
 * Quem pode ler/escrever: `admin`, e só sobre `role = 'paciente'`. Retenção: nenhuma coluna nova — o
 * flag fica no `privateMetadata` do Clerk e morre com a conta. Auditoria: toda escrita registra
 * QUEM, QUANDO e O QUE mudou em `logs_auditoria`.
 *
 * 🔴 NENHUMA RESPOSTA DESTAS ACTIONS CARREGA SENHA, e nenhum log também. A senha entra, vai ao
 * Clerk (que guarda o hash) e some. A auditoria registra só "senhaRedefinida: true".
 */

type Resultado<T = undefined> = { sucesso: boolean; dados?: T; erro?: string };

const idSchema = z.string().min(1).max(64);

/** Tamanho do lote do `criarAcessosPendentes`: cada paciente custa 2-3 chamadas ao Clerk. */
const TAMANHO_DO_LOTE = 25;

const MENSAGEM_SEM_PERMISSAO = 'Sem permissão';

// ── Auxiliares ────────────────────────────────────────────────────

async function alvoPaciente(usuarioId: string) {
  const [u] = await db
    .select({ id: users.id, clerkId: users.clerkId, role: users.role })
    .from(users)
    .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
    .limit(1);
  return u;
}

async function auditar(
  adminClerkId: string | undefined,
  usuarioId: string | undefined,
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
    acao: 'atualizar',
    entidade: 'users',
    entidadeId: usuarioId,
    dadosAntes: antes,
    dadosDepois: depois,
  });
}

/** Traduz o erro da Backend API do Clerk. Sem eco do que foi enviado (a senha estaria nele). */
function mensagemDoClerk(erro: unknown): string {
  const codigo = (erro as { errors?: { code?: string }[] })?.errors?.[0]?.code;
  switch (codigo) {
    case 'form_password_pwned':
      return 'Esta senha apareceu em vazamentos de dados. Escolha outra (ou use "Gerar senha").';
    case 'form_password_length_too_short':
    case 'form_password_not_strong_enough':
    case 'form_password_validation_failed':
      return 'A senha é fraca demais. Use uma mais longa e variada (ou use "Gerar senha").';
    default:
      return 'Não foi possível concluir no Clerk. Nada foi alterado; tente novamente.';
  }
}

// ── Estado ────────────────────────────────────────────────────────

export type AcessoDoUsuario = {
  ehPaciente: boolean;
  /** Existe login no Clerk (o paciente consegue, no mínimo, entrar por código). */
  temConta: boolean;
  /** O login tem senha definida (necessário para o login sem código). */
  temSenha: boolean;
  loginSimplificado: boolean;
};

export async function consultarAcessoDoUsuario(
  usuarioId: string,
): Promise<Resultado<AcessoDoUsuario>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };
    const id = idSchema.safeParse(usuarioId);
    if (!id.success) return { sucesso: false, erro: 'Dados inválidos' };

    const u = await alvoPaciente(id.data);
    if (!u) return { sucesso: false, erro: 'Usuário não encontrado' };
    if (u.role !== 'paciente' || !u.clerkId) {
      return {
        sucesso: true,
        dados: {
          ehPaciente: u.role === 'paciente',
          temConta: Boolean(u.clerkId),
          temSenha: false,
          loginSimplificado: false,
        },
      };
    }

    const client = await clerkClient();
    const c = await client.users.getUser(u.clerkId);
    return {
      sucesso: true,
      dados: {
        ehPaciente: true,
        temConta: true,
        temSenha: c.passwordEnabled,
        loginSimplificado: temLoginSimplificado(c.privateMetadata),
      },
    };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao consultar o acesso do usuário:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível consultar o acesso' };
  }
}

// ── Criar o login ─────────────────────────────────────────────────

export async function criarAcessoDoUsuario(usuarioId: string): Promise<Resultado> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };
    const id = idSchema.safeParse(usuarioId);
    if (!id.success) return { sucesso: false, erro: 'Dados inválidos' };

    const r = await garantirContaDeAcesso(id.data);
    if (!r.ok) return { sucesso: false, erro: r.erro };

    if (r.situacao !== 'ja_tinha') {
      await auditar(
        auth.clerkId,
        id.data,
        { temConta: false },
        { temConta: true, situacao: r.situacao },
      );
    }
    return { sucesso: true };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao criar o acesso:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível criar o acesso' };
  }
}

/** Pacientes ativos, com ficha ativa, sem login no Clerk. Fora os e-mails de usuário apagado. */
function condicaoDePendentes() {
  return and(
    eq(users.role, 'paciente'),
    isNull(users.deletedAt),
    isNull(users.clerkId),
    notLike(users.email, '%@removido.invalid'),
  );
}

export async function contarAcessosPendentes(): Promise<Resultado<{ pendentes: number }>> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };

    const [linha] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(pacientes, and(eq(pacientes.userId, users.id), isNull(pacientes.deletedAt)))
      .where(condicaoDePendentes());
    return { sucesso: true, dados: { pendentes: linha?.n ?? 0 } };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao contar acessos pendentes:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível contar' };
  }
}

/**
 * Cria o login de até 25 pacientes sem acesso por chamada. Clique de novo para o próximo lote:
 * `restantes` diz quantos faltam. Quem falha (e-mail inválido ou duplicado) continua pendente e o
 * motivo volta em `falhas`, sem e-mail: corrija o cadastro e rode de novo.
 *
 * Criar o login NÃO envia e-mail nem dá senha: o paciente entra por "Esqueci a senha / código", ou
 * o admin define uma senha no diálogo do paciente.
 */
export async function criarAcessosPendentes(): Promise<
  Resultado<{
    criados: number;
    vinculados: number;
    falhas: { usuarioId: string; motivo: string }[];
    restantes: number;
  }>
> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };

    const lote = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(pacientes, and(eq(pacientes.userId, users.id), isNull(pacientes.deletedAt)))
      .where(condicaoDePendentes())
      .orderBy(users.createdAt)
      .limit(TAMANHO_DO_LOTE);

    let criados = 0;
    let vinculados = 0;
    const falhas: { usuarioId: string; motivo: string }[] = [];
    for (const { id } of lote) {
      const r = await garantirContaDeAcesso(id);
      if (!r.ok) falhas.push({ usuarioId: id, motivo: r.motivo });
      else if (r.situacao === 'criada') criados += 1;
      else if (r.situacao === 'vinculada') vinculados += 1;
    }

    if (criados + vinculados > 0) {
      await auditar(
        auth.clerkId,
        undefined,
        {},
        { lote: { criados, vinculados, falhas: falhas.length } },
      );
    }

    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .innerJoin(pacientes, and(eq(pacientes.userId, users.id), isNull(pacientes.deletedAt)))
      .where(condicaoDePendentes());

    return { sucesso: true, dados: { criados, vinculados, falhas, restantes: n } };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao criar acessos pendentes:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível criar os acessos' };
  }
}

// ── Senha ─────────────────────────────────────────────────────────

/**
 * Define (ou redefine) a senha do paciente. Cria o login antes, se ainda não existe.
 * Derruba as outras sessões: quem redefine a senha de uma conta espera que o acesso antigo caia.
 * A senha NÃO é conferida contra `skipPasswordChecks`: o Clerk recusa a vazada.
 */
export async function definirSenhaDoPaciente(usuarioId: string, senha: string): Promise<Resultado> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };
    const id = idSchema.safeParse(usuarioId);
    if (!id.success) return { sucesso: false, erro: 'Dados inválidos' };
    const s = senhaDoPacienteSchema.safeParse(senha);
    if (!s.success) return { sucesso: false, erro: s.error.issues[0].message };

    const u = await alvoPaciente(id.data);
    if (!u) return { sucesso: false, erro: 'Usuário não encontrado' };
    if (u.role !== 'paciente') {
      return { sucesso: false, erro: 'Esta tela só define senha de paciente.' };
    }

    const acesso = await garantirContaDeAcesso(u.id);
    if (!acesso.ok) return { sucesso: false, erro: acesso.erro };

    try {
      const client = await clerkClient();
      await client.users.updateUser(acesso.clerkId, {
        password: s.data,
        signOutOfOtherSessions: true,
      });
    } catch (e) {
      console.error('[Acesso] Clerk recusou a senha:', {
        usuarioId: u.id,
        codigo: (e as { errors?: { code?: string }[] })?.errors?.[0]?.code ?? 'desconhecido',
      });
      return { sucesso: false, erro: mensagemDoClerk(e) };
    }

    await auditar(auth.clerkId, u.id, {}, { senhaRedefinida: true });
    return { sucesso: true };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao definir a senha:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível definir a senha' };
  }
}

// ── Login simplificado ────────────────────────────────────────────

/**
 * Libera ou revoga a entrada só com senha. Decisão INDIVIDUAL do admin, por paciente: nada muda
 * para os demais usuários nem para a verificação por e-mail da instância.
 *
 * Só se liga com senha definida: sem ela, o paciente seria liberado para uma tela que não consegue
 * usar. Desligar não apaga a senha — o paciente volta ao fluxo normal.
 */
export async function alterarLoginSimplificado(
  usuarioId: string,
  ativo: boolean,
): Promise<Resultado> {
  try {
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: MENSAGEM_SEM_PERMISSAO };
    const id = idSchema.safeParse(usuarioId);
    if (!id.success || typeof ativo !== 'boolean')
      return { sucesso: false, erro: 'Dados inválidos' };

    const u = await alvoPaciente(id.data);
    if (!u) return { sucesso: false, erro: 'Usuário não encontrado' };
    if (u.role !== 'paciente') {
      // Admin e médico nunca: com a senha como único fator, seria abrir a porta mais valiosa.
      return { sucesso: false, erro: 'O login sem código só vale para pacientes.' };
    }
    if (!u.clerkId) {
      return {
        sucesso: false,
        erro: 'Este paciente ainda não tem login. Crie o acesso e defina a senha primeiro.',
      };
    }

    const client = await clerkClient();
    const c = await client.users.getUser(u.clerkId);
    const antes = temLoginSimplificado(c.privateMetadata);
    if (ativo && !c.passwordEnabled) {
      return {
        sucesso: false,
        erro: 'Defina uma senha para o paciente antes de liberar o login sem código.',
      };
    }
    if (antes === ativo) return { sucesso: true };

    // `null` remove a chave (merge do Clerk); `true` a grava.
    await client.users.updateUserMetadata(u.clerkId, {
      privateMetadata: { [CHAVE_LOGIN_SIMPLIFICADO]: ativo ? true : null },
    });

    await auditar(auth.clerkId, u.id, { loginSimplificado: antes }, { loginSimplificado: ativo });
    return { sucesso: true };
  } catch (error) {
    console.error(
      '[Acesso] Erro ao alterar o login simplificado:',
      error instanceof Error ? error.name : 'desconhecido',
    );
    return { sucesso: false, erro: 'Não foi possível alterar o acesso' };
  }
}
