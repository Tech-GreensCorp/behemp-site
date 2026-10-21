# Sprint 5 — Conduta, prescrição e titulação: a cadeia completa

> **Objetivo:** quando esta sprint acabar, uma conduta aprovada vira **documento legal** e
> **plano vigente**, e o ajuste de dose ao longo do tratamento fica registrado com motivo e
> próxima revisão — sem tocar no receituário que já funciona.

**ADRs:** [ADR-0005](../adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) (toda) ·
[ADR-0004](../adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) D-06.

## 🔴 O que mudou em 24/08/2026 — decisões do dono e as normas transcritas

**`DO-43`:** _"vamos fazer parecido com a do vidai so que adaptada para o escopo de cannabis"_ —
a lógica de construção do VidAI (`docs/09-FRONTEND-VIDAI-MEDIDO.md`, P1–P7), adaptada.

**`DO-44` resolve o `GAP-14`.** Todo ajuste de dose, sem exceção:

1. o médico **pode** ajustar — nenhum bloqueio
2. o **paciente é notificado**
3. o **anterior fica no histórico**, em **dois** lugares: histórico do paciente **e** histórico de
   prescrições **sob o nome do paciente**
4. a tela **separa por paciente**, com **filtro geral** de todos os medicamentos prescritos
5. desenho **intuitivo e não sobrecarregado** — _"nada muito cheio pra não bagunçar a mente do
   médico"_. Em tela que decide dose, densidade é risco clínico

A retificação completa está em [ADR-0005](../adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) D-03,
com a versão anterior preservada.

### 🔴 As três RDCs foram transcritas — e elas acrescentam entregável

| ID       | o que obriga                                                                                                        | o que muda aqui                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `CAN-00` | a **RDC 327/2019 está REVOGADA** pela **RDC 1.015/2026**, Art. 76                                                   | esta sprint citava norma morta. Corrigido                                                                                                  |
| `CAN-04` | ≤ 0,2 % THC → **Receita de Controle Especial**; > 0,2 % → **Notificação de Receita "A"**                            | 🔴 **o tipo de receituário é DERIVADO do teor de THC do produto** — não é escolha nem configuração. `medicamentos` precisa carregar o teor |
| `CAN-05` | THC > 0,2 % só para **doença debilitante grave** ou que ameace a vida (RDC 38/2013)                                 | a tela precisa impedir a oferta quando a condição não se qualifica — é o `DO-42` com força normativa                                       |
| `CAN-03` | a prescrição descreve **nome completo do produto e concentração**, conforme Autorização Sanitária                   | depende de catálogo validado — `GAP-03`                                                                                                    |
| `CAN-02` | prescreve só quem **acompanha clinicamente** o paciente                                                             | ✅ já cumprido pelo `garantirMedicoDoPaciente`                                                                                             |
| `REC-02` | receituário eletrônico exige **numeração do SNCR**                                                                  | checklist da ponte com `lib/receituario/`                                                                                                  |
| `REC-03` | exige **assinatura eletrônica qualificada ICP-Brasil**                                                              | idem                                                                                                                                       |
| `IMP-02` | a prescrição para importação contém nome do paciente e do produto, **posologia**, data, assinatura e nº do conselho | se a Be4Hope atende paciente que importa, é checklist literal                                                                              |

**Entregáveis acrescentados por essas normas:**

| #   | entregável novo                                                                                                                   | origem             |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 9   | ~~O **teor de THC** entra em `medicamentos`, e a tela **deriva** o tipo de receituário dele~~ → **retificado abaixo por `DO-46`** | `CAN-04`           |
| 10  | ~~**Trava de indicação** para produto com THC > 0,2 %~~ → **retificado abaixo**; e a régua (RDC 38/2013) ainda não foi lida       | `CAN-05` + `DO-42` |
| 11  | Notificação ao paciente a cada ajuste de dose                                                                                     | `DO-44`            |
| 12  | Histórico do medicamento anterior nas **duas** superfícies + visão por paciente com filtro geral                                  | `DO-44`            |
| 13  | Conferir `lib/receituario/` contra `REC-02` e `REC-03` — **catalogar**, não corrigir de passagem                                  | `REC-02`, `REC-03` |
| 14  | 🆕 A tela antiga de dosagem (`tab-dosagem.tsx`) vira **somente leitura** do histórico já digitado                                 | `DO-48`            |
| 15  | 🆕 Ligar `ajustesDosagem` a `dosagens` e a `medicamentos` por colunas **aditivas nullable**                                       | ADR-0012 D-01      |

### 🔴 RETIFICAÇÃO dos entregáveis 9 e 10 — 25/08/2026, `DO-46` e `DO-47`

A versão riscada acima fica registrada. As perguntas foram feitas ao dono antes de escrever
código, e as respostas **mudam quem aplica a norma** — não se a norma vale.

