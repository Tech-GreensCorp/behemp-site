import {
  pgTable,
  text,
  date,
  integer,
  numeric,
  index,
} from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { invoiceTipoEnum, invoiceStatusEnum } from './enums';
import { pacientes } from './pacientes';

/**
 * Tabela principal de invoices médicas.
 * Cada invoice representa um documento fiscal para importação de medicamento.
 */
export const invoices = pgTable(
  'invoices',
  {
    ...baseColumns,

    invoiceType: invoiceTipoEnum('invoice_type').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    invoiceDate: date('invoice_date').notNull(),
    status: invoiceStatusEnum('status').notNull().default('draft'),

    // Vínculo opcional com paciente cadastrado no sistema
    pacienteId: text('paciente_id').references(() => pacientes.id),
  },
  (table) => [
    index('invoices_type_idx').on(table.invoiceType),
    index('invoices_status_idx').on(table.status),
    index('invoices_paciente_idx').on(table.pacienteId),
  ],
);

/**
 * Dados do exportador/vendedor da invoice.
 * Geralmente a Greens Pharmaceutical Corp (pré-preenchido).
 */
export const invoiceExporters = pgTable('invoice_exporters', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  address: text('address').notNull(),
  cityStateZipCountry: text('city_state_zip_country').notNull(),
  taxId: text('tax_id').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
});

/**
 * Dados do fabricante do produto.
 * Geralmente CanniFex GmbH (Suíça).
 */
export const invoiceManufacturers = pgTable('invoice_manufacturers', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  address: text('address').notNull(),
  cityZipCountry: text('city_zip_country').notNull(),
  taxId: text('tax_id').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
});

/**
 * Dados do paciente/destinatário na invoice.
 * Inclui dados ANVISA obrigatórios para importação.
 */
export const invoicePatients = pgTable('invoice_patients', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  patientName: text('patient_name').notNull(),
  address: text('address').notNull(),
  cityStateZip: text('city_state_zip').notNull(),
  cpf: text('cpf').notNull(),
  anvisaAuthorization: text('anvisa_authorization').notNull(),
  anvisaValidity: date('anvisa_validity').notNull(),
  email: text('email').notNull(),

  // Campos condicionais por tipo
  patientNumberOng: text('patient_number_ong'), // donation only
  phone: text('phone'), // judicialization only
});

/**
 * Informações jurídicas — apenas para invoices de judicialização.
 */
export const invoiceLegalInfo = pgTable('invoice_legal_info', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  lawsuitNumber: text('lawsuit_number'),
  payingSource: text('paying_source'),
  judicialSecrecy: text('judicial_secrecy'),
});

/**
 * Produtos inclusos na invoice.
 * Cada invoice tem pelo menos 1 produto.
 */
export const invoiceProducts = pgTable(
  'invoice_products',
  {
    ...baseColumns,

    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    itemNumber: integer('item_number').notNull(),
    description: text('description').notNull(),
    ncmCode: text('ncm_code').notNull(),
    quantity: numeric('quantity', { precision: 10, scale: 2 }).notNull(),
    unitPrice: numeric('unit_price', { precision: 10, scale: 2 }).notNull(),
    totalPrice: numeric('total_price', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [index('invoice_products_invoice_idx').on(table.invoiceId)],
);

/**
 * Totais calculados da invoice.
 */
export const invoiceTotals = pgTable('invoice_totals', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  subtotal: numeric('subtotal', { precision: 10, scale: 2 }).notNull(),
  shipping: numeric('shipping', { precision: 10, scale: 2 }).notNull(),
  insurance: numeric('insurance', { precision: 10, scale: 2 }).notNull(),
  total: numeric('total', { precision: 10, scale: 2 }).notNull(),
  totalWords: text('total_words').notNull(),
  equivalentBrl: numeric('equivalent_brl', { precision: 10, scale: 2 }).notNull(),
});

/**
 * Condições de pagamento e envio — apenas para judicialização.
 */
export const invoicePaymentShipping = pgTable('invoice_payment_shipping', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  paymentMethod: text('payment_method'),
  paymentDeadline: date('payment_deadline'),
  incoterms: text('incoterms'),
  shippingMethod: text('shipping_method'),
  estimatedDelivery: date('estimated_delivery'),
});

/**
 * Assinatura da invoice — local e data.
 */
export const invoiceSignatures = pgTable('invoice_signatures', {
  ...baseColumns,

  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  place: text('place').notNull(),
  signatureDate: date('signature_date').notNull(),
});
