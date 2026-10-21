import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '@/db/schema';

/**
 * O cliente que SABE fazer transação — e por que ele precisa existir.
 *
 * 🔴 A CAUSA RAIZ DO FLUXO 1 · PORTÃO 1, medida em 13/09/2026.
 *
 * `lib/db/index.ts` resolve para `drizzle-orm/neon-http` em produção, e o neon-http **não
 * implementa transação**. Não é limitação sutil: o método inteiro é um `throw`.
 *
 *     // drizzle-orm/neon-http/session.js:152
 *     async transaction(_transaction, _config = {}) {
 *       throw new Error('No transactions support in neon-http driver');
 *     }
 *
 * A doc do Neon diz o mesmo, e aponta a saída: _"transactions are not supported in the neon-http
 * driver"_ · _"If you need session or interactive transaction support … use the WebSocket-based
 * neon-serverless driver"_, cujo `Pool`/`Client` é **drop-in do `pg`**.
 *
 * ⚠️ E o estrago passou semanas invisível por uma razão precisa: é um `new Error(…)`, então
 * `erro.name` é `'Error'` — e era `erro.name` que o `catch` registrava. Cinco falhas idênticas em
 * produção diziam apenas `{ erro: 'Error' }`, e **zero dos 35 handoffs da Greens jamais concluiu
 * o cadastro**. Nunca houve estado sujo para investigar: a transação não chegava a começar.
 *
 * 🔴 POR QUE `pg` E NÃO `neon-serverless`
 *
 * Os dois suportam transação. O `neon-serverless` fala WebSocket e exige o pacote `ws` no Node —
 * dependência nova, em produção, num caminho de dado clínico, na véspera de um prazo. O `pg` já
 * é `dependencies` (`^8.23.0`), já sobrevive ao `pnpm install --prod` do deploy, e **já rodou
 * contra este banco**: todos os diagnósticos desta sessão na VPS usaram `require('pg')`.
 *
 * ⚠️ E aqui o TCP não é concessão, é a escolha melhor: o neon-http existe para ambiente
 * serverless, onde não dá para manter conexão entre requisições. Produção é **EC2 com PM2**, um
 * processo longo — um pool TCP vive entre requisições e evita o handshake que o HTTP repete.
 *
 * O que fica de fora, de propósito: `lib/db/index.ts` não muda. Toda query que não precisa de
 * transação continua pelo caminho que sempre usou. O raio desta mudança é um ponto de chamada.
 */

/**
 * Pool único por processo.
 *
 * ⚠️ Em desenvolvimento o Next recarrega o módulo a cada edição, e um pool novo por recarga
 * esgota as conexões do Neon em minutos. O `globalThis` é o padrão para isso e não tem efeito em
 * produção, onde o módulo carrega uma vez.
 */
const chave = Symbol.for('behemp.pool.transacional');
type Global = typeof globalThis & { [chave]?: Pool };

function pool(): Pool {
  const g = globalThis as Global;
  if (!g[chave]) {
    g[chave] = new Pool({
      connectionString: process.env.DATABASE_URL,
      /**
       * Pequeno de propósito. Só um ponto do produto usa transação, e o Neon cobra conexão
       * ociosa. Se outro ponto passar a precisar, este número se mede — não se chuta.
       */
      max: 3,
      idleTimeoutMillis: 30_000,
      /**
       * 🔴 Sem isto, uma transação travada segura o processo até o timeout do SO. O cadastro do
       * paciente é síncrono na tela: 15 s já é mais do que qualquer pessoa espera.
       */
      connectionTimeoutMillis: 15_000,
    });
  }
  return g[chave]!;
}

/**
 * O cliente transacional. Use SÓ para `transaction(...)`; o resto vai por `db`.
 *
 * É função, não constante, para que o pool nasça na primeira transação e não no import — assim
 * um processo que nunca conclui cadastro não abre conexão TCP nenhuma.
 */
export function dbTransacional() {
  return drizzle({ client: pool(), schema });
}
