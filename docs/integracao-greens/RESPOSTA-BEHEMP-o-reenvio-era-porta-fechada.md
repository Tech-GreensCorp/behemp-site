# [2026-09-13] BEHEMP — a hipótese de vocês estava certa. O defeito é nosso, e já está corrigido

> Resposta ao §12 do `CONTRATO-S2-BEHEMP-PARA-GREENS.md`, entrada
> _"GREENS — medimos o nosso banco de produção: o problema dos documentos não é nosso"_.

## Confirmado, e o código é exatamente o que vocês leram

```ts
// lib/parceiros/handoff.ts — caminho 1 do receber
if (porEvento) {
  return this.reemitir(porEvento.id, porEvento.protocolo, true);
}

// e o reemitir:
.set({ tokenHash: hash, expiraEm, status: 'link_gerado' })
```

**Não tocava em `documentosDoParceiro`.** Nem em nome, CPF, telefone ou `pedidoDoParceiro`.

🔴 **E o diagnóstico de vocês está completo:** como o `eventoId` é o `medicationRequest.id` e é
estável, **todo** reenvio cai em `porEvento` — e o campo guardava a primeira versão para sempre.
A primeira é de antes de 10/09 19:54, quando ainda vinham só os nomes.

⚠️ **Vocês acharam em uma leitura o que nós não achamos em dois dias de investigação no nosso
próprio código.** Nós tínhamos os 67 itens sem arquivo à vista e concluímos que vocês não
mandavam. Estávamos errados, e a conclusão era confortável para o nosso lado — o que a torna
pior.

## O que corrigimos

`reemitir` passa a receber o corpo do reenvio e atualiza o manifesto **quando ele traz arquivo**:

```ts
...(manifestoNovo && (trazArquivo || !jaTemArquivo)
  ? { documentosDoParceiro: manifestoNovo }
  : {}),
```

**A regra é a que vocês sugeriram**, com uma condição a mais que explicitamos:

| situação                                | o que acontece                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| reenvio traz arquivo                    | ✅ atualiza                                                                                             |
| reenvio sem arquivo, e já temos arquivo | ⛔ **não mexe** — senão um reenvio pobre apagaria o que já baixamos, e a URL original já teria expirado |
| reenvio sem arquivo, e não temos nada   | ✅ atualiza — não pode ficar pior                                                                       |

🔴 **E o `eventoId` continua estável.** Não o tornamos variável, pelo motivo que vocês deram
antes de propor: trocaria este defeito por cadastro duplicado, com gateway e desconto errados
aí. Há um caso de guarda dedicado a impedir que alguém "resolva" por esse caminho no futuro.

⚠️ **Também passamos a atualizar nome, CPF e `pedidoDoParceiro` no reenvio.** O caminho 2
(reaproveitamento por contato) já fazia isso; o caminho 1 ignorava. **Dois caminhos para o mesmo
fim com regras diferentes é como a divergência nasce** — e foi assim que nasceu.

## E três defeitos nossos que a investigação revelou antes desse

Relevantes para vocês porque afetam o que vocês veem do nosso lado:

1. 🔴 **o motivo da recusa de documento era `erro.name`** — que em JS é sempre `"Error"`. Nosso
   código calculava nove motivos distintos (allowlist, 403, MIME, tamanho, DNS) e jogava todos
   fora. Foi por isso que o log dizia `receita_medica:Error` e não ajudava ninguém
2. 🔴 **o download não tinha retentativa** — um `fetch`, timeout de 30 s. Queda de rede de um
   segundo perdia o documento para sempre, porque a URL já teria expirado na próxima tentativa.
   Agora são três tentativas, **sem insistir em 403/404** (expirada é expirada)
3. 🔴 **a recusa apagava a própria prova** — o item recusado voltava ao banco como a mesma
   `string` do documento que o parceiro nunca mandou. _"Não mandou"_ e _"mandou e não
   conseguimos buscar"_ viravam o mesmo registro. Agora guarda
   `{ tipo, recusadoPorque, recusadoEm }`

## Sobre a lição do dublê — nós a adotamos

> _"Quando o contrato é de outra empresa, o dublê copia a resposta real — nunca o meu
> entendimento dela."_

⚠️ **Vale para nós pela mesma razão, e temos o caso análogo:** 1250 guardas verdes enquanto
**zero** dos 35 handoffs virava cadastro concluído. Os guardas liam o código; nenhum executava o
caminho. Começamos a corrigir isso em 13/09 com testes que rodam contra um Postgres real —
`__tests__/integracao/`, 21 casos — e o primeiro deles achou dois defeitos que nenhum guarda
pegaria.

## Sobre a medição que vocês pediram

Rodamos a query de vocês na nossa VPS. O que já temos, medido antes dela:

```
objetos: 0 · strings: 67          -- itens de documento vindos da Greens
greens_handoff: 35 links · 0 cadastros concluídos
```

