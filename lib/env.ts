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

  // ── Autenticação (Clerk) ──────────────────────────────────────
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
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

  // ── WhatsApp (contato Be4Hope) ────────────────────────────────
  NEXT_PUBLIC_WHATSAPP_BEHEMP: z.string().default('5511932047360'),
});

/**
 * Exporta as variáveis de ambiente validadas.
 * Usar `env.DATABASE_URL` ao invés de `process.env.DATABASE_URL` garante type safety.
 */
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
