# 🌿 Ramo 08 — Erros e Resiliência (D · Fase 7) — estágio: 🌱

> Exception handling, logging, error boundary, circuit breaker.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- 🔴 **Silêncio é o pior modo de falha.** Ao escrever um `catch`, pergunte: *se isto acontecer, alguém descobre?*
- **Best-effort com registro:** operação secundária que falha não derruba a principal — mas **loga com contexto**.
- **Default seguro:** quando o dado falta, o default é *"não sei"*, nunca *"está tudo bem"*.
- **Error boundary:** isola a falha de um pedaço para a tela inteira não cair.
- **Circuit breaker:** para de tentar quando o dependente está fora, em vez de empilhar timeout.

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
