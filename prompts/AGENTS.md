# AGENTS.md — Be4Hope

Este arquivo define **como agentes autônomos devem operar** neste repositório.
O contexto do projeto, escopo funcional e regras de negócio estão em `CLAUDE.md` — leia-o **antes** de qualquer ação.

---

## Princípios gerais para qualquer agente

1. **Leia `CLAUDE.md` primeiro.** Sempre. Toda decisão de stack, escopo ou regra de negócio sai de lá.
2. **Não duplique trabalho.** Antes de criar algo, verifique se já existe componente, util ou schema equivalente.
3. **Pequenos commits coerentes.** Um agente nunca mistura responsabilidades de outro no mesmo commit.
4. **Migrations nunca são editadas após geradas** — para mudar schema, gerar nova migration.
5. **Nada de mock em produção.** Dados de teste só em arquivos `*.seed.ts`.
6. **Falhou? Pare e reporte.** Não invente solução fora do escopo do agente.

---

## Permissões globais (todos os agentes)

**Pode sem confirmar:**
- Ler qualquer arquivo do repositório
- Criar e editar arquivos dentro do seu escopo (definido abaixo)
- Rodar `pnpm install`, `pnpm lint`, `pnpm format`, `pnpm build`
- Adicionar componentes via `pnpm shadcn add <comp>`
- Consultar Context7 para documentação atualizada

**Nunca pode:**
- Editar `.env`, `.env.local` ou qualquer arquivo com segredos
- Commitar chaves de API, tokens ou credenciais
- Apagar migrations já aplicadas
- Rodar `pnpm db:migrate` em produção sem aprovação humana
- Alterar `package.json` para desfixar versões (sempre amarradas)
- Criar componentes visuais do zero quando existir equivalente shadcn

---

## Divisão de agentes

### Agente 1 — Fundação

**Missão:** preparar o terreno para todos os outros.

**Escopo de arquivos:**
- `package.json`, `pnpm-lock.yaml`
- `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`
- `.eslintrc`, `.prettierrc`, `.editorconfig`
- `/lib/env.ts` (validação Zod das variáveis de ambiente)
- `.env.example`
- Configuração inicial de Clerk/NextAuth
- Configuração inicial do Drizzle e cliente Neon

**Entregáveis:**
- Projeto Next.js inicializado com pnpm
- shadcn instalado e configurado
- Drizzle conectado ao Neon
- Auth funcionando com 3 roles (admin, medico, paciente)
- Layout raiz com providers (Auth, Theme, Toast)

**Encerra quando:** `pnpm dev` sobe sem erros e há login funcional.

---

### Agente 2 — Banco de Dados

**Missão:** modelar e manter o schema.

**Escopo de arquivos:**
- `/db/schema/**`
- `/db/migrations/**`
- `/lib/db/**`

**Entregáveis (nesta ordem):**
1. `users` (com role)
2. `medicos` (perfil profissional, especialidade, agenda Google)
3. `pacientes` (vínculo com médico responsável)
4. `triagens` (formulário público)
5. `documentos` (RG, receita, comprovante, Anvisa — com validade)
6. `consultas` (vínculo paciente-médico, link Meet, evento Calendar)
7. `anamneses`
8. `evolucoes`
9. `medicamentos` e `dosagens`
10. `recompras` (cálculo de ml/gotas/data prevista)
11. `mensagens` e `grupos_chat`
12. `notificacoes`
13. `logs_auditoria`

**Regras:**
- Toda tabela tem `id` (CUID), `created_at`, `updated_at`
- Soft delete onde fizer sentido clínico (`deleted_at`)
- Relacionamentos sempre tipados via Drizzle relations
- Nenhum agente além deste altera arquivos em `/db/schema`

**Encerra quando:** todas as tabelas existem, migration aplicada, Drizzle Studio abre sem erros.

---

### Agente 3 — Integrações Externas

**Missão:** conectar serviços de terceiros.

**Escopo de arquivos:**
- `/lib/integrations/google-calendar/**`
- `/lib/integrations/resend/**`
- `/lib/integrations/pusher/**`
- `/lib/integrations/inngest/**`
- `/lib/integrations/blob/**`
- `/app/api/webhooks/**` (callbacks dos serviços)
- `/app/api/inngest/**` (endpoint do Inngest)

