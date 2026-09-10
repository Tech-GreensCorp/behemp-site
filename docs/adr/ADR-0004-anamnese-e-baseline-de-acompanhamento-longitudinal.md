# ADR-0004 — A anamnese da BeHemp é o marco zero de um acompanhamento longitudinal, não um evento que termina em diagnóstico

> **Status:** ✅ **aprovada em 20/08/2026** pelo dono do produto — as 6 decisões, sem alteração.
> **Contexto:** o dono pediu para verificar _"como isso entrará no escopo do ramo de tratamento
> com uso de canabis"_ e observou: _"eu acho o fluxo do vidai mt bom mas pode ser que pra esse
> projeto não seja o ideal"_. A suspeita se confirmou na medição e na literatura.
> **Decisão:** a anamnese **não** é copiada do VidAI como wizard linear que desemboca em
> diagnóstico. Ela é reconstruída como **baseline de medidas repetíveis** que alimenta
> titulação e acompanhamento — e a estrutura de tela decorre disso.

---

## §1 — O que a medição e a literatura provaram

### 1.1 O ciclo clínico do canabidiol é longitudinal, e tem cadência conhecida

A orientação regulatória e a prática documentada são de que as medidas relatadas pelo paciente
são coletadas _"at baseline prior to commencing therapy, again after titration (approximately 2
weeks after commencing therapy), and then monthly"_, e o princípio de dose é **"start low, go
slow"** — titular _"until the lowest effective dose is reached"_, guiado pelos efeitos e efeitos
adversos relatados.

🔴 **Isso é outro problema de produto.** No VidAI, a anamnese termina em hipótese e prescrição —
um evento. Aqui, ela é o **ponto zero de uma série temporal**, e o valor clínico está em
comparar t₀ com t₂semanas e t₁mês.

### 1.2 A anamnese que já existe aqui **já é de canabidiol** — e é melhor ponto de partida que a do VidAI

`db/schema/anamneses.ts` tem, hoje:

| campo                                           | por que é exatamente medida de baseline                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `nivelDor` (0–10)                               | escala repetível — é o desfecho mais medido em dor crônica |
| `qualidadeSono` (enum)                          | desfecho clássico do canabidiol                            |
| `objetivosTratamento`                           | o alvo contra o qual a titulação para                      |
| `usoPrevioCannabis`                             | muda a dose inicial                                        |
| `medicamentosEmUso`                             | interação medicamentosa com THC/CBD                        |
| `tabagismo`, `consumoAlcool`, `atividadeFisica` | contexto que a literatura pede na avaliação inicial        |

**Nada disso existe na anamnese do VidAI**, que é de clínica geral. A anamnese da BeHemp está
**mais perto do escopo** que a de origem.

⚠️ **O que falta:** ela é **um registro por vez**, sem série temporal, e sem sinais vitais.

### 1.3 O schema de dose desta casa é profundamente de canabinoide

Já existem, sem nada a criar:

- `medicamentos`: `cbdMgPorGota`, `thcMgPorGota`, `cbnMgPorGota`, `cbgMgPorGota`,
  `thcvMgPorGota`, `tipoEspectro`, `gotasPorMl`, `totalGotas`, `nanotecnologia`
- `dosagens`: `gotasPorDia`, `mlFrasco`, `dataInicio`, `dataFimPrevista`, `ativa`
- `ajustesDosagem` + `itensAjusteDosagem`: `tipoCanabinoide`, `dosagemAnterior` → `novaDosagem`,
  `frequencia`, `concentracaoTHC`, `concentracaoCBD`, `viaAdministracao`, **`motivoAjuste`**,
  **`proximaRevisao`**

🎯 **`motivoAjuste` + `proximaRevisao` + `dosagemAnterior` são, literalmente, titulação
modelada.** A tabela existe e não tem tela. O produto tem o schema de canabidiol que o VidAI
nunca teve.

E `cbdMgPorGota × gotasPorDia` dá **mg/dia** — a unidade em que a literatura fala. Hoje o
produto guarda gotas; a conversão para mg é derivação, não campo novo.

### 1.4 Wizard × usuário frequente: a evidência contraria a cópia

