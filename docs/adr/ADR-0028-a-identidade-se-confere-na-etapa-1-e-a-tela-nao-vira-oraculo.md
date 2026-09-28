# ADR-0028 — A identidade se confere na etapa 1 do cadastro, e a tela não vira oráculo

> **Status:** ✅ **aceita e implementada** — 28/09/2026, branch `docs/adr-0028-identidade-na-etapa-1`
> (local, **não commitada, não em produção**). Aprovada por quem pediu (_"Pode seguir para as
> implementações, eu aprovo"_), com as respostas A, B, C e E da §7. O que a implementação mudou
> está na §9; **as decisões da §2 ficam como foram escritas**, e a §9 diz onde cada uma foi
> retificada.
>
> **Status ao ser escrita:** 📋 proposta — 28/09/2026. Escrita antes do código.
>
> **Contexto:** hoje o formulário do cadastro por link só descobre que a pessoa já tem conta
> **no fim**, quando o Clerk recusa o `signUp.create` com `form_identifier_exists`
> (`app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx:858`). Por CPF e telefone,
> **nada** descobre. Pedido de 28/09/2026: conferir **logo na etapa 1**, antes de a pessoa
> preencher o resto.
>
> **Decisão:** a conferência mora **dentro** do `/cadastro/[token]` (nunca no handoff nem no
> `/bot-link`). Roda no servidor com os dados do link **e** com os digitados na etapa 1. Devolve
> à tela só um **veredito**, nunca o dado da outra conta. Tem limite por link e por IP, e fica
> auditada. A action final confere de novo.
>
> **Plano de implementação em PDF:**
> [`docs/planos/PLANO-IDENTIDADE-NA-ETAPA-1.pdf`](../planos/PLANO-IDENTIDADE-NA-ETAPA-1.pdf)
> (fonte: `PLANO-IDENTIDADE-NA-ETAPA-1.html`, ao lado). Diagnóstico com `caminho:linha` em
> [04 — Item 50](../04-LISTA-DE-AFAZERES.md).

## §0 — O que foi alinhado, nas palavras de quem pediu (28/09/2026)

⚠️ A pessoa que pediu **não se identificou** no chat. Pela regra de `quem fala neste chat`, a
autoria fica como _"quem pediu"_, e não se atribui a Davi nem a Gabriel. Os IDs estão no `02`,
de `DO-59` a `DO-63`.

| #   | o que foi dito, literal                                                                                                                                                                                                                                                                                                                                                                                                                  | o que isso fixa                                                                                                        | ID           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | _"caso paciente ja tenha algum dado parecido no sistema, ou ele ja esteja no sistema, ou ja esteja logado em alguma conta da behemp e veio fazer o formulário, vamos logo antes dele preecnher ter uma confirmação de dados estão, certos, perguntas se a pessoa ja possui conta com numero/email/cpf ou qualquer outro dado que seja identificado no sistema, mas isso é logo na etapa 1 do formúlario, não dps que ele preenche tudo"_ | a conferência é na **etapa 1**, antes do resto                                                                         | `DO-59`      |
| 2   | _"na situação 1 deveria aparecer o botão de sair so que o botão de sair não sai da página do formúlario ele continua na página"_                                                                                                                                                                                                                                                                                                         | logado: **"é você?"** + **Sair** que **mantém** a pessoa no formulário                                                 | `DO-60`      |
| 3   | _"1 - cpf, telefone, e-mail"_ · _"5 nome parecido não, dado parecido s]ao os que eu te falei, cpf, telefone, e-mail"_                                                                                                                                                                                                                                                                                                                    | identificadores: **CPF, telefone e e-mail**. **Nome não entra**                                                        | `DO-61`      |
| 4   | _"3 - se for cpf a gente encaminha para o suporte da behemp"_                                                                                                                                                                                                                                                                                                                                                                            | CPF que bate: **suporte da BeHemp**                                                                                    | `DO-62`      |
| 5   | _"4 - vale para tudo"_                                                                                                                                                                                                                                                                                                                                                                                                                   | vale para **todas** as portas de entrada                                                                               | `DO-63`      |
| 6   | _"2 - isso entra para uma pesquisa direcionada a jsutamente vendas"_                                                                                                                                                                                                                                                                                                                                                                     | a pessoa que diz "sim, sou eu" entra numa **pesquisa voltada a vendas**. ⚠️ **Forma não definida**: ver §7, pergunta A | — (pendente) |

**A pergunta 2, a que o item 6 responde,** foi: _"se a pessoa diz 'sim, sou eu, já tenho conta',
a solicitação nova se liga à ficha existente (recompra/atualização) ou vira ficha nova?"_. A
resposta não escolhe uma das duas. Ela diz para onde vai a **informação** (vendas), não o que
acontece com a **ficha**. Por isso a §7 reabre esta parte.

## §1 — O que a medição provou

Tudo aqui foi **lido** no código em 28/09/2026 (branch `docs/adr-0028-identidade-na-etapa-1`,
a partir da `main` `ab6d8ef`). As linhas marcadas com ✔ foram **reconferidas** uma a uma antes de
entrar neste texto. **Nada foi executado.**

### 1.1 — No formulário (`app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx`)

| fato                                                                                                                                     | onde                                     | ✔  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | --- |
| "Continuar" da etapa 1 só avança o passo, **sem ir ao servidor**                                                                         | `:1313` `onClick={() => setSubEtapa(1)}` | ✔  |
| a etapa 1 é `subEtapa === 0`                                                                                                             | `:1151`                                  | ✔  |
| quem veio do parceiro **confirma** os dados, em vez de digitá-los ("Confirme seus dados")                                                | `:1165`                                  | ✔  |
| com sessão válida, a etapa 1 já diz "Você já está logado como X" e esconde a senha                                                       | `:1255`                                  | ✔  |
| o aviso de **sessão de outra pessoa** só aparece na **etapa 3** (`subEtapa === 3`)                                                       | `:1807`, `:1850`                         | ✔  |
| o botão "Sair" desse aviso chama `signOut()` **sem destino**                                                                             | `:1876`                                  | ✔  |
| `criarConta` chama `await signOut()` automático quando a sessão não serve                                                                | `:814`                                   | ✔  |
| `confirmarCodigo` também chama `await signOut()`                                                                                         | `:905`                                   | ✔  |
| `form_identifier_exists` liga `jaTemConta`, que mostra "Entrar na minha conta"                                                           | `:858`, `:182`                           | ✔  |
| o "Entrar" leva a `/entrar?redirect_url=/cadastro/{token}`                                                                               | `:1940`, `:1958`                         | ✔  |
| `sessaoEDeOutraPessoa` = há sessão **e** o e-mail dela difere do e-mail do link **e** do digitado **e** a pessoa não clicou em continuar | `:382-389`                               | ✔  |

**Para onde o `signOut()` sem destino leva:** o `ClerkProvider` (`app/layout.tsx:102`) não
define `afterSignOutUrl`, e o padrão do Clerk é `/`. A pessoa **sai do formulário**. Isto é
**inferência**: não foi executado. É o comportamento que o `DO-60` pede para mudar.

### 1.2 — Na action (`app/_actions/cadastro-por-link.ts`)

| fato                                                                                                                         | onde             | ✔  |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------- | --- |
| recusa a sessão de outro e-mail: _"Este link foi enviado para outro e-mail. Saia da conta atual…"_                           | `:280-287`       | ✔  |
| aceita a sessão quando o e-mail dela é o da solicitação **ou** o digitado no fluxo (`sessaoEDoCadastroEmCurso`)              | `:276`           | ✔  |
| resolve `users` por `clerkId` e, se não achar, por `email`. Quando acha pelo e-mail, liga o `clerkId` à linha que já existia | `:~349-362`      | —   |
| **não consulta CPF** antes de inserir em `pacientes`                                                                         | `:~403`, `:~433` | —   |

### 1.3 — No schema

| fato                                                                           | onde                                                           | ✔  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------- | --- |
| `pacientes.cpf` é `text`, **sem unique e sem índice**                          | `db/schema/pacientes.ts:30`                                    | ✔  |
| `users.email` tem `uniqueIndex`, **sensível a maiúsculas** (sem `lower()`)     | `db/schema/users.ts:21`                                        | ✔  |
| `users.telefone` é texto livre, sem índice                                     | `db/schema/users.ts:16`                                        | ✔  |
| `solicitacoes_cadastro.cpf/email/telefone` são texto; só o telefone tem índice | `db/schema/solicitacoes-cadastro.ts:96-105`, `:274`            | ✔  |
| `pacientes` e `users` têm soft delete (`deleted_at`)                           | `pacientes.ts:119`, `users.ts:19`                              | ✔  |
| **CPF não é cifrado nem hasheado** em lugar nenhum                             | `rg` — `lib/seguranca/cifra.ts` só cifra token do Mercado Pago | —   |

**A normalização é inconsistente**, e isso decide como se compara:

- **CPF:** o handoff e o cadastro por link gravam só os dígitos (`lib/parceiros/handoff.ts:307`,
  `app/_actions/cadastro-por-link.ts:181`). O perfil (`app/_actions/perfil-paciente.ts:200`) e o
  `criarPaciente` do admin gravam o CPF **como foi digitado**. Linhas antigas podem estar com
  pontos e traço.
- **Telefone:** `users.telefone` tem **quatro formatos** ([Item 26](../04-LISTA-DE-AFAZERES.md)).
  A triagem já compara no SQL com `regexp_replace`, pelos **últimos 8 dígitos**
  (`lib/chatpro/triagem.ts:123`) ✔.

### 1.4 — As portas de entrada

Só **dois** lugares criam `solicitacoes_cadastro`: `lib/chatpro/solicitacao.ts:280` (ChatPro) e
`lib/parceiros/handoff.ts:301` (Greens). **Todas** as portas levam o paciente ao mesmo
`/cadastro/[token]`:

| porta                                                          | origem gravada                                   | dados que chegam                                        |
| -------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------- |
| bot da BeHemp e bot da Greens (`/api/chatpro/bot-link`)        | `chatpro_bot` (`parceiro` distingue a conta)     | nome, e-mail, telefone. **Sem CPF**                     |
| `/api/chatpro/intake`                                          | `chatpro_bot`                                    | idem                                                    |
| `/api/chatpro/start`                                           | `chatpro_start` / `chatpro_start_nao_verificado` | telefone e lead                                         |
| link do admin (`app/(admin)/_actions/link-teleconsulta.ts:71`) | `painel_admin`                                   | nome, e-mail, telefone                                  |
| handoff da Greens (`POST /api/parceiros/greens/cadastro`)      | `greens_handoff`                                 | nome, e-mail, telefone, **CPF**, RG, nascimento, gênero |

**Fora do link, e portanto fora desta ADR (ver §7, pergunta C):** `/registrar-se`, o webhook do
Clerk (`app/api/webhooks/clerk/route.ts:191`, `:250`, que cria ficha **vazia**, sem CPF), o
`/redirect` e as criações pelo admin e pelo médico
(`app/_actions/pacientes.ts:108`, `:897`; `app/(medico)/_actions/pacientes.ts:83`). Estas
conferem **só o e-mail**.

### 1.5 — O que já existe de detecção de duplicidade

| por                      | onde                                                  | o que faz                                                                                                                                     |
| ------------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **CPF**                  | —                                                     | **nada**. `rg` não acha `eq(pacientes.cpf, …)` em lugar nenhum                                                                                |
| **e-mail**               | action, webhook do Clerk, `/redirect`                 | liga a conta à linha de `users` com o mesmo e-mail                                                                                            |
| **telefone**, no ChatPro | `lib/chatpro/solicitacao.ts:159` (`buscarAtiva`)      | reaproveita a solicitação ativa do mesmo telefone, e **não confere se o e-mail diverge** (`:243` `email: params.email ?? existente.email`) ✔ |
| **telefone**, no handoff | `lib/parceiros/handoff.ts:422-434` (`reaproveitavel`) | reaproveita, mas **recusa quando o e-mail diverge**. Comentário: _"FALHA FECHADA … telefone não identifica pessoa"_ ✔                        |
| **telefone**, na triagem | `lib/chatpro/triagem.ts:123`                          | só **informa** um candidato (ADR-0017 D-06)                                                                                                   |

🔴 **A diferença entre as duas linhas do telefone é um defeito**, catalogado como
[Item 51](../04-LISTA-DE-AFAZERES.md) e **não corrigido aqui**. O ChatPro pode entregar a uma
pessoa a solicitação de outra que usa o mesmo aparelho.

### 1.6 — O lado da Greens (`/home/DK/Developer/Projects/greens-corp`, lido em 28/09/2026)

O código está em `greens-corp-backend` (main `0e7b8a4`) e `greens-corp-frontend` (main `21d72dd`).

| fato                                                                                                                                                     | onde                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| o handoff manda o e-mail **sem minúsculas** e o telefone **só com dígitos, sem E.164**                                                                   | `greens-corp-backend/src/modules/parceiros/behemp/HandoffService.ts:385-406` |
| o relay do ChatPro manda só `sessionId`, `name` e `number` (E.164 com "+"). **Sem CPF e sem e-mail**                                                     | `src/modules/chatpro/service/ChatproIntakeService.ts:504-507`                |
| **a Greens não espera nenhum sinal de "paciente já existe"**. Da resposta do handoff ela lê só `referralId`, `urlDeContinuacao`, `protocolo` e `reenvio` | `HandoffService.ts:486-496`                                                  |
| resposta não-2xx, ou 2xx sem `referralId`/`urlDeContinuacao`, vira **503** e mostra "Tentar de novo". Não há retry                                       | `HandoffService.ts:436-463`, `:498-510`                                      |
| a jornada `SENT_TO_BEHEMP`, que manda a cobrança ao Mercado Pago **com desconto**, só é gravada depois de um 2xx válido                                  | `HandoffService.ts:520-528`                                                  |
| no relay, **qualquer não-2xx** faz o bot transferir para um atendente **da Greens**                                                                      | `ChatproIntakeService.ts:522-535`                                            |
| a Greens também casa paciente por CPF e depois por e-mail, e **reaproveita a conta**, sem bloquear                                                       | `MedicationRequestService.ts:532-549`                                        |
| regra da Greens: nada muda entre as empresas sem consenso dos três participantes                                                                         | `greens-corp/CLAUDE.md`, seção "A PONTE"                                     |

**A consequência mede a D-01:** conferir dentro do nosso formulário **não muda o contrato**. O
handoff já recebeu 2xx quando o paciente abre o link.

### 1.7 — As fontes externas

Legenda: **[LIDO]** = a página foi aberta · **[LOCALIZADO]** = só snippet de busca.

| fonte                                                                                                                          | o que diz, e onde pesa                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OWASP **Authentication Cheat Sheet**, "Authentication and Error Messages" [LIDO]                                               | trata o **registro** de forma explícita. Resposta incorreta: _"This user ID is already in use."_; correta: _"A link to activate your account has been emailed to the address provided."_ O motivo: não criar um _"discrepancy factor, allowing an attacker to mount a user enumeration action"_ |
| OWASP **WSTG-IDNT-04** [LOCALIZADO]                                                                                            | _"answer in the same manner for every failed attempt… consistent generic error messages"_                                                                                                                                                                                                       |
| OWASP **API2:2023** Broken Authentication [LIDO]                                                                               | pede _"anti-brute force mechanisms"_. Enumeração alimenta credential stuffing                                                                                                                                                                                                                   |
| OWASP **API4:2023** Unrestricted Resource Consumption [LIDO]                                                                   | _"Limit/throttle how many times or how often a single API client/user can execute a single operation"_ · _"Some API Endpoints might require stricter policies."_                                                                                                                                |
| NIST SP 800-63B-4 §3.2.2 [LIDO]                                                                                                | limita tentativas falhas. **Não** trata enumeração: não serve de fundamento para essa parte                                                                                                                                                                                                     |
| LGPD art. 5º II · 5º X · 6º III, VII, VIII · 11 · 46 [LIDO em lgpd-brasil.info; o planalto.gov.br deu `ECONNRESET` duas vezes] | revelar a um terceiro que alguém tem conta **nesta** plataforma é revelar dado de saúde por inferência. "Comunicação" é tratamento (art. 5º X), e a base do art. 11, II, "f" cobre o **cuidado**, não isso                                                                                      |
| Clerk `signOut` [LIDO: doc + tipo local `@clerk/shared` 4.9.0 `SignOutOptions = { sessionId?, redirectUrl? }`]                 | `signOut({ sessionId, redirectUrl })` sai de **uma** sessão e navega para onde se pede. **Sem `sessionId`, derruba todas** as sessões do navegador                                                                                                                                              |
| Clerk **User Enumeration Protection** [LIDO]                                                                                   | modo **Strict**: no sign-up com identificador existente, não manda código e avisa o dono da conta. Exige _"Password can't be the starting strategy"_. Muda a instância inteira                                                                                                                  |
| Clerk `users.getUserList({ emailAddress, phoneNumber })` [LIDO]                                                                | busca **exata**. `query` é parcial e **não** serve para existência. Limite: 1000 req/10 s (produção)                                                                                                                                                                                            |
| MPI (patient matching) [LIDO: health-samurai.io; PMC4832129]                                                                   | três faixas: match, _possible match_ e não-match. O caso incerto vai para **revisão humana**. No estudo, até o identificador forte divergia em 53,4 % dos pares duplicados                                                                                                                      |
| telefone compartilhado em família                                                                                              | **nenhuma fonte lida afirma isso diretamente**. Pew [LOCALIZADO] recomenda verificar telefone. Fica como **inferência**, reforçada pelo WhatsApp: o link chega a um número que pode ser de familiar ou cuidador                                                                                 |

## §2 — As decisões

### D-01 — A conferência mora no `/cadastro/[token]`, não no handoff nem no `/bot-link`

Todas as portas chegam ao mesmo formulário (§1.4), então **um** ponto cobre todas (`DO-63`).
Nenhum contrato com a Greens muda.

**Rejeitado: conferir no `POST /api/parceiros/greens/cadastro`.** Recusar ali faz a Greens mostrar
503, **não gravar a jornada** e mandar a cobrança ao gateway **sem desconto**
(`HandoffService.ts:520-528`). O "Tentar de novo" repete a recusa para sempre. E mudar a resposta
do handoff exige o consenso da "Ponte".

**Rejeitado: conferir no `/bot-link`.** Um não-2xx transfere o paciente para um atendente **da
Greens**, e não para o suporte **da BeHemp**. E o bot não traz CPF.

### D-02 — Duas conferências: ao abrir o link e no "Continuar" da etapa 1

1. **Ao abrir** (Server Component `app/(auth)/cadastro/[token]/page.tsx`), com os dados **que a
   solicitação já tem**. Isso cobre quem vem da Greens com tudo preenchido.
2. **No "Continuar" da etapa 1** (`:1313`), por Server Action, com o que a pessoa **digitou ou
   corrigiu**. Isso cobre o ChatPro, que não manda CPF, e quem clicou em "Corrigir".

**Rejeitado: conferir só no fim, como hoje.** É o que o `DO-59` pede para mudar.

**Rejeitado: conferir só ao abrir.** O ChatPro não traz CPF, e o identificador mais forte
chegaria depois da checagem.

### D-03 — Identificadores: CPF, telefone e e-mail, com comparação exata sobre o dado normalizado

`DO-61`. A comparação é **no SQL**, porque o dado gravado não é uniforme (§1.3):

| dado     | normalização                                     | comparação                                                            |
| -------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| CPF      | `somenteDigitosDoCpf`                            | `regexp_replace(cpf, '[^0-9]', '', 'g') = $1`                         |
| e-mail   | `trim` + minúsculas                              | `lower(email) = $1`                                                   |
| telefone | `normalizarTelefoneWhatsapp` e depois só dígitos | pelos **últimos 11 dígitos** (DDD + 9 + número), com `regexp_replace` |

Filtra `deleted_at IS NULL` em `users` e `pacientes`.

⚠️ **Por que 11 e não 8 como a triagem:** 8 dígitos casam números de DDDs diferentes. A triagem
só **informa** um candidato (ADR-0017 D-06); aqui o veredito muda o que a pessoa vê. Um número
fixo de 10 dígitos não casa pelos 11. Esse é um falso negativo aceito, porque errar para o lado
de "não achou" deixa a pessoa seguir como hoje.

**Rejeitado: nome parecido, e casamento probabilístico.** `DO-61`: _"nome parecido não"_.

**Rejeitado: normalizar agora os dados já gravados.** A ADR-0017 (`:160-163`) e o Item 26 já
rejeitaram fazer isso de passagem. A comparação normaliza **dos dois lados**, sem migrar nada.

**Rejeitado, por enquanto: índice de expressão sobre o CPF.** Exigiria migration. O tamanho da
tabela se mede antes (§5, passo 0). Só se o custo aparecer, o índice entra como item próprio.

### D-04 — A tela recebe um veredito, nunca o dado da outra conta

A conferência devolve só um destes valores, e nenhum campo da conta encontrada:

| veredito             | quando                                                            |
| -------------------- | ----------------------------------------------------------------- |
| `livre`              | nada bateu                                                        |
| `sessao_propria`     | há sessão, e ela é da pessoa do link                              |
| `sessao_alheia`      | há sessão de **outra** conta                                      |
| `conta_pelo_email`   | o e-mail já tem conta                                             |
| `cpf_em_outra_conta` | o CPF está em ficha de **outra** conta que não a do e-mail/sessão |
| `telefone_conhecido` | só o telefone bateu                                               |
| `limite`             | estourou o limite da D-08                                         |
| `indisponivel`       | a conferência falhou (§5)                                         |

**Rejeitado: dizer QUAL dado bateu** ("este CPF já está cadastrado"). É a resposta que o OWASP
Authentication Cheat Sheet dá como **incorreta**. Aqui ela conta a quem tem o link que aquela
pessoa é paciente de cannabis medicinal: dado de saúde (LGPD art. 5º II, art. 46).

**Rejeitado: mostrar o e-mail da conta existente, mesmo mascarado.** Um `fu***@gmail.com` já
confirma que a conta existe, e ajuda a adivinhar qual é.

### D-05 — Logado: "é você?" no topo da etapa 1, e Sair continua no formulário

`DO-60`. O aviso de `sessao_alheia` sobe da etapa 3 (`:1850`) para a etapa 1:

- **"Sou eu, continuar"** mantém o comportamento atual de `setContinuarComASessao(true)`.
- **"Não sou eu, sair"** chama `signOut({ sessionId: <a sessão ativa>, redirectUrl: <a URL atual do formulário> })`.

O mesmo destino vale para os `signOut()` automáticos de `:814` e `:905`.

Com `sessao_propria`, a etapa 1 já tem o "Você já está logado como X" (`:1255`). Continua igual.

⚠️ **O token do cadastro vive no hash da URL** (guarda `o-cadastro-pendente-chega-ao-painel`).
**Não está provado** que o Clerk preserva o `#` no `redirectUrl`. A prova é local, no Chromium,
e depende de uma `CLERK_SECRET_KEY` de desenvolvimento (§4, e o achado de 13/09 do `03`). Se o
hash se perder, o plano B é `signOut({ sessionId })` sem destino, seguido de `router.refresh()`.
A página é pública no middleware (`middleware.ts:57`), então não cai no login.

**Rejeitado: `signOut()` sem opções, como hoje.** Leva a pessoa para `/`, fora do formulário.

**Rejeitado: sair de todas as sessões.** Em multi-session, sem `sessionId`, o Clerk derruba as
outras contas do navegador, que a pessoa não pediu para fechar.

### D-06 — CPF em outra conta: o cadastro para, e a pessoa vai ao suporte da BeHemp

`DO-62`. Com `cpf_em_outra_conta`, a tela mostra, sem dizer que o CPF existe, _"Precisamos
confirmar alguns dados com a nossa equipe antes de continuar"_. Abaixo vem um botão para o
WhatsApp da BeHemp (`NEXT_PUBLIC_WHATSAPP_BEHEMP`, `lib/env.ts:247` ✔), com o **protocolo**
já na mensagem. O protocolo não é dado pessoal, e o suporte acha a solicitação por ele.

- **O link continua válido.** O suporte resolve e a pessoa volta pelo mesmo link.
- **A action final confere o CPF de novo**, e recusa com o mesmo texto. Sem isso, basta chamar
  a action direto para pular a tela. É defesa no servidor: _"nunca confie no client"_ (`AGENTS.md`).
- **Auditoria:** `registrarAuditoria({ userId: null, acao: 'visualizar', entidade: 'solicitacoes_cadastro', entidadeId, dadosDepois: { veredito } })`,
  **sem** o CPF (`lib/utils/audit.ts:44`).

⚠️ **Recomendação que precisa de confirmação (§7, pergunta E).** CPF igual **com o mesmo
e-mail** (ou com a sessão da mesma conta) é a **mesma pessoa** voltando, e não um conflito. A
recomendação é tratar esse caso como `conta_pelo_email` (login), e mandar ao suporte só o CPF
que está em **outra** conta. Mandar ao suporte todo CPF que bate levaria toda recompra para um
atendente.

🔴 **Isto retifica a ADR-0017 D-04**, que **rejeitou** _"bloquear o link para quem já tem conta"_.
A retificação é parcial: quem tem conta **pelo e-mail** continua indo ao login, como a D-04 quer.
O que passa a parar é o **CPF em outra conta**, que a D-04 não conhecia, porque ninguém conferia
CPF. Ao aprovar esta ADR, a ADR-0017 ganha uma nota apontando para cá, e **o texto dela fica**.

**Rejeitado: fundir as contas automaticamente.** Fundir duas pessoas custa a ficha clínica de
alguém. É a mesma regra do `handoff.ts:414` e o que a literatura de MPI manda para revisão humana.

**Rejeitado: deixar seguir e criar a segunda ficha, como hoje.** O CPF não tem unique, e hoje
nasceria uma ficha duplicada **sem erro e sem log**.

### D-07 — E-mail com conta: o login, como a ADR-0016 D-07 já decidiu

Com `conta_pelo_email`, a etapa 1 diz _"Você já tem conta? Entre para continuar"_ e mostra o
"Entrar" que já existe (`:1940`, com o `redirect_url` protegido pelo guarda
`o-login-nao-leva-para-fora`). A pessoa **não preenche nada antes**. A única mudança é o momento:
isso aparecia no fim.

⚠️ **Risco residual, aceito e declarado.** Se a pessoa **digita** um e-mail diferente do link, o
veredito diz a ela que aquele e-mail tem conta. A D-08 limita quantas vezes, e a pessoa precisa
de um link válido. O Clerk já revela isso hoje, no fim do formulário, pelo
`form_identifier_exists`. O que fecha de vez é o modo Strict (D-10).

### D-08 — A conferência tem limite por link e por IP, e fica auditada

- Até **5 conferências por link** e um teto por IP, com `consumir` + `identificarChamador`
  (`lib/seguranca/limite-de-requisicao.ts:67`, `:105` ✔). Estourar devolve `limite`, e a tela
  mostra o mesmo WhatsApp da D-06.
- Todo veredito diferente de `livre` é auditado (D-06).
- ⚠️ **O limite é em memória, por processo** ([Item 31](../04-LISTA-DE-AFAZERES.md)). Com um
  processo `behemp-site` no PM2 isso basta. Não é compartilhado, e fica declarado.
- ⚠️ **O guarda `as-rotas-sensiveis-tem-limite` lista rotas, e esta é uma Server Action.** Hoje
  **nenhuma** action usa `consumir`. O guarda novo (§4) cobre esta, e a extensão do guarda antigo
  a actions fica como item próprio ([Item 53](../04-LISTA-DE-AFAZERES.md)).

**Rejeitado: conferência sem limite.** Com o link em mãos, testar CPFs um a um vira o oráculo
que a D-04 fecha.

### D-09 — Só o telefone bateu: a tela pergunta, e a resposta não trava

Com `telefone_conhecido`, a tela pergunta _"Você já tem cadastro conosco?"_:

- **Sim** → login, como na D-07.
- **Não** → segue o cadastro normalmente.

A pergunta **não revela** nada: é a pessoa quem declara.

A resposta "sim, sou eu" entra na **pesquisa voltada a vendas** (§0, item 6). **A forma dessa
pesquisa está pendente** (§7, pergunta A), e nenhuma coluna ou tabela nasce antes da resposta.

**Rejeitado: tratar o telefone sozinho como identidade.** O próprio código já registra que
_"telefone não identifica pessoa"_ (`handoff.ts:414`).

### D-10 — O modo Strict do Clerk fica fora, catalogado

**Rejeitado agora: ligar a User Enumeration Protection em Strict.** É o que fecharia a enumeração
pelo sign-up. Mas o Strict exige que a senha **não** seja a estratégia inicial, e isso muda o
login da **plataforma inteira**. O modo não foi provado contra o fluxo atual, que depende de
`form_identifier_exists` (`:858`). A instância de produção ainda é a de desenvolvimento (achado de
13/09 no `03`). Fica catalogado para decisão própria ([Item 53](../04-LISTA-DE-AFAZERES.md)).

### D-11 — O `/registrar-se` fica fora da primeira versão

Sem link, não há solicitação para limitar a conferência. Ela viraria um oráculo **aberto a
qualquer um**. `DO-63` diz _"vale para tudo"_, e por isso a exclusão **pede confirmação** (§7,
pergunta C) e não é presumida.

## §3 — O que fica rejeitado

| rejeitado                                  | por quê                                                          | onde |
| ------------------------------------------ | ---------------------------------------------------------------- | ---- |
| conferir no handoff da Greens              | 503, jornada não gravada, cobrança sem desconto; muda o contrato | D-01 |
| conferir no `/bot-link`                    | transfere para atendente da Greens; o bot não traz CPF           | D-01 |
| conferir só no fim (hoje)                  | é o que se pediu para mudar                                      | D-02 |
| conferir só ao abrir                       | o ChatPro não traz CPF                                           | D-02 |
| nome parecido e casamento probabilístico   | decisão de quem pediu                                            | D-03 |
| normalizar os dados gravados agora         | já rejeitado (ADR-0017, Item 26)                                 | D-03 |
| índice de expressão no CPF agora           | exige migration; medir antes                                     | D-03 |
| dizer qual dado bateu                      | enumeração (OWASP) e dado de saúde (LGPD)                        | D-04 |
| mostrar o e-mail da conta, mesmo mascarado | confirma e ajuda a adivinhar                                     | D-04 |
| `signOut()` sem destino                    | tira a pessoa do formulário                                      | D-05 |
| sair de todas as sessões                   | fecha contas que a pessoa não pediu                              | D-05 |
| fundir contas sozinho                      | custa a ficha clínica de alguém                                  | D-06 |
| deixar nascer a segunda ficha              | é o defeito de hoje, em silêncio                                 | D-06 |
| conferência sem limite                     | vira oráculo                                                     | D-08 |
| telefone sozinho como identidade           | o código já diz que não identifica                               | D-09 |
| Strict do Clerk agora                      | muda o login inteiro; não provado                                | D-10 |
| `/registrar-se` na primeira versão         | oráculo aberto; pede confirmação                                 | D-11 |

## §4 — Como se prova

**Guarda novo:** `__tests__/guardas/a-identidade-e-conferida-na-etapa-1.test.ts`. Nasce
**vermelho** e se prova por sabotagem (`docs/TECNICA-DOS-GUARDAS.md`). Fica vermelho se:

1. o "Continuar" da etapa 1 voltar a só avançar o passo, sem chamar a conferência;
2. a conferência receber ou devolver campo da **outra** conta (derivado do tipo do veredito);
3. a conferência perder o limite, ou o limite deixar de ser **alcançável**;
4. algum `signOut(` do formulário voltar a ser chamado **sem** `redirectUrl` e `sessionId`;
5. a action final deixar de conferir o CPF antes do `insert` em `pacientes`;
6. o texto da tela passar a dizer qual dado bateu (a busca ignora comentário: menção não é uso);
7. a comparação deixar de normalizar (CPF cru ou e-mail sem `lower`);
8. o aviso de sessão alheia sair da etapa 1.

**Integração** (`vitest.integracao.mts`, Postgres real): **executa** a conferência (a regra
`guarda mede efeito, não forma`) contra um seed com um cenário por classe:

- CPF formatado × cru;
- mesmo CPF com mesmo e-mail (a mesma pessoa);
- mesmo CPF com e-mail diferente (o conflito);
- telefone em quatro formatos;
- e-mail com maiúsculas;
- ficha com soft delete, que **não** conta;
- um **controle limpo**.

**Local, com o mesmo artefato** (regra _"Deploy custa"_):

- `pnpm build` + `node .next/standalone/server.js`, com Postgres em Docker;
- Chromium headless para a etapa 1 sem sessão;
- 🔴 **a tela logada, o "Sair" e o `#` sobrevivendo não se provam sem `CLERK_SECRET_KEY` de
  desenvolvimento no `.env`**. Sem ela, a prova cobre a conferência e a action, **não** o clique.
  É decisão do dono.

**Guardas existentes que casam literais e vão ficar vermelhos com o comportamento certo:**

- `a-sessao-precisa-ser-do-dono-do-link` (exige o bloco `{sessaoEDeOutraPessoa && (` com
  `signOut()` literal);
- `o-cadastro-retoma-de-onde-parou` (exige `await signOut()` em posições fixas).

Retifica-se **o que eles medem**, nunca o que eles protegem, caso a caso e com a justificativa
escrita. Nenhum é apagado. Também podem ser tocados: `cadastro-por-link-abre-sem-conta`,
`o-login-nao-leva-para-fora`, `a-confirmacao-do-email-nao-e-beco` e
`a-conta-nasce-na-confirmacao-do-email`.

## §5 — Os modos de erro, e como o sistema reage a cada um

| estado sujo                                      | reação                                                                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| a conferência falha (banco fora, timeout)        | `indisponivel`: a tela **segue como hoje**. Falha nossa não trava o paciente. A action final confere de novo e, se o banco está fora, falha como já falharia |
| o limite estoura                                 | `limite`: texto genérico + WhatsApp. **Não** diz que achou algo                                                                                              |
| a mesma pessoa, com o mesmo CPF e o mesmo e-mail | login (D-06, pergunta E)                                                                                                                                     |
| já existem duas fichas com o mesmo CPF           | `cpf_em_outra_conta` → suporte. **Quantas existem, se mede antes** (passo 0)                                                                                 |
| CPF gravado formatado em linha antiga            | `regexp_replace` casa                                                                                                                                        |
| ficha com `deleted_at`                           | não conta                                                                                                                                                    |
| telefone fixo com 10 dígitos                     | não casa pelos 11 → segue. Falso negativo aceito (D-03)                                                                                                      |
| a sessão expira entre a etapa 1 e o envio        | a action já trata. Não muda                                                                                                                                  |
| o `signOut` falha, ou o `#` se perde no redirect | plano B da D-05. A prova local decide                                                                                                                        |
| o webhook do Clerk cria a ficha vazia primeiro   | ficha **sem CPF**, que não casa. O guarda `a-corrida-com-o-webhook-nao-derruba-o-cadastro` continua valendo                                                  |
| a pessoa corrige o CPF depois do veredito        | a conferência roda de novo no "Continuar" **e** na action                                                                                                    |
| a pessoa chama a action direto, pulando a tela   | a action confere o CPF (D-06)                                                                                                                                |
| dois processos, dois limites (Item 31)           | aceito com um processo. Declarado                                                                                                                            |

**Passo 0: perguntar ao banco antes do código.** ⚠️ Retificado em 28/09/2026: o telefone passou a ser comparado pelo **número nacional** (sem DDI, 11 dígitos), a mesma regra de `telefoneParaConferir`, e a contagem abaixo usa essa regra. O PDF do plano mostra a versão anterior, com os "últimos 11". O dono roda na VPS, dentro de
`/home/ubuntu/behemp-site-main`, o bloco abaixo, que é só leitura e não mostra PII (regra
_"Temos acesso à VPS"_):

```sql
select
  (select count(*) from pacientes where deleted_at is null and cpf is not null and cpf <> '') as fichas_com_cpf,
  (select count(*) from (select regexp_replace(cpf,'[^0-9]','','g') from pacientes
     where deleted_at is null and cpf is not null and cpf <> '' group by 1 having count(*) > 1) x) as cpfs_repetidos,
  (select count(*) from pacientes where deleted_at is null and cpf ~ '[^0-9]') as cpfs_formatados,
  (select count(*) from (select lower(email) from users where deleted_at is null group by 1 having count(*) > 1) x) as emails_repetidos_ignorando_caixa,
  (select count(*) from (select t from (select regexp_replace(regexp_replace(coalesce(telefone,''),'[^0-9]','','g'),'^55([0-9]{10,11})$','\1') t
     from users where deleted_at is null) y where length(t) = 11 group by t having count(*) > 1) x) as celulares_repetidos
```

## §6 — As seis perguntas do `CLAUDE.md`

| #   | pergunta                      | resposta                                                                                                                                                                                                                                              |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | todo o escopo?                | as duas criadoras de solicitação, as cinco portas, os oito criadores de `users`/`pacientes`, o formulário, a action, o schema, a reconciliação, o middleware, o limite e a auditoria (§1)                                                             |
| 2   | o outro lado?                 | a Greens, **lida** no código dela (§1.6). O ChatPro foi lido pelo relay da Greens e pelo nosso `bot-link`. O Clerk foi lido pela doc e pelo tipo local                                                                                                |
| 3   | do começo ao fim?             | handoff/bot → solicitação → link → etapa 1 → etapa 3 → `criarConta` → código → action → ficha (§1.1, §1.2)                                                                                                                                            |
| 4   | pesquisei para correlacionar? | OWASP, NIST, LGPD, Clerk e MPI, com lido e localizado separados (§1.7). O Strict do Clerk e o `#` no redirect ficaram **sem prova**                                                                                                                   |
| 5   | mais gaps?                    | Item 51 (reaproveitamento do ChatPro sem conferir e-mail) · Item 52 (CPF sem unique e gravado em dois formatos) · Item 53 (o guarda de limite não cobre actions, e o Strict do Clerk fica para decisão) · o índice de ADRs contava 26 com 27 arquivos |
| 6   | modos de erro?                | §5                                                                                                                                                                                                                                                    |

**O que vale só até aqui:** nada foi executado. O número de CPFs repetidos em produção é
desconhecido até o passo 0. O comportamento do `redirectUrl` com `#` é desconhecido até a prova
local.

## §7 — O que falta decidir

| #     | pergunta                                                                                                                                                                     | por que importa                                                                                                          | recomendação                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| **A** | "Pesquisa direcionada a vendas": **onde** vendas vê quem disse "sim, sou eu"? Uma lista no admin, um e-mail ou a planilha Google? E a pessoa **continua** o cadastro depois? | decide se há migration (lista no admin) ou só integração (Sheets e Brevo já existem). Sem isso, a D-09 não se implementa | lista no admin, quando houver migration autorizada; até lá, o registro de auditoria |
| **B** | No caso do CPF, **basta** o WhatsApp com o protocolo, ou o admin precisa ver uma **pendência no painel**?                                                                    | pendência no painel = migration = autorização                                                                            | começar só com o WhatsApp + auditoria                                               |
| **C** | O `/registrar-se` entra agora?                                                                                                                                               | sem link, a conferência é oráculo aberto (D-11)                                                                          | fica para depois, com captcha e o Strict decididos antes                            |
| **D** | As fichas que **já** têm CPF repetido (passo 0) vão ao suporte como as outras?                                                                                               | se forem muitas, pacientes reais passam a parar no suporte                                                               | sim, e o número medido decide se precisa de mutirão antes                           |
| **E** | CPF igual **com o mesmo e-mail** vai ao login (a mesma pessoa) ou também ao suporte?                                                                                         | ao suporte, toda recompra vira atendimento                                                                               | login. Suporte só para CPF em **outra** conta (D-06)                                |

### 7.1 — As respostas, 28/09/2026 (`DO-64` a `DO-67`)

Respondidas por quem pediu, escolhendo entre as opções apresentadas. Em todas, a escolha foi a
recomendação:

| #     | resposta                                                                                                        | o que ficou implementado                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A** | _"Só auditoria por ora"_                                                                                        | "sim, já tenho conta" e "não" viram registro em `logs_auditoria` (`evento: 'declaracao_de_conta_existente'`, com o protocolo). A tela para vendas vem depois, como item próprio. **Nenhuma migration** |
| **B** | _"WhatsApp + auditoria"_                                                                                        | botão do WhatsApp da BeHemp com o protocolo na mensagem, e auditoria. Sem pendência no painel                                                                                                          |
| **C** | _"Fica para depois"_                                                                                            | o `/registrar-se` não foi tocado                                                                                                                                                                       |
| **D** | não perguntada: os CPFs que já estão repetidos vão ao suporte como os outros, até o passo 0 mostrar quantos são | nenhum tratamento especial. ⚠️ **O `SELECT` do passo 0 ainda não rodou**                                                                                                                               |
| **E** | _"Login"_                                                                                                       | CPF igual na conta do mesmo e-mail (ou da sessão) é a mesma pessoa: vai ao login ou segue. Só o CPF em **outra** conta vai ao suporte                                                                  |

⚠️ **A frase que ficou pela metade.** A mensagem de aprovação terminava em _"o que eu quero que
você tome cuidado"_, sem dizer com o quê. Foi perguntado. Enquanto não houver resposta, a
implementação seguiu o plano aprovado, e **isso fica registrado aqui** para que nada pareça
combinado sem ter sido.

## §8 — A entrega, na ordem

| fase | o quê                                                                                            | depende de  |
| ---- | ------------------------------------------------------------------------------------------------ | ----------- |
| 0    | o `SELECT` do §5 na VPS                                                                          | o dono      |
| 1    | aprovar esta ADR e responder A–E; ADR-0017 ganha a nota de retificação                           | o dono      |
| 2    | guarda novo **vermelho** + seed de integração com os cenários do §4                              | fase 1      |
| 3    | `lib/cadastro/conferir-identidade.ts` (domínio: consulta + veredito, sem `next/*`)               | fase 2      |
| 4    | a action da etapa 1 (`app/_actions/`) com Zod, limite e auditoria; a conferência na `page.tsx`   | fase 3      |
| 5    | a tela: veredito na etapa 1, aviso de sessão alheia movido, `signOut` com destino                | fase 4      |
| 6    | a action final confere o CPF antes do `insert`                                                   | fase 3      |
| 7    | retificação dos guardas que casam literais, caso a caso                                          | fases 5 e 6 |
| 8    | prova local: `standalone` + Docker + Chromium (a tela logada, só com a chave do Clerk)           | fase 7      |
| 9    | `03`, `04`, ADR §N (_o que a implementação ensinou_) e contagem dos guardas pela saída do runner | fase 8      |
| —    | PR para `feat/*`. **O merge é do dono**                                                          | —           |

**Princípios e fase** (`docs/PRINCIPIOS.md`):

- D-01, D-04, D-06, D-08 e D-10: **H** (segurança: OWASP e LGPD), fase 6.
- D-03: **F** (banco), fase 5.
- D-05 e D-09: **L** (front-end), fase 2.
- §5: **D** (erros e resiliência), fase 7.
- §4: **I** (testes), fase 8.

## §9 — O que a implementação ensinou (28/09/2026)

Escrita depois do código. As decisões da §2 **não foram apagadas**: cada linha abaixo diz o que
mudou e por quê.

| decisão                            | como foi escrita                                                                                                                 | como ficou, e por quê                                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-05** (sair sem sair da página) | `signOut({ sessionId, redirectUrl: <URL atual> })`, com a dúvida de o `#` do token sobreviver, e `router.refresh()` como plano B | **`signOut(FICAR_NESTA_PAGINA, { sessionId })`**, em que `FICAR_NESTA_PAGINA = () => {}`. Lido no código do `clerk-js` (`packages/clerk-js/src/core/clerk.ts`): quando o primeiro argumento é uma FUNÇÃO, ela roda **no lugar** da navegação. Não há redirect, e o `#` nem entra em risco. Um `signOut(` só no arquivo, e todos saem por ele (`sairDaSessao`)                                      |
| **D-05**, o achado junto           | —                                                                                                                                | 🔴 **Os dois `signOut()` automáticos (`criarConta` e `confirmarCodigo`) navegavam para `/` no meio do envio.** Sem argumento, o Clerk vai ao `afterSignOutUrl`, que não está definido. A pessoa saía do formulário **antes** do `signUp.create`. Defeito latente, que nenhum guarda via; corrigido pelo mesmo caminho                                                                              |
| **D-05**, a posição                | aviso movido da etapa 3 para a 1                                                                                                 | virou o componente `AvisoDeSessaoAlheia`, que aparece **nas duas**: a sessão pode nascer entre as etapas, em outra aba. Um componente só, para as duas ocorrências não divergirem                                                                                                                                                                                                                  |
| **D-08** (limite)                  | estourar devolve `limite`, e a tela mostra o WhatsApp                                                                            | 🔴 **`limite` NÃO para a pessoa.** Parar trancaria por uma hora quem corrigiu os dados cinco vezes. A proteção contra o oráculo é **não responder**, e isso vale deixando seguir. A action final confere o CPF de qualquer jeito                                                                                                                                                                   |
| **D-03** (telefone)                | os últimos 11 dígitos, dos dois lados                                                                                            | 🔴 **O número nacional**: tira o DDI 55 e só confere com 11 dígitos. Achado pelo guarda ao nascer: o fixo `(11) 3333-4444` normalizava para `+551133334444`, e "os últimos 11" davam `51133334444`, com o "5" do DDI colado. No SQL, a mesma regra, com `regexp_replace(…, '^55([0-9]{10,11})$', '\\1')`. Sem isso, o fixo gravado com DDI colidia com o celular de outro DDD (caso na integração) |
| **D-07** (e-mail com conta)        | "o e-mail já tem conta" → login                                                                                                  | 🔴 **Só se a linha de `users` tem `clerkId`.** O admin cria `users` **sem** conta de acesso (`app/_actions/pacientes.ts`). Mandar essa pessoa "entrar" a levaria a uma conta que não existe. Sem `clerkId`, a linha é a mesma pessoa, e a action já liga a conta nova a ela pelo e-mail                                                                                                            |
| **§8, fase 3** (onde mora)         | `lib/cadastro/conferir-identidade.ts`                                                                                            | **dois arquivos**: `veredito-de-identidade.ts` (puro: tipos, decisão, normalização, textos, limites) e `conferir-identidade.ts` (a consulta). A tela é client e precisa dos tipos, e importar o módulo que importa `db` levaria o driver do banco ao navegador. O guarda proíbe                                                                                                                    |
| **D-08**, o build                  | constantes de limite na action                                                                                                   | 🔴 **O `pnpm build` recusou:** _"Only async functions are allowed to be exported in a 'use server' file"_. Type-check e os 1573 testes estavam verdes, e só o build acusava. As constantes foram para o módulo puro, e o guarda ganhou um caso para isto                                                                                                                                           |
| **D-06** (auditoria)               | sem o CPF                                                                                                                        | e **com o protocolo**. O guarda `cadastro-por-link-abre-sem-conta` exige protocolo na primeira auditoria da action, e acusou. O protocolo é também o que o suporte usa para achar o caso                                                                                                                                                                                                           |

### 9.1 — Segunda rodada, 28/09/2026: o telefone passa a travar (`DO-68`), e a senha some no caso do CPF

| decisão                        | como estava                                                          | como ficou, e por quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-09** (só o telefone bateu) | a tela perguntava "Você já tem cadastro?", e a resposta não travava  | 🔴 **O campo do telefone TRAVA**, com "Este número está em uso. Informe outro número de telefone para continuar." dentro da caixa (`aria-invalid` + `aria-describedby`). O "Continuar" fica desabilitado e o `continuarDaEtapa1` também recusa. A action final recusa o mesmo número **depois do CPF e antes de qualquer escrita**, sem consumir o link. Vindo da Greens, a confirmação dos dados abre os campos, porque o número tem de ser trocado. **O telefone da conta da própria pessoa não trava** |
| D-09, o que isto custa         | —                                                                    | ⚠️ **Revela de propósito que o número tem conta**, que é a exceção declarada ao D-04 e ao `OWASP-01`, restrita ao telefone. As travas que ficam: o limite de 5 conferências por link e a recusa no servidor. **Custo aceito na decisão:** o aparelho compartilhado (cuidador, familiar) passa a exigir outro número                                                                                                                                                                                       |
| **D-09**, a action             | `declararContaExistente` registrava o "sim" e o "não"                | **removida**, porque a pergunta saiu da tela. A pesquisa de vendas (resposta A) passa a ser a auditoria do veredito `telefone_conhecido`, que a conferência já grava                                                                                                                                                                                                                                                                                                                                      |
| **D-06** (CPF em outra conta)  | a etapa 1 mostrava o aviso do suporte **e** o bloco "Crie sua senha" | a senha **não aparece**. Achado na prévia de 28/09: pedir senha para um cadastro parado é pedir dado que não se usa. Corrigir o CPF muda a chave, e a senha volta                                                                                                                                                                                                                                                                                                                                         |
| o aviso                        | `conta_pelo_email` era o `return` final                              | ramo **exaustivo** (`never`): um veredito novo com aviso e sem tela não compila                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Provado nesta rodada:** 8 sabotagens novas, todas vermelhas (24 no total). O guarda passou a
43 casos e a integração a 23. Suíte **1581 casos em 69 arquivos**; integração **130 em 11
arquivos**, sem os de prévia. `pnpm build` com exit 0, baseline verde.

### 9.2 — A revisão pelos agentes do projeto, 28/09/2026

Quatro revisores rodaram em paralelo, só lendo, com as skills `agente-seguranca`,
`agente-qualidade`, `agente-backend` e `agente-frontend`. O que acharam, e o que foi feito com
cada achado:

| achado                                                                                                                                                                                                                                                                               | quem achou                          | o que foi feito                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴 **A action final era um oráculo SEM TETO.** "Suporte" ou "telefone em uso" respondiam se o CPF tinha ficha, e a recusa não consumia o link. Bastava o próprio link, uma conta e um loop                                                                                           | segurança (alto) e qualidade        | **corrigido.** As RECUSAS consomem a janela `identidade-envio` (5 por solicitação por hora, mais o IP). Estourada, a resposta vira `TEXTO_DE_MUITAS_TENTATIVAS`, que não diz o motivo. Só as recusas contam, porque a reconciliação da página chama a action a cada abertura. O caminho sem conflito conclui e consome o link |
| 🔴 **O login recriava a ficha duplicada.** `reconciliarPelaSessao` roda em todo login e gravava o CPF da solicitação sem conferir, copiando os documentos do parceiro                                                                                                                | backend (alto)                      | **corrigido.** Com o CPF em outra conta, ela devolve `cpf_em_outra_conta` sem escrever nada                                                                                                                                                                                                                                   |
| **Oráculo e-mail ↔ CPF.** Com o e-mail DIGITADO como referência, "E + C" respondia se o CPF C era da conta de E                                                                                                                                                                     | segurança (médio)                   | **corrigido.** A referência do CPF e do telefone é a conta do e-mail **do link** (`contaDoEmailDoLink`). O e-mail digitado decide só o "entre na sua conta". **Custo aceito:** quem corrigiu o e-mail para o da conta antiga que tem o CPF vai ao suporte                                                                     |
| **Logado, o telefone só travava no envio.** `sessao_propria` vinha antes do telefone                                                                                                                                                                                                 | backend (médio)                     | **corrigido.** O telefone vem antes da sessão própria                                                                                                                                                                                                                                                                         |
| **E-mail com maiúsculas.** A conferência comparava com `lower()` e a transação de forma exata. O admin grava `Maria@Gmail.com`, e nascia uma segunda `users` e uma segunda ficha com o CPF liberado como "a mesma pessoa"                                                            | segurança e backend                 | **corrigido.** A busca `porEmail` da transação usa `lower()`, com o match exato primeiro                                                                                                                                                                                                                                      |
| **Telefone travado sem saída** para o dono do número com conta antiga                                                                                                                                                                                                                | backend, frontend e a minha revisão | **corrigido sem mudar o `DO-68`.** O campo continua travado. Abaixo dele entra "O número é seu? **Entre na sua conta** ou **fale com a gente pelo WhatsApp**", com o protocolo                                                                                                                                                |
| tela: o botão "Sou eu, continuar com {e-mail}" estourava no celular · o foco se perdia quando o veredito chegava · "Quero usar outro e-mail" não fazia nada no bot · a senha era pedida no aviso de e-mail com conta · `justify` com e-mail · `nativeButton` · "volte por este link" | frontend                            | **corrigidos.** Rótulo "Sou eu, continuar com esta conta" · `flushSync` + foco no `#telefone` ou no aviso · `corrigirOEmail` foca e seleciona o e-mail · sem senha com **qualquer** aviso · `text-left` + `break-words` · `nativeButton={false}` · o texto novo                                                               |
| guarda: um caso negativo ficava verde com o defeito escrito de outro jeito · um caso vazio · a regex ainda aceitava `registrado: true` · casos que casavam a expressão inteira                                                                                                       | qualidade                           | **corrigidos.** A etapa 1 inteira não pode conter `setSubEtapa(1)` · o `esperado` é `Veredito` · a regex foi limpa · os casos de forma conferem a variável na expressão                                                                                                                                                       |
| auditoria da abertura em toda recarga, inclusive `sessao_propria`                                                                                                                                                                                                                    | segurança e qualidade               | **corrigido.** Audita só o que a tela mostra                                                                                                                                                                                                                                                                                  |
| comentários desatualizados, e o JSDoc de `LinhaConfirmada` fora do lugar                                                                                                                                                                                                             | qualidade                           | **corrigidos**                                                                                                                                                                                                                                                                                                                |
| o limite por IP lê o 1º `x-forwarded-for`, e o nginx não está no repositório                                                                                                                                                                                                         | segurança (médio, inferência)       | **catalogado** ([Item 54](../04-LISTA-DE-AFAZERES.md)). Medir na VPS                                                                                                                                                                                                                                                          |
| o telefone de médico ou admin trava o paciente                                                                                                                                                                                                                                       | backend (baixo/médio)               | **catalogado: é pergunta ao dono** (Item 54)                                                                                                                                                                                                                                                                                  |
| `porClerk` da transação sem `deletedAt` · checagem e escrita não atômicas (TOCTOU, só um índice fecha) · varredura sem índice · auditoria do `limite` sem teto por janela                                                                                                            | segurança e backend (baixos)        | **catalogados** (Item 54)                                                                                                                                                                                                                                                                                                     |
| quem para no suporte ou no telefone não conclui, e a Greens fica com o handoff pendente sem motivo visível                                                                                                                                                                           | backend (inferência)                | **catalogado** (Item 54). Avisar a Greens                                                                                                                                                                                                                                                                                     |

**Provado depois da revisão:**

- **9 sabotagens novas, todas vermelhas (33 no total):** reconciliação sem conferir, limite das recusas, `eq` exato na transação, referência do e-mail digitado, telefone depois da sessão, saída do telefone, senha só no CPF, foco e avanço inline.
- **Guarda:** 49 casos. **Integração:** 28 casos. A integração ganhou o oráculo e-mail↔CPF, o telefone com sessão própria, as recusas com limite, o e-mail em maiúsculas sem duplicar e o login que não recria a ficha.
- **Suíte:** 1587 casos em 69 arquivos. **Integração:** 135 em 11 arquivos, sem os dois de prévia.
- `pnpm build` com exit 0, baseline verde, type-check 0.

### O que existe no disco

| arquivo                                                                  | o quê                                                                                                                                     |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/cadastro/veredito-de-identidade.ts` (novo)                          | `decidirVeredito`, normalização, `VEREDITOS`, `VEREDITOS_COM_AVISO`, `telefoneEmUso`, os textos, os limites e `linkDoSuporteComProtocolo` |
| `lib/cadastro/conferir-identidade.ts` (novo)                             | `buscarAchados`, `estadoDaSessao`, `conferirIdentidade`, `cpfEstaEmOutraConta`, `telefoneEstaEmOutraConta`, `dentroDoLimiteDaConferencia` |
| `app/_actions/identidade-no-cadastro.ts` (novo)                          | `conferirIdentidadeNaEtapa1` (Zod, token, limite, auditoria). A `declararContaExistente` foi **removida** com o `DO-68`                   |
| `app/(auth)/cadastro/[token]/_components/aviso-de-identidade.tsx` (novo) | o aviso dos **dois** vereditos (`cpf_em_outra_conta` e `conta_pelo_email`), exaustivo e sem dado da outra conta                           |
| `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx`     | "Continuar" → conferência · "é você?" na etapa 1 · `sairDaSessao` · telefone travado com saída · sem senha com aviso · foco               |
| `app/(auth)/cadastro/[token]/page.tsx`                                   | conferência ao abrir e auditoria só do que a tela mostra                                                                                  |
| `app/_actions/cadastro-por-link.ts`                                      | CPF e telefone de outra conta recusam **antes** de escrever, sem consumir o link e com limite nas recusas. `porEmail` com `lower()`       |
| `lib/fluxo/reconciliar.ts`                                               | o login não grava CPF de outra conta                                                                                                      |

### Como foi provado, e o que NÃO foi

- Os números valem **depois da §9.2**: guarda com 49 casos, integração com 28, 33 sabotagens.
- **Suíte:** 1587 casos em 69 arquivos. **Integração:** 135 em 11 arquivos.
- **Build e portão:** `pnpm build` verde, baseline verde, type-check 0.
- **Guardas retificados**, o que mediam e não o que protegem:
  - `a-sessao-precisa-ser-do-dono-do-link`: um caso;
  - `o-cadastro-retoma-de-onde-parou`: dois casos.
- **Prévia estática** das 7 possibilidades em `previa-da-identidade/`, conferida por texto e por print em 900px e 390px.
- 🔴 **NÃO provado: o CLIQUE.** Sem `CLERK_SECRET_KEY` no `.env` (medido: 0), a página real não renderiza localmente. O "Sair", o foco e os avisos reagindo **não foram vistos rodando**. A prévia mostra cada estado; ela não clica.
- 🔴 **NÃO medido: o passo 0.** Quantos CPFs e telefones já estão repetidos em produção continua desconhecido, e é isso que diz quantos pacientes reais vão parar no suporte ou no campo travado.
