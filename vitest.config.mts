import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * Runner de teste do projeto — instalado na Sprint 0 (20/08/2026).
 *
 * `environment: 'node'` de propósito: os guardas deste repositório são ESTRUTURAIS —
 * conferem hooks, contratos, imports e convenções sobre arquivos. Nenhum dos 10 guardas
 * previstos nas ADR-0002 e ADR-0003 renderiza componente, então jsdom não entra até que
 * exista guarda que precise dele. Dependência instalada sem consumidor é peso morto.
 */
export default defineConfig({
  // O alias `@/*` do tsconfig não é lido pelo Vitest automaticamente. Sem isto, um guarda que
  // importe código do produto falha com "Cannot find package '@/…'" — e o resumo `Tests N
  // passed` continua verde, porque o arquivo nem chega a rodar. Foi o que aconteceu em
  // 20/08/2026 com o guarda do contrato da IA: a linha que denuncia é `Test Files 1 failed`.
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    /**
     * 🔴 A INTEGRAÇÃO FICA FORA DO `pnpm test`, e de propósito.
     *
     * `__tests__/integracao/` executa o fluxo real contra um Postgres de verdade — é o Nível 4
     * da regra "Deploy CUSTA" do `CLAUDE.md`, e o único teste deste repositório que prova que o
     * caminho RODA, em vez de provar que está escrito certo.
     *
     * ⚠️ Mas ele exige banco. Deixá-lo aqui faria o portão quebrar em toda máquina sem Docker —
     * e portão que falha por ambiente é portão que alguém desliga.
     *
     * Rodar com:
     *   docker start behemp-pg
     *   DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx vitest run __tests__/integracao/
     */
    exclude: ['node_modules/**', '.next/**', '__tests__/integracao/**'],
    reporters: ['default'],
  },
});
