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
    exclude: ['node_modules/**', '.next/**'],
    reporters: ['default'],
  },
});
