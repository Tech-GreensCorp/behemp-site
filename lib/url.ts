/**
 * URL ABSOLUTA DO SITE — para todo redirect ou link montado no servidor.
 *
 * 🔴 NUNCA `new URL(caminho, request.url)`. Em produção o Next roda standalone atrás do
 * Nginx, com `HOSTNAME=0.0.0.0` e `PORT=3000`, e o `request.url` que a rota recebe carrega
 * esse endereço INTERNO, não o domínio público. Medido em 23/09/2026: a volta do OAuth do
 * Mercado Pago mandou o médico para `https://0.0.0.0:3000/medico/pagamentos/config`. O
 * guarda `o-redirect-usa-o-dominio-publico` impede a volta do padrão.
 *
 * ⚠️ LÊ `process.env.NEXT_PUBLIC_APP_URL` LITERAL, de propósito. O `next build` substitui a
 * expressão pelo valor do build (`deploy.yml`: `https://be4hope.org`). O `env` de
 * `lib/env.ts` NÃO serve aqui: ele lê o ambiente do processo em runtime, e o PM2 carrega um
 * `NEXT_PUBLIC_APP_URL` herdado do primeiro `pm2 start` manual, com valor que ninguém
 * conferiu. É a mesma fonte do `redirect_uri` em `lib/mercadopago/oauth.ts`.
 *
 * 🛑 Módulo PURO — sem `db`, sem `auth`, sem `next/*`.
 */

/** Só vale fora do build de produção: `pnpm dev` sem `.env`. */
const RESERVA_LOCAL = 'http://localhost:3000';

/**
 * Monta a URL pública para um caminho do próprio site.
 *
 * Aceita só caminho que começa com UMA barra. `//outro.site/x` é URL relativa a protocolo e
 * `new URL` a resolveria para outro domínio — um redirect aberto por descuido de quem chama.
 */
export function urlAbsoluta(caminho: string): URL {
  if (!caminho.startsWith('/') || caminho.startsWith('//')) {
    throw new Error(
      `urlAbsoluta: esperado caminho do site começando com "/", recebido "${caminho}"`,
    );
  }
  const base = (process.env.NEXT_PUBLIC_APP_URL || RESERVA_LOCAL).replace(/\/+$/, '');
  return new URL(caminho, `${base}/`);
}
