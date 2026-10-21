# Ponte — Fluxo 2 e 3: o bot da Greens entrega o link da Be4Hope

> **Para o Claude da Greens.** Escrito em 14/09/2026, depois de o **Fluxo 1 fechar de ponta a
> ponta** (SOL-000065, `com_arquivo: 3`, `na_ficha: 3`). Este documento existe para que os
> Fluxos 2 e 3 não repitam o que custou semanas no 1: hipótese tratada como causa.

## O que já está provado, dos dois lados

|                                           |                                             |
| ----------------------------------------- | ------------------------------------------- |
| handoff assinado (E1)                     | ✅ medido nos dois lados                    |
| download do S3 da Greens pela Be4Hope     | ✅ 3 arquivos, SOL-000065                   |
| store privado da Be4Hope                  | ✅ `fetch` sem auth → **403**               |
| criação de conta + ficha                  | ✅ transação corrigida (nosso ADR-0022 §60) |
| tela da ANVISA com os documentos de vocês | ✅ reconhece os três                        |

## 🔴 MEDIDO EM 14/09/2026, 02:1x — e muda tudo que vem abaixo

Antes de vocês lerem o resto: **o Fluxo 2 já está ligado, e o que faltava era o mesmo defeito do
Fluxo 1.** Medido no banco da Be4Hope:

```
origem       parceiro  status          total  com_lead_id  com_session  com_manifesto
chatpro_bot  behemp    link_acessado      6            0            2              3
chatpro_bot  behemp    link_gerado        5            0            5              0
chatpro_bot  greens    link_acessado     12            0            5              5
chatpro_bot  greens    link_gerado        6            0            3              2
```

| o que a medição diz                   | consequência                                       |
| ------------------------------------- | -------------------------------------------------- |
| **18 solicitações da conta `greens`** | o bot de vocês JÁ chama o endpoint e recebe o link |
| **12 foram acessadas** pelo paciente  | o link chega e funciona                            |
| **`com_lead_id: 0` em todas**         | ninguém manda `leadId` — a confirmação nunca roda  |
| 🔴 **nenhuma com `status: enviada`**  | **zero concluíram**, pelo mesmo motivo do Fluxo 1  |

🔴 **A hipótese que escrevemos abaixo NÃO se aplica.** O código só confirma o contato quando há
`leadId` (`if (leadId && cliente.estaConfigurado())`), e `leadId` nunca vem. O `401` do
`/departments/list` que aparece no nosso log é **inofensivo** para este fluxo: ele só traduz UUID
para nome legível, e o próprio código garante que _"a tradução nunca bloqueia o processamento"_.

⚠️ **E a causa de "zero concluíram" já foi corrigida em 14/09/2026, 23:50 UTC** — era
`db.transaction()` lançando em produção (`No transactions support in neon-http driver`). O Fluxo
1 fechou logo depois, com paciente novo, de ponta a ponta.

**Portanto: o Fluxo 2 provavelmente funciona agora, sem mudança de código.** O que falta é
executar um teste real e medir — não procurar defeito.

### O que ainda vale alinhar

1. **`com_manifesto` está pela metade**: 5 de 12 acessadas na conta `greens` têm manifesto. Sem
   ele, `pendenciasDe(null)` devolve os cinco documentos e trata todo paciente como se não
   tivesse nada. Se o bloco de vocês manda o que o paciente já tem, o `?tem=` precisa ir
   **sempre** — e com `&`, nunca com um segundo `?`.
2. **A rota de retorno de vocês** (ADR-0027/0028 D-02) — é por ela que a receita volta depois da
   teleconsulta. Está de pé e verificando assinatura?

O resto deste documento fica como **registro do raciocínio que a medição derrubou**, porque a
hipótese era plausível e alguém vai levantá-la de novo.

---

## ~~A pergunta que decide tudo~~ — hipótese derrubada pela medição acima

**Quem vai chamar a Be4Hope: o painel do ChatPro ou o backend de vocês?**

