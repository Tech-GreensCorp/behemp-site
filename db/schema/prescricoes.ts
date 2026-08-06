import {
  pgTable,
  text,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { consultas } from './consultas';
import { receituarioTemplates } from './receituario-templates';
import {
  prescricaoTipoEnum,
  prescricaoStatusEnum,
  provedorAssinaturaEnum,
} from './enums';

/**
 * Prescrições médicas — core do módulo ICP-Brasil.
 * Soft delete obrigatório — histórico clínico preservado por LGPD.
 * urlPdf / urlPdfAssinado: Vercel Blob (URL privada, acesso autenticado).
 * assinadaDigital: false em modo stub (PSC aguardando credenciais).
 * medicamentos: array de { nome, dose?, forma?, posologia?, quantidade? }
 */
export const prescricoes = pgTable(
  'prescricoes',
  {
    ...baseColumns,
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    consultaId: text('consulta_id').references(() => consultas.id),
    templateId: text('template_id').references(() => receituarioTemplates.id),
    tipo: prescricaoTipoEnum('tipo').notNull().default('simples'),
    status: prescricaoStatusEnum('status').notNull().default('rascunho'),
    medicamentos: jsonb('medicamentos').notNull().default([]),
    diagnostico: text('diagnostico'),
    cid: text('cid'),
    observacoes: text('observacoes'),
    orientacoes: text('orientacoes'),
    validade: timestamp('validade', { withTimezone: true }).notNull(),
    urlPdf: text('url_pdf'),
    urlPdfAssinado: text('url_pdf_assinado'),
    assinadaDigital: boolean('assinada_digital').default(false),
    hashAssinatura: text('hash_assinatura'),
    certificadoCn: text('certificado_cn'),
    provedorAssinatura: provedorAssinaturaEnum('provedor_assinatura'),
    numeroSncr: text('numero_sncr'),
    ...softDeleteColumn,
  },
  (t) => [
    index('prescricoes_medico_idx').on(t.medicoId),
    index('prescricoes_paciente_idx').on(t.pacienteId),
    index('prescricoes_status_idx').on(t.status),
    index('prescricoes_consulta_idx').on(t.consultaId),
  ],
);