**Entregáveis:**
- Função `criarConsultaGoogleCalendar()` que cria evento + retorna link Meet
- Templates de e-mail via Resend (confirmação de consulta, renovação de documento, recompra)
- Cliente Pusher configurado para chat em tempo real
- Jobs Inngest:
  - `verificar-validade-documentos` (diário)
  - `verificar-recompra-medicamentos` (diário)
  - `enviar-email-recompra-agendado` (na data calculada)
- Helper de upload no Vercel Blob com URL assinada

**Restrições:**
- Nunca chama o banco diretamente — recebe e retorna dados via parâmetros/retorno
- Toda integração tem fallback e log de erro estruturado

**Encerra quando:** cada integração tem teste manual documentado em `/docs/integracoes.md`.

---

### Agente 4 — Backend de Negócio (Server Actions)

**Missão:** implementar as regras de negócio do `CLAUDE.md`.

**Escopo de arquivos:**
- `/app/**/_actions/**` (Server Actions por feature)
- `/lib/auth/permissions.ts` (helpers de permissão por role)
- `/lib/utils/**` (cálculos puros: dosagem, data de recompra, validade)

**Entregáveis principais:**
- Action de agendamento (orquestra Agente 3 + Agente 2)
- Action de upload de documento + cálculo de validade
- Action de cadastro de dosagem + cálculo de recompra
- Action de envio de mensagem (chat)
- Action de exportação de relatório PDF do paciente
- Validação Zod em **toda** action
- Verificação de role em **toda** action

**Restrições:**
- Não escreve JSX
- Não altera schema (pede ao Agente 2)
- Não chama API externa direto (usa Agente 3)

**Encerra quando:** todas as funcionalidades do `CLAUDE.md` têm action correspondente testada.

---

### Agente 5 — Interface (UI)

**Missão:** construir todas as telas.

**Escopo de arquivos:**
- `/app/(public)/**`
- `/app/(auth)/**`
- `/app/(medico)/**`
- `/app/(paciente)/**`
- `/app/(admin)/**`
- `/components/shared/**`
- `/components/forms/**`

**Ordem de execução sugerida:**
1. Layouts e navbars de cada área
2. Páginas públicas (Home, Mundo Endocanabinóide, Parceiros, Contato, Triagem)
3. Fluxo de agendamento público
4. Dashboard do médico (gráficos com Recharts)
5. Lista e detalhe do paciente (abas: Dados, Anamnese, Documentos, Evolução, Dosagem, Gráficos, Relatórios)
6. Área do paciente (perfil, recompra, chat)
7. Área do admin (visão global, triagens recebidas)

**Restrições:**
- **Sempre** usar componentes shadcn — adicionar via CLI antes de usar
- Nunca chamar banco direto: chama Server Action do Agente 4
- Toda rota tem `loading.tsx` e `error.tsx`
- Acessibilidade básica (labels, aria, foco visível)

**Encerra quando:** todas as telas do `CLAUDE.md` existem, navegáveis e funcionais.

---

### Agente 6 — Qualidade e Deploy

**Missão:** garantir que o código está pronto para produção e configurar o deploy na Vercel.

**Escopo:**
- `/docs/**`
- `vercel.json` (cron jobs, headers, rewrites se necessário)
- `.github/workflows/**` (CI: lint + build em cada PR)
- README do projeto
- Configurações no painel da Vercel (variáveis, domínio, regiões)

**Entregáveis de qualidade:**
- Lint e Prettier passando em todo o repo
- Build de produção sem erros nem warnings críticos
- README com setup completo (clone → install → dev)
- CI rodando lint + build em toda PR

**Entregáveis de deploy (Vercel):**

1. **Conexão do repositório**
   - Importar o projeto no painel da Vercel
   - Definir framework como **Next.js** (auto-detectado)
   - Install command: `pnpm install --frozen-lockfile`
   - Build command: `pnpm build`
   - Output directory: padrão Next.js

2. **Configuração de ambientes**
   - **Production** vinculado à branch `main`
   - **Preview** habilitado para todas as PRs
   - Region principal: **`gru1` (São Paulo)**

3. **Variáveis de ambiente** (seguindo `.env.example`)
   - Cadastrar **separadamente** em Production e Preview
   - Banco: usar branches do Neon distintas para cada ambiente
   - Marcar segredos como **Sensitive** no painel
   - Validar localmente com `/lib/env.ts` antes do primeiro deploy

