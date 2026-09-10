import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { db } from '@/lib/db';
import { solicitacoesCadastro } from '@/db/schema';
import {
  gerarToken,
  montarLink,
  proximoProtocolo,
  validadeEmHoras,
} from '@/lib/chatpro/solicitacao';
import { normalizarTelefoneWhatsapp } from '@/lib/chatpro/telefone';
import { somenteDigitosDoCpf } from '@/lib/validacao/cpf';

/**
 * RECEBE O CADASTRO QUE VEIO DO PARCEIRO.
 *
 * 🔴 REUSA `solicitacoes_cadastro`, e isso é decisão, não conveniência (ADR-0016 D-03).
 * A ADR-0015 fixou essa tabela como o ÚNICO mecanismo de link com token do sistema. Um
 * segundo mecanismo significaria duas regras de expiração, duas de uso único, e uma delas
 * esquecida na próxima mudança.
 *
 * 🔴 A IDEMPOTÊNCIA AQUI VALE DINHEIRO, NÃO SÓ HIGIENE.
 * Do lado da Greens, `behempJourney != NONE` roteia o pagamento para o Mercado Pago **com
 * desconto collab**; `NONE` vai para a Cannect (medido no schema deles). Um handoff
 * duplicado não erraria só um cadastro — erraria o gateway e o preço de uma compra.
 *
 * Por isso a chave é o **id do evento**, e um reenvio devolve a MESMA solicitação. É o
 * mesmo motivo pelo qual o `behempReferralId` lá **não é `@unique`**: reentrega precisa
 * ser absorvida em silêncio, não virar erro 500.
 */

export interface EntradaDoHandoff {
  parceiro: string;
  eventoId: string;
  nomeCompleto?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  /** O id do pedido no sistema do parceiro, quando houver. */
  pedidoDoParceiro?: string | null;
}

export interface ResultadoDoHandoff {
  /**
   * 🔴 O `behempReferralId` do outro lado. É o NOSSO id, e é por ele que o webhook de
   * volta localiza a solicitação lá (ADR-0016 D-12).
   *
   * É o `id` e não o `protocolo` porque o protocolo é SEQUENCIAL: quem tem um adivinha os
   * vizinhos, e este valor atravessa a fronteira entre duas empresas.
   */
  referralId: string;
  protocolo: string;
  linkDeAcesso: string;
  expiraEm: Date;
  /** `true` quando o evento já tinha sido recebido — reenvio, não cadastro novo. */
  reenvio: boolean;
}

export class ErroDeContatoInsuficiente extends Error {
  readonly codigo = 'CONTATO_INSUFICIENTE';
  constructor() {
    // Sem e-mail nem telefone não há como o paciente receber nada, nem como reconhecê-lo
    // depois. Criar a solicitação assim produziria um registro que ninguém consegue usar.
    super('É preciso ao menos e-mail ou telefone para encaminhar o paciente');
  }
}

