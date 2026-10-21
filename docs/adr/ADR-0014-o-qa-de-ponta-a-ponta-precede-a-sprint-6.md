# ADR-0014 — O QA de ponta a ponta precede a Sprint 6, e o seed precede o QA

> **Status:** ✅ **aceita** — 25/08/2026 (`DO-52`, `DO-53`).
> **Contexto:** com as Sprints 0 a 5 fechadas, a fila apontava direto para a Sprint 6 (área do
> paciente). O dev Davi interrompeu essa ordem: _"a área do perfil do paciente fica após QA das
> telas e visualização das telas"_.
> **Decisão:** entre o fim da Sprint 5 e o início da Sprint 6 entram **quatro etapas em
> sequência**, e a primeira delas não é o QA — é o **mapeamento dos dados**.

---

## §1 — O problema que esta ADR resolve

Cinco sprints foram construídas e **nenhuma foi testada de ponta a ponta por um humano**. O que
existe é:

- **322 casos de guarda estrutural** — provam que o código não viola as regras. Não provam que o
  clique funciona.
- verificação por `curl` + grep no HTML — prova que o markup chega. Não prova que o formulário
  abre, que o aviso muda, que o toast aparece.
- **zero** teste de navegador, e2e ou de acessibilidade. Eles não existem neste projeto.

Começar a Sprint 6 sobre isso significaria construir a área do paciente sobre cinco sprints cuja
única prova de funcionamento é estrutural.

## §2 — Por que o SEED vem antes do QA, e o MAPEAMENTO antes do seed

> _"o qa vem junto com seeds para podermos termos dados no sistema se não os bloqueios não
> deixarão a gente testar completamente, logo antes mesmo do qa tem todo mapeamento dos dados que
> entrarão no seeds"_ (`DO-53`)

**A razão é o encadeamento de bloqueios do próprio produto.** Cada tela exige que a anterior
tenha acontecido:

```
paciente sem triagem      → não chega à teleconsulta
sem consentimento (2 lados) → a sala não abre
sem anamnese              → não há baseline, e a série de desfecho fica vazia
sem conduta               → não há plano vigente, nem curva de titulação
sem dosagem ativa         → não há alerta de fim de frasco, nem recompra
sem prescrição            → o paciente não tem o que ver em /paciente/prescricoes
```

Testar a tela 6 exige que 1 a 5 tenham dado. Um QA sem seed não falha por bug — **falha por
estado vazio**, que é indistinguível de bug para quem testa.

**E o mapeamento vem antes do seed** porque seed é código: escrever primeiro e descobrir o que
falta depois produz duas rodadas. O mapeamento é a lista do que cada tela precisa **ver** para
ser testável, e é ele que diz o que o seed precisa criar.

## §3 — As decisões

### D-01 — Quatro etapas entre a Sprint 5 e a Sprint 6, nesta ordem

| #   | etapa                   | por que precede a seguinte                                                         |
| --- | ----------------------- | ---------------------------------------------------------------------------------- |
| 1   | **Mapear os dados**     | seed escrito sem mapa descobre o que falta durante a execução, e vira duas rodadas |
| 2   | **Escrever o seed**     | sem dado, o QA falha por estado vazio — que parece bug e não é                     |
| 3   | **QA de ponta a ponta** | é o primeiro teste humano das 5 sprints; achado aqui é mais barato que na Sprint 6 |
| 4   | **Visualizar as telas** | o aceite visual do dev Davi, que é quem aprova o desenho                           |

**Rejeitado: começar a Sprint 6 em paralelo ao QA.** Achado de QA que force mudança na cadeia
`conduta → dosagem` mudaria a base sobre a qual a área do paciente estaria sendo construída — e
retrabalho em código já escrito custa mais que espera.

**Rejeitado: QA sem seed, usando dado criado à mão durante o teste.** Cria dado inconsistente,
não é repetível, e o próximo QA começa do zero. Além disso, criar o dado à mão **é** percorrer o
fluxo — e aí o QA testa a criação, nunca o estado maduro.

### D-02 — O seed é instrumento de diagnóstico, não só de dado

Regra que já está no `CLAUDE.md` e que aqui fica com endereço: **um cenário por classe de
defeito · um cenário composto · um CONTROLE limpo.**

