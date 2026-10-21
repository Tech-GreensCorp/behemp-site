# A lógica de construção do frontend do VidAI — o que se copia, e por que ela é assim

> 🎯 **O que esta doc é.** O VidAI resolveu, ao longo de 19 sprints, um problema que a BeHemp
> ainda não resolveu: **como um médico opera uma IA clínica sem que a IA decida por ele**. As
> respostas estão em decisões de construção — quantos passos, o que abre fechado, quando o
> botão aparece, o que acontece quando a IA falha pela metade. **É isso que se copia.**
>
> 🛑 **Não** se copia a stack (incompatível) nem a paleta (oposta). Isso é §5, e é o assunto
> menor.
>
> **Escopo, fixado pelo dono em 20/08/2026 (`DO-12`):** a **teleconsulta da BeHemp mantém o
> design atual**. Quem segue a lógica de construção do VidAI é **anamnese, prescrição e
> exames**.

**Fontes primárias:** `you-ai-frontend-main/src/` (41.710 linhas) e os **27 documentos** de
`docs/sprint-IA-analise/` (15.616 linhas), que registram *por que* cada decisão foi tomada —
inclusive as tomadas **depois de um incidente**.

---

## 1. Os sete princípios de construção — o "porquê" por trás das telas

Extraídos do MASTER-BRIEF e das sprints S4, S7, S8, S10 e S11. Cada um nasceu de um problema
real, e é isso que os torna valiosos: **são cicatrizes, não preferências**.

### P1 — A revisão humana é a estrutura da tela, não um botão no fim

O fluxo inteiro é desenhado em volta de *"decisão humana obrigatória"*. O estado do registro
acompanha: `em_andamento` → `aguardando_validacao` ("Aguardando confirmação do médico") →
`concluido`. E `concluido` só existe **depois** da aprovação.

🔴 A S11.1 documenta o bug exato de quem erra isso: *"`analisar-ia` marcava `concluido` antes
da aprovação médica"*. A tela dizia que estava pronto quando o médico ainda não tinha olhado.

### P2 — Nada que demora bloqueia a tela: dispara, devolve, acompanha

Padrão único para tudo que é lento, registrado na PARTE 7 do MASTER-BRIEF:

| fluxo | padrão |
|---|---|
| upload de exame | **`202` + job em Redis + poll a cada 3 s** |
| re-análise | 202, mesmo padrão |
| anamnese | backend 90 s · frontend 120 s · **fire-and-poll 45×5 s** |

O `202` não é detalhe de API: é o que permite a tela mostrar progresso em vez de congelar por
três minutos.

### P3 — Falha parcial vira tela parcial, nunca tela vazia

O caso índice da S11 é uma aula: `max_tokens` baixo → JSON truncado → hipóteses vazias → a tela
mostrava **"Não determinado"**. A correção não foi só aumentar o limite; foi construir a
degradação:

- **extratores parciais** para cada campo (`prescricao_sugerida`, `plano_terapeutico`, `exames_recomendados`, `resumo_clinico`)
- reparo de JSON truncado
- **banner de "análise parcial"** — a tela diz o que conseguiu e o que faltou
- merge com deduplicação de evidências

> 🎯 **A regra:** quando a IA falha pela metade, o médico vê a metade que funcionou **e sabe
> que é metade**. Tela vazia e tela mentirosa são as duas piores saídas.

### P4 — Revelação progressiva: uma hipótese aberta, as outras fechadas

Três hipóteses, e a UI abre **só a primeira** (`<details open>`, slots 2–3 fechados), com
seleção por `RadioGroup`. O médico vê a principal sem rolagem, e as alternativas existem sem
competir.

⚠️ O problema que originou isso (S10): *"Flask já retornava `ddx_gerado` mas a UI mostrava só
`diagnostico_provavel`"* — o modelo raciocinava sobre três hipóteses e a tela escondia duas.
**Diagnóstico diferencial que não aparece não existe.**

### P5 — O que a IA sugeriu e o que o médico decidiu são campos diferentes

No exame: `laudoMedico`, `diagnosticoMedico`, `cidMedico`, `concordanciaIA`,
`observacoesMedico`, `validadoEm` — **ao lado** da análise da IA, nunca por cima dela. Status
final: `validado` **ou** `divergente`.

