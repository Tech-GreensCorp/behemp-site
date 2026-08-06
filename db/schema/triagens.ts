import { pgTable, text, jsonb } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { triagemStatusEnum } from './enums';

/**
 * Tabela de triagens — formulários enviados pela área pública.
 * Os dados são armazenados como JSONB para flexibilidade nas perguntas.
 * Visíveis apenas pelo admin.
 */
export const triagens = pgTable('triagens', {
  ...baseColumns,
  dados: jsonb('dados').notNull(), // Respostas do formulário (estrutura flexível)
  emailContato: text('email_contato'),
  telefoneContato: text('telefone_contato'),
  nomeContato: text('nome_contato'),
  statusVisualizacao: triagemStatusEnum('status_visualizacao')
    .notNull()
    .default('pendente'),
  medicoClerkId: text('medico_clerk_id'), // null = triagem pública, preenchido = médico
});
