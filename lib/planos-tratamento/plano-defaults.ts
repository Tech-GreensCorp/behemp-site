/**
 * Gera um número de plano de tratamento no formato: PT-YYYYMMDD-XXXX
 * Mesmo desenho de `generateInvoiceNumber` (lib/invoices/invoice-defaults.ts), com prefixo
 * próprio para não confundir plano com invoice.
 */
export function generatePlanoNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `PT-${year}${month}${day}-${random}`;
}

/**
 * Valores iniciais de um plano novo — a oferta padrão do modelo
 * `Collab_Adesao_ao_Tratamento` (6 frascos de Balance 1:1, 40% de subsídio, 4 consultas,
 * 2 fretes, 12 parcelas). O admin ajusta caso a caso.
 */
export const ADESAO_DEFAULTS = {
  periodoMeses: '12',
  medicamento: 'Balance 1:1 - 900 mg, CBD + CBG, nanotecnologia',
  qtdFrascos: '6',
  valorFrasco: '890.00',
  descontoPct: '40',
  qtdConsultas: '4',
  valorConsulta: '90.00',
  qtdFretes: '2',
  valorFrete: '240.00',
  parcelas: '12',
  formaPagamento: 'Pagamento por boleto bancário ou Pix.',
} as const;
