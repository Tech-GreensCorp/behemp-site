/**
 * O NÚCLEO: cria (ou reaproveita) a solicitação de cadastro e devolve o link único.
 *
 * Três portas de entrada chegam aqui, e todas passam pelo mesmo `resolverOuCriar`:
 *
 * - `linkParaOBot` — o bloco "Requisição externa" do chatbot chama e a resposta VIRA a
 *   mensagem do WhatsApp. É o caminho principal.
 * - `intake` — um integrador manda os dados e recebe JSON. Autenticado por segredo.
 * - `start` — o paciente clica numa URL e é redirecionado ao formulário já preenchido.
 *   Necessário porque o caminho principal só funciona no PRIMEIRO contato: com uma conversa
 *   já aberta, o menu não recomeça e o bloco nunca é alcançado.
 *
 * 🔴 IDEMPOTÊNCIA — a regra que impede o paciente de receber dois links
 * A chave é o identificador do contato no ChatPro; sem ele, o telefone em E.164. Se já
 * existe solicitação ativa para essa chave, ela é REAPROVEITADA: mesmo id, mesmo protocolo,
 * nada duplicado.
 *
 * ⚠️ Reaproveitar não é repetir o link. O token só existe em hash no banco, então o valor
 * original não é recuperável — um token NOVO é emitido para a mesma solicitação. Isso
 * precisa ser dito ao atendimento: **vale sempre o link mais recente**; se o bot rodar o
 * fluxo duas vezes, o link da primeira mensagem para de funcionar.
 */

import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

import { solicitacoesCadastro } from '@/db/schema';
import { solicitacaoCadastroOrigemEnum } from '@/db/schema/enums';
import { db } from '@/lib/db';
import { ClienteChatpro, type ContatoChatpro } from './cliente';
import { montarMensagemDoLink, primeiroNomeDe } from './mensagem-do-link';
import { mascararEmail, mascararTelefone, normalizarTelefoneWhatsapp } from './telefone';
import { urlDeRetornoPermitida } from '@/lib/parceiros/retorno';

/**
 * 🔴 DERIVA DO ENUM, e não de uma lista à mão — corrigido em 13/09/2026.
 *
 * A lista anterior era paralela ao `solicitacaoCadastroOrigemEnum` e **já estava
 * desatualizada**: faltava `greens_handoff`, que `lib/parceiros/handoff.ts` grava desde que o
 * handoff da Greens existe. Ninguém notou porque o handoff insere por outro caminho — então a
 * divergência não quebrava nada, só mentia sobre o que é possível.
 *
 * ⚠️ É a mesma classe que o `contrato-da-ia-e-a-unica-fonte` já fechou: **lista paralela é o
 * que desatualiza e aprova o errado**. Derivando do enum, um valor novo aparece aqui sozinho, e
 * um valor removido quebra a compilação de quem o usava.
 *
 * 🔴 E ISTO SUSTENTA O D-15: a origem é obrigatória neste tipo, então a porta 3 (link do admin,
 * que ainda não existe como tela) **não consegue nascer sem declarar de onde veio**. Decisão do
 * dono, 13/09/2026: _"sim, deve gravar"_.
 */
type Origem = (typeof solicitacaoCadastroOrigemEnum.enumValues)[number];

type CanalDeEntrega = 'bot_reply' | 'start_redirect' | 'manual';

export interface ResultadoDoLink {
  solicitacaoId: string;
  protocolo: string;
  linkDeAcesso: string;
  expiraEm: Date;
  /** `true` = a solicitação já existia. Nenhum protocolo novo foi criado. */
  reaproveitou: boolean;
  /** `true` = um token novo foi emitido. O link anterior parou de valer. */
  linkReemitido: boolean;
  nomeCompleto: string | null;
  email: string | null;
  telefone: string | null;
  origem: Origem;
}

/** Horas de validade do link. 168 = 7 dias. */
export function validadeEmHoras(): number {
  const bruto = Number(process.env.CHATPRO_LINK_TTL_HORAS);
  return Number.isFinite(bruto) && bruto > 0 ? bruto : 168;
}

/**
 * A URL do formulário que a Dryelle está construindo.
 *
 * Fica em variável de ambiente porque a rota ainda está sendo definida — trocar o caminho
 * não deve exigir alterar código nem novo deploy do backend.
 */
