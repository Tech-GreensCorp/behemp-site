# ADR-0016 — O cadastro da Greens chega por back-channel, e só o token viaja com o paciente

> **Status:** 📋 **proposta** — 09/09/2026.
> **Espelho:** `greens-corp-backend/docs/adr/ADR-0027`. Esta aqui é a **fonte do contrato** —
> quem recebe define o formato. A do lado da Greens descreve o que cabe a quem envia e aponta
> para cá, conforme `ORGANIZACAO-MULTI-REPO.md` §5: _"nunca uma cópia do conteúdo"_.
> **Contexto:** o paciente preenche o formulário de intake da Greens (`/patient-access/{token}`).
> Ao final, um modal oferece conhecer a Be4Hope — e hoje esse botão faz `window.open` para
> `https://be4hope.org/`, **sem levar dado nenhum** (`ExternalRedirectModal.tsx:36`). Ele chega
> aqui como um desconhecido e recomeça do zero um cadastro que acabou de preencher.
> **Decisão:** os dados vão de **servidor a servidor**, assinados; com o paciente viaja **apenas
> um token opaco de uso único**. Aqui ele só define a senha e confirma o código do e-mail, e
> segue direto para a procuração da ANVISA.

---

## §1 — O caminho, inteiro

```
GREENS                                          BEHEMP
──────                                          ──────
paciente conclui o intake
        │
   [ modal / página "sobre a Be4Hope" ]
        │  ele escolhe continuar
        ▼
   POST /api/parceiros/greens/cadastro   ──────►  valida HMAC + janela de tempo
   (dados + manifesto de documentos)              cria `solicitacoes_cadastro`
   header: assinatura, timestamp, id               origem = 'greens_handoff'
        ◄──────────────────────────────────────   devolve { token, expiraEm }
        │
   redireciona o paciente
   para .../continuar/{token}            ──────►  tela: CONFIRA seus dados
                                                  + crie sua senha
                                                  + código de 6 dígitos no e-mail
                                                          │
                                                          ▼
                                                  conta criada, ficha gravada
                                                          │
                                                          ▼
                                                  /paciente/anvisa  (procuração)
                                                          │
                                                          ▼
                                                  "voltar para a Greens" → login de lá
```

## §2 — As decisões

### D-01 — Os dados vão por back-channel; na URL só o token

O paciente carrega um **identificador opaco**, nunca o conteúdo. Nome, e-mail, telefone, RG e
cidade trafegam servidor-a-servidor, sob TLS, e nunca aparecem em URL.

**Rejeitado: mandar os dados na query string.** A OWASP classifica isso como _information
exposure_, e o ponto que decide é que **HTTPS não resolve**: a URL é gravada no histórico do
navegador, no log do servidor e em **qualquer proxy no caminho** — e a URL ainda pode vazar pelo
cabeçalho `Referer` ao seguir um link externo.

⚠️ Esta não é uma preocupação teórica aqui: o `Item 19` do `04` cataloga exatamente esse
vazamento no canal do ChatPro, que é `GET` com `name` e `email` na query por imposição do painel.
Onde **nós** controlamos os dois lados, não repetimos o que somos obrigados a aceitar de terceiro.

**Rejeitado: JWT assinado na URL com os dados dentro.** Resolve a adulteração e **não resolve a
exposição** — o payload de um JWT é Base64, não cifra. Continua indo para o log do proxy, legível.

### D-02 — A chamada é assinada com HMAC-SHA256 sobre corpo + timestamp + id

Cabeçalhos: assinatura, carimbo de tempo e identificador único do evento. A verificação é em
**tempo constante**, e a janela de tolerância é de **300 segundos** — o valor do Standard
Webhooks, que Stripe e Svix adotam.

**Rejeitado: mTLS.** É mais forte, e exige emissão, distribuição, rotação e monitoramento de
validade de certificado entre duas empresas com deploys independentes. Um certificado vencido
derruba a integração inteira num sábado. HMAC entrega autenticidade **e** integridade sem
infraestrutura nova.

