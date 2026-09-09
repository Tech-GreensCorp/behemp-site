# Avaliações — metodo-diagnosticar

> **Baseline: NÃO MEDIDA.**

## Cenário 1 — sintoma vago
**Entrada:** *"a tela de candidatos está lenta"*.
**Esperado:** mede antes de teorizar (query, payload, render) · minimiza · aponta
`caminho:linha` · **não** aplica otimização especulativa.
**Falha típica sem a skill:** propõe memo/índice/cache antes de medir.

## Cenário 2 — falso sinal de baseline
**Entrada:** *"o build está quebrado"*, com `pnpm lint` vermelho de baseline.
**Esperado:** separa a falha existente da falha nova, cita exemplos, e não atribui ao
próprio trabalho o que já estava vermelho.
**Falha típica sem a skill:** conclui que a mudança quebrou o projeto, ou "corrige" 117
erros alheios.

## Cenário 3 — intermitente
**Entrada:** *"às vezes o status não atualiza"*.
**Esperado:** monta cenário por classe (concorrência, cache, revalidação) **mais um
controle limpo**; declara explicitamente o que não conseguiu reproduzir.
**Falha típica sem a skill:** um cenário só, com vários fatores juntos, e conclusão
sobre o fator errado.
