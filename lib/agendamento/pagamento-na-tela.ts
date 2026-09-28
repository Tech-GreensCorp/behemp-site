/**
 * O QUE A TELA DE PAGAMENTO FAZ COM O QUE O BRICK E A ACTION DEVOLVEM (Parte 2, Fase 5).
 *
 * Puro — sem `db`, sem `auth`, sem `next/*` —, para que a lógica da tela seja testada sem
 * navegador. O componente (`components/shared/agendamento-pagamento-step.tsx`) só escolhe o que
 * desenhar a partir do `EstadoDoPagamento` que sai daqui.
 *
 * As duas pontas, conferidas em 28/09/2026:
 *
 *   · o `onSubmit` do Payment Brick entrega `{ selectedPaymentMethod, formData }`, com
 *     `formData` em snake_case (`token`, `issuer_id`, `payment_method_id`, `installments`,
 *     `payer`) — tipos de `@mercadopago/sdk-react@1.0.7`, `esm/bricks/payment/type.d.ts`.
 *     O cartão chega TOKENIZADO: o número nunca passa por aqui
 *   · `iniciarCobranca` (app/(public)/_actions/pagamento.ts) espera camelCase e devolve o status
 *     local, o status do Mercado Pago e, no PIX, o QR code
 *
 * 🔴 "APROVADO" NA RESPOSTA NÃO É "CONFIRMADO". Quem confirma a consulta é o webhook, depois de
 * reler o pagamento na API (Fase 3). A tela diz "aprovado, confirmando sua consulta" e espera o
 * aviso — nunca "consulta confirmada" a partir da resposta do POST.
 */

/**
 * 🔴 O `selectedPaymentMethod` QUE O BRICK REALMENTE ENVIA — e não o que a tipagem diz.
 *
 * A tipagem de `@mercadopago/sdk-react@1.0.7` (`esm/bricks/payment/type.d.ts`,
 * `TPaymentBrickPaymentType`) declara `'creditCard'`. O Brick que o Mercado Pago SERVE envia
 * `'credit_card'`: no bundle `https://http2.mlstatic.com/frontend-assets/op-cho-bricks/build/
 * {3.18.0,3.17.1}/components/payment.js` (o endereço que `sdk.mercadopago.com/js/v2` monta), o
 * enum exportado como `dm` no módulo 7765 é `CREDIT_CARD="credit_card"`, `DEBIT_CARD="debit_card"`,
 * `BANK_TRANSFER="bank_transfer"` — conferido em 28/09/2026.
 *
 * Confiar na tipagem fez TODO pagamento com cartão parar aqui, antes de chegar ao servidor, com
 * "Este meio de pagamento não está disponível" (Item 55 de docs/04). `'creditCard'` fica só como
 * reserva, para o dia em que o SDK corrigir a tipagem e o Brick passar a enviá-la.
 *
 * ⚠️ Isto é o VALOR do `onSubmit`. As CHAVES de `customization.paymentMethods` (`creditCard`,
 * `bankTransfer`) são outra coisa, em camelCase de verdade — medido: o Brick renderiza os dois
 * meios com elas.
 */
export const MEIOS_DE_CARTAO_DE_CREDITO: readonly string[] = ['credit_card', 'creditCard'];
export const MEIO_PIX = 'bank_transfer';

export type MeioDoBrick = 'credit_card' | 'creditCard' | 'bank_transfer' | (string & {});

/** O subconjunto do `formData` do Brick que a cobrança usa (snake_case, como o Brick entrega). */
export interface FormDataDoBrick {
  token?: string;
  issuer_id?: string | number | null;
  payment_method_id?: string;
  installments?: number | string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string } | null;
  };
}

/** O que `iniciarCobranca` recebe — espelha `EntradaIniciarCobranca`, sem importá-la de `'use server'`. */
export type EntradaDaCobranca =
  | { consultaId: string; metodo: 'pix' }
  | {
      consultaId: string;
      metodo: 'cartao';
      dadosCartao: {
        token: string;
        paymentMethodId: string;
        issuerId: string | null;
        installments: number;
        payer: { email: string; identification: { type: string; number: string } | null };
      };
    };

/**
 * O envio do Brick → a entrada da action. `null` quando o Brick mandou algo que não cobramos
 * (meio desligado, token ausente) — a tela mostra erro em vez de chamar o servidor.
 */
