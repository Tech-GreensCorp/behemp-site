import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { parceiroEventosSaida, solicitacoesCadastro } from '@/db/schema';

/**
 * ENFILEIRA UM AVISO PARA O PARCEIRO (ADR-0016 D-09).
 *
 * Chamado quando algo que o parceiro espera fica pronto aqui: a receita foi emitida, ou
 * a autorização da ANVISA foi concluída.
 *
 * 🔴 NUNCA LANÇA. E isso é decisão, não descuido.
 *
 * Quem chama esta função está no meio de um ato clínico — assinar uma receita, concluir
 * uma procuração. Se o aviso ao parceiro pudesse derrubar essa operação, uma indisponi-
 * bilidade comercial passaria a impedir um médico de prescrever.
 *
 * A ordem certa é: o ato clínico acontece e é gravado; o aviso é consequência. Falhar em
 * avisar é um problema para o cron resolver, não para o médico.
 */
export type TipoDeAviso = 'receita_emitida' | 'anvisa_aprovada';

export async function notificarParceiro(params: {
  /** Um dos dois. `pacienteId` é o que os pontos clínicos têm em mãos. */
  solicitacaoId?: string;
  pacienteId?: string;
  tipo: TipoDeAviso;
}): Promise<{ enfileirado: boolean; motivo?: string }> {
  try {
    if (!params.solicitacaoId && !params.pacienteId) {
      return { enfileirado: false, motivo: 'sem_identificador' };
    }

    const [solicitacao] = await db
      .select({
        id: solicitacoesCadastro.id,
        parceiro: solicitacoesCadastro.parceiro,
        protocolo: solicitacoesCadastro.protocolo,
      })
      .from(solicitacoesCadastro)
      .where(
        and(
          params.solicitacaoId
            ? eq(solicitacoesCadastro.id, params.solicitacaoId)
            : eq(solicitacoesCadastro.pacienteId, params.pacienteId!),
          isNull(solicitacoesCadastro.deletedAt),
        ),
      )
      // Se o paciente tiver mais de uma solicitação, vale a mais recente — é a que
      // corresponde ao encaminhamento vigente.
      .orderBy(desc(solicitacoesCadastro.createdAt))
      .limit(1);

    // Paciente que não veio de parceiro nenhum não gera aviso — é a maioria.
    if (!solicitacao?.parceiro) return { enfileirado: false, motivo: 'sem_parceiro' };

    await db
      .insert(parceiroEventosSaida)
      .values({
        parceiro: solicitacao.parceiro,
        tipo: params.tipo,
        solicitacaoId: solicitacao.id,
        // O `referralId` é o NOSSO id — é o que eles gravaram como `behempReferralId`.
        referralId: solicitacao.id,
        payload: {
          referralId: solicitacao.id,
          tipo: params.tipo,
          protocolo: solicitacao.protocolo,
          ocorridoEm: new Date().toISOString(),
        },
      })
      /**
       * 🔴 O MESMO FATO CHAMADO DUAS VEZES NÃO VIRA DOIS AVISOS.
       *
       * `onConflictDoNothing` e não `DoUpdate`: se o aviso já existe, ele já tem o seu
       * `ocorridoEm` e possivelmente já foi entregue. Reescrevê-lo mudaria o carimbo de
       * um fato que já aconteceu.
       */
      .onConflictDoNothing({
        target: [
          parceiroEventosSaida.parceiro,
          parceiroEventosSaida.tipo,
          parceiroEventosSaida.solicitacaoId,
        ],
      });

    return { enfileirado: true };
  } catch (erro) {
    // 🔴 ENGOLE E REGISTRA. Ver o bloco no topo: o ato clínico não pode cair por causa
    // de um aviso comercial.
    console.error('[parceiros] falha ao enfileirar aviso', {
      tipo: params.tipo,
      erro: erro instanceof Error ? erro.name : 'desconhecido',
    });
    return { enfileirado: false, motivo: 'erro' };
  }
}
