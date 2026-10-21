# Precedência das instruções, e o que a sessão não descobre sozinha

> Regra **sem `paths:`** de propósito. A doc oficial diz que *"Project-root CLAUDE.md and
> unscoped rules"* são **re-injetados do disco** depois de `/compact`, enquanto regra com
> `paths:` e `CLAUDE.md` de subdiretório *"load into message history when their trigger file
> is read, so compaction summarizes them away"*. Isto aqui precisa sobreviver à compactação.
> Fonte: `code.claude.com/docs/en/context-window` e `/docs/en/memory`.

## 1. Ordem de precedência quando duas instruções divergem

A doc é explícita sobre o risco: *"If two rules contradict each other, Claude may pick one
arbitrarily."* Então a ordem está escrita, para não haver escolha arbitrária:

| # | fonte | quando vence |
|---|---|---|
| 1 | **o código** | sempre, sobre qualquer doc, quando a doc descreve comportamento |
| 2 | `docs/adr/` | decisão de arquitetura e o que foi rejeitado |
| 3 | `docs/06-PADROES-DO-CODIGO.md` | padrão medido do repositório |
| 4 | `docs/DECISOES_TECNICAS.md` (DT-001…010) | infraestrutura e deploy |
| 5 | `CLAUDE.md` | modo de trabalho e proibições |
| 6 | `AGENTS.md` | contrato geral — **e é o que envelhece primeiro** |

## 2. 🔴 Onde o `AGENTS.md` está desatualizado

`AGENTS.md` entra em toda sessão por causa do `@AGENTS.md` no `CLAUDE.md`. Isso é
proposital — sem o import ele **não** era carregado (*"Claude Code reads CLAUDE.md, not
AGENTS.md"*). Mas carregou junto três afirmações que o código contradiz:

| `AGENTS.md` afirma | o código mostra | vale |
|---|---|---|
| heading em **Fraunces** | `app/globals.css:19-20` → `--font-heading: var(--font-outfit)` | **Outfit** |
| *"Prefira Server Components"* | 11 de 16 páginas de `(admin)` são `'use client'` | o critério de `06-PADROES` §6 |
| deploy na **Vercel** | AWS EC2 + PM2 + GitHub Actions (DT-006, DT-008) | **EC2** |

⚠️ **Não corrigir o `AGENTS.md` sem autorização** — ele é bloqueado pelo hook
`escopo-autorizado` de propósito, e a correção é trabalho próprio. Até lá, vale a tabela.

## 3. O que a sessão nova NÃO descobre sozinha

Skills com `disable-model-invocation: true` **não aparecem** na listagem de startup — a doc:
*"They stay completely out of context until you invoke them with `/name`."* Portanto, estas
duas existem e só rodam se você as chamar pelo nome:

- **`/metodo-handoff`** — reescreve `docs/05-HANDOFF-SESSAO.md`. Use ao fim de sessão longa.
- **`/metodo-tickets`** — quebra plano ou sprint em itens executáveis com *"Bloqueado por"*.

As outras quatro (`metodo-catalogar-bug`, `metodo-guardas`, `metodo-diagnosticar`,
`metodo-termos`) aparecem na listagem e podem ser acionadas por descrição.

⚠️ **Corpo de skill é truncado depois de `/compact`** — 5.000 tokens por skill, 25.000 no
total, e *"truncation keeps the start of the file"*. Instrução importante fica **no começo**
do `SKILL.md`, nunca no fim.

## 4. Orçamento de instrução

`/context` mostra o que carregou, sob **Memory files**. Medido em 20/08/2026: **~390 linhas**
de instrução por sessão (`CLAUDE.md` 199 + `AGENTS.md` 66 por import + estas duas regras). O
alvo documentado é *"under 200 lines per CLAUDE.md file"* — por arquivo está cumprido; o total
é o número a vigiar, porque *"bloated CLAUDE.md files cause Claude to ignore your actual
instructions"*.

⚠️ **Instrução que não muda comportamento deve ser apagada, não acumulada.** E o que precisa
acontecer sempre, sem exceção, vira **hook**: `CLAUDE.md` é conselho, hook é bloqueio.
