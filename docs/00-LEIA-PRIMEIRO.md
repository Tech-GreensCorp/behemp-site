# Documentação do Be4Hope / BeHemp — o mapa

> **Esta pasta é o mapa, não o conteúdo.** Cada arquivo responde a uma pergunta diferente.
> Abrir todos numa sessão enche a janela e piora a recuperação.

🔴 **Todo arquivo ou pasta novo em docs/ entra neste mapa NO MESMO COMMIT que o cria. Índice
atrasado é defeito, não atraso.**

**Atualizado em 21/09/2026 — 19 arquivos e 6 pastas em `docs/`.**

⚠️ **Retificação, 21/09/2026.** O mapa anterior cobria 14 arquivos e 3 pastas, e **omitia sete
entradas que existem no disco**: `09-FRONTEND-VIDAI-MEDIDO.md`, `10-PADRAO-DO-KANBAN.md`,
`11-OS-OITO-FLUXOS.md`, `PLANO-DE-CORRECAO-DO-DEPLOY.md`, e as pastas `chatpro/`,
`decisoes-visuais/` e `integracao-greens/`. A tabela abaixo cobre **todos** os 19 arquivos e as
6 pastas. Nenhum caminho citado pelo mapa anterior estava quebrado — o defeito era omissão, não
link morto.

---

## Abra quando

| # | arquivo ou pasta | abra quando |
|---|---|---|
| 05 | [HANDOFF-SESSAO](05-HANDOFF-SESSAO.md) | 🔴 **sessão nova** — "se não ler, você refaz o que já foi feito, repete um erro que já custou caro, ou reabre uma decisão que já foi tomada" |
| 03 | [CHECKLIST-MESTRE](03-CHECKLIST-MESTRE.md) | 🔴 **toda sessão** — diz **o quê** e **quando**; todo achado novo entra aqui |
| 04 | [LISTA-DE-AFAZERES](04-LISTA-DE-AFAZERES.md) | vai executar um item — diz **como**, e nada entra sem `caminho/arquivo.ts:linha` |
| 06 | [PADROES-DO-CODIGO](06-PADROES-DO-CODIGO.md) | 🔴 **vai escrever código ou UI** — o que o repositório **já faz**, medido com caminho e contagem |
| 01 | [REGRA-DE-NEGOCIO](01-REGRA-DE-NEGOCIO.md) | precisa saber **o que o produto faz**: atores, papéis, entidades e fluxos |
| 02 | [CATALOGO-DE-REGRAS](02-CATALOGO-DE-REGRAS.md) | vai citar regra externa — **cite o ID, nunca a paráfrase** |
| 09 | [FRONTEND-VIDAI-MEDIDO](09-FRONTEND-VIDAI-MEDIDO.md) | 🔴 **vai construir tela de IA clínica** — como um médico opera uma IA sem que ela decida por ele |
| 10 | [PADRAO-DO-KANBAN](10-PADRAO-DO-KANBAN.md) | vai escrever cartão do Trello — **é a regra, não a sugestão** (modelo aprovado em 25/08/2026) |
| 11 | [OS-OITO-FLUXOS](11-OS-OITO-FLUXOS.md) | 🔴 **documento vivo** — os fluxos do dono; quando ele manda versão nova, o texto se substitui |
| — | [PLANO-DE-CORRECAO-DO-DEPLOY](PLANO-DE-CORRECAO-DO-DEPLOY.md) | 🔴 **o deploy não chegou a produção** — escrito em 10/09/2026, depois de nenhum deploy chegar ao processo entre 14/08 e 10/09 |
| — | [PRINCIPIOS](PRINCIPIOS.md) | 🔴 **vai justificar uma decisão** — princípios A–P e fases 0–15 |
| — | [TECNICA-DOS-GUARDAS](TECNICA-DOS-GUARDAS.md) | vai escrever um teste que quebra o build quando uma **classe** de erro reaparece |
| — | [DECISOES_TECNICAS](DECISOES_TECNICAS.md) | decisão de infraestrutura e deploy — **DT-001 a DT-010**, não migrar, não apagar |
| 07 | [ESTADO-DO-KIT](07-ESTADO-DO-KIT.md) | quer saber o que do kit de documentação entrou — auditado em 19/08/2026, o kit foi removido depois de integrado |
| 08 | [AVALIACAO-DAS-SKILLS](08-AVALIACAO-DAS-SKILLS.md) | quer saber por que uma skill entrou ou foi descartada — feita em 19/08/2026 a pedido do dono |
| — | [adr/](adr/) · 23 ADRs | vai decidir algo, ou propor algo que talvez já tenha sido **rejeitado** |
| — | [sprints/](sprints/) · 9 sprints + o plano | quer o escopo de uma fatia: entregáveis, aceite e o que fica fora |
| — | [arvore-do-conhecimento/](arvore-do-conhecimento/00-RAIZ.md) · 15 arquivos | precisa da teoria de um tópico — **abra só o ramo**, nunca a árvore toda |
| — | [decisoes-visuais/](decisoes-visuais/) · 2 arquivos | 🔴 **ANTES DE CADA SPRINT** (`DO-32`) — o `LEIA-ANTES-DE-CADA-SPRINT.md` diz quando abrir o `.html` ao lado |
| — | [chatpro/](chatpro/) · 3 arquivos | vai mexer na integração do ChatPro — `COMO-CONECTAR-NO-PAINEL`, `CONTRATO-DA-PAGINA-DE-CADASTRO`, `QA-DA-INTEGRACAO` |
| — | [integracao-greens/](integracao-greens/) · 3 arquivos | vai trocar mensagem com a Greens — a ponte do Fluxo 2, o prompt sobre documentos que não chegam, e a resposta sobre o reenvio |
| — | [historico/](historico/2026-09-organizacao/) | documentos de estado morto, arquivados com README de desfecho — nunca fonte |
| — | [BACKUP_LOG](historico/2026-09-organizacao/BACKUP_LOG.md) | arquivado — [historico/2026-09-organizacao/](historico/2026-09-organizacao/) |
| — | [progresso](historico/2026-09-organizacao/progresso.md) | arquivado — [historico/2026-09-organizacao/](historico/2026-09-organizacao/) |
| — | [integracoes](historico/2026-09-organizacao/integracoes.md) | arquivado — [historico/2026-09-organizacao/](historico/2026-09-organizacao/) |

