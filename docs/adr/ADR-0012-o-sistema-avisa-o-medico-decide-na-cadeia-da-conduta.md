# ADR-0012 — O sistema avisa, o médico decide: como a cadeia da conduta se liga sem duas verdades

> **Status:** ✅ **aceita** — 25/08/2026.
> **Contexto:** ao abrir a Sprint 5 (item 7 da fila), a leitura do código mostrou que a cadeia
> `conduta → {prescrição, dosagem} → titulação` **não é greenfield**: metade dela já existe, em
> duas representações que não se falam e que contradizem a [ADR-0005](ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md)
> em três pontos. Em 25/08 o dono decidiu `DO-46`, `DO-47` e `DO-48`, que fixam **quem** aplica
> a norma na tela.
> **Decisão:** `dosagens` é o **plano vigente** e `ajustesDosagem` é o **ato de ajustar**; as duas
> se ligam por colunas **aditivas**, e o caminho novo é o único que aceita dado novo. Diante de
> divergência regulatória, a tela **avisa** — nunca deriva sozinha nem trava.

---

## §1 — O que a leitura do código achou, e que a ADR-0005 não sabia

A ADR-0005 §1 diz que _"a cadeia não precisa ser inventada, precisa ser ligada e mostrada"_. Está
certa quanto ao schema e **incompleta quanto ao código**: três dos oito entregáveis originais já
têm implementação, e ela viola os rejeitados da própria ADR-0005.

| entregável                | o que já existe                                                                                                  | o conflito                                                                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **1 e 3** conduta e ponte | `app/(medico)/_actions/prescricao-inline.ts` (395 linhas) + `components/teleconsulta/PrescricaoInlineWizard.tsx` | só existe dentro da teleconsulta (`salaId`); `montarJsonbMedicamento():94` **descarta** o `medicamentoId` que o formulário aceita → é o **R-07** |
| **4** criar `dosagens`    | `app/_actions/dosagens.ts:47` — desativa a anterior e insere nova ✅                                             | `atualizarDosagem():120` faz **`UPDATE` em `gotasPorDia`** → é o **R-03**, _"apaga a curva de titulação"_                                        |
| **5 e 6** ajuste e curva  | `tab-dosagem.tsx` (383 linhas) + `app/_actions/ajustes-dosagem.ts`                                               | grava **texto livre** (`"Ex: 20mg 2x/dia"`), sem `medicamentoId`; tem **Editar** (substitui os itens) e **Excluir**; **não notifica** o paciente |

**A consequência que organiza esta ADR:** existem hoje **duas representações concorrentes do plano
terapêutico** — `dosagens` (numérica, com FK, uma ativa por vez) e `ajustesDosagem`/`itensAjusteDosagem`
(textual, sem FK, editável e apagável). A ADR-0005 as descreve como camadas da mesma cadeia; o
código as tem como sistemas separados. Sem decidir qual é a fonte de verdade, cada entregável da
Sprint 5 empurra o problema para o seguinte.

---

## §2 — As decisões

### D-01 — `dosagens` é o plano vigente; `ajustesDosagem` é o ato de ajustar

Não são alternativas, e nenhuma das duas é redundante:

| tabela                                  | responde à pergunta                             | por que ela, e não a outra                                                                                                              |
| --------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `dosagens`                              | **o que o paciente toma hoje**                  | tem `medicamentoId` FK (D-05 da ADR-0005 exige), `gotasPorDia` **numérico** (sem o qual não há mg/dia nem `dataFimPrevista`), e `ativa` |
| `ajustesDosagem` + `itensAjusteDosagem` | **por que mudou, e quando é a próxima revisão** | tem `motivoAjuste` e `proximaRevisao`, que `dosagens` não tem — e é o histórico que a titulação **é**                                   |

**A ligação é aditiva, não destrutiva.** `itensAjusteDosagem` ganha três colunas **nullable**:
`medicamentoId` (FK → `medicamentos`), `dosagemAnteriorId` e `novaDosagemId` (FK → `dosagens`).
Linha antiga fica com os três nulos e continua válida — é o **histórico legado, em texto livre**,
que o `DO-48` manda preservar.

**Rejeitado: `ajustesDosagem` como fonte de verdade.** É texto livre. `"20mg 2x/dia"` não permite
calcular mg/dia, não permite alertar fim de frasco, e não permite dizer **qual produto** — que é o
que o `CAN-03` obriga a descrever na prescrição.

**Rejeitado: tabela nova de "conduta".** Três tabelas já cobrem a cadeia; uma quarta criaria a
**terceira** representação do mesmo fato — que é exatamente o defeito que esta ADR existe para
fechar.

**Rejeitado: migrar as linhas textuais existentes para o formato novo.** Exigiria interpretar
`"Ex: 20mg 2x/dia"` por regex e **gravar como fato clínico** o resultado de um palpite. O
`renovarUltimaPrescricao():320-345` já faz esse tipo de parse — e ali é para **pré-preencher um
formulário que o médico revisa**, não para persistir.

