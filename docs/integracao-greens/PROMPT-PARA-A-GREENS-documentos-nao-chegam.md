# Para a equipe da Greens — os documentos do handoff não chegam à BeHemp

> **Escrito em 13/09/2026, com dados medidos no banco de produção da BeHemp.**
> Não é suspeita: são contagens. Cada número abaixo veio de um `SELECT`, e o comando está no fim
> para vocês reproduzirem do lado de vocês.

## O problema em uma frase

**O paciente preenche o formulário de vocês, anexa os documentos, e eles nunca chegam aqui.**
Ele então cai na tela da BeHemp que pede os mesmos documentos de novo.

⚠️ **Isso torna um dos dois formulários inútil e o outro mentiroso** — a nossa tela chega a
dizer _"o que já recebemos: receita médica"_, quando o que recebemos foi a palavra
`"receita_medica"`, não o arquivo.

## O que foi medido aqui

```sql
select count(*) filter (where jsonb_typeof(e) = 'object') as objetos,
       count(*) filter (where jsonb_typeof(e) = 'string') as strings
from solicitacoes_cadastro s, jsonb_array_elements(s.documentos_do_parceiro) e
where s.parceiro = 'greens';
```

```
objetos: 0        ← itens COM url de arquivo
strings: 67       ← itens que são só o nome do tipo
```

**Sessenta e sete itens de documento recebidos de vocês. Nenhum com URL.**

E o contexto: **35 handoffs** da Greens chegaram aqui (`origem = greens_handoff`), e a entrada
funciona — nosso log registra `[parceiros] handoff recebido` 52 vezes. **A assinatura HMAC, o
corpo e o `eventoId` estão corretos.** O problema é só o conteúdo de `documentos`.

## O contrato, e o que o código de vocês faz

`HandoffService.ts`, por volta da linha 185:

```ts
plano.map(async (e) => {
  if (<sem chave>) {
    semUrl.push(`${e.tipo}:${e.motivoSemUrl}`);
    return e.tipo as string;              // ← vira STRING
  }
  try {
    const url = await this.s3Service.getSignedDownloadUrl(e.chave, 3600);
    return { tipo: e.tipo, url };          // ← vira OBJETO
  } catch {
    semUrl.push(`${e.tipo}:falha_ao_assinar`);
    return e.tipo as string;               // ← vira STRING
  }
});

logger.info("Handoff Be4Hope: documentos sem arquivo", { medicationRequestId, semUrl });
```

**Está correto como desenho.** O que precisamos saber é por que o caminho da string é o único
que acontece.

## 🔴 O pedido, e é só um

**Rodem este `grep` no log de vocês** e nos mandem o resultado — ele tem exatamente a resposta:

```bash
grep "Handoff Be4Hope: documentos sem arquivo" <log> | tail -30
```

O campo `semUrl` traz `tipo:motivo` para cada documento. As três causas possíveis, e cada uma
tem dono diferente:

| o que `semUrl` mostrar            | o que significa                                                             | quem corrige                    |
| --------------------------------- | --------------------------------------------------------------------------- | ------------------------------- |
| `receita_medica:falha_ao_assinar` | o S3 recusou assinar — credencial, permissão de bucket ou chave inexistente | **Greens**                      |
| `receita_medica:<motivoSemUrl>`   | o pedido não tinha arquivo anexado                                          | **ninguém** — é o caso legítimo |
| **nenhuma linha**                 | o `plano` chega vazio: os arquivos do pedido não estão sendo lidos          | **Greens**                      |

## Duas perguntas de negócio, para não corrigirmos o que não está quebrado

1. **No fluxo do admin** (gerar link pela solicitação de medicamentos), o pedido chega a ter
   arquivo anexado? Se o fluxo do admin não anexa nada, o comportamento atual está certo e o
   erro é da nossa tela, que promete o que não tem.
2. `e.chave` vem de onde? Se for a chave S3 do upload do paciente, o arquivo existe no bucket de
   vocês **no momento do handoff**?

## O que já corrigimos do nosso lado

⚠️ **Nós também tínhamos um defeito, e ele atrapalhou este diagnóstico por dois dias.** Quando um
download falha, gravávamos no log:

```
[parceiros] documentos recusados: receita_medica:Error,comprovante_residencia:Error
```

`Error` era `erro.name`, que em JavaScript é **sempre** essa palavra. Nosso código sabe
distinguir nove motivos (allowlist, 403, MIME, tamanho, DNS…) e jogava todos fora. **Já
corrigido** — o próximo handoff dirá o motivo real.

E confirmamos que **a nossa allowlist está certa**:

```
PARCEIRO_ORIGENS_DE_DOCUMENTO = https://greens-site-bucket.s3.us-east-1.amazonaws.com
```

Então, se vocês mandarem a URL assinada desse bucket, ela passa.

## O contrato que nos serve, sem mudança nenhuma no que já existe

Continuem mandando o que já mandam. **Só precisamos que o objeto venha quando houver arquivo:**

```jsonc
"documentos": [
  { "tipo": "receita_medica", "url": "https://greens-site-bucket.s3.us-east-1.amazonaws.com/..." },
  "documento_identidade"   // sem arquivo — continua string, e está certo
]
```

⚠️ **A URL de 1 hora não é problema para nós:** baixamos e re-hospedamos **na entrada do
handoff**, dentro da janela. O paciente tem 7 dias para abrir o link, e a essa altura o arquivo
já é nosso.

## Por que isto é prioridade

O paciente que preenche o formulário de vocês e depois recebe, na nossa tela, um pedido para
enviar os mesmos documentos, conclui uma de duas coisas: que perdemos os arquivos dele, ou que
um dos dois sistemas não funciona. **As duas são ruins, e uma delas é verdade.**

Medido aqui: dos 35 handoffs recebidos, **zero** viraram cadastro concluído.