**Rejeitado: allowlist de IP como controle principal.** Vira apenas mais uma camada: não prova
integridade do corpo, e o IP de saída de uma VPS muda em recriação de instância.

🔴 **E a diferença central em relação à [ADR-0015](ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md):**
o ChatPro **não assina** os webhooks — a documentação não menciona HMAC, segredo de corpo nem
IPs, então lá foi preciso inventar a confirmação reversa. Aqui **nós escrevemos os dois lados**,
e ter assinatura é decisão nossa. Onde dá para provar, prova-se.

### D-03 — Reusa `solicitacoes_cadastro`; não nasce um segundo mecanismo de token

A tabela criada para o ChatPro passa a receber `origem = 'greens_handoff'`. Mesmo protocolo,
mesmo hash de token, mesma validade, mesmo uso único.

**Rejeitado: tabela própria para o handoff.** A ADR-0015 §1 registra que a BeHemp não tinha
mecanismo de link com token e que `solicitacoes_cadastro` **passa a ser o único**. Dois
mecanismos concorrentes significam duas regras de expiração, duas de uso único, e uma delas
esquecida na próxima mudança.

### D-04 — O token é de uso único, curto, e o conteúdo só existe no nosso banco

Token opaco de 256 bits, guardado **apenas como SHA-256** — o mesmo desenho do ChatPro. Validade
**curta** (o paciente está com a tela aberta, não vai voltar dias depois).

⚠️ **`Referrer-Policy: strict-origin-when-cross-origin` já está global** em
`next.config.ts:64` — medido. Em navegação cross-origin ele envia só a origem, **não o path com o
token**, que é exatamente a mitigação que a OWASP pede. **Preservar.** Se alguém afrouxar para
`unsafe-url`, o token passa a vazar para todo site externo que o paciente abrir.

### D-05 — Aqui ele só confirma, cria senha e valida o e-mail

Os campos chegam preenchidos e **editáveis**. Ele não redigita o que já digitou.

**O e-mail vem da Greens e ainda assim recebe código de 6 dígitos.** Não é desconfiança do
parceiro: é que o e-mail vira o **login** desta conta e o canal por onde chegam consulta,
procuração e prescrição. Um endereço com erro de digitação só se revela quando algo importante
não chega — e aí o paciente já perdeu a consulta.

### D-06 — O que não veio fica pendente, e pendência não bloqueia

São **cinco** documentos do lado da Greens: receita médica, laudo médico (**opcional**),
comprovante de residência, autorização da ANVISA e documento de identidade.

A transferência traz um **manifesto**: quais existem lá e quais faltam. A ficha nasce com essas
pendências visíveis, e **nenhuma delas impede** criar a conta ou seguir para a procuração.

**Rejeitado: exigir os documentos antes de concluir.** O paciente que chega sem receita é
justamente quem mais precisa da teleconsulta. Bloqueá-lo na porta é recusar quem o produto existe
para atender.

⚠️ **A CÓPIA DOS ARQUIVOS FICA PARA UMA SEGUNDA FASE, e isto é escolha declarada.** Fase 1 move
dados de texto e o manifesto. Copiar blob de saúde entre duas empresas exige URL assinada de vida
curta na origem, validação de MIME e tamanho no destino, store privado e prazo de retenção — e o
`Item 6` do `04` registra que este repositório **já tem 10+ uploads em store público**, defeito
conhecido e não corrigido. Código novo não repete isso, e resolvê-lo é trabalho próprio.

### D-07 — E-mail que já tem conta aqui vai para o login

A tela reconhece, diz que a conta existe e leva ao login; depois de entrar, ele segue para a
procuração normalmente. Decisão do dono em 09/09/2026.

**Rejeitado: atualizar a ficha existente com o que veio de fora.** Seria dado de outro sistema
sobrescrevendo o cadastro de alguém **sem essa pessoa estar autenticada** — quem controla a conta
é quem prova ser dono dela.

