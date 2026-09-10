# ADR-0003 — A UI importada nasce no sistema visual da BeHemp, e "superior" é definido por critério medível

> **Status:** ✅ **aprovada em 20/08/2026** pelo dono do produto.
> **Contexto:** o dono pediu *"a réplica do front end adaptada às cores da behemp e com design
> MUITO superior ao vid-ai"*, e observou que os dois produtos são *"dois escopos diferentes do
> mesmo nicho"*. O `CLAUDE.md` proíbe inventar identidade visual: zero cor nova, zero animação
> nova. As duas coisas parecem colidir. Esta ADR resolve a colisão.
> **Decisão:** nada do sistema visual do VidAI atravessa. A UI é **reconstruída** com os tokens,
> componentes e animações que já existem em `app/globals.css` — e *"superior"* passa a
> significar **cinco critérios verificáveis**, não impressão.

---

## §1 — O que a medição provou

Medição completa em [`../09-FRONTEND-VIDAI-MEDIDO.md`](../09-FRONTEND-VIDAI-MEDIDO.md). O que
decide esta ADR:

1. **As famílias de componente são incompatíveis.** VidAI: shadcn/ui sobre **Radix**, 48
   componentes, 26 pacotes `@radix-ui/*`. BeHemp: shadcn/ui **`base-nova`** sobre
   **`@base-ui/react`**, 25 componentes. Nenhum `.tsx` atravessa sem reescrita.
2. **A paleta é oposta.** `--primary` do VidAI é **azul** `217 91% 60%` sobre **branco puro**;
   o da BeHemp é **terracota** `#EA5429` sobre **creme** `#F5F2ED`. Fontes: Inter/Montserrat
   contra Epilogue/Outfit.
3. **A BeHemp já tem equivalente para quase todo efeito do VidAI** — glass, gradiente, glow,
   cartão com faixa colorida, entrada de página. O mapa está em `09` §3.1.
4. **As lacunas reais são três:** `progress`, `collapsible` e renderização de markdown.
5. **17 dependências do VidAI não existem aqui**, e as de UI (Radix, `vaul`, `cmdk`,
   `react-resizable-panels`) não devem existir.

---

## §2 — As decisões

### D-01 — Zero token, zero animação, zero fonte nova

Tudo sai de `app/globals.css`. A tradução usa o mapa de `09` §3.1.

**Rejeitado: portar o tema do VidAI trocando os valores dos tokens.** É o caminho aparentemente
mais rápido e é o pior: produz um VidAI pintado de laranja — sombras azuladas, densidade de
tela alheia, tipografia errada, e um módulo que se anuncia como "de outro produto" dentro do
nosso. O custo não é estético: é que o médico percebe a costura e passa a tratar a área como
ferramenta terceira.

**Rejeitado: criar um sub-tema só para o módulo de IA.** Dois sistemas visuais no mesmo produto
é a maneira mais cara de manter os dois errados.

### D-02 — As três lacunas se resolvem pelo caminho mais barato, nesta ordem

| lacuna | decisão |
|---|---|
| indicador de progresso do wizard | **componer com o que existe** — barra em `div` com token de `--primary`, ou passo `n de N` em `tabular-nums`, seguindo o padrão de paginação medido em `06` §4.4 |
| conteúdo colapsável das hipóteses | **usar `accordion`**, que já existe em `components/ui/` |
| markdown do laudo | **não renderizar markdown na Metade 1** — texto simples com quebras. Se a Metade 2 provar que o motor devolve markdown estrutural, a dependência entra então, com decisão própria |

**Rejeitado: instalar `progress`, `collapsible` e `react-markdown` de saída.** Três
dependências para três usos ainda não confirmados, num repositório onde `table.tsx` existe e é
usado em **zero** arquivos. Componente que entra "porque vamos precisar" é como o `table.tsx`
entrou.

### D-03 — "MUITO superior" é definido por cinco critérios verificáveis

Sem isto, *"superior"* vira gosto, e gosto não se revisa. A UI nova é superior à do VidAI se, e
só se:

| # | critério | como se verifica |
|---|---|---|
| 1 | **funciona nos dois temas** | claro e escuro, em toda tela nova — a BeHemp tem dark completo via `next-themes`; o VidAI trata dark como variação parcial |
| 2 | **tem os quatro estados** | carregando, vazio, erro e sucesso, com a anatomia medida em `06` §4.4 — `Loader2` girando, ícone `size={40}` esmaecido no vazio |
| 3 | **é acessível de teclado e leitor de tela** | foco visível, ordem de tabulação, rótulo em ícone-botão. Em tela de decisão clínica isto é requisito, não cortesia |
| 4 | **funciona em telefone** | o VidAI é ferramenta de desktop; o médico da BeHemp abre no celular |
| 5 | **nenhum arquivo de tela passa de ~400 linhas** | o VidAI tem 5 arquivos acima de 950, e o maior é um wizard de **1.469** linhas. Replicar a estrutura importaria o defeito junto com o fluxo |

**Rejeitado: "superior" como julgamento estético na revisão.** Não é revisável, não é
recusável, e transforma a entrega em discussão de preferência.

### D-04 — O idioma de lista continua sendo Card

O VidAI usa `table.tsx`. Aqui, `card` aparece em **65** arquivos e `table` em **zero**.

**Rejeitado: introduzir `<Table>` porque a tela de origem usava tabela.** Seria a única tela
do sistema com tabela — e a origem do padrão seria "o outro produto fazia assim".

### D-05 — `framer-motion` não se espalha

