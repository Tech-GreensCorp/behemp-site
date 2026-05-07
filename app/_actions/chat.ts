'use server';

import { db } from '@/lib/db';
import { gruposChat, participantesGrupo, mensagens, users } from '@/db/schema';
import { eq, and, desc, sql, inArray, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { verificarUsuarioAutenticado } from '@/lib/auth';
import { enviarMensagemChat } from '@/lib/integrations/pusher/server';

/**
 * Server Actions de chat em tempo real.
 * Gerencia grupos, participantes e mensagens.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

// ── Schemas ───────────────────────────────────────────────────

const criarGrupoSchema = z.object({
  nome: z.string().optional(),
  tipo: z.enum(['direto', 'grupo']).default('direto'),
  participanteIds: z.array(z.string()).min(1, 'Selecione pelo menos 1 participante'),
});

const enviarMensagemSchema = z.object({
  grupoId: z.string().min(1),
  conteudo: z.string().min(1, 'Mensagem não pode estar vazia').max(5000),
});

// ── Helpers ───────────────────────────────────────────────────

async function obterUserIdPorClerkId(clerkId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);
  return user?.id ?? null;
}

// ── Actions ───────────────────────────────────────────────────

/**
 * Cria um novo grupo de chat ou conversa direta.
 * Para conversa direta, verifica se já existe uma entre os dois usuários.
 */
export async function criarGrupo(
  dados: z.infer<typeof criarGrupoSchema>,
): Promise<ActionResult<{ grupoId: string }>> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);
    if (!userId) return { sucesso: false, erro: 'Usuário não encontrado' };

    const parsed = criarGrupoSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    const { nome, tipo, participanteIds } = parsed.data;

    // Para conversa direta, verificar se já existe
    if (tipo === 'direto' && participanteIds.length === 1) {
      const outroId = participanteIds[0];
      const existente = await db.execute(sql`
        SELECT g.id
        FROM grupos_chat g
        WHERE g.tipo = 'direto'
          AND EXISTS (
            SELECT 1 FROM participantes_grupo p1 WHERE p1.grupo_id = g.id AND p1.user_id = ${userId}
          )
          AND EXISTS (
            SELECT 1 FROM participantes_grupo p2 WHERE p2.grupo_id = g.id AND p2.user_id = ${outroId}
          )
        LIMIT 1
      `);

      if (existente.rows.length > 0) {
        return { sucesso: true, dados: { grupoId: existente.rows[0].id as string } };
      }
    }

    // Criar grupo
    const [novoGrupo] = await db
      .insert(gruposChat)
      .values({
        nome: nome ?? null,
        tipo,
        criadoPor: userId,
      })
      .returning({ id: gruposChat.id });

    // Adicionar todos os participantes (incluindo o criador)
    const todosParticipantes = [userId, ...participanteIds.filter((id) => id !== userId)];

    await db.insert(participantesGrupo).values(
      todosParticipantes.map((uid) => ({
        grupoId: novoGrupo.id,
        userId: uid,
      })),
    );

    return { sucesso: true, dados: { grupoId: novoGrupo.id } };
  } catch (error) {
    console.error('[Chat] Erro ao criar grupo:', error);
    return { sucesso: false, erro: 'Erro ao criar grupo' };
  }
}

/**
 * Lista os grupos/conversas do usuário autenticado.
 */