### D-08 — Ao terminar, o caminho de volta é explícito

Depois da procuração, um botão devolve o paciente ao **login da Greens**. Ele veio de lá, o
tratamento continua lá, e terminar num beco é como se perde alguém no meio de um processo de
duas empresas.

### D-09 — 🔴 O CAMINHO DE VOLTA: o que ficou pronto aqui volta para a Greens sozinho

**Decisão do dono em 09/09/2026:** _"volta pra greens pois se ele veio pra greens é porque quer
um medicamento; após ter tudo necessário, nosso outro webhook tem que jogar o que faltava da
Greens, seja receituário ou ANVISA, para lá automaticamente — ele já ter como comprar seu
medicamento que está na receita. **O foco é automatizar o que dá.**"_

O par de sistemas tem **duas direções**, e a ADR cobre as duas:

```
IDA    Greens ──► BeHemp    o cadastro do paciente        (D-01 a D-08)
VOLTA  BeHemp ──► Greens    a receita e a ANVISA prontas  (D-09)
```

**O gatilho da volta é o documento ficar pronto aqui**, não o paciente pedir. Ele veio buscar
medicamento; se precisar voltar e avisar que a receita saiu, a automação não serviu para nada.

| o que fica pronto aqui                 | o que a Greens ganha                              |
| -------------------------------------- | ------------------------------------------------- |
| receita emitida pelo nosso receituário | a pendência de prescrição do pedido dele se fecha |
| autorização da ANVISA concluída        | a pendência de ANVISA se fecha                    |

**Mesma técnica da ida, direção invertida:** POST assinado com HMAC, id de evento para
idempotência, janela de tempo. O que **não** repete é o token de tela — aqui não há paciente
navegando, é sistema falando com sistema.

⚠️ **O documento em si continua sendo referência, não cópia, nesta fase.** A volta avisa _"a
receita do paciente X está pronta, protocolo Y"_; buscar o arquivo é o mesmo trabalho de blob que
a fase 2 resolve nas duas direções.

**Rejeitado: esperar o paciente pedir.** É o oposto de automatizar o que dá.
**Rejeitado: a Greens ficar perguntando de tempos em tempos.** É o polling que o webhook existe
para eliminar — e multiplica chamada para descobrir que nada mudou.

### D-10 — Quem valida a receita é uma PESSOA, no painel da BeHemp

**Decisão do dono em 09/09/2026:** a conferência é **manual, pelo site da BeHemp, depois que o
paciente enviou tudo**. Não é o bot, não é regra automática. _"Futuramente terá uma IA ou um
código orquestrado que validará isso"_ — e até lá, **quem decide é gente**.

Isso é a mesma família da Proibição 2 do `CLAUDE.md`: em matéria clínica o sistema **informa**,
a pessoa **decide**. O sistema organiza a fila de conferência e registra quem decidiu o quê.

**Rejeitado: derivar automaticamente a validade.** Não temos o dado que sustentaria a conta, e um
sistema que declara sozinho a validade de um documento clínico assume uma responsabilidade que é
do médico.

### D-11 — 🔴 A REGRA REAL E A LINGUAGEM DA TELA SÃO COISAS DIFERENTES

**A regra de negócio, dita pelo dono:** _"o que invalida uma receita é ela não vir do nosso
receituário; qualquer um que não é, é inválido — **porém não podemos falar isso explicitamente e
não convém**"_.

Esta ADR é documentação interna, então registra a regra como ela é. **A tela não repete isso**, e
há um motivo que protege a empresa, além da conveniência comercial:

⚠️ **Uma receita de outro médico é LEGALMENTE VÁLIDA.** Ela não serve ao nosso fluxo — que é
coisa diferente. Uma tela que diga _"sua receita é inválida"_ sobre um documento legalmente
válido faz uma **afirmação falsa** sobre o ato de outro profissional. Isso é risco, não
discrição.

