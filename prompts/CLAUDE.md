# Be4Hope — Plataforma de Medicina Endocanabinóide

Projeto web da **Be4Hope** (domínio `be4hope.org`), plataforma de telemedicina especializada em tratamentos endocanabinóides. Conecta pacientes a médicos, gerencia consultas, dosagens, documentação regulatória e acompanhamento clínico.

---

## Idioma e localização

- Todo o projeto é em **PT-BR**: textos de UI, mensagens, e-mails, validações, comentários e documentação.
- Datas no formato `dd/mm/aaaa`, moeda em BRL quando aplicável, fuso `America/Sao_Paulo`.

---

## Stack obrigatória

- **Next.js** (App Router) — versão LTS estável
- **Neon PostgreSQL** como banco de dados
- **Drizzle ORM** para schema e migrations
- **shadcn/ui** para todos os componentes de UI — **nunca criar componentes visuais do zero quando existir equivalente no shadcn**
- **Tailwind CSS** para estilização
- **pnpm** como gerenciador de pacotes
- **TypeScript estrito** em todo o código
- **Prettier** + **ESLint** configurados desde o início
- Versões das libs **sempre amarradas** (sem `^` ou `~` no `package.json`)
- Sempre usar versões **LTS** das bibliotecas
- Consultar o **Context7** para obter informações atualizadas sobre Next.js e libs antes de implementar

### Hospedagem e deploy

- **Vercel** — hospedagem oficial do projeto
- Plano recomendado: **Pro** em produção (timeout de funções até 300s, cron jobs ilimitados, ambientes separados)
- Região da Vercel: **`gru1` (São Paulo)** — menor latência para usuários BR e proximidade com o Neon
- Domínio de produção: `be4hope.org` (e `www.be4hope.org` redirecionando para o root)
- Ambientes:
  - **Production** → branch `main`
  - **Preview** → toda PR e branch `develop`
  - **Development** → local (`pnpm dev`)
- Cada ambiente tem seu próprio conjunto de variáveis no painel da Vercel
- Banco Neon com **branch separada por ambiente** (production / preview / development) para não misturar dados
- Build command: `pnpm build` | Install command: `pnpm install --frozen-lockfile` | Output: padrão Next.js
- Cron jobs configurados via `vercel.json` quando não usados via Inngest
- Logs e observabilidade: **Vercel Logs** + **Vercel Analytics** habilitados em produção

### Integrações externas

- **Clerk** ou **NextAuth.js** — autenticação com 3 roles: `admin`, `medico`, `paciente`
- **Google Calendar API** — agendamento de consultas + geração automática de link Google Meet
- **Resend** — envio de e-mails (notificações, renovações, recompra de medicamento, link da consulta)
- **Inngest** — jobs agendados (renovação de documentos, alertas de recompra)
- **Vercel Blob** — upload de documentos (RG, receita, comprovante, Anvisa)
- **Pusher** ou **Ably** — chat em tempo real (paciente ↔ suporte/médicos/outros usuários)
- **Recharts** — gráficos do dashboard médico
- **react-pdf** ou **@react-pdf/renderer** — exportação de relatórios em PDF

---

## Escopo funcional

### Área pública (sem login)

- **Home** — apresentação da Be4Hope, "quem somos", CTA para triagem e contato
- **Navbar global** — Quem Somos / Triagem / Medicina Endocanabinóide / Agendamento / Parceiros / Entre em Contato
- **/mundo-endocanabinoide** — conteúdo sobre Dor Crônica, Saúde Mental, Neurologia, Oncologia, Pediatria, Dermatologia, Saúde Esportiva e Odontologia. Botão CTA para agendar consulta.
- **/agendamento** — fluxo de marcação: escolha de médico OU data/hora → dados pessoais → confirmação. Confirmação cria evento no Google Calendar do médico, gera link Meet e envia por e-mail ao paciente.
- **/parceiros** — apresentação da parceria com a **Greens**
- **/entre-em-contato** — FAQ com perguntas frequentes + canais de contato
- **/triagem** — formulário com múltiplas perguntas. Respostas armazenadas e visíveis apenas ao admin.

### Área logada — Médico

- **Dashboard** com:
  - Cards de KPIs: total de pacientes, especialidade do médico logado, notificações
  - Gráfico de tipos de tratamento (CBD / THC / CBD + THC)
  - Gráfico de pizza com status dos pacientes (aguardando consulta / em tratamento / concluído)
  - Gráfico de evolução geral dos pacientes
- **Lista de pacientes** com sistema completo de filtros (nome, status, tratamento, período, etc.)
- **Criação e edição de pacientes** com upload de documentos
- **Importação de dados de pacientes** (CSV ou similar)
- **Detalhe do paciente** com abas:
  - **Dados** — resumo dos dados pessoais e clínicos
  - **Anamnese** — criação e edição
  - **Documentos** — upload de RG, RG do responsável (se menor), receita médica, comprovante de residência, autorização Anvisa
  - **Evolução** — registro contínuo da evolução clínica
  - **Dosagem** — CRUD completo das dosagens (histórico mantido)
  - **Gráficos** — evolução de nível de dor, qualidade de sono, indicadores de bem-estar
  - **Relatórios** — exportar PDF consolidado de tudo acima