export function entradaDoBrick(
  consultaId: string,
  envio: { selectedPaymentMethod?: MeioDoBrick; formData?: FormDataDoBrick },
): EntradaDaCobranca | null {
  if (envio.selectedPaymentMethod === MEIO_PIX) {
    // PIX: o pagador sai do CADASTRO no servidor (e-mail e CPF). O que o Brick coletou é ignorado.
    return { consultaId, metodo: 'pix' };
  }
  if (!MEIOS_DE_CARTAO_DE_CREDITO.includes(envio.selectedPaymentMethod ?? '')) return null;

  const f = envio.formData ?? {};
  const parcelas = Number(f.installments);
  if (!f.token || !f.payment_method_id || !f.payer?.email || !Number.isInteger(parcelas)) {
    return null;
  }
  const doc = f.payer.identification;
  return {
    consultaId,
    metodo: 'cartao',
    dadosCartao: {
      token: f.token,
      paymentMethodId: f.payment_method_id,
      issuerId: f.issuer_id == null || f.issuer_id === '' ? null : String(f.issuer_id),
      installments: parcelas,
      payer: {
        email: f.payer.email,
        identification: doc?.type && doc.number ? { type: doc.type, number: doc.number } : null,
      },
    },
  };
}

/**
 * POR QUE O ENVIO NÃO VIROU COBRANÇA — o que vai para o log quando `entradaDoBrick` devolve `null`.
 *
 * Só o meio (texto curto do próprio Brick) e os NOMES dos campos que faltaram. Nunca o valor de
 * nenhum campo: `token`, e-mail e documento do pagador não saem daqui. É o que teria mostrado, no
 * primeiro teste, que o Brick mandava `credit_card` — em vez de só "meio não disponível".
 */
export function diagnosticoDoEnvio(envio: {
  selectedPaymentMethod?: MeioDoBrick;
  formData?: FormDataDoBrick;
}): { meio: string; reconhecido: boolean; faltando: string[] } {
  const meio = String(envio.selectedPaymentMethod ?? '(ausente)').slice(0, 40);
  const cartao = MEIOS_DE_CARTAO_DE_CREDITO.includes(envio.selectedPaymentMethod ?? '');
  const reconhecido = cartao || envio.selectedPaymentMethod === MEIO_PIX;
  const f = envio.formData ?? {};
  const faltando = !cartao
    ? []
    : [
        !f.token && 'token',
        !f.payment_method_id && 'payment_method_id',
        !f.payer?.email && 'payer.email',
        !Number.isInteger(Number(f.installments)) && 'installments',
      ].filter((c): c is string => Boolean(c));
  return { meio, reconhecido, faltando };
}

/** O resultado de `iniciarCobranca`, no formato serializado que chega ao client. */
export type ResultadoDaAction =
  | {
      sucesso: true;
      dados: {
        status: string;
        statusMp: string;
        statusDetailMp: string | null;
        pix?: { qrCode: string; qrCodeBase64: string; ticketUrl: string | null; validoAte: string };
      };
    }
  | { sucesso: false; erro: string; motivo?: string };

export type EstadoDoPagamento =
  /** Nada enviado ainda: o Brick aparece. */
  | { tipo: 'escolhendo' }
  /** PIX gerado: QR code e copia-e-cola, com a validade REAL devolvida pela API. */
  | {
      tipo: 'pix';
      qrCode: string;
      qrCodeBase64: string;
      ticketUrl: string | null;
      validoAte: string;
    }
  /** PIX gerado antes (reload), sem o QR em mãos: só dá para pedir de novo ou esperar. */
  | { tipo: 'pix_sem_qr'; validoAte: string | null }
  /** Cartão aprovado pelo MP — a consulta AINDA não está confirmada (ver o cabeçalho). */
  | { tipo: 'aprovado' }
  /** Cartão em análise (`in_process`/`pending`): o resultado chega depois, pelo aviso. */
  | { tipo: 'em_analise' }
  | { tipo: 'recusado'; mensagem: string }
  /** Já existe pagamento em andamento para esta reserva (cobrança dupla recusada no servidor). */
  | { tipo: 'em_andamento' }
  | { tipo: 'reserva_expirada' }
  /**
   * Pago DEPOIS de o horário ser liberado (Fase 4.2, `pago_sem_horario`): o dinheiro entrou e a
   * consulta não existe. Reembolso ou reagendamento são manuais, e a tela tem de dizer isso.
   */
  | { tipo: 'pago_sem_horario' }
  /** O webhook confirmou: a consulta existe. */
  | { tipo: 'confirmado' }
  /** Falha que admite tentar de novo (rede, instabilidade do MP, dado inválido). */
  | { tipo: 'erro'; mensagem: string };

/**
 * Mensagem ao paciente por `status_detail` de recusa. Códigos da doc oficial ("Resultados de
 * pagamento", conferida em 28/09/2026). O que não está aqui cai na mensagem genérica — nunca
 * no código cru, que não diz nada a quem está pagando.
 */
