# Sprint 4 — Hipóteses e revisão humana: a tela onde o médico decide

> **Objetivo:** quando esta sprint acabar, existe a superfície em que a saída da IA é
> apresentada, comparada e **aceita, recusada ou editada** — funcionando inteira contra fixture,
> sem motor nenhum ligado.

**ADRs:** [ADR-0006](../adr/ADR-0006-como-a-saida-da-ia-aparece-na-tela.md) (toda) ·
[ADR-0002](../adr/ADR-0002-ui-antes-da-inteligencia.md) D-02/D-03.

**Princípios executados:** P1, P3 (falha parcial vira tela parcial), P4, P5 (campos separados
para IA e médico).

## 🟡 Estado em 20/08/2026 — as telas existem, contra o contrato congelado

**A CFM foi transcrita** (`CFM-01`…`CFM-08`), o que destravou esta sprint. E ela deu mais do que
se esperava: dois artigos que fundamentam o desenho, em vez de apenas permitir.

| o que a norma diz                                                                                                    | onde isso aparece na tela                                                     |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `CFM-03` (Art. 11 §1º) — _"o médico deve destacar e registrar que se trata apenas de uma **impressão diagnóstica**"_ | o painel se chama "Hipóteses **sugeridas**", e nada nele grava nada           |
| `CFM-04` (Art. 4º §2º) — _"a autonomia médica está diretamente relacionada à **responsabilidade pelo ato médico**"_  | a Trava 2: `revisoes_ia` grava **quem** decidiu, e a prescrição não sai daqui |

### Construído