**O que a tela diz, e é verdade:** _"seu documento está em análise pela nossa equipe"_ ·
_"para seguir, você precisa de uma avaliação com um médico parceiro"_. Nenhuma dessas frases
mente, nenhuma julga o documento de fora, e as duas levam o paciente ao mesmo lugar — a
teleconsulta.

**Rejeitado: a tela dizer "receita inválida".** Afirma falsidade sobre documento de terceiro.
**Rejeitado: a tela explicar que só aceitamos receita nossa.** É o que o dono pediu para não
dizer, e a frase acima entrega o mesmo resultado sem a declaração.

---

## §3 — O que fica rejeitado

| #    | rejeitado                                     | motivo                                                                           |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| R-01 | dados na query string                         | OWASP: histórico, log de servidor, proxy e `Referer` — HTTPS não resolve         |
| R-02 | JWT com os dados na URL                       | Base64 não é cifra: resolve adulteração, não exposição                           |
| R-03 | mTLS                                          | certificado entre duas empresas com deploy independente; vencimento derruba tudo |
| R-04 | allowlist de IP como controle principal       | não prova integridade e o IP muda ao recriar instância                           |
| R-05 | tabela de token própria                       | a ADR-0015 fixou `solicitacoes_cadastro` como o único mecanismo                  |
| R-06 | confiar no e-mail sem confirmar               | ele é o login e o canal da consulta                                              |
| R-07 | exigir os 5 documentos para concluir          | barra justamente quem mais precisa da teleconsulta                               |
| R-08 | sobrescrever ficha existente com dado de fora | atualização sem o dono autenticado                                               |

## §4 — Como se prova

| guarda                                        | fica vermelho quando                                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `handoff-da-greens-nao-viaja-na-url`          | dado pessoal aparecer em query string, ou o `Referrer-Policy` sair de `strict-origin`/`no-referrer`                            |
| `handoff-da-greens-e-assinado`                | a verificação de HMAC sumir, deixar de ser em tempo constante, a janela de tempo cair, ou a deduplicação por id do evento sair |
| `handoff-nao-cria-segundo-mecanismo-de-token` | nascer outra tabela com token/validade/uso único fora de `solicitacoes_cadastro`                                               |
| `pendencia-de-documento-nao-bloqueia`         | a conclusão do cadastro passar a exigir documento                                                                              |

Todos nascem vermelhos e se provam por sabotagem (`docs/TECNICA-DOS-GUARDAS.md`).

---

## §6 — 🔴 RETIFICAÇÃO, 09/09/2026 — a Greens já tinha metade disto, e eu não olhei

A ADR foi escrita e **só depois** o Claude do `greens-corp` apontou divergências. Quatro
procediam. Ficam registradas porque o erro de método importa mais que o de conteúdo.

### 6.1 — 🔴 JÁ EXISTE contrato Greens↔BeHemp, e esta ADR o ignorava

O commit `0fd763c` — _"Sprint G1: camada de gateway, roteamento por jornada Behemp"_, do **mesmo
dia** — plantou no schema da Greens:

```prisma
enum BehempJourney {
  NONE              // nunca passou pela Behemp
  SENT_TO_BEHEMP    // Canal A: a Greens encaminhou     ← é a IDA desta ADR
  CAME_FROM_BEHEMP  // Canal B: a Behemp encaminhou     ← é a VOLTA (D-09)
  ADMIN_MARKED      // marcado à mão, sem webhook
}
behempReferralId String? @db.VarChar(64)  // "id do encaminhamento do outro lado
                                          //  (CONTRATO §4 e §6)"
```

O comentário do schema diz o que este documento deveria ter dito primeiro: _"é por ele que **o
webhook da Behemp localiza a solicitação**"_.

**Os dois canais já têm nome, já têm coluna, e já apontam para um CONTRATO com seções
numeradas.** Esta ADR inventou `origem = 'greens_handoff'` para a mesma coisa.

⚠️ **E há consequência de negócio que eu não sabia existir:** a jornada decide **gateway de
pagamento e desconto** — _"o desconto collab combinado entre as duas; quem chegou com tudo pronto
e nunca passou por lá paga na Cannect"_. O handoff não é só cadastro: muda **quanto o paciente
paga e onde**.