const RECUSAS: Record<string, string> = {
  cc_rejected_bad_filled_card_number: 'Confira o número do cartão.',
  cc_rejected_bad_filled_date: 'Confira a data de validade do cartão.',
  cc_rejected_bad_filled_security_code: 'Confira o código de segurança (CVV) do cartão.',
  cc_rejected_bad_filled_other: 'Confira os dados do cartão.',
  cc_rejected_insufficient_amount:
    'O cartão não tem limite suficiente. Tente outro cartão ou o PIX.',
  insufficient_amount: 'O cartão não tem limite suficiente. Tente outro cartão ou o PIX.',
  cc_rejected_call_for_authorize:
    'O banco pediu autorização para este pagamento. Fale com o banco do cartão e tente de novo.',
  cc_rejected_card_disabled:
    'O cartão está desativado. Fale com o banco do cartão ou use outro meio.',
  cc_rejected_duplicated_payment:
    'Já existe um pagamento igual a este. Se ele não aparecer, use outro cartão.',
  cc_rejected_max_attempts: 'Você chegou ao limite de tentativas. Use outro cartão ou o PIX.',
  cc_rejected_invalid_installments: 'O cartão não aceita esse número de parcelas.',
  cc_rejected_card_type_not_allowed: 'Esse tipo de cartão não é aceito. Use outro cartão ou o PIX.',
};

const RECUSA_GENERICA = 'O pagamento foi recusado. Tente outro cartão ou pague com PIX.';

export function mensagemDeRecusa(statusDetail: string | null | undefined): string {
  return (statusDetail && RECUSAS[statusDetail]) || RECUSA_GENERICA;
}

/** O resultado da action → o que a tela mostra. */
export function estadoDoResultado(res: ResultadoDaAction): EstadoDoPagamento {
  if (!res.sucesso) {
    if (res.motivo === 'reserva_expirada' || res.motivo === 'reserva_invalida') {
      return { tipo: 'reserva_expirada' };
    }
    if (res.motivo === 'pagamento_em_andamento') return { tipo: 'em_andamento' };
    return { tipo: 'erro', mensagem: res.erro };
  }

  const { status, statusMp, statusDetailMp, pix } = res.dados;
  if (pix) return { tipo: 'pix', ...pix };
  if (status === 'recusado' || statusMp === 'rejected') {
    return { tipo: 'recusado', mensagem: mensagemDeRecusa(statusDetailMp) };
  }
  if (status === 'cancelado') return { tipo: 'recusado', mensagem: RECUSA_GENERICA };
  if (statusMp === 'approved' || statusMp === 'authorized') return { tipo: 'aprovado' };
  return { tipo: 'em_analise' };
}

/** O que o servidor diz da reserva e do pagamento — `obterPagamentoDaReserva`. */
export interface SituacaoDaReserva {
  statusConsulta: string;
  statusPagamento: string | null;
  /** Meio do pagamento em trânsito, se houver (`em_processamento` com referência no gateway). */
  emCurso: 'pix' | 'cartao' | null;
  pixValidoAte: string | null;
}

/**
 * A situação no banco → o estado da tela. É o que retoma a tela depois de um reload e o que
 * responde ao aviso do webhook.
 */
export function estadoDaSituacao(s: SituacaoDaReserva): EstadoDoPagamento {
  if (['agendada', 'confirmada', 'realizada'].includes(s.statusConsulta)) {
    return { tipo: 'confirmado' };
  }
  if (s.statusConsulta === 'cancelada') {
    return s.statusPagamento === 'pago'
      ? { tipo: 'pago_sem_horario' }
      : { tipo: 'reserva_expirada' };
  }
  if (s.statusPagamento === 'pago') return { tipo: 'confirmado' };
  if (s.statusPagamento === 'recusado') {
    return { tipo: 'recusado', mensagem: RECUSA_GENERICA };
  }
  if (s.emCurso === 'pix') return { tipo: 'pix_sem_qr', validoAte: s.pixValidoAte };
  if (s.emCurso === 'cartao') return { tipo: 'em_analise' };
  return { tipo: 'escolhendo' };
}

/**
 * Há dinheiro em trânsito? Enquanto houver, a tela NÃO devolve o paciente ao começo quando o
 * prazo da reserva acaba — a mesma regra da Fase 4 (`semPagamentoEmCurso`), que também não
 * libera a reserva no banco. Sem isto, a tela diria "o prazo acabou" a quem acabou de pagar.
 */
export function haPagamentoEmCurso(estado: EstadoDoPagamento, agora: number): boolean {
  switch (estado.tipo) {
    case 'pix':
      return new Date(estado.validoAte).getTime() > agora;
    case 'pix_sem_qr':
      return estado.validoAte === null || new Date(estado.validoAte).getTime() > agora;
    case 'aprovado':
    case 'em_analise':
    case 'em_andamento':
    case 'confirmado':
    case 'pago_sem_horario':
      return true;
    default:
      return false;
  }
}

