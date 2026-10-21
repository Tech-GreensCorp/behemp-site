# ADR-0011 — A divergência do médico alimenta o RAG, e o rascunho da revisão nunca se perde

> **Status:** ✅ **decidida pelo dono** — 24/08/2026 (`DO-40`, `DO-41`).
> **Contexto:** a Sprint 4 entregou "Divirjo da análise" gravando `validacao: 'divergente'` e uma
> conclusão em texto livre. Faltavam dois entregáveis (E3 e E7) e o dono definiu o que eles são.
> **Decisão:** ao divergir, o médico pode escrever **por que a IA errou** (opcional) e informa
> **qual medicamento vai prescrever**; os dois viram insumo do RAG. E o rascunho da revisão
> **persiste com histórico**, como no VidAI.

---

## §1 — O que o dono decidiu, literal

> `DO-40`: _"a hipotese manual em divirjo ela tem que ter também a alimentação do rag ou seja
> precisa de um texto explicando porque a ia errou (opcional) além de ter também o medicamento na
> qual o médico vai prescrever"_

> `DO-41`: _"no E7 nós precisamos fazer isso pois o médico pode sair sem querer e esse dado
> precisa ficar salvo, ou seja precisa ter um historico assim como tem no vid-ai"_

## §2 — Por que as duas coisas estão na mesma ADR

Porque são a mesma pergunta vista de dois ângulos: **o que o sistema guarda do ato do médico, e
para quê.** Uma decide o destino do juízo dele (vira insumo de recuperação); a outra decide a
durabilidade do trabalho dele (não se perde ao fechar a aba). As duas criam persistência de
conteúdo clínico escrito à mão, e as duas têm a mesma pergunta de LGPD por baixo.

## §3 — As decisões

### D-01 — Divergir passa a ter três campos, não um

| campo                              | obrigatório?              | para quê                                                |
| ---------------------------------- | ------------------------- | ------------------------------------------------------- |
| conclusão do médico                | **sim** (já era)          | o que ele concluiu                                      |
| **por que a IA errou**             | **não** — decisão do dono | insumo de RAG e medida de qualidade                     |
| **medicamento que vai prescrever** | **sim**, ao divergir      | fecha o ciclo: divergência sem conduta não informa nada |

**Rejeitado: tornar o "por que errou" obrigatório.** O dono disse _(opcional)_, e há razão
técnica para respeitar: campo obrigatório em texto livre no meio de consulta produz preenchimento
ritual — _"discordo"_, _"não se aplica"_ — que polui o corpus mais do que a ausência.

**Rejeitado: deixar o medicamento fora, como já estava.** Divergência que não diz o que o médico
fez em vez da sugestão mede que o modelo errou, mas não **para onde** ele deveria ter apontado. É
metade do sinal.

### D-02 — 🔴 Divergência vira insumo de RAG, e isso é decisão com consequência jurídica

O texto do médico e o medicamento escolhido alimentam a recuperação do motor (Sprint 10).

⚠️ **Isto cria uma finalidade nova para dado clínico**, e finalidade nova exige base legal
própria — LGPD art. 7º e, para dado de saúde, art. 11. O dado que entra no corpus foi coletado
para **tratar aquele paciente**; usá-lo para **melhorar o modelo** é outra coisa.

**Três salvaguardas que decorrem disso, e que a implementação deve cumprir:**

1. **O que vai ao corpus é o raciocínio, não o paciente.** Texto do médico e medicamento, sem
   identificador do paciente. O repositório já mascara PII por regex antes de chamar o Gemini
   (`app/api/teleconsulta/transcrever/route.ts`); o mesmo tratamento se aplica aqui, **e é
   mínimo, não suficiente** — texto livre escrito por humano pode conter identificador que regex
   não pega.
2. **O médico sabe que está alimentando o corpus.** A tela diz, no ponto de escrita. Campo que
   silenciosamente vira dado de treino é coleta sem informação ao titular do ato.
3. **Marcado na origem.** O que entra do médico é `revisao_humana`, distinguível do corpus
   normativo. Sem isso, opinião de um médico e RDC ficam indistinguíveis dentro do RAG — que é
   exatamente o defeito que o `procedencia` da ADR-0009 D-04 existe para impedir na tela.

🔴 **Pendência aberta para o Jurídico**, não para a engenharia: **base legal do uso secundário**.
Registrado como `GAP-16`. A **estrutura** pode ser construída agora (campos, marcação de origem,
aviso na tela); a **ingestão no corpus** não liga até a resposta.

**Rejeitado: alimentar o corpus sem marcar origem.** Torna a divergência de um médico
indistinguível de norma.
**Rejeitado: esperar o Jurídico para construir os campos.** Os campos servem à qualidade do
registro clínico por si sós, independentemente do RAG — a divergência justificada é o que sustenta
a Trava 2.

