# ADR-0023 — O fluxo da receita reusa o trilho da ANVISA, e não encosta nele

> **Status:** 📋 **proposta** — 14/09/2026. **ADR compartilhada:** o §1 ao §8 são a parte da
> **BeHemp**; o §9 é da **Greens**, e está vazio de propósito para eles preencherem. A revisão
> é a três, antes de qualquer implementação.
>
> **Decisão do dono, 14/09/2026:** _"nós literalmente imitaremos 99% do que já funciona no
> fluxo 1 sem ANVISA, só que para receita. A única diferença é que quando é marcado que não
> tem a receita ele é redirecionado para teleconsulta, não para ANVISA. E quando o paciente
> não possuir os 2, ele vai ser encaminhado primeiro pra teleconsulta, depois para ANVISA."_

---

## §1 — O que motivou, e o que foi medido

O Fluxo 2 (paciente **com** ANVISA e **sem** receita) nunca completou. A causa foi isolada em
14/09/2026, e **não está no código de nenhuma das duas empresas**: o bloco `[F2-01]` do tipo
_Requisição externa_, no painel do ChatPro da Greens, **não emite a requisição**.

**As medições que fecham isso**, todas de 14/09/2026:

| #   | medição                                                                                                          | resultado                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | a Greens apontou o bloco que falha para o **servidor deles**, que registra todo acesso                           | nenhuma chamada do ChatPro apareceu — `curl` e navegador sim |
| 2   | a Greens chamou `https://be4hope.org/api/chatpro/bot-link?sessionId&name&email` de fora, com o segredo do painel | **200 em 0,99s**, link real, `SOL-000066`                    |
| 3   | banco de produção, depois do teste de 16:16 UTC                                                                  | nada criado **nem tocado** desde 15:50:57                    |
| 4   | log do PM2, depois do mesmo teste                                                                                | nenhuma linha `[chatpro]` atribuível às 16:16                |

Um 401 escreve no log. Um 422 escreve no log. Um 200 escreve no banco. **Nenhum dos três
aconteceu** — e as duas saídas sem rastro foram descartadas: o `429` do limite (são 60/min, e o
dia inteiro não passou de dez chamadas) e um 404 por caminho errado (o preview do bloco está
correto). A requisição não sai.

⚠️ **Isto não é hipótese.** Está registrado assim porque hoje **duas** conclusões apressadas
foram retratadas — uma nossa e uma da Greens —, as duas por datar incidente pela "última linha
do arquivo" num log que **não tem timestamp**.

**A consequência de desenho:** enquanto o Fluxo 2 depender daquele bloco, ele depende de uma
resposta do suporte do ChatPro, que não tem prazo. **Esta ADR remove essa dependência.**

---

## §2 — O trilho que já funciona, medido de ponta a ponta

O Fluxo 1 (paciente **com** receita e **sem** ANVISA) atravessa um caminho diferente, que
**não usa bloco de requisição do painel**:

```
paciente no formulário/bot da Greens
   → backend da Greens
   → POST /api/parceiros/greens/cadastro     (E1 da ADR-0021 §2)
   → devolve urlDeContinuacao
   → paciente abre, cria conta, preenche a ficha
   → destinoDepoisDoCadastro decide para onde ele vai
```

**Prova em produção, 14/09/2026 01:02 UTC:** `SOL-000065` — paciente novo, `com_arquivo: 3`,
`na_ficha: 3`, e a tela da ANVISA reconhecendo os três documentos que a Greens mandou.
Registrado em `docs/11-OS-OITO-FLUXOS.md:41`.

**O que sustenta esse trilho, com `caminho:linha`:**

| peça                       | onde                                             | garantia                                                             |
| -------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| entrada assinada           | `app/api/parceiros/greens/cadastro/route.ts:93`  | HMAC, janela de 300 s, idempotente por `eventoId`                    |
| limite antes da assinatura | mesmo arquivo, `:75` — `LIMITE_DO_HANDOFF = 120` | OWASP API4:2023; limite **antes** de conferir o segredo              |
| manifesto do parceiro      | `lib/parceiros/documentos.ts:10-16`              | os cinco documentos do fluxo; o que não vier é pendência             |
| pendências                 | `lib/parceiros/documentos.ts:91-101`             | derivadas do manifesto, nunca de flag                                |
| destino                    | `lib/parceiros/destino-do-paciente.ts:64-75`     | sai do que **falta**, nunca do fluxo declarado (ADR-0021 D-01)       |
| resposta ao parceiro       | `app/api/parceiros/greens/cadastro/route.ts:174` | `referralId`, `protocolo`, `urlDeContinuacao`, `expiraEm`, `reenvio` |

**Guardas que protegem esse trilho hoje**, todos verdes na medição de 14/09 (1351 casos em 58):

