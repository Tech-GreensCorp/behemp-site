# ADR-0005 — Conduta, prescrição, dosagem e titulação são uma cadeia sequencial, não alternativas

> **Status:** 📋 **proposta** — 20/08/2026.
> **Contexto:** ao ser perguntado se a conduta gera _dosagem com titulação_ **ou** vai _direto
> para prescrição_, o dono respondeu: _"acho que a 1 e a segunda são sequenciais não?"_. Está
> certo — a pergunta oferecia como exclusivas duas etapas da mesma cadeia. Esta ADR corrige e
> registra o encaixe.
> **Decisão:** a conduta clínica desemboca em **dois artefatos com naturezas diferentes** — o
> documento legal e o plano terapêutico vivo — e a titulação acontece sobre o segundo.

---

## §1 — O que o schema já modela

Quatro tabelas existentes cobrem a cadeia inteira, sem nada a criar:

| tabela                                  | natureza                                         | o que guarda                                                                                                   |
| --------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `prescricoes`                           | **documento legal**, imutável depois de assinado | ICP-Brasil, SNCR, PDF assinado, validade, `medicamentos` JSONB                                                 |
| `dosagens`                              | **plano vigente**, um por vez (`ativa`)          | `gotasPorDia`, `mlFrasco`, `dataInicio`, `dataFimPrevista`                                                     |
| `ajustesDosagem` + `itensAjusteDosagem` | **a titulação**, histórico                       | `dosagemAnterior` → `novaDosagem`, `motivoAjuste`, `proximaRevisao`, `concentracaoTHC/CBD`, `viaAdministracao` |
| `medicamentos`                          | **catálogo**                                     | `cbdMgPorGota`, `thcMgPorGota`, `tipoEspectro`, `gotasPorMl`                                                   |

🎯 A cadeia não precisa ser inventada. Precisa ser **ligada e mostrada**.

## §2 — As decisões

### D-01 — A conduta produz dois artefatos, e eles não se substituem

```
conduta aprovada pelo médico
        ├──> prescricoes   documento legal, assinado, imutável, com validade
        └──> dosagens      plano vigente (ativa=true), base do acompanhamento
                                  │
                                  └──> ajustesDosagem   titulação: motivo + próxima revisão
```

**Rejeitado: conduta gerar só prescrição.** Perde a titulação — que, no canabidiol, **é** o
tratamento. _"Start low, go slow"_ pressupõe ajuste guiado por efeito ao longo de semanas, e
prescrição assinada não é lugar de registrar isso.

**Rejeitado: conduta gerar só dosagem.** Sem prescrição não há documento legal, ICP-Brasil nem
SNCR. O paciente não compra.

### D-02 — Ajustar a dose **não** reescreve a dosagem anterior

Cada ajuste cria linha em `ajustesDosagem`, com `dosagemAnterior`, `novaDosagem`, `motivoAjuste`
e `proximaRevisao`. A `dosagens` anterior é desativada, não apagada.

**Rejeitado: `UPDATE` em `dosagens.gotasPorDia`.** Apaga a curva de titulação — e viola a
proibição de sobrescrever histórico clínico.

### D-03 — Nem todo ajuste de dose gera prescrição nova

Ajuste dentro do que a prescrição vigente já autoriza atualiza só o plano. Ajuste que extrapola
exige prescrição nova.

⚠️ ~~**`GAP-14`: onde fica essa fronteira é decisão clínica e regulatória**, não de TI. Até a
resposta, a tela **pergunta** ao médico em vez de decidir.~~

**Rejeitado: gerar prescrição a cada ajuste.** Enche o SNCR e o paciente de documentos.
**Rejeitado: nunca gerar.** Deixaria o paciente sem documento válido para a dose que toma.

#### 🔴 RETIFICAÇÃO — `GAP-14` RESOLVIDO em 24/08/2026 (`DO-44`)

A versão acima fica registrada, porque o caminho ensina. O dono respondeu, e a resposta é mais
ampla do que a pergunta: ele não delimitou **quando** gerar prescrição — decidiu **o que tem de
acontecer sempre que houver ajuste**.