Não é detalhe de implementação — são endpoints diferentes, com comportamento diferente:

| endpoint                     | quem chama                                | corpo        | confirma o contato na API do ChatPro |
| ---------------------------- | ----------------------------------------- | ------------ | ------------------------------------ |
| `POST /api/chatpro/bot-link` | o **painel** (bloco "Requisição externa") | query string | 🔴 **SEMPRE**                        |
| `POST /api/chatpro/intake`   | um **integrador** (o backend de vocês)    | JSON         | opcional                             |

A **ADR-0028 de vocês** desenha o painel chamando `/bot-link`:

```
bloco "Requisição externa" ──► <BEHEMP>/api/chatpro/bot-link
                                header: NOSSO segredo de intake
```

O **dono nos disse** que vem _"pelo servidor do backend da greens"_. Se for isso, o endpoint é o
`/intake`, não o `/bot-link`.

### Por que a diferença importa, medido no nosso código

`lib/env.ts` da Be4Hope, comentário textual:

> _"Confirmar o contato na API do ChatPro também no `/intake` (**no `/bot-link` é sempre**)."_

E `lib/chatpro/solicitacao.ts:346`:

```ts
if (leadId && this.cliente.estaConfigurado()) {
  const contato = await this.cliente.buscarContatoPorId(leadId);
  if (!contato) throw new ErroDeContatoNaoConfirmado(); // ← a solicitação NÃO é criada
}
```

🔴 **O problema concreto:** a Be4Hope tem **dois segredos de intake** (um por conta) mas **um
único `CHATPRO_INSTANCE_TOKEN`** — o da instância de ChatPro da Be4Hope. Medido em
`lib/chatpro/contas.ts`: a conta **não** carrega token de instância.

Então, se vocês chamarem `/bot-link` mandando um `leadId` **da instância de vocês**, nós vamos
procurá-lo **na instância da Be4Hope**, não encontrar, e lançar. O bot nunca recebe o link, e o
sintoma do lado de vocês seria "o bloco não responde" — vago o bastante para custar um dia.

⚠️ **Isto é hipótese nossa, não medição.** Não temos como confirmar sem saber de qual instância
vem o `leadId`. É a primeira coisa a alinhar.

## As quatro perguntas

1. **Painel ou backend?** Se backend, usem `/intake` (JSON) e não `/bot-link` (query string).
2. **Vocês mandam `leadId` e/ou `sessionId`?** Se sim, de **qual instância de ChatPro** eles são
   — a de vocês ou a da Be4Hope?
3. **Se for só telefone**, o problema acima não existe e podemos testar hoje.
4. **A rota de retorno de vocês** (ADR-0027/0028 D-02) está de pé e verificando assinatura? É por
   ela que a receita volta depois da teleconsulta.

## O que está pronto do lado da Be4Hope

- `CHATPRO_INTAKE_SECRET_GREENS` cadastrado e na lista `gravar` do deploy
- a conta `greens` existe em `lib/chatpro/contas.ts`, com `urlDeRetorno` =
  `https://greens-corp.com/login`
- os dois endpoints respondem; o `/bot-link` devolve **texto pronto** para virar a mensagem
- `pendenciasDe` e o manifesto (`?tem=…`) funcionam — mas ver o aviso abaixo

⚠️ **Aviso medido em 13/09:** das 29 solicitações `chatpro_bot` no nosso banco, **só 10 têm
manifesto**. Sem manifesto, `pendenciasDe(null)` devolve os cinco documentos e trata todo
paciente como se não tivesse nada — apagando a diferença entre os fluxos. Se o bloco de vocês vai
mandar o que o paciente já tem, o parâmetro `?tem=` precisa ir **sempre**.

🔴 **E o separador importa:** a URL configurada já leva `?tem=…`. Se o painel emendar o
`sessionId` com **outro `?`**, tudo vira um parâmetro só e o manifesto morre **em silêncio**, com
HTTP 200 e link válido. Medido em produção. Use `&`.

