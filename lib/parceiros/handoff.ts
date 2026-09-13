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
import { normalizarManifesto } from './documentos';
import {
  materializarArquivos,
  normalizarEntradas,
  type ArquivoMaterializado,
} from './documentos-do-parceiro';
import { urlDeRetornoPermitida } from './retorno';

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

/**
 * Monta o que vai para `documentos_do_parceiro`, baixando o que vier com URL.
 *
 * O campo guarda uma lista MISTA de propósito: nome puro para o que o parceiro só declarou
 * ter, e objeto `{ tipo, urlBlob, ... }` para o que ele mandou de fato. `normalizarManifesto`
 * extrai os nomes das duas formas, então a tela de pendências não muda.
 *
 * ⚠️ Nunca lança: `materializarArquivos` engole a falha e devolve o que conseguiu. Documento
 * é conveniência; o cadastro do paciente é o que não pode falhar.
 */
async function manifestoComArquivos(
  documentos: Array<string | Record<string, unknown>> | null | undefined,
  referencia: string,
): Promise<Array<string | ArquivoMaterializado>> {
  const { manifesto, comArquivo } = normalizarEntradas(
    documentos as Parameters<typeof normalizarEntradas>[0],
  );
  if (comArquivo.length === 0) return normalizarManifesto(manifesto);

  const { arquivos, recusados } = await materializarArquivos(comArquivo, referencia);
  if (recusados.length > 0) {
    // Só o tipo e o motivo — nunca a URL, que pode conter assinatura de acesso.
    console.warn(
      '[parceiros] documentos recusados:',
      recusados.map((r) => `${r.tipo}:${r.motivo}`).join(','),
    );
  }
  const comArquivoPorTipo = new Set(arquivos.map((a) => a.tipo));
  const semArquivo = normalizarManifesto(manifesto).filter((n) => !comArquivoPorTipo.has(n));
  return [...semArquivo, ...arquivos];
}

export interface EntradaDoHandoff {
  parceiro: string;
  eventoId: string;
  nomeCompleto?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  /** O id do pedido no sistema do parceiro, quando houver. */
  pedidoDoParceiro?: string | null;
  /**
   * Quais dos 5 documentos o parceiro já tem.
   *
   * Duas formas aceitas (10/09/2026): a lista de NOMES, como sempre foi, ou objetos com a
   * URL do arquivo — `{ tipo, url, dataEmissao?, nomeArquivo? }`. Com URL, o arquivo é
   * baixado e re-hospedado aqui, e o paciente não precisa reenviar na procuração da ANVISA.
   */
  documentos?: Array<string | Record<string, unknown>> | null;
  /** Para onde devolver o paciente ao terminar. Conferida antes de gravar. */
  urlDeRetorno?: string | null;
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

