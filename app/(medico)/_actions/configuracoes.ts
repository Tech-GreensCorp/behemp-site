'use server';

import { db } from '@/lib/db';
import { users, medicos } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { gerarUrlAutorizacaoGoogle } from '@/lib/integrations/google-calendar';
import { z } from 'zod';

/**
 * Server Actions de configurações do médico.
 * Perfil profissional e integração Google Calendar.
 */

interface ActionResult<T = unknown> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/**
 * Obtém perfil completo do médico autenticado.
 */
export async function obterPerfilMedico(): Promise<ActionResult<{
  nome: string;
  email: string;
  crm: string;
  especialidade: string;
  bio: string | null;
  googleConectado: boolean;
  medicoId: string;
}>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const resultado = await db.execute(sql`
      SELECT
        u.nome,
        u.email,
        m.id as "medicoId",
        m.crm,
        m.especialidade,
        m.bio,
        CASE WHEN m.google_refresh_token IS NOT NULL THEN true ELSE false END as "googleConectado"
      FROM users u
      INNER JOIN medicos m ON m.user_id = u.id
      WHERE u.clerk_id = ${auth.clerkId}
      LIMIT 1
    `);

    if (!resultado.rows || resultado.rows.length === 0) {
      return { sucesso: false, erro: 'Perfil de médico não encontrado' };
    }

    const row = resultado.rows[0] as {
      nome: string;
      email: string;
      medicoId: string;
      crm: string;
      especialidade: string;
      bio: string | null;
      googleConectado: boolean;
    };

    return { sucesso: true, dados: row };
  } catch (error) {
    console.error('[Action] Erro ao obter perfil do médico:', error);
    return { sucesso: false, erro: 'Erro ao obter perfil' };
  }
}

// ── Schema de validação ───────────────────────────────────────

const atualizarPerfilSchema = z.object({
  crm: z.string().min(1, 'CRM é obrigatório'),
  especialidade: z.string().min(1, 'Especialidade é obrigatória'),
  bio: z.string().max(2000, 'Máximo de 2000 caracteres').optional().nullable(),
});

/**
 * Atualiza CRM, especialidade e bio do médico autenticado.
 * Nome e e-mail são gerenciados pelo Clerk e não podem ser alterados aqui.
 */
export async function atualizarPerfilMedico(
  dados: z.infer<typeof atualizarPerfilSchema>,
): Promise<ActionResult> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) return { sucesso: false, erro: auth.erro };

    const parsed = atualizarPerfilSchema.safeParse(dados);
    if (!parsed.success) {
      return { sucesso: false, erro: parsed.error.errors[0].message };
    }

    // Resolver o userId interno pelo clerkId autenticado
    const [userInterno] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, auth.clerkId!))
      .limit(1);

    if (!userInterno) return { sucesso: false, erro: 'Usuário não encontrado' };

    await db
      .update(medicos)
      .set({
        crm: parsed.data.crm,
        especialidade: parsed.data.especialidade,
        bio: parsed.data.bio ?? null,
      })
      .where(eq(medicos.userId, userInterno.id));

    return { sucesso: true };
  } catch (error) {
    console.error('[Action] Erro ao atualizar perfil do médico:', error);
    return { sucesso: false, erro: 'Erro ao salvar perfil' };
  }
}

/**
 * Gera a URL de autorização do Google Calendar para o médico.
 */
export async function obterUrlGoogleCalendar(
  medicoId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    const auth = await verificarMedicoOuAdmin();
    if (!auth.autorizado) {
      return { sucesso: false, erro: auth.erro };
    }

    const url = gerarUrlAutorizacaoGoogle(medicoId);
    return { sucesso: true, dados: { url } };
  } catch (error) {
    console.error('[Action] Erro ao gerar URL Google:', error);
    return {
      sucesso: false,
      erro: 'Erro ao gerar URL de autorização. Verifique se GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão configurados.',
    };
  }
}