> _"o médico pode ajustar claro, mas isso tem que ser notificado pelo paciente e a dosagem ou
> medicamento anterior tem que ficar no historico tanto do paciente quanto no historico de
> prescrições dentro do nome do paciente, creio que o certo era separar por paciente além de ter
> o filtro de geral aonde vê todos os medicamentos prescritos, tem que ta bem desenhado intuitivo
> e nada muito cheio pra nao bagunçar a mente do médico"_

**Quatro obrigações, todas de todo ajuste:**

| #   | obrigação                                         | consequência técnica                                                                                                                                                                     |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **O médico pode ajustar** — a autonomia é dele    | nenhum bloqueio; a tela não impede                                                                                                                                                       |
| 2   | **O paciente é notificado**                       | o ajuste dispara notificação; usa a infraestrutura que já existe (`notificacoes`, Pusher, Brevo)                                                                                         |
| 3   | **O anterior fica no histórico, em DOIS lugares** | no histórico do **paciente** e no histórico de **prescrições sob o nome do paciente**. `ajustesDosagem` já guarda `dosagemAnterior` e `novaDosagem` — a segunda superfície é a que falta |
| 4   | **A tela separa por paciente, com filtro geral**  | visão por paciente é a padrão; o "todos os medicamentos prescritos" é filtro, não a tela inicial                                                                                         |

**E uma restrição de desenho que é requisito, não gosto:** _"bem desenhado intuitivo e nada muito
cheio pra não bagunçar a mente do médico"_. Numa tela que decide dose, densidade excessiva é risco
clínico, não desconforto estético.

⚠️ **A pergunta original continua sem resposta, e isso está certo.** O dono não disse **quando** o
ajuste exige prescrição nova — ele disse o que sempre acontece. Então o entregável 7 da Sprint 5
**permanece**: a tela **pergunta** ao médico se gera prescrição nova. Deixou de ser bloqueio e
passou a ser desenho deliberado: quem sabe se a dose nova extrapola a prescrição vigente é o
médico, e perguntar é mais honesto que adivinhar.

🔴 **E a transcrição de 24/08 acrescentou um dado que o dono não tinha quando decidiu:** pelo
`CAN-04`, o **tipo de receituário depende do teor de THC** — ≤ 0,2 % é Receita de Controle
Especial, acima disso exige **Notificação de Receita "A"**. Portanto, um ajuste que **troca o
produto** para outro de faixa diferente de THC **muda o tipo de receituário**, e aí a prescrição
nova ~~deixa de ser opcional~~. Isso não estava na pergunta e precisa voltar ao dono.

#### 🔴 TERCEIRA VERSÃO — a pergunta voltou ao dono e foi respondida em 25/08/2026 (`DO-47`)

As duas versões acima ficam. A pergunta que o parágrafo anterior deixou aberta — _"ajuste que
troca a faixa de THC torna a prescrição nova obrigatória?"_ — foi feita e respondida:

> _"isso é opcional com aviso, o médico quem deve seguir o procedimento correto, o sistema
> avisa."_

**Então a resposta é NÃO: continua opcional.** O que a troca de faixa produz é um **aviso**, não
uma imposição. A tela diz _"este produto muda o tipo de receituário de X para Y"_ e o médico
decide — exatamente como já decide se gera prescrição nova nos demais casos.

E na mesma resposta o dono decidiu **de quem é o teor** (`DO-46`):

> _"além de que isso é algo que o 'MÉDICO' preenche não o SISTEMA."_

**Consequência para o entregável 9 da Sprint 5**, que dizia _"a tela **deriva** o tipo de
receituário"_: ela **não deriva**. O médico informa o teor; a tela calcula o aviso a partir do
que ele informou, e o registra junto da decisão. Sem campo preenchido, **não há aviso** — e a
tela diz que não há, em vez de assumir a faixa mais confortável.

