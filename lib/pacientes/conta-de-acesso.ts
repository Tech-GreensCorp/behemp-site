/**
 * Garante que um paciente cadastrado pela equipe tenha CONTA DE ACESSO (login no Clerk).
 *
 * 🔴 A causa do "Não foi possível encontrar o usuário" (27/10/2026): `criarPaciente` (admin e médico)
 * grava a linha em `users` com `clerk_id` NULO e nunca cria o login no Clerk. O paciente aparece na
 * tela de usuários — que lê o banco — mas o Clerk, que autentica, não o conhece. O desenho original
 * esperava que ele se cadastrasse sozinho em /registrar-se com o mesmo e-mail (o webhook
 * `user.created` religa por e-mail); quem tenta ENTRAR, como é natural, recebe "usuário não
 * encontrado". Nenhum erro no log: o banco estava certo, o Clerk é que nunca foi chamado.
 *
 * O que esta função faz, na ordem (a ordem é o que evita duplicar usuário):
 *   1. Confere que é paciente ativo, com ficha ativa (arquivado não ganha acesso).
 *   2. Se já tem `clerk_id`, não faz nada.
 *   3. Grava o e-mail em MINÚSCULAS no banco ANTES de chamar o Clerk. O Clerk guarda e-mail em
 *      minúsculas e o webhook procura por igualdade exata: com "Maria@x.com" no banco, o
 *      `user.created` não acharia a linha e criaria um SEGUNDO usuário e uma SEGUNDA ficha.
 *   4. Procura o e-mail no Clerk. Se já existe (a pessoa se cadastrou sozinha antes), só RELIGA.
 *   5. Se não existe, cria o login SEM senha e sem enviar e-mail. O paciente entra por "Esqueci a
 *      senha / entrar por código", ou o admin define uma senha (acesso-do-paciente.ts).
 *   6. Grava o `clerk_id` com `WHERE clerk_id IS NULL`: se o webhook chegou primeiro, nada é
 *      sobrescrito. Se o banco falhar, o login recém-criado é desfeito.
 *
 * Nunca lança: devolve `ok: false` com um motivo. Nenhum e-mail vai para log (só ids).
 */
import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { users, pacientes } from '@/db/schema';
import { normalizarEmail } from '@/lib/pacientes/contato';

export type MotivoDaFalha =
  | 'sem_usuario'
  | 'nao_e_paciente'
  | 'sem_ficha_ativa'
  | 'email_invalido'
  | 'email_em_uso'
  | 'conta_ja_vinculada'
  | 'papel_divergente'
  | 'clerk_recusou';

export type ResultadoDoAcesso =
  | { ok: true; situacao: 'ja_tinha' | 'criada' | 'vinculada'; clerkId: string }
  | { ok: false; motivo: MotivoDaFalha; erro: string };

const MENSAGENS: Record<MotivoDaFalha, string> = {
  sem_usuario: 'Usuário não encontrado.',
  nao_e_paciente: 'Só pacientes recebem acesso por aqui.',
  sem_ficha_ativa: 'Este paciente está arquivado ou sem ficha ativa.',
  email_invalido: 'O e-mail deste cadastro é inválido. Corrija-o e tente de novo.',
  email_em_uso: 'Outro cadastro usa este e-mail (com outra grafia). Resolva a duplicidade antes.',
  conta_ja_vinculada: 'O login deste e-mail já está ligado a outro cadastro.',
  papel_divergente:
    'Já existe um login com este e-mail e outro papel (admin/médico). Nada foi alterado.',
  clerk_recusou: 'Não foi possível criar o login. Tente novamente.',
};

const falha = (motivo: MotivoDaFalha): ResultadoDoAcesso => ({
  ok: false,
  motivo,
  erro: MENSAGENS[motivo],
});

const emailSchema = z.string().email().max(254);

/** Códigos de erro da Backend API do Clerk, sem a mensagem (que pode eco do que foi enviado). */
function codigosDoClerk(e: unknown): string {
  const erros = (e as { errors?: Array<{ code?: string }> } | null)?.errors;
  return Array.isArray(erros) && erros.length
    ? erros.map((x) => x.code ?? '?').join(',')
    : 'desconhecido';
}

