/**
 * GUARDA — o CSP conhece os hosts que o Payment Brick do Mercado Pago realmente usa.
 *
 * O CSP é `Report-Only` e não bloqueia hoje. Mas um CSP em Report-Only existe para um dia ser
 * promovido (o mesmo argumento de `o-csp-conhece-o-captcha-do-clerk`), e nesse dia o pagamento
 * pararia sem ninguém ter tocado no pagamento. Enquanto não é promovido, cada host ausente é uma
 * linha de ruído no console a cada carga do Brick — e foi esse ruído (~1470 linhas) que escondeu
 * o defeito real de 28/09/2026: o Brick sendo recriado a cada segundo.
 *
 * 🔴 A LISTA FOI MEDIDA, NÃO DEDUZIDA. Em 28/09/2026, com o Brick real montado no Chrome headless
 * (chave de TESTE), servido com o header de produção, capturando `securitypolicyviolation` em
 * três momentos: carregado, com "Cartão de crédito" aberto (os campos do cartão são iframes de
 * `secure-fields`, que só aparecem aí) e com "Pix" aberto. A doc oficial não publica essa lista.
 *
 * ⚠️ E SEM CURINGA. `*.mercadopago.com` abriria muito mais do que o Brick pede; o host exato é o
 * que foi medido. Se o SDK passar a usar outro host, a medição se refaz — não se alarga o curinga.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const RAIZ = join(__dirname, '..', '..');

function semComentarios(fonte: string): string {
  return fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CONFIG = semComentarios(readFileSync(join(RAIZ, 'next.config.ts'), 'utf8'));

/** Os hosts da diretiva, como TOKENS — `includes` numa string casaria prefixo de outro host. */
function hostsDa(nome: string): string[] {
  const m = CONFIG.match(new RegExp(`(["'\`])${nome}\\s([\\s\\S]*?)\\1`));
  return m ? m[2].split(/\s+/).filter(Boolean) : [];
}

const MEDIDO: Record<string, string[]> = {
  'script-src': ['https://sdk.mercadopago.com', 'https://http2.mlstatic.com'],
  'connect-src': [
    'https://api.mercadopago.com',
    'https://api.mercadolibre.com',
    'https://http2.mlstatic.com',
    'https://www.mercadolibre.com',
    'https://secure-fields.mercadopago.com',
  ],
  'frame-src': ['https://secure-fields.mercadopago.com'],
  'img-src': ['https://www.mercadolibre.com', 'https://www.mercadolivre.com'],
};

describe('o CSP conhece o Payment Brick', () => {
  it('⚠️ VACUIDADE: as quatro diretivas existem e o extrator devolve hosts', () => {
    for (const d of Object.keys(MEDIDO)) {
      expect(hostsDa(d).length, `diretiva ${d} não encontrada`).toBeGreaterThan(2);
    }
  });

  it('⚠️ VACUIDADE: o extrator separa por token — prefixo não conta como host', () => {
    expect('https://secure-fields.mercadopago.com.evil'.split(/\s+/)).not.toContain(
      'https://secure-fields.mercadopago.com',
    );
  });

  it.each(Object.entries(MEDIDO).flatMap(([d, hosts]) => hosts.map((h) => [d, h] as const)))(
    '🔴 `%s` permite %s',
    (diretiva, host) => {
      expect(hostsDa(diretiva)).toContain(host);
    },
  );

  it('🔴 sem curinga para os domínios do Mercado Pago / Mercado Livre', () => {
    for (const d of ['script-src', 'connect-src', 'frame-src', 'img-src', 'default-src']) {
      const curingas = hostsDa(d).filter((h) =>
        /\*\.(mercadopago|mercadolibre|mercadolivre|mlstatic)\./.test(h),
      );
      expect(curingas, d).toEqual([]);
    }
  });

  it('e o Turnstile do Clerk continua lá — acrescentar não pode tirar', () => {
    for (const d of ['script-src', 'frame-src', 'connect-src']) {
      expect(hostsDa(d)).toContain('https://challenges.cloudflare.com');
    }
  });
});