**Rejeitado: derivar o teor de `thcMgPorGota`.** É aritmeticamente possível chegar a mg/ml, mas
converter em **percentual** exige saber se a base é m/m ou m/v e, na primeira, a densidade — que o
schema não tem. Pior: `CAN-03` diz que a concentração válida é a da **Autorização Sanitária**, não
uma conta nossa. Um número derivado por nós, exibido como fato regulatório, é a classe de erro que
o `CLAUDE.md` chama de _regra presumida_ — e aqui ela decidiria qual receituário controlado usar.

**Rejeitado: bloquear a conduta enquanto o teor não estiver preenchido.** Levantar os teores do
catálogo é trabalho do chefe, fora desta sprint (`DO-46`). Bloquear tornaria a tela inutilizável
até que trabalho de terceiro terminasse.

O desenho que sai das duas decisões está em
[ADR-0012](ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md).

### D-04 — A ponte com o receituário não altera o receituário

A conduta **preenche** a prescrição e entrega ao fluxo existente (`lib/receituario/`,
`PrescricaoInlineWizard`). Assinatura, PDF, SNCR e validade permanecem como estão.

**Rejeitado: reescrever o módulo de prescrição para acomodar a conduta.** É ICP-Brasil em
produção; o handoff proíbe mexer no JSONB de `prescricoes` por alimentar PDF assinado e SNCR.

### D-05 — O `medicamentoId` acompanha a conduta desde o início

`dosagens.medicamentoId` é FK real para `medicamentos`. A conduta nasce com o id, não com nome
em texto.

⚠️ Isto **não** corrige o Item 4 do checklist (`prescricoes.medicamentos` é JSONB sem FK). Esse
achado continua catalogado e sem autorização. O que esta decisão garante é que **o caminho novo
não repete o defeito** — ele chega ao JSONB já sabendo qual é o medicamento.

**Rejeitado: seguir o padrão do JSONB de texto livre por consistência.** Consistência com o
defeito conhecido não é justificativa.

---

## §3 — O que fica rejeitado

| #    | rejeitado                                | motivo                                      |
| ---- | ---------------------------------------- | ------------------------------------------- |
| R-01 | conduta gerar só prescrição              | perde a titulação, que é o tratamento       |
| R-02 | conduta gerar só dosagem                 | sem documento legal o paciente não compra   |
| R-03 | `UPDATE` na dosagem ao ajustar           | apaga a curva de titulação                  |
| R-04 | prescrição nova a cada ajuste            | enche SNCR e paciente de documento          |
| R-05 | nunca gerar prescrição no ajuste         | paciente sem documento para a dose que toma |
| R-06 | reescrever o módulo de receituário       | ICP-Brasil em produção                      |
| R-07 | conduta com nome de medicamento em texto | repete o Item 4 no caminho novo             |

## §4 — Como se prova

| guarda                    | falha quando                                                         |
| ------------------------- | -------------------------------------------------------------------- |
| `dosagem-nao-sobrescreve` | ajuste fizer `UPDATE` em `gotasPorDia` em vez de nova linha + ajuste |
| `conduta-com-fk`          | conduta gravar medicamento sem `medicamentoId`                       |
| `uma-dosagem-ativa`       | existir mais de uma `dosagens.ativa = true` por paciente/medicamento |
| `receituario-intacto`     | o fluxo de assinatura/SNCR for alterado pelo caminho da conduta      |

---

**Fontes.** Primárias medidas: `db/schema/{dosagens,ajustes-dosagem,medicamentos,prescricoes}.ts`.
Titulação _"start low, go slow"_: [PMC8120104](https://pmc.ncbi.nlm.nih.gov/articles/PMC8120104/)
e [PMC9821014](https://pmc.ncbi.nlm.nih.gov/articles/PMC9821014/) — localizadas, citadas pelo
trecho, **não lidas na íntegra**. Regra brasileira (RDC 327/660, RDC 1.000/25) **pendente**.

**Princípios e fase:** D-01/D-02/D-05 **F** (dados), fase 5 · D-03 **D** (regra e resiliência),
fase 7 · D-04 **A** (arquitetura, não quebrar o que funciona), fase 3.
