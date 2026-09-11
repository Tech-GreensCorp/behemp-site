/**
 * O CONSENTIMENTO GRAVADO — ler, conceder, revogar.
 *
 * 🔴 POR QUE ISTO NÃO MORA NA ACTION.
 *
 * A P5 (`transferencia-de-cadastro.ts`) precisa **ler** o consentimento antes de montar o
 * envio. Se a leitura vivesse na Server Action, a P5 teria de importar um módulo `'use
 * server'` — que o Next trata como fronteira de rede, não como função. Aqui fica o acesso ao
 * banco; a action põe em cima a autenticação e a auditoria.
 *
 * ⚠️ ESTE MÓDULO NÃO AUTORIZA NADA. Ele recebe um `pacienteId` e confia nele. Quem garante
 * que o id é o da pessoa da sessão é a action — do mesmo jeito que `limite-de-requisicao.ts`
 * agrupa por IP e nunca autoriza.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { consentimentos } from '@/db/schema';

import { TEXTO_DO_CONSENTIMENTO, VERSAO_DO_CONSENTIMENTO, type Finalidade } from './consentimento';

export interface ConsentimentoVigente {
  finalidade: Finalidade;
  versao: string;
  /**
   * 🔴 O TEXTO QUE ELE LEU, não o que está no módulo hoje. Mandar a versão do registro com o
   * texto da constante afirmaria que a pessoa leu uma redação que ela nunca viu.
   */
  textoApresentado: string;
  concedidoEm: Date;
}

/**
 * Os consentimentos que valem agora.
 *
 * 🔴 `revogadoEm IS NULL` NÃO É DETALHE DE QUERY — é o art. 8º §5º inteiro. Sem este filtro,
 * revogar não teria efeito nenhum sobre o envio, e o botão seria decorativo.
 */
export async function consentimentosVigentes(pacienteId: string): Promise<ConsentimentoVigente[]> {
  const linhas = await db
    .select({
      finalidade: consentimentos.finalidade,
      versao: consentimentos.versao,
      textoApresentado: consentimentos.textoApresentado,
      concedidoEm: consentimentos.concedidoEm,
    })
    .from(consentimentos)
    .where(and(eq(consentimentos.pacienteId, pacienteId), isNull(consentimentos.revogadoEm)))
    .orderBy(desc(consentimentos.concedidoEm));

  /**
   * Uma finalidade pode ter mais de uma linha viva — consentir, revogar e consentir de novo
   * é caminho normal, e nada se apaga. Fica a mais recente.
   */
  const porFinalidade = new Map<string, ConsentimentoVigente>();
  for (const l of linhas) {
    if (!porFinalidade.has(l.finalidade)) {
      porFinalidade.set(l.finalidade, {
        finalidade: l.finalidade as Finalidade,
        versao: l.versao,
        textoApresentado: l.textoApresentado,
        concedidoEm: l.concedidoEm,
      });
    }
  }
  return [...porFinalidade.values()];
}

/** Só os nomes, para quem decide com base neles. */
export async function finalidadesVigentes(pacienteId: string): Promise<Finalidade[]> {
  return (await consentimentosVigentes(pacienteId)).map((c) => c.finalidade);
}

/**
 * Grava o aceite — uma linha por finalidade.
 *
 * ⚠️ O texto e a versão vêm das constantes, NUNCA do cliente. Aceitar o texto pelo parâmetro
 * deixaria o navegador escrever o que o registro afirma que a pessoa leu, e o registro
 * deixaria de provar coisa alguma.
 */
export async function conceder(params: {
  pacienteId: string;
  finalidades: Finalidade[];
  origem: string;
}): Promise<void> {
  if (params.finalidades.length === 0) return;

  await db.insert(consentimentos).values(
    params.finalidades.map((finalidade) => ({
      pacienteId: params.pacienteId,
      finalidade,
      versao: VERSAO_DO_CONSENTIMENTO,
      textoApresentado: TEXTO_DO_CONSENTIMENTO,
      origem: params.origem.slice(0, 120),
    })),
  );
}

/**
 * Revoga uma finalidade, marcando as linhas vivas dela.
 *
 * 🔴 MARCA, NÃO APAGA. O histórico de ter consentido continua sendo verdade — é ele que
 * explica um envio que já aconteceu. Devolve quantas linhas foram atingidas, para a auditoria
 * registrar o efeito real em vez da intenção.
 */
export async function revogar(params: {
  pacienteId: string;
  finalidade: Finalidade;
}): Promise<number> {
  const atingidas = await db
    .update(consentimentos)
    .set({ revogadoEm: new Date() })
    .where(
      and(
        eq(consentimentos.pacienteId, params.pacienteId),
        eq(consentimentos.finalidade, params.finalidade),
        isNull(consentimentos.revogadoEm),
      ),
    )
    .returning({ id: consentimentos.id });

  return atingidas.length;
}
