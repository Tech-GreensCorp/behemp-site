# Os oito fluxos — Greens e BeHemp

> 🔴 **Documento vivo.** O dono mantém os fluxos; esta cópia acompanha. Quando ele mandar uma
> versão nova, **o texto dos fluxos se substitui** e a coluna de estado se remede — nunca o
> contrário. Criado em 10/09/2026 a pedido dele: _"salve eles em um documento e conforme eu
> atualizar você atualiza ele em paralelo"_.
>
> **A fonte dos fluxos é o dono. A fonte do estado é o código.** Nenhuma linha da coluna
> "estado" entra sem ter sido medida.

## Como ler

| marca | quer dizer                                 |
| ----- | ------------------------------------------ |
| ✅    | existe e foi medido                        |
| 🟡    | existe em parte — a coluna diz o que falta |
| 🔴    | não existe                                 |
| ⏸️    | adiado por decisão registrada              |

---

# FLUXO GREENS

## Fluxo Greens 1 — paciente **sem ANVISA**, veio do **formulário** da Greens

| #   | passo                                                      | estado | medido                                                    |
| --- | ---------------------------------------------------------- | ------ | --------------------------------------------------------- |
| 1   | não tem ANVISA e veio do link da Greens                    | ✅     | `POST /api/parceiros/greens/cadastro`, HMAC               |
| 2   | documentos e dados vão para a BeHemp                       | ✅     | contrato aceita arquivo; baixa com allowlist e re-hospeda |
| 3   | BeHemp cria a conta                                        | ✅     | `app/_actions/cadastro-por-link.ts`                       |
| 4   | tela só com **código do e-mail + senha**                   | ✅     | confirma os dados do parceiro; não pede de novo           |
| 5   | direcionado direto para a procuração da ANVISA             | ✅     | `destinoDepoisDoCadastro` → `/paciente/anvisa`            |
| 6   | documentos e dados já preenchidos                          | ✅     | viram linha em `documentos`, que a tela da ANVISA lê      |
| 7   | aprovado/rejeitado → notificação e-mail, celular e sistema | ⏸️     | só o sistema (Pusher) — **Item 29**, adiado               |
| 8   | se aprovado, a ANVISA vai para a Greens                    | ✅     | `notificarParceiro({ tipo: 'anvisa_aprovada' })`          |

🔴 **A pergunta da ANVISA NÃO aparece neste fluxo.** Ele já declarou no formulário da Greens
que não tem — a pendência aqui é a **consequência** daquela resposta, não uma dúvida nova.
Corrigido em 10/09/2026, pela ORIGEM (`greens_handoff`) e não pelo parceiro: o **bot** da
Greens também grava `parceiro: 'greens'` e não perguntou nada.

## Fluxo Greens 2 — paciente **sem receita**, veio do **bot** da Greens

| #   | passo                                                | estado | medido                                          |
| --- | ---------------------------------------------------- | ------ | ----------------------------------------------- |
| 1   | ChatPro da Greens envia o link da BeHemp             | 🟡     | endpoint pronto; **falta o bloco no bot deles** |
| 2   | mesmo formulário, com os dados básicos               | ✅     | `/cadastro/<token>`                             |
| 3   | dados restantes ficam pendentes como aviso           | ✅     | `pendenciasDe`                                  |
| 3b  | pergunta se já tem a ANVISA; se tiver, anexa ali     | ✅     | a declaração é gravada mesmo sem arquivo        |
| 4   | encaminha direto para o agendamento                  | ✅     | `/agendamento`                                  |
| 5   | receita vai à Greens, com aviso **e consentimento**  | 🟡     | aviso ✅; **consentimento 🔴**                  |
| 5b  | depois da receita, aviso com botão para a procuração | 🔴     | a declaração já está gravada; falta o aviso     |

## Fluxo Greens 3 — paciente **tem tudo / recompra**

| #   | passo                                                                  | estado | o que falta                          |
| --- | ---------------------------------------------------------------------- | ------ | ------------------------------------ |
| 1   | ChatPro envia link com **dois botões**: "já tenho conta" / "não tenho" | 🔴     | o bot decide; o link é o mesmo hoje  |
| 2   | com conta → login · sem conta → **formulário completo** com documentos | 🔴     | **o formulário completo não existe** |