function caminhoDoFormulario(): string {
  return process.env.CHATPRO_CADASTRO_PATH?.trim() || '/cadastro';
}

function urlBase(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
}

/**
 * Gera o token e devolve o par (valor cru, hash).
 *
 * 32 bytes aleatórios em hexadecimal = 64 caracteres. O valor cru sai daqui uma única vez,
 * dentro da resposta que vai ao paciente; o banco guarda só o hash.
 */
export function gerarToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('hex');
  return { token, hash: createHash('sha256').update(token).digest('hex') };
}

export function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Próximo protocolo no formato `SOL-000123`.
 *
 * ⚠️ Deriva do maior protocolo já gravado, e não de uma contagem de linhas: contar linhas
 * repetiria o número depois de qualquer exclusão. Ainda assim, duas requisições exatamente
 * simultâneas podem calcular o mesmo valor — o índice único da coluna recusa a segunda, e
 * quem chama tenta de novo.
 */
export async function proximoProtocolo(): Promise<string> {
  const [linha] = await db
    .select({ protocolo: solicitacoesCadastro.protocolo })
    .from(solicitacoesCadastro)
    .orderBy(desc(solicitacoesCadastro.protocolo))
    .limit(1);

  const ultimo = Number(linha?.protocolo?.replace(/\D/g, '') ?? 0);
  const proximo = (Number.isFinite(ultimo) ? ultimo : 0) + 1;
  return `SOL-${String(proximo).padStart(6, '0')}`;
}

export function montarLink(token: string): string {
  return `${urlBase()}${caminhoDoFormulario()}/${token}`;
}

export class ServicoDeSolicitacao {
  constructor(private cliente = new ClienteChatpro()) {}

  /**
   * Procura uma solicitação ATIVA para a chave: status inicial, link não usado e não
   * expirado. Solicitação já enviada não é reaproveitada — o paciente que volta ao bot
   * depois de concluir está começando outra coisa.
   */
  private async buscarAtiva(params: { leadId?: string | null; telefone?: string | null }) {
    const agora = new Date();
    const base = [
      eq(solicitacoesCadastro.status, 'link_gerado' as const),
      isNull(solicitacoesCadastro.usadoEm),
      isNull(solicitacoesCadastro.deletedAt),
      gt(solicitacoesCadastro.expiraEm, agora),
    ];

    if (params.leadId) {
      const [porLead] = await db
        .select()
        .from(solicitacoesCadastro)
        .where(and(...base, eq(solicitacoesCadastro.chatproLeadId, params.leadId)))
        .orderBy(desc(solicitacoesCadastro.createdAt))
        .limit(1);
      if (porLead) return porLead;
    }

    if (params.telefone) {
      const [porTelefone] = await db
        .select()
        .from(solicitacoesCadastro)
        .where(and(...base, eq(solicitacoesCadastro.telefone, params.telefone)))
        .orderBy(desc(solicitacoesCadastro.createdAt))
        .limit(1);
      if (porTelefone) return porTelefone;
    }

    return null;
  }