4. **Domínio**
   - Adicionar `be4hope.org` no painel da Vercel
   - Configurar DNS no registrador (registros `A` / `CNAME` conforme orientação da Vercel)
   - Adicionar `www.be4hope.org` com redirect 308 para o root
   - SSL automático (Vercel cuida)

5. **Cron jobs**
   - Se usar Inngest: garantir que o endpoint `/api/inngest` esteja exposto e registrado no painel do Inngest
   - Se usar Vercel Cron: declarar em `vercel.json`:
     ```json
     {
       "crons": [
         { "path": "/api/cron/verificar-validade-documentos", "schedule": "0 9 * * *" },
         { "path": "/api/cron/verificar-recompra-medicamentos", "schedule": "0 9 * * *" }
       ]
     }
     ```

6. **Webhooks externos apontando para produção**
   - Clerk → URL de produção
   - Pusher → URL de produção
   - Inngest → URL de produção
   - Documentar cada URL em `/docs/integracoes.md`

7. **Observabilidade**
   - Habilitar **Vercel Analytics** e **Speed Insights**
   - Habilitar **Log Drains** se necessário para auditoria LGPD
   - Configurar alertas básicos de falha de deploy

8. **Checklist de Go-Live** (antes do primeiro deploy em `main`)
   - [ ] Todas as variáveis de produção cadastradas
   - [ ] Banco Neon de produção criado e migrations aplicadas
   - [ ] Domínio apontando corretamente
   - [ ] Webhooks externos apontando para produção
   - [ ] Teste end-to-end em ambiente Preview com dados reais de teste
   - [ ] Plano da Vercel adequado (Pro recomendado)
   - [ ] Logs de auditoria LGPD ativos

**Restrições:**
- **Nunca** rodar `pnpm db:migrate` direto contra o banco de produção sem aprovação humana
- **Nunca** commitar `.env*` (apenas `.env.example`)
- Não fazer deploy de `main` até o checklist de Go-Live estar completo

**Encerra quando:** projeto buildando limpo, deploy de Preview funcional, checklist de Go-Live pronto para revisão humana.

---

## Fluxo de execução recomendado

```
Agente 1 (Fundação)
        │
        ▼
Agente 2 (Banco)  ──────┐
        │               │
        ▼               ▼
Agente 3 (Integrações)  │
        │               │
        └──────┬────────┘
               ▼
        Agente 4 (Server Actions)
               │
               ▼
        Agente 5 (UI)
               │
               ▼
        Agente 6 (Qualidade/Deploy)
```

Os Agentes 2 e 3 podem rodar em paralelo após o 1.
O Agente 4 só inicia com 2 e 3 prontos.
O Agente 5 só inicia com o 4 estabilizado.

---

## Protocolo de comunicação entre agentes

Quando um agente precisa de algo fora do seu escopo:

1. **Documenta a necessidade** em `/docs/handoffs.md` no formato:
   ```
   ## [Data] — Agente X → Agente Y
   Preciso de: <descrição curta>
   Motivo: <por quê>
   Arquivo afetado: <caminho>
   ```
2. **Para sua execução** e aguarda o agente responsável.
3. **Não tenta resolver fora do seu escopo.**

---

## Quando parar e pedir confirmação humana

Mesmo em modo autônomo, **pare e pergunte** quando:

- Precisar criar/alterar conta em serviço externo (Google Cloud, Resend, Pusher, etc.)
- Precisar de chave de API ou credencial
- Detectar conflito entre `CLAUDE.md` e a implementação existente
- Estiver prestes a apagar dados (mesmo em dev)
- Encontrar uma decisão de produto não coberta pelo escopo
- Precisar instalar lib que **não** está listada no `CLAUDE.md`

---

## Checklist mínimo antes de encerrar qualquer tarefa

- [ ] `pnpm lint` sem erros
- [ ] `pnpm build` sem erros
- [ ] Tipos do TypeScript estritos (sem `any`)
- [ ] Versões fixas no `package.json`
- [ ] Variáveis novas adicionadas ao `.env.example` e ao `/lib/env.ts`
- [ ] Nenhum segredo ou dado sensível commitado
- [ ] Mudanças de schema têm migration gerada
- [ ] Componentes shadcn usados onde aplicável
