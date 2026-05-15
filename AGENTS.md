# AGENTS.md

## Contrato do projeto

- Este repositorio e a plataforma privada Be4Hope: telemedicina, acompanhamento clinico, documentos, chat, agenda, recompras e invoices.
- Trate dados de pacientes como sensiveis por padrao. Seguranca, escopo por role e auditoria valem mais que conveniencia.
- Seja direto. Teste premissas antes de concordar, aponte riscos cedo e nao invente comportamento que o codigo nao demonstra.

## Stack real

- Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui `base-nova`, Clerk, Drizzle ORM, Neon PostgreSQL, Brevo, Google Calendar/Sheets, Pusher, Inngest, Vercel Blob e Vercel.
- Use `pnpm`. Comandos principais: `pnpm dev`, `pnpm lint`, `pnpm format:check`, `pnpm build`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`.
- Alias de imports: `@/*`. Preserve os nomes e organizacao atuais salvo motivo concreto.

## Arquitetura

- Areas principais vivem em route groups: `app/(public)`, `app/(auth)`, `app/(admin)`, `app/(medico)` e `app/(paciente)`.
- Prefira Server Components. Use Client Components apenas para estado, eventos, hooks, browser APIs ou interatividade real.
- Em Server Components, busque dados direto na fonte (`db`, helpers, SDKs). Nao chame Route Handlers locais quando uma chamada direta evita round-trip.
- Server Actions ficam em `app/_actions` ou `_actions` do route group. Preserve o padrao `{ sucesso, dados?, erro? }` quando ja existir.
- Route Handlers sao para webhooks, uploads, cron, auth callbacks, Pusher, Inngest e respostas HTTP publicas.
- Depois de mutation que afete UI cacheada, use `revalidatePath` ou `revalidateTag` quando houver cache envolvido.

## Seguranca e LGPD

- Nunca confie no client. Toda leitura/mutation sensivel precisa validar input, auth e role no servidor.
- Valide payloads com Zod em Server Actions e Route Handlers. Erros retornados ao usuario devem ser seguros e sem stack trace.
- Clerk: middleware protege autenticacao global; checks de role pertencem a layouts, helpers e actions. Webhooks Clerk devem validar assinatura Svix.
- Nao envie o objeto completo de `currentUser()` ao client. Exponha apenas campos necessarios.
- Regras de escopo: `admin` gerencia a plataforma; `medico` acessa apenas pacientes vinculados; `paciente` acessa apenas os proprios dados.
- Registre auditoria para criar, atualizar, excluir e visualizar dados clinicos sensiveis quando aplicavel.
- Use soft delete em entidades clinicas/documentais que precisam preservar historico. Nao remova blobs se o historico precisar existir para auditoria.
- Segredos ficam em variaveis de ambiente e `lib/env.ts`. Nunca commite `.env` nem hardcode tokens.

## Banco e Drizzle

- Schemas ficam em `db/schema`; enums em `db/schema/enums.ts`; relations centralizadas em `db/schema/relations.ts`; exportacoes via `db/schema/index.ts`.
- Use `baseColumns` e `softDeleteColumn` quando a entidade seguir os padroes do dominio.
- Gere migrations com `drizzle-kit`; commite SQL, snapshots e journal juntos. Nao edite migration gerada manualmente sem explicar o motivo.
- Prefira query builder tipado do Drizzle. Use `sql` cru apenas para agregacoes/relatorios ou consultas que o builder nao expresse bem.
- Nunca concatene input em SQL. Use interpolacao parametrizada do Drizzle.
- Use transactions para operacoes multi-tabela que precisam ser atomicas.
- Sempre filtre `deletedAt IS NULL` em entidades com soft delete e preserve filtros de `medicoId`/`pacienteId` em dados clinicos.

## Integracoes

- O codigo usa Brevo para e-mail. Se docs citarem Resend, trate como documentacao desatualizada ate o codigo/env schema provarem o contrario.
- Google Calendar usa OAuth por medico e timezone `America/Sao_Paulo`.
- Pusher usa canais privados `private-chat-{grupoId}` e `private-user-{userId}`; autorizacao fica em `/api/pusher/auth`.
- Uploads via Vercel Blob devem validar tamanho, MIME type, nome seguro e permissao antes do envio.
- Cron routes devem validar `CRON_SECRET` quando configurado e evitar duplicidade de notificacoes.

## UI

- Preserve a direcao visual atual: editorial organico, fundo creme, terracota, verde musgo, Fraunces, Epilogue e JetBrains Mono.
- Use `components/ui`, `components/shared`, `cn()` e tokens de `app/globals.css` antes de criar estilos avulsos.
- Evite redesign generico. Mantenha acessibilidade, responsividade e estados de loading/erro/vazio.
- Prefira `next/image` para imagens novas quando aplicavel; respeite configuracao de dominios em `next.config.ts`.

## Qualidade

- TypeScript strict e sem `any` novo. `any` existente e divida tecnica, nao precedente.
- Nao desative ESLint/React Hooks sem justificativa pontual.
- Estado atual conhecido: `pnpm lint` falha com 117 erros e `pnpm format:check` falha em 233 arquivos. Nao diga que CI/build esta verde sem rodar e reportar o resultado real.
- Nao rode `pnpm format` global sem pedido explicito; ele reescreve muitos arquivos.
- Antes de finalizar mudancas de codigo, rode o menor conjunto relevante de checks e informe falhas existentes separadas das suas mudancas.
