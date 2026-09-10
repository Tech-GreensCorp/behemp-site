import { z } from 'zod';

/**
 * Validação de variáveis de ambiente com Zod.
 * Se alguma variável obrigatória estiver faltando, o build falha imediatamente.
 *
 * Variáveis com .optional() são de integrações que podem não estar configuradas.
 */

const envSchema = z.object({
  // ── Aplicação ────────────────────────────────────────────────
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // ── Banco de Dados (Neon PostgreSQL) ─────────────────────────
  DATABASE_URL: z.string().url('DATABASE_URL é obrigatória'),

  // ── ChatPro — o paciente que chega pelo WhatsApp (09/09/2026) ────────────────
  /**
   * Segredo do cabeçalho `x-chatpro-intake-secret`, usado por `/bot-link` e `/intake`.
   * Sem ele as duas rotas ficam FECHADAS: endpoint que cria cadastro de paciente nunca
   * deve abrir por falta de configuração.
   */
  CHATPRO_INTAKE_SECRET: z.string().optional(),
  /** Segredo que vai no caminho da URL do webhook. 32+ bytes aleatórios em hexadecimal. */
  CHATPRO_WEBHOOK_PATH_TOKEN: z.string().optional(),
  /** 🔴 Dá acesso a TODAS as conversas da instância. Só `lib/chatpro/cliente.ts` o lê. */
  CHATPRO_INSTANCE_TOKEN: z.string().optional(),
  CHATPRO_INSTANCE_ID: z.string().optional(),
  CHATPRO_CHAT_API_URL: z.string().url().default('https://sparks.chatpro.com.br'),
  /** Validade do link em horas. 168 = 7 dias. */
  CHATPRO_LINK_TTL_HORAS: z.coerce.number().int().positive().default(168),
  /** Caminho do formulário de cadastro. Fica em variável porque a rota ainda está sendo definida. */
  CHATPRO_CADASTRO_PATH: z.string().default('/cadastro'),
  /** Confirmar o contato na API do ChatPro também no `/intake` (no `/bot-link` é sempre). */
  CHATPRO_CONFIRMAR_NO_INTAKE: z.string().optional(),
  /**
   * Permite que `/start` crie solicitação sem confirmar o contato — **só** quando a URL traz
   * o identificador, que é um UUID e portanto não adivinhável. Telefone sozinho nunca basta.
   */
  CHATPRO_START_SEM_CONFIRMACAO: z.string().optional(),

  // ── Parceiros (ADR-0016) ───────────────────────────────────────────────────
  /** Segredo do HMAC das chamadas que a Greens faz PARA CÁ (handoff de cadastro). */
  PARCEIRO_GREENS_SEGREDO_ENTRADA: z.string().optional(),
  /**
   * Segredo do HMAC das chamadas que NÓS fazemos PARA A GREENS (retorno de receita/ANVISA).
   *
   * ⚠️ DIFERENTE do de entrada, de propósito: um por direção. Vazar um não compromete o
   * outro, e rotacionar um não exige parar as duas pontas ao mesmo tempo.
   */
  PARCEIRO_GREENS_SEGREDO_SAIDA: z.string().optional(),
  /** Base da API da Greens, para o retorno. */
  PARCEIRO_GREENS_API_URL: z.string().url().optional(),

  // ── Autenticação (Clerk) ──────────────────────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/entrar'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/registrar-se'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/'),

  // ── E-mail Transacional (Brevo) ──────────────────────────────
  BREVO_API_KEY: z.string().optional(),
  BREVO_FROM_EMAIL: z.string().email().optional(),
  BREVO_FROM_NAME: z.string().default('Be4Hope'),
  BREVO_TO_EMAIL: z.string().email().optional(),
  RECOMPRA_EMAIL_DESTINO: z.string().email().optional(),

  // ── Google Calendar + Meet (OAuth2) ──────────────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // ── Google Sheets (Triagens) ─────────────────────────────────
  GOOGLE_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SHEETS_SHEET_NAME: z.string().default('Página1'),
  NEXT_PUBLIC_SHEETS_SPREADSHEET_ID: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),

  // ── Retransmissão de mídia da teleconsulta (Cloudflare Realtime TURN) ──
  // Escolhido pelo dono em 20/08/2026 (Item 8 do 04-LISTA-DE-AFAZERES). Opcionais de
  // propósito: sem elas, a videochamada usa só STUN e o cliente avisa que não há
  // retransmissão — em vez de cair no relay público de terceiro que havia antes.
  CLOUDFLARE_TURN_KEY_ID: z.string().optional(),
  CLOUDFLARE_TURN_API_TOKEN: z.string().optional(),

  // ── Chat em Tempo Real (Pusher) ───────────────────────────────
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),

  // ── Upload de Arquivos (Vercel Blob) ─────────────────────────
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  BLOB_BEHEMP_READ_WRITE_TOKEN: z.string().optional(),

  // ── Jobs Agendados (Inngest) ──────────────────────────────────
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // ── Cron Jobs (Vercel) ────────────────────────────────────────
  CRON_SECRET: z.string().optional(),

  // ── DocuSign (Assinatura Digital — Procuração Específica) ─────
  // Sandbox: demo.docusign.net | Produção: na4.docusign.net
  DOCUSIGN_INTEGRATION_KEY: z.string().optional(),
  DOCUSIGN_CLIENT_SECRET: z.string().optional(),
  DOCUSIGN_ACCOUNT_ID: z.string().optional(),
  DOCUSIGN_USER_ID: z.string().optional(),
  DOCUSIGN_BASE_URL: z.string().default('https://demo.docusign.net/restapi'),
  DOCUSIGN_OAUTH_BASE_URL: z.string().default('https://account-d.docusign.com'),
  DOCUSIGN_SIGNER_EMAIL_BE4HOPE: z.string().email().default('contato@be4hope.org'),
  DOCUSIGN_SIGNER_NAME_BE4HOPE: z.string().default('Associação Be4Hope'),
  DOCUSIGN_PRIVATE_KEY: z.string().optional(),

  // ── WhatsApp (contato Be4Hope) ────────────────────────────────
  NEXT_PUBLIC_WHATSAPP_BEHEMP: z.string().default('5511932047360'),

  // ── Gemini 2.5 Flash (Transcrição de Teleconsultas) ─────────
  GOOGLE_API_KEY: z.string().optional(),
  GEMINI_NORMALIZE_MODEL: z.string().default('gemini-2.5-flash'),
});

/**
 * Exporta as variáveis de ambiente validadas.
 * Usar `env.DATABASE_URL` ao invés de `process.env.DATABASE_URL` garante type safety.
 */
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
