import { pgTable, text, numeric, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { consultas } from './consultas';
import { pacientes } from './pacientes';
import { medicos } from './medicos';
import { pagamentoStatusEnum } from './enums';

/**
 * Registro de pagamento de teleconsulta — uma linha por consulta, criada junto com a
 * reserva do horário (`consultas.status = 'reservada'`), antes da confirmação final.
 *
 * Se a confirmação falhar depois de criada (ex.: horário ocupado por outro processo,
 * erro no Google Calendar, prazo da reserva expirado), a linha continua existindo com
 * `erroConfirmacao` preenchido — nada se perde, e o admin identifica o caso em
 * `/admin/pagamentos`.
 *
 * Preparatório: sem integração real com gateway (colunas gateway* e as de rastreamento
 * `pagamentoIniciadoEm`/`pagamentoConcluidoEm`/`pagamentoErroEm` nascem nulas e não são
 * escritas por nenhum fluxo hoje — ficam prontas para quando o Gather existir). O valor
 * vai integralmente para o médico — a Be4Hope não retém comissão nem intermedeia o
 * repasse, então não há split para calcular ou guardar aqui.
 */
export const pagamentos = pgTable(
  'pagamentos',
  {
    ...baseColumns,
    consultaId: text('consulta_id')
      .notNull()
      .references(() => consultas.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    medicoId: text('medico_id')
      .notNull()
      .references(() => medicos.id),
    /** Denormalizado de consultas.dataHora, para listar sem join no admin. */
    dataHora: timestamp('data_hora', { withTimezone: true }).notNull(),
    /** Valor pago pelo paciente — recebido integralmente pelo médico. */
    valor: numeric('valor', { precision: 10, scale: 2 }).notNull(),
    moeda: text('moeda').notNull().default('BRL'),
    status: pagamentoStatusEnum('status').notNull().default('pendente'),
    gatewayProvider: text('gateway_provider'),
    gatewayReferenciaId: text('gateway_referencia_id'),
    gatewayCheckoutUrl: text('gateway_checkout_url'),
    pagoEm: timestamp('pago_em', { withTimezone: true }),
    observacoes: text('observacoes'),

    // ── Rastreamento do funil (todo campo é preenchido só em caso de sucesso da
    // etapa — ausência é o próprio sinal de "não chegou lá") ──────────────────
    /** Reserva criada (mesmo momento em que a consulta nasce 'reservada'). */
    iniciadoEm: timestamp('iniciado_em', { withTimezone: true }).notNull().defaultNow(),
    /** Não escrito hoje — a tela de pagamento é só layout, sem requisição própria.
     *  Fica pronto para quando o checkout do Gather existir de verdade. */
    pagamentoIniciadoEm: timestamp('pagamento_iniciado_em', { withTimezone: true }),
    /** Não escrito hoje — idem acima, para quando o Gather confirmar a cobrança. */
    pagamentoConcluidoEm: timestamp('pagamento_concluido_em', { withTimezone: true }),
    /** Não escrito hoje — reservado para quando o Gather puder reportar falha de cobrança. */
    pagamentoErroEm: timestamp('pagamento_erro_em', { withTimezone: true }),
    /** Preenchido junto com o status final da consulta quando `confirmarAgendamento` tem sucesso. */
    confirmadoEm: timestamp('confirmado_em', { withTimezone: true }),
    /** Última mensagem de erro ao tentar confirmar (inclusive reserva expirada) — visível só para o admin. */
    erroConfirmacao: text('erro_confirmacao'),

    ...softDeleteColumn,
  },
  (table) => [
    uniqueIndex('pagamentos_consulta_idx').on(table.consultaId),
    index('pagamentos_paciente_idx').on(table.pacienteId),
    index('pagamentos_medico_idx').on(table.medicoId),
    index('pagamentos_status_idx').on(table.status),
  ],
);
