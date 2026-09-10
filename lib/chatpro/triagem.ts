import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { chaveDeBusca } from './telefone';
import { autorizacoesAnvisa, pacientes, prescricoes, users } from '@/db/schema';

/**
 * O GATILHO DO BOT: ESTE PACIENTE PRECISA DO LINK? (ADR-0017)
 *
 * A [ADR-0015](../../docs/adr/ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md)
 * resolveu COMO o link nasce. Esta camada responde QUANDO oferecê-lo — e a resposta é a
 * falta de receita do nosso receituário ou de autorização da ANVISA.
 *
 * 🔴 DUAS FONTES, COM PESOS DIFERENTES (ADR-0017 D-06)
 *
 *   a resposta do paciente  →  ROTEIA  (decide por qual caminho ele segue)
 *   a busca por telefone    →  AJUDA   (pré-preenche, e o atendimento confere)
 *
 * A busca **não decide**, e o motivo é medido: `users.telefone` é gravado por quatro
 * caminhos e nenhum normaliza (`04` Item 26). Comparar por igualdade falharia — e
 * falharia em silêncio, concluindo "não é paciente nosso" sobre quem é.
 *
 * Comparamos só os dígitos, o que resolve formatação e DDI. Não resolve o celular antigo
 * sem o nono dígito: um paciente de 2019 apareceria como novo. É exatamente por isso que
 * esta função **informa** em vez de concluir.
 */

/** O que o paciente respondeu ao bot. `null` = ele não foi perguntado ou não respondeu. */
export type RespostaDoPaciente = 'tem_receita' | 'nao_tem' | 'nao_sabe' | null;

export interface SituacaoDoContato {
  /** O que a busca por telefone encontrou. NUNCA é usado para decidir sozinho. */
  candidato: {
    pacienteId: string;
    nome: string;
    temReceitaVigente: boolean;
    /** Emitida por nós, mas o prazo passou. É o único motivo DIZÍVEL (ADR-0017 D-03b). */
    temReceitaVencida: boolean;
    temAnvisaAprovada: boolean;
  } | null;
  /** A recomendação. Quem decide o fluxo continua sendo o painel, com a resposta dele. */
  deveOferecerLink: boolean;
  /** Por que — para log e para o atendimento. NUNCA vai para a tela do paciente. */
  motivo:
    | 'sem_cadastro'
    | 'falta_receita'
    | 'receita_vencida'
    | 'falta_anvisa'
    | 'tem_tudo'
    | 'paciente_disse_que_tem';
}

/**
 * Procura um paciente pelo telefone e mede a situação dele.
 *
 * Devolve `candidato: null` quando não acha — o que significa **"não sei"**, e não
 * "não existe". A diferença importa: quem chama não pode tratar a ausência como prova.
 */
export async function situacaoDoContato(params: {
  telefone?: string | null;
  resposta?: RespostaDoPaciente;
}): Promise<SituacaoDoContato> {
  const chave = chaveDeBusca(params.telefone);

  const candidato = chave ? await buscarCandidato(chave) : null;

  // ── Sem candidato: ele é novo, ou o telefone dele está gravado de um jeito que a
  //    busca não alcança. Nos dois casos, oferecer o link é o certo — a tela reconhece
  //    quem já tem conta (ADR-0016 D-07) e leva ao login.
  if (!candidato) {
    return { candidato: null, deveOferecerLink: true, motivo: 'sem_cadastro' };
  }

  /**
   * 🔴 A RESPOSTA DO PACIENTE VENCE A BUSCA, quando ela diz que falta algo.
   *
   * Se ele diz que NÃO tem receita e a base diz que tem, a base pode estar olhando uma
   * receita que ele perdeu, que venceu ontem, ou de que ele nem sabe. Ele está com o
   * documento na mão (ou não); nós temos uma linha no banco.
   *
   * O contrário não vale: ele dizer que TEM não fecha nada, porque a receita dele pode
   * ser de outro médico, ilegível ou vencida — e quem confere é gente (D-02).
   */
  if (params.resposta === 'nao_tem') {
    return { candidato, deveOferecerLink: true, motivo: 'falta_receita' };
  }

  if (!candidato.temReceitaVigente) {
    // Vencida é motivo DIZÍVEL: é fato objetivo, regra pública (RDC 1.015/2026), e não
    // julga o médico que a emitiu.
    return {
      candidato,
      deveOferecerLink: true,
      motivo: candidato.temReceitaVencida ? 'receita_vencida' : 'falta_receita',
    };
  }

  if (!candidato.temAnvisaAprovada) {
    return { candidato, deveOferecerLink: true, motivo: 'falta_anvisa' };
  }

  // Tem os dois. Se ele disse que não tem, já saímos acima — então aqui ele não
  // contradisse, e o caminho é outro (recompra, acompanhamento).
  return {
    candidato,
    deveOferecerLink: false,
    motivo: params.resposta === 'tem_receita' ? 'paciente_disse_que_tem' : 'tem_tudo',
  };
}

async function buscarCandidato(chave: string) {
  /**
   * `regexp_replace` no SQL porque a coluna é texto livre: comparar a coluna crua não
   * casaria `(62) 99999-7197` com `+5562999997197`. O índice não é usado — é varredura —
   * e isso é aceitável no volume de um bot de atendimento, mas **não** seria numa tela.
   */
  const [linha] = await db
    .select({ pacienteId: pacientes.id, nome: users.nome })
    .from(pacientes)
    .innerJoin(users, eq(users.id, pacientes.userId))
    .where(
      and(
        sql`right(regexp_replace(coalesce(${users.telefone}, ''), '[^0-9]', '', 'g'), 8) = ${chave}`,
        isNull(pacientes.deletedAt),
        isNull(users.deletedAt),
      ),
    )
    .orderBy(desc(pacientes.createdAt))
    .limit(1);

  if (!linha) return null;

  const agora = new Date();
  const [vigente] = await db
    .select({ id: prescricoes.id })
    .from(prescricoes)
    .where(
      and(
        eq(prescricoes.pacienteId, linha.pacienteId),
        // 🔴 Rascunho e cancelada NÃO contam. Só o que virou documento de verdade.
        sql`${prescricoes.status} in ('emitida','assinada')`,
        gt(prescricoes.validade, agora),
        isNull(prescricoes.deletedAt),
      ),
    )
    .limit(1);

  const [vencida] = vigente
    ? [null]
    : await db
        .select({ id: prescricoes.id })
        .from(prescricoes)
        .where(
          and(
            eq(prescricoes.pacienteId, linha.pacienteId),
            sql`${prescricoes.status} in ('emitida','assinada')`,
            isNull(prescricoes.deletedAt),
          ),
        )
        .limit(1);

  const [anvisa] = await db
    .select({ id: autorizacoesAnvisa.id })
    .from(autorizacoesAnvisa)
    .where(
      and(
        eq(autorizacoesAnvisa.pacienteId, linha.pacienteId),
        eq(autorizacoesAnvisa.status, 'aprovado'),
        isNull(autorizacoesAnvisa.deletedAt),
      ),
    )
    .limit(1);

  return {
    pacienteId: linha.pacienteId,
    nome: linha.nome,
    temReceitaVigente: Boolean(vigente),
    temReceitaVencida: Boolean(vencida),
    temAnvisaAprovada: Boolean(anvisa),
  };
}