O NN/g: wizards servem a _"novice users or infrequent processes"_ e _"can quickly become
annoying and overly controlling if they have to be used over and over again or if users have a
lot of knowledge"_. E, sobre navegação: _"Do not allow users to pick step before completing the
steps preceding it"_ — se navegação livre é desejável, _"this functionality is not suited to be
provided as a wizard"_.

O médico da BeHemp faz anamnese **todo dia**. E, com §1.1, a maioria dos atendimentos é
**retorno** — onde repetir 6 etapas é puro atrito.

---

## §2 — As três opções, comparadas

|                                          | **A. Wizard linear 6 etapas** (cópia do VidAI) | **B. Seções numa página + trilha** | **C. Painel lateral com abas** (como a teleconsulta) |
| ---------------------------------------- | ---------------------------------------------- | ---------------------------------- | ---------------------------------------------------- |
| fiel à origem                            | ✅ total                                       | parcial                            | não                                                  |
| serve ao expert que usa todo dia         | ❌ contraindicado pelo NN/g                    | ✅                                 | ✅                                                   |
| serve à **primeira vez**                 | ✅ ótimo                                       | ✅ com a trilha visível            | ⚠️ painel é estreito                                 |
| serve ao **retorno** (o caso mais comum) | ❌ repete tudo                                 | ✅ vai direto ao que mudou         | ✅                                                   |
| mapa mental do processo                  | ✅                                             | ✅ trilha dá o mesmo               | ⚠️ menor                                             |
| já existe anatomia nesta casa            | ✅ `PrescricaoInlineWizard` (3 passos)         | parcial                            | ✅ `PainelClinicoLateral`                            |
| coerência com o que o dono elogiou       | média                                          | média                              | ✅ alta                                              |
| custo de construir                       | médio                                          | médio                              | baixo                                                |

## §3 — As decisões

### D-01 — A anamnese é modelada como **baseline repetível**, não registro único

As medidas de desfecho (`nivelDor`, `qualidadeSono`, e o que mais for definido) precisam existir
em **série temporal**, com data e origem, para que t₀ e t+30d sejam comparáveis.

**Rejeitado: manter um registro de anamnese por paciente, sobrescrito a cada consulta.** Perde
exatamente a informação que dá valor ao tratamento com canabidiol — a evolução. E fere a
proibição do repositório de sobrescrever histórico clínico.

**Rejeitado: criar uma anamnese nova e completa a cada retorno.** Duplica dado estável
(histórico familiar, alergias) e transforma comparação em arqueologia.

### D-02 — A tela adota a **opção B**, com dois modos

**Primeira avaliação:** seções na página, trilha lateral com progresso, todas as seções visíveis
desde o início — o NN/g recomenda _"making all the steps visible from the start"_ como visão
geral do processo.
**Retorno:** só as **medidas repetíveis** e o que mudou, com o valor anterior ao lado.

**Rejeitado: wizard linear (opção A).** Contraindicado pela evidência para usuário frequente e
expert, e péssimo para o caso mais comum, que é o retorno. Fica registrado que **essa é a maior
divergência deliberada em relação ao VidAI**, e o motivo é o escopo: lá a anamnese é evento; aqui
é série.

**Rejeitado: painel lateral (opção C) como casa principal.** É o padrão certo **dentro da
teleconsulta** — e lá continua sendo usado. Mas coleta longa de primeira avaliação em painel
estreito é pior que em página.

⚠️ Isto **não** contradiz `DO-12`: a lógica de construção do VidAI (P1–P7) é integralmente
adotada. O que muda é o **recipiente**, porque o escopo clínico é outro.

### D-03 — As medidas de baseline são explícitas, e escolhidas com o médico

Entram no schema como medida datada e repetível. As candidatas derivadas do que já existe:
`nivelDor` (0–10), `qualidadeSono`, e o progresso contra `objetivosTratamento`.

**Rejeitado: escolher as escalas por conta própria a partir da literatura.** Instrumento de
medida clínica é decisão de quem responde pelo ato — e a literatura oferece dezenas. Era o
`GAP-12`.

✅ **`GAP-12` RESPONDIDO em 20/08/2026 pelo dono — cinco medidas repetíveis** (`DO-24`):

