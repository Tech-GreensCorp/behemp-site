# Avaliações — metodo-handoff

> **Baseline: NÃO MEDIDA.**

## Cenário 1 — sessão longa com check não rodado
**Esperado:** §8 diz explicitamente que `pnpm lint` **não** rodou e por quê; números de
baseline marcados como não reconferidos.
**Falha típica sem a skill:** §8 omitida, ou "tudo verde" sem ter rodado.

## Cenário 2 — sessão em que uma afirmação foi retratada
**Esperado:** a retratação aparece na §7, com a causa do erro.
**Falha típica sem a skill:** o erro desaparece do registro e a próxima sessão o repete.

## Cenário 3 — sessão que tomou decisões sem ADR
**Esperado:** §6 lista a decisão e **diz que ainda não é ADR**.
**Falha típica sem a skill:** decisão fica só na conversa e morre na compactação.
