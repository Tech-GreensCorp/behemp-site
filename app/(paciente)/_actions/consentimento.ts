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
import { enfileirarTransferencia } from '@/lib/parceiros/enfileirar-transferencia';
import { db as bancoDaSolicitacao } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';
import { desc } from 'drizzle-orm';

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

    /**
     * 🔴 O SEGUNDO GATILHO DO S2 (§7 do contrato-ponte, 11/09/2026).
     *
     * Quem consentiu no cadastro já foi enfileirado lá. Este é o outro caminho real: o
     * paciente que **recusou na hora e mudou de ideia depois**, no painel. Sem este gatilho,
     * consentir no painel não teria efeito nenhum sobre o envio — e o paciente acreditaria
     * que autorizou.
     *
     * ⚠️ Só quando a finalidade que autoriza o envio está entre as concedidas agora. Consentir
     * com a avaliação médica não dispara transferência nenhuma.
     */
    if (analise.data.finalidades.includes(FINALIDADES.retornoAoParceiro)) {
      await enfileirarDoPainel(paciente.id);
    }

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

/**
 * Acha a solicitação de parceiro deste paciente e enfileira a transferência.
 *
 * ⚠️ A MAIS RECENTE, e só com parceiro. Um paciente pode ter mais de uma solicitação; a que
 * vale é a do encaminhamento vigente — a mesma regra que `notificar.ts` já aplica ao aviso.
 *
 * ⚠️ Nunca lança: é chamada de dentro de uma action cujo trabalho principal (gravar o
 * consentimento) já terminou com sucesso.
 */
async function enfileirarDoPainel(pacienteId: string): Promise<void> {
  try {
    const [solicitacao] = await bancoDaSolicitacao
      .select({ id: solicitacoesCadastro.id, parceiro: solicitacoesCadastro.parceiro })
      .from(solicitacoesCadastro)
      .where(
        and(
          eq(solicitacoesCadastro.pacienteId, pacienteId),
          isNull(solicitacoesCadastro.deletedAt),
        ),
      )
      .orderBy(desc(solicitacoesCadastro.createdAt))
      .limit(1);

    // Paciente que não veio de parceiro nenhum não gera transferência — é a maioria.
    if (!solicitacao?.parceiro) return;

    await enfileirarTransferencia({
      solicitacaoId: solicitacao.id,
      parceiro: solicitacao.parceiro,
    });
  } catch (erro) {
    console.error('[consentimento] falha ao enfileirar transferência do painel', {
      erro: erro instanceof Error ? erro.name : 'desconhecida',
    });
  }
}
