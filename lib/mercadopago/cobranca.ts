/**
 * A COBRANÇA — a primeira chamada deste repositório que MOVE DINHEIRO (Parte 2, Fase 2).
 *
 * Cria o pagamento no Mercado Pago (`POST /v1/payments`) em nome do médico, com o access token
 * OAuth DELE: é o token que decide quem recebe — a doc não manda enviar `collector_id`
 * ("utilizando um access token para cada vendedor, obtido através de OAuth", Split 1:1). O
 * valor vai integralmente para o médico; sem `application_fee` nesta entrega.
 *
 * Cartão de crédito e PIX. Boleto fica fora: o vencimento mínimo documentado é de 3 dias, e a
 * reserva do horário dura 30 minutos.
 *
 * ## As regras que sustentam isto
 *
 *   · o VALOR sai do banco (`pagamentos.valor`, gravado na reserva), nunca do cliente
 *   · reserva vencida não gera cobrança — cobrar por um horário que já pode ser de outro é o
 *     pior erro possível aqui
 *   · toda tentativa deixa rastro: sucesso grava a referência do gateway; falha grava
 *     `pagamentoErroEm` e o motivo. Nenhuma chamada "some"
 *   · `X-Idempotency-Key` DETERMINÍSTICA (ver `chaveDeIdempotencia`): repetir a mesma tentativa
 *     — clique duplo, timeout de rede — devolve o MESMO pagamento, em vez de cobrar duas vezes
 *   · nada de `db.transaction`: em produção o driver é neon-http, que não implementa transação
 *     (guarda `a-transacao-usa-um-driver-que-a-suporta`). Cada escrita é um UPDATE único
 *
 * Fontes (conferidas em 23/09/2026):
 *   https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-api-payments/create-payment/post
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/payment-brick/payment-submission/pix
 *   https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix
 *
 * 🛑 Sem `'use server'`: quem chama é a action autenticada `iniciarCobranca`
 * (app/(public)/_actions/pagamento.ts), que confere antes que o paciente é dono da consulta.
 */

import { createHash } from 'node:crypto';

import { and, eq, isNull } from 'drizzle-orm';

import { consultas, pacientes, pagamentos, users } from '@/db/schema';
import { db } from '@/lib/db';
import { obterContaConectada } from '@/lib/mercadopago/conta';
import { registrarAuditoria } from '@/lib/utils/audit';

const URL_DE_PAGAMENTOS = 'https://api.mercadopago.com/v1/payments';

/**
 * Validade pedida para o PIX. A doc aceita de 30 minutos a 30 dias ("A data configurada deve
 * estar entre 30 minutos até 30 dias"); 31 dá um minuto de folga contra relógio e latência,
 * porque pedir exatamente o mínimo arrisca recusa. O que vale depois é a data que a API
 * DEVOLVE — é ela que vai para `consultas.pixValidoAte`.
 */
export const PIX_VALIDADE_MINUTOS = 31;

/** A chamada tem de terminar; esperar indefinidamente transforma falha em pendura. */
const TIMEOUT_DA_CHAMADA_MS = 20_000;

export type MetodoCobranca = 'pix' | 'cartao';

/** O que o Payment Brick entrega no `onSubmit` para cartão — o cartão já vem TOKENIZADO. */
export interface DadosCartao {
  token: string;
  paymentMethodId: string;
  issuerId?: string | null;
  installments: number;
  payer: {
    email: string;
    identification?: { type: string; number: string } | null;
  };
}

export type StatusLocalDoPagamento = 'em_processamento' | 'recusado' | 'cancelado' | 'estornado';

export type MotivoDaFalha =
  | 'reserva_invalida'
  | 'reserva_expirada'
  | 'pagamento_inexistente'
  | 'pagamento_ja_resolvido'
  | 'pagamento_em_andamento'
  | 'medico_sem_conta'
  | 'conta_do_medico_invalida'
  | 'dados_invalidos'
  | 'falha_de_comunicacao';

export type ResultadoDaCobranca =
  | {
      ok: true;
      pagamentoId: string;
      mpPaymentId: string;
      status: StatusLocalDoPagamento;
      /** `status` e `status_detail` do Mercado Pago, para a tela decidir a mensagem. */
      statusMp: string;
      statusDetailMp: string | null;
      pix?: { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; validoAte: Date };
    }
  | { ok: false; motivo: MotivoDaFalha; mensagem: string };

