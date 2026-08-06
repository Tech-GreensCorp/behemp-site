'use server';

import { db } from '@/lib/db';
import { contatos } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  enviarEmailNotificacaoAdmin,
  enviarEmailConfirmacaoUsuario,
  enviarRespostaAdmin,
} from '@/lib/email/brevo';

/**
 * Server Actions do formulário de contato público.
 * Salva no banco e envia e-mails via Brevo.
 */

// ── Schemas ───────────────────────────────────────────────────

const enviarContatoSchema = z.object({
  nome: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  email: z.string().email('E-mail inválido'),
  assunto: z.string().min(3, 'Assunto deve ter ao menos 3 caracteres').max(200),
  mensagem: z.string().min(10, 'Mensagem deve ter ao menos 10 caracteres').max(5000),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Recebe e processa o formulário de contato público.
 * 1. Valida os dados
 * 2. Salva no banco
 * 3. Envia e-mail de notificação para o admin
 * 4. Envia e-mail de confirmação para o usuário
 */
export async function enviarMensagemContato(
  dados: z.infer<typeof enviarContatoSchema>,
): Promise<ActionResult<{ contatoId: string }>> {
  try {
    const parsed = enviarContatoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    const { nome, email, assunto, mensagem } = parsed.data;

    // 1. Salva no banco
    const [novo] = await db
      .insert(contatos)
      .values({ nome, email, assunto, mensagem, statusLeitura: 'nao_lida' })
      .returning({ id: contatos.id });

    // 2. Envia e-mails (não bloqueia o fluxo em caso de falha no envio)
    const dadosEmail = { nome, email, assunto, mensagem };
    const [resAdmin, resUsuario] = await Promise.allSettled([
      enviarEmailNotificacaoAdmin(dadosEmail),
      enviarEmailConfirmacaoUsuario(dadosEmail),
    ]);


    if (resAdmin.status === 'rejected') {
      console.error('[Brevo] Falha ao enviar e-mail para o admin:', resAdmin.reason);
    }
    if (resUsuario.status === 'rejected') {
      console.error('[Brevo] Falha ao enviar confirmação ao usuário:', resUsuario.reason);
    }


    return { sucesso: true, dados: { contatoId: novo.id } };
  } catch (error) {
    console.error('[Action] Erro ao enviar mensagem de contato:', error);
    return { sucesso: false, erro: 'Erro ao enviar mensagem. Tente novamente.' };
  }
}

/**
 * Lista todas as mensagens de contato (admin only).
 */
export async function listarContatos(): Promise<
  ActionResult<typeof contatos.$inferSelect[]>
> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db
      .select()
      .from(contatos)
      .orderBy(desc(contatos.createdAt));

    return { sucesso: true, dados: resultado };
  } catch (error) {
    console.error('[Action] Erro ao listar contatos:', error);
    return { sucesso: false, erro: 'Erro ao listar mensagens' };
  }
}

/**
 * Atualiza o status de leitura de uma mensagem.
 */
export async function atualizarStatusContato(
  contatoId: string,
  status: 'lida' | 'respondida',
): Promise<ActionResult> {
  try {
    if (!contatoId) {
      return { sucesso: false, erro: 'ID da mensagem é obrigatório' };
    }

    await db
      .update(contatos)
      .set({ statusLeitura: status })
      .where(eq(contatos.id, contatoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar status do contato:', error);
    return { sucesso: false, erro: 'Erro ao atualizar mensagem' };
  }
}

/**
 * Conta mensagens não lidas (para badge do admin).
 */
export async function contarContatosNaoLidos(): Promise<ActionResult<number>> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) return { sucesso: true, dados: 0 };

    const resultado = await db
      .select({ id: contatos.id })
      .from(contatos)
      .where(eq(contatos.statusLeitura, 'nao_lida'));

    return { sucesso: true, dados: resultado.length };
  } catch {
    return { sucesso: true, dados: 0 };
  }
}

/**
 * Envia uma resposta por e-mail ao usuário e marca a mensagem como respondida.
 */
export async function responderContato(
  contatoId: string,
  dados: { nome: string; email: string; assunto: string; mensagem: string },
  resposta: string,
): Promise<ActionResult> {
  try {
    const { verificarAdmin } = await import('@/lib/auth');
    const auth = await verificarAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: 'Acesso não autorizado' };
    }

    if (!resposta.trim()) {
      return { sucesso: false, erro: 'A resposta não pode estar vazia' };
    }

    // Envia o e-mail de resposta via Brevo
    await enviarRespostaAdmin(dados, resposta.trim());

    // Marca como respondida no banco
    await db
      .update(contatos)
      .set({ statusLeitura: 'respondida' })
      .where(eq(contatos.id, contatoId));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao responder contato:', error);
    return { sucesso: false, erro: 'Erro ao enviar resposta. Tente novamente.' };
  }
}
