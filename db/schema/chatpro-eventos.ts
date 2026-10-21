import { pgTable, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { chatproEventoStatusEnum } from './enums';

/**
 * EVENTOS DO WEBHOOK DO CHATPRO — deduplicação e fila durável na mesma tabela.
 *
 * POR QUE ESTA TABELA EXISTE
 * Entrega de webhook é "ao menos uma vez": o mesmo evento pode chegar duas vezes, e a
 * política de reentrega do ChatPro não é documentada. Sem deduplicação, um `opened_session`
 * duplicado criaria duas solicitações para o mesmo paciente.
 *
 * 🔴 A REGRA DE OURO: NADA É PROCESSADO DENTRO DA REQUISIÇÃO.
 * O handler grava a linha aqui e responde `202`. Um processador consome depois. Processar
 * dentro do request faz o ChatPro atingir timeout e reentregar o mesmo evento — o que
 * multiplica exatamente o problema que a tabela existe para resolver.
 *
 * Por isso ela é as duas coisas ao mesmo tempo: o registro de deduplicação E a fila.
 *
 * 🔴 LGPD — O QUE NÃO ENTRA NO `payload`
 * Conteúdo de mensagem (`message`, `alt_message`, `title`, `url` de mídia) é removido antes
 * de gravar. `received_message` e `sent_message` viram apenas contagem. Dado de saúde em
 * conversa de paciente é dado sensível (art. 11), e o mínimo necessário aqui é o metadado
 * do funil, não o que foi conversado.
 */
export const chatproEventos = pgTable(
  'chatpro_eventos',
  {
    ...baseColumns,

    /** `opened_session`, `transferred_session`, `closed_session`, … */
    evento: text('evento').notNull(),
    sessionId: text('session_id').notNull(),
    /**
     * Guardado como TEXTO, preservando o valor exato recebido.
     *
     * ⚠️ Os payloads do ChatPro misturam ISO sem fuso (`event_ts`) e ISO com offset em
     * campos internos. Converter na entrada perderia o valor original, que é justamente
     * parte da chave de deduplicação.
     */
    eventoTs: text('evento_ts').notNull(),
    leadId: text('lead_id'),

    /** Payload cru, JÁ SEM conteúdo de mensagem. */
    payload: jsonb('payload').notNull(),

    status: chatproEventoStatusEnum('status').notNull().default('pendente'),
    /** Tentativas de processamento. Acima de 5, vira falha definitiva e entra em alerta. */
    tentativas: integer('tentativas').notNull().default(0),
    ultimoErro: text('ultimo_erro'),
    processadoEm: timestamp('processado_em', { withTimezone: true }),
  },
  (t) => [
    /**
     * A chave natural de deduplicação. Um `INSERT` que colidir aqui significa evento
     * repetido: responde `202` e não processa nada.
     */
    uniqueIndex('chatpro_eventos_dedup_idx').on(t.evento, t.sessionId, t.eventoTs),
    index('chatpro_eventos_fila_idx').on(t.status, t.createdAt),
  ],
);
