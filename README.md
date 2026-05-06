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
| **E-mail** | Resend |
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
| `RESEND_API_KEY` | API key do Resend |
| `GOOGLE_CLIENT_ID` | ID do cliente Google OAuth |
| `GOOGLE_CLIENT_SECRET` | Secret do Google OAuth |
| `PUSHER_APP_ID` / `PUSHER_APP_SECRET` | Credenciais do Pusher |
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
│   ├── api/               # API routes (webhooks, cron, pusher, inngest)
│   └── layout.tsx         # Layout raiz
├── components/
│   ├── shared/            # Navbar, Footer, Sidebars
│   └── ui/                # Componentes shadcn/ui
├── db/
│   ├── schema/            # Schemas Drizzle (13 tabelas)
│   └── migrations/        # Migrations geradas
├── lib/
│   ├── auth/              # Permissões por role
│   ├── integrations/      # Clientes de serviços externos
│   └── utils/             # Cálculos puros (dosagem, validade)
├── docs/                  # Documentação interna
└── vercel.json            # Cron jobs Vercel
```

## Comandos

| Comando | Descrição |
|---------|-----------|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Build de produção |
| `pnpm lint` | Verificação de lint |
| `pnpm format` | Formatação de código |
| `pnpm db:generate` | Gerar migrations |
| `pnpm db:migrate` | Aplicar migrations |
| `pnpm db:studio` | Abrir Drizzle Studio |

## Rotas da Aplicação

### Área Pública
| Rota | Descrição |
|------|-----------|
| `/` | Home page |
| `/triagem` | Formulário de triagem |
| `/agendamento` | Agendamento de consultas |
| `/mundo-endocanabinoide` | Áreas de atuação |
| `/parceiros` | Parceiros (Greens) |
| `/entre-em-contato` | Contato + FAQ |

### Área do Médico (`/medico`)
| Rota | Descrição |
|------|-----------|
| `/medico` | Dashboard com gráficos |
| `/medico/pacientes` | Lista de pacientes com filtros |
| `/medico/pacientes/[id]` | Detalhe com 7 abas |
| `/medico/notificacoes` | Central de notificações |
| `/medico/configuracoes` | Perfil e integrações |

### Área do Paciente (`/paciente`)
| Rota | Descrição |
|------|-----------|
| `/paciente` | Painel com resumo do tratamento |
| `/paciente/medicamentos` | Dosagem e recompra |
| `/paciente/documentos` | Documentos com validade |
| `/paciente/chat` | Chat com médico |
| `/paciente/configuracoes` | Perfil e LGPD |

### Área Admin (`/admin`)
| Rota | Descrição |
|------|-----------|
| `/admin` | Visão geral da plataforma |
| `/admin/usuarios` | Gestão de usuários |
| `/admin/triagens` | Triagens recebidas |
| `/admin/auditoria` | Logs de auditoria LGPD |
| `/admin/configuracoes` | Status de integrações |

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
- ✅ Soft delete onde faz sentido clínico
- ✅ Dados clínicos acessíveis apenas pelo médico responsável
- ✅ Validação de permissões por role em todas as Server Actions

## Licença

Projeto privado — Be4Hope © 2026. Todos os direitos reservados.
