# CLAUDE.md

Siga primeiro `AGENTS.md`. Este arquivo define apenas o modo operacional do Claude neste repositorio.

## Modo de trabalho

- Seja conciso, tecnico e critico. Nao concorde por padrao; teste o ponto fraco da ideia antes de endossar.
- Antes de editar, rode exploracao suficiente: `git status --short --branch`, `rg`/leitura dos arquivos afetados e confirmacao dos padroes existentes.
- A worktree pode estar suja. Nunca reverta, formate ou reescreva mudancas que voce nao fez sem pedido explicito.
- Prefira mudancas pequenas e localizadas. Nao corrija dividas tecnicas fora do escopo apenas porque apareceram durante a tarefa.

## Docs e ferramentas

- Use Context7 quando comportamento atual de biblioteca importar, especialmente Next.js, React, Clerk, Drizzle, Tailwind, shadcn/ui, Inngest ou SDKs externos.
- Use `rg` para busca e `apply_patch` para edicoes focadas. Evite scripts de rewrite salvo quando a mudanca for mecanica e bem delimitada.
- Nao use comandos destrutivos (`git reset --hard`, `git checkout --`, remocao recursiva) sem autorizacao explicita.
- Se precisar rodar checks, prefira comandos especificos antes de comandos globais caros.

## Padrao de implementacao

- Fluxo seguro para mutation: autenticar/autorizar, validar com Zod, checar escopo por role, executar DB, registrar auditoria quando sensivel, disparar notificacao/revalidacao quando necessario.
- Em React 19, evite componentes declarados dentro do render, `setState` sincronico em effects e suppressions de hooks. Corrija a causa ou isole a interatividade.
- Em Server Components, mantenha `metadata` no arquivo server e extraia interatividade para componente client separado.
- Em Drizzle, prefira tipos inferidos (`$inferInsert`, `$inferSelect`) e query builder. Use `sql` cru com parametros, nunca string concatenada.
- Em arquivos de env/docs, trate `lib/env.ts`, `.env.example`, `package.json` e codigo de integracao como fontes de verdade quando houver divergencia.

## Validacao e entrega

- Para mudancas nestes arquivos de regras, valide com `pnpm format:check AGENTS.md CLAUDE.md` quando o Prettier aceitar os paths.
- Para mudancas de codigo, rode no minimo `pnpm lint` quando plausivel; rode `pnpm build` quando tocar rotas, schemas, env, auth, Next config ou fluxo server.
- Se um check falhar por baseline existente, reporte isso claramente e cite exemplos; nao esconda a falha.
- Antes de responder, confira `git diff -- AGENTS.md CLAUDE.md` ou o diff dos arquivos tocados para garantir que o escopo foi respeitado.