### D-02 — O teor de THC é campo do médico; a tela **avisa** o tipo de receituário, não o deriva

Decidido pelo dono em `DO-46` e `DO-47`. O desenho que sai daí:

1. `medicamentos` ganha `teorThcPercentual` **nullable** — a **casa** do dado. Fica **vazia**:
   levantar os teores do catálogo é trabalho do chefe, fora desta sprint (`DO-46`).
2. Na conduta, o campo aparece **pré-preenchido** com o do catálogo quando existir, e **editável**
   pelo médico. O que ele informa vale **para aquele ato** e **não sobrescreve o catálogo**.
3. A tela calcula o **aviso** — `≤ 0,2 %` → Receita de Controle Especial · `> 0,2 %` → Notificação
   de Receita "A" (`CAN-04`) — e o mostra ao lado da escolha.
4. **Campo vazio não vira aviso.** A tela diz que **não sabe**, em vez de assumir a faixa mais
   confortável. Silêncio que parece aprovação é a pior das três saídas.
5. O que o sistema avisou e o que o médico decidiu ficam em **auditoria** (`logsAuditoria`) —
   inclusive quando ele decide diferente. É a proibição nº 2 do `CLAUDE.md` aplicada aqui.

**Rejeitado: derivar o teor de `thcMgPorGota`.** Chega-se a mg/ml, mas o **percentual** depende de
a base ser m/m ou m/v e, na primeira, da densidade — que o schema não tem. E `CAN-03` diz que a
concentração válida é a da **Autorização Sanitária**, não uma conta nossa. Número derivado por nós
e exibido como fato regulatório decidiria **qual receituário controlado usar**.

**Rejeitado: travar a oferta de produto com THC alto.** Seria o software **dirigindo** a conduta —
`IMD-02` — quando o lugar desta tela é `IMD-01`, **informar**. E o dono foi literal: _"o sistema
avisa"_.

**Rejeitado: bloquear a conduta enquanto o catálogo não tiver teores.** Tornaria a tela
inutilizável até que trabalho de terceiro terminasse.

⚠️ **Pendente, e não presumido:** o `CAN-05` (THC > 0,2 % restrito a doença debilitante grave) **não
foi perguntado**. A lógica de `DO-46` + `DO-47` sugere que também seja aviso — sugestão não é
decisão. Pergunta ao dono **antes do entregável 10**, junto da leitura da RDC 38/2013.

### D-03 — A tela antiga vira leitura; o caminho novo é o único que aceita dado

`DO-48`, opção B. Em `tab-dosagem.tsx`:

- o histórico já digitado **continua visível**, com os mesmos dados;
- **Novo Ajuste**, **Editar** e **Excluir** saem da tela;
- um aviso aponta para o caminho novo.

**As actions `editarAjusteDosagem` e `excluirAjusteDosagem` continuam existindo** e ficam
catalogadas — remover export de `'use server'` sem conferir todos os pontos de chamada é mudança
de superfície de API em produção, e não é a tarefa desta sprint.

**Rejeitado: apagar a tela antiga.** Perderia a leitura do histórico já digitado.
**Rejeitado: deixá-la aceitando dado novo.** Cada linha nova em texto livre é uma linha que nunca
sustentará `CAN-03` nem `CAN-04`, e que alguém terá de interpretar por regex depois.

### D-04 — Duas superfícies, uma origem

O `DO-44` (c) pede tela **separada por paciente** com **filtro geral**, e o `DO-44` (b) pede o
anterior no histórico em **dois lugares**. São coisas diferentes, e viram:

| superfície                               | onde                                                | o que mostra                                                                                    |
| ---------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **por paciente** (a padrão)              | aba do prontuário — ao lado da `tab-dosagem` legada | plano vigente, curva de titulação, e o botão de ajustar                                         |
| **geral** (o filtro)                     | rota nova em `(medico)`                             | todos os medicamentos prescritos, filtrável — **é filtro, não a tela inicial** (`DO-44` c)      |
| **histórico de prescrições do paciente** | `tab-prescricoes.tsx`, que já existe                | o ajuste aparece ali também, sob o nome do paciente — é a **segunda** superfície do `DO-44` (b) |

**Uma origem:** as três leem `dosagens` + `ajustesDosagem`. Nenhuma guarda cópia.

**Rejeitado: começar pela tela geral.** O dono foi explícito: _"o certo era separar por paciente
além de ter o filtro de geral"_ — geral é **filtro**, não a porta de entrada.

### D-05 — O caminho novo nasce com escopo de objeto, e o helper nasce em `lib/auth/`

As três actions de dosagem existentes usam `verificarMedicoOuAdmin`, que prova **papel e não
vínculo**: médico A opera o paciente do médico B. É a mesma classe de BOLA (OWASP API1) já
corrigida na teleconsulta pelo `garantirDonoDaSala`.