  /** O coração: reaproveita a solicitação ativa da mesma chave, ou cria uma nova. */
  private async resolverOuCriar(params: {
    nomeCompleto: string | null;
    email: string | null;
    telefone: string | null;
    leadId?: string | null;
    sessionId?: string | null;
    origem: Origem;
    /** Ausente = o link foi criado mas ninguém o entregou (caso do webhook). */
    canalDeEntrega?: CanalDeEntrega | null;
    /** A conta de ChatPro de origem, quando houver (ADR-0018). */
    parceiro?: string | null;
    /**
     * Para onde devolver o paciente ao terminar.
     *
     * ⚠️ CONFERIDA CONTRA A LISTA DE ORIGENS antes de gravar — a mesma checagem do
     * handoff. Um destino fora da lista é redirecionamento aberto, e não importa se ele
     * veio de um handoff assinado ou da configuração de uma conta de bot.
     */
    urlDeRetorno?: string | null;
    /**
     * O que o parceiro diz que o paciente JÁ TEM.
     *
     * 🔴 Sem isto, `pendenciasDe(null)` devolve os cinco documentos como pendentes e todo
     * paciente do bot vira "não tem nada" — o que apagava a diferença entre os oito fluxos.
     *
     * ⚠️ `null`/vazio significa "não declarou", NUNCA "não tem". Por isso ele não sobrescreve
     * um manifesto que já existe: é a mesma regra do deploy — valor vazio não apaga o que está
     * lá, senão a segunda passagem pelo funil destrói o que a primeira apurou.
     */
    documentosDeclarados?: string[] | null;
  }): Promise<ResultadoDoLink> {
    const existente = await this.buscarAtiva({
      leadId: params.leadId,
      telefone: params.telefone,
    });

    const { token, hash } = gerarToken();
    const expiraEm = new Date(Date.now() + validadeEmHoras() * 60 * 60 * 1000);
    const entrega = params.canalDeEntrega
      ? { canalDeEntrega: params.canalDeEntrega, entregueEm: new Date() }
      : {};

    if (existente) {
      await db
        .update(solicitacoesCadastro)
        .set({
          // Um token novo: o anterior não é recuperável, e vale sempre o mais recente.
          tokenHash: hash,
          expiraEm,
          // O dado pode ter melhorado desde a primeira passagem pelo funil.
          nomeCompleto: params.nomeCompleto ?? existente.nomeCompleto,
          email: params.email ?? existente.email,
          telefone: params.telefone ?? existente.telefone,
          chatproLeadId: params.leadId ?? existente.chatproLeadId,
          chatproSessionId: params.sessionId ?? existente.chatproSessionId,
          // Só sobrescreve quando veio alguma coisa. Ver o comentário do parâmetro.
          ...(params.documentosDeclarados?.length
            ? { documentosDoParceiro: params.documentosDeclarados }
            : {}),
          ...entrega,
        })
        .where(eq(solicitacoesCadastro.id, existente.id));

      console.info('[chatpro] solicitação reaproveitada e link reemitido', {
        solicitacaoId: existente.id,
        protocolo: existente.protocolo,
        leadId: params.leadId ?? null,
        telefone: mascararTelefone(params.telefone),
        email: mascararEmail(params.email),
      });

      return {
        solicitacaoId: existente.id,
        protocolo: existente.protocolo,
        linkDeAcesso: montarLink(token),
        expiraEm,
        reaproveitou: true,
        linkReemitido: true,
        nomeCompleto: params.nomeCompleto ?? existente.nomeCompleto,
        email: params.email ?? existente.email,
        telefone: params.telefone ?? existente.telefone,
        origem: params.origem,
      };
    }

    const protocolo = await proximoProtocolo();

    const [criada] = await db
      .insert(solicitacoesCadastro)
      .values({
        protocolo,
        nomeCompleto: params.nomeCompleto,
        email: params.email,
        telefone: params.telefone,
        tokenHash: hash,
        expiraEm,
        status: 'link_gerado',
        origem: params.origem,
        chatproLeadId: params.leadId ?? null,
        chatproSessionId: params.sessionId ?? null,
        parceiro: params.parceiro ?? null,
        documentosDoParceiro: params.documentosDeclarados?.length
          ? params.documentosDeclarados
          : null,
        // 🔴 A MESMA validação do handoff: destino fora da lista de origens permitidas é
        // redirecionamento aberto, e não importa se veio de chamada assinada ou da
        // configuração de uma conta de bot.
        urlDeRetorno: urlDeRetornoPermitida(params.urlDeRetorno),
        ...entrega,
      })
      .returning({ id: solicitacoesCadastro.id, protocolo: solicitacoesCadastro.protocolo });

    console.info('[chatpro] solicitação criada a partir do WhatsApp', {
      solicitacaoId: criada.id,
      protocolo: criada.protocolo,
      origem: params.origem,
      leadId: params.leadId ?? null,
      telefone: mascararTelefone(params.telefone),
      email: mascararEmail(params.email),
    });

    return {
      solicitacaoId: criada.id,
      protocolo: criada.protocolo,
      linkDeAcesso: montarLink(token),
      expiraEm,
      reaproveitou: false,
      linkReemitido: false,
      nomeCompleto: params.nomeCompleto,
      email: params.email,
      telefone: params.telefone,
      origem: params.origem,
    };
  }