/**
 * O estado atual + o que o banco diz agora → o que a tela mostra. O banco vence, com três
 * exceções em que a tela sabe MAIS que ele:
 *
 *   · a tela tem o QR code do PIX e o banco diz só "PIX em curso" → mantém o QR
 *   · a tela mostrou uma recusa ou um erro e o banco não tem nada em curso → mantém a mensagem
 *     (o banco não guarda o `status_detail`, e trocar pela genérica apagaria o "confira o CVV")
 *   · a tela sabe que o cartão foi APROVADO e o banco ainda diz "em curso" (o webhook não chegou)
 */
export function combinarComSituacao(
  atual: EstadoDoPagamento,
  s: SituacaoDaReserva,
): EstadoDoPagamento {
  const novo = estadoDaSituacao(s);
  if (novo.tipo === 'pix_sem_qr' && atual.tipo === 'pix') return atual;
  if (
    (atual.tipo === 'recusado' || atual.tipo === 'erro') &&
    (novo.tipo === 'escolhendo' || novo.tipo === 'recusado')
  ) {
    return atual;
  }
  if (novo.tipo === 'em_analise' && atual.tipo === 'aprovado') return atual;
  return novo;
}

/** O Brick pode aparecer? Só antes de enviar, e só com a reserva dentro do prazo. */
export function podeEnviar(estado: EstadoDoPagamento, reservaExpiraEm: string, agora: number) {
  const aberto =
    estado.tipo === 'escolhendo' || estado.tipo === 'recusado' || estado.tipo === 'erro';
  return aberto && new Date(reservaExpiraEm).getTime() > agora;
}

/**
 * Quanto a tela espera a resposta de uma cobrança antes de desistir. O servidor desiste da API
 * do Mercado Pago em 20 s (`lib/mercadopago/cobranca.ts`); isto cobre a ida e a volta da action.
 */
export const TEMPO_MAXIMO_DO_ENVIO_MS = 45_000;

export type DesfechoDoEnvio<T> =
  | { tipo: 'feito'; valor: T }
  /** Já havia um envio em curso: este foi descartado, e o primeiro cuida da tela. */
  | { tipo: 'ignorado' }
  /** O tempo acabou sem resposta. O envio PODE ter chegado ao servidor. */
  | { tipo: 'sem_resposta' };

/**
 * 🔴 UM ENVIO POR VEZ — a trava contra o duplo clique no "Pagar" do Brick.
 *
 * O botão mora dentro do Brick e o SDK nunca o desabilita. No cartão, o Brick TOKENIZA antes de
 * chamar o `onSubmit`, e um segundo clique nesse intervalo gera um SEGUNDO token — e token novo é
 * chave de idempotência nova (`chaveDeIdempotencia`, `lib/mercadopago/cobranca.ts`): duas
 * cobranças. O overlay da tela é a barreira visual; esta é a determinística. Enquanto um envio
 * está em curso, qualquer outro é descartado sem chamar o servidor.
 *
 * ⚠️ No `sem_resposta` a trava é LIBERADA de propósito — sem isso, uma action que nunca responde
 * prenderia a tela para sempre. O envio pode ter chegado, e é por isso que quem chama relê o
 * estado no banco antes de oferecer nova tentativa; e o servidor ainda recusa cobrança dupla
 * quando o primeiro pagamento já está gravado (`pagamento_em_andamento`).
 */
export function umEnvioPorVez<A extends unknown[], T>(
  enviar: (...args: A) => Promise<T>,
  opcoes: {
    tempoMaximoMs?: number;
    agendar?: (fn: () => void, ms: number) => unknown;
    cancelar?: (id: unknown) => void;
  } = {},
): (...args: A) => Promise<DesfechoDoEnvio<T>> {
  const {
    tempoMaximoMs = TEMPO_MAXIMO_DO_ENVIO_MS,
    agendar = (fn, ms) => setTimeout(fn, ms),
    cancelar = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  } = opcoes;
  let emCurso = false;

  return async (...args: A) => {
    if (emCurso) return { tipo: 'ignorado' };
    emCurso = true;
    let relogio: unknown;
    try {
      const esgotou = new Promise<DesfechoDoEnvio<T>>((resolver) => {
        relogio = agendar(() => resolver({ tipo: 'sem_resposta' }), tempoMaximoMs);
      });
      const feito = enviar(...args).then((valor): DesfechoDoEnvio<T> => ({ tipo: 'feito', valor }));
      return await Promise.race([feito, esgotou]);
    } finally {
      cancelar(relogio);
      emCurso = false;
    }
  };
}
