# 🌿 Ramo 05 — Back-end e API (M, G, D · Fase 4) — estágio: 🌱

> Linguagem em profundidade, REST, status HTTP, OpenAPI.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **Status HTTP com intenção:** 400 sintaxe · 401 não autenticado · 403 autenticado sem permissão · 404 não existe **ou não é seu** · 409 conflito de estado · 422 semântica inválida.
- **Whitelist de escrita:** aceitar o corpo cru é *mass assignment*. Mas ⚠️ whitelist incompleta com `stripUnknown` **descarta em silêncio**.
- **Idempotência:** a mesma requisição duas vezes produz o mesmo estado.

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
