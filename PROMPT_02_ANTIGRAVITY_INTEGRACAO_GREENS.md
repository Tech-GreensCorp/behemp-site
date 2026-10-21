# PROMPT 02 — Integração BE4HOPE ↔ Greens Corp (lado behemp)

## Para: Antigravity | Projeto: behemp-site (Be4Hope)

## Data: Agosto 2026 | REQ-GC-03 do Backlog

## Depende de: PROMPT_01 concluído e migration 0018 aplicada no banco principal

---

## LEIA PRIMEIRO

1. `AGENTS.md` e `CLAUDE.md` — contrato do projeto
2. `CONTRATO_INTEGRACAO_GREENS_BEHEMP.md` na raiz do projeto site_greens — este prompt implementa exatamente esse contrato, seções 4 e 5. Qualquer dúvida sobre payload ou comportamento, o contrato é a fonte de verdade.
3. Este prompt é 100% autocontido no behemp — não toca no greens-corp. O outro lado é implementado pelo antigravity do greens em paralelo.

## CONTEXTO

O portal Greens Corp encaminha pacientes sem ANVISA/consulta para a BE4HOPE. Quando isso acontece, o greens cria um encaminhamento (referral) no behemp via API. O behemp conduz o paciente pelo processo completo e dispara webhooks de progresso de volta ao greens. Este prompt implementa:

1. **Endpoint de recebimento de referral** (greens → behemp)
2. **Emissor de webhooks de progresso** (behemp → greens)
3. **Schema** — nova tabela de referrals recebidos
4. **Novas variáveis de ambiente**

---

## O QUE JÁ EXISTE — não recriar

- `app/api/webhooks/` — padrão de Route Handlers para webhooks já estabelecido (clerk, docusign, google)
- `db/schema/triagens.ts` — tabela `triagens` com JSONB `dados`, `emailContato`, `telefoneContato`, `nomeContato`, `statusVisualizacao`
- `lib/env.ts` — validação de env com Zod (adicionar vars novas aqui)
- Inngest — já configurado, usar para retry de webhooks de saída

---

## IMPLEMENTAÇÃO

### 1. Schema — nova tabela `referrals_greens`

Em `db/schema/referrals-greens.ts` (arquivo novo):

```typescript
// Registra encaminhamentos recebidos do portal Greens Corp.
// Vinculado à triagem criada no recebimento.
// Nunca deletar — histórico de parceria.
export const referralsGreens = pgTable(
  'referrals_greens',
  {
    ...baseColumns,
    referralId: text('referral_id').notNull().unique(), // UUID gerado pelo greens — chave de idempotência
    triagemId: text('triagem_id').references(() => triagens.id), // triagem criada no recebimento
    medicationRequestProtocol: text('medication_request_protocol').notNull(), // SOL-YYYYNNNNNN
    patientName: text('patient_name').notNull(),
    patientCpf: text('patient_cpf'),
    patientEmail: text('patient_email').notNull(),
    patientPhone: text('patient_phone'),
    patientBirthDate: text('patient_birth_date'), // YYYY-MM-DD
    needsConsultation: boolean('needs_consultation').notNull().default(true),
    needsAnvisa: boolean('needs_anvisa').notNull().default(true),
    requestedProductName: text('requested_product_name').notNull(),
    requestedProductQuantity: text('requested_product_quantity').notNull(),
    notes: text('notes'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('referrals_greens_referral_id_idx').on(t.referralId),
    index('referrals_greens_cpf_idx').on(t.patientCpf),
  ],
);
```

Adicionar em `db/schema/index.ts` e `db/schema/relations.ts` (relação com triagens).

Gerar migration Drizzle. **Seguir o protocolo: branch Neon primeiro, reportar ao usuário antes de aplicar no principal.**

### 2. Endpoint de recebimento de referral

`app/api/integrations/greens/referrals/route.ts` (Route Handler — padrão do projeto para HTTP público):

**POST /api/integrations/greens/referrals**

```
Header obrigatório: X-Greens-Integration-Token: <token>
```

**Comportamento:**

1. Validar header `X-Greens-Integration-Token` contra `env.GREENS_INTEGRATION_TOKEN` — sem token ou token inválido → 401 sem detalhes
2. Validar payload com Zod (schema abaixo) → payload inválido → 422 `{ sucesso: false, erro: "..." }`
3. **Idempotência:** buscar `referrals_greens` por `referralId` — se já existe → 200 com o registro existente (não recriar)
4. Criar registro em `referrals_greens`
5. Criar triagem na tabela `triagens` com:
   - `emailContato`, `telefoneContato`, `nomeContato` do payload
   - `dados` (JSONB) contendo o payload completo + `origem: 'greens-corp'`
   - `statusVisualizacao: 'pendente'`
6. Atualizar `referrals_greens.triagemId` com o id da triagem criada
7. Notificar admin via `notificacoes` (tipo `novo_paciente`, título "Novo encaminhamento Greens Corp", link `/admin/triagens`)
8. Registrar auditoria em `logs_auditoria`
9. Retornar 201: `{ sucesso: true, dados: { referralId, triagemId, status: 'recebido' } }`

**Schema Zod do payload:**

```typescript
z.object({
  referralId: z.string().uuid(),
  medicationRequestProtocol: z.string(),
  patient: z.object({
    fullName: z.string(),
    cpf: z.string().regex(/^\d{11}$/),
    email: z.string().email(),
    phone: z.string(),
    birthDate: z.string().nullable(),
  }),
  needs: z.object({
    consultation: z.boolean(),
    anvisaAuthorization: z.boolean(),
  }),
  requestedProduct: z.object({
    name: z.string(),
    quantity: z.string(),
  }),
  notes: z.string().nullable(),
});
```

