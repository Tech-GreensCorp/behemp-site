import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { autorizacoesAnvisa } from './autorizacoes-anvisa';
import { pacientes } from './pacientes';
import { users } from './users';
import { pedidoAtendimentoStatusEnum } from './enums';

/**
 * Pedidos de atendimento assistido da ANVISA — ADR-0029 D-02 a D-05.
 *
 * O paciente pede ajuda pelo botão "Atendimento com suporte"; o admin vê o pedido em
 * `/admin/anvisa` e ativa a procuração ("Be4Hope faz por mim") para aquela autorização.
 *
 * Sem soft delete de propósito: o pedido NUNCA é apagado (`DO-72`). Estas colunas guardam
 * só o estado atual; cada ativação e desativação, com quem e quando, fica em
 * `logs_auditoria` (`dados_antes`/`dados_depois`), que também nunca se apaga — assim
 * ativar, desativar e ativar de novo não perde o registro das vezes anteriores.
 *
 * As chaves estrangeiras não têm cascata: autorização e paciente têm soft delete, e
 * cascata apagaria histórico.
 */
// Encerrados: `concluido` ou `rejeitado_anvisa` (DO-76).
export const pedidosAtendimentoAssistido = pgTable(
  'pedidos_atendimento_assistido',
  {
    ...baseColumns,
    autorizacaoId: text('autorizacao_id')
      .notNull()
      .references(() => autorizacoesAnvisa.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    status: pedidoAtendimentoStatusEnum('status').notNull().default('aguardando_ativacao'),
    pedidoEm: timestamp('pedido_em', { withTimezone: true }).notNull().defaultNow(),
    ativadoPor: text('ativado_por').references(() => users.id),
    ativadoEm: timestamp('ativado_em', { withTimezone: true }),
    desativadoPor: text('desativado_por').references(() => users.id),
    desativadoEm: timestamp('desativado_em', { withTimezone: true }),
    // Quando saiu dos pendentes: a ANVISA aprovou (`concluido`) ou rejeitou (`rejeitado_anvisa`).
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
  },
  (t) => [
    index('pedidos_atendimento_paciente_idx').on(t.pacienteId),
    index('pedidos_atendimento_status_idx').on(t.status),
    // Um único pedido ABERTO por autorização, garantido pelo banco (ADR-0029 D-05 item 2):
    // dois cliques simultâneos não criam dois pedidos, mesmo que a checagem da action perca
    // a corrida. Encerrados (concluídos ou rejeitados) ficam fora da trava.
    uniqueIndex('pedidos_atendimento_aberto_unq')
      .on(t.autorizacaoId)
      .where(sql`${t.status} in ('aguardando_ativacao', 'pendente_autorizacao')`),
  ],
);
