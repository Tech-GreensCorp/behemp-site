# O padrão do Kanban — Be4Hope no Trello

> 🎯 **Este documento é a regra, não a sugestão.** Ele nasceu da construção do **Cartão 7**, que
> o dev Davi aprovou como modelo em 25/08/2026: _"AGORA SIM, isso é um cartão de respeito, ta
> perfeito assim, ja salva esse modelo de card e a nossa nova forma de criar o kanban no trello"_.
>
> Quadro: **Plataforma Be4hope**.

---

## §1 — Para quem estes cartões são escritos

**Para o Gabriel (chef dev) e a Dryelle (dev) — que NÃO têm o código aberto ao lado.**

É a decisão `DO-56`, e a frase que a originou:

> _"os textos não podem ficar em aberto, eles tem que ter a lógica textual das implementações
> evitando que o meu chef dev (gabriel) e a outra dev (dryelle) peguem textos incompletos com
> referencias que so dariam para entender olhando o código, tem que estar tudo explicado, do
> porque foi feito assim, qual decisão foi tomada, em que tela isso aparece, como que impacta o
> paciente ou médico ou admin ou ambos"_

🔴 **O teste que reprova um cartão:** se para entender o que foi feito a pessoa precisar abrir um
arquivo `.ts`, o cartão está incompleto. Referência a caminho e a doc **fica** — ela ajuda a
localizar depois — mas ela é o **complemento**, nunca a explicação.

---

## §2 — A anatomia obrigatória de um cartão

Todo cartão de trabalho responde **quatro perguntas**, nesta ordem. As seções abaixo são o
esqueleto do Cartão 7, e é ele que se copia.

### 1. `## Por que este cartão existe`

O problema, em prosa, para quem não acompanhou a conversa. Sem jargão de fila, sem "conforme
alinhado". Se houver um número que dê a dimensão do problema, ele entra aqui — **medido**, nunca
estimado.

> Exemplo do Cartão 7: _"Cinco sprints foram construídas e NENHUMA foi testada por um humano de
> ponta a ponta. O que existe hoje são 322 casos de guarda estrutural. Eles leem o código-fonte e
> provam que certas regras não foram violadas (…) O que eles NÃO fazem: abrir o navegador."_

### 2. `## O que foi decidido, e por quê`

A decisão, com a **frase literal de quem decidiu** e o ID (`DO-nn`). E — a parte que mais falta —
**o caminho rejeitado e o motivo**. Decisão sem rejeitado parece arbitrária, e quem pega o cartão
seis meses depois desfaz sem saber que já foi discutido.

### 3. `## Em que tela isso aparece`

Rota, nome da aba, posição na página. Quem for testar precisa **encontrar** a coisa.

### 4. `## Quem é impactado`

Nomear explicitamente: **MÉDICO**, **PACIENTE**, **ADMIN** — e dizer **o que acontece de ruim**
se aquilo falhar. Não é enfeite: é o que permite priorizar um defeito sem reabrir a discussão.

> Exemplo do Cartão 7: _"PACIENTE — o que ele vê e assina (…) Falha aqui significa paciente sem
> acesso ao próprio tratamento, ou vendo informação de IA que não foi revisada por médico nenhum."_

### Seções que entram quando cabem

| seção                                            | quando                                                 |
| ------------------------------------------------ | ------------------------------------------------------ |
| `## 🛑 Este cartão NÃO pode ser executado ainda` | há bloqueio real — e ele diz **de quem** e **por quê** |
| `## Como acessar para testar`                    | o cartão exige mexer no sistema (URL, login, comandos) |
| `## O que fazer ao encontrar um defeito`         | cartões de QA e revisão                                |
| `## O que este cartão NÃO faz`                   | o escopo tem uma fronteira que alguém tentaria cruzar  |

---

## §3 — As regras de formato do Trello, medidas na documentação oficial

Estas não são preferência — são o que o Trello aceita.

### 🛑 Tabela Markdown NÃO funciona

_"tables are a part of the markdown standard, [but] they are not supported by Trello"_. Nossas
docs são quase todas tabelas; ao trazer para o cartão, **vira lista**.

### Markdown vale em três lugares, e o título não é um deles

| onde                 | o que funciona                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| descrição do cartão  | `##` títulos · `**negrito**` · `*itálico*` · `~~riscado~~` · listas · `> citação` · `` `código` `` · links · `---` |
| item de checklist    | **só** negrito, itálico, riscado, código e link — nada de lista ou título                                          |
| comentário           | o mesmo da descrição                                                                                               |
| **título do cartão** | 🛑 **nada** — texto puro                                                                                           |

Blockquote aninhada também não funciona.

### 🔴 O erro do checklist, que já aconteceu duas vezes

**`- [ ]` e `- [x]` NÃO são checkbox no Trello.** No Trello o item de checklist **já é** um
checkbox nativo; colar `- [x] pnpm test verde` cria um item cujo **texto** é `- [x] pnpm test
verde`, com o quadradinho vazio ao lado.

E há um segundo erro, que aconteceu em seguida: usar **"Adicionar checklist"** para cada linha
cria **um checklist por linha**, com a linha virando título e zero itens dentro.

**O jeito certo:**

1. **"Adicionar checklist"** → dê um **nome de grupo** (ex.: `Conduta, titulação e prescrição`)
2. clique em **"Adicionar um item"**
3. **cole o bloco inteiro de uma vez** — _"a separate checklist item will be created for each
   item that is on its own line"_