- **Notificações de renovação documental**:
  - Autorização Anvisa → renovação a cada **2 anos**
  - Receita médica → renovação a cada **6 meses**

### Área logada — Paciente

- **Meu perfil** — visualização e edição, com upload dos próprios documentos
- **Recompra de medicamento**:
  - Paciente seleciona o medicamento, informa **ml do frasco** e **gotas por dia**
  - Sistema calcula a **data prevista de término** do medicamento
  - Botão "Pedir agora" → envia e-mail para um endereço configurável avisando que o paciente X precisa do medicamento
  - Botão "Pedir no futuro" → agenda envio de e-mail na data calculada, com botão dentro do e-mail para confirmar pedido (mesma ação do "Pedir agora")
  - Notificação no sistema quando estiver próximo da data de recompra
- **Chat** — conversas com suporte, médicos e outros usuários, com suporte a **grupos**

### Área logada — Admin

- **Visualização global** do sistema
- **Visualização exclusiva** dos formulários de triagem enviados pela área pública

---

## Regras de negócio críticas

### Cálculo de recompra de medicamento

Fórmula base:
```
gotas_totais = ml_frasco × 20         (1 ml ≈ 20 gotas, configurável por medicamento)
dias_duracao = gotas_totais / gotas_por_dia
data_termino = data_inicio + dias_duracao
```
- Antecedência da notificação configurável (padrão: 7 dias antes do término).
- Considerar que a fórmula gotas/ml pode variar por concentração — manter como campo do medicamento, não constante global.

### Renovação de documentos

- Cada documento upado tem `data_emissao` e `tipo`.
- `data_validade = data_emissao + prazo_do_tipo` (Anvisa: 24 meses; Receita: 6 meses).
- Job diário verifica documentos com validade nos próximos **30 dias** → cria notificação no sistema + envia e-mail ao paciente e ao médico responsável.

### Agendamento

- Consulta confirmada **só após** criação bem-sucedida do evento no Google Calendar do médico.
- Em caso de falha na API do Google, transação é revertida e usuário é informado.
- Link do Meet sempre gerado pelo próprio Google Calendar (não criar manualmente).

### Permissões por role

- `admin` — acesso global, exceto dados clínicos sensíveis sem necessidade
- `medico` — acesso apenas aos próprios pacientes
- `paciente` — acesso apenas aos próprios dados
- Validação de role em **toda** Server Action e API Route, nunca apenas no frontend

---

## Padrões técnicos

### Estrutura de pastas

```
/app                  → rotas (App Router)
  /(public)           → páginas sem login
  /(auth)             → login, signup, recuperação
  /(medico)           → área do médico
  /(paciente)         → área do paciente
  /(admin)            → área do admin
  /api                → API Routes (apenas integrações externas e webhooks)
/components
  /ui                 → componentes shadcn (gerados via CLI)
  /shared             → componentes compostos reutilizáveis
  /forms              → formulários
/lib
  /db                 → cliente Drizzle e helpers
  /integrations       → google-calendar, resend, pusher, inngest
  /auth               → helpers de autenticação e permissão
  /utils              → utilitários puros
/db
  /schema             → schemas Drizzle
  /migrations         → migrations geradas
/docs                 → documentação adicional
```

### Convenções de código

- Server Actions para **todas** as mutations
- API Routes apenas para integrações externas, webhooks e endpoints públicos
- Cada rota deve ter `loading.tsx` e `error.tsx`
- Validação com **Zod** em toda entrada de Server Action / API Route
- Nomes de arquivos em `kebab-case`, componentes em `PascalCase`
- Nunca usar `any` em TypeScript — preferir `unknown` + narrowing
- Comentários em português, claros e objetivos
- Sem dados sensíveis em logs (LGPD)

### Variáveis de ambiente

- Todas em `.env.local`, nunca commitadas
- Manter `.env.example` atualizado a cada nova variável
- Validação com Zod em `/lib/env.ts` (falha o build se faltar variável obrigatória)

---

## LGPD e segurança

- Dados clínicos são sensíveis (categoria especial pela LGPD)
- Logs de auditoria para acesso e alteração de dados de pacientes
- Senhas e tokens **nunca** em logs ou e-mails
- Documentos no Vercel Blob com URLs assinadas e tempo de expiração curto
- Nunca expor IDs sequenciais em URLs públicas — usar UUID/CUID

---

## Comandos do projeto

```bash
pnpm dev                  # servidor de desenvolvimento
pnpm build                # build de produção
pnpm lint                 # ESLint
pnpm format               # Prettier
pnpm db:generate          # gera migration a partir do schema
pnpm db:migrate           # aplica migrations no Neon
pnpm db:studio            # Drizzle Studio
pnpm shadcn add <comp>    # adiciona componente shadcn
```
