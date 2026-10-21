import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * O runner da INTEGRAÇÃO — separado do portão, de propósito.
 *
 * 🔴 Estes testes executam o fluxo real contra um Postgres de verdade. São o Nível 4 da regra
 * "Deploy CUSTA" do `CLAUDE.md`, e os únicos deste repositório que provam que o caminho RODA em
 * vez de provar que está escrito certo.
 *
 * ⚠️ Config próprio porque o `vitest.config.mts` os EXCLUI: eles exigem banco, e um portão que
 * falha em máquina sem Docker é um portão que alguém desliga.
 *
 * Como rodar:
 *
 *   docker start behemp-pg || docker run -d --name behemp-pg \
 *     -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
 *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
 *     npx vitest run --config vitest.integracao.mts
 *
 * ⚠️ `drizzle-kit push` e não `db:migrate`: as migrations **não rodam do zero** neste
 * repositório — quebram numa antiga (`consultas.status`). Achado catalogado em 13/09/2026.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/integracao/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**'],
    reporters: ['default'],
    // Um banco só: casos em paralelo apagariam o estado uns dos outros no `beforeEach`.
    fileParallelism: false,
  },
});