export async function garantirContaDeAcesso(usuarioId: string): Promise<ResultadoDoAcesso> {
  const [u] = await db
    .select({
      id: users.id,
      email: users.email,
      nome: users.nome,
      role: users.role,
      clerkId: users.clerkId,
    })
    .from(users)
    .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
    .limit(1);

  if (!u) return falha('sem_usuario');
  if (u.role !== 'paciente') {
    // Admin e médico têm o próprio fluxo de criação de login; não passam por aqui.
    return u.clerkId
      ? { ok: true, situacao: 'ja_tinha', clerkId: u.clerkId }
      : falha('nao_e_paciente');
  }

  const [ficha] = await db
    .select({ id: pacientes.id })
    .from(pacientes)
    .where(and(eq(pacientes.userId, u.id), isNull(pacientes.deletedAt)))
    .limit(1);
  if (!ficha) return falha('sem_ficha_ativa');

  if (u.clerkId) return { ok: true, situacao: 'ja_tinha', clerkId: u.clerkId };

  const email = normalizarEmail(u.email);
  if (!emailSchema.safeParse(email).success) return falha('email_invalido');

  // 3. E-mail em minúsculas ANTES do Clerk (ver o cabeçalho: o webhook casa por igualdade exata).
  if (email !== u.email) {
    const [outro] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, ne(users.id, u.id)))
      .limit(1);
    if (outro) return falha('email_em_uso');
    await db.update(users).set({ email }).where(eq(users.id, u.id));
  }

  try {
    const client = await clerkClient();

    // 4. Já existe login com este e-mail? Então é religar, não criar.
    const existentes = await client.users.getUserList({ emailAddress: [email], limit: 2 });
    const existente = existentes.data[0];
    if (existente) {
      const [ocupado] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.clerkId, existente.id), ne(users.id, u.id)))
        .limit(1);
      if (ocupado) return falha('conta_ja_vinculada');

      const papelNoClerk = existente.publicMetadata?.role as string | undefined;
      if (papelNoClerk && papelNoClerk !== 'paciente') return falha('papel_divergente');
      if (!papelNoClerk) {
        await client.users.updateUserMetadata(existente.id, {
          publicMetadata: { role: 'paciente' },
        });
      }

      const religou = await db
        .update(users)
        .set({ clerkId: existente.id })
        .where(and(eq(users.id, u.id), isNull(users.clerkId)))
        .returning({ id: users.id });
      if (religou.length === 0) return await jaLigado(u.id);
      return { ok: true, situacao: 'vinculada', clerkId: existente.id };
    }

    // 5. Não existe: cria o login, sem senha e sem e-mail enviado.
    const partes = u.nome.trim().split(/\s+/);
    let criado;
    try {
      criado = await client.users.createUser({
        emailAddress: [email],
        firstName: partes[0],
        lastName: partes.slice(1).join(' ') || undefined,
        skipPasswordRequirement: true,
        skipLegalChecks: true,
        publicMetadata: { role: 'paciente' },
      });
    } catch (e) {
      console.error('[Acesso] Clerk recusou criar o login:', {
        usuarioId: u.id,
        codigo: codigosDoClerk(e),
      });
      return falha('clerk_recusou');
    }

    // 6. Grava o vínculo; se o banco falhar, desfaz o login para não deixar órfão no Clerk.
    try {
      const gravou = await db
        .update(users)
        .set({ clerkId: criado.id })
        .where(and(eq(users.id, u.id), isNull(users.clerkId)))
        .returning({ id: users.id });
      if (gravou.length === 0) {
        // Chegou outro clerk_id no meio (webhook com o mesmo e-mail). Se é o mesmo, está tudo certo.
        const atual = await jaLigado(u.id);
        if (atual.ok && atual.clerkId === criado.id)
          return { ok: true, situacao: 'criada', clerkId: criado.id };
        await client.users.deleteUser(criado.id).catch(() => {});
        return atual;
      }
    } catch (e) {
      console.error('[Acesso] Falha ao gravar o vínculo; desfazendo o login:', { usuarioId: u.id });
      await client.users.deleteUser(criado.id).catch(() => {});
      throw e;
    }

    return { ok: true, situacao: 'criada', clerkId: criado.id };
  } catch (e) {
    console.error('[Acesso] Erro ao garantir a conta de acesso:', {
      usuarioId: u.id,
      codigo: codigosDoClerk(e),
    });
    return falha('clerk_recusou');
  }
}

/** Lê o vínculo que está no banco agora (alguém — o webhook — pode ter gravado no meio). */
async function jaLigado(usuarioId: string): Promise<ResultadoDoAcesso> {
  const [atual] = await db
    .select({ clerkId: users.clerkId })
    .from(users)
    .where(eq(users.id, usuarioId))
    .limit(1);
  return atual?.clerkId
    ? { ok: true, situacao: 'ja_tinha', clerkId: atual.clerkId }
    : falha('clerk_recusou');
}
