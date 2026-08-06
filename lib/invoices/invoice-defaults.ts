/**
 * Gera um número de invoice único no formato: INV-YYYYMMDD-XXXX
 * Portado de Invoice_Generator::generate_invoice_number()
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, '0');

  return `INV-${year}${month}${day}-${random}`;
}

/**
 * Valores padrão do exportador (Greens Pharmaceutical Corp).
 * Pré-preenchidos no formulário de criação de invoice.
 */
export const EXPORTER_DEFAULTS = {
  companyName: 'Greens Pharmaceutical Corp',
  address: '2626 East Commercial Boulevard, Ste 4',
  cityStateZipCountry: 'Fort Lauderdale, Florida 33308, USA / EUA',
  taxId: '38-4184605',
  phone: '+1-954-123-4567',
  email: 'med@greens-corp.com',
} as const;

/**
 * Valores padrão do fabricante (CanniFex GmbH).
 * Pré-preenchidos no formulário de criação de invoice.
 */
export const MANUFACTURER_DEFAULTS = {
  companyName: 'CanniFex GmbH',
  address: 'Hauptstrasse 19 A',
  cityZipCountry: '8467 Truttikon, Switzerland / Suíça',
  taxId: 'CHE-335.648.350',
  phone: '+41-78-848-6856',
  email: 'info@cannifex.info',
} as const;