### D-03 — O rascunho persiste no **servidor**, não no navegador

**Rejeitado: `localStorage`.** É o caminho de três linhas, e foi rejeitado com motivo: rascunho de
conclusão clínica em `localStorage` é **dado de saúde no navegador**, e navegador de consultório
pode ser compartilhado entre médicos ou com a recepção. Também não sobrevive a trocar de máquina
— e o médico que começou no consultório e continua em casa perde tudo, que é justamente o caso
que o `DO-41` quer evitar.

**Rejeitado: salvar só ao sair (`beforeunload`).** Não dispara em queda de energia, aba morta por
memória, nem em iOS de forma confiável. _"O médico pode sair sem querer"_ inclui os casos em que
o navegador não avisa ninguém.

**Decidido:** rascunho no servidor, autosave com debounce, ligado ao médico **e** ao paciente,
com `garantirMedicoDoPaciente` — mesmo escopo de objeto das 5 actions da anamnese.

### D-04 — Histórico de rascunhos, não sobrescrita

_"precisa ter um historico assim como tem no vid-ai"_. Cada salvamento significativo preserva o
anterior.

Isto não é preferência: é a **proibição nº 4** do `CLAUDE.md` — _não sobrescrever histórico
clínico_. Um rascunho que só guarda o último estado perde a versão que o médico tinha antes de
uma edição acidental, que é metade do motivo de existir.

⚠️ **Retenção precisa de prazo declarado.** Rascunho é dado de saúde e não pode ficar para sempre
sem regra. O campo existe; **o número é decisão do Jurídico** e fica vazio até responderem — nunca
se chuta prazo de retenção.

## §4 — O que fica de fora

| fora                                                   | por quê                                                              |
| ------------------------------------------------------ | -------------------------------------------------------------------- |
| ingestão real no corpus do RAG                         | Sprint 10, e bloqueada por `GAP-16` (base legal) e `GAP-03` (corpus) |
| autocompletar o medicamento a partir da sugestão da IA | seria caminho de um clique entre sugestão e conduta — proibição nº 2 |
| rascunho compartilhado entre médicos                   | rascunho é do autor; compartilhar é publicar sem revisão             |

## §5 — Como se saberá que continua valendo

Guarda a escrever junto com a implementação, `divergencia-e-rascunho-nao-se-perdem`:

- o campo "por que a IA errou" é **opcional** e o de medicamento é **obrigatório ao divergir**
- o rascunho **não** usa `localStorage`/`sessionStorage` em nenhum caminho
- salvar rascunho **insere**, nunca faz `update` destrutivo do anterior
- a action de rascunho tem escopo de objeto (`garantirMedicoDoPaciente`)
- o que sai para o corpus carrega marcação de origem `revisao_humana`

---

## §5 — IMPLEMENTADO em 25/08/2026, e o que a implementação ensinou

**D-01 e D-02 (E3)** — os dois campos estão em `revisoes_ia`, com a obrigatoriedade que o
`DO-40` pediu: medicamento **obrigatório**, explicação **opcional**. A regra vive no servidor
(`app/_actions/revisao-ia.ts`), num `refine` de Zod — cliente forjado gravaria divergência sem
desfecho, e a série deixaria de medir.

🔴 **O que a implementação acrescentou à decisão:** a coluna `ingeridoNoCorpusEm`, que **nasce e
fica vazia**. A D-02 dizia que o `GAP-16` bloqueia a ingestão e não a construção dos campos —
mas não dizia **como** garantir isso no código. Agora diz: a coluna existe (para que a ingestão
futura seja rastreável) e um caso de guarda varre `app/`, `lib/` e `components/` procurando
qualquer escrita nela. A sabotagem que a preencheu ficou vermelha.

Sem essa coluna, "não ingerimos ainda" seria uma afirmação sem prova.

**D-03 e D-04 (E7)** — o rascunho vai para `rascunhos_revisao_ia`, tabela **própria**.

🔴 **A D-03 dizia "no servidor" mas não dizia ONDE.** A implementação decidiu, e o motivo entra
aqui: `revisoes_ia` é a **prova regulatória** do ato humano — é ela que sustenta o argumento de
que o software informa em vez de dirigir (RDC 657/2022). Misturar rascunho com decisão
registrada enfraquece esse argumento: uma auditoria que encontre dez linhas por consulta
precisaria distinguir decisão de digitação a meio caminho. Tabela própria torna a separação
estrutural, não convencional.

Cada salvamento **insere** (`versao` crescente); não há `update`. O prazo de retenção existe
como coluna e **fica vazio** — é decisão do Jurídico, e não se chuta.

A reidratação preenche **só o que está vazio**, nunca por cima do que o médico já digitou — é o
`preservarCamposHitl()` do VidAI (P7), e o guarda cobra o padrão `setConclusao((v) => v || …)`.