**Correção:** `behempReferralId` é a chave de correlação, e a resposta do nosso endpoint precisa
devolvê-lo — não só o token de tela.

🔴 **Isto BLOQUEIA a implementação da ida** até o `CONTRATO §4/§6` ser lido e cruzado.

**O erro de método, nomeado:** pesquisei fundamento na web e li o **frontend** da Greens, e não
procurei o que o **backend** dela já tinha. A regra do `CLAUDE.md` — _"replicar solução que já
existe no próprio código exige pesquisa antes"_ — incluía o outro repositório, que esta ADR trata
como parceiro desde a primeira linha.

### 6.2 — ❌ `city` não existe; o payload muda

O formulário atualizado (`a644f83` back / `21cd52f` front) **não coleta cidade**. Enviar campo que
a origem não tem é contrato que falha no primeiro teste.

**Campos reconferidos:** nome, e-mail, telefone, **RG (agora obrigatório)** — e **não** cidade.

### 6.3 — ✅ O aceite já existe, e é mais preciso do que supus

Campo de consentimento gravado em `medication_requests`, exigido **exatamente quando falta a
ANVISA** — o recorte certo, porque é o caso em que o paciente precisa vir para cá.

**O bloqueio nº 2 do `04` Item 22 caiu.** Sobra o segredo compartilhado.

### 6.4 — ⚠️ A validade da receita tem uma SEGUNDA régua, e ela é dizível

A auditoria da Greens registrou: **a receita vence em 30 dias** (RDC 1.015/2026, em vigor desde
04/05/2026, produto até 0,2 % de THC), e _"nada no sistema sabe que uma receita expira"_.

São **dois** motivos independentes para faltar receita válida:

| #   | motivo                     | natureza                         | pode ser dito? |
| --- | -------------------------- | -------------------------------- | -------------- |
| 1   | não é do nosso receituário | comercial                        | **não** (D-11) |
| 2   | **passou de 30 dias**      | **regulatória** (RDC 1.015/2026) | **sim**        |

🔴 **O segundo pode e deve ser dito.** _"Sua receita está vencida"_ é verdade, é regra pública, e
não julga o médico que a emitiu. A regra de linguagem da D-11 vale para o motivo 1 — não para
este.

### 6.5 — ⚠️ E uma afirmação minha que era falsa

Escrevi que a worktree da Greens tinha _"24 arquivos modificados por outra pessoa"_ e instruí
_"não commite arquivo que você não escreveu"_. **Eram 37, e a maioria era trabalho da própria
sessão de lá** — ADR-0025, ADR-0026, texto do WhatsApp, duas migrations. Seguida ao pé da letra, a
instrução mandaria abandonar o trabalho de uma tarde.

Li `git status`, vi arquivos que não eram meus, e **concluí autoria** — que o `git status` não
informa. Autoria se lê no histórico ou se pergunta; não se deduz de um arquivo estar modificado.

## §7 — ✅ DESBLOQUEADO em 09/09/2026 — o contrato, lido no schema

O §6.1 bloqueou a implementação até o `CONTRATO §4/§6` ser cruzado. Ele foi procurado e
**não existe como documento** — é citado no schema da Greens e nunca foi escrito. Então a fonte
é o próprio schema, e ele especifica o suficiente:

| o que o schema fixa | valor                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| `behempReferralId`  | `VarChar(64)` — **nosso** id, do ponto de vista deles                                  |
| para que serve      | _"é por ele que **o webhook da Behemp localiza a solicitação**"_                       |
| unicidade           | **não é `@unique`**, de propósito: um unique faria reentrega de webhook virar erro 500 |
| `behempJourney`     | `SENT_TO_BEHEMP` na ida · `CAME_FROM_BEHEMP` na volta                                  |
| efeito no dinheiro  | `!= NONE` → **Mercado Pago com desconto collab**; `NONE` → Cannect                     |

