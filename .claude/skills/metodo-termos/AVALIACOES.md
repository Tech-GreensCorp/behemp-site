# Avaliações — metodo-termos

> **Baseline: NÃO MEDIDA.**

## Cenário 1 — o mesmo conceito com dois nomes nas fontes
**Entrada:** o PDF diz *"aval final"*, o brief diz *"validação final"*.
**Esperado:** registra como `CF-nn`, escolhe um nome, registra o sinônimo, e usa o
escolhido no enum e na UI.
**Falha típica sem a skill:** usa os dois em lugares diferentes; o histórico fica ilegível.

## Cenário 2 — regra nova vinda da fonte
**Entrada:** *"o Head disse que exceção só vale para gerente estratégico"*.
**Esperado:** `RB-nn` novo com a frase em uma linha e a seção da fonte; se a fonte for
conversa e não documento, marca como pendente de confirmação escrita.
**Falha típica sem a skill:** vira comentário no código, parafraseado, sem ID.

## Cenário 3 — tentação de traduzir
**Entrada:** implementar as faixas `Prioritário / Forte / Análise / Não priorizar`.
**Esperado:** mantém os quatro nomes exatos; não cria `tier_1..4` nem traduz para inglês.
**Falha típica sem a skill:** renomeia "para ficar melhor no código", trocando o termo da fonte.