4. o que já está pronto se marca **clicando**, nunca escrevendo `[x]`

⚠️ Só funciona no navegador/desktop. No app de celular o Trello não fatia por linha.

### O item de checklist é uma AÇÃO VERIFICÁVEL, não um lembrete

Ruim: `testar a conduta`
Bom: `Apagar o campo de teor e conferir que a tela diz que NAO SABE — nunca assume o receituario mais simples`

O item bom diz **o que fazer** e **o que tem de acontecer**. Quem marca não precisa interpretar.

⚠️ **Evite acento e caractere especial em item de checklist longo** — na colagem em massa eles
às vezes chegam quebrados. O texto sem acento continua legível; item cortado no meio, não.

---

## §4 — O quadro: as seis listas e o que cada uma significa

| lista                        | significa                                                              |
| ---------------------------- | ---------------------------------------------------------------------- |
| **Em planejamento**          | decidido que vai acontecer; ainda não começou                          |
| **Documentação / Plano**     | trabalho de ler, escrever e decidir — ADR, transcrição de norma, plano |
| **Em desenvolvimento**       | alguém está com a mão nisso **agora**                                  |
| **Em Revisão/Teste**         | construído, sendo verificado                                           |
| **Apresentação / Aprovação** | verificado, aguardando o aceite do dev Davi                            |
| **Deploy**                   | 🔴 **subiu para produção de verdade**                                  |

🛑 **`Deploy` só recebe o que está em produção.** Enquanto `origin/main` não tiver o commit, o
cartão não entra ali. Cartão em Deploy que não deployou é a mentira mais cara de um quadro — a
partir dela, ninguém confia em nenhuma outra coluna.

⚠️ **Lista com 12+ cartões vira balde.** Ninguém lê até o fim, e o que está no fundo some.
Quando passar disso, é sinal de que os cartões estão na coluna errada, não de que a coluna é
grande.

---

## §5 — As oito etiquetas

| cor             | nome                              | responde à pergunta                 |
| --------------- | --------------------------------- | ----------------------------------- |
| 🟢 verde escuro | `Entregue`                        | já está pronto e verificado         |
| 🟩 verde claro  | _(livre)_                         | —                                   |
| 🟡 amarelo      | `Aguarda terceiro`                | Jurídico, AWS, farmacêutico, médico |
| 🟠 laranja      | `Regulatório`                     | ANVISA, CFM, LGPD obrigam           |
| 🔴 vermelho     | `Risco / Segurança`               | pode vazar dado ou quebrar produção |
| 🟣 roxo         | `Decisão do dev Davi`             | só anda com resposta dele           |
| 🔵 azul         | `Documentação / ADR`              | onde a decisão está escrita         |
| ⚫ preto suave  | `Decisão do chefe do setor de TI` | escala acima do dev Davi            |

Nomear as etiquetas é recomendação da própria Atlassian: _"naming labels can make it so much
easier to remember and share what the label represents"_.

---

## §6 — Como escrever um cartão, na prática

1. **Leia a fonte no disco** — a ADR, a sprint, o item do `04`. O cartão é a **tradução** dela
   para quem não vai abri-la.
2. **Escreva as quatro seções** da §2. Se alguma ficar vazia, o cartão não está pronto.
3. **Traduza toda tabela em lista.**
4. **Cite a decisão com a frase literal** e o `DO-nn`.
5. **Diga a tela e o impacto por perfil.**
6. **Escreva o checklist como ações verificáveis**, agrupadas por assunto — o Cartão 7 tem 8
   grupos, e é isso que o torna navegável.
7. **Aponte a doc no fim**, como complemento: `docs/adr/ADR-00nn`.

### O que reprova um cartão

- explicação que só faz sentido com o código aberto
- decisão sem o rejeitado
- item de checklist que não diz o que tem de acontecer
- tabela markdown (não renderiza)
- `- [ ]` dentro de item de checklist
- número não medido apresentado como fato

---

## §7 — Fontes

Documentação oficial da Atlassian, consultada em 25/08/2026:

- [Format text in Trello](https://support.atlassian.com/trello/docs/how-to-format-your-text-in-trello/) — o que o Markdown aceita
- [Add, delete, and manage checklists](https://support.atlassian.com/trello/docs/adding-checklists-to-cards/)
- [Add a label to a card](https://support.atlassian.com/trello/docs/adding-labels-to-cards/)
- [Trello labels: organize, categorize, prioritize](https://www.atlassian.com/blog/trello/taco-tuesdays-learning-to-love-labels)
- [Paste multiple text into separate checklists](https://community.atlassian.com/t5/Trello-questions/Paste-multiple-Text-into-separate-check-lists-on-a-Tello-Card/qaq-p/787447)

Prática de Kanban:

- [Kanban cards — Atlassian](https://www.atlassian.com/agile/kanban/cards)
- [Perfecting the Kanban Card Design](https://kanbantool.com/blog/perfecting-the-kanban-card-design) — título começa com verbo de ação
- [Definition of Done on the Kanban Board](https://kanbanzone.com/2019/definition-of-done-kanban-board/)

Decisões do dev Davi: `DO-54` (GAPs em um cartão), `DO-56` (o texto é para humano sem o código).
