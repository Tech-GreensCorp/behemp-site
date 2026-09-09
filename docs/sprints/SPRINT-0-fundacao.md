# Sprint 0 — Fundação: medir o real e criar o portão

> **Objetivo:** quando esta sprint acabar, é possível **recusar** código ruim antes do deploy —
> hoje o único portão é `pnpm build` falhar, e `main` é produção com migration sem rollback.

**ADRs:** nenhuma nova. Executa os itens 1–3 da fila do
[`../03-CHECKLIST-MESTRE.md`](../03-CHECKLIST-MESTRE.md).

## Entregáveis

| # | entregável | referência |
|---|---|---|
| 1 | `pnpm install` executado; `node_modules` presente | `03` Baseline declarada |
| 2 | **Números reais** de `pnpm lint` e `pnpm format:check` escritos na Baseline, substituindo os 117/233 copiados do `AGENTS.md` | `03` |
| 3 | Runner de teste (**Vitest**) no `package.json`, com script `test` | `03` P2 |
| 4 | Guarda `hooks-de-escopo` migrado de bash para Vitest, **preservando os 34 casos**, em especial os 3 de falsa acusação | `__tests__/guardas/hooks-de-escopo.test.sh` |
| 5 | Portão no CI: lint, type-check e teste rodando **antes** do deploy | `.github/workflows/deploy.yml` · `04` Item 3 |
| 6 | O portão falha quando a baseline **piora**, não quando está vermelha | `03` |

## Critério de aceite

**Executada em 20/08/2026.** Cinco critérios; quatro cumpridos, um bloqueado por autorização.

- [x] `pnpm test` existe e roda — Vitest 4.1.11, ~1 s
- [x] os casos do guarda passam em Vitest, e as regressões de falsa acusação continuam cobertas
      — **35 casos** (os 34 originais + a REGRESSÃO 4, exigida pela sabotagem), **4** regressões
- [x] provar por **sabotagem** — **5 mutações**, uma por proteção dos dois hooks. 🔴 Na primeira
      rodada **um mutante sobreviveu** (`sem_heredoc` neutralizado, 34 casos verdes); o furo foi
      fechado e agora as 5 ficam vermelhas. Registro no topo do arquivo do guarda
- [x] os números da Baseline são resultado de comando executado nesta sprint, com a data — lint
      **210 erros**, Prettier **360 arquivos**, `tsc --noEmit` **0**; os dois primeiros
      desmentiram o `AGENTS.md` em +79 % e +55 %
- [x] um PR com erro de lint acima da baseline **não** passa no CI — provado localmente
      (1 erro novo → `211 > 210`, vermelho; removido → verde) e **ligado ao CI** (`DO-18`):
      `ci.yml` roda em PR e push de branch; o `deploy.yml` recebeu os mesmos 3 checks nos
      steps 5–7, **antes** do build, do rsync e do `pnpm db:migrate`. Autorizado por escrito,
      com granularidade de dois caminhos exatos. ⚠️ **Ainda não rodou no GitHub** — nada foi
      commitado (`DO-20`)

### O que ficou de pé, em comando

```
pnpm install                            node_modules presente
pnpm test                               37 casos, ~1 s
pnpm typecheck                          0 erros — portão ABSOLUTO
node scripts/conferir-baseline.mjs      falha só se PIORAR (tetos em baseline.json)
```

⚠️ **Três achados catalogados e não corrigidos:** o `.nvmrc` diz Node 18 e o Vitest 4 exige
`>=20` — quem der `nvm use` não roda teste. O `CLAUDE.md` passou de 205 a 212 linhas, acima do
alvo de 200. E o mais sério: **o hook `escopo-autorizado` só vê escrita por ferramenta**, então
`cat >` e `sed -i` via Bash escrevem em área clínica **sem bloqueio** — medido, com o perigo de
corrigir estimado, no `03`.

🔴 **Os dois guardas ficam** (`DO-19`), e a divergência entre eles agora é impossível em
silêncio: o `.ts` tem caso de **paridade** que falha nomeando o caso ausente.

## Não entra

- **Corrigir a baseline.** Medir não é consertar. Os 117/233 (ou o que for medido) continuam.
- Qualquer item de produto. Esta sprint não toca `app/`, `db/` nem `lib/`.
- Migrar `.nvmrc` 18 → Node 20 do CI: catalogado, não resolvido, **não mexer aqui**.

## Bloqueios

Nenhum de terceiro. É a única sprint do plano inteiramente sob nosso controle — por isso é a
primeira.

⚠️ **Todos os guardas das ADR-0002 e ADR-0003 dependem desta sprint.** Sem portão, guarda
escrito é documentação.
