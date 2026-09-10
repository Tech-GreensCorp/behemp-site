# 🌿 Ramo 06 — Banco de Dados (F · Fase 5) — estágio: 🌱

> Modelagem, normalização, índices, migrations, escala.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **Índice:** acelera leitura, encarece escrita. Índice que a consulta não usa é só custo — e a consulta precisa usar **a mesma expressão** do índice, senão o planejador o ignora em silêncio.
- **Migration:** pequena, versionada, idempotente (`IF NOT EXISTS`). Uma por mudança.
- **Transação:** ou tudo, ou nada. Meia-atualização deixa o sistema contraditório consigo mesmo.
- ⚠️ Identificador SQL com hífen é inválido — `_`, nunca `-`.

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
