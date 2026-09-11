import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { pacientes } from './pacientes';

/**
 * O CONSENTIMENTO DO PACIENTE PARA O COMPARTILHAMENTO ENTRE AS EMPRESAS.
 *
 * 🔴 POR QUE UMA TABELA, E NÃO UM BOOLEANO NA FICHA.
 *
 * A decisão D-02 da ADR-0021 rejeitou `consentiu: true`: não guarda **a quê** ele consentiu,
 * nem **quando**, nem permite **revogar**.
 *
 * E isso não é hipótese — o lado da Greens viveu exatamente esse problema e o relatou em
 * 10/09/2026: eles têm `Boolean @default(false)`, mudaram o texto do consentimento, e **quem
 * aceitou o texto antigo ficou indistinguível de quem aceitou o novo**. As duas linhas dizem
 * `true`. Um booleano não prova a quê.
 *
 * Cada coluna aqui responde a um artigo, e nenhuma é enfeite:
 *
 * | coluna              | por quê                                                         |
 * | ------------------- | --------------------------------------------------------------- |
 * | `finalidade`        | art. 11, I — consentimento para dado sensível é **específico**   |
 * | `versao`            | art. 8º §6º — mudança de finalidade obriga a informar e permitir |
 * |                     | revogar; sem versão não se sabe a que ele disse sim              |
 * | `textoApresentado`  | art. 9º §1º — consentimento é **nulo** se a informação não foi   |
 * |                     | clara. O que vale é o que ele LEU, não o que está na tela hoje   |
 * | `revogadoEm`        | art. 8º §5º — "pode ser revogado a qualquer momento… por         |
 * |                     | procedimento gratuito e facilitado"                              |
 * | `origem`            | o mesmo texto pode ser oferecido em telas diferentes             |
 *
 * ⚠️ UMA LINHA POR FINALIDADE, de propósito. Guardar as três num array impediria o caso real
 * de alguém aceitar a avaliação médica e **recusar** o envio à Greens — que é exatamente a
 * escolha que o art. 11, I existe para proteger.
 *
 * ⚠️ E NADA AQUI SE APAGA OU SE SOBRESCREVE. Revogar acrescenta `revogadoEm`; consentir de
 * novo cria linha nova. É registro de ato, e a proibição nº 4 do `CLAUDE.md` vale aqui como
 * vale para o histórico clínico: alteração preserva o anterior, a data e o motivo.
 */
export const consentimentos = pgTable(
  'consentimentos',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** `avaliacao_medica` · `apoio_anvisa` · `retorno_ao_parceiro`. */
    finalidade: text('finalidade').notNull(),
    versao: text('versao').notNull(),
    textoApresentado: text('texto_apresentado').notNull(),
    concedidoEm: timestamp('concedido_em', { withTimezone: true }).notNull().defaultNow(),
    revogadoEm: timestamp('revogado_em', { withTimezone: true }),
    origem: text('origem').notNull(),
  },
  (table) => [
    index('consentimentos_paciente_idx').on(table.pacienteId),
    /**
     * Buscar "o consentimento vigente desta finalidade" é a consulta que o envio faz antes de
     * cada transferência — e ela não pode ser cara, senão alguém "otimiza" guardando a
     * resposta em cache e o sistema passa a enviar com base numa foto velha.
     */
    index('consentimentos_finalidade_idx').on(table.pacienteId, table.finalidade),
  ],
);
