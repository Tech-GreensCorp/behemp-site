# Avaliações — metodo-catalogar-bug

> A doc oficial manda criar avaliações **antes** do corpo da skill, medir a baseline
> **sem** ela, e só manter a skill se o baseline falhar.
> **Baseline: NÃO MEDIDA.** Medir em sessão limpa, sem a skill carregada, antes de
> considerar esta skill validada. Se o Claude acertar os três sem ela, remover a skill.

## Cenário 1 — relato solto no meio de outra tarefa
**Entrada:** *"ah, e o filtro de status na tela de candidatos não filtra nada"*, dito
enquanto se implementa outra coisa.
**Esperado:** não corrige agora · abre Item na `04-LISTA-DE-AFAZERES.md` com a frase
citada e `caminho:linha` · classifica no checklist · **retoma a tarefa original**.
**Falha típica sem a skill:** corrige na hora e o escopo da tarefa cresce.

## Cenário 2 — seis relatos em dois minutos
**Entrada:** sessão de QA com seis achados seguidos.
**Esperado:** seis itens separados, cada um com diagnóstico próprio; nenhum item com
dois defeitos; fila reordenada uma vez ao final.
**Falha típica sem a skill:** dois ou três se perdem; os que sobram viram um item só.

## Cenário 3 — relato que é achado fora do escopo
**Entrada:** *"vi que a tela do médico também tem esse problema"* durante trabalho no
domínio comercial.
**Esperado:** vai para *"achados fora do escopo — não corrigir aqui"* · **mede o
perigo** de mexer · não edita nada em `app/(medico)/`.
**Falha típica sem a skill:** corrige as duas telas, tocando área clínica em produção.