O helper equivalente **existe duplicado** — `app/_actions/revisao-ia.ts:33` e
`app/_actions/anamnese-baseline.ts:52` — e nunca em `lib/auth/`. O caminho novo importa de
`lib/auth/escopo-paciente.ts`, ao lado de `escopo-sala.ts`.

**Rejeitado: copiar o helper uma terceira vez.** Três cópias divergem na primeira correção.
**Rejeitado: refatorar os dois arquivos existentes agora.** É fora do escopo — vai catalogado, com
o perigo medido, em [`04`](../04-LISTA-DE-AFAZERES.md).

---

## §3 — O que fica rejeitado

| #    | rejeitado                                       | motivo                                                              |
| ---- | ----------------------------------------------- | ------------------------------------------------------------------- |
| R-01 | `ajustesDosagem` como fonte de verdade do plano | texto livre não sustenta mg/dia, alerta de frasco nem `CAN-03`      |
| R-02 | tabela nova de "conduta"                        | criaria a terceira representação do mesmo fato                      |
| R-03 | migrar as linhas textuais por regex             | persistiria palpite como fato clínico                               |
| R-04 | derivar o teor de THC de `thcMgPorGota`         | premissa não declarada (m/m × m/v) decidindo receituário controlado |
| R-05 | travar a oferta de produto com THC alto         | o software passaria a **dirigir** a conduta (`IMD-02`)              |
| R-06 | bloquear a conduta com catálogo sem teores      | inutiliza a tela até trabalho de terceiro terminar                  |
| R-07 | apagar a tela antiga de dosagem                 | perde o histórico já digitado                                       |
| R-08 | deixar a tela antiga aceitando dado novo        | cada linha nova é dívida que ninguém consegue interpretar depois    |
| R-09 | começar pela tela geral                         | o dono decidiu que geral é **filtro**, não porta de entrada         |
| R-10 | terceira cópia do `garantirMedicoDoPaciente`    | três cópias divergem na primeira correção                           |

---

## §4 — Como se prova

⚠️ **Regra observada:** guarda para violação **conhecida e não corrigida** só entra **depois** da
correção (`.claude/rules/seguranca-lgpd.md`). Os guardas abaixo cobrem o **caminho novo**; o que
existe hoje está catalogado no [`03`](../03-CHECKLIST-MESTRE.md) e no [`04`](../04-LISTA-DE-AFAZERES.md).

| guarda                                 | fica vermelho quando                                                                                       |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `titulacao-nao-sobrescreve-o-anterior` | o caminho novo fizer `UPDATE` em `gotasPorDia`, ou o ajuste não criar linha em `ajustesDosagem`            |
| `conduta-carrega-o-medicamento-id`     | a conduta nova gravar medicamento sem `medicamentoId`                                                      |
| `so-uma-dosagem-ativa`                 | o caminho novo inserir dosagem sem desativar a anterior do mesmo paciente + medicamento                    |
| `o-sistema-avisa-nao-decide`           | o tipo de receituário for gravado sem ato do médico, ou a tela travar a escolha, ou teor vazio virar aviso |
| `a-ponte-nao-altera-o-receituario`     | o caminho da conduta tocar `lib/receituario/`, a assinatura, o SNCR ou a forma do JSONB                    |

---

**Fontes.** Primárias **lidas e medidas** neste repositório: `app/(medico)/_actions/prescricao-inline.ts`,
`app/_actions/dosagens.ts`, `app/_actions/ajustes-dosagem.ts`, `app/(paciente)/_actions/dosagem.ts`,
`app/(medico)/medico/pacientes/[id]/_components/tab-dosagem.tsx`, `db/schema/{dosagens,ajustes-dosagem,medicamentos,prescricoes}.ts`,
`db/seed-produtos.ts`. Normativas **transcritas** em [`02`](../02-CATALOGO-DE-REGRAS.md): `CAN-02`…`CAN-05`
(RDC 1.015/2026), `REC-02`/`REC-03` (RDC 1.000/2025), `IMD-01`…`IMD-03` (IMDRF N12:2014). Padrão de
segurança: **OWASP API Security Top 10 — API1:2023 Broken Object Level Authorization**.
⚠️ **Não lidas:** RDC 38/2013 e RDC 873/2024 — nomeadas por `CAN-05` e `REC-05`, na fila do [`03`](../03-CHECKLIST-MESTRE.md).

**Princípios e fase:** D-01 **F** (banco e arquitetura de dados), fase 5 · D-02 **D** (regra e
resiliência) + **P** (revisão crítica do que a máquina afirma), fase 7 · D-03 **A** (não quebrar o
que funciona), fase 3 · D-04 **L** (front-end e acessibilidade), fase 2 · D-05 **H** (segurança),
fase 6.