- `handoff-do-parceiro-e-assinado-e-idempotente` — **48 casos**
- `o-destino-do-paciente-segue-o-que-falta` — **61 casos**
- `todo-destino-e-uma-rota-que-existe` — **8 casos**
- `a-anvisa-aproveita-o-que-ja-chegou` — **8 casos**
- `o-painel-diz-o-que-falta` — **10 casos**
- `o-consentimento-e-colhido-antes-de-sair` — **45 casos**

---

## §3 — 🔴 A "única diferença" já está no código

O dono descreveu a regra como se fosse trabalho a fazer. **Ela já existe, e está guardada.**

`lib/parceiros/destino-do-paciente.ts:64-75`:

```ts
export function destinoDepoisDoCadastro(pendentes: readonly string[]): Destino {
  const falta = new Set(pendentes);

  // 1º — sem receita não há o que autorizar. A consulta vem antes da procuração.
  if (falta.has('receita_medica')) return DESTINOS.agendamento;

  // 2º — tem receita e falta a autorização: é exatamente o caso do fluxo 1.
  if (falta.has('autorizacao_anvisa')) return DESTINOS.anvisa;

  return DESTINOS.teleconsulta;
}
```

Lado a lado com o que o dono pediu:

| o que ele disse                                                 | o que o código faz                             | precisa mudar? |
| --------------------------------------------------------------- | ---------------------------------------------- | -------------- |
| "quando é marcado que não tem receita, vai para teleconsulta"   | `falta receita_medica → /paciente/agendamento` | **não**        |
| "quando não tem ANVISA, vai para ANVISA"                        | `falta autorizacao_anvisa → /paciente/anvisa`  | **não**        |
| "quando não possuir os 2, primeiro teleconsulta, depois ANVISA" | a ordem dos dois `if` — receita primeiro       | **não**        |

⚠️ **E a ordem não é detalhe de implementação: é regra clínica.** O comentário do arquivo
(`:14-16`) diz por quê — _"a procuração da ANVISA instrui um pedido de importação de um
medicamento que ainda não foi prescrito. Sem receita, não há o que autorizar."_

**Por que isso já estava pronto:** o ADR-0021 D-01 decidiu que o destino sai do que **falta**,
não do fluxo declarado. Um trilho que deriva do estado não precisa de um ramo por fluxo — ele
já responde a fluxos que ninguém escreveu ainda.

---

## §4 — O que a BeHemp faz: **nenhuma linha de código**

Esta é a conclusão central, e ela é o oposto de "imitar":

> **Não construímos um caminho para a receita. O caminho existente já decide isso sozinho, e a
> única coisa que muda é o conteúdo do `documentos` que a Greens manda.**

**O que foi verificado, campo a campo** (`app/api/parceiros/greens/cadastro/route.ts:36-60`):

| campo          | obrigatório? | observação                                                       |
| -------------- | ------------ | ---------------------------------------------------------------- |
| `nomeCompleto` | não          | `optional().nullable()`                                          |
| `email`        | não          | idem — o bot pode não ter colhido                                |
| `telefone`     | não          | idem                                                             |
| `cpf`          | não          | idem — **o bot do Fluxo 2 não precisa pedir CPF**                |
| `eventoId`     | não          | quando vem, garante idempotência                                 |
| `documentos`   | não          | **é o campo que decide tudo** — ver §5                           |
| `urlDeRetorno` | não          | passa por `urlDeRetornoPermitida`, lista de origens, nunca livre |

**Capacidade, já que o chamador passa a ser o servidor da Greens e não o painel:** o limite é
por IP (`lib/seguranca/limite-de-requisicao.ts:105-109`, primeiro salto do `x-forwarded-for`),
então servidor-a-servidor vira **um** chamador. `LIMITE_DO_HANDOFF = 120/min`. É uma chamada
por paciente que chega nesse passo — 120 pacientes no mesmo minuto está muito acima do volume
real, e o número é uma constante se um dia apertar.

---

## §5 — O contrato: o que a BeHemp precisa receber

Só o campo `documentos` muda entre os dois casos. Ele é o **manifesto**: a lista do que o
parceiro **já tem**. O que não vier na lista é pendência, e pendência **não bloqueia nada**
(ADR-0016 D-06).

As cinco chaves (`lib/parceiros/documentos.ts:10-16`):

```
receita_medica · laudo_medico · comprovante_residencia · autorizacao_anvisa · documento_identidade
```

E os três casos, com o destino que cada um produz:

| caso                        | `documentos` inclui                       | pendência        | destino resultante      |
| --------------------------- | ----------------------------------------- | ---------------- | ----------------------- |
| **Fluxo 1** — tem receita   | `receita_medica` (+ RG, comprovante…)     | ANVISA           | `/paciente/anvisa`      |
| **Fluxo 2** — tem ANVISA    | `autorizacao_anvisa` (+ RG, comprovante…) | receita          | `/paciente/agendamento` |
| **não tem nenhum dos dois** | só RG, comprovante…                       | receita + ANVISA | `/paciente/agendamento` |

