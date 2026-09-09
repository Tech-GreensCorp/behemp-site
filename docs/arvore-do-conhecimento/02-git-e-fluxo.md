# 🌿 Ramo 02 — Git e Fluxo de Trabalho (B · Fase 1) — estágio: 🌱

> Versionamento, branching, commits, review.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **Merge × rebase:** merge preserva a história real; rebase a reescreve. Rebase em branch compartilhada quebra o histórico de quem já puxou.
- **Conventional Commits:** `feat`/`fix`/`refactor`/`docs`/`chore`. A mensagem registra **o que o erro ensinou**, não só o que mudou.
- **GitFlow × Trunk-Based:** GitFlow para release datada; trunk-based para deploy contínuo. Escolher um, não misturar.
- ⚠️ `git checkout -f` **não remove arquivo não versionado** — `git clean -fd` para isso.

## 🚀 No projeto

> 🎯 **É esta seção que faz o ramo valer.** Sem ela, o ramo é resumo de tutorial —
> qualquer LLM produz. Com ela, é a memória do que **este** sistema decidiu.
>
> Uma linha por aplicação, **com o arquivo ou o commit**.

- {{o que aplicamos}} — `{{caminho/do/arquivo}}`
- {{a decisão que tomamos e por quê}} — ver ADR-00NN

## ⛰️ Próximo nível

{{O que falta para subir de estágio. Concreto: não "estudar mais", mas o
tópico específico e por que ele importa para a raiz.}}
