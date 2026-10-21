# ADR-0009 — A recomendação de medicamento lista opções ranqueadas e **nunca** posologia

> **Status:** 📋 **proposta** — 24/08/2026.
> **Contexto:** o dono pediu que, ao expandir uma hipótese, apareçam até **3 medicamentos**
> ranqueados _"qual é melhor e porque"_. Isso parecia colidir de frente com a proibição nº 2 do
> `CLAUDE.md` — nada na tela dirige conduta — e a colisão precisava ser resolvida **antes** de
> escrever o componente, porque define o **tipo** do contrato.
> **Decisão:** as opções entram, ranqueadas, com justificativa e ressalvas. **Dose não entra** —
> nem no tipo, nem no fixture, nem na tela. A fronteira é `IMD-01` × `IMD-02`.

---

## §1 — O que a fonte diz

A `ANV-04` (RDC ANVISA 657/2022, Art. 4º) manda enquadrar SaMD por classe de risco. A
categorização de risco adotada internacionalmente vem do **IMDRF/SaMD WG/N12 FINAL:2014**, que
define três níveis de _significância da informação_. Dois deles delimitam esta tela — redação
confirmada em duas fontes independentes, com texto idêntico:

- **`IMD-01` — informar:** _"To inform clinical management: when SaMD is used to inform health
  care providers of **treatment options** or to aggregate relevant data to provide health care
  providers with clinical information."_
- **`IMD-02` — dirigir:** _"To drive clinical management: (…) or to **aid in treatment by
  providing enhanced support in the safe and effective use of drugs** or medical devices."_

🔴 **A leitura decisiva:** _"inform (…) of treatment options"_ **é** listar opções de tratamento.
Não é zona cinzenta, é a definição literal da categoria de **menor** risco. E o que atravessa
para `IMD-02` é _"enhanced support in the safe and effective use of drugs"_ — a frase que
descreve dose, frequência, titulação e checagem de interação.

**Portanto a contradição aparente não existia:** o `DO-29` e a proibição nº 2 cabem juntos, e a
linha entre eles é **dose**.

⚠️ **O que NÃO foi lido:** a RDC 185/2001 (classes, necessária para completar o `ANV-04`).
Enquadramento e classe são determinação de **Assuntos Regulatórios**, não de engenharia. Esta ADR
decide **desenho de tela**, não enquadramento.

🔴 **RETIFICADO em 24/08/2026 — as normas de Cannabis foram transcritas (`DO-45`), e uma delas
muda o desenho.** A versão original desta ADR citava a RDC 327/2019 como pendente; ela está
**revogada** pela RDC 1.015/2026 (`CAN-00`). O que a transcrição trouxe e afeta este componente:

- **`CAN-04`** — o **tipo de receituário é função do teor de THC**: ≤ 0,2 % usa Receita de
  Controle Especial; > 0,2 % exige **Notificação de Receita "A"**. A opção de medicamento
  sugerida precisa carregar o teor para que a Sprint 5 derive o receituário certo.
- **`CAN-05`** — THC acima de 0,2 % só para **doença debilitante grave** ou que ameace a vida.
  Uma opção com THC alto **não pode** ser oferecida sem que a condição se qualifique — é o
  gatilho que o `DO-42` pede.
- **`CAN-03`** — a prescrição descreve **nome completo do produto e concentração**, conforme a
  Autorização Sanitária. Reforça a D-04: `procedencia` não é enfeite; sem catálogo validado
  (`GAP-03`) não há "nome conforme a Autorização Sanitária".

**O que NÃO muda:** a D-02. Dose continua fora deste componente. `CAN-04` fala do **tipo de
receituário**, que é consequência do produto, não posologia — e a posologia segue sendo ato do
médico na Sprint 5.

## §2 — As decisões

### D-01 — Até 3 opções, ranqueadas, com o porquê da posição

`MAX_MEDICAMENTOS_POR_HIPOTESE = 3`, no contrato, e o componente corta por essa constante — não
por um `3` escrito à mão que divergiria no dia em que ela mudar.

Cada opção carrega `porQue`: por que vem **nesta** posição. É esse texto que faz a lista
informar em vez de mandar — sem ele, "1ª opção" é uma ordem.

**Rejeitado: uma recomendação única, "o melhor medicamento".** É o que a leitura literal do
`DO-29` sugeriria, e é o desenho que mais se aproxima de `IMD-03` (_"treat or diagnose"_, que
inclui predizer o **plano de tratamento**). Uma única saída também remove o gesto de escolha, que
é o que o HITL precisa que exista.
**Rejeitado: lista sem limite.** Três é o número que o próprio motor já usa para hipóteses, e
lista longa devolve a decisão ao software por exaustão do leitor.

### D-02 — Nenhum campo de dose, em lugar nenhum

O tipo `MedicamentoSugerido` **não tem** `dose`, `mg`, `frequencia`, `titulacao` nem `volume`. A
ausência é a decisão, não um "ainda não implementado".

