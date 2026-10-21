---
name: metodo-handoff
description: Reescreve docs/05-HANDOFF-SESSAO.md com as 8 seções do estado real da sessão, incluindo o que NÃO fazer na próxima e o que foi retratado. Use ao encerrar sessão longa, ao pedir handoff, ou ao dizer que vai trocar de chat.
disable-model-invocation: true
---

# Escrever o handoff

**A janela do chat é descartável; o disco é o artefato.** O registro que mais importa é
o da sessão que **não** chegou ao fim — escreva quando o levantamento fica pronto, não
quando o trabalho acaba.

Destino: `docs/05-HANDOFF-SESSAO.md` (reescrito, não acumulado).

## As 8 seções, todas obrigatórias

1. **O que está no ar agora** — ambiente, commit, desde quando, estado. Se houver
   divergência entre branches, diga qual — divergência não declarada faz alguém concluir
   que *"empurrei"* é *"subiu"*.
2. **Onde a sessão parou** — texto corrido, não bullets. O que estava sendo feito e em
   que ponto exato. Último commit e o que está pendente de commit.
3. **O que o dono vai fazer agora** — para não começar algo que vai conflitar.
4. **Pendências com prazo** — o quê · prazo · consequência de perder.
5. 🔴 **O que NÃO fazer nesta sessão** — a parte mais útil. Coisas que parecem boa ideia
   e não são, por razão que não está óbvia no código. Inclua o que foi **rejeitado por
   escopo** nas ADRs.
6. **Decisões tomadas nesta sessão** — uma linha por decisão, com link para a ADR. Se
   não virou ADR e devia, diga isso.
7. **O que a sessão aprendeu e não está no código** — medições, números, achados de
   investigação. É o que mais se perde quando a janela estoura.
8. **Estado da suíte** — comando, resultado real. Teste instável não declarado faz a
   próxima sessão rodar de novo até passar e concluir que está tudo bem.

## Regras

- **Reporte o que aconteceu, não o que se esperava.** Check que não rodou: diga que não
  rodou e por quê. Número copiado de doc: marque como **não reconferido**.
- **Retratação entra.** Algo reportado nesta sessão que se provou errado vai para a §7,
  por escrito — a próxima sessão não pode "consertar" um não-defeito.
- **O teste do handoff:** uma sessão nova, sem histórico, consegue retomar lendo só o
  disco? Se a resposta depende de *"a gente tinha combinado que…"*, falta seção.
- Atualize também a data do `03-CHECKLIST-MESTRE.md` se a fila mudou.