## Fluxo Greens 4 — paciente **novo, sem nada**

| #   | passo                                                                       | estado | o que falta                                |
| --- | --------------------------------------------------------------------------- | ------ | ------------------------------------------ |
| 1   | ChatPro da Greens envia o **formulário completo** da BeHemp                 | 🔴     | **o formulário completo não existe**       |
| 2   | preenche tudo, com senha e código do e-mail nas etapas                      | 🟡     | as etapas existem; falta a coleta completa |
| 3   | direcionamento para o agendamento                                           | ✅     | `/agendamento`                             |
| 4   | depois de agendar (ou da teleconsulta), aviso com ação rápida para a ANVISA | 🔴     | mesma peça do 5b do fluxo 2                |
| 5   | ao terminar, **pergunta se consente** em enviar dados e documentos à Greens | 🔴     | é a peça grande — ver o bloco abaixo       |

---

# FLUXO BEHEMP

## Fluxo BeHemp 1 — paciente **sem ANVISA**

**Usa o formulário BÁSICO** — o que já existe.

| #   | passo                                                                   | estado | medido                                 |
| --- | ----------------------------------------------------------------------- | ------ | -------------------------------------- |
| 1   | ChatPro manda o link com as informações básicas                         | ✅     | `/api/chatpro/bot-link`                |
| 2   | formulário preenchido → área da procuração da ANVISA                    | 🟡     | **o bot não sabe que ele tem receita** |
| 3   | com consentimento + recomendação médica, a Greens recebe e cria a conta | 🔴     | a peça grande — ver abaixo             |

⚠️ **O passo 2 não funciona hoje.** O bot da BeHemp não pergunta o que o paciente já tem;
sem manifesto, consideramos que falta tudo — inclusive a receita — e o destino vira o
agendamento. Para ir à procuração, falta perguntar **"você já tem receita médica?"**, do mesmo
jeito que já perguntamos pela ANVISA.

## Fluxo BeHemp 2 — paciente **sem receita**

**Usa o formulário COMPLETO**, idêntico ao da Greens.

| #   | passo                                                       | estado | o que falta                          |
| --- | ----------------------------------------------------------- | ------ | ------------------------------------ |
| 1   | ChatPro envia o formulário completo                         | 🔴     | **o formulário completo não existe** |
| 2   | preenchido → área de agendamento                            | ✅     | `/agendamento`                       |
| 3   | dados faltantes ficam pendentes com aviso                   | ✅     | `pendenciasDe`                       |
| 4   | consentimento + recomendação → Greens recebe e cria a conta | 🔴     | a peça grande — ver abaixo           |

## Fluxo BeHemp 3 — paciente **não possui nenhum dos dois**

**Usa o formulário COMPLETO**, idêntico ao da Greens.

| #   | passo                                                                          | estado | o que falta                          |
| --- | ------------------------------------------------------------------------------ | ------ | ------------------------------------ |
| 1   | ChatPro envia o formulário completo                                            | 🔴     | **o formulário completo não existe** |
| 2   | preenche e vai para o agendamento                                              | ✅     | `/agendamento`                       |
| 3   | ao finalizar o agendamento, aviso de que não tem ANVISA + oferta da procuração | 🔴     | mesma peça do 5b                     |
| 4   | consentimento + recomendação → Greens recebe e cria a conta                    | 🔴     | a peça grande — ver abaixo           |

## Fluxo BeHemp 4 — paciente **novo, sem nada**

| #   | passo                                                          | estado | o que falta                |
| --- | -------------------------------------------------------------- | ------ | -------------------------- |
| 1   | ChatPro da BeHemp envia o **formulário completo**              | 🔴     | o formulário completo (P3) |
| 2   | preenche tudo, com senha e código do e-mail nas etapas         | 🟡     | as etapas existem          |
| 3   | direcionamento para o agendamento                              | ✅     | `/agendamento`             |
| 4   | depois de agendar, aviso com ação rápida para a procuração     | 🔴     | P2                         |
| 5   | pergunta se **consente** em enviar dados e documentos à Greens | 🔴     | P5 — depende de base legal |

---

# As três peças que faltam, e elas se repetem

