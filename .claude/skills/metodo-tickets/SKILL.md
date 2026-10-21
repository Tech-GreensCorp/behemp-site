---
name: metodo-tickets
description: Quebra plano ou spec aprovado em itens executáveis com "Bloqueado por" em docs/04-LISTA-DE-AFAZERES.md, e põe os bloqueadores primeiro na fila do 03-CHECKLIST-MESTRE.md. Use ao transformar plano aprovado, sprint ou ADR em trabalho executável.
disable-model-invocation: true
---

# Quebrar plano em itens

Entrada: um plano, uma sprint ou uma ADR **já aprovada**. Saída: itens que uma sessão
nova consegue executar sem reabrir a discussão.

## O procedimento

1. **Um item = uma fatia vertical que se pode provar.** Não *"criar schema"* + *"criar
   tela"* como itens irmãos sem nada funcionando entre eles.
2. **Cada item declara `Bloqueado por:`** — outro item, uma resposta de terceiro
   (`GAP-nn`), ou nada. Item sem essa linha não entra.
3. **Bloqueadores primeiro na fila**, com o *por que este primeiro* escrito ao lado. A
   ordem é por **o que impede dano novo**, não por tamanho ou facilidade.
4. **O que depende de terceiro vai para `⏸️ Pendente de terceiro`**, com: o que se
   espera · de quem · desde quando · **o que fazemos enquanto não chega**. Misturar isso
   com o resto faz parecer que o time está parado quando está esperando.
5. **Cada item aponta a ADR** que o justifica. Item sem ADR é trabalho sem justificativa
   registrada — ninguém sabe se foi decidido ou improvisado.
6. **Critério de aceite por item**, verificável por comando quando possível.

## O que não fazer

- ⚠️ **Não criar item para o que uma ADR rejeitou por escopo.** Antes de quebrar,
  procure: `rg -l "rejeitado" docs/adr/`.
- ⚠️ **Não silenciar corte.** Se a quebra deixou algo de fora (top-N, amostragem, "fica
  para depois"), diga o que ficou e por quê — corte silencioso lê-se como cobertura total.
- ⚠️ **Não inventar default de negócio** para desbloquear um item. Vira `GAP-nn`.
