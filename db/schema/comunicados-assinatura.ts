import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns } from './_helpers';
import { pacientes } from './pacientes';
import { users } from './users';
import { comunicadoAssinaturaStatusEnum } from './enums';

/**
 * Comunicados que o admin envia, um a um, para o paciente assinar pelo DocuSign.
 *
 * Uma linha por ENVIO — reenviar depois de erro ou recusa cria outra linha, e a anterior fica
 * como histórico. Nada aqui é apagado.
 *
 * Quem pode ler: o próprio paciente (só depois do envio) e o admin. Médico não vê.
 * Quanto tempo fica: o prazo de retenção é decisão jurídica e ainda não foi declarado — por isso
 * não há coluna de validade; nunca se chuta o número.
 * O acesso ao PDF assinado é auditado em `/api/comunicados/[id]/arquivo`.
 */
export const comunicadosAssinatura = pgTable(
  'comunicados_assinatura',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** Chave do comunicado em `lib/comunicados/catalogo.ts` — hoje só `atualizacao_programa_doacao`. */
    tipo: text('tipo').notNull(),
    titulo: text('titulo').notNull(),
    status: comunicadoAssinaturaStatusEnum('status').notNull().default('pendente'),

    // ── Quem disparou e quando ──
    enviadoPorUserId: text('enviado_por_user_id')
      .notNull()
      .references(() => users.id),
    enviadoEm: timestamp('enviado_em', { withTimezone: true }).notNull().defaultNow(),
    /** Nome e e-mail do paciente NO MOMENTO do envio — o signatário do envelope. O DocuSign exige
     *  que o link de assinatura seja pedido com os MESMOS dois valores. */
    nomeDestino: text('nome_destino').notNull(),
    emailDestino: text('email_destino').notNull(),

    // ── DocuSign ──
    docusignEnvelopeId: text('docusign_envelope_id'),
    /** Último status do envelope lido DIRETO da API do DocuSign (não do corpo do webhook). */
    docusignStatus: text('docusign_status'),
    assinadoEm: timestamp('assinado_em', { withTimezone: true }),
    /** PDF assinado, em store PRIVADO. Entregue só por `/api/comunicados/[id]/arquivo`. */
    urlPdfAssinado: text('url_pdf_assinado'),

    // ── Falhas (texto seguro, sem dado pessoal) ──
    erro: text('erro'),
    erroEm: timestamp('erro_em', { withTimezone: true }),

    // ── E-mails: cada marcador é uma TRAVA de idempotência, reivindicada com UPDATE atômico ──
    emailEnvioEnviadoEm: timestamp('email_envio_enviado_em', { withTimezone: true }),
    emailEnvioErro: text('email_envio_erro'),
    emailConfirmacaoPacienteEm: timestamp('email_confirmacao_paciente_em', {
      withTimezone: true,
    }),
    emailNotificacaoDocsEm: timestamp('email_notificacao_docs_em', { withTimezone: true }),
  },
  (t) => [
    index('comunicados_assinatura_paciente_idx').on(t.pacienteId),
    index('comunicados_assinatura_envelope_idx').on(t.docusignEnvelopeId),
    /**
     * UM comunicado ativo por paciente e tipo: enquanto houver um pendente ou assinado, outro
     * envio é recusado pelo BANCO — o clique duplo e a corrida entre dois admins não passam
     * por checagem em código. Erro, recusa e cancelamento liberam o reenvio.
     */
    uniqueIndex('comunicados_assinatura_ativo_unq')
      .on(t.pacienteId, t.tipo)
      .where(sql`${t.status} in ('pendente', 'assinado')`),
  ],
);

export type ComunicadoAssinatura = typeof comunicadosAssinatura.$inferSelect;
