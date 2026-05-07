'use server';

import { db } from '@/lib/db';
import { users, medicos } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { verificarMedicoOuAdmin } from '@/lib/auth';
import { gerarUrlAutorizacaoGoogle } from '@/lib/integrations/google-calendar';

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