**Rejeitado: incluir dose sugerida e marcá-la como "sugestão".** O rótulo não muda a função: a
tela passaria a dar suporte ao uso seguro e efetivo do fármaco, que é o texto do `IMD-02`.
Rótulo não reclassifica risco regulatório.
**Rejeitado: incluir faixa de dose ("comece baixo").** Mesma objeção, com aparência mais
inofensiva — e titulação é exatamente o exemplo canônico de `IMD-02`.

⚠️ **`concentracao` ficou permitida** de propósito: ela identifica o produto (_"óleo 200 mg/mL"_)
e hoje viaja dentro de `nome`, como texto. O que a converte em dose é multiplicá-la por
**volume** — e `volume` é campo proibido.

### D-03 — Ressalvas com o mesmo peso do argumento a favor

`ressalvas[]` aparece sob o título "O que pesa contra", em vermelho, dentro do mesmo cartão.

**Rejeitado: ressalva em tooltip ou nota de pé.** É a mesma decisão que já fez "o que contradiz"
aparecer junto de "o que sustenta" na ADR-0006: esconder a objeção transforma apoio à decisão em
confirmação de viés.

### D-04 — `procedencia` é obrigatória, e por causa de um GAP aberto

Cada opção declara se veio de `inferido_ia`, `catalogo_validado` ou `protocolo_institucional`.
O campo **não** é opcional.

Motivo: `GAP-03` (origem do corpus de canabidiol e quem o valida clinicamente) está **aberto**.
Enquanto estiver, tudo que o motor sugerir precisa chegar à tela marcado como sugestão de
modelo. Um campo opcional produziria, no primeiro esquecimento, uma sugestão de IA com a
aparência de item de catálogo assinado por farmacêutico.

### D-05 — A evidência da tela de decisão é o **mesmo componente** do painel

O dono pediu que "Sua decisão" mostrasse _"o mesmo dado que há em Hipóteses sugeridas pela IA"_.
`EvidenciaDaHipotese` é um componente, usado nos dois lugares; `evidenciaDa` é uma função, em
`lib/ia-clinica/evidencia.ts`.

**Rejeitado: duplicar o bloco na tela de decisão.** Atenderia o pedido hoje e o quebraria no
primeiro ajuste — as cópias divergem, e o médico revisaria na hora de decidir uma versão
diferente da que leu. Num passo de HITL, revisão que dá falsa segurança é pior que revisão
ausente.

### D-06 — Abrir para reler **não** seleciona

Na tela de decisão, cada opção tem dois botões **irmãos**: escolher e revisar. Estados
separados (`hipoteseId` e `revisandoId`).

**Rejeitado: um clique que abre e seleciona.** Menos cliques, e defeito grave: o médico
selecionaria uma hipótese só por ter querido conferi-la. Seleção acidental num passo de HITL é o
pior defeito possível, porque o registro fica com o nome dele.

### D-07 — O modo `denso` encolhe a caixa, nunca o conteúdo

Para o sidebar da teleconsulta (`denso`): cartões nascem fechados, tipografia cai um passo, o
rótulo textual do botão de revisar sai (fica o ícone, com `aria-label`).

**Rejeitado: esconder ressalvas ou rótulo de procedência para caber na coluna.** Seria trocar a
regra por layout — e a coluna estreita é onde a pressa é maior, ou seja, exatamente onde a
objeção precisa estar visível.

## §3 — O que fica de fora, e por quê

| fora                              | por quê                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| dose, frequência, titulação       | `IMD-02`. É a Sprint 5, na prescrição, com ato do médico     |
| botão de prescrever nesta tela    | proibição nº 2 do `CLAUDE.md`; a prescrição é tela própria   |
| catálogo real de produtos Be4Hope | `GAP-03` aberto — decisão de farmacêutico, não de engenharia |
| conteúdo clínico validado         | o fixture é **ilustrativo** e diz isso no próprio arquivo    |

## §4 — Como se sabe que continua valendo

Guarda `medicacao-informa-nao-prescreve`, **44 casos**. Ele quebra o build se um campo de dose
entrar no contrato ou no fixture, se um clique ligar sugestão a prescrição, se `procedencia`
virar opcional, se o limite de 3 sair da constante, ou se a evidência da decisão deixar de ser o
mesmo componente do painel.

🔴 **Retratação registrada:** a primeira versão do detector de posologia comparava o nome do
campo por **igualdade** contra uma lista. A sabotagem que acrescentou `doseMg` **passou verde** —
o guarda dava a garantia falsa. Corrigido quebrando o nome em tokens (camelCase e `_`) e testando
cada token contra o **radical**, com 18 casos de controle: 8 provando que grafia composta é
acusada, 10 provando que campo legítimo não é. Era a Regra 1 da técnica sendo violada — _derive,
não liste_.
