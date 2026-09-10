/**
 * POR QUANTO TEMPO CADA DOCUMENTO VALE.
 *
 * Extraída de `app/_actions/documentos.ts` em 10/09/2026, sem mudar o comportamento. O motivo
 * é técnico e vale registrar: aquele arquivo é `'use server'`, e um módulo de Server Actions
 * **só pode exportar função async**. Regra de domínio pura não é action — o lugar dela é aqui,
 * onde o upload manual e o recebimento de documento do parceiro leem a MESMA função.
 *
 * 🔴 Uma segunda regra de validade seria uma segunda verdade sobre o mesmo documento.
 */

/** ANVISA vale 2 anos; receita, 6 meses; o resto não tem validade prática. */
export function calcularValidade(tipo: string, dataEmissao: string): string {
  const data = new Date(dataEmissao);

  switch (tipo) {
    case 'autorizacao_anvisa':
      data.setMonth(data.getMonth() + 24);
      break;
    case 'receita_medica':
      data.setMonth(data.getMonth() + 6);
      break;
    default:
      // Documentos sem validade: 100 anos
      data.setFullYear(data.getFullYear() + 100);
      break;
  }

  return data.toISOString().split('T')[0];
}
