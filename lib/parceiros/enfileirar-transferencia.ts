/**
 * O GATILHO DO S2 — o que faltava para `prepararTransferencia` sair do papel.
 *
 * 🔴 ACHADO PELA GREENS, não por mim. §7 do contrato-ponte, 11/09/2026:
 * _"`prepararTransferencia` não é chamada por ninguém. Conferido com `grep`: ela existe, é
 * testável, e nada a invoca."_
 *
 * Confirmei com o mesmo `grep`, e está certo. É a **mesma classe** do componente órfão que
 * achei hoje de manhã no `AvisoDaProcuracao`: a peça existe, tem teste, aparece como pronta no
 * checklist — e não acontece para paciente nenhum. Desta vez o outro lado viu antes.
 *
 * ⚠️ ENFILEIRA, NUNCA ENVIA. Quem chama está no meio de um cadastro ou de um consentimento;
 * se a Greens estiver fora do ar, quem falha é o cron, não o paciente. É a mesma decisão do
 * S1 (`notificar.ts`), e pelo mesmo motivo.
 *
 * ⚠️ E NUNCA LANÇA. Uma transferência não enfileirada custa um envio; uma exceção aqui
 * derrubaria o cadastro inteiro de alguém que acabou de consentir.
 */

import { db } from '@/lib/db';
import { parceiroEventosSaida } from '@/db/schema';

import { explicarRecusa } from './pode-transferir';
import { prepararTransferencia } from './transferencia-de-cadastro';

export type ResultadoDoEnfileiramento =
  | { enfileirado: true }
  | { enfileirado: false; motivo: string };

export async function enfileirarTransferencia(params: {
  solicitacaoId: string;
  parceiro: string;
}): Promise<ResultadoDoEnfileiramento> {
  try {
    const pronta = await prepararTransferencia({ solicitacaoId: params.solicitacaoId });

    if (!pronta.pronta) {
      /**
       * Recusa é o caso NORMAL, não erro: sem consentimento, com a trava desligada, ou sem
       * parceiro, a transferência simplesmente não acontece. `console.info` e não `warn` —
       * um alerta que dispara no caminho feliz é um alerta que ninguém lê.
       */
      console.info('[parceiros] transferência não enfileirada', {
        motivo: pronta.motivo,
        explicacao: explicarRecusa(pronta.motivo),
      });
      return { enfileirado: false, motivo: pronta.motivo };
    }

    await db
      .insert(parceiroEventosSaida)
      .values({
        parceiro: params.parceiro,
        tipo: 'cadastro_transferido',
        solicitacaoId: params.solicitacaoId,
        referralId: params.solicitacaoId,
        payload: pronta.corpo as unknown as Record<string, unknown>,
      })
      /**
       * 🔴 UM CADASTRO POR SOLICITAÇÃO. O índice único é `(parceiro, tipo, solicitacaoId)`, e
       * `DoNothing` — não `DoUpdate` — porque um cadastro já enviado não se reescreve: ele
       * pode já ter virado pedido do lado de lá, e o corpo novo mudaria o que a Greens gravou
       * como o que o paciente autorizou.
       *
       * ⚠️ A CONSEQUÊNCIA ACEITA: documento anexado DEPOIS não é reenviado por aqui. É o mesmo
       * desenho do `receita_emitida`, e a alternativa (reescrever) é pior.
       */
      .onConflictDoNothing({
        target: [
          parceiroEventosSaida.parceiro,
          parceiroEventosSaida.tipo,
          parceiroEventosSaida.solicitacaoId,
        ],
      });

    console.info('[parceiros] transferência enfileirada', {
      solicitacaoId: params.solicitacaoId,
      // Quantos documentos viajam — nunca os nomes, que costumam trazer o nome da pessoa.
      documentos: pronta.corpo.documentos.length,
    });
    return { enfileirado: true };
  } catch (erro) {
    console.error('[parceiros] falha ao enfileirar transferência', {
      erro: erro instanceof Error ? erro.name : 'desconhecida',
    });
    return { enfileirado: false, motivo: 'erro' };
  }
}
