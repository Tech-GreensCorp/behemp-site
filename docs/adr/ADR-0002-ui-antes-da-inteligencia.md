# ADR-0002 — A UI vem antes da inteligência, mas nasce presa ao contrato real do motor

> **Status:** ✅ **aprovada em 20/08/2026** pelo dono do produto.
> **Contexto:** [ADR-0001](ADR-0001-motor-de-ia-roda-como-servico-python-separado.md) decidiu
> que o motor Python roda na mesma máquina, maior. O upgrade de RAM **depende de tratativa com
> a AWS**, e essa espera é de terceiro. O dono decidiu adiantar o que não depende dela:
> *"faremos agora nessa etapa apenas a réplica do front end adaptada às cores da behemp e com
> design MUITO superior ao vid-ai, faremos apenas o front end e o backend dos botões e depois
> vamos conectar o backend das IA porque tem que falar com a AWS para mudar de GB"*.
> **Decisão:** o trabalho é partido em **duas metades**. A primeira entrega telas e ações que
> **não** dependem do motor. A segunda liga o motor. E a primeira **só** é segura porque o
> contrato de dados é derivado do motor real **agora**, não inventado.

---

## §1 — O que a medição provou

### 1.1 A espera é real, e é de terceiro

O motor não cabe no `t2.small` de 2 GB (ADR-0001 §1.2). O upgrade depende da AWS. Parar tudo
até a máquina crescer custaria semanas de calendário sem nenhuma entrega — e o trabalho de UI
não consome um byte da RAM que falta.

### 1.2 O contrato de dados da IA **já existe escrito**, e não precisa ser inventado

Três fontes independentes descrevem o formato de resposta do motor, todas legíveis hoje:

| fonte | conteúdo | tamanho |
|---|---|---|
| `main.py` | **17 rotas** Flask, com o payload de cada uma | 4.221 linhas |
| `you-ai-frontend-main/src/types/` | o contrato **já em TypeScript** — `mapaMentalEvidencias.ts`, `panoramaClinico.ts`, `exameResultado.ts`, `resumoSaude.ts` | **495 linhas** |
| `src/__fixtures__/teleconsulta-grafo-sca.json` | uma **resposta real congelada** do motor | 561 linhas, 17 KB |

🎯 **O VidAI já fez exatamente o que esta ADR propõe** — congelou uma resposta real como
fixture para desenvolver contra ela. Não é técnica nova: é a técnica que o projeto de origem
usou, e que está no disco para ser reaproveitada.

### 1.3 O risco desta ordem tem nome, e é medível

Construir tela antes do backend que a alimenta é seguro **se e somente se** o formato dos
dados estiver fixo. Se a UI for desenhada contra dados imaginados, o encontro com o motor real
na segunda metade produz retrabalho — e o retrabalho cai justamente sobre a parte cara: as
telas de decisão clínica, onde cada campo exibido é uma escolha de segurança.

Medida do risco, com os números do §1.2: **zero campos precisam ser imaginados.** Todos estão
descritos em `types/` ou observáveis no fixture.

---

## §2 — As decisões

### D-01 — O trabalho é partido em duas metades, na ordem: telas → inteligência

**Metade 1** — telas, navegação, estados e as ações que **não** chamam o motor
(salvar rascunho, listar, filtrar, anexar, encaminhar, permissão, auditoria).
**Metade 2** — conexão com o motor, RAG, ingestão do corpus e os testes de comportamento.

**Rejeitado: esperar o upgrade da AWS para começar.** Semanas de calendário paradas, sem que a
espera acelere em nada. E a UI é onde estão as decisões de escopo por papel — quanto antes
existirem, antes se descobre o que falta perguntar.

**Rejeitado: fazer as duas metades juntas, em fatias verticais.** Seria o padrão em situação
normal, e é melhor em geral — mas exige o motor de pé, que é exatamente o que não temos. Fica
registrado que a fatia vertical foi **preterida por restrição de infraestrutura**, não por
preferência de método.

### D-02 — 🔴 Toda tela da Metade 1 é construída contra o contrato real, congelado como fixture

Antes de qualquer tela, deriva-se o contrato de `types/` (495 linhas) + `main.py` + o fixture
existente, e ele entra no repositório como **tipo TypeScript versionado** mais **fixture JSON**
de resposta. A UI da Metade 1 consome o fixture. Na Metade 2 troca-se a **fonte** — do fixture
para o motor — e nada na tela é redesenhado.

**Rejeitado: UI com dados de exemplo inventados (`lorem`, arrays vazios, placeholders).**
Garante retrabalho no ponto mais caro, e esconde o caso difícil: o campo que às vezes vem
nulo, a lista que às vezes tem 9 itens, o texto que às vezes tem 4.000 caracteres. Tela bonita
com dado inventado é a forma mais eficiente de descobrir tarde.

**Rejeitado: mock ad-hoc dentro de cada componente.** Cada componente inventaria sua versão do
mesmo objeto, e as versões divergiriam em silêncio.

### D-03 — O que a IA produz aparece na tela como **proposta**, nunca como fato

Toda superfície da Metade 1 que exibirá conteúdo do motor já nasce com o estado de revisão
humana: rótulo de origem, ação de aceitar/recusar/editar, e registro de quem decidiu. O VidAI
chama isso de HITL e trata como regra de ouro — *"decisão humana obrigatória"*.

