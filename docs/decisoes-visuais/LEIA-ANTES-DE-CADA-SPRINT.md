# 🔴 Leitura obrigatória antes de cada sprint

> **Decisão do dono em 20/08/2026:** *"é estreitamente importante que esse doc seja lida sempre
> que nós formos fazer alguma sprint"*.

## `ia-clinica-e-anvisa.html`

Abra no navegador. É a página que reúne as três decisões abertas da demanda de IA clínica e,
mais importante, **a regra de desenho que sai delas**:

> **Nenhuma saída do modelo chega ao prontuário sem um ato humano registrado.**

Não é preferência de interface. É o que sustenta o argumento de que o sistema **informa** em vez
de **dirigir** a conduta — e essa distinção é o que o enquadramento de risco de software médico
observa (ANVISA RDC 657/2022). A tela é onde esse argumento fica visível ou desaparece.

### O que conferir, sprint por sprint

| antes de construir | pergunte |
|---|---|
| qualquer tela que mostre saída de IA | a origem de cada achado está rotulada? relato, registro anterior ou inferência do modelo? |
| qualquer tela que sugira conduta | existe um passo humano **obrigatório** antes do registro? ele é gravado com o nome de quem decidiu? |
| qualquer botão perto de uma sugestão | ele leva a um clique até a prescrição? se sim, está errado |
| qualquer tela de teleconsulta | o consentimento de **teleconsulta** (CFM Art. 15) foi pedido, além do de IA? |
| qualquer prescrição a distância | os 5 itens do CFM Art. 13 estão lá — inclusive **"emitido em modalidade de telemedicina"**? |

### Por que este arquivo existe em vez de só o `02`

O `02-CATALOGO-DE-REGRAS.md` guarda as regras com ID citável, e é a fonte. Esta página existe
porque **o diagrama comparativo de tela** — a que dirige × a que informa — comunica em dez
segundos o que o catálogo leva parágrafos para dizer. As duas coisas se complementam: a citação
vive no catálogo, o entendimento vive aqui.

⚠️ **Documento visual como este só se cria quando o dono pede** (`DO-30`). Este foi pedido.
