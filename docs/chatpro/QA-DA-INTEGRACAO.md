# QA da integração — a ordem, e como saber que passou

> Escrito em 10/09/2026, para o **QA único** depois que tudo subir. Feito para ser seguido
> com o terminal aberto: cada passo diz o que rodar, o que esperar, e **como saber que
> falhou**.
>
> 🔴 **A ordem importa.** Cada passo depende do anterior, e o passo 0 existe para não se
> testar contra um ambiente que não está pronto — que é o jeito mais fácil de passar duas
> horas depurando um 404 que era só deploy faltando.

---

## Passo 0 · Antes de qualquer coisa: os dois lados estão no ar?

```bash
# a rota de retorno da Greens — HOJE dá 404 de propósito, porque a branch não subiu
curl -s -o /dev/null -w "%{http_code}\n" https://api.greens-corp.com/api/v1/parceiros/behemp/atualizacao
```

| resposta | o que significa                                                                            |
| -------- | ------------------------------------------------------------------------------------------ |
| `404`    | 🔴 **pare aqui.** A branch da Greens não foi publicada. Nada do passo 4 em diante funciona |
| `401`    | ✅ a rota existe e está exigindo assinatura — é o esperado sem cabeçalhos                  |

⚠️ **`401` é o resultado BOM.** Uma rota de webhook que responde `200` a uma chamada sem
assinatura está aberta, e aí o problema é maior que o QA.

---

## Passo 1 · As variáveis, conferidas por impressão

Nunca compare segredos colando valores. Compare a **impressão**:

```bash
# na BeHemp
printf '%s' "$PARCEIRO_GREENS_SEGREDO_ENTRADA" | sha256sum | cut -c1-12   # esperado: 1aa38adfab7e
printf '%s' "$PARCEIRO_GREENS_SEGREDO_SAIDA"   | sha256sum | cut -c1-12   # esperado: 1e0db43efb2d
```

Se uma impressão não bater, **pare**: o sintoma de segredo trocado é `401` em tudo, e ele é
indistinguível de "configurei errado o cabeçalho".

| variável                            | onde   | sem ela                                         |
| ----------------------------------- | ------ | ----------------------------------------------- |
| `PARCEIRO_GREENS_SEGREDO_ENTRADA`   | BeHemp | o handoff responde **503**                      |
| `PARCEIRO_GREENS_SEGREDO_SAIDA`     | BeHemp | o enviador **não reivindica** da fila           |
| `PARCEIRO_GREENS_API_URL`           | BeHemp | idem — **é o interruptor**                      |
| `PARCEIRO_ORIGENS_DE_RETORNO`       | BeHemp | o botão de volta some (silencioso, por desenho) |
| `CHATPRO_INTAKE_SECRET` / `_GREENS` | BeHemp | a conta correspondente responde 401             |
| `CRON_SECRET`                       | BeHemp | os dois crons respondem **503**                 |

---

## Passo 2 · As migrations chegaram ao Neon?

```sql
select count(*) from solicitacoes_cadastro;   -- a tabela existe?
select unnest(enum_range(null::parceiro_evento_tipo));
-- esperado: receita_emitida, anvisa_aprovada    (e NÃO anvisa_concluida)
```

🔴 Se aparecer `anvisa_concluida`, a migration `0033` não rodou — e o payload que
enviarmos será recusado do outro lado.

---

## Passo 3 · A ida (Greens → BeHemp), sem paciente real

Peça ao lado da Greens para disparar um handoff de teste. **Conferir aqui:**

```sql
select protocolo, parceiro, evento_do_parceiro, url_de_retorno, documentos_do_parceiro
  from solicitacoes_cadastro order by created_at desc limit 1;
```

| coluna                   | esperado                  | se vier errado                                             |
| ------------------------ | ------------------------- | ---------------------------------------------------------- |
| `parceiro`               | `greens`                  | a conta não foi identificada — confira o segredo           |
| `evento_do_parceiro`     | o id que eles enviaram    | a idempotência não vai funcionar                           |
| `url_de_retorno`         | o endereço deles          | **`NULL` = a origem não está na allowlist** — inclua `www` |
| `documentos_do_parceiro` | a lista que eles mandaram | manifesto vazio: pendências aparecerão todas               |

**Depois, o teste que mais importa:** peça o **mesmo** handoff de novo, com o mesmo id de
evento.

