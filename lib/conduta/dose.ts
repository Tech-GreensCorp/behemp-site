/**
 * mg/dia — o número que o médico precisa ver, e que NÃO existe como coluna.
 *
 * POR QUE ESTE ARQUIVO EXISTE
 * ADR-0004 D-06 e o entregável 2 da Sprint 5: mg/dia aparece **ao lado das gotas** e **nunca é
 * persistido**. Persistir seria criar uma segunda verdade que envelhece — no dia em que o
 * `cbdMgPorGota` do catálogo for corrigido, toda linha gravada passa a mentir, e ninguém
 * descobre porque o número continua lá, plausível.
 *
 * O critério de aceite da Sprint 5 cobra isso literalmente: "mg/dia aparece na tela e NÃO existe
 * como coluna".
 *
 * 🛑 Este módulo é PURO: sem `db`, sem `auth`, sem `next/*` — a convenção de `lib/<dominio>/` do
 * `CLAUDE.md`. É o que permite o guarda testá-lo sem subir nada.
 */

import { normalizarTeor } from './receituario';

export interface DoseDiaria {
  gotasPorDia: number;
  /** `null` quando o catálogo não tem `cbdMgPorGota` — e a tela mostra as gotas sozinhas. */
  cbdMgPorDia: number | null;
  /** `null` quando o catálogo não tem `thcMgPorGota`. */
  thcMgPorDia: number | null;
}

/**
 * Converte gotas/dia em mg/dia de cada canabinóide.
 *
 * Devolve `null` — não zero — quando o mg/gota é desconhecido. Zero afirmaria que o produto não
 * tem o canabinóide, que é uma afirmação clínica; `null` diz que não sabemos, que é a verdade.
 */
export function calcularDoseDiaria(params: {
  gotasPorDia: number;
  cbdMgPorGota?: number | string | null;
  thcMgPorGota?: number | string | null;
}): DoseDiaria {
  const gotas = Number(params.gotasPorDia);
  const gotasValidas = Number.isFinite(gotas) && gotas > 0 ? gotas : 0;

  const cbd = normalizarTeor(params.cbdMgPorGota);
  const thc = normalizarTeor(params.thcMgPorGota);

  return {
    gotasPorDia: gotasValidas,
    cbdMgPorDia: cbd === null ? null : arredondar(cbd * gotasValidas),
    thcMgPorDia: thc === null ? null : arredondar(thc * gotasValidas),
  };
}

/** Duas casas: mg/gota vem com três decimais do catálogo, e mg/dia com três vira ruído na tela. */
function arredondar(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Formata para a tela. Sem valor, devolve string vazia — quem chama decide se esconde o rótulo
 * ou mostra "—". Nenhum "0 mg" aparece por acidente.
 */
export function formatarMg(valor: number | null): string {
  if (valor === null) return '';
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mg`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DURAÇÃO DO FRASCO — entregável 8, alerta de fim
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reexporta a fórmula que JÁ EXISTE em `lib/utils/dosagem.ts`, em vez de reescrevê-la.
 *
 * ⚠️ Ela é usada hoje por `app/_actions/dosagens.ts` e pelo motor de alertas (DT-010). Uma
 * segunda implementação divergiria no primeiro arredondamento, e o paciente receberia dois
 * avisos de recompra em datas diferentes.
 */
export {
  calcularDosagem,
  calcularDiasRestantes,
  medicamentoProximoDeAcabar,
} from '@/lib/utils/dosagem';
