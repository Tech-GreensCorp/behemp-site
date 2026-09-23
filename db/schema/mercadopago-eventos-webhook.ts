import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';

/**
 * NOTIFICAÇÕES DE PAGAMENTO DO MERCADO PAGO — a fila do webhook (Parte 2, Fase 3).
 *
 * O webhook grava aqui e responde na hora; um processamento à parte consulta
 * `GET /v1/payments/{id}` e confirma a consulta. É o desenho da fila do ChatPro
 * (`chatpro_eventos`): o Mercado Pago espera resposta em até 22 s e reentrega a cada 15 min
 * quando não recebe, então nada de lento pode acontecer dentro do POST.
 *
 * 🔴 `mpPaymentId` É ÚNICO, E ISSO NÃO É "IGNORAR REPETIDO".
 * O Mercado Pago manda mais de uma notificação para o MESMO pagamento — `payment.created`
 * quando o PIX é gerado (pendente) e `payment.updated` quando ele é pago. Um
 * `onConflictDoNothing` aqui descartaria justamente a notificação da aprovação, e a consulta
 * nunca seria confirmada. O conflito tem de REENFILEIRAR (zerar `processadoEm`), e o
 * processamento sempre lê o status atual na API, nunca o do corpo da notificação.
 */
export const mercadopagoEventosWebhook = pgTable('mercadopago_eventos_webhook', {
  ...baseColumns,
  /** O `data.id` da notificação — o id do pagamento em `/v1/payments`. */
  mpPaymentId: text('mp_payment_id')
    .notNull()
    .unique('mercadopago_eventos_webhook_mp_payment_id_unique'),
  /** Nulo = pendente de processamento. Uma notificação nova do mesmo pagamento o zera. */
  processadoEm: timestamp('processado_em', { withTimezone: true }),
});