Sem o controle, verde não significa nada — se o cenário que isola X não acusa X, a regra não
existe. Aplicado a este QA, isso quer dizer que o seed precisa conter, no mínimo:

- um paciente com o teor de THC **preenchido** e outro **sem teor** — é o que faz aparecer a
  diferença entre o aviso do `CAN-04` e o _"não informado"_ (`DO-46`);
- um paciente com produto de THC **acima de 0,2 %** — senão a Notificação de Receita "A" nunca
  aparece na tela, e o achado do `04` Item 13.6 fica invisível ao QA;
- um paciente com **ajuste de dose legado**, em texto livre — para provar que o `DO-48` preservou
  o histórico;
- um paciente **sem nada** — o controle, que prova que os estados vazios das telas funcionam.

⚠️ **`db/seed*.ts` recusa rodar com `NODE_ENV=production`** e não usa identificador real — as
duas regras já valem e não mudam aqui.

### D-03 — O QA cobre as 5 sprints, não só a última

O cartão 7 do Trello foi renomeado pelo dev Davi de _"testar as telas da Sprint 5"_ para **"QA
completo das sprints 0 a 5"**. A mudança é substantiva: o roteiro passa a percorrer o fluxo
inteiro, e não a última entrega.

### D-04 — Os `GAP-nn` viram um cartão só (`DO-54`)

Oito GAPs abertos, com responsáveis diferentes (Jurídico, AWS, farmacêutico, médico, dev). Um
cartão por GAP transformaria a lista em ruído; um cartão com checklist mantém a visão de quantos
faltam sem ocupar oito posições no quadro.

### D-05 — Transcrição de norma termina no código, não no catálogo (`DO-55`)

> _"as transcrições que nos temos que pesquisar e referenciar no código"_

Uma norma transcrita que não aparece onde a regra é aplicada é documentação órfã: quem lê o
código não descobre que existe regra externa ali. O padrão já em uso — `CAN-04` citado em
`lib/conduta/receituario.ts`, `CFM-04` em `db/schema/revisoes-ia.ts` — passa a ser **requisito de
conclusão** da transcrição, não um hábito.

---

## §4 — O que fica rejeitado

| #    | rejeitado                               | motivo                                                                 |
| ---- | --------------------------------------- | ---------------------------------------------------------------------- |
| R-01 | Sprint 6 em paralelo ao QA              | achado de QA mudaria a base já em construção                           |
| R-02 | QA sem seed                             | falha por estado vazio, indistinguível de bug                          |
| R-03 | seed escrito sem mapeamento prévio      | descobre o que falta durante a execução; duas rodadas                  |
| R-04 | seed só com o caminho feliz             | sem o controle limpo, verde não prova nada                             |
| R-05 | um cartão de Trello por `GAP-nn`        | oito cartões de espera afogam os cartões de trabalho                   |
| R-06 | transcrever norma sem citá-la no código | documentação órfã — quem lê o código não descobre que há regra externa |

## §5 — Como se prova

Esta ADR é de **processo**, e processo não se prova com guarda de código. O que a torna
verificável:

- o **cartão 7** do Trello tem o roteiro completo, e cada item é marcado por quem testou;
- o **seed** declara no topo o que faz, como se desfaz e se é idempotente (convenção do `CLAUDE.md`);
- a **fila do `03`** mostra as quatro etapas antes da Sprint 6 — se a Sprint 6 começar com alguma
  aberta, a fila está mentindo, e isso é visível.

---

**Fontes.** Decisões do dev Davi em 25/08/2026: `DO-52`, `DO-53`, `DO-54`, `DO-55`, `DO-56`.
Estado medido nesta data: 322 casos de guarda em 10 arquivos, **zero** teste de navegador ou e2e
(`find` por `*.spec.*` e `*.e2e.*` em `app/ db/ lib/ components/` retorna vazio). Convenção de
seed e a regra do cenário de controle: `CLAUDE.md`, seção _"Todo bug vira teste"_.

**Princípios e fase:** D-01/D-03 **I** (testes e qualidade), fase 8 · D-02 **I** + **F** (dados),
fases 8 e 5 · D-04 **B** (fluxo de trabalho), fase 1 · D-05 **P** (revisão crítica) + **A**,
fase 3.
