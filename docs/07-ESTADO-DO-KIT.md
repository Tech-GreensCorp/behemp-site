# Estado do método de documentação no repositório — o que entrou, o que falta, e o que não entra

> Auditado em 19/08/2026. O kit ficava em `docs/kit-claude-code/` — **removido em
> 19/08/2026, depois de integrado** (Item 17). Continha **8 docs de método ·
> 6 templates (um com 15 arquivos) · 24 skills · 1 `CLAUDE.md` template**.
>
> 🎯 O kit não se copia: se **adapta**. Copiar sem adaptar instala caminhos que não
> existem e comandos que não rodam — e o modelo os segue com confiança.

---

## 1. O que já entrou (19/08/2026)

| peça do kit | como entrou aqui |
|---|---|
| formato de ADR (doc 03) | `docs/adr/` com o formato documentado — **vazia**, aguardando a primeira decisão deste projeto |
| `templates/CHECKLIST-MESTRE.md` | [`03-CHECKLIST-MESTRE.md`](03-CHECKLIST-MESTRE.md), com baseline e fila |
| `templates/LISTA-DE-AFAZERES.md` | [`04-LISTA-DE-AFAZERES.md`](04-LISTA-DE-AFAZERES.md), **5 itens** diagnosticados |
| `templates/HANDOFF-SESSAO.md` | [`05-HANDOFF-SESSAO.md`](05-HANDOFF-SESSAO.md) |
| catálogo de regras com ID citável (doc 01 §7) | [`02-CATALOGO-DE-REGRAS.md`](02-CATALOGO-DE-REGRAS.md) — formato e prefixos prontos, **nenhuma regra transcrita ainda** |
| índice "abra quando" (doc 06 §4) | bloco acrescentado ao `CLAUDE.md` da raiz |
| `CLAUDE.md` template | ❌ **não copiado, por decisão** — o da raiz só recebe acréscimo |

## 2. O que falta — 5 peças

| # | peça | onde vai | escopo | sprint |
|---|---|---|---|---|
| 1 | **6 skills** (não 21) + 1 hook + 2 regras | `.claude/skills/`, `.claude/settings.json`, `CLAUDE.md` | repo | 0 · [08-AVALIACAO-DAS-SKILLS](08-AVALIACAO-DAS-SKILLS.md) |
| 2 | **Runner de teste (Vitest)** — `__tests__/guardas/` já existe | raiz | repo | prioridade 2 do checklist |
| 3 | regra escopada por `paths:` para área específica, se vier a ser útil | `.claude/rules/` | repo | sem data |
| 4 | ~~`templates/PRINCIPIOS.md`~~ | `docs/PRINCIPIOS.md` | repo | ✅ **feito em 19/08**, autorizado pelo dono |
| 5 | ~~`templates/arvore-do-conhecimento/`~~ | `docs/arvore-do-conhecimento/` | repo | ✅ **feito em 19/08** (raiz preenchida com a escala real; 14 ramos com *No projeto* vazio) |
| 6 | ~~técnica dos guardas~~ | `docs/TECNICA-DOS-GUARDAS.md` | repo | ✅ **feito em 19/08** — 🔴 era pré-requisito para apagar o kit |

Sobre 4 e 5: são material de estudo do projeto **inteiro**, não deste fluxo. Custo em
contexto é **zero** enquanto não são abertos (não entram no `CLAUDE.md`). Do kit,
preencher só a **pergunta-raiz** de `00-RAIZ.md` com a escala real pretendida; a
seção *"No projeto"* dos 14 ramos nasce vazia e cresce com evidência.

⚠️ As duas primeiras estão feitas; a terceira só entra quando houver área com convenção própria.

### O que NÃO entra, com motivo

