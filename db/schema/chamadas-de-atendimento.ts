import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { pedidosAtendimentoAssistido } from './pedidos-atendimento-assistido';
import { users } from './users';

/**
 * A chamada de atendimento com suporte — ADR-0029 §10 (D-12, D-13, D-19, D-20; `DO-74`).
 *
 * Uma chamada de VOZ entre o paciente que pediu ajuda e um admin, com a tela do paciente quando o
 * navegador deixa compartilhar, e um chat ao lado. Tabela PRÓPRIA, e não `teleconsultas`: aquela
 * sala exige médico (`medicoId notNull`) e o escopo dela é provado por guarda.
 *
 * `sala` é o nome do canal Pusher (`presence-atendimento-{sala}`). Vem de `crypto.randomUUID`,
 * não de `Math.random`: id de sala previsível é convite para quem tenta adivinhar.
 *
 * Nada é gravado (D-19): não há coluna de áudio, vídeo nem transcrição. Retenção: `retencaoAte`
 * existe e fica VAZIO até o Jurídico decidir o prazo (D-20).
 */
export const chamadasDeAtendimento = pgTable(
  'chamadas_de_atendimento',
  {
    ...baseColumns,
    pedidoId: text('pedido_id')
      .notNull()
      .references(() => pedidosAtendimentoAssistido.id),
    sala: text('sala').notNull().unique(),
    abertaPor: text('aberta_por')
      .notNull()
      .references(() => users.id),
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
    encerradaPor: text('encerrada_por').references(() => users.id),
    retencaoAte: timestamp('retencao_ate', { withTimezone: true }),
  },
  (t) => [
    index('chamadas_atendimento_pedido_idx').on(t.pedidoId),
    // Uma chamada ABERTA por pedido, garantida pelo banco: paciente e admin entrando ao mesmo
    // tempo caem na mesma sala, em vez de cada um abrir a sua.
    uniqueIndex('chamadas_atendimento_aberta_unq')
      .on(t.pedidoId)
      .where(sql`${t.encerradaEm} is null`),
  ],
);

/**
 * As mensagens do chat da chamada (D-17, D-18).
 *
 * O print mora no store PRIVADO; `printUrl` guarda o endereço, que NUNCA sai do servidor — nem para
 * o navegador, nem para o Pusher. A imagem se vê pela rota autenticada
 * `GET /api/atendimento/print/{id}`, com escopo, auditoria e limite.
 */
export const mensagensDeAtendimento = pgTable(
  'mensagens_de_atendimento',
  {
    ...baseColumns,
    chamadaId: text('chamada_id')
      .notNull()
      .references(() => chamadasDeAtendimento.id),
    autorId: text('autor_id')
      .notNull()
      .references(() => users.id),
    texto: text('texto'),
    printUrl: text('print_url'),
    printTipo: text('print_tipo'),
    printBytes: integer('print_bytes'),
    retencaoAte: timestamp('retencao_ate', { withTimezone: true }),
  },
  (t) => [
    index('mensagens_atendimento_chamada_idx').on(t.chamadaId),
    // Mensagem vazia não existe: ou tem texto, ou tem print.
    check(
      'mensagens_atendimento_tem_conteudo',
      sql`${t.texto} is not null or ${t.printUrl} is not null`,
    ),
  ],
);
