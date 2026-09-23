'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { medicos, users } from '@/db/schema';
import { verificarMedico } from '@/lib/auth';
import { db } from '@/lib/db';
import { desconectar, obterStatus } from '@/lib/mercadopago/conta';
import { oauthConfigurado } from '@/lib/mercadopago/oauth';

/**
 * A CONTA DE MERCADO PAGO DO MÉDICO — o que a tela dele pode fazer.
 *
 * 🔴 O `medicoId` SAI SEMPRE DA SESSÃO. Nenhuma destas funções recebe id do cliente: o que
 * não é recebido não pode ser trocado, e papel certo com id alheio é OWASP API1 (BOLA).
 *
 * ⚠️ NENHUMA DELAS DECIFRA NADA. Mostrar "conectado" e desconectar são operações sobre
 * metadado; o token só é decifrado por `obterContaConectada`, no momento de cobrar, e lá a
 * chamada é auditada (ADR-0024 §5).
 */

interface ActionResult<T = void> {
  sucesso: boolean;
  dados?: T;
  erro?: string;
}

/** Resolve medicoId + userId interno a partir do clerkId autenticado. */
async function resolverMedico(
  clerkId: string,
): Promise<{ medicoId: string; userId: string } | null> {
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId));
  if (!user) return null;
  const [medico] = await db
    .select({ id: medicos.id })
    .from(medicos)
    .where(eq(medicos.userId, user.id));
  if (!medico) return null;
  return { medicoId: medico.id, userId: user.id };
}

export interface StatusContaMercadoPago {
  conectado: boolean;
  /** Identificador público da conta no Mercado Pago. Não é credencial. */
  mpUserId: string | null;
  conectadoEm: string | null;
  /** `false` quando falta CLIENT_ID/CLIENT_SECRET — a tela avisa em vez de oferecer o botão. */
  integracaoConfigurada: boolean;
}

/**
 * O status para a tela. **Não decifra nada** — só diz se há vínculo ativo.
 */
export async function obterStatusContaMercadoPago(): Promise<ActionResult<StatusContaMercadoPago>> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    const status = await obterStatus(medico.medicoId);

    return {
      sucesso: true,
      dados: {
        conectado: status.conectado,
        mpUserId: status.mpUserId,
        conectadoEm: status.conectadoEm?.toISOString() ?? null,
        integracaoConfigurada: oauthConfigurado(),
      },
    };
  } catch (error) {
    console.error('[Medico] Erro ao ler status do Mercado Pago:', error);
    return { sucesso: false, erro: 'Erro ao consultar a conta do Mercado Pago' };
  }
}

/**
 * Desfaz o vínculo.
 *
 * A linha NÃO é apagada: `desconectar` carimba `desconectadoEm` e zera os dois campos
 * cifrados. O histórico de que houve vínculo sobrevive; a credencial, não.
 *
 * Sempre auditado — é mudança de estado em configuração de recebimento, o mesmo critério
 * de `salvarConfigPagamentoMedicoLogado`.
 */
export async function desconectarContaMercadoPago(): Promise<ActionResult> {
  try {
    const auth = await verificarMedico();
    if (!auth.autorizado || !auth.clerkId) return { sucesso: false, erro: auth.erro };
    const medico = await resolverMedico(auth.clerkId);
    if (!medico) return { sucesso: false, erro: 'Médico não encontrado' };

    await desconectar(medico.medicoId, medico.userId);

    revalidatePath('/medico/pagamentos');
    revalidatePath('/medico/pagamentos/config');

    return { sucesso: true };
  } catch (error) {
    console.error('[Medico] Erro ao desconectar conta do Mercado Pago:', error);
    return { sucesso: false, erro: 'Erro ao desconectar a conta' };
  }
}
