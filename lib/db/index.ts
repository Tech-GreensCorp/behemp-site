import { neon } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';

import * as schema from '@/db/schema';
import { ehNeon } from '@/lib/db/driver';

/**
 * Conexão com o banco — dois drivers, escolhidos pela URL.
 *
 * POR QUE ISTO EXISTE
 * Produção é **Neon**, e o driver `@neondatabase/serverless` fala **HTTP**, não TCP. Isso é o
 * certo para serverless, e é o que estava aqui desde sempre. Mas significa que o projeto **não
 * conseguia rodar contra um Postgres comum** — nem em desenvolvimento, nem em teste.
 *
 * Em 20/08/2026 o dono autorizou aplicar as migrations *"contanto que esteja em localhost, não
 * esteja na main ou não suba para neon"*. Sem um caminho TCP, a única forma de ver a aplicação
 * de pé seria apontar para o Neon — exatamente o que a condição proíbe.
 *
 * 🔴 O QUE DECIDE O DRIVER É A URL, NÃO UMA FLAG
 * URL de Neon → driver HTTP, **idêntico ao que produção sempre usou**. Qualquer outra URL →
 * driver TCP. Uma variável de ambiente separada (`USE_LOCAL_DB`) poderia ficar ligada por
 * engano em produção; a URL, não: se aponta para o Neon, o caminho é o de produção, e ponto.
 *
 * A função que decide mora em `lib/db/driver.ts`, **pura** — este módulo tem efeito colateral
 * (lê env, abre conexão) e por isso não pode ser importado por um teste. O guarda
 * `banco-usa-driver-certo` prova que URL de Neon resolve para o driver HTTP.
 */

const url = process.env.DATABASE_URL!;

/**
 * ⚠️ O tipo exportado é o do **neon-http**, que é o de produção. O ramo TCP é convertido para
 * ele de propósito: assim nenhum arquivo do projeto muda de tipo por causa do ambiente, e o
 * que o type-check valida é sempre o caminho que roda em produção.
 */
export const db = (
  ehNeon(url)
    ? drizzleNeon({ client: neon(url), schema })
    : (drizzlePg({ connection: url, schema }) as unknown as ReturnType<
        typeof drizzleNeon<typeof schema>
      >)
) as ReturnType<typeof drizzleNeon<typeof schema>>;