  /**
   * CAMINHO PRINCIPAL — o bloco "Requisição externa" do chatbot chama e a resposta vira a
   * mensagem do paciente.
   *
   * O ChatPro manda o id da sessão sozinho; o nome e o e-mail vêm dos parâmetros que o fluxo
   * capturou. A identidade é confirmada na API autenticada: sessão → contato → telefone.
   *
   * ⚠️ PRIORIDADE DO NOME: vale o que o paciente digitou quando o bot perguntou "me confirma
   * seu nome completo" — resposta deliberada e atual. O nome do perfil do WhatsApp costuma
   * ser apelido, ou nem existir. Para o TELEFONE é o contrário: vale o da API, que é o
   * número real da conversa.
   */
  async linkParaOBot(entrada: {
    sessionId?: string | null;
    leadId?: string | null;
    nome?: string | null;
    email?: string | null;
    telefone?: string | null;
    number?: string | null;
    /**
     * De qual conta de ChatPro veio (ADR-0018). Identificada pelo SEGREDO, não por
     * parâmetro de URL. Ausente = a conta da BeHemp, que é o caso histórico.
     */
    conta?: { id: string; urlDeRetorno: string | null } | null;
    /** O que o bot declarou que o paciente já tem. Ver `manifesto-da-url.ts`. */
    documentosDeclarados?: string[] | null;
  }): Promise<{ mensagem: string; resultado: ResultadoDoLink }> {
    let leadId = entrada.leadId?.trim() || null;
    let nome = entrada.nome?.trim() || null;
    const email = entrada.email?.trim().toLowerCase() || null;

    // `number` é o que o ChatPro envia por conta própria; `telefone` fica como alternativa
    // para quem configurar o parâmetro manualmente no fluxo.
    const telefoneDaUrl = entrada.number || entrada.telefone;
    let telefone = telefoneDaUrl ? normalizarTelefoneWhatsapp(telefoneDaUrl) : null;

    if (!leadId && entrada.sessionId && this.cliente.estaConfigurado()) {
      leadId = await this.cliente.buscarLeadIdPorSessao(entrada.sessionId.trim());
    }

    if (leadId && this.cliente.estaConfigurado()) {
      const contato = await this.cliente.buscarContatoPorId(leadId);
      if (!contato) throw new ErroDeContatoNaoConfirmado();

      nome = nome ?? contato.nome;
      telefone =
        (contato.telefone ? normalizarTelefoneWhatsapp(contato.telefone) : null) ?? telefone;
    }

    // Sem contato confirmado e sem telefone não há o que criar. Devolver erro faz o fluxo
    // cair na "Ação em caso de falha" e transferir para um atendente — que é a degradação
    // desejada, e é automática.
    if (!leadId && !telefone) throw new ErroDeContatoNaoConfirmado();

    const resultado = await this.resolverOuCriar({
      nomeCompleto: nome,
      email,
      telefone,
      leadId,
      sessionId: entrada.sessionId?.trim() ?? null,
      origem: 'chatpro_bot',
      canalDeEntrega: 'bot_reply',
      parceiro: entrada.conta?.id ?? null,
      urlDeRetorno: entrada.conta?.urlDeRetorno ?? null,
      documentosDeclarados: entrada.documentosDeclarados ?? null,
    });

    return { mensagem: this.textoDoLink(resultado), resultado };
  }

  /** Porta JSON, para integrador. Autenticada por segredo em cabeçalho. */
  async intake(entrada: {
    nome: string;
    email?: string | null;
    telefone: string;
    leadId?: string | null;
    sessionId?: string | null;
  }): Promise<ResultadoDoLink> {
    const telefone = normalizarTelefoneWhatsapp(entrada.telefone);
    if (!telefone) throw new ErroDeTelefoneInvalido();

    // Confirmação reversa é opcional aqui: o segredo do cabeçalho já autentica a origem.
    // Quando ligada, garante que o contato existe de fato na instância.
    if (process.env.CHATPRO_CONFIRMAR_NO_INTAKE === 'true' && this.cliente.estaConfigurado()) {
      const contato = entrada.leadId
        ? await this.cliente.buscarContatoPorId(entrada.leadId)
        : await this.cliente.buscarContatoPorTelefone(telefone);
      if (!contato) throw new ErroDeContatoNaoConfirmado();
    }

    return this.resolverOuCriar({
      nomeCompleto: entrada.nome.trim(),
      email: entrada.email?.trim().toLowerCase() ?? null,
      telefone,
      leadId: entrada.leadId ?? null,
      sessionId: entrada.sessionId ?? null,
      origem: 'chatpro_bot',
      canalDeEntrega: 'bot_reply',
    });
  }

