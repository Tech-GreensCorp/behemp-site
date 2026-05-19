# 🌿 Be4Hope — Plataforma de Medicina Endocanabinóide

Plataforma de telemedicina especializada em tratamentos endocanabinóides. Conecta pacientes a médicos especialistas com consultas online, acompanhamento de dosagem e gestão documental.

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| **Framework** | Next.js 16 (App Router, Turbopack) |
| **Linguagem** | TypeScript (strict) |
| **Estilo** | Tailwind CSS v4 + shadcn/ui |
| **Banco** | Neon PostgreSQL + Drizzle ORM |
| **Auth** | Clerk |
| **E-mail** | Brevo (Sendinblue) |
| **Vídeo** | Google Calendar + Meet |
| **Chat** | Pusher |
| **Jobs** | Inngest |
| **Upload** | Vercel Blob |
| **Deploy** | Vercel |
| **Gráficos** | Recharts |

## Pré-requisitos

- **Node.js** ≥ 20
- **pnpm** ≥ 10
- Conta no [Neon](https://neon.tech) (banco PostgreSQL)
- Conta no [Brevo](https://brevo.com) (e-mail transacional)
- Conta na [Vercel](https://vercel.com) (deploy)

## Instalação

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/behemp.git
cd behemp

# 2. Instale as dependências
pnpm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas credenciais

# 4. Execute as migrations do banco
pnpm db:migrate

# 5. Inicie o servidor de desenvolvimento
pnpm dev
```

O projeto estará disponível em `http://localhost:3000`.

## Variáveis de Ambiente

Veja `.env.example` para a lista completa. As principais são:

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão Neon PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Chave pública do Clerk |
| `CLERK_SECRET_KEY` | Chave secreta do Clerk |
| `BREVO_API_KEY` | API key do Brevo (e-mail transacional) |
| `BREVO_FROM_EMAIL` | E-mail remetente cadastrado no Brevo |
| `BREVO_TO_EMAIL` | E-mail de destino para notificações internas |
| `RECOMPRA_EMAIL_DESTINO` | E-mail para alertas de recompra |
| `GOOGLE_CLIENT_ID` | ID do cliente Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Secret do Google OAuth |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | E-mail da Service Account (Google Sheets) |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Chave privada da Service Account |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | ID da planilha de triagens |
| `PUSHER_APP_ID` / `PUSHER_SECRET` | Credenciais do Pusher (servidor) |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | Credenciais do Pusher (cliente) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Credenciais do Inngest |
| `BLOB_READ_WRITE_TOKEN` | Token do Vercel Blob |
| `CRON_SECRET` | Secret para autenticação dos cron jobs |

## Estrutura do Projeto

```
behemp/
├── app/
│   ├── (public)/          # Área pública (Home, Triagem, Agendamento, etc.)
│   ├── (medico)/          # Área do médico (Dashboard, Pacientes, etc.)
│   ├── (paciente)/        # Área do paciente (Painel, Chat, Medicamentos, etc.)
│   ├── (admin)/           # Área administrativa (Visão geral, Triagens, Auditoria)
│   ├── _actions/          # Server Actions globais (20 arquivos)
│   ├── api/               # Route Handlers (webhooks, cron, pusher, inngest, uploads)
│   └── layout.tsx         # Layout raiz
├── components/
│   ├── shared/            # Navbar, Footer, Sidebars, Chat, Formulários
│   ├── admin/             # Componentes da área admin
│   ├── medico/            # Componentes da área médico
│   ├── forms/             # Formulários reutilizáveis
│   └── ui/                # Componentes shadcn/ui
├── db/
│   ├── schema/            # Schemas Drizzle (25 tabelas + enums + relations)
│   ├── migrations/        # Migrations geradas pelo drizzle-kit
│   ├── seed.ts            # Seed de dados iniciais
│   └── sync-clerk.ts      # Sync manual de usuários Clerk → banco
├── lib/
│   ├── auth/              # Permissões por role (admin / medico / paciente)
│   ├── db/                # Cliente Drizzle + Neon
│   ├── email/             # Templates e funções de envio (Brevo)
│   ├── hooks/             # React hooks compartilhados
│   ├── integrations/      # Clientes de serviços externos
│   │   ├── blob/          # Vercel Blob
│   │   ├── google-calendar/  # Google Calendar + Meet
│   │   ├── google-sheets/ # Google Sheets (triagens)
│   │   ├── inngest/       # Background jobs
│   │   └── pusher/        # Chat realtime
│   ├── invoices/          # Geração de invoices médicas
│   ├── utils/             # Cálculos puros (dosagem, validade, auditoria)
│   └── env.ts             # Validação de variáveis de ambiente com Zod
├── types/                 # Tipos TypeScript globais
├── docs/                  # Documentação interna
└── vercel.json            # Cron jobs Vercel (3 jobs diários)
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento (Turbopack) |
| `pnpm build` | Build de produção |
| `pnpm lint` | Verificação de lint (ESLint) |
| `pnpm format` | Formatação de código (Prettier) |
| `pnpm format:check` | Verificar formatação sem alterar |
| `pnpm db:generate` | Gerar migrations a partir do schema |
| `pnpm db:migrate` | Aplicar migrations no banco |
| `pnpm db:studio` | Abrir Drizzle Studio (interface visual) |
| `pnpm db:seed` | Popular banco com dados iniciais |
| `pnpm db:sync-clerk` | Sincronizar usuários Clerk → banco |

## Rotas da Aplicação

### Área Pública
| Rota | Descrição |
|------|-----------|
| `/` | Home page |
| `/triagem` | Formulário de triagem pré-cadastro |
| `/agendamento` | Agendamento de consultas |
| `/mundo-endocanabinoide` | Conteúdo educacional |
| `/parceiros` | Parceiros (Greens) |
| `/entre-em-contato` | Contato + FAQ |
| `/privacidade` | Política de privacidade |
| `/termos` | Termos de uso |

### Área do Médico (`/medico`)
| Rota | Descrição |
|------|-----------|
| `/medico` | Dashboard com gráficos (Recharts) |
| `/medico/pacientes` | Lista de pacientes com filtros avançados |
| `/medico/pacientes/[id]` | Prontuário com 7 abas |
| `/medico/pacientes/novo` | Cadastro de novo paciente |
| `/medico/agenda` | Integração Google Calendar |
| `/medico/chat` | Chat com pacientes (Pusher) |
| `/medico/jornada` | Kanban CRM da jornada do paciente |
| `/medico/triagem` | Triagens recebidas |
| `/medico/recompra` | Gestão de recompras |
| `/medico/notificacoes` | Central de notificações |
| `/medico/perfil` | Perfil do médico |
| `/medico/configuracoes` | OAuth Google, preferências |

#### 7 Abas do Prontuário (`/medico/pacientes/[id]`)
1. **Anamnese** — Histórico clínico completo
2. **Dosagem** — Prescrição atual e cálculo de estoque
3. **Evolução** — Registros evolutivos (positiva / estável / negativa)
4. **Documentos** — Upload e controle de validade
5. **Exames** — Laudos laboratoriais
6. **Gráficos** — Visualizações Recharts do tratamento
7. **Relatórios** — Geração de PDF para download

### Área do Paciente (`/paciente`)
| Rota | Descrição |
|------|-----------|
| `/paciente` | Painel com resumo do tratamento |
| `/paciente/medicamentos` | Dosagem ativa |
| `/paciente/calculadora` | Calculadora de dosagem |
| `/paciente/documentos` | Documentos pessoais com validade |
| `/paciente/chat` | Chat com médico |
| `/paciente/recompra` | Solicitar recompra de medicamento |
| `/paciente/notificacoes` | Notificações recebidas |
| `/paciente/perfil` | Dados pessoais |
| `/paciente/configuracoes` | Preferências e LGPD |

### Área Admin (`/admin`)
| Rota | Descrição |
|------|-----------|
| `/admin` | Visão geral da plataforma |
| `/admin/usuarios` | Gestão de usuários |
| `/admin/medicos` | Gestão de médicos |
| `/admin/triagens` | Triagens recebidas |
| `/admin/recompras` | Gestão de recompras |
| `/admin/invoices` | Faturas médicas |
| `/admin/mensagens` | Chat administrativo |
| `/admin/auditoria` | Logs de auditoria LGPD |
| `/admin/atribuir-medico` | Atribuição de médicos a pacientes |
| `/admin/perfil` | Perfil administrativo |
| `/admin/configuracoes` | Status de integrações |

### API Routes
| Rota | Descrição |
|------|-----------|
| `/api/webhooks/clerk` | Sync de usuários Clerk → banco (valida Svix) |
| `/api/webhooks/google` | Callback OAuth Google |
| `/api/pusher/auth` | Autorização de canais privados Pusher |
| `/api/upload-documento` | Upload de documentos (Vercel Blob) |
| `/api/upload-exame` | Upload de exames |
| `/api/upload-relatorio` | Upload de relatórios |
| `/api/inngest` | Handler do Inngest (background jobs) |
| `/api/invoices` | Geração e listagem de invoices |
| `/api/auth/callback` | Callback OAuth Google Calendar |
| `/api/cron/verificar-validade-documentos` | Cron diário 09h |
| `/api/cron/verificar-recompra-medicamentos` | Cron diário 09h |
| `/api/cron/verificar-revisoes-dosagem` | Cron diário 09h |

## Deploy na Vercel

1. Importe o repositório no painel da Vercel
2. Framework: **Next.js** (auto-detectado)
3. Install command: `pnpm install --frozen-lockfile`
4. Build command: `pnpm build`
5. Region: **gru1** (São Paulo)
6. Configure todas as variáveis de ambiente
7. Adicione o domínio `be4hope.org`

Veja `docs/integracoes.md` para documentação detalhada de cada serviço.

## LGPD

- ✅ Logs de auditoria em todas as operações sensíveis
- ✅ Soft delete em entidades clínicas e documentais
- ✅ Dados clínicos acessíveis apenas pelo médico responsável
- ✅ Validação de permissões por role em todas as Server Actions
- ✅ Validação de payloads com Zod em actions e route handlers
- ✅ Webhooks do Clerk validados com assinatura Svix

## Licença

Projeto privado — Be4Hope © 2026. Todos os direitos reservados.