/** Resposta de `POST /v1/payments`, só nos campos que usamos. */
interface RespostaDoPagamento {
  id?: number | string;
  status?: string;
  status_detail?: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string | null;
    };
  };
}

/**
 * A chave de idempotência — igual para a MESMA tentativa, diferente para uma tentativa nova.
 *
 *   PIX:    pagamento + prazo da reserva. Repetir o pedido (clique duplo, timeout) devolve o
 *           mesmo PIX. Remarcar renova o prazo e, com ele, a chave — um PIX novo para o horário
 *           novo, em vez de reaproveitar um já vencido.
 *   cartão: pagamento + hash do token. O token do Brick é de uso único: um cartão novo (ou o
 *           mesmo cartão depois de uma recusa) gera token novo e, portanto, cobrança nova;
 *           reenviar o MESMO token é a mesma tentativa. O token não vai inteiro para a chave.
 *
 * ⚠️ A doc não publica por quanto tempo o Mercado Pago lembra de uma chave. O desenho não
 * depende disso para ser seguro: a reserva vence em 30 minutos.
 */
export function chaveDeIdempotencia(
  pagamentoId: string,
  metodo: MetodoCobranca,
  expiraEm: Date,
  tokenDoCartao?: string,
): string {
  if (metodo === 'pix') return `be4hope-${pagamentoId}-pix-${expiraEm.getTime()}`;
  const hash = createHash('sha256')
    .update(tokenDoCartao ?? '')
    .digest('hex')
    .slice(0, 32);
  return `be4hope-${pagamentoId}-cartao-${hash}`;
}

/**
 * Data no formato da doc (`2022-11-17T09:37:52.000-04:00`), em horário de Brasília. O Brasil
 * não tem horário de verão desde 2019, então -03:00 fixo é exato.
 */
export function formatarDataParaMp(data: Date): string {
  const brasilia = new Date(data.getTime() - 3 * 60 * 60 * 1000);
  return `${brasilia.toISOString().slice(0, 23)}-03:00`;
}

/** O status do Mercado Pago no vocabulário de `pagamento_status`. */
export function statusLocal(statusMp: string | undefined): StatusLocalDoPagamento {
  switch (statusMp) {
    case 'rejected':
      return 'recusado';
    case 'cancelled':
      return 'cancelado';
    case 'refunded':
    case 'charged_back':
      return 'estornado';
    // approved/authorized/pending/in_process/in_mediation: há dinheiro em trânsito. A consulta
    // só é CONFIRMADA pelo webhook, que relê o status na API (Fase 3) — não por esta resposta.
    default:
      return 'em_processamento';
  }
}

/** Só dígitos — CPF chega com máscara de vários jeitos. */
function soDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

/**
 * Registra a falha na linha do pagamento. Best-effort: a falha de escrita não pode esconder a
 * falha original — e a mensagem é técnica e curta, sem token nem dado de cartão.
 */
async function registrarFalha(pagamentoId: string, mensagem: string): Promise<void> {
  try {
    await db
      .update(pagamentos)
      .set({ pagamentoErroEm: new Date(), erroConfirmacao: `Cobrança: ${mensagem}` })
      .where(eq(pagamentos.id, pagamentoId));
  } catch (erro) {
    console.error('[mercadopago] falha ao registrar erro de cobrança', { pagamentoId, erro });
  }
}

/**
 * Cria a cobrança de uma consulta reservada.
 *
 * @param pacienteUserId o `users.id` do paciente autenticado — é quem a auditoria registra ao
 *   decifrar o token do médico (Decisão 6 do plano)
 */