Hoje vive só em `components/teleconsulta/`. O VidAI o usa livremente. Tela nova de IA fora de
teleconsulta usa as classes CSS de `globals.css`.

**Rejeitado: liberar `framer-motion` no módulo de IA.** A restrição existe medida; afrouxá-la
por conveniência de importação é decidir por omissão.

### D-07 — 🔴 A **lógica de construção** do VidAI é copiada deliberadamente; a teleconsulta fica fora

`DO-12` separa duas coisas que esta ADR tratava como uma: **o sistema visual** (que é nosso) e
**a lógica de construção** (que é deles, e é o ativo). Copiam-se os sete princípios de
`../09-FRONTEND-VIDAI-MEDIDO.md` §1 — revisão humana como estrutura, dispara-e-acompanha, falha
parcial vira tela parcial, revelação progressiva, campos separados para IA e médico,
sanitização por destinatário, retomada por deep link — e a lógica de navegação de cada fluxo.

**Recorte:** anamnese, prescrição e exames seguem essa lógica. A **teleconsulta mantém o design
atual da BeHemp** — seus 9 componentes e 3.141 linhas não são redesenhados; o que ela recebe é
auditoria funcional (Sprint 1), não redesenho.

**Rejeitado: tratar "adaptar" como exercício apenas visual.** Foi o erro da primeira versão
desta doc: mediu o que não era copiável (stack, paleta) e não extraiu o que era (por que a IA é
a etapa 6, por que uma hipótese abre e duas ficam fechadas, por que o HITL fica oculto até o
médico ler). Essas respostas custaram 19 sprints e um incidente clínico ao VidAI — reinventá-las
seria pagar duas vezes.

**Rejeitado: redesenhar a teleconsulta junto.** Contraria `DO-12` e ampliaria o escopo para o
único módulo que já tem identidade fechada nesta casa.

### D-06 — A adaptação é feita **fluxo a fluxo**, com a tela de origem à vista

Para cada tela: ler o fluxo no VidAI (e no documento de sprint correspondente), listar os
passos e as decisões humanas, e **então** desenhar com os componentes daqui. O arquivo de
origem serve de especificação, nunca de ponto de partida do código.

**Rejeitado: abrir o `.tsx` do VidAI e ir substituindo classes.** Traz junto a estrutura de
1.469 linhas, o vocabulário Radix e a lógica de `react-query` — e o resultado é mais caro de
revisar do que reescrever.

---

## §3 — O que fica rejeitado

| # | rejeitado | motivo em uma linha |
|---|---|---|
| R-01 | portar o tema do VidAI trocando tokens | produz um VidAI pintado de laranja |
| R-02 | sub-tema próprio para o módulo de IA | dois sistemas visuais, ambos mal mantidos |
| R-03 | instalar `progress`, `collapsible`, `react-markdown` de saída | três dependências para usos não confirmados |
| R-04 | "superior" como julgamento estético | não é revisável nem recusável |
| R-05 | `<Table>` porque a origem usava | seria a única tela do sistema com tabela |
| R-06 | `framer-motion` fora de teleconsulta | afrouxa por conveniência uma restrição medida |
| R-07 | adaptar substituindo classes no `.tsx` de origem | importa estrutura, vocabulário e camada de dados alheios |
| R-08 | tratar "adaptar" como exercício visual | perde o ativo real: a lógica de construção, paga em 19 sprints |
| R-09 | redesenhar a teleconsulta junto | contraria `DO-12`; é o módulo com identidade já fechada |

---

## §4 — Como se prova

| guarda | falha quando |
|---|---|
| `sem-cor-fora-do-token` | aparecer hex ou `rgb()` literal em componente novo |
| `sem-table` | `components/ui/table` for importado |
| `framer-motion-restrito` | `framer-motion` for importado fora de `components/teleconsulta/` |
| `tela-nao-gigante` | arquivo de tela nova passar do limite de linhas de D-03 §5 |
| `dark-mode-coberto` | tela nova não tiver verificação nos dois temas |

⚠️ Os guardas nascem **junto com a primeira tela nova**, não antes — e não retroagem ao código
existente, que tem violações conhecidas e catalogadas. Guarda que acusa dezenas de violações no
dia 1 é guarda que alguém desliga.

---

## §5 — O que esta ADR **não** decide

Quais telas existem. Isso depende de `GAP-01`, `GAP-02` e `GAP-04`
([`../02-CATALOGO-DE-REGRAS.md`](../02-CATALOGO-DE-REGRAS.md)). Esta ADR decide **como** cada
tela será construída, seja ela qual for.

---

## §N — O que a implementação ensinou

*A escrever depois.*

---

**Fontes.** Primárias, medidas no disco: `app/globals.css` (448 linhas) ·
`you-ai-frontend-main/src/styles/index.css` (342 linhas) · os dois `package.json` ·
`components/ui/` dos dois projetos. Padrão de anatomia de tela:
[`../06-PADROES-DO-CODIGO.md`](../06-PADROES-DO-CODIGO.md) §4.4, medido em
`app/(admin)/admin/usuarios/page.tsx`.

**Princípios e fase** (`docs/PRINCIPIOS.md`):

| decisão | princípio | fase |
|---|---|---|
| D-01 · D-04 · D-05 — sistema visual único | **L** (front-end) + **A** (arquitetura) | 2 e 3 |
| D-02 — lacunas pelo caminho mais barato | **A** (evitar dependência sem consumidor) | 3 |
| D-03 — critérios verificáveis, incl. acessibilidade | **L** + **I** (qualidade) | 2 e 8 |
| D-06 — adaptar fluxo, não arquivo | **A** (arquitetura) | 3 |
