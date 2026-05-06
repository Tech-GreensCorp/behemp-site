# Documentação de Integrações — Be4Hope

## 1. Clerk (Autenticação)

- **Lib:** `@clerk/nextjs`
- **Status:** ⏳ Pendente configuração de chaves
- **Variáveis necessárias:**
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
- **Webhook de produção:** `https://be4hope.org/api/webhooks/clerk`
- **Roles configurados:** `admin`, `medico`, `paciente`
- **Arquivo de permissões:** `lib/auth/permissions.ts`

---

## 2. Resend (E-mail)

- **Lib:** `resend`
- **Status:** ⏳ Pendente configuração de chaves
- **Variável:** `RESEND_API_KEY`
- **Templates implementados:**
  - Confirmação de consulta agendada
  - Renovação de documento vencendo
  - Lembrete de recompra de medicamento
- **Arquivo:** `lib/integrations/resend/client.ts`

---

## 3. Google Calendar + Meet

- **Lib:** `googleapis`
- **Status:** ⏳ Pendente OAuth completo
- **Variáveis:**
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
- **Callback:** `https://be4hope.org/api/webhooks/google/callback`
- **Funcionalidades:**
  - Criação de evento no Calendar do médico
  - Geração automática de link Google Meet
  - Inserção de participantes (paciente)
- **Arquivo:** `lib/integrations/google-calendar/client.ts`

---

## 4. Pusher (Chat em Tempo Real)

- **Lib:** `pusher`, `pusher-js`
- **Status:** ⏳ Pendente configuração de chaves
- **Variáveis:**
  - `PUSHER_APP_ID`
  - `PUSHER_APP_SECRET`
  - `NEXT_PUBLIC_PUSHER_APP_KEY`
  - `NEXT_PUBLIC_PUSHER_CLUSTER`
- **Endpoint de auth:** `/api/pusher/auth`
- **Canais:** Privados por grupo de chat (`private-chat-{grupoId}`)
- **Arquivos:**
  - Server: `lib/integrations/pusher/server.ts`
  - Client: `lib/integrations/pusher/client.ts`

---

## 5. Inngest (Background Jobs)

- **Lib:** `inngest`
- **Status:** ⏳ Pendente configuração de chaves
- **Variáveis:**
  - `INNGEST_EVENT_KEY`
  - `INNGEST_SIGNING_KEY`
- **Endpoint:** `/api/inngest`
- **Webhook de produção:** `https://be4hope.org/api/inngest`
- **Jobs configurados:**
  - `verificar-validade-documentos` (cron diário 9h UTC)
  - `verificar-recompra-medicamentos` (cron diário 9h UTC)
  - `enviar-email-recompra-agendado` (triggered)
- **Arquivo:** `lib/integrations/inngest/functions.ts`

---

## 6. Vercel Blob (Upload de Arquivos)

- **Lib:** `@vercel/blob`
- **Status:** ✅ Chave disponível
- **Variável:** `BLOB_READ_WRITE_TOKEN`
- **Funcionalidades:**
  - Upload de documentos (RG, receita, Anvisa, comprovante)
  - URLs assinadas para acesso seguro
- **Arquivo:** `lib/integrations/blob/client.ts`

---

## 7. Neon PostgreSQL (Banco de Dados)

- **Lib:** `@neondatabase/serverless` + `drizzle-orm`
- **Status:** ✅ Conectado
- **Variável:** `DATABASE_URL`
- **ORM:** Drizzle com HTTP adapter
- **Schema:** `db/schema/`
- **Migrations:** `db/migrations/`

---

## Vercel Cron Jobs

Declarados em `vercel.json`:

| Path | Schedule | Descrição |
|------|----------|-----------|
| `/api/cron/verificar-validade-documentos` | `0 9 * * *` | Verifica validade de docs Anvisa/receitas |
| `/api/cron/verificar-recompra-medicamentos` | `0 9 * * *` | Verifica previsão de término de medicamentos |

**Importante:** Adicionar `CRON_SECRET` nas variáveis de ambiente da Vercel para autenticação dos cron jobs.