⚠️ **Nenhum destes 19 arquivos declara data de atualização nas primeiras linhas** — medido em
21/09/2026. A coluna acima vem do título e do cabeçalho de cada um, não de interpretação. Quando
um arquivo não diz para que serve, a coluna diz o que ele contém.

⚠️ **`docs/ponte/` chega com o merge da ADR-0023 e entra no mapa nesse commit.** Ela existe hoje
só no branch `docs/adr-0023-o-fluxo-da-receita-reusa-o-trilho`, que não foi mesclado — este mapa
cobre o que está em disco aqui.

---

## Este mapa é a fonte; o `CLAUDE.md` espelha

O `CLAUDE.md` da raiz tem uma tabela própria com o mesmo papel. **Divergência entre as duas é
defeito a corrigir NO `CLAUDE.md`** — este mapa é a fonte, porque vive ao lado do que indexa.

🔴 **Divergências medidas em 21/09/2026, ainda não corrigidas:** o `CLAUDE.md` **não** lista
`07-ESTADO-DO-KIT.md`, `08-AVALIACAO-DAS-SKILLS.md`, `BACKUP_LOG.md`, `integracoes.md`,
`progresso.md`, nem as pastas `chatpro/` e `integracao-greens/`. São sete entradas, e a correção
é trabalho próprio — não se faz no mesmo commit que este mapa.

---

## Os quatro documentos vivos

| documento | responde | quando se escreve |
|---|---|---|
| **03-CHECKLIST-MESTRE** | *o quê* e *quando* | ao descobrir |
| **04-LISTA-DE-AFAZERES** | *como* — diagnóstico, evidência, `caminho:linha` | ao diagnosticar |
| **adr/** | *por quê*, e o que foi **rejeitado** | **antes** de implementar |
| **05-HANDOFF-SESSAO** | *onde paramos* | ao fim de sessão longa |

**O teste que diz se está bom:** uma sessão nova, sem histórico, consegue retomar lendo só o
disco? Se a resposta depende de *"a gente tinha combinado que…"*, escreva antes de continuar.

---

## O que este projeto é, em uma linha

Plataforma privada **Be4Hope**: telemedicina, acompanhamento clínico, documentos, chat, agenda,
recompras e invoices. **Dado de paciente é sensível por padrão** — segurança, escopo por role e
auditoria valem mais que conveniência.

⚠️ **O `02` foi atualizado em 14/09/2026** e o cabeçalho dele ainda diz _"aguardando a demanda em
definição"_ — o cabeçalho é que está atrasado, não o conteúdo. O `01` segue como estava em 20/08.
Enquanto a regra de negócio nova não estiver escrita, o que vale é o `AGENTS.md` (contrato,
carregado por import no `CLAUDE.md`) e o `06-PADROES-DO-CODIGO.md` (o que o código faz de fato).
