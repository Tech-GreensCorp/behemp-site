import { serve } from 'inngest/next';
import {
  inngest,
  verificarValidadeDocumentos,
  verificarRecompraMedicamentos,
  enviarEmailRecompraAgendado,
  digestDiarioAdmin,
} from '@/lib/integrations/inngest';

/**
 * Endpoint do Inngest — registra todas as functions do sistema.
 * O Inngest Dev Server ou o painel Inngest Cloud se conectam a este endpoint.
 *
 * Em dev: npx inngest-cli@latest dev
 * Em prod: configurar URL no painel Inngest
 */
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    verificarValidadeDocumentos,
    verificarRecompraMedicamentos,
    enviarEmailRecompraAgendado,
    digestDiarioAdmin,
  ],
});
