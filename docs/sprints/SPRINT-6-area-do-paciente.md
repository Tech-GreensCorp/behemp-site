# Sprint 6 — Área do paciente: diário, dose e resumo

> **Objetivo:** quando esta sprint acabar, o paciente registra como está se sentindo entre
> consultas, entende a dose que toma e vê seu progresso — e esses dados voltam para a titulação
> do médico.

**ADRs:** [ADR-0004](../adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) D-01 ·
[ADR-0005](../adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) · princípio **P6**
(cada destinatário vê uma versão).

**Por que esta sprint existe:** a literatura de canabidiol coleta medidas _"at baseline, again
after titration (~2 semanas), and then monthly"_. Sem um canal do paciente, essas medidas só
existem no dia da consulta — e a titulação fica cega entre uma e outra.

## Entregáveis

| #   | entregável                                                                                        | referência    |
| --- | ------------------------------------------------------------------------------------------------- | ------------- |
| 1   | **Diário / check-in**: as mesmas medidas do baseline, respondidas pelo paciente                   | ADR-0004 D-01 |
| 2   | Histórico do diário, com a evolução no tempo                                                      | —             |
| 3   | **Dose atual e titulação** para o paciente: o que tomar, quanto, quando, e o histórico de ajustes | ADR-0005      |
| 4   | Aviso de **fim de frasco** a partir de `dataFimPrevista`                                          | `dosagens`    |
| 5   | **Resumo de saúde sanitizado** — progresso contra os objetivos declarados                         | P6            |
| 6   | Ações rápidas com deep link para o que o paciente pode fazer                                      | P7            |
| 7   | As medidas do diário aparecem para o médico **na tela de ajuste de dose** — é o que fecha o ciclo | Sprint 5      |

## Critério de aceite

- [ ] 🔴 `rg` prova que **nenhuma** superfície do paciente expõe hipótese, confiança, raciocínio ou conteúdo não revisado
- [ ] paciente só vê o que o médico validou
- [ ] paciente A não alcança dado do paciente B — testado com id alheio, não só com papel certo
- [ ] o check-in do paciente aparece no ajuste de dose do médico, com data e origem
- [ ] leitura de dado clínico registra auditoria
- [ ] quatro estados · dois temas · **telefone primeiro** — o paciente usa celular
- [ ] linguagem sem jargão: o paciente lê "dose" e "frasco", não "titulação" e "posologia"

## Não entra

- Qualquer conteúdo de IA para o paciente. Nem resumo gerado, nem sugestão. **Nunca**, nem na Metade 2, sem decisão própria.
- Chat ou mensagem nova — `grupos-chat` e `mensagens` já existem.
- Telas de exame para o paciente — Sprint 7.

## Bloqueios

`GAP-12` (quais escalas) — o diário mede **as mesmas** do baseline, então depende da mesma
resposta.

⚠️ **Esta é a sprint com maior risco de LGPD da Metade 1**, porque cria superfície nova para o
titular. Toda tela responde por escrito, antes de existir: quem pode ler · quanto tempo fica ·
o acesso é auditado.

---

## 🛑 PRÉ-REQUISITOS — decididos em 25/08/2026 (`DO-52`, `DO-53`)

**Esta sprint NÃO começa** enquanto as quatro etapas abaixo não terminarem. Não é formalidade:
é a ordem que evita construir a área do paciente sobre cinco sprints cuja única prova de
funcionamento é estrutural.

> _"a área do perfil do paciente fica após QA das telas e visualização das telas"_ (`DO-52`)

| #   | etapa                   | estado                  |
| --- | ----------------------- | ----------------------- |
| A   | Mapear os dados do seed | ⏳                      |
| B   | Escrever o seed         | ⏳                      |
| C   | QA de ponta a ponta     | ⏳ — cartão 7 do Trello |
| D   | Visualizar as telas     | ⏳                      |

**Por que o seed precede o QA** (`DO-53`): o produto tem um encadeamento de bloqueios — paciente
sem triagem não chega à teleconsulta, sem consentimento dos dois lados a sala não abre, sem
conduta não há plano vigente nem curva de titulação. Um QA sem dado **falha por estado vazio**, e
estado vazio é indistinguível de bug para quem testa.

**Por que o mapeamento precede o seed:** seed é código. Escrever primeiro e descobrir o que falta
depois produz duas rodadas.

Justificativa completa, com 6 rejeitados, em
[ADR-0014](../adr/ADR-0014-o-qa-de-ponta-a-ponta-precede-a-sprint-6.md).

⚠️ **O bloqueio anterior continua valendo:** `GAP-12` — quais escalas entram no diário. O diário
precisa medir **as mesmas** do baseline, senão não há série comparável. Isso é decisão do médico,
e entra no cartão único de GAPs (`DO-54`).