E a regra que fecha o ciclo: **laudo bruto de IA não entra no RAG.** Só o respaldo do médico
entra. O modelo não aprende com a própria saída não revisada.

### P6 — Cada destinatário vê uma versão diferente, e a sanitização é regra de ouro

Portal do paciente: *"zero `analiseIA` / `chain_of_thought`"*, só exames `validado` ou
`divergente`, imagem servida **autenticada**. O paciente nunca vê raciocínio de IA nem laudo
não revisado.

### P7 — Trabalho longo se retoma de onde parou

Wizard salva por etapa, e a retomada é por **deep link**: `?continuar=<id>&etapa=<n>`, mais
`?pacienteId=&revisar=` para abrir direto a revisão. Há painel de revisão *read-only* com botão
**"Continuar wizard"**, e `preservarCamposHitl()` garante que a reidratação **não apague** o que
já foi decidido.

⚠️ Uma anamnese de 6 etapas com análise de IA no fim é longa demais para exigir uma sessão só.

---

## 2. Anamnese — a lógica, passo a passo

**Wizard de 6 etapas**, com nomes que são a espinha do fluxo
(`pages/Anamnese.tsx:40-47`):

| # | etapa | ícone |
|---|---|---|
| 1 | **Identificação** | `User` |
| 2 | **Hábitos & Rotina** | `Activity` |
| 3 | **Sinais Vitais** | `Heart` |
| 4 | **Queixas & HDA** | `Stethoscope` |
| 5 | **Histórico Clínico** | `FileText` |
| 6 | **Análise IA & Rx** | `Brain` |

**A decisão de construção mais importante está na ordem:** a IA é a **etapa 6**, depois de
identificação, hábitos, vitais, queixa e histórico. Ela não abre a tela nem interrompe o
raciocínio do médico — ela **conclui** a coleta. Quem coloca a IA no passo 1 constrói outro
produto.

Detalhes que valem transporte:

- **Barra de passos** com estado por etapa: concluído (`bg-success`), atual, futuro — e a linha
  entre eles muda de cor conforme avança.
- **Sinais vitais com controle dedicado**: `−` / `+` além do slider, `min`/`max`/`step` por
  medida (temperatura 34–42 passo 0,1; FC 30–200; SpO₂ 70–100; FR 8–40), faixa normal indicada
  e sinalização de valor perigoso. **Não é `<input type=number>` genérico** — é um controle por
  grandeza clínica, com o intervalo plausível embutido. IMC é derivado, não digitado.
- **Auto-save por etapa**, com criação automática do registro ao chegar na 6 se ainda não existir.
- **Modal de análise em 2 passos** — passo 1: três hipóteses + red flags + exames recomendados +
  seletor (IA **ou** manual); passo 2: diagnóstico, CID e medicamentos **editáveis**. Entre os
  dois, `PATCH progresso-hitl` grava rascunho — o médico pode sair no meio.
- **Hipótese manual** é um caminho de primeira classe, não escape: painel próprio, com sugestão
  de prescrição a partir da anamnese completa.