export async function listarGrupos(): Promise<ActionResult<Array<{
  id: string;
  nome: string | null;
  tipo: string;
  ultimaMensagem: string | null;
  ultimaMensagemData: string | null;
  participantes: Array<{ id: string; nome: string; role: string | null }>;
  naoLidas: number;
}>>> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);
    if (!userId) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Buscar grupos onde o usuário participa
    const gruposDoUsuario = await db.execute(sql`
      SELECT
        g.id,
        g.nome,
        g.tipo,
        (
          SELECT m.conteudo FROM mensagens m
          WHERE m.grupo_id = g.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC LIMIT 1
        ) as "ultimaMensagem",
        (
          SELECT TO_CHAR(m.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') FROM mensagens m
          WHERE m.grupo_id = g.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC LIMIT 1
        ) as "ultimaMensagemData",
        (
          SELECT COUNT(*)::int FROM mensagens m
          WHERE m.grupo_id = g.id
            AND m.deleted_at IS NULL
            AND m.autor_id != ${userId}
            AND NOT (m.lida_por @> ${JSON.stringify([userId])}::jsonb)
        ) as "naoLidas"
      FROM grupos_chat g
      INNER JOIN participantes_grupo pg ON pg.grupo_id = g.id
      WHERE pg.user_id = ${userId}
      ORDER BY (
        SELECT m.created_at FROM mensagens m
        WHERE m.grupo_id = g.id AND m.deleted_at IS NULL
        ORDER BY m.created_at DESC LIMIT 1
      ) DESC NULLS LAST, g.created_at DESC
    `);

    // Para cada grupo, buscar participantes
    const grupos = await Promise.all(
      (gruposDoUsuario.rows as Array<{
        id: string;
        nome: string | null;
        tipo: string;
        ultimaMensagem: string | null;
        ultimaMensagemData: string | null;
        naoLidas: number;
      }>).map(async (g) => {
        const partsResult = await db.execute(sql`
          SELECT u.id, u.nome, u.role
          FROM participantes_grupo pg
          INNER JOIN users u ON u.id = pg.user_id
          WHERE pg.grupo_id = ${g.id}
        `);

        return {
          ...g,
          naoLidas: Number(g.naoLidas),
          participantes: partsResult.rows as Array<{ id: string; nome: string; role: string | null }>,
        };
      }),
    );

    return { sucesso: true, dados: grupos };
  } catch (error) {
    console.error('[Chat] Erro ao listar grupos:', error);
    return { sucesso: false, erro: 'Erro ao listar grupos' };
  }
}

/**
 * Lista mensagens de um grupo com paginação.
 */
export async function listarMensagens(
  grupoId: string,
  limite: number = 50,
): Promise<ActionResult<Array<{
  id: string;
  autorId: string;
  autorNome: string;
  autorRole: string | null;
  conteudo: string;
  criadoEm: string;
}>>> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);
    if (!userId) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Verificar que o usuário é participante do grupo
    const [participante] = await db
      .select({ id: participantesGrupo.id })
      .from(participantesGrupo)
      .where(and(
        eq(participantesGrupo.grupoId, grupoId),
        eq(participantesGrupo.userId, userId),
      ))
      .limit(1);

    if (!participante) {
      return { sucesso: false, erro: 'Você não é participante deste grupo' };
    }

    const resultado = await db.execute(sql`
      SELECT
        m.id,
        m.autor_id as "autorId",
        u.nome as "autorNome",
        u.role as "autorRole",
        m.conteudo,
        TO_CHAR(m.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') as "criadoEm"
      FROM mensagens m
      INNER JOIN users u ON u.id = m.autor_id
      WHERE m.grupo_id = ${grupoId}
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC
      LIMIT ${limite}
    `);

    return {
      sucesso: true,
      dados: resultado.rows as Array<{
        id: string;
        autorId: string;
        autorNome: string;
        autorRole: string | null;
        conteudo: string;
        criadoEm: string;
      }>,
    };
  } catch (error) {
    console.error('[Chat] Erro ao listar mensagens:', error);
    return { sucesso: false, erro: 'Erro ao listar mensagens' };
  }
}

/**
 * Envia uma mensagem no grupo e dispara evento Pusher.
 */