export class ServicoDeHandoff {
  async receber(entrada: EntradaDoHandoff): Promise<ResultadoDoHandoff> {
    const email = entrada.email?.trim().toLowerCase() || null;
    const telefone = normalizarTelefoneWhatsapp(entrada.telefone ?? '') ?? null;
    if (!email && !telefone) throw new ErroDeContatoInsuficiente();

    // 1 ── O evento já chegou antes? Reenvio devolve a MESMA solicitação.
    const [porEvento] = await db
      .select()
      .from(solicitacoesCadastro)
      .where(
        and(
          eq(solicitacoesCadastro.parceiro, entrada.parceiro),
          eq(solicitacoesCadastro.eventoDoParceiro, entrada.eventoId),
          isNull(solicitacoesCadastro.deletedAt),
        ),
      )
      .limit(1);

    if (porEvento) {
      // ⚠️ Token NOVO, solicitação a mesma. O token só existe como hash: o valor original
      // não é recuperável nem por nós. Reemitir é a única forma de responder um reenvio —
      // e invalida o anterior, que é o comportamento já documentado ao atendimento.
      return this.reemitir(porEvento.id, porEvento.protocolo, true);
    }

    // 2 ── Mesmo paciente, evento diferente? Reaproveita em vez de duplicar.
    const existente = await this.buscarAtivaPorContato({ email, telefone });
    if (existente) {
      await db
        .update(solicitacoesCadastro)
        .set({
          parceiro: entrada.parceiro,
          eventoDoParceiro: entrada.eventoId,
          // `sql`-free: só sobrescreve o que veio preenchido, para não apagar dado bom
          // com nulo de um payload mais pobre que o anterior.
          ...(entrada.nomeCompleto?.trim() ? { nomeCompleto: entrada.nomeCompleto.trim() } : {}),
          ...(entrada.cpf ? { cpf: somenteDigitosDoCpf(entrada.cpf) } : {}),
          ...(entrada.pedidoDoParceiro ? { pedidoDoParceiro: entrada.pedidoDoParceiro } : {}),
        })
        .where(eq(solicitacoesCadastro.id, existente.id));
      return this.reemitir(existente.id, existente.protocolo, false);
    }

    // 3 ── Cadastro novo.
    const { token, hash } = gerarToken();
    const expiraEm = new Date(Date.now() + validadeEmHoras() * 60 * 60 * 1000);
    const protocolo = await proximoProtocolo();

    const [criada] = await db
      .insert(solicitacoesCadastro)
      .values({
        protocolo,
        nomeCompleto: entrada.nomeCompleto?.trim() || null,
        email,
        telefone,
        cpf: entrada.cpf ? somenteDigitosDoCpf(entrada.cpf) : null,
        tokenHash: hash,
        expiraEm,
        origem: 'greens_handoff',
        parceiro: entrada.parceiro,
        eventoDoParceiro: entrada.eventoId,
        pedidoDoParceiro: entrada.pedidoDoParceiro?.trim() || null,
        canalDeEntrega: 'parceiro_redirect',
      })
      .returning({ id: solicitacoesCadastro.id });

    return {
      referralId: criada.id,
      protocolo,
      linkDeAcesso: montarLink(token),
      expiraEm,
      reenvio: false,
    };
  }

  /** Emite token novo para uma solicitação existente e devolve o link. */
  private async reemitir(
    id: string,
    protocolo: string,
    reenvio: boolean,
  ): Promise<ResultadoDoHandoff> {
    const { token, hash } = gerarToken();
    const expiraEm = new Date(Date.now() + validadeEmHoras() * 60 * 60 * 1000);

    await db
      .update(solicitacoesCadastro)
      .set({ tokenHash: hash, expiraEm, status: 'link_gerado' })
      .where(eq(solicitacoesCadastro.id, id));

    return { referralId: id, protocolo, linkDeAcesso: montarLink(token), expiraEm, reenvio };
  }

  /**
   * Solicitação ainda utilizável para este contato: não usada, não expirada, não apagada.
   *
   * Procura por e-mail primeiro — no fluxo da Greens ele é confirmado no intake, enquanto
   * o telefone pode ser um contato secundário.
   */
  private async buscarAtivaPorContato(params: { email: string | null; telefone: string | null }) {
    for (const criterio of [
      params.email ? eq(solicitacoesCadastro.email, params.email) : null,
      params.telefone ? eq(solicitacoesCadastro.telefone, params.telefone) : null,
    ]) {
      if (!criterio) continue;
      const [linha] = await db
        .select()
        .from(solicitacoesCadastro)
        .where(
          and(
            criterio,
            isNull(solicitacoesCadastro.usadoEm),
            isNull(solicitacoesCadastro.deletedAt),
            gt(solicitacoesCadastro.expiraEm, new Date()),
          ),
        )
        .orderBy(desc(solicitacoesCadastro.createdAt))
        .limit(1);
      if (linha) return linha;
    }
    return null;
  }
}
