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

## 🔴 A pergunta que decide tudo, e é UMA

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