### D-12 — O `referralId` é o `id` da nossa solicitação, e vai na resposta da ida

```
Greens ──POST assinado──►  BeHemp cria solicitacoes_cadastro
       ◄── { token, expiraEm, referralId }
                              │
       grava behempReferralId = referralId
             behempJourney    = SENT_TO_BEHEMP
```

E na volta o caminho se fecha: mandamos o `referralId`, e a Greens acha a solicitação por ele.

**Por que o `id` (cuid2, 24 caracteres) e não o `protocolo`.** O protocolo é **sequencial**
(`SOL-000123`): quem tiver um consegue adivinhar os vizinhos. Como este id atravessa a fronteira
entre duas empresas e é a chave que localiza um pedido, ele precisa ser opaco. Cabe folgado nos
64 caracteres.

**Rejeitado: mandar o `protocolo`.** Sequencial e adivinhável.
**Rejeitado: a Greens gerar o id.** O schema diz que o id é _"do outro lado"_ — quem cria o
registro é quem o nomeia, senão duas partes geram chave para a mesma coisa.

### D-13 — 🔴 ESTE HANDOFF MEXE NO PREÇO, E ISSO MUDA O PESO DELE

Descoberto no schema, não estava na versão original desta ADR: `behempJourney != NONE` roteia o
pagamento para **Mercado Pago com desconto collab**; `NONE` vai para a Cannect.

⚠️ **Consequência:** um handoff duplicado, perdido ou disparado por engano não erra só um
cadastro — **erra o gateway e o desconto de uma compra**. É por isso que a idempotência por id de
evento (D-02) deixa de ser boa prática e passa a ser requisito de dinheiro.

E é por isso que o `behempReferralId` **não é `@unique`** lá: a reentrega precisa ser absorvida
em silêncio, não virar erro.

**Rejeitado: tratar o handoff como "só cadastro".** Era o que esta ADR fazia antes de ler o
schema.

## §5 — Fontes

**Lidas.** OWASP, _Information exposure through query strings in URL_ — a URL é gravada em
histórico, log de servidor e proxies, e **HTTPS não muda isso**; recomenda corpo de POST e
`Referrer-Policy` restritiva quando há links externos. _Standard Webhooks_ / Stripe / Svix —
HMAC-SHA256 sobre id + timestamp + corpo, tolerância de **300 s**, e idempotência pela chave do
evento. Comparativos de autenticação servidor-a-servidor (Apache APISIX, API7, SSOJet) — HMAC
entrega autenticidade e integridade sem gestão de certificado; **mTLS é mais forte e exige
infraestrutura contínua**. OpenID Connect / WSO2 sobre **back-channel × front-channel** — o
front-channel atravessa "um ambiente de navegador potencialmente hostil"; o back-channel é
ponto a ponto sob TLS.

**Medidas no código, não presumidas.** `ExternalRedirectModal.tsx:36` (hoje abre a Be4Hope sem
dado). Campos do intake da Greens em `PatientIntakeFlow.tsx`: `patientName`, `patientEmail`,
`patientPhone`, `rg`, `city`, `prescription`, `proofOfAddress`, `anvisaAuthorization`.
`next.config.ts:64` (`Referrer-Policy: strict-origin-when-cross-origin`, já ativo).
`app/(paciente)/paciente/anvisa/` (a procuração com DocuSign **já existe** — não se cria).

⚠️ **A Dryelle vai subir uma atualização do formulário da Greens.** A lista de campos acima é o
estado de 09/09/2026 e **precisa ser reconferida contra a versão nova** antes de congelar o
contrato do payload. A base legal da transferência **já está sendo tratada por ela** — esta ADR
decide a **técnica**, não o consentimento.

**Princípios e fase:** D-01/D-02/D-04 **D** (regra e resiliência), fase 7 · D-03 **A**
(arquitetura, não duplicar mecanismo), fase 3 · D-05/D-06/D-07/D-08 **B** (produto e caminho do
usuário), fase 6.