⚠️ **E um ponto que muda o que esperar do conserto:** os 35 registros existentes **continuam com
o manifesto congelado**. A correção vale para o **próximo** handoff — o reenvio agora atualiza,
mas só quando acontecer. Para os antigos, o caminho é um reenvio novo de cada pedido.

**Se vocês reenviarem os pedidos que já estão em `SENT_TO_BEHEMP`, nós agora recebemos os
arquivos.** Antes desta correção, reenviar não adiantava nada — era exatamente a porta fechada
que vocês descreveram.

— BeHemp, 13/09/2026

---

# ADENDO, 13/09/2026 — vocês reenviaram, funcionou, e o defeito seguinte é NOSSO

Vocês reenviaram o SOL-000021 pela rota administrativa depois da correção acima. **Ela
funcionou** — e ao funcionar, destravou o erro seguinte, que estava escondido atrás dela.

## O que o reenvio de vocês provou, em ordem

| elo | estado | como sabemos |
| --- | ------ | ------------ |
| vocês mandam `{tipo, url}` | ✅ | manifesto gravado com **3 objetos** (antes: strings) |
| a URL passa na nossa allowlist | ✅ | chegou ao download; nenhum `origem_nao_autorizada` |
| o presigned do S3 abre | ✅ | os bytes chegaram |
| o `porEvento` atualiza o manifesto | ✅ | **é a correção de ontem, e ela pegou** |
| gravar o arquivo no nosso store | 🔴 | **falha aqui** |

## O log da nossa VPS, sem edição

```
15154: [parceiros] documentos recusados: receita_medica:Vercel Blob: Cannot use private
       access on a public store. The store must be configured with private access.
15161: (repetido)
```

E a consulta ao nosso banco, no pedido que nasceu do reenvio:

```
protocolo    | forma  | tipo                   | tem_arquivo | recusado
-------------+--------+------------------------+-------------+--------------------------------
SOL-000046   | object | receita_medica         | false       | 'Vercel Blob: Cannot use private
                                                               access on a public store.
                                                               The store must be configured
                                                               with private access.'
SOL-000046   | string | laudo_medico           | false       | null
SOL-000046   | object | comprovante_residencia | false       | (mesmo erro)
SOL-000046   | object | documento_identidade   | false       | (mesmo erro)

== DOCUMENTOS MATERIALIZADOS NA FICHA ==
(vazio)
```

⚠️ **Leiam a coluna `forma`.** Três `object` e um `string`. Os `object` são os que vocês
reenviaram com `{tipo, url}` — e cada um deles chegou até o último passo. O `string`
(`laudo_medico`) é o que vocês já haviam reportado como `tipo_nao_suportado` do lado de vocês, e
está coerente: ele nunca foi enviado, então não tem o que recusar.

## A causa, e ela é de configuração nossa

Nosso código grava documento de paciente em **store privado**, por decisão explícita — são
documentos de pacientes de vocês, e guardá-los num store público significaria que qualquer pessoa
com a URL os lê **sem autenticação**. O store que o nosso token resolve hoje, porém, foi criado
como **público**. O SDK recusa a combinação, e recusa **corretamente**.

A doc da Vercel fecha a questão: _"You select a store's access mode, public or private, when you
create it. If your app needs both public and private files, provision two separate stores from
the start."_ Não existe conversão — a correção é provisionar o store privado e apontar estes
caminhos para ele.

🔴 **Nada disso é do lado de vocês.** Registramos aqui porque vocês investiram rigor no
diagnóstico — o `grep` do `forcePathStyle`, a URL virtual-hosted, o download em 200, o
`AWS_S3_PUBLIC_BASE_URL` vazio — e o resultado desse rigor foi eliminar o lado de vocês com
prova, o que é o que permitiu achar isto aqui. **O lado da Greens está correto de ponta a ponta.**

## O que muda para vocês

**Nada no contrato, nada no código.** O formato `{tipo, url}` está certo, a origem está na nossa
allowlist, o TTL do presigned serve.

Um pedido só, e é operacional: **quando avisarmos que o store privado está no ar, reenviem os
pedidos uma última vez.** Os arquivos de agora não foram guardados — o download aconteceu, mas a
gravação falhou, então não há o que recuperar deste lado. Vamos avisar com a data e o protocolo do
primeiro que passar inteiro, para vocês conferirem contra o de vocês.

## O que aprendemos, e é a lição de vocês aplicada de volta

O erro anterior dizia `Error`. Este diz a frase inteira. A diferença é uma correção de ontem —
`erro.name` de um `new Error` é **sempre** `'Error'`, e por isso quatro dias de log não disseram
nada. **Mensagem de erro registrada pela metade custa mais que erro não registrado**, porque
parece diagnóstico e não é.

E o defeito não era só do handoff: o mesmo `access: 'private'` está em **cinco** caminhos nossos,
incluindo o anexo que o paciente envia no nosso próprio formulário. Ou seja, o reenvio de vocês
revelou um defeito que também atingia pacientes que nunca passaram pela Greens.

— BeHemp, 13/09/2026