**Rejeitado: montar as telas em modo leitura e acrescentar a revisão humana depois.** A
revisão não é enfeite: ela determina o layout, a hierarquia e o fluxo de foco. Acrescentá-la
depois é redesenhar.

### D-04 — "Backend dos botões" tem escopo escrito, e ele exclui o motor

Entra na Metade 1: Server Action com `{ sucesso, dados?, erro? }`, validação Zod, checagem de
papel **e de escopo de objeto**, persistência, `registrarAuditoria` e `revalidatePath`.
Não entra: qualquer chamada ao motor, ingestão de RAG, embedding, ou upload que dependa de
processamento por IA.

**Rejeitado: botão que não faz nada ("tela morta") esperando a Metade 2.** Botão sem efeito
não é testável, não revela erro de permissão e dá falsa sensação de progresso. Se a ação
depende do motor, o botão **não existe ainda** — em vez dele, o estado vazio explica o que
virá.

### D-05 — Nenhuma tela nova repete os defeitos conhecidos desta casa

Upload vai para **store privado** com entrega autenticada (o repo tem 10+ pontos em store
público — achado catalogado, e código novo não o repete). Nada de `<Table>`. `framer-motion`
não sai de `components/teleconsulta/`. Papel derivado do `userRoleEnum`, nunca união literal
escrita à mão.

**Rejeitado: seguir o padrão majoritário do repositório onde ele é o defeito.** "É assim que
está em todo lugar" é descrição, não justificativa.

### D-06 — A fronteira entre as metades é explícita no código

Todo ponto que **vai** chamar o motor é marcado de uma forma só, buscável, para que a Metade 2
comece por uma lista derivada do código em vez de uma lista escrita à mão.

**Rejeitado: confiar na memória, no handoff ou num checklist manual.** Lista escrita à mão
diverge do código na primeira semana.

---

## §3 — O que fica rejeitado

| # | rejeitado | motivo em uma linha |
|---|---|---|
| R-01 | esperar a AWS para começar | semanas paradas, sem acelerar a espera |
| R-02 | fatias verticais (UI+IA juntas) | exige o motor de pé — preterido por infra, não por método |
| R-03 | UI com dado inventado | garante retrabalho onde é mais caro; esconde o caso difícil |
| R-04 | mock ad-hoc por componente | versões divergentes do mesmo objeto |
| R-05 | revisão humana acrescentada depois | ela define o layout; depois é redesenho |
| R-06 | botão inerte esperando a Metade 2 | não testável, e simula progresso |
| R-07 | repetir store público, `<Table>`, união literal de papel | defeito conhecido não vira precedente |
| R-08 | lista manual dos pontos de integração | diverge do código na primeira semana |

---

## §4 — Como se prova

| guarda | falha quando |
|---|---|
| `contrato-da-ia-versionado` | um componente declarar tipo próprio para dado do motor em vez de importar o contrato |
| `sem-dado-inventado` | aparecer mock fora do diretório de fixtures |
| `origem-ia-rotulada` | superfície que exibe conteúdo do motor não expuser origem e ação de revisão |
| `upload-privado` | upload novo apontar para store público |
| `fronteira-buscavel` | ponto de integração existir sem a marca de D-06 |

⚠️ Nenhum destes roda enquanto o **Item 3** da fila (portão de CI + runner) não existir. É por
isso que ele permanece antes das duas metades na fila de execução.

---

## §5 — O que ainda falta decidir antes da Metade 1 fechar escopo

`GAP-01` (qual é a área nova) · `GAP-02` (a IA sugere conduta?) · `GAP-04` (o farmacêutico é
papel no sistema?) — todos em [`../02-CATALOGO-DE-REGRAS.md`](../02-CATALOGO-DE-REGRAS.md).

🔴 **`GAP-02` e `GAP-04` decidem quais telas existem**, não só o que elas mostram: se a IA
sugere conduta, existe tela de aprovação clínica; se o farmacêutico aprova dentro da
plataforma, existe fila dele. Sem essas duas respostas, o inventário de telas da Metade 1 fica
**provisório**.

---

## §N — O que a implementação ensinou

*A escrever depois.*

---

**Fontes.** Primárias, lidas no disco: `IA-you-ai-main/main.py` (17 rotas) ·
`you-ai-frontend-main/src/types/` (495 linhas) · `src/__fixtures__/teleconsulta-grafo-sca.json`
(561 linhas) · `docker-compose.prod.yml` · `docs/sprint-IA-analise/` (27 documentos, com o
contrato anti-regressão R1–R40). Medição do frontend em
[`../09-FRONTEND-VIDAI-MEDIDO.md`](../09-FRONTEND-VIDAI-MEDIDO.md).

**Princípios e fase** (`docs/PRINCIPIOS.md`):

| decisão | princípio | fase |
|---|---|---|
| D-01 — partir em duas metades | **B** (fluxo de trabalho) + **C** (ambientes) | 1 e 11 |
| D-02 — contrato congelado | **A** (arquitetura) + **I** (testes) | 3 e 8 |
| D-03 — revisão humana no desenho | **L** (front-end) + **H** (segurança) | 2 e 6 |
| D-04 — escopo do "backend dos botões" | **M** (back-end) + **H** (OWASP API1/BOLA) | 4 e 6 |
| D-05 — não repetir defeito conhecido | **H** (segurança) + **A** (DRY) | 6 e 3 |
| D-06 — fronteira buscável | **A** (arquitetura) | 3 |
