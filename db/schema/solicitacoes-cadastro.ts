import { pgTable, text, boolean, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

import { baseColumns, softDeleteColumn } from './_helpers';
import { solicitacaoCadastroOrigemEnum, solicitacaoCadastroStatusEnum } from './enums';

/**
 * SOLICITAÇÃO DE CADASTRO — o link único que o paciente recebe no WhatsApp.
 *
 * POR QUE ESTA TABELA EXISTE
 * O paciente chega pelo WhatsApp, o chatbot do ChatPro captura nome e e-mail, e o sistema
 * precisa devolver um endereço único e temporário onde ele completa o cadastro.
 *
 * ⚠️ DIFERENÇA EM RELAÇÃO AO GREENS, ONDE ESTA INTEGRAÇÃO JÁ RODA
 * Lá, o link já existia (`MedicationRequest`) e o ChatPro apenas o consumia — a ADR-0005
 * daquele projeto decidiu **não** criar um segundo mecanismo de token. Aqui não há o que
 * reusar: a BeHemp não tem nenhuma entidade com token, prazo de validade e protocolo. Esta
 * tabela é esse mecanismo, e passa a ser o **único** — nenhum outro token de acesso público
 * deve nascer no sistema.
 *
 * 🔴 O TOKEN NUNCA É GUARDADO EM CLARO
 * Só o SHA-256 dele (`tokenHash`). Consequência prática, e ela precisa ser dita ao
 * atendimento: **o link não é recuperável**. Se o paciente pedir de novo, um token NOVO é
 * emitido para a MESMA solicitação — mesmo id, mesmo protocolo, nada duplicado — e vale
 * sempre o link mais recente.
 *
 * 🔴 IDEMPOTÊNCIA (ADR-0003 do greens-corp)
 * A chave é `chatproLeadId` quando existe, senão o telefone em E.164. Sem isso, o paciente
 * que volta ao menu do bot recebe dois links, e o painel enche de solicitações fantasma.
 */
/**
 * O que o parceiro mandou sobre cada documento.
 *
 * Duas formas na mesma coluna, desde 10/09/2026: o NOME puro, para o que ele só declarou ter,
 * e o objeto, para o que ele mandou de fato — já baixado e re-hospedado aqui.
 *
 * Sem migration de propósito: a coluna é `jsonb`, e as linhas antigas (arrays de nome) seguem
 * válidas. `normalizarManifesto` lê as duas.
 */
export type DocumentoDoParceiro =
  | string
  | {
      tipo: string;
      urlBlob: string;
      nomeArquivo: string | null;
      dataEmissao: string | null;
    };

export const solicitacoesCadastro = pgTable(
  'solicitacoes_cadastro',
  {
    ...baseColumns,

    /** `SOL-000123`. Sequencial, é o que o paciente e o atendimento citam. */
    protocolo: text('protocolo').notNull(),

    // ── O que o ChatPro capturou ────────────────────────────────────────────────
    /**
     * Nome completo, como o paciente respondeu ao bot.
     *
     * ⚠️ Vale o que ele digitou quando o fluxo perguntou "me confirma seu nome completo",
     * e NÃO o nome do perfil do WhatsApp — que costuma ser apelido ("Zé do Bar") ou nem
     * existir. É a mesma prioridade adotada no greens-corp.
     */
    nomeCompleto: text('nome_completo'),
    /**
     * 🔴 O CAMPO QUE NÃO EXISTE NO FLUXO DO GREENS.
     *
     * Lá o bot pede só o nome, e o e-mail é coletado no formulário. Aqui ele é pedido no
     * WhatsApp, porque é por e-mail que o paciente recebe a confirmação e o acompanhamento
     * de cada etapa — e o e-mail é a chave da conta que ele vai usar depois.
     */
    email: text('email'),
    /** E.164, sempre. O sufixo `@s.whatsapp.net` é removido antes de gravar. */
    telefone: text('telefone'),

    // ── O que o paciente preencheu no formulário ────────────────────────────────
    /**
     * Só dígitos, sem pontuação. Validado por dígito verificador antes de gravar —
     * CPF sintaticamente impossível não entra, porque ele vai parar na prescrição.
     */
    cpf: text('cpf'),
    /**
     * O paciente já faz tratamento com cannabis?
     *
     * ⚠️ TRÊS ESTADOS, não dois: `true`, `false` e **`null` (não respondeu)**. Um
     * boolean `notNull().default(false)` afirmaria "não faz tratamento" sobre quem
     * apenas não chegou nessa parte do formulário — e é justamente essa resposta que
     * muda a conduta do médico na primeira consulta.
     */
    jaFazTratamento: boolean('ja_faz_tratamento'),
    /**
     * O que ele escreveu sobre o tratamento atual, em texto livre.
     *
     * 🔴 DADO SENSÍVEL DE SAÚDE (LGPD art. 11). Não vai para log, não vai para
     * notificação, e não sai desta tabela nem da ficha do paciente.
     */
    tratamentoAtual: text('tratamento_atual'),

    // ── O link ──────────────────────────────────────────────────────────────────
    /** SHA-256 do token. O valor cru só existe na resposta que vai ao paciente. */
    tokenHash: text('token_hash').notNull(),
    expiraEm: timestamp('expira_em', { withTimezone: true }).notNull(),
    /** Quando o paciente enviou o formulário. Preenchido = link consumido. */
    usadoEm: timestamp('usado_em', { withTimezone: true }),
    /** Primeiro acesso ao link, mesmo sem enviar. Distingue "não abriu" de "abriu e desistiu". */
    primeiroAcessoEm: timestamp('primeiro_acesso_em', { withTimezone: true }),

    status: solicitacaoCadastroStatusEnum('status').notNull().default('link_gerado'),
    origem: solicitacaoCadastroOrigemEnum('origem').notNull().default('painel_admin'),

    // ── Rastros do ChatPro ──────────────────────────────────────────────────────
    /** UUID do contato na API do ChatPro. É a chave de idempotência preferida. */
    chatproLeadId: text('chatpro_lead_id'),
    /** UUID da conversa. Muda a cada atendimento; serve para reconstituir o caminho. */
    chatproSessionId: text('chatpro_session_id'),
    // ── Contrato com o parceiro (ADR-0016 §7) ──────────────────────────────────
    /**
     * Qual parceiro encaminhou este paciente. `null` = veio direto pela BeHemp.
     *
     * Existe separado de `origem` porque as duas respondem perguntas diferentes: `origem`
     * diz por qual MECANISMO a solicitação nasceu (bot, formulário, painel), e este diz
     * de QUEM ela veio. Um parceiro novo amanhã não deve exigir um valor novo de enum.
     */
    parceiro: text('parceiro'),
    /**
     * O id do evento que trouxe este cadastro — a chave de idempotência do handoff.
     *
     * 🔴 É POR ELE QUE UM REENVIO NÃO VIRA SEGUNDA SOLICITAÇÃO. E aqui isso não é só
     * higiene: do lado da Greens, `behempJourney != NONE` roteia o pagamento para o
     * Mercado Pago **com desconto collab**. Um handoff duplicado erraria o gateway e o
     * preço de uma compra, não só um cadastro.
     */
    eventoDoParceiro: text('evento_do_parceiro'),
    /**
     * O id do pedido no sistema do parceiro, quando ele manda um.
     *
     * ⚠️ NÃO é o nosso `id`. O caminho de volta usa o NOSSO id como `behempReferralId`
     * lá (ADR-0016 D-12); este campo é a direção contrária — o que eles nos deram para
     * localizar o pedido de lá. Confundir os dois faz a volta procurar no lugar errado.
     */
    pedidoDoParceiro: text('pedido_do_parceiro'),
    /**
     * O MANIFESTO dos documentos que o parceiro já tem — e, por ausência, dos que faltam
     * (ADR-0016 D-06). São cinco: receita médica, laudo (opcional), comprovante de
     * residência, autorização da ANVISA e documento de identidade.
     *
     * 🔴 GUARDA O QUE EXISTE LÁ, NÃO OS ARQUIVOS. A cópia dos blobs é fase 2: mover
     * documento de saúde entre duas empresas exige URL assinada na origem, validação no
     * destino, store privado e prazo de retenção — e o Item 6 registra que este
     * repositório ainda tem 10+ uploads em store público.
     *
     * ⚠️ PENDÊNCIA NÃO BLOQUEIA. Quem chega sem receita é justamente quem mais precisa da
     * teleconsulta; barrá-lo na porta é recusar quem o produto existe para atender.
     */
    /**
     * Lista MISTA desde 10/09/2026: nome puro para o que o parceiro só declarou ter, e
     * `{ tipo, urlBlob, nomeArquivo, dataEmissao }` para o que ele mandou de fato.
     *
     * Sem migration de propósito — a coluna é `jsonb` e as linhas antigas (arrays de nome)
     * continuam válidas. `normalizarManifesto` lê as duas formas.
     */
    documentosDoParceiro: jsonb('documentos_do_parceiro').$type<DocumentoDoParceiro[]>(),
    /**
     * Para onde devolver o paciente quando ele terminar aqui (ADR-0016 D-08).
     *
     * Ele veio da Greens porque quer comprar medicamento, e a compra acontece lá.
     * Terminar sem caminho de volta é perder alguém no meio de um processo de duas
     * empresas.
     *
     * ⚠️ VALIDADA CONTRA UMA LISTA DE ORIGENS PERMITIDAS antes de virar link. Aceitar
     * URL arbitrária de um parceiro é redirecionamento aberto — a vítima confia no nosso
     * domínio e aterrissa onde o atacante quiser.
     */
    urlDeRetorno: text('url_de_retorno'),
    /**
     * O paciente que esta solicitação virou. Preenchido ao concluir o cadastro.
     *
     * 🔴 É A PEÇA QUE FECHA O CICLO. Sem ela, quando a receita fica pronta o sistema sabe
     * o `pacienteId` e não tem como descobrir de qual parceiro aquela pessoa veio — o
     * aviso de volta não teria destinatário.
     *
     * ⚠️ Sem FK de propósito: a coluna existe em `solicitacoes_cadastro`, que é de
     * cadastro e não clínica, e uma FK para `pacientes` faria a exclusão de um paciente
     * (soft delete, mas ainda assim) esbarrar aqui. O vínculo é rastro, não integridade.
     */
    pacienteId: text('paciente_id'),

    /**
     * Como o link chegou ao paciente: `bot_reply` (a resposta virou mensagem),
     * `start_redirect` (ele clicou numa URL e caiu no formulário) ou `manual` (atendente
     * copiou do painel).
     *
     * Sem isto, "o paciente não recebeu o link" é indebugável.
     */
    canalDeEntrega: text('canal_de_entrega'),
    entregueEm: timestamp('entregue_em', { withTimezone: true }),

    ...softDeleteColumn,
  },
  (t) => [
    uniqueIndex('solicitacoes_cadastro_protocolo_idx').on(t.protocolo),
    // A busca do token é por hash, e acontece a cada abertura do link.
    uniqueIndex('solicitacoes_cadastro_token_idx').on(t.tokenHash),
    // As duas chaves de idempotência do ADR-0003.
    index('solicitacoes_cadastro_lead_idx').on(t.chatproLeadId),
    index('solicitacoes_cadastro_telefone_idx').on(t.telefone),
    index('solicitacoes_cadastro_status_idx').on(t.status),
    // A busca do caminho de volta: dado um paciente, de qual parceiro ele veio?
    index('solicitacoes_cadastro_paciente_idx').on(t.pacienteId),
    /**
     * A chave de idempotência do handoff. Índice COMUM, não único — de propósito, e pelo
     * mesmo motivo que o `behempReferralId` da Greens não é `@unique`: reentrega de
     * webhook precisa ser absorvida em silêncio, não virar erro 500. A unicidade é
     * garantida pela consulta antes do insert, que sabe o que fazer com a colisão
     * (devolver o mesmo token) — coisa que uma constraint não sabe.
     */
    index('solicitacoes_cadastro_evento_parceiro_idx').on(t.eventoDoParceiro),
  ],
);
