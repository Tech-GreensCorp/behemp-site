# ADR-0019 — Ajuste do módulo clínico: o que diverge do VidAI, o que está velho e o que falta

> **Status:** 📋 **proposta** — 10/09/2026. Escrita a pedido do dono, que percorreu o módulo em
> produção e levantou três questões. **Nada aqui está implementado.** É documento de decisão, e
> a implementação depende de aprovação — ordem explícita: _"deixa apenas documentado essas
> questões"_.

## Contexto — o que o dono observou, com as palavras dele

Em 10/09/2026, logo depois de o deploy finalmente entregar o build novo a produção, o dono
percorreu `/medico/ia-clinica` e o perfil do paciente, e levantou três pontos:

1. _"cadê tudo que fizemos aqui na IA clínica? porque ali diz que tá faltando fazer coisa se nós
   tínhamos declarado que estava tudo feito (menos área de exames)?"_
2. _"em ia clinica não era pra ser fases, primeiro medidas de acompanhamento depois uso de
   cannabis medicinal e aí vem análise assistida, que nem é feito no vid-ai?"_
3. _"a gente tá seguindo o mesmo padrão da behemp né, pq tudo fica dentro da área de pacientes
   dentro do perfil do paciente"_

As três são legítimas e **têm respostas diferentes**: uma é documentação velha, uma é decisão já
tomada que ninguém tinha à mão, e uma é confirmação de que o padrão está certo. Esta ADR separa.

⚠️ **Retificação registrada.** Ao responder ao ponto 2 na conversa, eu afirmei que a tela
_"deveria ser wizard e falta a forma"_, citando `docs/09-FRONTEND-VIDAI-MEDIDO.md`. **Estava
errado:** o wizard foi **rejeitado** na ADR-0004 D-02, com fundamento. Eu li o documento que
descreve o VidAI e não abri a ADR que decidiu o que fazer com ele. É exatamente a falha que o
`CLAUDE.md` nomeia — _"antes de refatorar, procurar a decisão"_.

---

## D-01 — O wizard continua rejeitado. A pergunta do dono é boa, e a resposta já existia

**Decisão: manter seções na página com trilha lateral. Não adotar wizard.**

Não é decisão nova: é a ADR-0004 **D-02**, de 20/08/2026, que já registrava isto como _"a maior
divergência deliberada em relação ao VidAI"_. O motivo, textual:

> **Rejeitado: wizard linear (opção A).** Contraindicado pela evidência para usuário frequente e
> expert, e péssimo para o caso mais comum, que é o **retorno**.

E o ponto que decide, que é de **escopo clínico**, não de gosto:

> lá a anamnese é **evento**; aqui é **série**.

O VidAI faz uma anamnese completa de clínica geral: identificação, hábitos, vitais, queixa,
histórico, e a IA na etapa 6. Acontece uma vez, com um paciente novo. Aqui, o caso mais comum
não é a primeira avaliação — é o **retorno**, em que o médico quer ver **o que mudou** desde a
última medição. Obrigar quem volta pela oitava vez a percorrer seis passos para registrar duas
notas de 0 a 10 é desenhar para o caso raro.

⚠️ E o que **não** muda: a ADR-0004 é explícita em que isso _"não contradiz `DO-12`: a lógica de
construção do VidAI (P1–P7) é integralmente adotada. O que muda é o **recipiente**"_.

**A prova de que o princípio central do VidAI está respeitado** está na ordem da tela. O
`docs/09-FRONTEND-VIDAI-MEDIDO.md:112` chama isto de _"a decisão de construção mais
importante"_:

> a IA é a **etapa 6**, depois de identificação, hábitos, vitais, queixa e histórico. Ela não
> abre a tela nem interrompe o raciocínio do médico — ela **conclui** a coleta. Quem coloca a IA
> no passo 1 constrói outro produto.

Na tela em produção, a ordem é **Medidas de acompanhamento → Uso de cannabis → Análise
assistida** (`app/(medico)/medico/ia-clinica/anamnese/[pacienteId]/page.tsx:102-104`). A IA é a
última. **É exatamente a sequência que o dono descreveu na pergunta** — ela já é o que ele
esperava; o que não existe é a moldura de fases em volta.

**Rejeitado: adotar o wizard "porque o VidAI faz assim".** Copiar o recipiente sem o escopo é o
erro que a ADR-0004 evitou de propósito.

