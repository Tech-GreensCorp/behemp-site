# 🌿 Ramo 07 — Segurança (H · Fase 6) — estágio: 🌱

> OWASP, auth, segredos, dado pessoal.
> Sobe de estágio **só com evidência** — commit, doc ou decisão. Ver [a raiz](00-RAIZ.md).

## 🌱 Base

- **Segredos:** em variável de ambiente, nunca no Git. Vazou → **rotaciona**; apagar o commit não resolve, o histórico lembra.
- **JWT:** token assinado com claims; o servidor confia na **assinatura**, não no cliente.
- **OWASP A01 (Broken Access Control):** checar permissão **na API**, sempre. Esconder o botão não protege a rota.
- **API1:2023 (BOLA):** papel certo + id de **outro** registro. Toda rota que recebe id pergunta **de quem é**.
- **Fail Fast no boot:** o servidor **recusa subir** em produção com segredo de exemplo.

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
