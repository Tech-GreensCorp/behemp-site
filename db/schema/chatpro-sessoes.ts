import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { solicitacoesCadastro } from './solicitacoes-cadastro';

/**
 * O ESTADO DE CADA CONVERSA NO FUNIL DO CHATPRO.
 *
 * POR QUE EXISTE, SE JÁ HÁ `chatpro_eventos`
 * `chatpro_eventos` é o diário: uma linha por evento, imutável, boa para auditoria e
 * péssima para responder "onde está o paciente agora". Esta tabela é a projeção — uma
 * linha por conversa, sempre com o estado corrente. Sem ela, saber em que fila o paciente
 * parou exigiria varrer e ordenar o diário inteiro a cada consulta.
 *
 * 🔴 LGPD — O QUE ESTA TABELA DELIBERADAMENTE NÃO TEM
 * Nenhum conteúdo de mensagem. `received_message` e `sent_message` viram os CONTADORES
 * abaixo, e nada mais. Numa conversa de canabidiol, o texto do paciente contém condição
 * de saúde — dado sensível pelo art. 11 da LGPD. O que o funil precisa saber é que houve
 * troca e em que etapa, não o que foi dito.
 *
 * ⚠️ Os nomes de departamento e motivo são GRAVADOS junto do UUID, não só referenciados.
 * A operação renomeia fila no painel, e um relatório de três meses atrás deve continuar
 * dizendo o que dizia quando o evento aconteceu.
 */
export const chatproSessoes = pgTable(
  'chatpro_sessoes',
  {
    ...baseColumns,

    /** UUID da conversa na plataforma. Uma linha por conversa. */
    sessionId: text('session_id').notNull(),
    /** UUID do contato. É o que liga a conversa à solicitação. */
    leadId: text('lead_id'),
    /** Protocolo da solicitação, quando a conversa gerou uma. */
    solicitacaoId: text('solicitacao_id').references(() => solicitacoesCadastro.id, {
      onDelete: 'set null',
    }),

    // ── Onde o paciente está ────────────────────────────────────────────────────
    departamentoId: text('departamento_id'),
    /** Rótulo no momento do evento — ver o aviso acima sobre renomeação. */
    departamentoNome: text('departamento_nome'),
    motivoEncerramentoId: text('motivo_encerramento_id'),
    motivoEncerramentoNome: text('motivo_encerramento_nome'),

    aberta: boolean('aberta').notNull().default(true),
    abertaEm: timestamp('aberta_em', { withTimezone: true }),
    fechadaEm: timestamp('fechada_em', { withTimezone: true }),

    /** Nome do último evento aplicado. Diagnóstico puro. */
    ultimoEvento: text('ultimo_evento'),
    ultimoEventoEm: timestamp('ultimo_evento_em', { withTimezone: true }),

    /** 🔴 CONTADOR, não conteúdo. Ver o bloco de LGPD acima. */
    mensagensRecebidas: integer('mensagens_recebidas').notNull().default(0),
    mensagensEnviadas: integer('mensagens_enviadas').notNull().default(0),
  },
  (t) => [
    uniqueIndex('chatpro_sessoes_session_idx').on(t.sessionId),
    index('chatpro_sessoes_lead_idx').on(t.leadId),
    index('chatpro_sessoes_solicitacao_idx').on(t.solicitacaoId),
  ],
);
