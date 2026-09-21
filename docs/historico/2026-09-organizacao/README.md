# Arquivados em 21/09/2026 — organização da docs/

Movidos com `git mv`, conteúdo inalterado, banner no topo. Nunca fonte; história.

| arquivo | o que era | por que morreu | o que o sucedeu |
| --- | --- | --- | --- |
| BACKUP_LOG.md | log de backup e deploy de agosto (Vercel, Node 18 via .nvmrc) | o deploy é EC2/PM2 via deploy.yml desde 10/09 | `.github/workflows/deploy.yml` e a seção Deploy do CLAUDE.md |
| progresso.md | fases 0–12 do projeto, maio–agosto | o projeto passou a ser planejado em sprints e decidido em ADRs | `sprints/00-PLANO-DE-SPRINTS.md` e `adr/` |
| integracoes.md | inventário de integrações da fase inicial (Clerk pendente de chaves, Vercel Cron) | o Checklist de 10/09 mediu que os crons nunca rodaram no servidor atual; o inventário vivo é `lib/env.ts` e o CLAUDE.md | `02-CATALOGO-DE-REGRAS.md`, CLAUDE.md, `lib/env.ts` |

Regra: nada aqui é apagado. Mover para cá exige banner no arquivo, linha nesta tabela
e atualização do `00-LEIA-PRIMEIRO.md` no mesmo commit.