| medida                              | estado no schema             | escala                                  |
| ----------------------------------- | ---------------------------- | --------------------------------------- |
| **dor**                             | ✅ `anamneses.nivelDor`      | 0–10, já existente                      |
| **qualidade do sono**               | ✅ `anamneses.qualidadeSono` | enum, já existente                      |
| **ansiedade / humor**               | 🆕 campo novo                | 0–10, por consistência com dor          |
| **qualidade de vida global**        | 🆕 campo novo                | 0–10, por consistência                  |
| **frequência de crises / espasmos** | 🆕 campo novo                | **contagem + período** (dia/semana/mês) |

⚠️ **A escala das três novas é proposta de implementação, não escolha clínica.** 0–10 foi adotado
por consistência com `nivelDor`, que já existe. Para crises, em vez de fixar o período — que
seria presumir —, o campo guarda **contagem e período juntos**, e quem registra escolhe. Se o
médico preferir instrumento nomeado (escala validada específica), a troca é de rótulo e faixa,
não de modelo de dados.

### D-04 — Sinais vitais entram como bloco opcional, não obrigatório

O VidAI mede 8 vitais porque é clínica geral com análise de exame de imagem. Para canabidiol
ambulatorial, boa parte não muda conduta.

**Rejeitado: copiar os 8 vitais do VidAI como obrigatórios.** Campo que ninguém preenche vira
ruído, e campo pessoal sem consumidor declarado é coleta sem finalidade — o que a regra de LGPD
desta casa proíbe. Era o `GAP-13`.

✅ **`GAP-13` RESPONDIDO em 20/08/2026 pelo dono — dois vitais** (`DO-25`): **pressão arterial** e
**peso**. Os dois com consumidor declarado neste tratamento: PA porque o canabidiol interage com
anti-hipertensivos e pode causar hipotensão; peso porque a referência de dose se expressa por kg.
Os outros 6 do VidAI **ficam fora** — em canabidiol ambulatorial raramente mudam conduta, e campo
pessoal sem consumidor é coleta sem finalidade.

### D-05 — O controle de entrada numérica é por grandeza, com faixa plausível

Isso **se copia** do VidAI: `−`/`+` além do slider, mínimo/máximo/passo por medida, faixa normal
indicada, sinalização de valor perigoso, derivados nunca digitados. Vale para dor, dose em gotas
e mg/dia.

**Rejeitado: `<input type="number">` genérico.** Aceita 700 gotas/dia sem piscar.

### D-06 — A dose aparece em **mg/dia**, calculada, ao lado das gotas

`cbdMgPorGota × gotasPorDia`. A literatura de titulação fala em mg; a operação do produto fala em
gotas. A tela mostra as duas, e a conversão é derivada de `medicamentos`.

**Rejeitado: mostrar só gotas.** Impede comparar com qualquer referência clínica publicada.
**Rejeitado: gravar mg como campo.** Seria dado derivado persistido, divergindo quando o
medicamento for corrigido.

### D-07 — 🆕 O rastreio do uso substitui o boolean, e o **primeiro uso é caminho de primeira classe**

**Acrescentada em 20/08/2026 por decisão do dono** (`DO-26`, `DO-27`).

O que existia: `anamneses.usoPrevioCannabis` — um **boolean**. O paciente de canabidiol
frequentemente chega **já usando algo** (importado, artesanal, por conta própria), e o sistema
registrava isso como "sim", sem produto, sem dose, sem tempo, sem resposta. O médico não tinha de
onde partir para titular.

**O que o rastreio guarda** (`DO-26`): produto, proporção CBD:THC quando conhecida, dose atual,
via, desde quando, efeito percebido, efeito adverso, origem. **E adesão** — o que o paciente **de
fato tomou**, que é diferente do que foi prescrito.

🔴 **`DO-27` — o PRIMEIRO USO não é o "não" de uma pergunta.** Palavras do dono: _"nem todo
paciente que chegar já usa medicação, temos que nos preparar para esses que são o primeiro uso,
ainda mais se o paciente está vindo para fazer a consulta médica para conseguir o remédio"_.

Isso muda a tela: o desenho **ramifica** em vez de esconder campos atrás de um checkbox.

| caminho                       | o que a tela pede                                                                                               |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **primeiro uso** (nunca usou) | nada de rastreio. Em vez disso: expectativa e receio sobre iniciar — que é o que ancora a conversa de titulação |
| **já usa ou já usou**         | o rastreio de `DO-26`                                                                                           |

