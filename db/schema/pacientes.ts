import { pgTable, text, date, index } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { users } from './users';
import { medicos } from './medicos';
import { pacienteStatusEnum, tratamentoTipoEnum } from './enums';

/**
 * Tabela de pacientes — dados clínicos e vínculo com médico responsável.
 * Soft delete habilitado para preservar histórico clínico (LGPD).
 */
export const pacientes = pgTable(
  'pacientes',
  {
    ...baseColumns,
    userId: text('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    medicoId: text('medico_id').references(() => medicos.id),
    dataNascimento: date('data_nascimento'),
    cpf: text('cpf'),
    responsavelNome: text('responsavel_nome'),
    responsavelCpf: text('responsavel_cpf'),
    status: pacienteStatusEnum('status').notNull().default('aguardando_consulta'),
    tratamentoTipo: tratamentoTipoEnum('tratamento_tipo'),
    endereco: text('endereco'),
    ...softDeleteColumn,
  },
  (table) => [
    index('pacientes_medico_idx').on(table.medicoId),
    index('pacientes_status_idx').on(table.status),
  ],
);
