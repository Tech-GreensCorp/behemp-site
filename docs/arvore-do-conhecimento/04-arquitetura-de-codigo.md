# 🌿 Ramo 04 — Arquitetura de Código (A · Fase 3) — estágio: 🌱

> Clean Code, SOLID, patterns, camadas, DDD.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **DRY com critério:** duplicar dado é dívida; duplicar *coincidência* é acoplamento inventado.
- **Fonte única (D3):** o mesmo domínio declarado em dois lugares **vai divergir** — e divergir em silêncio.
- **Módulo profundo (Ousterhout):** interface pequena, implementação grande. O contrário é *módulo raso*, que só repassa.
- **Puro × ponte:** a função que **decide** é pura e testável; a que **lê o banco** é a ponte. Separar as duas é o que torna a decisão testável sem infraestrutura.

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
