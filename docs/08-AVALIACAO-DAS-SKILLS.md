# Avaliação das 24 skills do kit — quais entram, e com que fundamento

> Feita em 19/08/2026, a pedido do dono: *"antes de autorizar a implementação das
> skills novas ao .claude eu quero que você pesquise e fundamente se é realmente útil e
> necessário cada uma das 21 skills que entram, pois não quero contaminar o que eles ja
> usam no projeto."*
>
> 🔴 **Resultado: das 24, entram 6 skills.** Minha recomendação anterior (21) estava
> mal fundamentada — ela media *conflito de roteamento* e não media *se a skill
> adiciona algo que o Claude já não tem*. A fonte primária mede o segundo, e ele
> reprova a maioria.

---

## §1 — O critério, de fonte primária

Da doc de autoria de skills da Anthropic ([Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)),
a premissa que reprova quase tudo:

> **"Default assumption: Claude is already very smart."** *"Only add context Claude
> doesn't already have. Challenge each piece of information: 'Does Claude really need
> this explanation?' · 'Can I assume Claude knows this?' · 'Does this paragraph justify
> its token cost?'"*

E o processo que a doc prescreve antes de escrever qualquer skill:

> *"**Create evaluations BEFORE writing extensive documentation.** This ensures your
> Skill solves real problems rather than documenting imagined ones."*
> 1. *"**Identify gaps:** Run Claude on representative tasks **without** a Skill.
>    Document specific failures or missing context"*
> 2. *"**Create evaluations:** Build three scenarios that test these gaps"*
> 3. *"**Establish baseline:** Measure Claude's performance without the Skill"*

Sobre roteamento:

> *"The description is critical for skill selection: Claude uses it to choose the right
> Skill from potentially 100+ available Skills."* · *"Avoid … **inconsistent patterns
> within your skill collection**."*