| arquivo                                                   | o que é                                                                                                                                         |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/ia-clinica/PainelHipoteses.tsx`               | as 3 hipóteses com evidência a favor, **contra** e lacunas; origem de cada achado rotulada; faixa categórica de confiança, **nunca percentual** |
| `components/ia-clinica/RevisaoHumana.tsx`                 | a Trava 2. Validar **ou divergir**, com o mesmo peso visual. **Sem botão de prescrever**                                                        |
| `components/ia-clinica/AnaliseAssistida.tsx`              | os dois juntos, na sequência que é a regra                                                                                                      |
| `db/schema/revisoes-ia.ts` + `app/_actions/revisao-ia.ts` | o registro do ato humano, com a saída congelada em `saidaApresentada`                                                                           |

**Alimentado pelo fixture congelado, fora de produção.** Em produção, `grafo = null` e aparece o
estado vazio — deixar fixture chegar a produção seria dado inventado em tela clínica. A tela
**diz** quando o dado é de demonstração.

### Acrescentado em 24/08/2026, a pedido do dono

| arquivo                                               | o que é                                                                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `components/ia-clinica/MedicacoesSugeridas.tsx`       | até **3** opções por hipótese, ranqueadas, com o porquê da posição e o que pesa contra. **Sem dose** — ADR-0009   |
| `components/ia-clinica/EvidenciaDaHipotese.tsx`       | o bloco de evidência **compartilhado** entre o painel e a tela de decisão — é o que faz ser "o mesmo dado" (D-05) |
| `components/ia-clinica/ChipAchado.tsx`                | o achado com a origem rotulada, extraído para não existir em duas cópias                                          |
| `lib/ia-clinica/evidencia.ts`                         | `evidenciaDa`, puro, fora do componente                                                                           |
| `__fixtures__/…/resposta-canabidiol-dor-cronica.json` | o único fixture de canabidiol; exercita 3, 2 e **zero** opções                                                    |
| modo `denso`                                          | sidebar da teleconsulta: encolhe a caixa, **nunca** o conteúdo (D-07)                                             |

**Corrigido no mesmo movimento:** a tela nascia com **nenhuma** hipótese aberta, divergindo da
ADR-0006 D-01 (_"primeira aberta, demais fechadas"_). Agora a de menor `slot` abre por padrão.
Ninguém tinha notado — nem eu, ao construir, nem na revisão visual.

### O que falta — medido em 24/08/2026, não estimado

**Entregáveis desta sprint que NÃO existem.** Nenhum foi pedido pelo dono nas mensagens de 24/08;
ficam aqui para que a próxima sessão não planeje em cima de trabalho inexistente.

| #      | entregável                                                           | estado                                                             |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **E3** | caminho de **hipótese manual** como primeira classe                  | ❌ não existe. `rg manual components/ia-clinica/` devolve zero     |
| **E7** | **rascunho** da revisão — sair no meio e voltar sem perder a decisão | ❌ não existe. Sem `localStorage`, sem persistência de rascunho    |
| **E8** | **badges de urgência em 4 níveis** nos tokens `--chart-*`            | ❌ não existe. `UrgenciaAnalise` está no contrato e não vai à tela |

#### 🔴 O dono definiu os três em 24/08/2026 — o escopo mudou, e cresceu

Os três deixaram de ser "o que a sprint previa" e passaram a ter forma decidida. **E3 e E7 estão
em [ADR-0011](../adr/ADR-0011-a-divergencia-do-medico-alimenta-o-rag.md).**

| entregável | o que o dono decidiu                                                                                                                                                                                                                  | referência                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **E3**     | Ao **divergir**: campo opcional de _"por que a IA errou"_ **+** campo obrigatório do **medicamento que vai prescrever**. Os dois **alimentam o RAG**, marcados como `revisao_humana`                                                  | `DO-40` · ADR-0011 D-01/D-02 |
| **E7**     | Rascunho **obrigatório**, no **servidor** (não `localStorage` — dado de saúde em navegador compartilhado), com **histórico** que preserva versões, como no VidAI                                                                      | `DO-41` · ADR-0011 D-03/D-04 |
| **E8**     | Entra, e com peso maior do que o previsto: os **gatilhos de urgência** existem para **evitar medicamento errado** — por erro humano **e** por falta de sinal para a IA. A anamnese precisa ser específica o bastante para produzi-los | `DO-42`                      |

🔴 **E8 ganhou fundamento normativo em 24/08**, que não existia quando a sprint foi escrita. Pelo
`CAN-05` (RDC 1.015/2026, Art. 5º), THC acima de 0,2 % é restrito a **doença debilitante grave ou
que ameace a vida**; pelo `CAN-04`, esse mesmo limiar decide se a receita é de Controle Especial
ou **Notificação de Receita "A"**. O gatilho que o `DO-42` pede não é ergonomia — é o que impede
oferecer produto cuja indicação a norma restringe.

⚠️ **`GAP-16` aberto** (Jurídico): base legal do **uso secundário** do juízo do médico no RAG. Os
campos podem ser construídos; a **ingestão no corpus** não liga até a resposta.

⚠️ **E8 mantém a armadilha do 7→4**, e agora com mais razão para escrever o mapa antes: se a
urgência participa de decisão sobre produto, dois mapeamentos divergentes produzem condutas
divergentes.

⚠️ **E8 tem uma armadilha já conhecida:** `UrgenciaAnalise` tem **7 valores** no contrato para
3–4 níveis visuais (medido na Sprint 2). O mapeamento 7→4 é decisão de desenho e precisa ser
escrito antes de codificado, senão dois lugares mapeiam diferente.

**Também falta:**

- **O motor.** É a Metade 2, e depende de RAM na AWS **e** da resposta sobre SaMD (`ANV-01`).
- **Guarda `hipoteses-nao-viram-conduta-sozinhas`** — o nome planejado ainda não existe. O
  `medicacao-informa-nao-prescreve` (44 casos) cobre **parte** do que ele cobriria: nenhum clique
  liga sugestão a prescrição, e a evidência da decisão é a mesma do painel. **Não** cobre E3/E7/E8.
- **Prescrição a partir da decisão** — é a Sprint 5, e o `CFM-07` já dá o checklist literal.

## Entregáveis

| #   | entregável                                                                                                                     | referência         |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| 1   | Cartão de hipótese: título, **confiança categórica com orientação de ação**, evidências que a sustentam                        | ADR-0006 D-02/D-03 |
| 2   | Três alternativas — primeira aberta, demais fechadas, seleção explícita                                                        | ADR-0006 D-01      |
| 3   | Caminho de **hipótese manual** como primeira classe, não escape                                                                | `09` §2            |
| 4   | Aceitar · recusar · editar com **o mesmo peso visual**; recusa pede motivo e grava `divergente`                                | ADR-0006 D-04      |
| 5   | Campos do médico **ao lado** dos da IA, nunca por cima                                                                         | P5                 |
| 6   | **Banner de análise parcial** quando o contrato trouxer resposta incompleta — construído contra o fixture truncado da Sprint 2 | P3                 |
| 7   | Rascunho da revisão: sair no meio e voltar sem perder decisão                                                                  | P1/P7              |
| 8   | Badges de urgência em quatro níveis, nos tokens `--chart-*` — **sem hex novo**                                                 | `09` §5.1          |

## Critério de aceite

- [ ] `rg` não encontra `%` ligado a confiança de modelo em nenhuma tela
- [ ] carregar o **fixture truncado** e ver a tela mostrar o que há + o banner — nunca "Não determinado" nem tela vazia
- [ ] recusar exige motivo, e o motivo fica gravado
- [ ] `chain_of_thought` não é renderizado em superfície alguma
- [ ] aceitar e recusar usam variantes de mesmo destaque
- [ ] quatro estados · dois temas · telefone · teclado
- [ ] nenhuma chamada de rede a motor — a fonte é o fixture

## Não entra

Motor, RAG, corpus · conduta e prescrição (Sprint 5) · exames.

## Bloqueios

✅ **RESOLVIDO em 20/08/2026.** A CFM **2.314/2022** foi transcrita (`CFM-01`…`CFM-08`) e é ela
que rege telemedicina — a **2.299/2021**, citada aqui originalmente, tem por objeto _"emissão de
documentos médicos eletrônicos"_, assunto diferente. Conferir o **objeto** da norma antes de
citá-la virou regra no `CLAUDE.md`.

🟡 **Aberto:** `GAP-03` — origem do corpus de canabidiol e quem o valida clinicamente. Bloqueia
**dado**, não desenho: a estrutura das opções de medicamento está fundamentada (ADR-0009), e até
o corpus existir tudo chega à tela rotulado como `inferido_ia`.

🟡 **Aberto:** enquadramento SaMD e classe (`ANV-04` + RDC 185/2001) — determinação de Assuntos
Regulatórios. Não bloqueia as telas, bloqueia **ligar o motor**.

---

## ✅ FECHAMENTO — 25/08/2026: E3, E7 e E8 entregues

Os três entregáveis que ficaram de fora em 24/08 foram feitos, mais a aba da teleconsulta
(que era da S1/S4). **A Sprint 4 está completa.**

### E3 — divergir alimenta o RAG (`DO-40`)

Ao divergir, dois campos com obrigatoriedade **deliberadamente diferente**:

- **medicamento que vai prescrever** — obrigatório, validado no servidor. É ele que fecha o par
  (sugerido × escolhido); sem o desfecho, a divergência diz que o modelo errou mas não o que era
  certo.
- **por que a análise errou** — opcional, como o dono pediu. Exigir de quem está com pressa
  produz texto vazio, que polui o corpus mais do que a ausência.

Colunas novas em `revisoes_ia`: `porQueIaErrou`, `medicamentoPrescritoNome`,
`medicamentoPrescritoId`, `fonteRag` (`'revisao_humana'`, a camada de limiar 0,65) e
`ingeridoNoCorpusEm`.

🔴 **`ingeridoNoCorpusEm` nasce e fica VAZIA.** `GAP-16` bloqueia a **ingestão**, não a
construção dos campos (ADR-0011 D-02). O guarda tem um caso que varre `app/`, `lib/` e
`components/` e fica vermelho se **qualquer** código de produção preencher essa coluna.

### E7 — rascunho da revisão no servidor (`DO-41`)

Tabela nova `rascunhos_revisao_ia`. Cada salvamento **insere** — `versao` cresce, nada é
sobrescrito, porque histórico que se sobrescreve não é histórico.

🛑 `localStorage` **rejeitado** (ADR-0011 D-03), e o guarda mantém a rejeição: um caso fica
vermelho se `localStorage` ou `sessionStorage` voltar ao componente de revisão.

**Por que tabela própria e não uma linha `em_andamento` em `revisoes_ia`:** aquela tabela é a
**prova regulatória** de que houve ato humano. Misturar rascunho com decisão registrada
enfraquece justamente esse argumento — uma auditoria precisaria distinguir decisão de digitação
a meio caminho. Aqui a separação é estrutural.

O prazo de retenção **existe como coluna e fica vazio**: é decisão do Jurídico.

### E8 — urgência na tela (`DO-42`, `DO-51`)

🔴 **O mapa não era 7→4. É 7→3, mais um derivado.** Ao medir o contrato, os 7 valores de
`UrgenciaAnalise` mostraram ser **dois vocabulários** (cor e estado) para **três** níveis. O
"código roxo" de 4 níveis que eu havia descrito veio do VidAI, não deste contrato.

O 4º nível (`DO-51`) é **derivado**: emergência **e** `red_flags_nao_explicadas > 0` — dois
campos que o motor já produz. Um valor novo em `UrgenciaAnalise` nasceria sempre vazio, e nível
que nunca acende é pior que nível nenhum.

Decisão completa, com 6 rejeitados, em
[ADR-0013](../adr/ADR-0013-o-mapa-de-urgencia-mora-num-lugar-so.md).

### A aba `IA Clínica` na teleconsulta (`DO-39`, `DO-49`, `DO-50`)

Quarta aba do sidebar, **em último lugar** — nenhuma aba existente mudou de posição, e o design
do chefe não foi alterado. Monta o **componente real** `AnaliseAssistida` em modo `denso`.

⚠️ `grafo={null}` hoje, e isso é honesto: o motor é a Metade 2 (`DO-06`). O componente mostra o
estado vazio explicando o que virá, **sem botão inerte**.

### Verificação

```
pnpm test    → 10 arquivos, 316 casos, verde
baseline     → lint 206/130 · Prettier 323 · tsc 0 — verde
pnpm build   → exit 0
```

**10 sabotagens no guarda novo, todas acusaram** — incluindo preencher `ingeridoNoCorpusEm`,
`localStorage` de volta, `porQueIaErrou` virando obrigatório, mapa de urgência duplicado, red
flag elevando sem emergência, e a aba deixando de ser a última.