## 1 · O **formulário completo** — pedido por 4 dos 7 fluxos

Greens 3, Greens 4, BeHemp 2 e BeHemp 3 pedem _"formulário idêntico ao da Greens"_: dados
**e documentos**. O nosso hoje é o **básico** — nome, CPF, telefone, e-mail, senha, a pergunta
do tratamento e (desde 10/09) a pergunta da ANVISA com anexo.

**O que falta:** coletar os outros documentos — receita, laudo, comprovante, identidade. A peça
de anexo já existe e funciona (`lib/documentos/anexo-do-cadastro.ts`); o que falta é repeti-la
por tipo, com a mesma regra de tamanho e MIME.

## 2 · O **aviso com ação rápida** depois da consulta — pedido por 3 fluxos

Greens 2 (5b), Greens 4 (4) e BeHemp 3 (3) pedem a mesma coisa: terminada a consulta, avisar
que falta a ANVISA e oferecer a procuração em um clique.

🔴 **A parte difícil já está pronta:** a declaração "não tenho ANVISA" fica gravada desde
10/09, então o sistema sabe a quem oferecer **sem perguntar de novo**.

Encosta no **Item 29** (notificar por e-mail e WhatsApp) — são a mesma peça vista de dois
ângulos, e vale fazer juntas.

## 3 · 🔴 O **envio à Greens com consentimento** — pedido por 4 fluxos

Greens 4 (5), BeHemp 1 (3), BeHemp 2 (4) e BeHemp 3 (4). É **transferência de cadastro**, não
aviso: dados do paciente **e documentos**, para a Greens criar a conta lá.

O que existe hoje carrega quatro campos e diz **que** algo ficou pronto, nunca **o que** — há
guarda impedindo o contrário, com a justificativa escrita no teste:

> _"Quem precisa do conteúdo tem a ficha, com controle de acesso. Mandá-lo para outra empresa
> criaria uma segunda cópia sem esse controle."_

| #   | o que falta                                                | quem decide     |
| --- | ---------------------------------------------------------- | --------------- |
| 1   | **base legal e contrato de operador** entre as empresas    | 🔴 **Jurídico** |
| 2   | texto do consentimento, momento, e o que fica registrado   | dono + Jurídico |
| 3   | endpoint na Greens que recebe cadastro + documentos        | Greens          |
| 4   | envio assinado daqui                                       | BeHemp          |
| 5   | retificar a ADR-0016 e o guarda, que hoje **proíbem** isso | BeHemp          |
| 6   | **store privado** — hoje os blobs são públicos (Item 6)    | BeHemp          |

⚠️ O item 1 é bloqueante e **não é técnico** — dados de saúde, LGPD art. 11. O consentimento do
paciente **autoriza o ato**; não substitui a base legal entre as empresas. As duas são
necessárias e são coisas diferentes.

⚠️ E o item 6 vem antes na ordem prática: enquanto os documentos estiverem em store público,
qualquer URL assinada que mandarmos é teatro. O lado da Greens mediu o bucket deles e provou
que é privado (403, não 404); nós ainda não podemos afirmar o mesmo.

---

# ⚠️ Um caso que o dono apontou como inexistente

A variante _"tem receita válida E tem ANVISA"_ **não deve chegar à BeHemp**: quem tem os dois
compra direto na Greens. Se aparecer um cadastro assim, é sinal de erro no encaminhamento —
não de um fluxo novo.

---

# O que ficou pendente, com o registro

| item                                          | onde                                       |
| --------------------------------------------- | ------------------------------------------ |
| notificação da ANVISA por e-mail e WhatsApp   | `04-LISTA-DE-AFAZERES` Item 29             |
| validade da receita: 30 dias × 6 meses        | `02-CATALOGO-DE-REGRAS`, `VAL-01`/`VAL-02` |
| TURN da Cloudflare                            | `ADR-0020` §3 — adiado pelo chefe          |
| os 3 crons antigos, desligados de propósito   | `03-CHECKLIST-MESTRE`, 10/09               |
| store público dos documentos                  | `04-LISTA-DE-AFAZERES` Item 6              |
| `laudo_medico` sem tipo equivalente na tabela | `lib/parceiros/materializar-documentos.ts` |