    /**
     * 2 ── Mesmo paciente, evento diferente? Reaproveita em vez de duplicar.
     *
     * 🔴 MAS "MESMO PACIENTE" NÃO PODE SER DECIDIDO PELO TELEFONE SOZINHO.
     *
     * Medido em produção em 13/09/2026, com o dono preso na própria tela: ele preencheu o
     * formulário da Greens com `davi@greens-corp.com`, a Greens enviou esse e-mail, e a tela
     * da BeHemp abriu com `davimartins1001@gmail.com` — o endereço de um teste anterior.
     *
     * **A causa:** `buscarAtivaPorContato` tenta e-mail e, se não achar, **telefone**. O e-mail
     * novo não achava nada; o telefone (o mesmo de sempre) achava a solicitação velha. O
     * `update` abaixo sobrescrevia nome, CPF, documentos e URL de retorno — e **não o e-mail**.
     *
     * ⚠️ E O ESTRAGO NÃO PAROU NA TELA ERRADA. A conta nasceu com o e-mail certo, a solicitação
     * guardava o antigo, e a trava que compara a sessão com `solicitacao.email` (a proteção
     * contra a ficha ir para a conta de outro) passou a **barrar o dono legítimo**. Beco
     * fechado: sair e entrar com o outro e-mail não resolvia, porque a conta certa era a dele.
     *
     * 🔴 E HÁ O CASO PIOR, QUE NÃO ERA O DELE. Telefone é compartilhado — casal, mãe e filho,
     * o aparelho da família. Sem esta trava, o segundo paciente recebe um link que aponta para
     * a solicitação do primeiro: nome e CPF viram os dele, o e-mail continua sendo o do outro,
     * e a ficha com documentos clínicos nasce na conta errada. É OWASP API1 por uma chave que
     * não identifica pessoa.
     *
     * **A regra:** e-mail que chega vence, e divergência de e-mail impede o reaproveitamento.
     */
    const existente = await this.reaproveitavel({ email, telefone });
    if (existente) {
      await db
        .update(solicitacoesCadastro)
        .set({
          parceiro: entrada.parceiro,
          eventoDoParceiro: entrada.eventoId,
          // `sql`-free: só sobrescreve o que veio preenchido, para não apagar dado bom
          // com nulo de um payload mais pobre que o anterior.
          /**
           * 🔴 O CONTATO QUE CHEGA VENCE O GRAVADO. O e-mail é o login do paciente: mantê-lo
           * velho não é "preservar dado bom", é entregar a conta errada. Mesma razão do
           * telefone, que é por onde o link viaja.
           */
          ...(email ? { email } : {}),
          ...(telefone ? { telefone } : {}),
          ...(entrada.nomeCompleto?.trim() ? { nomeCompleto: entrada.nomeCompleto.trim() } : {}),
          ...(entrada.cpf ? { cpf: somenteDigitosDoCpf(entrada.cpf) } : {}),
          ...(entrada.pedidoDoParceiro ? { pedidoDoParceiro: entrada.pedidoDoParceiro } : {}),
          ...(entrada.documentos
            ? { documentosDoParceiro: await manifestoComArquivos(entrada.documentos, existente.id) }
            : {}),
          ...(urlDeRetornoPermitida(entrada.urlDeRetorno)
            ? { urlDeRetorno: urlDeRetornoPermitida(entrada.urlDeRetorno) }
            : {}),
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
        documentosDoParceiro: await manifestoComArquivos(entrada.documentos, protocolo),
        // 🔴 Conferida contra a lista de origens ANTES de gravar. Guardar primeiro e
        // validar na hora de exibir espalharia a checagem por toda tela que a use — e
        // bastaria uma esquecer para virar redirecionamento aberto.
        urlDeRetorno: urlDeRetornoPermitida(entrada.urlDeRetorno),
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
  /**
   * A solicitação aberta que PODE ser reaproveitada para este contato — ou `null`.
   *
   * 🔴 FALHA FECHADA: na dúvida, cria solicitação nova. Duplicar um cadastro custa um
   * protocolo a mais; fundir duas pessoas custa a ficha clínica de alguém na conta de outro.
   *
   * ⚠️ Achar por e-mail é seguro — o e-mail identifica a pessoa. Achar por TELEFONE não é: se
   * a solicitação encontrada já tem um e-mail e ele **diverge** do que chegou, ou é outra
   * pessoa no mesmo aparelho, ou é a mesma pessoa corrigindo o endereço. Nos dois casos a
   * resposta certa é a mesma: não misturar.
   */
  private async reaproveitavel(params: { email: string | null; telefone: string | null }) {
    const existente = await this.buscarAtivaPorContato(params);
    if (!existente) return null;

    const divergeNoEmail =
      Boolean(params.email) &&
      Boolean(existente.email) &&
      existente.email?.toLowerCase() !== params.email;

    if (divergeNoEmail) {
      // Sem PII no log: o fato basta para explicar por que nasceu um protocolo novo.
      console.warn('[parceiros] solicitação não reaproveitada — e-mail diverge do contato');
      return null;
    }

    return existente;
  }

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