| peça | motivo |
|---|---|
| os 8 docs de método do kit como doc do projeto | eram o **manual do método**, para humano. O que valia foi transplantado (`docs/TECNICA-DOS-GUARDAS.md`, `docs/PRINCIPIOS.md`, `docs/arvore-do-conhecimento/`, e as 6 skills); o resto saiu com a pasta |
| o ADR de exemplo do kit | o formato está no `docs/adr/README.md`, com as duas regras que fazem a ADR valer; exemplo genérico competiria com ele |
| tabela de guardas pré-preenchida | tabela com teoria treina o hábito de não ler. Nasce vazia e cresce ao primeiro guarda provado vermelho |

## 3. As 24 skills — mapa de instalação coerente

> ⚠️ **RETIFICADO em 19/08/2026.** O mapa desta seção (21 skills em 3 tiers) media
> **conflito de roteamento** e não media **se a skill adiciona algo que o Claude já não
> tem** — que é o critério da fonte primária da Anthropic. Reavaliado com esse critério,
> o número cai de **21 para 6**.
>
> 🔴 **A decisão válida está em [08-AVALIACAO-DAS-SKILLS](08-AVALIACAO-DAS-SKILLS.md).**
> Esta seção fica como registro do raciocínio anterior — a análise de colisão de nomes
> (§3.1) e as 190 substituições (§3.6) continuam válidas e são usadas por 08.

### 3.1 O problema real não é volume, é roteamento

Progressive disclosure faz o Claude ler só `name` + `description` no startup —
~100 tokens por skill. **24 skills custam ~2.400 tokens: barato.** O custo real é
**ambiguidade**: se um engenheiro humano não consegue dizer qual skill usar, o modelo
também não.

E aqui há três fontes de colisão, não uma:

| fonte | o que já ocupa o espaço |
|---|---|
| **7 agentes BeHemp** | `agente-arquiteto` · `agente-backend` · `agente-frontend` · `agente-qualidade` · `agente-seguranca` · `agente-anvisa` · `agente-icp-brasil` |
| **7 skills caveman** | `caveman` · `caveman-commit` · `caveman-review` · `caveman-compress` · `caveman-help` · `caveman-stats` · `cavecrew` |
| **built-ins do Claude Code** | 🔴 **`code-review`** · `simplify` · `security-review` · `init` · `run` |

> 🔴 **`code-review` do kit colide de nome com a skill built-in `code-review`.** Não é
> sobreposição semântica: é o mesmo nome. Tem de ser renomeada.

### 3.2 O que reduz o risco: `disable-model-invocation`

**10 das 24 skills já têm `disable-model-invocation: true`** — só rodam por invocação
explícita, então **não competem por roteamento**. Podem entrar como estão:

`grill-with-docs` · `handoff` · `implement` · `improve-codebase-architecture` ·
`setup-matt-pocock-skills` · `teach` · `to-spec` · `to-tickets` ·
`ubiquitous-language` · `writing-great-skills`

As outras 14 são auto-invocáveis, e é nelas que o roteamento pode quebrar.

### 3.3 Tier A — entram como estão (só ajuste de caminhos): 15

| skill | por que não conflita |
|---|---|
| `diagnosing-bugs` | nenhum agente cobre loop de diagnóstico |
| `tdd` | nenhum agente cobre test-first — ⚠️ trocar `jest` por Vitest |
| `git-guardrails` | nenhum agente cobre git — ⚠️ adaptar branches (§3.6) |
| `domain-modeling` | fixar termo e abrir ADR; `agente-arquiteto` decide onde código vive, não vocabulário |
| `grilling` | sabatinar plano; nada equivalente |
| `prototype` | protótipo descartável; nada equivalente |
| `research` | pesquisa em fonte primária; nada equivalente |
| `resolving-merge-conflicts` | nada equivalente |
| `handoff` · `to-spec` · `to-tickets` · `implement` · `grill-with-docs` · `writing-great-skills` · `ubiquitous-language` | invocação explícita apenas |

### 3.4 Tier B — entram com **rename** e/ou description reescrita: 6