**Rejeitado: manter o boolean e abrir campos condicionais.** Trata o primeiro uso como ausência
de dado, quando ele é **o caso mais comum** neste produto — o paciente vem à consulta justamente
para conseguir o remédio. Ausência de dado e primeiro uso são coisas diferentes, e um boolean não
distingue as duas.

**Rejeitado: registrar a adesão em `dosagens`.** `dosagens` guarda o que foi **prescrito**. Se o
mesmo campo guardasse o que foi tomado, a prescrição original se perderia — e é ela que a
titulação compara.

⚠️ **Fora de escopo, por decisão do dono:** o fluxo de **comprovação de renda / medicamento
gratuito**. Medido em 20/08: `app/(public)/programa-acesso-solidario/page.tsx` é **institucional**
(612 linhas, zero formulário) e `pacientes.rendaFamilia` existe como **texto livre**, sem tabela
de elegibilidade ou aprovação. O dono foi explícito: _"se não existir ainda não é nosso dever
fazer agora"_. Catalogado no `03`, não construído.

---

## §4 — O que fica rejeitado

| #    | rejeitado                                      | motivo                                                |
| ---- | ---------------------------------------------- | ----------------------------------------------------- |
| R-01 | anamnese sobrescrita a cada consulta           | perde a evolução, que é o valor no canabidiol         |
| R-02 | anamnese completa nova a cada retorno          | duplica dado estável; comparação vira arqueologia     |
| R-03 | wizard linear de 6 etapas                      | contraindicado para expert frequente; ruim no retorno |
| R-04 | painel lateral como casa da primeira avaliação | estreito para coleta longa                            |
| R-05 | escolher escalas clínicas sozinho              | é decisão de quem responde pelo ato médico            |
| R-06 | copiar os 8 sinais vitais como obrigatórios    | coleta sem finalidade declarada                       |
| R-07 | `input type=number` genérico                   | aceita valor clinicamente impossível                  |
| R-08 | dose só em gotas                               | impede comparação com a literatura                    |
| R-09 | persistir mg/dia como campo                    | dado derivado que diverge                             |

## §5 — Como se prova

| guarda                     | falha quando                                                 |
| -------------------------- | ------------------------------------------------------------ |
| `medida-e-datada`          | medida de desfecho for gravada sem data e origem             |
| `anamnese-nao-sobrescreve` | atualização apagar valor anterior em vez de acrescentar      |
| `faixa-plausivel`          | campo clínico numérico aceitar valor fora da faixa declarada |
| `mg-derivado`              | mg/dia for persistido em vez de calculado                    |

## §6 — O que falta decidir

`GAP-12` (quais escalas de desfecho) · `GAP-13` (quais sinais vitais) — ambos exigem o médico.

---

## §N — O que a implementação ensinou

_A escrever depois._

---

**Fontes.** Lidas: [NN/g — Wizards](https://www.nngroup.com/articles/wizards/). Localizadas e
citadas pelo trecho: [NICE NG144](https://www.nice.org.uk/guidance/ng144/chapter/recommendations) ·
[TGA — Guidance for the use of medicinal cannabis in Australia](https://www.tga.gov.au/resources/explore-topic/medicinal-cannabis-hub/medicinal-cannabis-guidance-documents) ·
[QUEST Initiative (PMC10482296)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10482296/) ·
[Practical strategies using medical cannabis (PMC8120104)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8120104/) ·
[NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
[W3C WAI — Multi-page Forms](https://www.w3.org/WAI/tutorials/forms/multi-page/).
Primárias medidas: `db/schema/{anamneses,dosagens,ajustes-dosagem,medicamentos,prescricoes}.ts` ·
`components/teleconsulta/{PrescricaoInlineWizard,AnamneseInlineForm,PainelClinicoLateral}.tsx`.

⚠️ **Nenhuma norma brasileira (RDC 327/660, CFM) foi lida** — as fontes acima são NICE, TGA e
literatura. A regra brasileira continua pendente no `02`.

**Princípios e fase:** D-01/D-03 **F** (dados), fase 5 · D-02/D-05 **L** (front-end), fase 2 ·
D-04 **H** (minimização LGPD), fase 6 · D-06 **A** (arquitetura), fase 3.
