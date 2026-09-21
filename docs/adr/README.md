# Decisões de arquitetura — Be4Hope / BeHemp

> Uma ADR por decisão, numerada, **nunca apagada**. Decisão superada ganha
> `⛔ substituída pela ADR-00XX`, e a nova cita a antiga.

🔴 **Toda ADR nova entra nesta tabela NO MESMO COMMIT que a cria. Índice atrasado é defeito,
não atraso.**

**Atualizado em 19/09/2026 — 23 ADRs, medidas em `docs/adr/`.**

⚠️ **Retificação, 19/09/2026.** O cabeçalho anterior dizia _"as 7 ADRs abaixo"_ e a tabela
listava 10; hoje existem **23**. A nota _"quatro estão como proposta"_ contradizia a própria
tabela, que já mostrava sete. E o status da **0004** estava escrito aqui como `📋 proposta`
enquanto o arquivo dela diz `✅ aprovada em 20/08/2026` — um índice que erra o status é pior
que um índice incompleto, porque quem lê acredita que a decisão ainda está aberta. As
afirmações antigas ficam registradas nesta nota; a tabela abaixo é derivada dos arquivos.

⚠️ E a retificação anterior fica, como foi escrita: este cabeçalho já dissera _"vazia de
propósito"_ — verdade antes de as primeiras ADRs existirem, falsa no mesmo dia. Uma ADR anterior
a estas era de um domínio que pertence a outro projeto e saiu do repositório; o registro dessa
remoção está em [`../05-HANDOFF-SESSAO.md`](../05-HANDOFF-SESSAO.md) §3.

| ADR                                                                                | título                                                                                                          | status                       | data       |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- | ---------- |
| [0001](ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)                  | O motor de IA continua em Python, como serviço próprio, e a BeHemp fala com ele por HTTP interno                | ✅ aprovada                  | 20/08/2026 |
| [0002](ADR-0002-ui-antes-da-inteligencia.md)                                       | A UI vem antes da inteligência, mas nasce presa ao contrato real do motor                                       | ✅ aprovada                  | 20/08/2026 |
| [0003](ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md)               | A UI importada nasce no sistema visual da BeHemp, e "superior" é definido por critério medível                  | ✅ aprovada                  | 20/08/2026 |
| [0004](ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md)             | A anamnese da BeHemp é o marco zero de um acompanhamento longitudinal, não um evento que termina em diagnóstico | ✅ aprovada                  | 20/08/2026 |
| [0005](ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md)                  | Conduta, prescrição, dosagem e titulação são uma cadeia sequencial, não alternativas                            | 📋 proposta                  | 20/08/2026 |
| [0006](ADR-0006-como-a-saida-da-ia-aparece-na-tela.md)                             | A saída da IA aparece como alternativas com confiança categórica, nunca como percentual                         | 📋 proposta                  | 20/08/2026 |
| [0007](ADR-0007-consentimento-da-gravacao-de-teleconsulta.md)                      | O consentimento da gravação é do paciente, versionado e revogável                                               | 📋 proposta                  | 20/08/2026 |
| [0008](ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md)                   | A mídia da teleconsulta passa por TURN contratado, com credencial efêmera                                       | ✅ aprovada                  | 20/08/2026 |
| [0009](ADR-0009-recomendacao-de-medicamento-informa-sem-posologia.md)              | A recomendação de medicamento lista opções ranqueadas e **nunca** posologia                                     | 📋 proposta                  | 24/08/2026 |
| [0010](ADR-0010-analise-assistida-e-uma-aba-do-sidebar-da-teleconsulta.md)         | A análise assistida é **mais uma aba** do sidebar da teleconsulta, com etapas dentro dela                       | ✅ decidida pelo dono        | 24/08/2026 |
| [0011](ADR-0011-a-divergencia-do-medico-alimenta-o-rag.md)                         | A divergência do médico alimenta o RAG, e o rascunho da revisão nunca se perde                                  | ✅ decidida pelo dono        | 24/08/2026 |
| [0012](ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md)           | O sistema avisa, o médico decide: como a cadeia da conduta se liga sem duas verdades                            | ✅ aceita                    | 25/08/2026 |
| [0013](ADR-0013-o-mapa-de-urgencia-mora-num-lugar-so.md)                           | O mapa de urgência mora num lugar só, e o quarto nível não vem de `urgencia`                                    | ✅ aceita                    | 25/08/2026 |
| [0014](ADR-0014-o-qa-de-ponta-a-ponta-precede-a-sprint-6.md)                       | O QA de ponta a ponta precede a Sprint 6, e o seed precede o QA                                                 | ✅ aceita                    | 25/08/2026 |
| [0015](ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md)           | O ChatPro entrega o link único, e o que o webhook diz nunca é verdade                                           | ✅ aceita e implementada     | 09/09/2026 |
| [0016](ADR-0016-o-cadastro-da-greens-chega-por-back-channel-e-so-o-token-viaja.md) | O cadastro da Greens chega por back-channel, e só o token viaja com o paciente                                  | 📋 proposta                  | 09/09/2026 |
| [0017](ADR-0017-o-bot-oferece-o-link-quando-falta-receita-nossa-ou-anvisa.md)      | O bot da BeHemp oferece o link quando falta receita nossa ou ANVISA                                             | 📋 proposta                  | 09/09/2026 |
| [0018](ADR-0018-o-bot-da-greens-usa-o-link-da-behemp-e-devolve-o-paciente.md)      | O bot da Greens usa o link da BeHemp, e devolve o paciente com o que faltava                                    | 📋 proposta                  | 09/09/2026 |
| [0019](ADR-0019-ajuste-modulo-clinico.md)                                          | Ajuste do módulo clínico: o que diverge do VidAI, o que está velho e o que falta                                | 📋 proposta                  | 10/09/2026 |
| [0020](ADR-0020-ajustes-pre-QA.md)                                                 | Ajustes que precedem o QA: o que trava, em que ordem, e o que não trava                                         | 📋 proposta                  | 10/09/2026 |
| [0021](ADR-0021-os-oito-fluxos-e-os-webhooks-entre-as-empresas.md)                 | Os oito fluxos, e os webhooks que ligam as duas empresas                                                        | 📋 proposta                  | 10/09/2026 |
| [0022](ADR-0022-conta-e-ficha-sao-dois-fatos-e-ninguem-liga-os-dois.md)            | Conta e ficha são dois fatos, e ninguém liga os dois                                                            | aceita · revisada 13/09/2026 | 12/09/2026 |
| [0023](ADR-0023-o-fluxo-da-receita-reusa-o-trilho-da-anvisa.md)                    | O fluxo da receita reusa o trilho da ANVISA, e não encosta nele                                                 | 📋 proposta                  | 14/09/2026 |

**Contagem, por status literal do arquivo:** ✅ aprovada 5 · 📋 proposta 11 · ✅ decidida pelo
dono 2 · ✅ aceita 3 · ✅ aceita e implementada 1 · aceita 1 = **23**.

⚠️ **Cinco palavras para dois estados.** _aprovada_, _aceita_, _decidida pelo dono_ e _aceita e
implementada_ significam todas "vale"; só _proposta_ significa "ainda não". A tabela reproduz o
que cada arquivo diz, sem uniformizar — **unificar o vocabulário é decisão do dono**, e mexeria
em 23 arquivos.

⚠️ **A 0023 é compartilhada com a Greens:** os §1–§8 são a nossa parte, o §9 é a deles, e o §10
é um menu de três opções ainda **pendente de aprovação**. Ela não descreve o que existe.

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
