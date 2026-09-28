'use client';

import { memo, useCallback, useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';

import type { FormDataDoBrick, MeioDoBrick } from '@/lib/agendamento/pagamento-na-tela';

/**
 * O PAYMENT BRICK DO MERCADO PAGO — só no navegador (importado com `dynamic(…, { ssr: false })`
 * por `agendamento-pagamento-step.tsx`).
 *
 * 🔴 O CARTÃO NÃO PASSA POR NÓS. O Brick coleta os dados num formulário do próprio Mercado Pago
 * e entrega no `onSubmit` um `token` de uso único — é só isso que chega ao nosso servidor. A doc:
 * developers/pt/docs/checkout-bricks/payment-brick/payment-submission/cards (28/09/2026).
 *
 * Meios: cartão de CRÉDITO e PIX (`bankTransfer`). Boleto (`ticket`) fica fora porque o
 * vencimento mínimo documentado é de 3 dias e a reserva dura 30 minutos
 * (`lib/mercadopago/cobranca.ts`). Omitir a chave é o que desliga o meio.
 */

/** O SDK é global da página: inicializa uma vez por public key. */
let iniciadoCom: string | null = null;
function garantirSdk(publicKey: string) {
  if (iniciadoCom === publicKey) return;
  initMercadoPago(publicKey, { locale: 'pt-BR' });
  iniciadoCom = publicKey;
}

export interface EnvioDoBrick {
  selectedPaymentMethod?: MeioDoBrick;
  formData?: FormDataDoBrick;
}

interface PagamentoBrickProps {
  publicKey: string;
  valor: number;
  onEnviar: (envio: EnvioDoBrick) => Promise<void>;
  onFalhaDoBrick: () => void;
}

type PropsDoPayment = ComponentProps<typeof Payment>;
type EnvioDoPayment = Parameters<PropsDoPayment['onSubmit']>[0];
type ErroDoPayment = Parameters<NonNullable<PropsDoPayment['onError']>>[0];

/**
 * 🔴 TODA PROP DO `<Payment>` TEM DE TER IDENTIDADE ESTÁVEL — inclusive as FUNÇÕES.
 *
 * O `<Payment>` do SDK (`@mercadopago/sdk-react@1.0.7`, `esm/bricks/payment/index.js`) destrói
 * e recria o Brick — `paymentBrickController.unmount()` + `initBrick` 200 ms depois — sempre que
 * muda a identidade de `[initialization, customization, onReady, onError, onSubmit, onBinChange]`.
 *
 * Foi o defeito de 28/09/2026, em produção: `onSubmit` e `onError` eram setas inline, a etapa
 * re-renderiza a cada segundo (o cronômetro), e o Brick era recriado a cada segundo — os meios
 * sumiam e voltavam, e o que o paciente digitava se perdia. Por isso: as callbacks são criadas
 * UMA vez e leem a versão atual das props por `ref`, e o componente é `memo`.
 * Guarda: `a-tela-de-pagamento-nao-promete-o-que-o-webhook-nao-confirmou`, bloco 7.
 */
function PagamentoBrick({ publicKey, valor, onEnviar, onFalhaDoBrick }: PagamentoBrickProps) {
  garantirSdk(publicKey);

  // A versão mais recente das props, lida DENTRO das callbacks estáveis abaixo.
  const onEnviarRef = useRef(onEnviar);
  const onFalhaRef = useRef(onFalhaDoBrick);
  useEffect(() => {
    onEnviarRef.current = onEnviar;
    onFalhaRef.current = onFalhaDoBrick;
  });

  // Resolve sempre: quem mostra o resultado (QR code, recusa, análise) é a nossa tela, que
  // desmonta o Brick logo depois. Rejeitar faria o Brick mostrar um erro genérico dele.
  const onSubmit = useCallback(async (envio: EnvioDoPayment) => {
    await onEnviarRef.current({
      selectedPaymentMethod: envio.selectedPaymentMethod,
      formData: envio.formData as FormDataDoBrick,
    });
  }, []);

  const onError = useCallback((erro: ErroDoPayment) => {
    // Só o tipo e a causa do SDK — nunca o conteúdo do formulário.
    console.error('[pagamento] erro do Payment Brick', { tipo: erro.type, causa: erro.cause });
    if (erro.type === 'critical') onFalhaRef.current();
  }, []);

  // Referências estáveis também aqui, pelo mesmo motivo.
  const initialization = useMemo(() => ({ amount: valor }), [valor]);
  const customization = useMemo(
    () => ({
      paymentMethods: {
        creditCard: 'all' as const,
        bankTransfer: 'all' as const,
        // Só à vista (decisão do dono, 28/09/2026). A doc: "o número de parcelas será
        // restringido pelos valores passados". O servidor recusa mais de 1 de qualquer jeito.
        minInstallments: 1,
        maxInstallments: 1,
      },
    }),
    [],
  );

  return (
    <Payment
      initialization={initialization}
      customization={customization}
      locale="pt-BR"
      onSubmit={onSubmit}
      onError={onError}
    />
  );
}

/** `memo`: o cronômetro da etapa re-renderiza a cada segundo, e o Brick não precisa ouvir. */
export default memo(PagamentoBrick);