export async function criarCobranca(
  consultaId: string,
  medicoId: string,
  pacienteUserId: string,
  metodo: MetodoCobranca,
  dadosCartao?: DadosCartao,
): Promise<ResultadoDaCobranca> {
  // ── 1. A reserva: existe, é deste médico, continua reservada e dentro do prazo ──────────
  const [consulta] = await db
    .select({
      id: consultas.id,
      medicoId: consultas.medicoId,
      pacienteId: consultas.pacienteId,
      status: consultas.status,
      expiraEm: consultas.expiraEm,
    })
    .from(consultas)
    .where(and(eq(consultas.id, consultaId), isNull(consultas.deletedAt)))
    .limit(1);

  if (!consulta || consulta.medicoId !== medicoId || consulta.status !== 'reservada') {
    return { ok: false, motivo: 'reserva_invalida', mensagem: 'Reserva não encontrada.' };
  }
  if (!consulta.expiraEm || consulta.expiraEm.getTime() <= Date.now()) {
    return {
      ok: false,
      motivo: 'reserva_expirada',
      mensagem: 'O prazo da reserva expirou. Escolha um novo horário.',
    };
  }

  const [pagamento] = await db
    .select({
      id: pagamentos.id,
      valor: pagamentos.valor,
      status: pagamentos.status,
      gatewayReferenciaId: pagamentos.gatewayReferenciaId,
      gatewayCheckoutUrl: pagamentos.gatewayCheckoutUrl,
    })
    .from(pagamentos)
    .where(and(eq(pagamentos.consultaId, consultaId), isNull(pagamentos.deletedAt)))
    .limit(1);

  if (!pagamento) {
    return {
      ok: false,
      motivo: 'pagamento_inexistente',
      mensagem: 'Não encontramos o registro de pagamento desta reserva.',
    };
  }
  if (['pago', 'isento', 'cancelado', 'estornado'].includes(pagamento.status)) {
    return {
      ok: false,
      motivo: 'pagamento_ja_resolvido',
      mensagem: 'Este pagamento já foi concluído ou cancelado.',
    };
  }
  // 🔴 COBRANÇA DUPLA. Com um pagamento em trânsito (cartão em análise, ou aprovado aguardando
  // o webhook), uma segunda tentativa por OUTRO meio pode ser paga também. A única repetição
  // aceita é a do mesmo PIX — a chave de idempotência devolve o mesmo pagamento, com o mesmo
  // QR code. PIX grava `gatewayCheckoutUrl` (o `ticket_url`); cartão não.
  if (pagamento.status === 'em_processamento' && pagamento.gatewayReferenciaId) {
    const ehRepeticaoDoPix = metodo === 'pix' && pagamento.gatewayCheckoutUrl !== null;
    if (!ehRepeticaoDoPix) {
      return {
        ok: false,
        motivo: 'pagamento_em_andamento',
        mensagem:
          'Já existe um pagamento em andamento para esta reserva. Aguarde a confirmação antes de tentar outro meio.',
      };
    }
  }

  const valor = Number(pagamento.valor);
  if (!Number.isFinite(valor) || valor <= 0) {
    await registrarFalha(pagamento.id, `valor inválido na linha (${pagamento.valor})`);
    return { ok: false, motivo: 'dados_invalidos', mensagem: 'Valor da consulta inválido.' };
  }

  // ── 2. O pagador ─────────────────────────────────────────────────────────────────────
  let payer: { email: string; identification?: { type: string; number: string } };
  if (metodo === 'pix') {
    // E-mail e CPF saem do cadastro, não do cliente. A doc do PIX exige documento: "é preciso
    // enviar o e-mail do comprador, o tipo e o número do documento".
    const [pagador] = await db
      .select({ email: users.email, cpf: pacientes.cpf })
      .from(pacientes)
      .innerJoin(users, eq(pacientes.userId, users.id))
      .where(eq(pacientes.id, consulta.pacienteId))
      .limit(1);
    const cpf = soDigitos(pagador?.cpf);
    if (!pagador || cpf.length !== 11) {
      await registrarFalha(pagamento.id, 'PIX sem CPF válido no cadastro do paciente');
      return {
        ok: false,
        motivo: 'dados_invalidos',
        mensagem: 'Para pagar com PIX, seu CPF precisa estar no cadastro.',
      };
    }
    payer = { email: pagador.email, identification: { type: 'CPF', number: cpf } };
  } else {
    if (!dadosCartao?.token || !dadosCartao.paymentMethodId || !dadosCartao.payer?.email) {
      return { ok: false, motivo: 'dados_invalidos', mensagem: 'Dados do cartão incompletos.' };
    }
    payer = { email: dadosCartao.payer.email };
    const doc = dadosCartao.payer.identification;
    if (doc?.type && soDigitos(doc.number)) {
      payer.identification = { type: doc.type, number: soDigitos(doc.number) };
    }
  }

  // ── 3. A credencial do médico — decifrar é o evento auditado (ADR-0024 §5) ────────────
  let accessToken: string;
  try {
    const conta = await obterContaConectada(medicoId, pacienteUserId, 'criar_cobranca');
    if (!conta) {
      await registrarFalha(pagamento.id, 'médico sem conta do Mercado Pago conectada');
      return {
        ok: false,
        motivo: 'medico_sem_conta',
        mensagem:
          'Este médico ainda não configurou o recebimento de pagamentos. Entre em contato com a clínica.',
      };
    }
    accessToken = conta.accessToken;
  } catch (erro) {
    // `decifrar` lança com chave trocada ou conteúdo adulterado. O token não vai para o log.
    console.error('[mercadopago] credencial do médico ilegível na cobrança', {
      medicoId,
      nome: erro instanceof Error ? erro.name : typeof erro,
    });
    await registrarFalha(pagamento.id, 'credencial do médico ilegível');
    return {
      ok: false,
      motivo: 'conta_do_medico_invalida',
      mensagem: 'Não foi possível processar o pagamento agora. Entre em contato com a clínica.',
    };
  }

  // ── 4. O pedido ──────────────────────────────────────────────────────────────────────
  const pixExpiraEm = new Date(Date.now() + PIX_VALIDADE_MINUTOS * 60 * 1000);
  const corpo: Record<string, unknown> = {
    transaction_amount: valor,
    description: 'Consulta Be4Hope',
    // O id da NOSSA linha: se a gravação abaixo falhar depois de o MP criar o pagamento, o
    // webhook ainda acha a linha por aqui (`GET /v1/payments/{id}` devolve o campo).
    external_reference: pagamento.id,
    payer,
  };
  if (metodo === 'pix') {
    corpo.payment_method_id = 'pix';
    corpo.date_of_expiration = formatarDataParaMp(pixExpiraEm);
  } else {
    const cartao = dadosCartao as DadosCartao;
    corpo.payment_method_id = cartao.paymentMethodId;
    corpo.token = cartao.token;
    corpo.installments = cartao.installments;
    if (cartao.issuerId) corpo.issuer_id = cartao.issuerId;
  }

  const chave = chaveDeIdempotencia(
    pagamento.id,
    metodo,
    consulta.expiraEm,
    metodo === 'cartao' ? dadosCartao?.token : undefined,
  );

  let resposta: Response;
  try {
    resposta = await fetch(URL_DE_PAGAMENTOS, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Idempotency-Key': chave,
      },
      body: JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_DA_CHAMADA_MS),
    });
  } catch (erro) {
    // ⚠️ AMBÍGUO: o pagamento PODE ter sido criado (a resposta é que se perdeu). Por isso o
    // status NÃO muda e a chave é determinística — repetir a mesma tentativa devolve o mesmo
    // pagamento em vez de criar outro.
    console.error('[mercadopago] falha de comunicação ao criar pagamento', {
      pagamentoId: pagamento.id,
      metodo,
      nome: erro instanceof Error ? erro.name : typeof erro,
    });
    await registrarFalha(pagamento.id, 'falha de comunicação com o Mercado Pago');
    return {
      ok: false,
      motivo: 'falha_de_comunicacao',
      mensagem: 'Não conseguimos falar com o Mercado Pago. Tente novamente em instantes.',
    };
  }

  if (!resposta.ok) {
    // O corpo pode trazer `message`/`cause`. Vai para o LOG, nunca para a tela do paciente.
    const detalhe = (await resposta.text().catch(() => '')).slice(0, 300);
    console.error('[mercadopago] pagamento recusado pela API', {
      pagamentoId: pagamento.id,
      metodo,
      status: resposta.status,
      detalhe,
    });
    const credencial = resposta.status === 401 || resposta.status === 403;
    await registrarFalha(
      pagamento.id,
      credencial
        ? `credencial do médico recusada (HTTP ${resposta.status})`
        : `API recusou o pedido (HTTP ${resposta.status})`,
    );
    if (credencial) {
      return {
        ok: false,
        motivo: 'conta_do_medico_invalida',
        mensagem: 'Não foi possível processar o pagamento agora. Entre em contato com a clínica.',
      };
    }
    if (resposta.status >= 500) {
      return {
        ok: false,
        motivo: 'falha_de_comunicacao',
        mensagem: 'O Mercado Pago está instável. Tente novamente em instantes.',
      };
    }
    return {
      ok: false,
      motivo: 'dados_invalidos',
      mensagem: 'O pagamento não foi aceito. Confira os dados e tente novamente.',
    };
  }

  const dados = (await resposta.json().catch(() => ({}))) as RespostaDoPagamento;
  if (dados.id === undefined || dados.id === null || !dados.status) {
    console.error('[mercadopago] resposta de pagamento sem id/status', {
      pagamentoId: pagamento.id,
    });
    await registrarFalha(pagamento.id, 'resposta do Mercado Pago sem id ou status');
    return {
      ok: false,
      motivo: 'falha_de_comunicacao',
      mensagem: 'Não conseguimos confirmar o pagamento. Tente novamente em instantes.',
    };
  }

  const mpPaymentId = String(dados.id);
  const status = statusLocal(dados.status);
  const transacao = dados.point_of_interaction?.transaction_data;

  let pix:
    | { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; validoAte: Date }
    | undefined;
  if (metodo === 'pix') {
    if (!transacao?.qr_code || !transacao.qr_code_base64) {
      console.error('[mercadopago] PIX criado sem QR code na resposta', { mpPaymentId });
      await registrarFalha(pagamento.id, `PIX ${mpPaymentId} sem QR code na resposta`);
      return {
        ok: false,
        motivo: 'falha_de_comunicacao',
        mensagem: 'Não conseguimos gerar o PIX. Tente novamente em instantes.',
      };
    }
    // A validade que VALE é a devolvida. Sem ela (campo opcional na referência), fica a pedida
    // — e o log registra, porque o job de expiração depende deste número.
    const devolvida = dados.date_of_expiration ? new Date(dados.date_of_expiration) : null;
    const validoAte = devolvida && Number.isFinite(devolvida.getTime()) ? devolvida : pixExpiraEm;
    if (validoAte === pixExpiraEm) {
      console.warn('[mercadopago] PIX sem date_of_expiration válido na resposta; usando o pedido', {
        mpPaymentId,
      });
    }
    pix = {
      qrCode: transacao.qr_code,
      qrCodeBase64: transacao.qr_code_base64,
      ticketUrl: transacao.ticket_url ?? null,
      validoAte,
    };
  }

  // ── 5. O registro ────────────────────────────────────────────────────────────────────
  try {
    await db
      .update(pagamentos)
      .set({
        gatewayProvider: 'mercadopago',
        gatewayReferenciaId: mpPaymentId,
        // PIX: o link do comprovante/QR. Cartão: nulo — é também o que distingue os dois na
        // regra de cobrança dupla acima.
        gatewayCheckoutUrl: pix?.ticketUrl ?? (metodo === 'pix' ? '' : null),
        pagamentoIniciadoEm: new Date(),
        status,
        pagamentoErroEm: null,
        erroConfirmacao: null,
      })
      .where(eq(pagamentos.id, pagamento.id));

    if (pix) {
      await db
        .update(consultas)
        .set({ pixValidoAte: pix.validoAte })
        .where(eq(consultas.id, consultaId));
    }
  } catch (erro) {
    // 🔴 O PAGAMENTO EXISTE NO MERCADO PAGO e a linha não o registrou. Não é recuperável aqui:
    // o log leva o id para conciliação, e o webhook acha a linha pelo `external_reference`.
    console.error('[mercadopago] 🔴 pagamento criado no MP mas NÃO gravado', {
      pagamentoId: pagamento.id,
      mpPaymentId,
      status: dados.status,
      erro,
    });
    throw erro;
  }

  await registrarAuditoria({
    userId: pacienteUserId,
    acao: 'criar',
    entidade: 'pagamentos',
    entidadeId: pagamento.id,
    dadosDepois: { mpPaymentId, metodo, statusMp: dados.status, statusLocal: status },
  });

  return {
    ok: true,
    pagamentoId: pagamento.id,
    mpPaymentId,
    status,
    statusMp: dados.status,
    statusDetailMp: dados.status_detail ?? null,
    ...(pix ? { pix } : {}),
  };
}