E da doc de boas práticas do Claude Code ([Best practices](https://code.claude.com/docs/en/best-practices)),
duas frases que redirecionam peças inteiras do kit:

> *"For domain knowledge or workflows that are only relevant **sometimes**, use skills
> instead"* — o corolário é o inverso: **o que se aplica sempre vai para o `CLAUDE.md`,
> não para uma skill.**

> *"Use hooks for actions that must happen **every time with zero exceptions**. Unlike
> CLAUDE.md instructions which are **advisory**, hooks are **deterministic** and
> guarantee the action happens."*

### Os cinco testes que apliquei

| # | teste | reprova quando |
|---|---|---|
| 1 | **Lacuna** | o Claude já faz isso bem sem a skill |
| 2 | **Não-inferível** | o conteúdo é dedutível lendo o repo, ou é prática geral de engenharia |
| 3 | **Roteamento** | a `description` se confunde com outra skill instalada ou com um built-in |
| 4 | **Altitude** | é regra que vale **sempre** (→ `CLAUDE.md`) ou proibição que precisa ser **garantida** (→ hook) |
| 5 | **Efeito colateral** | tem efeito colateral e não usa `disable-model-invocation: true` |

> 🎯 O que sobra depois dos cinco testes tem uma característica em comum: **amarra um
> procedimento aos arquivos deste projeto.** *"Como diagnosticar um bug"* o Claude sabe.
> *"Um bug relatado vira Item NN em `04-LISTA-DE-AFAZERES.md` com `caminho:linha`, e a
> fila do `03-CHECKLIST-MESTRE.md` é atualizada no mesmo commit"* ele não tem como saber.

---

## §2 — Veredicto das 24

| skill do kit | veredicto | fundamento |
|---|---|---|
| `qa` | ✅ **entra** como `metodo-catalogar-bug` | amarra relato → item catalogado nos **nossos** arquivos. Passa 1 e 2 |
| `tdd` | ✅ **entra** como `metodo-guardas` | reescrita: nosso protocolo de guarda + sabotagem + Vitest. TDD genérico reprovaria no teste 1; **sabotagem obrigatória e granularidade do defeito** não |
| `diagnosing-bugs` | ✅ **entra** como `metodo-diagnosticar` | adaptada à realidade: sem suíte, baseline vermelha, EC2. Força catalogar antes de corrigir |
| `handoff` | ✅ **entra** como `metodo-handoff` | escreve as 8 seções do nosso `05-HANDOFF-SESSAO.md`. `disable-model-invocation` |
| `domain-modeling` + `ubiquitous-language` | ✅ **entram fundidas** em `metodo-termos` | duas skills para um trabalho é o "inconsistent patterns" que a doc proíbe. A fusão grava em `01-REGRA-DE-NEGOCIO` §1/§5 e no catálogo `FR`/`RB` |
| `to-tickets` | ✅ **entra** como `metodo-tickets` | quebra plano em itens com *"Bloqueado por"*, bloqueadores primeiro na fila. Amarra aos nossos dois arquivos |
| `git-guardrails` | 🔧 **vira hook** | *"hooks are deterministic … CLAUDE.md instructions are advisory"*. Uma skill que **pede** para não rodar `reset --hard` é conselho; um hook **impede**. Teste 4 |
| `research` | 📋 **vira regra no `CLAUDE.md`** | pesquisar antes de decidir vale **sempre**, não *"sometimes"*. Teste 4 |
| `resolving-merge-conflicts` | 📋 **vira regra no `CLAUDE.md`** | são duas proibições (*nunca `--abort`, nunca mexer em `main` sem o dono*), não um procedimento. 14 linhas. Teste 4 |
| `code-review` | ❌ **não entra** | 🔴 **colide de nome com o built-in `code-review`.** E *"revisa meu PR"* já tem 3 candidatas (`code-review` built-in, `caveman-review`, `agente-qualidade`). Teste 3 |
| `writing-great-skills` | ❌ **não entra** | refutada por citação direta: *"Claude models understand the Skill format and structure natively. **You don't need special system prompts or a 'writing skills' skill**"*. Teste 1 |
| `codebase-design` | ❌ | vocabulário de módulo profundo/*seam* (Ousterhout) que o Claude já domina. Teste 2 |
| `design-an-interface` | ❌ | o padrão *"let Claude interview you → SPEC.md"* está documentado como **prompt**, não skill; e sobrepõe `agente-arquiteto`. Testes 1 e 3 |
| `to-spec` | ❌ | mesma razão da anterior |
| `grilling` | ❌ | o comportamento já é regra permanente do `CLAUDE.md` deste repo (*"Nao concorde por padrao; teste o ponto fraco da ideia"*). Testes 1 e 4 |
| `grill-with-docs` | ❌ | 9 linhas, e duplica `grilling`. Teste 3 |
| `implement` | ❌ | 15 linhas que só apontam para outras skills — a doc alerta contra referência aninhada e contra conteúdo que não adiciona contexto. Testes 1 e 2 |
| `prototype` | ❌ | protótipo descartável colide com a regra de escopo deste projeto. Testes 1 e 4 |
| `request-refactor-plan` | ❌ | refator está fora do escopo autorizado agora |
| `improve-codebase-architecture` | ❌ | varre o repo buscando refator: o oposto do pedido |
| `setup-pre-commit` | ❌ | o portão é o CI; e pressupõe Husky/lint-staged/jest, **nenhum existe aqui** |
| `setup-matt-pocock-skills` | ❌ | religa as skills ao tracker com **os caminhos do kit** — desfaria a adaptação |
| `teach` | ❌ | cria diretório de estudo fora do repo; não é do fluxo |

**Contagem: 6 skills · 1 hook · 2 regras · 15 descartadas** (as 24 menos as 7 que
originam as 6 skills, menos as 3 realocadas… as fusões explicam a aritmética: 7 skills
do kit → 6 instaladas).

---

## §3 — As 6 que entram: nome, `description` e a lacuna que fecham

Nomeação: prefixo **`metodo-`**, formando um terceiro namespace coerente ao lado de
`agente-*` (os 7 do BeHemp) e `caveman-*`. A doc aceita *"noun phrases"* e exige
consistência interna; `name` só aceita minúsculas, números e hífen, e **não pode conter
"claude" nem "anthropic"**.

| skill | `description` (3ª pessoa, o que faz + quando usar) | lacuna medida |
|---|---|---|
| `metodo-catalogar-bug` | *"Converte relato de bug em Item catalogado em docs/04-LISTA-DE-AFAZERES.md, com diagnóstico e caminho:linha, e atualiza a fila do 03-CHECKLIST-MESTRE.md no mesmo commit. Use quando alguém relatar bug conversando, disser 'achei um problema', 'não está funcionando' ou pedir sessão de QA."* | sem ela, o Claude corrige na hora e 4 de 6 relatos se perdem |
| `metodo-guardas` | *"Escreve guarda estrutural em Vitest sob __tests__/guardas/, derivado do código, fatiado na granularidade do defeito, com teste de vacuidade, e prova vermelho por sabotagem antes de valer. Use ao corrigir bug, criar invariante ou pedir teste que impeça regressão de classe."* | o Claude escreve teste; **não** sabota o próprio guarda sem ser mandado |
| `metodo-diagnosticar` | *"Loop de diagnóstico com minimização, um cenário por classe de defeito e controle limpo, antes de qualquer correção. Use ao dizer que algo está quebrado, lento ou intermitente."* | sem ela, teoria antes de medição; e cenário composto que acusa doze coisas |
| `metodo-handoff` | *"Escreve as 8 seções de docs/05-HANDOFF-SESSAO.md com o estado real da sessão, incluindo o que NÃO fazer na próxima. Use ao encerrar sessão longa ou ao pedir handoff."* (`disable-model-invocation: true`) | o Claude não sabe as 8 seções nem o que preservar |
| `metodo-termos` | *"Fixa termo do domínio em docs/01-REGRA-DE-NEGOCIO.md e atribui ID citável no 02-CATALOGO-DE-REGRAS.md. Use ao definir vocabulário, discutir se dois nomes são a mesma coisa, ou registrar regra vinda das fontes."* | o ID citável e o guarda `idDeRegraExiste` são invenção deste projeto |
| `metodo-tickets` | *"Quebra plano ou spec em itens com 'Bloqueado por' na 04-LISTA-DE-AFAZERES.md e põe os bloqueadores primeiro na fila do 03-CHECKLIST-MESTRE.md. Use ao transformar plano aprovado em trabalho executável."* (`disable-model-invocation: true`) | a ordem por bloqueador e os dois arquivos são deste projeto |

### Teste de roteamento obrigatório antes de instalar

A doc é explícita: a `description` decide a seleção. Frases a testar em voz alta, e a
skill que **deve** responder:

| frase real | quem deve responder | quem **não** pode responder |
|---|---|---|
| *"revisa meu PR"* | `code-review` (built-in) | nenhuma `metodo-*` |
| *"achei um bug na tela de candidatos"* | `metodo-catalogar-bug` | `agente-qualidade` |
| *"isso está lento"* | `metodo-diagnosticar` | `metodo-catalogar-bug` |
| *"está pronto para merge? roda o lint"* | `agente-qualidade` | `metodo-*` |
| *"escreve um teste que impeça isso de voltar"* | `metodo-guardas` | `agente-backend` |
| *"onde eu crio essa tabela?"* | `agente-arquiteto` | `metodo-termos` |

⚠️ Se duas responderem, a `description` da perdedora está larga demais — **corrigir
antes de instalar a próxima.**

---

## §4 — O hook, e por que ele é melhor que a skill

`git-guardrails` protege contra `push --force`, `reset --hard`, `branch -D`. Como skill,
depende de o modelo lembrar de consultá-la. Como hook `PreToolUse`, **bloqueia**.

E o mesmo mecanismo resolve o pedido de escopo do dono. A própria doc dá o exemplo:

> *"Try prompts like … 'Write a hook that **blocks writes to the migrations folder**.'"*

Dois hooks propostos, a confirmar na Sprint 0:

| hook | bloqueia |
|---|---|
| `git-perigoso` | `reset --hard`, `push --force`, `branch -D`, `checkout --` sem autorização na mensagem |
| `escopo-autorizado` | escrita fora dos caminhos autorizados da tarefa em curso (o domínio comercial + as docs do fluxo), enquanto não houver autorização registrada |

⚠️ O segundo precisa de desenho cuidadoso: hook que bloqueia demais é hook que alguém
desliga — a mesma falha da Regra 2 dos guardas. Proposta: bloquear **escrita** fora da
allowlist, nunca **leitura**.

---

## §5 — O que valida a decisão depois

A doc manda medir, não supor. Portanto, para cada uma das 6:

1. **três cenários** de avaliação escritos **antes** do corpo da skill
2. **baseline sem a skill** registrada — se o Claude já acerta os três, a skill não entra
3. o corpo é **o mínimo** que faz os três passarem
4. `SKILL.md` abaixo de **500 linhas**, referências **um nível** de profundidade
5. reteste após uso real: *"observe how Claude navigates Skills"*

⚠️ **As 4 skills que o kit chama de "finas" (9 a 18 linhas) são exatamente as que
reprovaram** — `grill-with-docs`, `research`, `implement`, `handoff`. Três saíram;
`handoff` só sobreviveu porque será **reescrita** com as 8 seções do nosso arquivo. O
kit já suspeitava disso e chamou de *"funcionam como atalho, não como procedimento"*.

---

## Fontes

Lidas integralmente nesta sessão:

- [Skill authoring best practices — Anthropic](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Best practices for Claude Code — Anthropic](https://code.claude.com/docs/en/best-practices)

Localizadas por busca e **não** abertas integralmente — citadas apenas como existência,
não como fundamento:

- [Equipping agents for the real world with Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Writing effective tools for AI agents — Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [The Complete Guide to Building Skills for Claude — Anthropic (PDF)](https://resources.anthropic.com/hubfs/The-Complete-Guide-to-Building-Skill-for-Claude.pdf)

⚠️ A separação acima é deliberada: **citar fonte que não se leu é pior que não citar.**
