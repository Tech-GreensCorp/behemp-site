import { Inngest } from 'inngest';

/**
 * Cliente Inngest — gerenciador de jobs agendados e filas.
 *
 * Configuração necessária: INNGEST_EVENT_KEY no .env
 * Em dev, roda com Inngest Dev Server (npx inngest-cli@latest dev)
 */
export const inngest = new Inngest({
  id: 'be4hope',
  eventKey: process.env.INNGEST_EVENT_KEY,
});
