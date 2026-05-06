'use server';

import { db } from '@/lib/db';
import { mensagens, gruposChat, participantesGrupo, users } from '@/db/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { enviarMensagemChat } from '@/lib/integrations/pusher';

/**
 * Server Actions de chat em tempo real.
 */

// ── Schemas ───────────────────────────────────────────────────

const enviarMensagemSchema = z.object({
  grupoId: z.string().min(1),
  autorId: z.string().min(1),
  conteudo: z.string().min(1, 'Mensagem não pode ser vazia').max(5000),
});

const criarGrupoSchema = z.object({
  nome: z.string().optional(),
  tipo: z.enum(['direto', 'grupo']),
  criadoPor: z.string().min(1),
  participantes: z.array(z.string()).min(1, 'Pelo menos 1 participante'),
});

// ── Types ─────────────────────────────────────────────────────

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Envia uma mensagem no chat e notifica via Pusher.
 */
export async function enviarMensagem(
  dados: z.infer<typeof enviarMensagemSchema>,
): Promise<ActionResult<{ mensagemId: string }>> {
  try {
    const parsed = enviarMensagemSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Buscar nome do autor
    const [autor] = await db
      .select({ nome: users.nome })
      .from(users)
      .where(eq(users.id, parsed.data.autorId))
      .limit(1);

    if (!autor) {
      return { sucesso: false, erro: 'Usuário não encontrado' };
    }

    // Salvar mensagem no banco
    const [novaMensagem] = await db
      .insert(mensagens)
      .values({
        grupoId: parsed.data.grupoId,
        autorId: parsed.data.autorId,
        conteudo: parsed.data.conteudo,
      })
      .returning({ id: mensagens.id, createdAt: mensagens.createdAt });

    // Notificar via Pusher
    try {
      await enviarMensagemChat({
        grupoId: parsed.data.grupoId,
        mensagemId: novaMensagem.id,
        autorId: parsed.data.autorId,
        autorNome: autor.nome,
        conteudo: parsed.data.conteudo,
        criadoEm: novaMensagem.createdAt.toISOString(),
      });
    } catch {
      // Pusher pode não estar configurado, não bloquear o envio
      console.warn('[Chat] Pusher não disponível, mensagem salva apenas no banco');
    }

    return { sucesso: true, dados: { mensagemId: novaMensagem.id } };
  } catch (error) {
    console.error('[Action] Erro ao enviar mensagem:', error);
    return { sucesso: false, erro: 'Erro ao enviar mensagem' };
  }
}

/**
 * Cria um grupo de chat.
 */
export async function criarGrupoChat(
  dados: z.infer<typeof criarGrupoSchema>,
): Promise<ActionResult<{ grupoId: string }>> {
  try {
    const parsed = criarGrupoSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Criar grupo
    const [novoGrupo] = await db
      .insert(gruposChat)
      .values({
        nome: parsed.data.nome,
        tipo: parsed.data.tipo,
        criadoPor: parsed.data.criadoPor,
      })
      .returning({ id: gruposChat.id });

    // Adicionar criador + participantes
    const todosParticipantes = [
      parsed.data.criadoPor,
      ...parsed.data.participantes,
    ];

    // Remover duplicatas
    const unicos = [...new Set(todosParticipantes)];

    await db.insert(participantesGrupo).values(
      unicos.map((userId) => ({
        grupoId: novoGrupo.id,
        userId,
      })),
    );

    return { sucesso: true, dados: { grupoId: novoGrupo.id } };
  } catch (error) {
    console.error('[Action] Erro ao criar grupo:', error);
    return { sucesso: false, erro: 'Erro ao criar grupo' };
  }
}

/**
 * Lista mensagens de um grupo.
 */
export async function listarMensagens(
  grupoId: string,
  limite: number = 50,
): Promise<ActionResult> {
  try {
    const resultado = await db
      .select({
        mensagem: mensagens,
        autor: {
          id: users.id,
          nome: users.nome,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(mensagens)
      .innerJoin(users, eq(mensagens.autorId, users.id))
      .where(and(eq(mensagens.grupoId, grupoId), isNull(mensagens.deletedAt)))
      .orderBy(desc(mensagens.createdAt))
      .limit(limite);

    return { sucesso: true, dados: resultado.reverse() }; // Ordem cronológica
  } catch (error) {
    console.error('[Action] Erro ao listar mensagens:', error);
    return { sucesso: false, erro: 'Erro ao listar mensagens' };
  }
}

/**
 * Lista grupos de chat de um usuário.
 */
export async function listarGruposUsuario(userId: string): Promise<ActionResult> {
  try {
    const resultado = await db
      .select({
        grupo: gruposChat,
      })
      .from(participantesGrupo)
      .innerJoin(gruposChat, eq(participantesGrupo.grupoId, gruposChat.id))
      .where(eq(participantesGrupo.userId, userId));

    return { sucesso: true, dados: resultado.map((r) => r.grupo) };
  } catch (error) {
    console.error('[Action] Erro ao listar grupos:', error);
    return { sucesso: false, erro: 'Erro ao listar grupos' };
  }
}
