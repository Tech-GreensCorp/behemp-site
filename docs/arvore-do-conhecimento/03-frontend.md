# 🌿 Ramo 03 — Front-end (L · Fase 2) — estágio: 🌱

> HTML semântico, CSS, JS, framework + TypeScript.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **CSS:** `min-width: 0` só funciona em item de flex/grid; `grid-template-columns: minmax(0, 1fr)` contém independentemente do ancestral.
- **Assincronismo:** Promise, async/await, e por que `await` num laço é serial.
- **Estado:** updater funcional (`setX(prev => …)`) garante o valor atual; `ref` lê o do render anterior. E **updater tem de ser puro** — StrictMode o invoca duas vezes.

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
