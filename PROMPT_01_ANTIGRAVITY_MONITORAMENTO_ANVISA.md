# PROMPT 01 — Monitoramento de Renovação ANVISA (validade 2 anos)

## Para: Antigravity | Projeto: behemp-site (Be4Hope)

## Data: Agosto 2026 | REQ-BH-01 do Backlog Greens Corp

---

## LEIA PRIMEIRO

1. `AGENTS.md` e `CLAUDE.md` na raiz — contrato do projeto, stack real e padrões obrigatórios
2. Este prompt segue a arquitetura REAL do projeto: Next.js 16 App Router + Server Components + Server Actions, Clerk (roles: admin/medico/paciente), Drizzle + Neon, Brevo, Inngest, Vercel Blob
3. Estado conhecido do baseline: `pnpm lint` falha com 117 erros e `pnpm format:check` falha em 233 arquivos — NÃO tente corrigir o baseline; reporte apenas falhas NOVAS introduzidas pelas suas mudanças

## CONTEXTO DO NEGÓCIO

A autorização de importação ANVISA de cada paciente tem **validade de 2 anos**. A renovação é obrigatória e o processo é demorado — perder o prazo interrompe o tratamento do paciente. A diretoria exige monitoramento profissional com alertas ao paciente E à equipe, e uma visão consolidada no admin.

## O QUE JÁ EXISTE (verificado no código — NÃO recriar)

- `db/schema/autorizacoes-anvisa.ts` — tabela com `dataAprovacao`, `dataValidade`, `status`, `modalidade`, soft delete
- `db/schema/alertas-config.ts` — singleton: `marcosLicencaDias` (default [60, 30]), `digestHorario` (08:00), `digestAtivo`, `notificarPaciente`
- `db/schema/alertas-enviados.ts` — ledger de idempotência: unique(tipo, referenciaId, marcoDias, destinatario). Tipo `licenca_anvisa` já existe no `alertaTipoEnum`
- `db/schema/notificacoes.ts` — notificações in-app por usuário com `linkAcao`
- Motor de alertas/digest existente (localizar a implementação — provavelmente cron route ou Inngest function que consome `alertas_config`)

**Antes de codar:** localize e leia a implementação atual do motor de alertas (busque por `marcosLicencaDias`, `alertas_enviados`, rotas cron, functions Inngest). Sua implementação ESTENDE o que existe — não cria motor paralelo.

⚠️ O banco é PRODUÇÃO no Neon. Antes de qualquer migration ou backfill, leia a seção "PROTOCOLO DE MIGRATION E BACKFILL EM PRODUÇÃO" no final deste prompt.

---

## IMPLEMENTAÇÃO

### 1. Cálculo automático da validade (2 anos)

Em toda mutation que registra/atualiza `dataAprovacao` de uma autorização ANVISA (localizar Server Actions existentes de autorizações):

- Ao preencher `dataAprovacao`, calcular automaticamente `dataValidade = dataAprovacao + 2 anos` (usar `date-fns` `addYears`, já é dependência)
- Se o admin informar `dataValidade` manualmente, respeitar o valor manual (casos excepcionais)
- Autorização com status `aprovado` NUNCA fica com `dataValidade` null — validar no Zod da action
- Backfill: script único em `scripts/` (padrão dos scripts existentes) que preenche `dataValidade` de autorizações aprovadas antigas onde estiver null, calculando de `dataAprovacao + 2 anos`. Rodar manualmente, logar quantas linhas afetou

### 2. Marcos de alerta ampliados

- Atualizar default de `marcosLicencaDias` no schema de `[60, 30]` para `[90, 60, 30, 7]`
- Gerar migration Drizzle para o novo default + UPDATE do singleton existente (se ainda estiver com o valor antigo [60,30])
- O motor existente já itera os marcos — confirmar que funciona com 4 marcos sem mudança de lógica; ajustar apenas se houver hardcode

### 3. Alerta pós-expiração (comportamento NOVO)

Hoje os marcos são apenas pré-vencimento. Adicionar:

- Autorização com `dataValidade < hoje`, status `aprovado`, sem renovação iniciada (ver item 5) → alerta semanal recorrente para admin
- Idempotência semanal: usar `alertas_enviados` com `marcoDias` negativo representando semanas pós-expiração (ex: -7, -14, -21...) — mantém o unique constraint funcionando sem alterar o schema
- Notificação in-app (tabela `notificacoes`, tipo `renovacao_documento`) + email Brevo para admins

### 4. Dashboard de Monitoramento ANVISA (admin)

Nova página em `app/(admin)/` (seguir convenção de rotas do grupo admin existente — verificar o padrão de path das páginas admin atuais):

**Conteúdo:**

- Contadores no topo (cards): Ativas | Vencem em ≤90 dias | Vencem em ≤30 dias | Expiradas
- Tabela: paciente (nome + link para o perfil), número do processo, data de aprovação, data de validade, dias restantes, status visual, modalidade
- Status visual por cor (usar tokens do design system — verde musgo/terracota da paleta existente, NUNCA cores genéricas):
  - Normal: >90 dias
  - Atenção: ≤90 dias
  - Crítico: ≤30 dias
  - Expirado: <0 dias
- Filtros: por faixa de status, busca por nome do paciente
- Ordenação default: mais próximas do vencimento primeiro
- Ação por linha: "Iniciar Renovação" (item 5)

**Arquitetura:** Server Component com query Drizzle direta (padrão do projeto — sem Route Handler local). Filtros/busca via searchParams. Interatividade mínima extraída para Client Components pequenos.