  /**
   * O paciente clica numa URL e cai no formulário. É o caminho para quem JÁ TEM conversa
   * aberta — nesses casos o menu não recomeça e o caminho principal nunca é alcançado.
   *
   * 🔴 A URL é pública e clicável, então a segurança é diferente:
   * - com o identificador do contato confirmado na API → nome vai no pré-preenchimento;
   * - sem confirmação possível, aceita-se apenas o identificador (que é um UUID, portanto
   *   não adivinhável) e a origem fica marcada como não verificada — o formulário pede o
   *   nome de novo;
   * - só telefone e sem confirmação → recusa. Telefone é adivinhável, e quem soubesse o
   *   número de um paciente descobriria o nome dele.
   *
   * Devolve `null` quando nada pode ser criado; quem chama redireciona para uma página
   * neutra, sem revelar se aquele contato existe.
   */
  async start(entrada: {
    lead?: string | null;
    telefone?: string | null;
    session?: string | null;
  }): Promise<ResultadoDoLink | null> {
    const leadId = entrada.lead?.trim() || null;
    const telefoneDaUrl = entrada.telefone ? normalizarTelefoneWhatsapp(entrada.telefone) : null;

    if (!leadId && !telefoneDaUrl) {
      console.warn('[chatpro] start sem identificador utilizável');
      return null;
    }

    let contato: ContatoChatpro | null = null;
    if (this.cliente.estaConfigurado()) {
      contato = leadId
        ? await this.cliente.buscarContatoPorId(leadId)
        : await this.cliente.buscarContatoPorTelefone(telefoneDaUrl as string);
    }

    if (contato) {
      const telefone =
        (contato.telefone ? normalizarTelefoneWhatsapp(contato.telefone) : null) ?? telefoneDaUrl;

      return this.resolverOuCriar({
        nomeCompleto: contato.nome,
        email: null,
        telefone,
        leadId: leadId ?? contato.id,
        sessionId: entrada.session ?? null,
        origem: 'chatpro_start',
        canalDeEntrega: 'start_redirect',
      });
    }

    if (process.env.CHATPRO_START_SEM_CONFIRMACAO !== 'true' || !leadId) {
      console.warn('[chatpro] start com contato não confirmado, nada criado', {
        leadId,
        telefone: mascararTelefone(telefoneDaUrl),
      });
      return null;
    }

    return this.resolverOuCriar({
      nomeCompleto: null,
      email: null,
      telefone: telefoneDaUrl,
      leadId,
      sessionId: entrada.session ?? null,
      origem: 'chatpro_start_nao_verificado',
      canalDeEntrega: 'start_redirect',
    });
  }

  /** Traduz o resultado no texto que o paciente lê. */
  private textoDoLink(resultado: ResultadoDoLink): string {
    return montarMensagemDoLink({
      primeiroNome: primeiroNomeDe(resultado.nomeCompleto),
      linkDeAcesso: resultado.linkDeAcesso,
      protocolo: resultado.protocolo,
      validadeEmHoras: validadeEmHoras(),
      reaproveitou: resultado.reaproveitou,
    });
  }
}

/** O contato não pôde ser confirmado na API do ChatPro. */
export class ErroDeContatoNaoConfirmado extends Error {
  readonly codigo = 'CHATPRO_CONTATO_NAO_CONFIRMADO';
  constructor() {
    super('Não foi possível identificar o contato');
  }
}

/** O telefone recebido não normaliza para E.164. */
export class ErroDeTelefoneInvalido extends Error {
  readonly codigo = 'CHATPRO_TELEFONE_INVALIDO';
  constructor() {
    super('Telefone inválido');
  }
}
