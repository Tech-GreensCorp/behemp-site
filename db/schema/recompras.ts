import { pgTable, text, date, timestamp, integer, index } from 'drizzle-orm/pg-core';
import { baseColumns } from './_helpers';
import { dosagens } from './dosagens';
import { users } from './users';
import { pacientes } from './pacientes';
import { recompraStatusEnum } from './enums';

/**
 * Tabela de recompras — controle de pedidos de recompra de medicamento.
 * Suporta dois modos:
 *   1. Vinculada a dosagem (campo dosagemId preenchido)
 *   2. Avulsa / manual (campos medicamentoNome, mlFrasco, gotasPorDia, dataInicioUso preenchidos)
 *
 * Status: agendada → pedida → entregue
 */
export const recompras = pgTable(
  'recompras',
  {
    ...baseColumns,

    // Vínculo opcional com dosagem existente
    dosagemId: text('dosagem_id').references(() => dosagens.id),

    // Quem solicitou (paciente ou médico)
    solicitanteId: text('solicitante_id')
      .notNull()
      .references(() => users.id),

    // Paciente alvo (para quando médico cria para o paciente)
    pacienteId: text('paciente_id').references(() => pacientes.id),

    // Campos para recompra avulsa (manual)
    medicamentoNome: text('medicamento_nome'),
    mlFrasco: integer('ml_frasco'),
    gotasPorDia: integer('gotas_por_dia'),
    dataInicioUso: date('data_inicio_uso'),

    // Data calculada de término do medicamento
    dataPrevista: date('data_prevista').notNull(),

    // Dados de contato informados pelo solicitante
    contatoTelefone: text('contato_telefone'),
    contatoEmail: text('contato_email'),

    // Observações livres
    observacoes: text('observacoes'),

    status: recompraStatusEnum('status').notNull().default('pedida'),
    emailEnviadoEm: timestamp('email_enviado_em', { withTimezone: true }),
  },
  (table) => [
    index('recompras_dosagem_idx').on(table.dosagemId),
    index('recompras_data_idx').on(table.dataPrevista),
    index('recompras_status_idx').on(table.status),
    index('recompras_solicitante_idx').on(table.solicitanteId),
    index('recompras_paciente_idx').on(table.pacienteId),
  ],
);