### 3. Emissor de webhooks (behemp → greens)

Criar `lib/integrations/greens/webhook-emitter.ts`:

```typescript
// Assina o payload com HMAC-SHA256 usando BEHEMP_WEBHOOK_SECRET
// e entrega ao GREENS_WEBHOOK_URL com retry via Inngest
```

**Função principal:**

```typescript
export async function emitirWebhookGreens(evento: {
  eventType: string;
  referralId: string;
  data: Record<string, unknown>;
}): Promise<void>;
```

- Gera `eventId` único (cuid2 — já é dependência)
- Monta envelope: `{ eventId, eventType, referralId, occurredAt: ISO-8601, data }`
- Assina: `X-Behemp-Webhook-Signature = HMAC-SHA256(JSON.stringify(envelope), BEHEMP_WEBHOOK_SECRET)`
- POST para `GREENS_WEBHOOK_URL` com timeout 10s
- Falha (não-2xx ou timeout) → dispara evento Inngest `behemp/webhook.falhou` com o envelope para retry
- Se `GREENS_WEBHOOK_URL` não estiver configurado → logar warning e retornar sem erro (graceful degradation)

**Inngest function de retry** em `lib/integrations/inngest/functions.ts` (adicionar, não substituir):

```typescript
export const retryWebhookGreens = inngest.createFunction(
  { id: 'retry-webhook-greens', retries: 5 },
  { event: 'behemp/webhook.falhou' },
  async ({ event, step, attempt }) => {
    // Backoff: tentativa 1=1min, 2=10min, 3=1h, 4=6h, 5=24h
    const delays = [60, 600, 3600, 21600, 86400];
    const delay = delays[Math.min(attempt, delays.length - 1)];
    await step.sleep('aguardar-retry', `${delay}s`);
    await step.run('reenviar', () => /* POST com mesmo envelope */ );
    // Após 5 falhas: notificar admin via notificacoes
  }
);
```

### 4. Disparar webhooks nos eventos corretos

Localizar as Server Actions e Route Handlers que controlam os status abaixo e adicionar `emitirWebhookGreens(...)` **apenas quando a triagem/paciente tiver um `referralId` vinculado** (buscar em `referrals_greens` por `triagemId` ou `pacienteId`):

| Evento                          | Onde disparar                                                         | eventType                | data                                                             |
| ------------------------------- | --------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- |
| Admin aceita/visualiza triagem  | Action de atualização de triagem                                      | `referral.accepted`      | `{ pacienteBehempId }`                                           |
| Consulta/teleconsulta realizada | Action de encerrar teleconsulta                                       | `consultation.completed` | `{ consultaId, realizadaEm }`                                    |
| Prescrição assinada emitida     | Action de assinar prescrição                                          | `prescription.issued`    | `{ prescricaoId }`                                               |
| ANVISA aprovada                 | `app/api/anvisa/atualizar-status/route.ts` (quando status → aprovado) | `anvisa.approved`        | `{ autorizacaoId, numeroProcesso, dataAprovacao, dataValidade }` |
| ANVISA rejeitada                | Mesmo route                                                           | `anvisa.rejected`        | `{ autorizacaoId, motivo }`                                      |
| Desconto collab definido        | Criar action nova ou existente                                        | `referral.discount`      | `{ discountPercent }`                                            |
| Triagem encerrada/cancelada     | Action de encerrar triagem                                            | `referral.cancelled`     | `{ motivo }`                                                     |

**Regra crítica:** antes de qualquer `emitirWebhookGreens`, verificar se a triagem/paciente tem referral greens vinculado. Se não tiver, não emitir. Pacientes que chegaram por outros canais não devem gerar webhooks para o greens.

### 5. Novas variáveis de ambiente

Adicionar em `lib/env.ts` E em `.env.example` (nunca no `.env` real — o usuário preenche):

```typescript
// Integração Greens Corp
GREENS_INTEGRATION_TOKEN: z.string().optional(), // Token que o greens envia no header
GREENS_WEBHOOK_URL: z.string().url().optional(), // URL do receiver no greens
BEHEMP_WEBHOOK_SECRET: z.string().optional(),    // Secret para assinar os webhooks de saída
```

`.env.example`:

```
GREENS_INTEGRATION_TOKEN=
GREENS_WEBHOOK_URL=https://api.greens-corp.com/api/v1/webhooks/behemp
BEHEMP_WEBHOOK_SECRET=
```

---

## CRITÉRIOS DE ACEITE

- [ ] POST `/api/integrations/greens/referrals` retorna 401 sem token, 422 com payload inválido, 201 na criação, 200 em replay idempotente
- [ ] Referral cria triagem vinculada e notificação admin
- [ ] `emitirWebhookGreens` assina corretamente com HMAC-SHA256
- [ ] Retry via Inngest com backoff 1min→10min→1h→6h→24h
- [ ] Webhooks só disparam para pacientes com referral greens vinculado — nunca para pacientes de outros canais
- [ ] `GREENS_WEBHOOK_URL` não configurado não quebra o sistema (graceful degradation)
- [ ] Migration gerada e commitada (SQL + snapshot + journal)
- [ ] Novas vars em `lib/env.ts` e `.env.example`
- [ ] `pnpm build` passa sem erros novos

## O QUE NÃO FAZER

- NÃO criar UI/telas — integração é só backend
- NÃO implementar o receiver de webhooks do greens — esse lado é do antigravity do greens-corp
- NÃO disparar webhooks para pacientes sem referral greens vinculado
- NÃO aplicar migration no banco principal sem branch Neon + aprovação explícita do usuário
- NÃO rodar `pnpm format` global
