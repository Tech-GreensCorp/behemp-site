import { index, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { baseColumns } from './_helpers';
import { users } from './users';
import { pacientes } from './pacientes';
import { vinculoResponsavelStatusEnum } from './enums';

/**
 * Quem cuida de menores — ADR-0033 D-12.
 *
 * O responsável é um `users` de papel `responsavel`, SEM linha em `pacientes` (D-02). Esta tabela guarda
 * o único dado pessoal que ele precisa ter além do que `users` já tem: o CPF (P-16 de Dryelle: na
 * procuração ele entra só com nome e CPF). Nome, e-mail e telefone reaproveitam `users`.
 *
 * ⚠️ Campo só com consumidor declarado (`.claude/rules/seguranca-lgpd.md`): o CPF serve à identificação
 * do responsável perante o médico e a procuração (D-15). Nenhuma coluna de RG, estado civil, profissão
 * nem endereço: nada as consome. O CPF é dado pessoal e NUNCA vai a log.
 *
 * ⚠️ `cpf` é nulo até o responsável cadastrar o primeiro dependente: a conta nasce antes de ele informá-lo.
 */
export const responsaveis = pgTable('responsaveis', {
  ...baseColumns,
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  cpf: text('cpf'),
});

/**
 * O vínculo responsável → dependente — ADR-0033 D-01. É a FONTE DE VERDADE de "quem responde por quem":
 * "dependente" é ter vínculo `ativo` (D-05), não uma coluna em `pacientes`.
 *
 * ⚠️ UM SÓ RESPONSÁVEL ATIVO POR PACIENTE (P-07): o índice único parcial abaixo é o que garante, no banco,
 * não só na tela. Só o admin encerra (P-07). A linha NUNCA é apagada: encerrar preserva a data e o motivo
 * (proibição 4 do CLAUDE.md).
 *
 * O vínculo nasce JUNTO com o dependente, criado pelo próprio responsável (D-09): ninguém "reivindica" um
 * paciente que já existe.
 */
export const responsaveisPacientes = pgTable(
  'responsaveis_pacientes',
  {
    ...baseColumns,
    responsavelUserId: text('responsavel_user_id')
      .notNull()
      .references(() => users.id),
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** Rótulo livre ("mãe", "pai", "avó", "tutor legal"…). Não é regra de negócio. */
    parentesco: text('parentesco').notNull(),
    status: vinculoResponsavelStatusEnum('status').notNull().default('ativo'),
    encerradoEm: timestamp('encerrado_em', { withTimezone: true }),
    encerradoPorUserId: text('encerrado_por_user_id').references(() => users.id),
    motivo: text('motivo'),
  },
  (t) => [
    uniqueIndex('responsaveis_pacientes_ativo_unq')
      .on(t.pacienteId)
      .where(sql`${t.status} = 'ativo'`),
    index('responsaveis_pacientes_responsavel_idx').on(t.responsavelUserId),
  ],
);
