# Regra de negócio — Be4Hope / BeHemp

> Diz **o que o produto faz**: atores, papéis, entidades e fluxos.
> Onde este arquivo e o código divergirem, **o código vence** — e a divergência é bug deste
> arquivo.

**Aberto em 20/08/2026. Primeira demanda registrada na mesma data.**

---

## A demanda: inteligência clínica assistida, direcionada ao canabidiol

Trazer para a BeHemp a inteligência clínica hoje existente no projeto VidAI — anamnese
assistida, levantamento de hipóteses, conduta sugerida, análise de exames e RAG — **adaptada ao
domínio do canabidiol**, com identidade visual e arquitetura desta casa.

**Origem:** conversa com o dono do produto em 20/08/2026. Não há documento de origem. Cada
afirmação abaixo tem `DO-nn` correspondente em
[`02-CATALOGO-DE-REGRAS.md`](02-CATALOGO-DE-REGRAS.md) — se não tem ID, não foi dito.

### 1. Atores — quem são e o que cada um NÃO faz

Permanecem **três** (`db/schema/enums.ts:9`). A demanda **não** cria papel novo (`DO-09`).

| ator | faz | **não** faz |
|---|---|---|
| `medico` | aciona a IA, lê hipóteses e conduta sugerida, **aceita, recusa ou edita**, e assina o que for prescrição | não recebe conduta aplicada automaticamente; nada da IA vira registro clínico sem o aceite dele |
| `paciente` | vê apenas o resultado **já validado** pelo médico | **nunca** vê hipótese bruta, raciocínio da IA, laudo não revisado ou conteúdo em divergência |
| `admin` | gerencia plataforma, corpus e auditoria | não decide conduta clínica |
| *farmacêutico* | valida conteúdo clínico e corpus **fora** da plataforma (`DO-09`) | **não tem login, fila nem tela** — não é ator do sistema |

⚠️ **A regra do paciente é a mais fácil de violar por descuido.** O VidAI a trata como regra de
ouro do portal: *"zero `analiseIA`/`chain_of_thought`"*. Vale aqui igual.

### 2. O que a IA produz, e o que ela nunca faz sozinha

A IA opera no **escopo máximo**: hipóteses **e** conduta, direcionadas ao canabidiol (`DO-08`).

| a IA produz | quem decide |
|---|---|
| anamnese estruturada a partir do que foi dito | médico aceita ou edita |
| hipóteses, com evidências e grau de confiança | médico seleciona, recusa ou escreve a própria |
| conduta sugerida, voltada ao canabidiol | **médico** — e a prescrição só existe com assinatura dele |
| análise de exame, incluindo imagem (`DO-10`) | médico valida ou marca divergência |

🔴 **Nenhuma saída da IA é registro clínico antes do aceite humano.** Toda superfície que a
exibe mostra: que veio da IA, o que a sustenta, e a ação de aceitar/recusar/editar — com quem
decidiu e quando. É a decisão D-03 da
[ADR-0002](adr/ADR-0002-ui-antes-da-inteligencia.md).

### 3. Estados — o ciclo de revisão humana

Vocabulário adotado do VidAI, porque ele já é usado nos 27 documentos de origem e mudá-lo
tornaria a documentação de lá ilegível aqui:

```
pendente → em análise → aguardando revisão → [ validado | divergente ] → concluído
                              ↑                        │
                              └──── reanálise ─────────┘
```

| estado | quem move | evidência que fica |
|---|---|---|
| `pendente` | sistema, ao receber o insumo | o insumo e quem o enviou |
| `em análise` | sistema | modelo usado, início |
| `aguardando revisão` | sistema, ao devolver resultado | a saída bruta, **não visível ao paciente** |
| `validado` | **médico** | quem validou, quando, o que mudou |
| `divergente` | **médico** | o motivo da divergência — é registro clínico, não descarte |
| `concluído` | médico, ao encerrar | o que virou prontuário |

⚠️ `divergente` **não** é erro a esconder: é o sinal mais valioso que existe sobre a qualidade
do modelo. Nunca sobrescrever nem apagar.

### 4. Onde mora

Tudo dentro de **`app/(medico)`** (`DO-11`). Não há sexto route group.

### 5. Termos do domínio — um conceito, um nome

Fixados aqui **antes** de aparecerem no código, para que fonte, schema, UI e log usem a mesma
palavra:

| termo | significa | não confundir com |
|---|---|---|
| **hipótese** | possibilidade clínica levantada pela IA, com evidências | diagnóstico — que é ato médico |
| **conduta sugerida** | proposta de tratamento gerada pela IA | prescrição — que exige assinatura |
| **revisão humana** (HITL) | o passo obrigatório em que o médico aceita, recusa ou edita | "aprovação" genérica |
| **divergência** | o médico discordou, e o motivo ficou registrado | rejeição silenciosa |
| **narrativa** | transcrição normalizada da consulta — **já existe** (`db/schema/teleconsultas.ts:47`) | anamnese |
| **corpus** | o conjunto de fontes que alimenta o RAG | base de conhecimento genérica |

⚠️ **Ainda não definidos, e não serão inventados:** o nome do módulo na navegação, e como a
conduta de canabidiol se relaciona com `dosagens` e `ajustes-dosagem`, que já existem em
schema. Perguntar antes de nomear.

### 6. O que fica de fora, explicitamente

- **Papel de farmacêutico** na plataforma (`DO-09`).
- **Sexto route group** (`DO-11`).
- **Portal do paciente com conteúdo de IA** — o paciente vê só o validado; nada de tela nova
  para ele nesta demanda.
- **Toda conexão com o motor, RAG e corpus na primeira metade** (`DO-06`) — ver
  [ADR-0002](adr/ADR-0002-ui-antes-da-inteligencia.md).
- **Reescrever prescrição, receituário ICP-Brasil ou SNCR.** Existem, funcionam, e a conduta
  sugerida **desemboca** neles sem alterá-los.

---

## O que se sabe hoje, do código

**Atores** — três papéis, em `db/schema/enums.ts:9`:

| ator | escopo |
|---|---|
| `admin` | gerencia a plataforma |
| `medico` | acessa **apenas** pacientes vinculados |
| `paciente` | acessa **apenas** os próprios dados |

**Áreas** — quatro route groups, cada um com os mesmos cinco arquivos:
`app/(public)` · `app/(auth)` · `app/(admin)` · `app/(medico)` · `app/(paciente)`.

**Domínios que existem em schema** (**40 tabelas** em 29 arquivos — `invoices.ts` declara 9 sozinho): pacientes, médicos, consultas, teleconsultas,
anamneses, evoluções, dosagens, medicamentos, prescrições e receituário (ICP-Brasil),
autorizações ANVISA, procurações, documentos, exames, chat, notificações, alertas, recompras,
invoices, relatórios, triagens, auditoria.

---

## Como preencher, quando a demanda chegar

1. **Atores**, com o que cada um faz e o que **não** faz
2. **Entidades**, com o que cada uma guarda
3. **Estados**, se houver fluxo — com responsável e evidência por etapa
4. **Quem decide o quê** — separando o que o sistema calcula do que a pessoa decide
5. **Termo do domínio: um conceito, um nome, em todo lugar** — fonte, doc, schema, UI e log

⚠️ Termo novo **não nasce no código**. Se foi preciso inventar um nome para escrever a função,
ele passa por aqui primeiro. A skill `/metodo-termos` faz isso.