export async function enviarMensagem(
  dados: z.infer<typeof enviarMensagemSchema>,
): Promise<ActionResult<{ mensagemId: string }>> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);
    if (!userId) return { sucesso: false, erro: 'Usuário não encontrado' };

    const parsed = enviarMensagemSchema.safeParse(dados);
    if (!parsed.success) return { sucesso: false, erro: parsed.error.errors[0].message };

    // Verificar participação
    const [participante] = await db
      .select({ id: participantesGrupo.id })
      .from(participantesGrupo)
      .where(and(
        eq(participantesGrupo.grupoId, parsed.data.grupoId),
        eq(participantesGrupo.userId, userId),
      ))
      .limit(1);

    if (!participante) {
      return { sucesso: false, erro: 'Você não é participante deste grupo' };
    }

    // Buscar nome do autor
    const [autor] = await db
      .select({ nome: users.nome })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Inserir mensagem
    const [novaMensagem] = await db
      .insert(mensagens)
      .values({
        grupoId: parsed.data.grupoId,
        autorId: userId,
        conteudo: parsed.data.conteudo,
        lidaPor: [userId], // O autor já leu
      })
      .returning({ id: mensagens.id, createdAt: mensagens.createdAt });

    // Disparar evento Pusher em tempo real
    try {
      await enviarMensagemChat({
        grupoId: parsed.data.grupoId,
        mensagemId: novaMensagem.id,
        autorId: userId,
        autorNome: autor?.nome ?? 'Usuário',
        conteudo: parsed.data.conteudo,
        criadoEm: novaMensagem.createdAt.toISOString(),
      });
    } catch (pusherError) {
      // Não falhar a action se o Pusher falhar — a mensagem já está salva
      console.error('[Chat] Erro ao enviar via Pusher (mensagem salva):', pusherError);
    }

    return { sucesso: true, dados: { mensagemId: novaMensagem.id } };
  } catch (error) {
    console.error('[Chat] Erro ao enviar mensagem:', error);
    return { sucesso: false, erro: 'Erro ao enviar mensagem' };
  }
}

/**
 * Marca todas as mensagens de um grupo como lidas pelo usuário.
 */
export async function marcarComoLida(grupoId: string): Promise<ActionResult> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);
    if (!userId) return { sucesso: false, erro: 'Usuário não encontrado' };

    // Atualizar todas as mensagens não lidas do grupo
    await db.execute(sql`
      UPDATE mensagens
      SET lida_por = lida_por || ${JSON.stringify([userId])}::jsonb
      WHERE grupo_id = ${grupoId}
        AND deleted_at IS NULL
        AND autor_id != ${userId}
        AND NOT (lida_por @> ${JSON.stringify([userId])}::jsonb)
    `);

    return { sucesso: true };
  } catch (error) {
    console.error('[Chat] Erro ao marcar como lida:', error);
    return { sucesso: false, erro: 'Erro ao marcar como lida' };
  }
}

/**
 * Busca usuários disponíveis para iniciar conversa (para seleção de participantes).
 */
export async function buscarUsuariosChat(busca?: string): Promise<ActionResult<Array<{
  id: string;
  nome: string;
  email: string;
  role: string | null;
}>>> {
  try {
    const auth = await verificarUsuarioAutenticado();
    if (!auth) return { sucesso: false, erro: 'Não autenticado' };

    const userId = await obterUserIdPorClerkId(auth.clerkId);

    let query = sql`
      SELECT u.id, u.nome, u.email, u.role
      FROM users u
      WHERE u.id != ${userId}
    `;

    if (busca && busca.trim()) {
      query = sql`
        SELECT u.id, u.nome, u.email, u.role
        FROM users u
        WHERE u.id != ${userId}
          AND (u.nome ILIKE ${'%' + busca + '%'} OR u.email ILIKE ${'%' + busca + '%'})
      `;
    }

    query = sql`${query} ORDER BY u.nome ASC LIMIT 20`;

    const resultado = await db.execute(query);

    return {
      sucesso: true,
      dados: resultado.rows as Array<{
        id: string;
        nome: string;
        email: string;
        role: string | null;
      }>,
    };
  } catch (error) {
    console.error('[Chat] Erro ao buscar usuários:', error);
    return { sucesso: false, erro: 'Erro ao buscar usuários' };
  }
}
