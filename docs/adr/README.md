# Decisões de arquitetura — Be4Hope / BeHemp

> Uma ADR por decisão, numerada, **nunca apagada**. Decisão superada ganha
> `⛔ substituída pela ADR-00XX`, e a nova cita a antiga.

**Atualizado em 20/08/2026.** ⚠️ Este cabeçalho dizia _"vazia de propósito"_ — o que era
verdade antes de as 7 ADRs abaixo existirem, e passou a ser falso no mesmo dia. Uma ADR anterior
a estas era de um domínio que pertence a outro projeto e saiu do repositório; o registro dessa
remoção está em [`../05-HANDOFF-SESSAO.md`](../05-HANDOFF-SESSAO.md) §3.

| ADR                                                                    | decisão, em uma linha                                                                | status      |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------- |
| [0001](ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)      | o motor de IA continua em Python, serviço próprio na mesma máquina, por HTTP interno | ✅ aprovada |
| [0002](ADR-0002-ui-antes-da-inteligencia.md)                           | UI antes da inteligência, presa ao contrato real congelado como fixture              | ✅ aprovada |
| [0003](ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md)   | sistema visual é o da BeHemp; a lógica de construção é a do VidAI                    | ✅ aprovada |
| [0004](ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) | a anamnese é baseline longitudinal, não wizard que termina em diagnóstico            | 📋 proposta |
| [0005](ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md)      | conduta → prescrição **e** dosagem → titulação: cadeia sequencial                    | 📋 proposta |
| [0006](ADR-0006-como-a-saida-da-ia-aparece-na-tela.md)                 | confiança da IA em faixa categórica, nunca percentual                                | 📋 proposta |
| [0007](ADR-0007-consentimento-da-gravacao-de-teleconsulta.md)          | o consentimento da gravação é **do paciente**, versionado e revogável                | 📋 proposta |
| [0019](ADR-0019-ajuste-modulo-clinico.md)                              | o wizard segue rejeitado; o que falta é progresso na trilha e doc que não mente      | 📋 proposta |
| [0020](ADR-0020-ajustes-pre-QA.md)                                     | os três bloqueios do QA, em ordem de execução: Pusher, TURN e a fila sem processador | 📋 proposta |

🔴 **Quatro estão como proposta.** As 0004, 0005 e 0006 precisam de aceite antes das Sprints 3,
4 e 5. A **0007** nasceu da auditoria da Sprint 1 e depende de **texto do dono e decisão do
Jurídico** — ver a §4 dela.

⚠️ **Esta tabela está incompleta.** As ADRs **0008 a 0018** existem em disco e nunca foram
indexadas aqui — dívida registrada no `docs/03-CHECKLIST-MESTRE.md` em 10/09/2026. Até a
correção, `ls docs/adr/` é a fonte completa.

As decisões técnicas **anteriores** deste projeto não estão aqui: vivem em
[`../DECISOES_TECNICAS.md`](../DECISOES_TECNICAS.md), como **DT-001 a DT-010**. Elas
continuam válidas e citáveis. **Não migrar, não apagar** — o formato DT não tem seção de
rejeitados, e converter 350 linhas não traria ganho nenhum.

---

## O formato

```markdown
# ADR-00NN — {título que é uma AFIRMAÇÃO, não um tema}

> **Status:** 📋 proposta · ✅ aprovada em {data} · ⛔ substituída pela ADR-00XX
> **Contexto:** {o fato que forçou a decisão — de preferência medido}
> **Decisão:** {a decisão em uma frase, no indicativo}

## §1 — O que a medição provou

{números, não impressões. Se não há número, medir antes de escrever}

## §2 — As decisões

### D-nn — {a decisão, como afirmação}

**Rejeitado: {a alternativa}.** {Por que não, com o custo concreto de tê-la escolhido}

## §3 — O que fica rejeitado

{tabela recolhendo todas as rejeições}

## §4 — Como se prova

{os guardas que a ADR cria, com a condição de falha}

## §N — O que a implementação ensinou

{escrita DEPOIS. É a seção que impede a próxima sessão de reabrir a decisão com informação pior}
```

## As duas regras que fazem a ADR valer

1. 🔴 **Toda decisão tem pelo menos uma rejeitada.** Se você não consegue nomear a
   alternativa, provavelmente não decidiu nada — descreveu. Se a ADR não tem a palavra
   _"rejeitado"_ em nenhum lugar, ela é documentação de código.
2. **O valor não está no que foi decidido** — isso está no código, dá para ler. Está no que foi
   **rejeitado**, que só existe se alguém escreveu. É exatamente o que a próxima pessoa vai
   propor, com toda a boa-fé do mundo, seis meses depois.

## Quando abrir

**Abra:** vai escolher entre duas técnicas · a decisão tem custo de reversão · toca segurança,
dado pessoal ou dinheiro · alguém vai perguntar _"por que assim?"_ · você está **rejeitando**
algo que parece óbvio.

**Não abra:** renomear, mover arquivo, corrigir digitação, aplicar padrão já decidido.

⚠️ **Uma ADR pode existir sem uma linha de código** — e às vezes é melhor assim: a discussão
acontece no texto, onde mudar de ideia é grátis.
