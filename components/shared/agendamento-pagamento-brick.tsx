'use client';

import { useMemo } from 'react';
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

export default function PagamentoBrick({
  publicKey,
  valor,
  onEnviar,
  onFalhaDoBrick,
}: PagamentoBrickProps) {
  garantirSdk(publicKey);

  // Referências estáveis: o Brick se remonta quando `initialization`/`customization` mudam de
  // identidade, e remontar no meio da digitação apaga o que o paciente preencheu.
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
      onSubmit={async (envio) => {
        // Resolve sempre: quem mostra o resultado (QR code, recusa, análise) é a nossa tela, que
        // desmonta o Brick logo depois. Rejeitar faria o Brick mostrar um erro genérico dele.
        await onEnviar({
          selectedPaymentMethod: envio.selectedPaymentMethod,
          formData: envio.formData as FormDataDoBrick,
        });
      }}
      onError={(erro) => {
        // Só o tipo e a causa do SDK — nunca o conteúdo do formulário.
        console.error('[pagamento] erro do Payment Brick', { tipo: erro.type, causa: erro.cause });
        if (erro.type === 'critical') onFalhaDoBrick();
      }}
    />
  );
}
