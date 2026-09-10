import { pgTable, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { baseColumns } from './_helpers';
import { parceiroEventoSaidaStatusEnum, parceiroEventoTipoEnum } from './enums';
import { solicitacoesCadastro } from './solicitacoes-cadastro';

/**
 * A FILA DE AVISOS QUE PRECISAM CHEGAR AO PARCEIRO (ADR-0016 D-09).
 *
 * 🔴 POR QUE UMA FILA, E NÃO UM `fetch` NA HORA
 * O aviso nasce no momento em que o médico assina a receita. Se a Greens estiver fora do
 * ar nesse instante — deploy, rede, manutenção — um `fetch` direto **perde o aviso para
 * sempre**, e ninguém descobre: o médico viu a receita ser assinada, o sistema não
 * reclamou, e o pedido do paciente simplesmente nunca destrava lá.
 *
 * Gravando primeiro, a indisponibilidade vira atraso em vez de perda. É a mesma escolha
 * do webhook do ChatPro, pelo mesmo motivo, na direção contrária.
 *
 * 🔴 E POR QUE O AVISO NÃO PODE ATRASAR A ASSINATURA
 * Se o envio fosse síncrono, uma Greens lenta seguraria a tela do médico. O ato clínico
 * não pode depender da disponibilidade de um parceiro comercial.
 *
 * ⚠️ NÃO GUARDA DADO CLÍNICO. O payload diz *que* a receita existe e sob qual protocolo —
 * nunca o que foi prescrito. Quem precisa do conteúdo tem a ficha, com controle de acesso.
 */
export const parceiroEventosSaida = pgTable(
  'parceiro_eventos_saida',
  {
    ...baseColumns,

    parceiro: text('parceiro').notNull(),
    tipo: parceiroEventoTipoEnum('tipo').notNull(),

    /**
     * A solicitação que originou o aviso. É o que impede o mesmo fato de virar dois
     * eventos — ver o índice único abaixo.
     */
    solicitacaoId: text('solicitacao_id')
      .notNull()
      .references(() => solicitacoesCadastro.id, { onDelete: 'cascade' }),

    /**
     * O `behempReferralId` do outro lado — o NOSSO id, que eles gravaram na ida.
     * É por ele que a Greens localiza a solicitação (ADR-0016 §7).
     *
     * Copiado para cá em vez de lido por join: se a solicitação for apagada, o aviso já
     * enviado continua fazendo sentido no histórico.
     */
    referralId: text('referral_id').notNull(),

    /** O corpo exato que vai no POST. Congelado na criação — ver o aviso abaixo. */
    payload: jsonb('payload').notNull(),

    status: parceiroEventoSaidaStatusEnum('status').notNull().default('pendente'),
    tentativas: integer('tentativas').notNull().default(0),
    ultimoErro: text('ultimo_erro'),
    /** Backoff: o processador ignora o que ainda não chegou a hora. */
    proximaTentativaEm: timestamp('proxima_tentativa_em', { withTimezone: true }).defaultNow(),
    enviadoEm: timestamp('enviado_em', { withTimezone: true }),
  },
  (t) => [
    /**
     * 🔴 O MESMO FATO NÃO VIRA DOIS AVISOS.
     *
     * Aqui o índice É único, diferente da fila de entrada — e a razão da diferença
     * importa: lá o remetente é o ChatPro e a reentrega dele precisa ser absorvida em
     * silêncio; aqui **quem cria somos nós**, e criar duas vezes seria bug nosso, não
     * comportamento de terceiro. Um erro que é nosso deve estourar, não ser engolido.
     */
    uniqueIndex('parceiro_eventos_saida_fato_idx').on(t.parceiro, t.tipo, t.solicitacaoId),
    index('parceiro_eventos_saida_fila_idx').on(t.status, t.proximaTentativaEm),
  ],
);