⚠️ **ACRESCENTADO em 14/09/2026, e põe a linha do meio em revisão.** O chefe do dono fixou
`DO-57`: _"se o paciente não tem receita, logo ele não tem ANVISA, já que a ANVISA é solicitada
baseada na receita"_. Se isso valer sem exceção, o caso "tem ANVISA e não tem receita" **não
existe**, e a linha do meio da tabela acima sai.

Mas `VAL-02` (**RDC 660/2022, Arts. 7º e 8º**) registra que a autorização vale **2 anos** e a
norma **não** declara prazo para a receita — logo a autorização sobrevive à prescrição, e o
paciente de recompra é exatamente esse caso. A tabela fica como está **até a revisão a três**,
porque apagar uma linha por causa de uma leitura ainda não confirmada é como se perde regra.

🔴 **O erro que derruba o Fluxo 2 é omitir `autorizacao_anvisa` do manifesto.** Se ele não
vier, `pendenciasDe` devolve ANVISA como pendente, e o paciente é levado a tirar uma procuração
que ele **já tem**. É o mesmo buraco que o manifesto veio fechar, por um caminho novo.

**Cada item pode ser só o nome, ou o nome com o arquivo.** `manifestoComArquivos`
(`lib/parceiros/handoff.ts:71`) baixa o que vier com `urlBlob`, e a busca é protegida contra
SSRF — allowlist de host, sem seguir redirect, faixa privada e link-local bloqueadas
(`documento-do-parceiro-nao-vira-ssrf`, 32 casos, OWASP A10:2021).

---

## §6 — Os modos de erro, e como o sistema reage a cada um

A pergunta 6 das seis é a que mais falha e a mais cara, então ela fica escrita:

| o que dá errado                               | o que acontece hoje                                            | é aceitável?                                    |
| --------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| Greens manda sem `documentos`                 | os cinco viram pendência; destino = agendamento                | ⚠️ degrada — o paciente é cobrado do que já tem |
| Greens manda `autorizacao_anvisa` sem arquivo | conta como "tem", sem arquivo na ficha                         | ✅ é o contrato: manifesto é declaração         |
| assinatura fora da janela de 300 s            | 401, sem dizer se foi o segredo ou o relógio                   | ✅ de propósito                                 |
| reentrega do mesmo `eventoId`                 | mesma solicitação, mesmo protocolo, `reenvio: true`            | ✅ idempotente                                  |
| URL de retorno fora da lista de origens       | recusada — redirecionamento aberto é OWASP A01                 | ✅                                              |
| paciente abre o link já logado noutra conta   | a ficha vai para a conta certa, não para a de quem está logado | ✅ `a-sessao-precisa-ser-do-dono-do-link`       |
| paciente abandona no meio                     | retoma de onde parou, sem recomeçar                            | ✅ `o-cadastro-retoma-de-onde-parou`            |
| link expirado (7 dias)                        | tela de link inválido, e a Greens pode reemitir                | ✅                                              |
| a Greens está fora do ar ao devolver          | o paciente já tem a URL; não depende de nova chamada           | ✅                                              |
| o bloco `[N02-A]` parar de emitir também      | 🔴 **o fluxo inteiro para** — é o mesmo ponto único            | ⚠️ ver §8                                       |

---

## §7 — O que fica decidido, e o que fica rejeitado

### D-01 — O Fluxo 2 entra pelo handoff assinado (E1), não pelo `bot-link`

O `bot-link` continua existindo e funcionando — foi medido em 200 com link real. O que muda é
**quem o chama**: o trilho crítico passa a ser servidor-a-servidor, e não painel → BeHemp.

**Rejeitado: esperar o suporte do ChatPro.** Sem prazo, e o fluxo é requisito de apresentação.

**Rejeitado: recriar o bloco no painel.** Já foi feito — a Greens criou um do zero e ele
apresenta o mesmo comportamento. Repetir uma tentativa que já falhou não é plano.

### D-02 — 🔴 NÃO se duplica o trilho para a receita

A tentação é escrever um caminho "do Fluxo 2" espelhando o do Fluxo 1. **Rejeitado.**

**O motivo tem prova desta mesma semana:** em 14/09 descobrimos que `triagem` e `intake`
recusavam a conta Greens **por construção, sempre**, enquanto o `bot-link` funcionava. Eram
três caminhos que deveriam fazer a mesma coisa, e dois derivaram. O guarda que deveria pegar
**listava uma rota numa constante** em vez de derivar do disco — e por isso ficou verde
enquanto dois terços do sistema estavam quebrados.