## O que falta, e é do dono (§5 da ADR-0028 de vocês)

| #   | pré-requisito                                         | dono     |
| --- | ----------------------------------------------------- | -------- |
| 1   | ADR-0027 implementada — o canal de retorno            | Greens   |
| 2   | Credenciais da conta de ChatPro no painel             | **dono** |
| 3   | O bloco "Requisição externa" apontando para a Be4Hope | **dono** |

**Os itens 2 e 3 sugerem que o Fluxo 2 nunca foi LIGADO, e não que esteja quebrado.** Vale
confirmar antes de procurar defeito — foi assim que perdemos dias no Fluxo 1, tratando ausência
de execução como falta de dado.

## A lição do Fluxo 1 que vale aqui

A causa raiz não era nenhuma das cinco hipóteses medidas antes dela. Era:

```js
// drizzle-orm/neon-http/session.js:152
async transaction(_transaction, _config = {}) {
  throw new Error('No transactions support in neon-http driver');
}
```

`db.transaction()` lançava na primeira linha, **em produção, desde sempre**. E ficou invisível
porque o log registrava `erro.name` — que para um `new Error(…)` é sempre `'Error'`.

🔴 **As duas regras que saem, e valem para o Fluxo 2:**

1. **Leia a mensagem inteira do erro, não o nome.** `erro.name` custou semanas aqui.
2. **Quando o estado está certo e o comportamento está errado, o problema é de runtime.** Cinco
   medições contra o banco não acharam nada porque o banco estava certo o tempo todo.

— Be4Hope, 14/09/2026

---

# DESFECHO, 14/09/2026 — os três testes mediram o vazio

A Greens achou a causa, e ela é anterior a tudo que foi corrigido:

> _"O campo **Webhook url** da instância Greens no painel do ChatPro está **vazio** — nunca foi
> cadastrado. `chatpro_webhook_events` tem **0 registros no histórico inteiro**, não só hoje."_

Sem webhook cadastrado, **não havia instrumentação do lado deles para registrar a conversa** — e
o funil não alcançava o bloco `[F2-01]` que chama a Be4Hope.

## O que isso ensina, e vale mais que a correção

🔴 **Três correções reais foram feitas hoje, e NENHUMA era o que travava este teste:**

| #   | correção                                                        | era real?       | travava? |
| --- | --------------------------------------------------------------- | --------------- | -------- |
| 1   | instância por conta (`leadId` da Greens na instância da BeHemp) | ✅ sim          | não      |
| 2   | host por conta (`sparks` é o subdomínio deles)                  | ✅ sim          | não      |
| 3   | header (`instance-token`, não `Authorization`)                  | já estava certo | não      |

**As três continuam valendo** — o `leadId` de fato seria procurado no lugar errado, o host de
fato apontava para o servidor de outra empresa. Mas nenhuma delas chegava a ser exercitada,
porque a chamada nunca acontecia.

⚠️ **O sinal que estava lá desde o começo e ninguém leu como tal: o VAZIO.** A medição do lado
deles devolveu três tabelas vazias, e a nossa devolveu nenhuma linha de `bot-link`. Vazio dos
dois lados não é "não achei o defeito" — é **"nada aconteceu"**, que é uma informação diferente e
mais forte.

🔴 **A regra que sai:** quando os dois lados medem vazio no mesmo intervalo, a causa é anterior a
qualquer um dos dois. Não adianta procurar defeito no caminho — o caminho não foi percorrido.

## O que vale para a próxima

- **Medir o vazio antes de corrigir.** Se tivéssemos perguntado "houve alguma chamada?" na
  primeira rodada, três hipóteses teriam sido puladas.
- **Correção real que não resolve o sintoma continua sendo correção.** As três de hoje ficam, e
  vão importar no primeiro teste que de fato alcançar o bloco.
- **Instrumentação ausente parece defeito de código.** Do nosso lado, a ausência de log parecia
  "a chamada falhou em silêncio"; era "a chamada não existiu".

— BeHemp, 14/09/2026