- **Badges de urgência** em quatro níveis — verde (simples), amarelo (atenção), vermelho
  (emergência / *Don't-Miss*), roxo (código roxo).
- **Aba de anamneses no perfil do paciente**, com badges de status e sheet de revisão.

## 3. Exames — a lógica

Fluxo (MASTER-BRIEF PARTE 6.1):

```
upload → 202 → poll 3s → análise → analisado_ia
   → médico revisa em viewer split (≥1280px)
   → [Pular] revela o HITL   ou   [Re-analisar] (≥10 caracteres de motivo)
   → Validar → validado | divergente
   → respaldo do médico entra no RAG  → timeline clínica → portal do paciente
```

As decisões de construção que importam:

- 🔴 **Leitura Cega (S4):** na primeira análise, o motor de visão **não** recebe o histórico
  clínico. Nasceu de um incidente de **viés de ancoragem** — a IA via o que esperava ver. É
  regra de produto, não detalhe de backend, porque define **o que a tela pode oferecer** ao
  pedir a análise.
- **Viewer split** só a partir de `xl` (1280px): imagem e laudo lado a lado. Abaixo disso,
  empilha.
- **O HITL fica oculto** até o médico clicar em *Pular* ou validar. A tela não pede opinião
  antes de ele ter lido.
- **Re-análise exige ≥10 caracteres de justificativa**, e os blocos são **aditivos** — nunca
  substituem o prompt base. O histórico da divergência sobrevive.
- **Três camadas de RAG com limiares distintos** (0,58 ciência · 0,65 respaldo do médico · 0,72
  observação) — quanto mais próximo do julgamento humano, maior a exigência de similaridade.

## 4. Prescrição — a lógica

- **Dois passos, sempre**, e o segundo é editável: diagnóstico, CID e medicamentos.
- **Snapshot `_prescricao_aprovada`** — o que foi aprovado fica congelado, e a reidratação da
  tela **não** o sobrescreve.
- **Só fica visível ao paciente depois do HITL.**
- Medicamentos são recuperados mesmo de resposta truncada (`extrairMedicamentosSugeridos()`).
- Validade de 60 dias no VidAI. ⚠️ **Aqui isso não se copia** — a BeHemp tem receituário
  ICP-Brasil, SNCR e RDC 1.000/25 próprios, e a validade é matéria de norma.

## 5. O que **não** atravessa

**Stack** — incompatível peça a peça: React 18 + Vite SPA × Next 16 App Router · shadcn sobre
**Radix** (26 pacotes) × shadcn `base-nova` sobre **`@base-ui/react`** · `axios` +
`react-query` × Server Actions · `socket.io` × Pusher · `react-hook-form` (não existe aqui) ·
JWT × Clerk. **17 dependências** do VidAI não existem na BeHemp.

**Paleta e tipografia** — `--primary` azul `217 91% 60%` sobre branco puro, Inter/Montserrat,
contra terracota `#EA5429` sobre creme `#F5F2ED`, Epilogue/Outfit.

**Arquivos gigantes** — `Anamnese.tsx` tem **1.469 linhas**; cinco arquivos passam de 950. A
lógica se copia; a estrutura monolítica, não (ADR-0003 D-03 §5).

**Validade de prescrição, e tudo que for norma** — cada número regulatório é nosso, não deles.

### 5.1 Mapa de tradução visual — a BeHemp já tem quase tudo

| efeito no VidAI | equivalente que **já existe** aqui |
|---|---|
| `.glass-card` (hipótese premium) | `Card border-0 shadow-sm` + `.glass` |
| `.glow-primary` (hipótese selecionada) | `animate-breathe` (glow laranja) |
| `.gradient-text` | `.text-accent-italic` · `.gradient-peach/-moss/-salmon/-warm` |
| `card-gradient-{blue,cyan,green,orange,purple}` | `--chart-1` … `--chart-5` |
| badges de urgência (verde/amarelo/vermelho/roxo) | `Badge variant` + `--chart-*` — **sem hex novo** |
| entrada de tela | `animate-fade-up` + `delay-100…500` |
| barra de progresso do wizard | ⚠️ compor com token — `progress` não existe aqui |
| `<details>` das hipóteses | `accordion`, que já existe |

## 6. Onde cada lógica encosta no que a BeHemp já tem

| lógica do VidAI | o que já existe aqui | veredito |
|---|---|---|
| wizard de 6 etapas | `AnamneseInlineForm.tsx` (373) · `db/schema/anamneses.ts` · `app/_actions/anamneses.ts` | **evoluir** — o schema já cobre boa parte das etapas 2, 4 e 5 |
| sinais vitais por grandeza | ❌ não há campo de vitais em `anamneses` | **novo** — e é decisão de schema |
| modal de 2 passos + 3 hipóteses | ❌ | **novo** |
| status HITL de 3 valores | ❌ | **novo** — enum em `db/schema/enums.ts` |
| upload 202 + poll | ❌ (uploads hoje são síncronos e em store **público**) | **novo**, e nasce em store **privado** |
| viewer split de exame | `db/schema/exames.ts` existe; UI não | **novo** |
| RAG em 3 camadas | ❌ | **Metade 2** |
| prescrição em 2 passos | `PrescricaoInlineWizard.tsx` (408) · `lib/receituario/` | **evoluir com cuidado** — é ICP-Brasil/SNCR |
| portal sanitizado | route group `(paciente)` completo | **manter o nosso**, aplicando P6 |
| teleconsulta | 9 componentes, 3.141 linhas | 🛑 **design mantido** (`DO-12`) — só a auditoria funcional |
