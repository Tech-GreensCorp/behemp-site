import { pgTable, text, boolean } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';
import { pixTipoChaveEnum, contaBancariaTipoEnum } from './enums';

/**
 * Meios de pagamento configurados por médico — cadastrado pelo admin em
 * `/admin/pagamentos/medicos`. Sem integração real com gateway: os dados aqui (chave PIX,
 * conta bancária) servem hoje só para exibição na etapa de pagamento do paciente, não
 * disparam nenhuma cobrança nem transferência.
 */
export const medicosPagamentoConfig = pgTable('medicos_pagamento_config', {
  ...baseColumns,
  medicoId: text('medico_id')
    .notNull()
    .unique()
    .references(() => medicos.id),

  // Métodos habilitados para este médico — só aparece na tela de pagamento do paciente
  // o que estiver marcado true aqui.
  pixHabilitado: boolean('pix_habilitado').notNull().default(false),
  boletoHabilitado: boolean('boleto_habilitado').notNull().default(false),
  cartaoCreditoHabilitado: boolean('cartao_credito_habilitado').notNull().default(false),
  cartaoDebitoHabilitado: boolean('cartao_debito_habilitado').notNull().default(false),

  pixTipoChave: pixTipoChaveEnum('pix_tipo_chave'),
  pixChave: text('pix_chave'),

  bancoNome: text('banco_nome'),
  bancoAgencia: text('banco_agencia'),
  bancoConta: text('banco_conta'),
  bancoContaTipo: contaBancariaTipoEnum('banco_conta_tipo'),
  bancoTitularNome: text('banco_titular_nome'),
  bancoTitularDocumento: text('banco_titular_documento'),

  observacoes: text('observacoes'),

  ...softDeleteColumn,
});