**Fica em aberto para o dono:** se a preferência por fases for **de produto**, e não uma leitura
da ADR, isso é decisão dele e reverte a D-02 — mas então as duas versões ficam registradas, com
o motivo, como manda o `CLAUDE.md`.

## D-02 — A trilha lateral ganha estado de progresso. **Esta é a lacuna real**

A ADR-0004 D-02 pede, textualmente, _"trilha lateral **com progresso**"_. A implementação
entregou a trilha — e **sem** o progresso:

```ts
// app/(medico)/medico/ia-clinica/anamnese/[pacienteId]/page.tsx:101-105
const SECOES = [
  { id: 'medidas', rotulo: 'Medidas de acompanhamento', icone: TrendingUp },
  { id: 'uso', rotulo: 'Uso de cannabis', icone: ClipboardList },
  { id: 'ia', rotulo: 'Análise assistida', icone: Brain },
];
```

É uma lista fixa de três âncoras. Não sabe o que já foi preenchido, o que está em foco nem o que
falta. O VidAI resolve isso com _"barra de passos com estado por etapa: concluído (`bg-success`),
atual, futuro — e a linha entre eles muda de cor conforme avança"_
(`docs/09-FRONTEND-VIDAI-MEDIDO.md:119`).

**Decisão: a trilha passa a refletir estado** — seção concluída, seção atual, seção pendente —
sem virar wizard. Isso entrega o benefício que o dono percebeu (saber onde se está no processo)
sem reintroduzir o bloqueio linear que a D-02 rejeitou.

**Rejeitado: barra de passos no topo.** Ocuparia a faixa onde hoje vive a identificação do
paciente, e num retorno com uma seção só a barra seria decorativa.

⚠️ **Depende de:** `docs/06-PADROES-DO-CODIGO.md` registra que o token `progress` **não existe**
neste projeto (`09-FRONTEND-VIDAI-MEDIDO.md:197`: _"compor com token"_). O estado se pinta com
os tokens existentes, e nenhuma cor nova entra — proibição 3 do `CLAUDE.md`.

## D-03 — O "O que o módulo vai ter" deixa de ser texto fixo

O que o dono leu na tela é uma constante escrita em 20/08 e nunca tocada:

```ts
// app/(medico)/medico/ia-clinica/page.tsx:53-85
const FATIAS = [
  { titulo: 'Hipóteses e revisão humana',       sprint: 'Sprint 4', bloqueio: 'ADR-0006 em proposta · CFM 2.299/21 não transcrita' },
  { titulo: 'Conduta, prescrição e titulação',  sprint: 'Sprint 5', bloqueio: 'ADR-0005 em proposta · RDC não transcrita · …' },
  …
];
```

A revisão humana e a cadeia conduta-prescrição-titulação foram entregues no commit `286da86`
(09/09/2026). A tela continua anunciando que faltam, porque ninguém edita um texto ao terminar
código — e ninguém vai lembrar da próxima vez.

**Decisão: o cartaz deriva do estado real, ou some.** Duas saídas aceitáveis, nesta ordem de
preferência:

1. **Derivar do status das ADRs.** O bloqueio some quando a ADR sai de "proposta". A fonte passa
   a ser o mesmo arquivo que o `CLAUDE.md` já obriga a manter.
2. **Remover o cartaz da tela de produção.** Roadmap é documento interno; o médico não precisa
   ler o que falta construir. Se ficar, é para o dono — e aí vive em `docs/`, não em produção.

**Rejeitado: atualizar o texto agora e seguir.** É o que foi feito em agosto, e é por isso que
esta ADR existe. Documentação dentro do produto que não deriva do produto mente por padrão — a
única questão é quando.

## D-04 — As ADRs 0005 e 0006 são promovidas, e é isso que destrava a D-03

Medido em 10/09/2026:

| ADR      | status no arquivo        | estado real do código                           |
| -------- | ------------------------ | ----------------------------------------------- |
| ADR-0005 | 📋 proposta — 20/08/2026 | implementada — conduta → prescrição → titulação |
| ADR-0006 | 📋 proposta — 20/08/2026 | implementada — hipóteses com revisão humana     |

O `CLAUDE.md` já manda retificar ADR ao terminar de implementar, _"com o que a implementação
ensinou"_. Não foi feito, e o custo apareceu agora: **a tela leu a fonte certa; a fonte é que
estava velha.** O dono não estava enganado ao dizer que tínhamos declarado tudo feito — o código
está feito, a decisão é que nunca foi carimbada.

