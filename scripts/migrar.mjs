#!/usr/bin/env node
/**
 * APLICA AS MIGRATIONS EM PRODUÇÃO.
 *
 * O que faz ..... roda as migrations pendentes de `db/migrations`, na ordem do journal.
 * Como se desfaz  não se desfaz — migration aplicada é irreversível por desenho. Cada uma
 *                 é conferida como aditiva ANTES de entrar (`.claude/autorizacoes.txt`).
 * Idempotente ... sim. O Drizzle mantém a tabela `__drizzle_migrations` e pula o que já
 *                 rodou. Rodar duas vezes seguidas não faz nada na segunda.
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🔴 POR QUE ESTE ARQUIVO EXISTE, E POR QUE É `.mjs`
 *
 * O deploy rodava `pnpm db:migrate`, que chama o CLI `drizzle-kit`. No servidor o passo
 * anterior é `pnpm install --prod` — e o log confirma: `devDependencies: skipped`. O
 * `drizzle-kit` é devDependency, então:
 *
 *     err: sh: 1: drizzle-kit: not found
 *     ELIFECYCLE Command failed
 *
 * As migrations NUNCA rodaram por esse caminho. E como o script do deploy não tinha
 * `set -e`, ele seguiu para o `pm2 restart` e o passo foi marcado ✓ — deploy verde, banco
 * desatualizado.
 *
 * A correção é a recomendada pela própria documentação do Drizzle: usar o **migrator do
 * `drizzle-orm`**, que é dependência de PRODUÇÃO e precisa apenas dos arquivos `.sql`
 * gerados e de uma conexão. O CLI é ferramenta de desenvolvimento; o migrator é de runtime.
 *
 * ⚠️ É `.mjs`, e não `.ts`, porque `tsx` também é devDependency. Um script de migração que
 * depende de transpilação tem o mesmo problema que veio consertar.
 *
 * ⚠️ E usa o driver TCP (`pg`), não o HTTP do Neon: migration precisa de transação, e o
 * driver HTTP não as suporta. A URL do Neon funciona nos dois — o que muda é o transporte.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;

if (!url) {
  // Falha FECHADA: sem URL, sair com erro para o deploy parar. O contrário — seguir e
  // reiniciar o app — é o que produziu banco desatualizado com deploy verde.
  console.error(
    '[migrar] DATABASE_URL ausente — nada foi aplicado.\n' +
      '         Este script lê process.env, e um arquivo .env NÃO é carregado sozinho.\n' +
      '         No deploy, o shell precisa fazer: set -a; . .next/standalone/.env; set +a',
  );
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url,
  // O Neon exige TLS. `rejectUnauthorized: false` é o que o driver do Neon usa por padrão;
  // aqui é explícito para o certificado da AWS não derrubar a conexão.
  ssl:
    url.includes('localhost') || url.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  max: 1,
});

try {
  const db = drizzle(pool);
  console.log('[migrar] aplicando migrations pendentes…');
  await migrate(db, { migrationsFolder: 'db/migrations' });
  console.log('[migrar] ✓ concluído');
  process.exit(0);
} catch (erro) {
  console.error('[migrar] ✗ FALHOU:', erro instanceof Error ? erro.message : erro);
  // Sair com erro é o ponto: o deploy precisa parar aqui, e não reiniciar o app contra um
  // banco que não tem as tabelas que o código novo espera.
  process.exit(1);
} finally {
  await pool.end().catch(() => {});
}