> `DO-46`: _"Isso ficará junto com a implementação das IA com meu chefe, essas questões são fora
> do nosso escopo, o nosso foco é construir a tela aonde isso ficará, além de que isso é algo que
> o 'MÉDICO' preenche não o SISTEMA."_
>
> `DO-47`: _"isso é opcional com aviso, o médico quem deve seguir o procedimento correto, o
> sistema avisa."_

| #      | como fica                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **9**  | `medicamentos` ganha `teorThcPercentual` **nullable** — a **casa** do dado, que fica **vazia**. Na conduta o campo é **do médico**: pré-preenchido pelo catálogo se houver, editável, e o que ele informa vale **para aquele ato**. A tela **avisa** o tipo de receituário correspondente (`CAN-04`). **Campo vazio não vira aviso** — a tela diz que não sabe |
| **10** | deixa de ser **trava** e vira **aviso**. ⚠️ Só o `CAN-04` está decidido: o `CAN-05` (THC alto restrito a doença debilitante grave) **não foi perguntado**, e a régua dele — a **RDC 38/2013** — não foi lida. **Pergunta ao dono antes de construir o 10**                                                                                                     |

**A pergunta que estava aberta desde 24/08 está fechada:** ajuste que troca a faixa de THC **não**
torna a prescrição nova obrigatória. Produz **aviso**. Ver [ADR-0005](../adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md)
D-03 **terceira versão** e [ADR-0012](../adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md) D-02.

### 🔴 E a leitura do código mudou a premissa da sprint inteira

Esta sprint foi escrita como se a cadeia fosse nova. **Não é.** Três dos oito entregáveis
originais já têm implementação, e ela viola três rejeitados da ADR-0005 (R-03, R-07 e a proibição
de sobrescrever histórico). Os cinco defeitos estão medidos com `caminho:linha` em
[`04` — Item 13](../04-LISTA-DE-AFAZERES.md); o desenho do caminho novo está na
[ADR-0012](../adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md).

🛑 **Nenhum dos cinco se corrige nesta sprint.** O que esta sprint garante é que o **caminho novo
não os repete**.

