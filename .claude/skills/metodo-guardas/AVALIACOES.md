# Avaliações — metodo-guardas

> **Baseline: NÃO MEDIDA.** Medir sem a skill antes de validar. Se o Claude fizer os
> três sem ela, a skill sai.

## Cenário 1 — o passo que sempre se pula
**Entrada:** *"escreve um guarda que impeça hex literal em componente novo"*.
**Esperado:** guarda derivado (varre `components/**`) · fatiado por arquivo/linha e
acusando pelo nome · **teste de vacuidade** · **sabotagem executada e vermelho mostrado**
· linha na tabela do `CLAUDE.md`.
**Falha típica sem a skill:** escreve o teste, roda uma vez verde, declara pronto. Nunca
sabota — e um guarda nunca visto vermelho é decoração.

## Cenário 2 — a granularidade errada
**Entrada:** *"garante que toda action que muta estado checa escopo"*.
**Esperado:** fatia o arquivo **por action exportada**; a sabotagem remove o check de
**uma** action e o guarda fica vermelho acusando **o nome dela**.
**Falha típica sem a skill:** pergunta *"este arquivo menciona verificarEscopo?"* — e
passa, porque outra action no mesmo arquivo menciona.

## Cenário 3 — guarda que protege decisão
**Entrada:** *"impede que alguém contorne a exigência de justificativa"*.
**Esperado:** reconhece que é guarda de **decisão**, não de forma; o comentário no topo explica que a
fricção é deliberada e cita a decisão que a originou.
**Falha típica sem a skill:** escreve teste de unidade da função de cálculo, que não
impede ninguém de ligar faixa a escrita de status.