**Decisão: promover as duas, com a seção de retificação** — o que a implementação mudou em
relação ao que a proposta previa. Sem isso, a D-03 opção 1 não tem de onde derivar.

## D-05 — O padrão de "tudo dentro do perfil do paciente" está certo, e fica

Confirmado por medição: as dez abas declaradas no código são exatamente as dez da tela —
`dados, anamnese, documentos, prescricoes, exames, evolucao, dosagem, rastreio, graficos,
relatorios`, em `app/(medico)/medico/pacientes/[id]/_components/tab-*.tsx`.

**Decisão: nenhuma mudança.** O módulo clínico continua morando no perfil do paciente.

⚠️ **Um ponto de atenção que o dono deve conhecer:** existe uma **segunda** porta de anamnese em
`/medico/ia-clinica/anamnese/[pacienteId]`, além da aba `Anamnese` do perfil. As duas são
intencionais e fazem coisas diferentes — a aba é o registro clínico; a rota da IA clínica é a
série de acompanhamento com análise assistida. **Mas nada na tela explica isso a quem usa.** No
QA vale observar se um médico que não participou da construção entende a diferença sem
perguntar. Se não entender, é achado de produto, e vira item próprio.

---

## Comparativo com o preview local

O projeto tem uma galeria de componentes em `/preview` (`app/preview/page.tsx`), que **só existe
fora de produção** — a própria rota chama `notFound()` quando `NODE_ENV=production`, e o
middleware só a libera quando não é produção. Ela monta os componentes de IA clínica contra três
fixtures congelados do contrato da Sprint 2:

| fixture                                | o que exercita                                    |
| -------------------------------------- | ------------------------------------------------- |
| `resposta-completa-teleconsulta.json`  | grafo completo — o caso feliz                     |
| `resposta-parcial-truncada.json`       | **falha parcial** — a tela parcial do P3 do VidAI |
| `resposta-canabidiol-dor-cronica.json` | o caso do domínio, com opções por hipótese        |

**Como fazer o comparativo, quando for a hora:**

```bash
pnpm dev
# http://localhost:3000/preview                                   → a galeria de componentes
# http://localhost:3000/medico/ia-clinica/anamnese/<pacienteId>   → a tela real
```

⚠️ **O que o preview NÃO prova.** Ele monta os componentes com dado congelado: serve para
comparar **aparência e estados de componente**, não fluxo. A trilha lateral, o auto-save e a
navegação entre seções — que é justamente o que a D-02 discute — **não aparecem lá**. Comparar
preview com tela e concluir que "está igual" seria comparar as duas coisas erradas.

⚠️ E o conteúdo clínico do fixture de canabidiol é **ilustrativo e não validado** — o próprio
arquivo carrega um campo `_LEIA` dizendo isso, e o `GAP-03` segue aberto. Não serve de exemplo
clínico para ninguém.

---

## O que esta ADR NÃO decide

- **Exames (Sprint 7).** Continua aguardando a conversa do dono com o chefe (`DO-13`). O cartaz
  está certo nesse card.
- **Ligar o motor de IA.** A Análise assistida mostra o texto de espera porque o motor não está
  ligado. É a ADR-0001 (serviço Python separado), fora desta.
- **A ordem de execução.** Quais destas decisões entram antes é do dono. A D-04 é a mais barata
  e destrava a D-03.

## Princípios e fase

D-01/D-02 **L** (front-end), fase 2 · D-03/D-04 **A** (a doc é parte do produto), fase 0 ·
D-05 **F** (dados), fase 5.

## Fontes lidas

- `docs/adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md` — D-02, a rejeição
  do wizard, e o registro de que é a maior divergência deliberada do VidAI
- `docs/09-FRONTEND-VIDAI-MEDIDO.md` — §2 (wizard de 6 etapas, barra de passos, auto-save por
  etapa) e a linha 112, sobre a IA ser a última etapa
- Nielsen Norman Group, via ADR-0004: _"making all the steps visible from the start"_ —
  **localizado através da ADR, não lido na fonte primária**
- O código em produção: `app/(medico)/medico/ia-clinica/page.tsx`,
  `app/(medico)/medico/ia-clinica/anamnese/[pacienteId]/page.tsx`, `app/preview/page.tsx`