**Query:** `autorizacoes_anvisa` com `deletedAt IS NULL`, status `aprovado`, join com `pacientes` + `users` para o nome. Calcular dias restantes no servidor.

### 5. Fluxo de Renovação

- Novo campo no schema `autorizacoes-anvisa.ts`: `autorizacaoAnteriorId: text('autorizacao_anterior_id')` (nullable, self-reference) + index. Migration Drizzle
- Server Action `iniciarRenovacao(autorizacaoId)`:
  - Auth: admin sempre; paciente apenas para a própria autorização (validar escopo por role — padrão do AGENTS.md)
  - Cria nova autorização: status `pendente`, mesma `modalidade` da anterior, `autorizacaoAnteriorId` preenchido, mesmo `pacienteId`/`medicoId`/`prescricaoId` se ainda fizer sentido
  - Checklist de documentos: copiar do JSONB `documentos` da anterior os itens cujo documento não vence (ex: certidão) marcados como enviados; itens com validade (receita, comprovante de residência) entram zerados
  - Registrar auditoria (padrão `logs-auditoria` existente)
  - Impedir duplicidade: se já existe renovação em aberto (autorização com `autorizacaoAnteriorId` = esta e status não-terminal), retornar erro amigável
- A autorização anterior permanece intocada (histórico regulatório — LGPD art. 16, já documentado no schema)

### 6. Visão do Paciente

No portal do paciente (`app/(paciente)/` — localizar a página principal/dashboard do paciente):

- Card "Minha Autorização ANVISA": número do processo, validade, dias restantes
- Quando ≤90 dias: contagem regressiva em destaque + CTA "Iniciar Renovação" (chama a Server Action do item 5)
- Quando expirada: aviso claro + mesmo CTA
- Quando renovação já em andamento: mostrar status da nova autorização no lugar do CTA
- Paciente vê APENAS a própria autorização (escopo por role)

### 7. Emails (Brevo — reaproveitar cliente existente)

- Alerta de marco para paciente: "Sua autorização ANVISA vence em X dias" + link para renovação
- Alerta de marco para admin: consolidado no digest existente (verificar como o digest monta o corpo hoje e integrar)
- Alerta pós-expiração para admin: lista de autorizações expiradas sem renovação
- Respeitar `notificarPaciente` do `alertas_config`

---

## CRITÉRIOS DE ACEITE

- [ ] Aprovar autorização preenche `dataValidade` automaticamente (+2 anos); manual sobrescreve
- [ ] Script de backfill preenche validades antigas e loga o total
- [ ] Marcos [90, 60, 30, 7] geram alertas idempotentes para paciente e admin (respeitando `notificarPaciente`)
- [ ] Autorização expirada sem renovação gera alerta semanal recorrente ao admin sem duplicar na mesma semana
- [ ] Dashboard admin mostra contadores corretos, cores por faixa, filtros, busca e ordenação por urgência
- [ ] "Iniciar Renovação" cria autorização vinculada, copia documentos não-vencíveis, bloqueia duplicidade e registra auditoria
- [ ] Paciente vê card com validade e consegue iniciar a própria renovação; não vê dados de outros pacientes
- [ ] Migrations Drizzle commitadas (SQL + snapshot + journal juntos)
- [ ] `pnpm build` passa; lint/format sem erros NOVOS além do baseline conhecido (117/233)

## O QUE NÃO FAZER

- NÃO criar motor de alertas paralelo — estender o existente
- NÃO usar Route Handler onde Server Component/Action resolve (padrão do projeto)
- NÃO alterar o design system — usar tokens e componentes existentes
- NÃO tocar em teleconsultas, prescrições, invoices, chat ou qualquer módulo fora do escopo ANVISA/alertas
- NÃO implementar integração com o portal Greens Corp (será um prompt futuro com contrato definido)
- NÃO rodar `pnpm format` global

---

## ⚠️ PROTOCOLO DE MIGRATION E BACKFILL EM PRODUÇÃO (OBRIGATÓRIO)

O banco deste projeto é PRODUÇÃO no Neon, com dados clínicos reais de pacientes (LGPD). Não existe staging separado. Portanto:

1. **NUNCA rode migration ou backfill direto no banco principal.**
2. Crie um branch do banco no Neon antes: console Neon (Branches → New Branch a partir do principal) ou CLI `neonctl branches create --name migration-test-anvisa`.
3. Aponte `DATABASE_URL` local para a connection string DIRECT do branch (sem `-pooler` no host — `drizzle-kit migrate` pode falhar na pooled) e rode a migration nele.
4. Rode o script de backfill de `dataValidade` PRIMEIRO no branch. Antes do UPDATE, o script deve imprimir um dry-run: quantas linhas serão afetadas e uma amostra de 10 (id, dataAprovacao, dataValidade calculada). Valide a amostra manualmente.
5. Valide no branch: migrations aplicadas, backfill correto, `pnpm build` passa, dashboard renderiza contra o branch.
6. **PARE e reporte ao usuário (Diniz):** "Migration + backfill validados no branch Neon [nome]. X linhas serão afetadas pelo backfill. Aguardando aprovação para aplicar no banco principal." NÃO prossiga sem aprovação explícita.
7. Só após aprovação: aplique migrations (`pnpm db:migrate`) e backfill no principal, usando connection string DIRECT.
8. Delete o branch de teste ao final.

Esse protocolo vale para QUALQUER mudança de schema ou UPDATE em massa neste projeto, agora e no futuro.