| skill do kit | entra como | por quê |
|---|---|---|
| `code-review` | **`revisao-2-eixos`** | 🔴 colide com o built-in `code-review`. O nome novo diz o que é distinto: Standards do repo × Spec do pedido |
| `qa` | **`qa-catalogar`** | `agente-qualidade` responde *"está pronto? lint? build?"*; esta cataloga bug relatado em conversa na Lista de Afazeres. O nome novo separa as duas |
| `codebase-design` | mesmo nome, description delimitada | `agente-arquiteto` decide **onde** vive; esta dá vocabulário de *seam*/módulo profundo. A description precisa dizer isso explicitamente |
| `design-an-interface` | mesmo nome, description delimitada | `agente-frontend` implementa componente; esta gera **duas** propostas de interface e devolve em formato ADR |
| `request-refactor-plan` | mesmo nome, description delimitada | delimitar contra `agente-arquiteto` e `improve-codebase-architecture` |
| `setup-pre-commit` | mesmo nome, description com aviso | ⚠️ o portão é o **CI** o CI; pre-commit é complemento. E o kit pressupõe Husky+lint-staged+jest, que **não existem** aqui |

### 3.5 Tier C — não instalar agora: 3

| skill | motivo |
|---|---|
| `setup-matt-pocock-skills` | liga as skills ao tracker markdown. A Sprint 0 faz isso à mão, com os caminhos **certos** deste repo. Rodá-la depois sobrescreveria com os caminhos do kit |
| `teach` | cria diretório de estudo **fora do repo**; não é do fluxo. Instalar se e quando quiserem |
| `improve-codebase-architecture` | varre o repo inteiro por oportunidades de refator. 🔴 Neste momento isso é o oposto do pedido — o escopo é o fluxo novo, não melhorar o que existe. Instalar depois da Sprint 5 |

**Total: 21 instaladas · 3 fora, com motivo escrito.**

### 3.6 Adaptações obrigatórias — medidas, não estimadas

`grep` nas 24 `SKILL.md`:

| termo no kit | ocorrências | trocar por |
|---|---|---|
| `Docs/adr` | **46** | `docs/adr` |
| `LISTA-DE-AFAZERES` | **49** | `docs/04-LISTA-DE-AFAZERES.md` |
| `CHECKLIST-MESTRE` | **29** | `docs/03-CHECKLIST-MESTRE.md` |
| `develop` (branch GitFlow) | **19** | não existe aqui — produção é **`main`** (deploy por push), trabalho em `feat/*` |
| `jest` | **16** | **Vitest** (`pnpm test`) |
| `GLOSSARIO` | **13** | `docs/01-REGRA-DE-NEGOCIO.md` §1 e §5 |
| domínio do projeto de origem | **6** | 🔴 vocabulário de **outro projeto** — trocar pelo deste |
| `Doc 01` | **5** | `01-REGRA-DE-NEGOCIO.md` |
| `Doc 04` | **3** | `06-PADROES-DO-CODIGO.md` |
| `npm test` | **3** | `pnpm test` |

**190 substituições em 24 arquivos.** Mecânico e bem delimitado — cabe em passe único,
com revisão arquivo por arquivo das 6 ocorrências de domínio alheio.

### 3.7 Critério de aceite da instalação das skills

- [ ] Nenhuma `description` nova se confunde com a de outra — releitura **em bloco**
      das 21 + as 14 existentes + os built-ins
- [ ] Zero ocorrência de `Docs/adr`, `jest`, `develop` ou domínio antigo nas skills instaladas
- [ ] Nenhuma skill cita arquivo que não existe (checável por script)
- [ ] `revisao-2-eixos` e `qa-catalogar` renomeadas em `name:`, no diretório **e** nas referências cruzadas entre skills
- [ ] Teste de roteamento: dizer em voz alta a frase real do usuário e conferir que a skill acionada é a esperada — em especial *"revisa meu PR"* (built-in? `caveman-review`? `revisao-2-eixos`? `agente-qualidade`?)

> ⚠️ O último item é o que decide. Quatro candidatas para *"revisa meu PR"* é
> ambiguidade garantida — as descriptions precisam dizer, cada uma, **em que
> situação ela e não as outras**.
