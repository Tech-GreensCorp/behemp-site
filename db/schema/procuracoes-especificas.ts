import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { pacientes } from './pacientes';
import { autorizacoesAnvisa } from './autorizacoes-anvisa';
import { docusignStatusEnum } from './enums';

/**
 * Procurações Específicas — documentos de autorização ANVISA.
 * Soft delete obrigatório — histórico jurídico preservado por LGPD.
 * docusignEnvelopeId: ID do envelope DocuSign (null em modo stub).
 * urlPdfAssinado: URL Vercel Blob do PDF assinado (após webhook DocuSign).
 */
export const procuracoesEspecificas = pgTable(
  'procuracoes_especificas',
  {
    ...baseColumns,
    pacienteId: text('paciente_id').notNull().references(() => pacientes.id),
    autorizacaoId: text('autorizacao_id').references(() => autorizacoesAnvisa.id),

    // Dados do documento (snapshot no momento da geração)
    nomeCompleto: text('nome_completo').notNull(),
    cpf: text('cpf'),
    rg: text('rg'),
    nacionalidade: text('nacionalidade'),
    estadoCivil: text('estado_civil'),
    profissao: text('profissao'),
    email: text('email').notNull(),
    telefone: text('telefone'),
    endereco: text('endereco'),
    cep: text('cep'),
    cidade: text('cidade'),
    uf: text('uf'),

    // DocuSign
    docusignStatus: docusignStatusEnum('docusign_status').notNull().default('nao_enviado'),
    docusignEnvelopeId: text('docusign_envelope_id'), // null em modo stub
    docusignEnvelopeUrl: text('docusign_envelope_url'), // URL de assinatura
    urlPdfGerado: text('url_pdf_gerado'),     // PDF gerado (Vercel Blob)
    urlPdfAssinado: text('url_pdf_assinado'), // PDF assinado (após DocuSign)
    assinadoEm: timestamp('assinado_em', { withTimezone: true }),
    expiradoEm: timestamp('expirado_em', { withTimezone: true }),

    // Modo stub
    stubAtivo: boolean('stub_ativo').default(true), // false quando DocuSign configurado

    ...softDeleteColumn,
  },
  (t) => [
    index('procuracoes_paciente_idx').on(t.pacienteId),
    index('procuracoes_autorizacao_idx').on(t.autorizacaoId),
    index('procuracoes_docusign_status_idx').on(t.docusignStatus),
    index('procuracoes_envelope_idx').on(t.docusignEnvelopeId),
  ],
);
