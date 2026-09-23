/**
 * O FLUXO OAUTH COM O MERCADO PAGO — montar a URL e trocar o código por tokens.
 *
 * Tudo aqui saiu da documentação oficial, conferida em 22/09/2026. O que era suposição
 * antes de ler, e que a doc corrigiu:
 *
 *   · `platform_id=mp` é OBRIGATÓRIO na URL de autorização — não é opcional nem inferido
 *   · a resposta traz `user_id` como NÚMERO, e a coluna é `text`
 *   · `expires_in` vem em SEGUNDOS (15552000 = 180 dias), e é o valor que vale, não um
 *     prazo fixo chutado no código
 *   · o `code` da autorização vale 10 minutos
 *
 * Fontes:
 *   https://www.mercadopago.com.br/developers/en/docs/split-payments/additional-content/security/oauth/creation
 *   https://www.mercadopago.com.br/developers/en/reference/authentication/oauth/_oauth_token/post
 *
 * 🛑 Módulo sem `db` e sem `auth`. Faz rede (a troca do código), e é o único aqui que faz.
 */

import { gerarState } from './state';

/** A URL para onde o médico é mandado para autorizar. Doc oficial, não inventada. */
const URL_DE_AUTORIZACAO = 'https://auth.mercadopago.com/authorization';

/** O endpoint que troca `code` por token. */
const URL_DO_TOKEN = 'https://api.mercadopago.com/oauth/token';

/**
 * ⚠️ O `redirect_uri` PRECISA ESTAR CADASTRADO no painel do Mercado Pago, idêntico a este
 * valor. A doc chama de _"static URL"_, e o MP recusa qualquer outra — a falha acontece na
 * primeira tela, antes de qualquer código nosso rodar.
 *
 * Sai de `NEXT_PUBLIC_APP_URL` para não divergir entre ambientes por descuido.
 */
export function urlDeRetorno(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
  return `${base}/api/medico/mercadopago/callback`;
}

export class MercadoPagoNaoConfigurado extends Error {
  constructor(quais: string) {
    super(
      `Mercado Pago não configurado: ${quais}. Nenhuma chamada foi feita; ` +
        'ver lib/mercadopago/oauth.ts e a lista `gravar` do .github/workflows/deploy.yml',
    );
    this.name = 'MercadoPagoNaoConfigurado';
  }
}

export class FalhaNaTrocaDeCodigo extends Error {
  /** O status HTTP do Mercado Pago, para o log. Nunca vai para a tela. */
  readonly status: number;
  constructor(status: number, detalhe: string) {
    super(`Mercado Pago recusou a troca do código (HTTP ${status}): ${detalhe}`);
    this.name = 'FalhaNaTrocaDeCodigo';
    this.status = status;
  }
}

/** `true` quando as duas credenciais da aplicação existem. Não lança. */
export function oauthConfigurado(): boolean {
  return Boolean(
    process.env.MERCADOPAGO_CLIENT_ID?.trim() && process.env.MERCADOPAGO_CLIENT_SECRET?.trim(),
  );
}

/**
 * Monta a URL de autorização para um médico.
 *
 * O `state` vai ASSINADO (`lib/mercadopago/state.ts`) e é conferido na volta contra a
 * sessão — as duas coisas juntas fecham o CSRF de OAuth.
 */
export function gerarUrlAutorizacao(medicoId: string): string {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID?.trim();
  if (!clientId) throw new MercadoPagoNaoConfigurado('MERCADOPAGO_CLIENT_ID ausente');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    // 🔴 Obrigatório segundo a doc oficial. Sem ele o Mercado Pago recusa a autorização.
    platform_id: 'mp',
    state: gerarState(medicoId),
    redirect_uri: urlDeRetorno(),
  });

  return `${URL_DE_AUTORIZACAO}?${params.toString()}`;
}

export interface TokensDoMercadoPago {
  accessToken: string;
  refreshToken: string;
  /** `user_id` da resposta, que vem como NÚMERO e aqui já é string. */
  mpUserId: string;
  /** Calculado de `expires_in` (segundos) + o instante da troca. Nunca um prazo fixo. */
  expiraEm: Date;
  /** `live_mode` da resposta — diz se a conta autorizada é real ou de teste. */
  modoReal: boolean;
}

/**
 * Troca o `code` da autorização pelos tokens.
 *
 * ⚠️ O `code` vale 10 MINUTOS (doc oficial). Um callback que demore mais que isso — por
 * exemplo esperando algo lento antes de chamar aqui — falha com o código expirado, e a
 * mensagem do Mercado Pago não deixa isso óbvio.
 *
 * ⚠️ O `redirect_uri` vai no corpo E precisa ser IDÊNTICO ao usado na autorização. É
 * exigência do OAuth 2.0 (RFC 6749 §4.1.3) e do Mercado Pago; por isso os dois saem da
 * mesma função `urlDeRetorno()`, e não de duas constantes que alguém pode dessincronizar.
 */
export async function trocarCodigoPorTokens(code: string): Promise<TokensDoMercadoPago> {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new MercadoPagoNaoConfigurado(
      [!clientId && 'MERCADOPAGO_CLIENT_ID', !clientSecret && 'MERCADOPAGO_CLIENT_SECRET']
        .filter(Boolean)
        .join(' e '),
    );
  }
  if (!code?.trim()) throw new FalhaNaTrocaDeCodigo(0, 'code vazio');

  const trocadoEm = Date.now();

  const resposta = await fetch(URL_DO_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: urlDeRetorno(),
      grant_type: 'authorization_code',
    }),
    // O código expira em 10 min; esperar indefinidamente só transforma falha em pendura.
    signal: AbortSignal.timeout(20_000),
  });

  if (!resposta.ok) {
    // O corpo pode trazer `message`/`error`. Vai para o LOG, nunca para a tela do médico.
    const corpo = await resposta.text().catch(() => '');
    throw new FalhaNaTrocaDeCodigo(resposta.status, corpo.slice(0, 300));
  }

  const dados = (await resposta.json()) as {
    access_token?: string;
    refresh_token?: string;
    user_id?: number | string;
    expires_in?: number;
    live_mode?: boolean;
  };

  // 🔴 Conferir o que CHEGOU, não confiar no que a doc promete. Um campo ausente aqui
  // gravaria `undefined` cifrado — e o defeito só apareceria na primeira cobrança.
  const faltando = [
    !dados.access_token && 'access_token',
    !dados.refresh_token && 'refresh_token',
    dados.user_id === undefined && 'user_id',
  ].filter(Boolean);
  if (faltando.length > 0) {
    throw new FalhaNaTrocaDeCodigo(resposta.status, `resposta sem ${faltando.join(', ')}`);
  }

  // `expires_in` vem em SEGUNDOS. Sem ele, cai em 180 dias — o padrão que a doc declara —
  // mas o valor da resposta sempre vence.
  const segundos = Number.isFinite(dados.expires_in) ? Number(dados.expires_in) : 15_552_000;

  return {
    accessToken: dados.access_token as string,
    refreshToken: dados.refresh_token as string,
    // A doc devolve NÚMERO; a coluna é `text`. A conversão é explícita de propósito.
    mpUserId: String(dados.user_id),
    expiraEm: new Date(trocadoEm + segundos * 1000),
    modoReal: dados.live_mode === true,
  };
}
