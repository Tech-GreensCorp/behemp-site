/**
 * E-mail de boas-vindas do paciente cadastrado pela equipe, com o link para ELE definir a senha.
 *
 * Quem pode ler: só o destinatário (o link vai para o e-mail do cadastro). Quanto tempo vale: 7 dias,
 * uso único — o `signInToken` do Clerk expira e morre ao ser usado. O envio não é auditado como
 * leitura de dado clínico: nada clínico viaja no e-mail.
 *
 * 🔴 Nenhuma senha viaja por e-mail, nem a equipe vê uma. O link leva o paciente a uma tela que o
 * entra com o token e o deixa escolher a própria senha. O token vai no FRAGMENTO (`#`), que o
 * navegador não envia ao servidor: não cai em log de acesso nem em `Referer`.
 *
 * Só se envia quando a conta acabou de ser CRIADA. Conta já existente (o paciente se cadastrou
 * sozinho antes) não recebe link que o convide a trocar uma senha que ele já tem.
 *
 * Nunca lança: devolve `ok: false`. O cadastro já está gravado e o admin pode reenviar.
 */
import { BrevoClient } from '@getbrevo/brevo';
import { clerkClient } from '@clerk/nextjs/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/db/schema';
import { montarEmailDeBoasVindas } from '@/lib/pacientes/email-de-boas-vindas';

const SETE_DIAS_EM_SEGUNDOS = 7 * 24 * 60 * 60;

export async function enviarBoasVindasComLinkDeSenha(
  usuarioId: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  try {
    const [u] = await db
      .select({ nome: users.nome, email: users.email, clerkId: users.clerkId })
      .from(users)
      .where(and(eq(users.id, usuarioId), isNull(users.deletedAt)))
      .limit(1);
    if (!u?.clerkId) return { ok: false, erro: 'Paciente sem conta de acesso.' };
    if (!process.env.BREVO_API_KEY) return { ok: false, erro: 'Envio de e-mail não configurado.' };

    const client = await clerkClient();
    const token = await client.signInTokens.createSignInToken({
      userId: u.clerkId,
      expiresInSeconds: SETE_DIAS_EM_SEGUNDOS,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const link = `${base}/entrar/definir-senha#ticket=${encodeURIComponent(token.token)}`;
    const { assunto, html } = montarEmailDeBoasVindas({ nome: u.nome, link });

    await new BrevoClient({ apiKey: process.env.BREVO_API_KEY }).transactionalEmails.sendTransacEmail({
      subject: assunto,
      htmlContent: html,
      sender: { name: 'Be4Hope', email: process.env.BREVO_FROM_EMAIL ?? 'tech@be4hope.org' },
      to: [{ email: u.email, name: u.nome }],
    });
    return { ok: true };
  } catch (e) {
    // Sem e-mail, sem token e sem corpo da resposta: só o que diagnostica.
    console.error('[BoasVindas] Falha ao enviar:', {
      usuarioId,
      tipo: e instanceof Error ? e.name : 'desconhecido',
      status: (e as { status?: number })?.status,
    });
    return { ok: false, erro: 'Não foi possível enviar o e-mail de boas-vindas.' };
  }
}
