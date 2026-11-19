import { sql } from 'drizzle-orm';
import { pgTable, text, date, integer, numeric, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { baseColumns, softDeleteColumn } from './_helpers';
import { planoTratamentoStatusEnum } from './enums';
import { pacientes } from './pacientes';

/**
 * Plano de Tratamento — a "Adesão ao Tratamento" do Programa de Acesso Collab.
 *
 * Tabela PRÓPRIA, separada das invoices, por decisão do dono (19/11/2026). Uma tabela só: tudo
 * no documento é 1:1 com o plano (um paciente, um medicamento, uma composição de valores).
 *
 * Os totais são CALCULADOS NO SERVIDOR (`lib/planos-tratamento/calculo.ts`) e gravados junto das
 * entradas. Gravar, e não recalcular na leitura, é deliberado: abrir ou reimprimir o documento
 * nunca muda o valor, mesmo que a fórmula mude depois. Só uma EDIÇÃO salva recalcula — e a
 * edição é auditada com o total de antes e o de depois. Valores em reais, `numeric(10, 2)`.
 *
 * CPF guardado só com dígitos (padrão de `lib/validacao/cpf.ts`); a máscara é de exibição.
 * `plano_number` é único entre os planos não apagados.
 *
 * Soft delete (AGENTS.md — entidade documental preserva histórico).
 */
export const planosTratamento = pgTable(
  'planos_tratamento',
  {
    ...baseColumns,
    ...softDeleteColumn,

    planoNumber: text('plano_number').notNull(),
    status: planoTratamentoStatusEnum('status').notNull().default('draft'),

    // Vínculo opcional com paciente cadastrado no sistema
    pacienteId: text('paciente_id').references(() => pacientes.id),

    // Dados da adesão
    patientName: text('patient_name').notNull(),
    cpf: text('cpf').notNull(),
    dataAdesao: date('data_adesao').notNull(),
    periodoMeses: integer('periodo_meses').notNull().default(12),
    medicamento: text('medicamento').notNull(),

    // Entradas da composição
    qtdFrascos: integer('qtd_frascos').notNull(),
    valorFrasco: numeric('valor_frasco', { precision: 10, scale: 2 }).notNull(),
    descontoPct: numeric('desconto_pct', { precision: 5, scale: 2 }).notNull(),
    qtdConsultas: integer('qtd_consultas').notNull(),
    valorConsulta: numeric('valor_consulta', { precision: 10, scale: 2 }).notNull(),
    qtdFretes: integer('qtd_fretes').notNull(),
    valorFrete: numeric('valor_frete', { precision: 10, scale: 2 }).notNull(),
    parcelas: integer('parcelas').notNull(),
    formaPagamento: text('forma_pagamento').notNull(),

    // Totais calculados no servidor
    subtotalMedicamentos: numeric('subtotal_medicamentos', { precision: 10, scale: 2 }).notNull(),
    valorSubsidio: numeric('valor_subsidio', { precision: 10, scale: 2 }).notNull(),
    medicamentosLiquido: numeric('medicamentos_liquido', { precision: 10, scale: 2 }).notNull(),
    totalConsultas: numeric('total_consultas', { precision: 10, scale: 2 }).notNull(),
    totalFretes: numeric('total_fretes', { precision: 10, scale: 2 }).notNull(),
    totalAdesao: numeric('total_adesao', { precision: 10, scale: 2 }).notNull(),
    valorParcela: numeric('valor_parcela', { precision: 10, scale: 2 }).notNull(),
  },
  (table) => [
    // Dois documentos financeiros com o mesmo número é defeito — o banco garante, não a tela.
    // Parcial: apagar um plano (soft delete) libera o número.
    uniqueIndex('planos_tratamento_number_unq')
      .on(table.planoNumber)
      .where(sql`${table.deletedAt} is null`),
    index('planos_tratamento_status_idx').on(table.status),
    index('planos_tratamento_paciente_idx').on(table.pacienteId),
    index('planos_tratamento_data_adesao_idx').on(table.dataAdesao),
  ],
);
