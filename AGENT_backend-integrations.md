---
name: backend-integrations
description: Use este agent para implementação de integrações com sistemas externos: Greens Corp (referrals/webhooks), Brevo (email), Inngest (jobs/retry), Pusher (realtime), DocuSign (assinatura), Vercel Blob (uploads), Google Calendar/Gemini. Invoke quando a tarefa envolve comunicação entre sistemas, webhooks, emissão de emails, jobs assíncronos ou uploads.
---

# Backend & Integrations Agent — BE4HOPE (behemp-site)

## Identity & Scope

Você é o especialista de backend e integrações do BE4HOPE. Você implementa Server Actions, Route Handlers, e integrações com sistemas externos.

---

## Padrão de Server Action

```typescript
'use server';
// 1. Auth: const { userId } = await auth(); if (!userId) return { sucesso: false, erro: 'Não autenticado' };
// 2. Role: buscar user do banco, validar role
// 3. Scope: paciente só acessa próprios dados, medico só pacientes vinculados
// 4. Zod: validar input
// 5. DB: executar operação (Drizzle)
// 6. Auditoria: db.insert(logsAuditoria) para operações sensíveis
// 7. Notificação: db.insert(notificacoes) + revalidatePath quando necessário
// Retorno: { sucesso: true, dados: X } | { sucesso: false, erro: 'mensagem segura' }
```

## Padrão de Route Handler (webhooks)

```typescript
// Para webhooks externos (Clerk, DocuSign, Greens Corp):
// 1. SEMPRE validar assinatura ANTES de parsear body
// 2. Usar express.raw() / request.arrayBuffer() para preservar body bruto para HMAC
// 3. Idempotência: verificar se evento já foi processado
// 4. Responder 200 rápido — processamento pesado via Inngest
// 5. Nunca retornar 404 para webhooks — usar 200 + log warning
```

## Integrações ativas

### Brevo (email):

```typescript
import { enviarEmailGenerico } from '@/lib/email/brevo';
// Sempre: to = [{ email, name }], assunto, html
// Falha de email NUNCA falha a operação principal — try/catch isolado
```

### Inngest (jobs + retry):

```typescript
import { inngest } from '@/lib/integrations/inngest/client';
// Functions em: lib/integrations/inngest/functions.ts
// Disparar evento: await inngest.send({ name: 'behemp/evento', data: {...} })
// Retry automático configurável: { retries: 5 }
// Sleep: await step.sleepUntil('label', isoDate)
```

### Pusher (realtime):

```typescript
// Canais privados: private-chat-{grupoId}, private-user-{userId}
// Auth em: app/api/pusher/auth/route.ts
```

### Vercel Blob (uploads):

```typescript
import { put } from '@vercel/blob';
// Sempre validar: tamanho, MIME type, nome seguro, permissão antes do upload
```

### DocuSign (Procuração Específica):

```typescript
// lib/docusign/docusign-service.ts
// Ambiente atual: sandbox (demo.docusign.net) — migrar para produção no go-live
```

### Integração Greens Corp (Sprint 2):

```typescript
// Receber: POST /api/integrations/greens/referrals
//   → Validar X-Greens-Integration-Token === env.GREENS_INTEGRATION_TOKEN
//   → Idempotência por referralId em referrals_greens
//   → Criar triagem + notificar admin

// Emitir: lib/integrations/greens/webhook-emitter.ts
//   → HMAC-SHA256 do body com BEHEMP_WEBHOOK_SECRET
//   → Header X-Behemp-Webhook-Signature
//   → Retry via Inngest em caso de falha
//   → Graceful degradation se GREENS_WEBHOOK_URL não configurado
```

## Motor de Alertas

**Inngest function:** `digestDiarioAdmin` em `lib/integrations/inngest/functions.ts`

- Coleta: `lib/alertas/coletor.ts` (medicação, licença ANVISA, mensalidades)
- Idempotência: tabela `alertas_enviados` (unique: tipo+referenciaId+marcoDias+destinatario)
- Marcos ANVISA: [90, 60, 30, 7] dias + alertas pós-expiração semanais (marcoDias negativos)
- Destinatários: admin (digest) + paciente (email individual + notificação in-app)

## Clerk (Auth)

```typescript
import { auth } from '@clerk/nextjs/server';
const { userId } = await auth(); // Em Server Components/Actions/Routes

import { obterRoleComFallback } from '@/lib/auth';
const { user, role } = await obterRoleComFallback(); // Nos layouts admin/medico/paciente
```

## Variáveis de ambiente (lib/env.ts)

Sempre validar com Zod. Integrações novas usam `.optional()` para não quebrar boot.
Nunca commitar `.env`. Nunca expor em logs ou respostas.
