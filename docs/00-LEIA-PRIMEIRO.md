# Documentação do Be4Hope / BeHemp — o mapa

> **Esta pasta é o mapa, não o conteúdo.** Cada arquivo responde a uma pergunta diferente.
> Abrir todos numa sessão enche a janela e piora a recuperação.

**Reestruturada em 20/08/2026.** O método veio de um kit de documentação, adaptado e medido
contra este repositório. O `CLAUDE.md` da raiz indexa o que segue.

---

## Abra quando

| # | arquivo | abra quando |
|---|---|---|
| 05 | [HANDOFF-SESSAO](05-HANDOFF-SESSAO.md) | 🔴 **sessão nova** — onde a anterior parou e o que **não** fazer |
| 03 | [CHECKLIST-MESTRE](03-CHECKLIST-MESTRE.md) | 🔴 **toda sessão** — o que falta, por prioridade, e a fila oficial |
| 04 | [LISTA-DE-AFAZERES](04-LISTA-DE-AFAZERES.md) | vai executar um item — traz diagnóstico e `caminho:linha` |
| 06 | [PADROES-DO-CODIGO](06-PADROES-DO-CODIGO.md) | 🔴 **vai escrever qualquer linha de código ou UI** — cores, animações, componentes e convenções **medidos** |
| 01 | [REGRA-DE-NEGOCIO](01-REGRA-DE-NEGOCIO.md) | precisa saber o que o produto faz: atores, papéis, entidades, fluxos |
| 02 | [CATALOGO-DE-REGRAS](02-CATALOGO-DE-REGRAS.md) | vai citar uma regra externa — **cite o ID, nunca a paráfrase** |
| — | [adr/](adr/) | vai decidir algo, ou propor algo que talvez já tenha sido **rejeitado** |
| — | [sprints/](sprints/) | quer o escopo de uma fatia: entregáveis, aceite e o que fica fora |
| 07 | [ESTADO-DO-KIT](07-ESTADO-DO-KIT.md) | quer saber o que do método de documentação está instalado |
| 08 | [AVALIACAO-DAS-SKILLS](08-AVALIACAO-DAS-SKILLS.md) | quer saber por que uma skill entrou ou foi descartada |
| — | [PRINCIPIOS](PRINCIPIOS.md) | 🔴 **vai justificar uma decisão** — princípios A–P e fases 0–15 |
| — | [arvore-do-conhecimento/](arvore-do-conhecimento/00-RAIZ.md) | precisa da teoria de um tópico — **abra só o ramo** |
| — | [TECNICA-DOS-GUARDAS](TECNICA-DOS-GUARDAS.md) | vai escrever um teste que impeça uma classe de erro de voltar |
| — | [DECISOES_TECNICAS](DECISOES_TECNICAS.md) | decisão de infraestrutura e deploy — **DT-001 a DT-010**, não migrar, não apagar |
| — | [integracoes](integracoes.md) · [progresso](progresso.md) · [BACKUP_LOG](BACKUP_LOG.md) | histórico anterior do projeto |

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

⚠️ **`01` e `02` estão aguardando a demanda em definição.** Enquanto a regra de negócio da
demanda nova não estiver escrita, o que vale é o `AGENTS.md` (contrato, carregado por import no
`CLAUDE.md`) e o `06-PADROES-DO-CODIGO.md` (o que o código faz de fato).