⚠️ **Ainda não lidas, e citadas pelas normas acima:** **RDC 38/2013** (define "doença debilitante
grave", citada pelo `CAN-05`) e **RDC 873/2024** (institui o SNCR, citada pelo `REC-05`).

## Entregáveis

| #   | entregável                                                                                      | referência               |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Tela de conduta: produto do catálogo (`medicamentos`), dose inicial, via, frequência            | ADR-0005 D-01            |
| 2   | **mg/dia calculado** ao lado das gotas (`cbdMgPorGota × gotasPorDia`), nunca persistido         | ADR-0004 D-06 · ADR-0005 |
| 3   | Ponte para a prescrição existente — **preenche e entrega**, sem alterar assinatura, PDF ou SNCR | ADR-0005 D-04            |
| 4   | Criação de `dosagens` com `medicamentoId` real, uma ativa por vez                               | ADR-0005 D-05            |
| 5   | Tela de **ajuste de dose**: anterior → nova, motivo obrigatório, próxima revisão                | ADR-0005 D-02            |
| 6   | **Linha do tempo da titulação** — a curva de dose do paciente ao longo do tratamento            | `ajustesDosagem`         |
| 7   | Ao ajustar, a tela **pergunta** se gera prescrição nova, em vez de decidir                      | ADR-0005 D-03 (`GAP-14`) |
| 8   | Alerta de fim de frasco a partir de `dataFimPrevista` — o cálculo já existe no schema           | `dosagens`               |

## ✅ O que foi entregue em 25/08/2026 — e o que NÃO foi

Medido no disco ao fim da sessão. `pnpm test` verde (275 casos em 9 guardas), portão de baseline
verde, `pnpm build` exit 0.

| #   | entregável                                             | situação                                                                                                                        |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tela de conduta com produto do catálogo                | ✅ `FormConduta.tsx` — produto por `Select` do catálogo, dose, via, frequência                                                  |
| 2   | mg/dia calculado, nunca persistido                     | ✅ `lib/conduta/dose.ts`; o guarda cobra que nenhuma tabela da cadeia tenha coluna de mg/dia                                    |
| 3   | Ponte para a prescrição existente                      | ✅ `ponte-prescricao.ts` + `PontePrescricao.tsx` — **preenche e entrega**; quem grava é a `criarPrescricao` que já existia      |
| 4   | `dosagens` com `medicamentoId` real, uma ativa por vez | ✅ `criarConduta` desativa a anterior e insere nova                                                                             |
| 5   | Ajuste de dose com motivo obrigatório                  | ✅ `ajustarDose`                                                                                                                |
| 6   | Linha do tempo da titulação                            | ✅ `CurvaDeTitulacao.tsx`, com as linhas legadas marcadas                                                                       |
| 7   | A tela **pergunta** se gera prescrição nova            | ✅ caixa no formulário de ajuste; a resposta vai para a auditoria — inclusive o "não"                                           |
| 8   | Alerta de fim de frasco                                | ✅ badge de dias restantes no `PlanoVigente`, a partir de `dataFimPrevista`                                                     |
| 9   | Teor de THC + tipo de receituário                      | ✅ **retificado por `DO-46`**: campo do médico, e a tela **avisa** em vez de derivar                                            |
| 11  | Notificação ao paciente a cada ajuste                  | ✅ `ajustarDose` insere em `notificacoes`, sem exceção                                                                          |
| 12  | Histórico nas **duas** superfícies + visão geral       | ✅ aba Dosagem (curva) **e** aba Prescrições (`listarAjustesParaPrescricoes`), mesma origem; visão geral em `/medico/titulacao` |
| 14  | Tela antiga vira somente leitura                       | ✅ `DO-48` — saíram "Novo Ajuste", "Editar" e "Excluir"; o histórico continua visível                                           |
| 15  | Ligar `ajustesDosagem` a `dosagens` e `medicamentos`   | ✅ migration `0023`, 100% aditiva, 3 colunas nullable                                                                           |

### 🛑 O que ficou de fora, e por quê

| #      | entregável                                           | por que não foi feito                                                                                                                                                                                                                                                                                               |
| ------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **10** | Aviso de indicação para THC > 0,2 % (`CAN-05`)       | **bloqueado por duas coisas, nenhuma técnica:** a **RDC 38/2013** — que define "doença debilitante grave", a régua do `CAN-05` — **não foi lida**; e o dono **não foi perguntado** se aqui também é aviso, como decidiu para o `CAN-04`. A lógica de `DO-46`+`DO-47` sugere que sim, mas **sugestão não é decisão** |
| **13** | Conferir `lib/receituario/` contra `REC-02`/`REC-03` | é **catalogação**, e já existe: [`04` — Item 11](../04-LISTA-DE-AFAZERES.md). Precede a leitura da **RDC 873/2024**, que institui o SNCR e também não foi lida                                                                                                                                                      |

### 🔴 Achados novos que a implementação produziu, e que NÃO foram corrigidos

- **[`04` — Item 13](../04-LISTA-DE-AFAZERES.md)**, seis defeitos na cadeia de dosagem existente:
  uma action **sem autenticação nenhuma**, 8 actions sem escopo de objeto, `UPDATE` em
  `gotasPorDia` (o R-03 da ADR-0005 implementado), `DELETE` físico de item de histórico, duas
  `criarDosagem` divergentes, e o enum sem `notificacao_a`.
- 🔴 **`prescricaoTipoEnum` não comporta a Notificação de Receita "A"** que o `CAN-04` exige
  (Item 13.6). A ponte **denuncia na tela** em vez de gravar o tipo errado calado. Corrigir exige
  responder antes uma pergunta de negócio: **a Be4Hope pode emitir Notificação "A"?**

**Nenhum se corrige nesta sprint** — o que ela garante é que o caminho novo não repete nenhum.

### Onde ver

- `/preview` → aba **Médico** → três seções novas, sem login
- `/medico/pacientes/{id}` → aba **Dosagem** (a conduta) e aba **Prescrições** (a 2ª superfície)
- `/medico/titulacao` → a visão geral

## Critério de aceite

- [x] ajustar dose cria linha nova — o guarda `a-conduta-avisa-e-nao-decide` prova por `rg` que o caminho novo não faz `UPDATE` em `gotasPorDia`, e a **sabotagem S6** confirmou que ele acusa quando volta
- [x] `criarConduta` e `ajustarDose` desativam a anterior antes de inserir; o guarda cobra a presença de `ativa: false`
- [x] a conduta grava `medicamentoId` — `dosagens.medicamentoId` é FK, e `itensAjusteDosagem` ganhou a coluna
- [x] `lib/receituario/`, `criarPrescricao` e o JSONB de `prescricoes` **não foram alterados**; o guarda cobra que a action de conduta não os importe nem escreva neles
- [x] mg/dia aparece no cartão e no formulário, e o guarda varre `db/schema/` provando que não virou coluna
- [x] `pnpm build` — **exit 0**, medido em 25/08/2026

## Não entra

- 🛑 **Alterar `prescricoes.medicamentos`** para "arrumar" o JSONB. É o Item 4 do checklist,
  alimenta PDF assinado e SNCR, e exige autorização própria.
- Sugestão automática de conduta pela IA — Metade 2.
- Renovação e recompra: já existem (`recompras`), fora do escopo.

## Bloqueios

| bloqueio                                           | de quem                                                                                                                                                                                                              |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GAP-14` — quando um ajuste exige prescrição nova  | decisão clínica e regulatória                                                                                                                                                                                        |
| ✅ ~~RDC 327/2019, 660/2022 e 1.000/25 não lidas~~ | **TRANSCRITAS em 24/08/2026** (`DO-45`). 🔴 E a 327/2019 está **REVOGADA** pela **RDC 1.015/2026** (`CAN-00`, Art. 76) — esta sprint citava norma morta. Ver `CAN-01`…`CAN-06`, `IMP-01`…`IMP-04`, `REC-01`…`REC-06` |
