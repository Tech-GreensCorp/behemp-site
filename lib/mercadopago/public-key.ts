import { env } from '@/lib/env';

/**
 * A public key do Payment Brick — da conta do INTEGRADOR, escolhida por `MERCADOPAGO_AMBIENTE`.
 *
 * Da conta do integrador, e não do médico: a doc do Split 1:1 manda _"utilize a `public_key` da
 * sua conta de integrador no frontend"_ e _"insira o `access_token` do vendedor … no backend"_
 * (developers/pt/docs/split-payments/split-1-1/integration-configuration/integrate-marketplace,
 * conferida em 28/09/2026). Quem decide quem recebe é o access token do médico, no servidor.
 *
 * Lida em runtime e entregue por prop, sem `NEXT_PUBLIC_` (`lib/env.ts`, comentário das public
 * keys): trocar de conta não exige rebuild. `null` quando não configurada — a tela diz que o
 * pagamento está indisponível em vez de montar um Brick que falharia.
 */
export function publicKeyDoBrick(): string | null {
  const chave =
    env.MERCADOPAGO_AMBIENTE === 'producao'
      ? env.MERCADOPAGO_PUBLIC_KEY_PRODUCAO
      : env.MERCADOPAGO_PUBLIC_KEY_TESTE;
  return chave?.trim() || null;
}