```sql
select count(*) from solicitacoes_cadastro where evento_do_parceiro = '<id>';
-- esperado: 1
```

🔴 **Se vier 2, pare tudo.** A idempotência decide gateway e desconto do lado deles — um
handoff duplicado erra o preço de uma compra, não só um cadastro.

---

## Passo 4 · A volta, começando pelo que NÃO machuca

**Comece por `anvisa_aprovada`.** Do lado da Greens ela cai em `ANVISA_NA_BEHEMP`,
gravidade _atenção_: não trava nada. `receita_emitida` bloqueia despacho e merece ser o
segundo.

```bash
# dispara o cron manualmente, sem esperar o agendamento
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<behemp>/api/parceiros/enviar
```

```jsonc
// esperado
{
  "sucesso": true,
  "dados": {
    "reivindicados": 1,
    "entregues": 1,
    "reagendados": 0,
    "falharam": 0,
    "configurado": true,
  },
}
```

| campo                | se vier assim | significa                                                                         |
| -------------------- | ------------- | --------------------------------------------------------------------------------- |
| `configurado: false` | 🔴            | falta `PARCEIRO_GREENS_API_URL` ou o segredo de saída — **a fila não foi tocada** |
| `reivindicados: 0`   | ⚠️            | não há evento pendente, ou o backoff ainda não venceu                             |
| `reagendados: 1`     | ⚠️            | a Greens respondeu erro recuperável. Confira `ultimo_erro`                        |
| `falharam: 1`        | 🔴            | 4xx que não é 429 — corpo ou assinatura errados                                   |

```sql
select tipo, status, tentativas, ultimo_erro from parceiro_eventos_saida order by created_at desc limit 5;
```

**Do lado deles**, a conferência é uma linha em `parceiro_eventos` com `resultado: aplicado`
e a pendência virando `ANVISA_NA_BEHEMP`.

---

## Passo 5 · O caminho do paciente, inteiro

O único que precisa de gente. **Use um número de WhatsApp que nunca falou com a empresa** —
o menu do bot só aparece no primeiro contato, e com sessão aberta o fluxo não recomeça
(foi o que custou 72 horas de diagnóstico no greens-corp).

1. mandar mensagem no WhatsApp → o bot pergunta nome e e-mail
2. o link chega **na conversa** ← se não chegar, veja abaixo
3. abrir o link → os dados aparecem preenchidos
4. criar senha → código de 6 dígitos no e-mail
5. cair na procuração da ANVISA
6. no fim, o botão **"voltar para continuar minha compra"**

### Se o link não chegar

| sintoma                                  | causa provável                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| o bot transferiu para atendimento humano | o endpoint respondeu erro — **é o desenho**; veja o log                    |
| **nada aconteceu, e o log está vazio**   | 🔴 o bloco nunca foi alcançado: sessão já aberta, ou fluxo não configurado |
| o link chegou e não abre                 | `NEXT_PUBLIC_APP_URL` errada ou sem esquema                                |

🔴 **Log vazio é o sintoma mais enganoso da integração inteira.** Ele é idêntico a "não
configurado" e significa que a requisição nunca chegou. Antes de procurar defeito no
código, confirme que o menu foi alcançado.

---

## Passo 6 · O que precisa continuar funcionando (regressão)

O QA não é só do novo:

- [ ] um paciente que **não** veio de parceiro se cadastra normalmente (`parceiro` = `NULL`)
- [ ] o `/registrar-se` antigo continua criando conta
- [ ] uma prescrição para paciente **sem** parceiro **não** cria linha em `parceiro_eventos_saida`
- [ ] a tela de ANVISA existente não mudou

---

## O que NÃO se testa neste QA, e por quê

|                                     |                                                    |
| ----------------------------------- | -------------------------------------------------- |
| cópia dos arquivos                  | fase 2, declarada — só o manifesto trafega         |
| conferência automática de receita   | é humana por decisão (ADR-0017 D-02)               |
| a régua de 30 dias aplicada sozinha | não guardamos a data de emissão da receita de fora |

---

## Como saber que o QA passou

**Passou** quando: um handoff repetido produz **uma** linha, um `anvisa_aprovada` chega
como `aplicado` do outro lado, um paciente novo percorre do WhatsApp até a procuração, e um
paciente **sem** parceiro se cadastra sem gerar evento nenhum.

**Não passou** se qualquer coisa acima precisou de "roda de novo que funciona". Intermitente
não é aprovado — é defeito ainda não localizado.
