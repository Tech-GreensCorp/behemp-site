'use server';

/**
 * REGISTRAR E REVOGAR O CONSENTIMENTO DO COMPARTILHAMENTO.
 *
 * 🔴 O QUE SE GRAVA É O ATO, NÃO UM ESTADO. Consentir cria linha; revogar marca a vigente.
 * Nada se apaga — é a proibição nº 4 do `CLAUDE.md` aplicada a registro de ato.
 *
 * ⚠️ E A REVOGAÇÃO É REQUISITO, NÃO CORTESIA. LGPD art. 8º §5º: o consentimento "pode ser
 * revogado a qualquer momento… por procedimento gratuito e facilitado". Um botão na mesma
 * tela onde ele consentiu é o que "facilitado" quer dizer.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { db } from '@/lib/db';
import { pacientes, users } from '@/db/schema';
import { obterUsuarioAtual } from '@/lib/auth/permissions';
import { FINALIDADES, type Finalidade } from '@/lib/parceiros/consentimento';
import { conceder, finalidadesVigentes, revogar } from '@/lib/parceiros/consentimento-registrado';
import { registrarAuditoria } from '@/lib/utils/audit';

type Resultado = { sucesso: true } | { sucesso: false; erro: string };

/**
 * 🔴 A VALIDAÇÃO FECHA A LISTA, não checa formato.
 *
 * `z.string()` aceitaria `retorno_ao_parceiro_v2` e gravaria uma finalidade que nenhum
 * consumidor lê — consentimento inerte, que parece registro e não autoriza nada.
 */
const finalidadeValida = z.enum([
  FINALIDADES.avaliacaoMedica,
  FINALIDADES.apoioAnvisa,
  FINALIDADES.retornoAoParceiro,
]);

const esquemaDoAceite = z.object({
  finalidades: z.array(finalidadeValida).min(1, 'Escolha ao menos uma finalidade.'),
  origem: z.string().min(1).max(120),
});

/**
 * Descobre o paciente da SESSÃO.
 *
 * ⚠️ O `pacienteId` nunca vem do cliente. Aceitá-lo do formulário deixaria qualquer paciente
 * consentir — ou revogar — em nome de outro: é OWASP API1 (BOLA), e o caminho aqui é o mesmo
 * de `lib/auth/escopo-documento.ts`.
 */
async function pacienteDaSessao(): Promise<{ id: string; userId: string } | null> {
  const perm = await obterUsuarioAtual();
  if (!perm.autorizado || !perm.clerkId) return null;

  const [linha] = await db
    .select({ pacienteId: pacientes.id, userId: users.id })
    .from(users)
    .innerJoin(pacientes, eq(pacientes.userId, users.id))
    .where(and(eq(users.clerkId, perm.clerkId), isNull(pacientes.deletedAt)))
    .limit(1);

  return linha ? { id: linha.pacienteId, userId: linha.userId } : null;
}

/** Grava o consentimento das finalidades escolhidas. */
export async function registrarConsentimento(entrada: {
  finalidades: Finalidade[];
  origem: string;
}): Promise<Resultado> {
  const analise = esquemaDoAceite.safeParse(entrada);
  if (!analise.success) {
    return { sucesso: false, erro: 'Escolha ao menos uma finalidade.' };
  }

  try {
    const paciente = await pacienteDaSessao();
    if (!paciente) return { sucesso: false, erro: 'Não foi possível identificar você.' };

    await conceder({
      pacienteId: paciente.id,
      finalidades: analise.data.finalidades,
      origem: analise.data.origem,
    });

    await registrarAuditoria({
      userId: paciente.userId,
      acao: 'criar',
      entidade: 'consentimentos',
      // Sem o texto e sem dado pessoal: registra QUE consentiu e para quê.
      dadosDepois: { finalidades: analise.data.finalidades, origem: analise.data.origem },
    }).catch(() => {});

    // 'layout' de propósito: `revalidatePath('/paciente')` sozinho não alcança as rotas
    // filhas, e é em `/paciente/privacidade` que o estado aparece.
    revalidatePath('/paciente', 'layout');
    return { sucesso: true };
  } catch {
    return { sucesso: false, erro: 'Não conseguimos registrar agora. Tente de novo.' };
  }
}

/** Revoga uma finalidade. */
export async function revogarConsentimento(finalidade: Finalidade): Promise<Resultado> {
  const analise = finalidadeValida.safeParse(finalidade);
  if (!analise.success) return { sucesso: false, erro: 'Finalidade desconhecida.' };

  try {
    const paciente = await pacienteDaSessao();
    if (!paciente) return { sucesso: false, erro: 'Não foi possível identificar você.' };

    const atingidas = await revogar({ pacienteId: paciente.id, finalidade: analise.data });

    await registrarAuditoria({
      userId: paciente.userId,
      acao: 'atualizar',
      entidade: 'consentimentos',
      dadosDepois: { revogada: analise.data, linhas: atingidas },
    }).catch(() => {});

    // 'layout' de propósito: `revalidatePath('/paciente')` sozinho não alcança as rotas
    // filhas, e é em `/paciente/privacidade` que o estado aparece.
    revalidatePath('/paciente', 'layout');
    // Revogar o que não existe é sucesso: o estado desejado já é o atual.
    return { sucesso: true };
  } catch {
    return { sucesso: false, erro: 'Não conseguimos revogar agora. Tente de novo.' };
  }
}

/** O que a pessoa da sessão consentiu e ainda não revogou — para a tela se desenhar. */
export async function meusConsentimentos(): Promise<Finalidade[]> {
  const paciente = await pacienteDaSessao();
  if (!paciente) return [];
  return finalidadesVigentes(paciente.id);
}
