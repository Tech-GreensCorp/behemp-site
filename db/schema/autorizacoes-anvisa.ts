import { pgTable, text, date, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { prescricoes } from './prescricoes';
import { anvisaStatusEnum, anvisaModalidadeEnum } from './enums';

/**
 * Autorizações de Importação ANVISA.
 * Soft delete obrigatório — histórico regulatório preservado por LGPD (art. 16).
 * documentos: JSONB com checklist [{ tipo, urlBlob, enviado, validado, nomeArquivo }]
 * formulario8833: JSONB com dados do formulário preenchido pelo paciente
 */
export const autorizacoesAnvisa = pgTable(
  'autorizacoes_anvisa',
  {
    ...baseColumns,
    pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
    medicoId: text('medico_id').references(() => medicos.id),
    prescricaoId: text('prescricao_id').references(() => prescricoes.id),
    modalidade: anvisaModalidadeEnum('modalidade').notNull().default('guiada'),
    status: anvisaStatusEnum('status').notNull().default('pendente'),
    numeroProcesso: text('numero_processo'),
    dataEnvio: timestamp('data_envio', { withTimezone: true }),
    dataAprovacao: timestamp('data_aprovacao', { withTimezone: true }),
    prazoEstimado: date('prazo_estimado'),
    dataValidade: date('data_validade'),
    observacoesAnvisa: text('observacoes_anvisa'),
    documentos: jsonb('documentos').default([]),
    formulario8833: jsonb('formulario_8833').default({}),
    ...softDeleteColumn,
  },
  (t) => [
    index('autorizacoes_paciente_idx').on(t.pacienteId),
    index('autorizacoes_status_idx').on(t.status),
    index('autorizacoes_prescricao_idx').on(t.prescricaoId),
  ],
);