Caminho duplicado diverge. Caminho que **deriva do estado** não tem como divergir: é o mesmo
código respondendo a um manifesto diferente. Princípio **A** (DRY, YAGNI).

### D-03 — A ordem "receita antes de ANVISA" é regra, não preferência

Fica onde está (`destino-do-paciente.ts:67-71`), com o motivo escrito no arquivo, e coberta
pelos 61 casos de `o-destino-do-paciente-segue-o-que-falta`. **Quem mudar a ordem quebra o
build**, e é isso que se quer: a procuração instrui importação de medicamento não prescrito.

### D-04 — O destino continua saindo do que FALTA, nunca do fluxo declarado

Reafirma o ADR-0021 D-01. **Rejeitado: a Greens mandar um campo `fluxo: 2`.** Um fluxo
declarado é uma segunda fonte de verdade sobre o mesmo fato, e quando as duas divergirem — e
divergem — o paciente cai na tela errada sem ninguém saber por quê.

### D-05 — Pendência informa, não impede

Reafirma o ADR-0016 D-06. O paciente sem receita **não** fica bloqueado fora da ANVISA; o
agendamento é só a primeira tela que abre. Ele navega para onde quiser.

---

## §8 — O que fica de fora, e o que continua em aberto

- **O defeito do painel não é resolvido por esta ADR** — é contornado. O chamado ao suporte do
  ChatPro segue aberto, e a hipótese mais forte está registrada: a **única** diferença de
  configuração entre o bloco que emite e os dois que não emitem é um segundo parâmetro
  (`email`) com validação do tipo "Email".
- **O `[N02-A]` vira ponto único de falha.** Se ele parar, param os dois fluxos. Isso precisa
  de um plano de detecção — hoje só se descobre pelo paciente.
- **Os códigos `[E-*]` não valem neste trilho.** O handoff responde JSON com `codigo`, não
  texto de WhatsApp. O diagnóstico existe, em outro formato.
- **Timestamp no log** continua pendente, na branch `fix/o-log-carimba-a-hora`. Foi a ausência
  dele que produziu as duas retratações de hoje.
- 🔴 **`DO-57` × `VAL-02` está em aberto** — ver a nota no §5. Enquanto não se resolve, o
  código aplica `DO-57` **só na tela do fluxo da teleconsulta**, por condição
  (`fluxoDaTeleconsulta`), e o caminho da ANVISA fica intocado. A pergunta a levar ao chefe do
  dono é uma: _o paciente que já tem autorização da ANVISA e precisa de receita nova existe?_
- **Rotação do `CHATPRO_INTAKE_SECRET_GREENS`** — pedida pela Greens para 14/09, ainda não
  feita. Não bloqueia este desenho, porque o handoff usa outro segredo
  (`PARCEIRO_GREENS_SEGREDO_ENTRADA`), **e isso é de propósito**: poderes diferentes não
  dividem chave (ADR-0021, `o-s2-tem-destino-proprio-e-gatilho`).
- **O `.env` do servidor diverge do ambiente do processo PM2** nos dois segredos do ChatPro —
  catalogado em `docs/03-CHECKLIST-MESTRE.md`. Interage com a rotação.

---

## §9 — A parte da Greens

> **Esta seção é da Greens.** Escrevam aqui o que muda do lado de vocês: o ramo do menu no
> `[N02-A]`, como o backend decide, o que entra no `documentos` em cada caso, e os modos de
> erro do lado de vocês. Depois revisamos os três juntos, antes de implementar.

_(a preencher)_

---

## §10 — Princípios e fase

| eixo                                                          | por quê                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Princípio **A** — Clean Code (DRY, YAGNI), Clean Architecture | reusar o trilho em vez de duplicar; o D-02 é inteiro sobre isso          |
| Princípio **D** — erros, resiliência e HTTP                   | o §6 lista os modos de erro antes de a implementação existir             |
| Princípio **H** — OWASP e LGPD                                | HMAC + janela, limite antes da assinatura, SSRF, redirecionamento aberto |
| **Fase 7** — erros e resiliência                              | trata erro de algo que já tem regra, API, banco e auth                   |

---

## §11 — Fontes

- `docs/adr/ADR-0016` — o cadastro da Greens chega por back-channel; D-06, pendência não bloqueia
- `docs/adr/ADR-0021` — os oito fluxos; **§2 (E1)** e **D-01** (o destino sai do que falta)
- `docs/adr/ADR-0018` — o bot da Greens usa o link da BeHemp e devolve o paciente
- `docs/11-OS-OITO-FLUXOS.md:41,65` — `SOL-000065` medido
- OWASP API Security Top 10 — **API4:2023** (limite antes da assinatura), **API1** (BOLA)
- OWASP Top 10 — **A01** (redirecionamento aberto), **A10:2021** (SSRF)
