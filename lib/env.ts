import { z } from 'zod';

/**
 * Validação de variáveis de ambiente com Zod.
 * Se alguma variável obrigatória estiver faltando, o build falha imediatamente.
 *
 * Variáveis com .optional() são de integrações que o usuário pode não ter configurado ainda.
 */

const envSchema = z.object({
  // Aplicação
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Banco de Dados
  DATABASE_URL: z.string().url('DATABASE_URL é obrigatória'),

  // Clerk (autenticação)
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().optional(),
  CLERK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default('/'),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default('/'),

  // Google Calendar + Meet
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),

  // Resend (e-mails)
  RESEND_API_KEY: z.string().optional(),

  // Pusher (chat em tempo real)
  NEXT_PUBLIC_PUSHER_KEY: z.string().optional(),
  NEXT_PUBLIC_PUSHER_CLUSTER: z.string().optional(),
  PUSHER_APP_ID: z.string().optional(),
  PUSHER_KEY: z.string().optional(),
  PUSHER_SECRET: z.string().optional(),
  PUSHER_CLUSTER: z.string().optional(),

  // Inngest (jobs agendados)
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),

  // Vercel Blob (upload)
  BLOB_READ_WRITE_TOKEN: z.string().optional(),

  // E-mail de destino para recompra
  RECOMPRA_EMAIL_DESTINO: z.string().email().optional(),
});

/**
 * Exporta as variáveis de ambiente validadas.
 * Usar `env.DATABASE_URL` ao invés de `process.env.DATABASE_URL` garante type safety.
 */
export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
