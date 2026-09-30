'use client';

import { memo, useCallback, useEffect, useMemo, useRef, type ComponentProps } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { useTheme } from 'next-themes';

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
type VisualDoPayment = NonNullable<PropsDoPayment['customization']['visual']>;
type VariaveisDoPayment = NonNullable<NonNullable<VisualDoPayment['style']>['customVariables']>;

/**
 * A IDENTIDADE DO BEHEMP NO BRICK — os tokens do sistema Âmbar (`app/globals.css`), que é o
 * escopo de `(paciente)`, onde a etapa de pagamento mora.
 *
 * 🔴 SÓ CHAVES TIPADAS NA 1.0.7. O tipo `VisualDoPayment` recusa chave que o SDK não declara, e
 * não há cast aqui de propósito: a doc atual cita chaves que a 1.0.7 não tem
 * (`successSecondaryColor`, `fontSizeExtraExtraSmall`, os textos do cartão), e foi confiar em
 * valor fora da tipagem que produziu o `credit_card`/`creditCard` de 28/09/2026.
 *
 * `font` vale só para os campos PCI (iframe do MP, que não enxerga o `next/font`); o resto do
 * Brick herda a fonte da página. Sem `successColor`: o Âmbar não tem token de sucesso medido.
 */
const FONTE_DOS_CAMPOS =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600&display=swap';

const CANTOS = {
  borderRadiusSmall: '0.45rem', // --radius-sm
  borderRadiusMedium: '0.6rem', // --radius-md, o canto dos inputs no Âmbar
  borderRadiusLarge: '0.75rem', // --radius-lg
  inputFocusedBoxShadow: '0 0 0 4px rgba(234, 84, 41, 0.16)', // foco dos inputs no Âmbar
} satisfies VariaveisDoPayment; // `satisfies`: o spread abaixo não passa pela checagem de chave

const VISUAL_POR_TEMA: Record<'claro' | 'escuro', VisualDoPayment> = {
  claro: {
    font: FONTE_DOS_CAMPOS,
    style: {
      theme: 'default',
      customVariables: {
        textPrimaryColor: '#1A1612', // --foreground
        textSecondaryColor: '#3D3833', // --muted-foreground
        inputBackgroundColor: '#FFFFFF', // --card
        formBackgroundColor: '#FFFFFF', // --card
        baseColor: '#EA5429', // --primary (não --color-terracotta, #C34C32)
        errorColor: '#DC2626', // --destructive
        outlinePrimaryColor: '#DDD8D1', // --input: borda dos campos em repouso
        outlineSecondaryColor: '#DDD8D1', // --border: caixa dos meios, ícones, bandeiras
        buttonTextColor: '#FFFFFF', // --primary-foreground
        ...CANTOS,
      },
    },
  },
  escuro: {
    font: FONTE_DOS_CAMPOS,
    style: {
      theme: 'dark',
      customVariables: {
        textPrimaryColor: '#F5F2ED', // .dark --foreground
        textSecondaryColor: '#A09688', // .dark --muted-foreground
        inputBackgroundColor: '#1E1B18', // .dark --card
        formBackgroundColor: '#1E1B18', // .dark --card
        baseColor: '#EA5429', // .dark --primary
        errorColor: '#EF4444', // .dark --destructive
        outlinePrimaryColor: 'rgba(245, 242, 237, 0.15)', // .dark --input
        outlineSecondaryColor: 'rgba(245, 242, 237, 0.1)', // .dark --border
        buttonTextColor: '#FFFFFF', // .dark --primary-foreground
        ...CANTOS,
      },
    },
  },
};

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

  // O tema entra como string primitiva: o Brick só é recriado quando ele MUDA de fato.
  // `forcedTheme` primeiro — no next-themes 0.4.6 o `resolvedTheme` o ignora e pode dizer
  // "dark" (o do sistema) com a página forçada no claro (`theme-provider.tsx`).
  const { forcedTheme, resolvedTheme } = useTheme();
  const tema = (forcedTheme ?? resolvedTheme) === 'dark' ? 'escuro' : 'claro';

  // Referências estáveis também aqui, pelo mesmo motivo.
  const initialization = useMemo(() => ({ amount: valor }), [valor]);
  const customization = useMemo(
    () => ({
      visual: VISUAL_POR_TEMA[tema],
      paymentMethods: {
        creditCard: 'all' as const,
        bankTransfer: 'all' as const,
        // Só à vista (decisão do dono, 28/09/2026). A doc: "o número de parcelas será
        // restringido pelos valores passados". O servidor recusa mais de 1 de qualquer jeito.
        minInstallments: 1,
        maxInstallments: 1,
      },
    }),
    [tema],
  );

  // A moldura é a caixa interna que a própria etapa já usa (o resumo da consulta), não um
  // card novo: o Brick já mora dentro de um `<Card>` em `agendamento-pagamento-step.tsx`.
  return (
    <div className="border-border/60 overflow-hidden rounded-xl border">
      <Payment
        initialization={initialization}
        customization={customization}
        locale="pt-BR"
        onSubmit={onSubmit}
        onError={onError}
      />
    </div>
  );
}

/** `memo`: o cronômetro da etapa re-renderiza a cada segundo, e o Brick não precisa ouvir. */
export default memo(PagamentoBrick);
