'use server';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { clerkClient } from '@clerk/nextjs/server';
import { and, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { registrarAuditoria } from '@/lib/utils/audit';
import { consumir, identificarChamador } from '@/lib/seguranca/limite-de-requisicao';
import {
  LIMITE_POR_EMAIL,
  LIMITE_POR_ORIGEM,
  MENSAGEM_ENTRADA_RECUSADA,
  MENSAGEM_MUITAS_TENTATIVAS,
  VALIDADE_DO_TICKET_EM_SEGUNDOS,
  entradaSemCodigoSchema,
  temLoginSimplificado,
} from '@/lib/auth/login-simplificado';

/**
 * ENTRAR SÓ COM E-MAIL E SENHA (sem o código por e-mail) — para o paciente que o admin liberou.
 * Contexto e decisão: `lib/auth/login-simplificado.ts`.
 *
 * É uma action PÚBLICA (quem chama ainda não tem sessão), então tudo é conferido aqui, nesta ordem:
 *   1. entrada válida (Zod)
 *   2. limite por ORIGEM e por E-MAIL — antes de qualquer consulta, para a tentativa em si custar
 *   3. o usuário existe, é PACIENTE ativo e tem login (banco)
 *   4. o login tem o flag `loginSimplificado` no `privateMetadata`, tem senha, não está banido
 *      nem bloqueado, e não é de admin/médico (Clerk)
 *   5. a senha confere (`verifyPassword`, Backend API)
 *   6. só então emite o ticket de entrada: uso único, 60 s
 *
 * 🔴 TODA recusa devolve a MESMA mensagem. Distinguir "e-mail não existe" de "sem o flag" de
 * "senha errada" transformaria esta tela num oráculo de quem é paciente e quem tem acesso
 * simplificado. O motivo real vai só para o log — sem e-mail, sem senha.
 *
 * ⚠️ O limite é em MEMÓRIA do processo (ver lib/seguranca/limite-de-requisicao.ts): com mais de uma
 * instância, o teto efetivo multiplica. Hoje há uma só (DT-006/DT-008).
 */

export type ResultadoDaEntrada =
  | { sucesso: true; ticket: string }
  | { sucesso: false; erro: string };

const recusada: ResultadoDaEntrada = { sucesso: false, erro: MENSAGEM_ENTRADA_RECUSADA };

/** A chave do limitador não guarda o e-mail: só um resumo dele (o Map vira registro de quem tentou). */
function chaveDoEmail(email: string): string {
  return `entrada-sem-codigo-email:${createHash('sha256').update(email).digest('hex').slice(0, 24)}`;
}

export async function entrarSemCodigo(entrada: {
  email: string;
  senha: string;
}): Promise<ResultadoDaEntrada> {
  try {
    const parsed = entradaSemCodigoSchema.safeParse(entrada);
    if (!parsed.success) return recusada;
    const { email, senha } = parsed.data;

    const origem = consumir(
      identificarChamador(await headers(), 'entrada-sem-codigo'),
      LIMITE_POR_ORIGEM.tentativas,
      LIMITE_POR_ORIGEM.janelaEmSegundos,
    );
    const porEmail = consumir(
      chaveDoEmail(email),
      LIMITE_POR_EMAIL.tentativas,
      LIMITE_POR_EMAIL.janelaEmSegundos,
    );
    if (!origem.permitido || !porEmail.permitido) {
      console.warn('[EntradaSemCodigo] recusada: limite de tentativas');
      return { sucesso: false, erro: MENSAGEM_MUITAS_TENTATIVAS };
    }

    const [u] = await db
      .select({ id: users.id, clerkId: users.clerkId, role: users.role })
      .from(users)
      .where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)))
      .limit(1);
    if (!u || u.role !== 'paciente' || !u.clerkId) {
      console.warn('[EntradaSemCodigo] recusada: sem paciente com login');
      return recusada;
    }

    const client = await clerkClient();
    const c = await client.users.getUser(u.clerkId);
    const papelNoClerk = c.publicMetadata?.role as string | undefined;
    if (
      !temLoginSimplificado(c.privateMetadata) ||
      !c.passwordEnabled ||
      c.banned ||
      c.locked ||
      (papelNoClerk && papelNoClerk !== 'paciente')
    ) {
      console.warn('[EntradaSemCodigo] recusada: acesso não liberado', { usuarioId: u.id });
      return recusada;
    }

    try {
      await client.users.verifyPassword({ userId: u.clerkId, password: senha });
    } catch {
      console.warn('[EntradaSemCodigo] recusada: senha não confere', { usuarioId: u.id });
      return recusada;
    }

    const token = await client.signInTokens.createSignInToken({
      userId: u.clerkId,
      expiresInSeconds: VALIDADE_DO_TICKET_EM_SEGUNDOS,
    });

    await registrarAuditoria({
      userId: u.id,
      acao: 'criar',
      entidade: 'login_sem_codigo',
      entidadeId: u.id,
      dadosDepois: { metodo: 'senha_sem_codigo' },
    });

    return { sucesso: true, ticket: token.token };
  } catch (error) {
    // Nunca o erro inteiro: o do Clerk pode carregar o que foi enviado. Só o tipo.
    console.error('[EntradaSemCodigo] erro:', error instanceof Error ? error.name : 'desconhecido');
    return recusada;
  }
}
