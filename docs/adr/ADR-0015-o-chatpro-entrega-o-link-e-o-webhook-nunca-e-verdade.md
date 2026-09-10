# ADR-0015 — O ChatPro entrega o link único, e o que o webhook diz nunca é verdade

> **Status:** ✅ **aceita e implementada** — 09/09/2026.
> **Contexto:** o dono pediu para replicar na BeHemp a integração com o ChatPro que já roda
> **validada em produção** no `greens-corp` — _"O QUE ESTÁ LÁ JÁ ESTÁ VALIDADO O USO"_ — com uma
> diferença de fluxo: aqui o bot coleta **nome completo + e-mail**, e lá só o nome.
> **Decisão:** o comportamento atravessa; a stack não. As decisões de segurança do greens-corp
> (ADR-0001 a 0005 de lá) são adotadas na íntegra, reimplementadas em Next/Drizzle, e o que a
> implementação aqui ensinou fica registrado nas retificações ao pé.

---

## §1 — O que veio de lá, e o que teve de nascer aqui

| peça                 | greens-corp                                | BeHemp                                                         |
| -------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| stack                | Express + Prisma                           | **Next.js App Router + Drizzle**                               |
| tabela do link       | reusou `MedicationRequest`, que já existia | 🔴 **`solicitacoes_cadastro`, criada** — não havia equivalente |
| o que o bot pergunta | só o nome                                  | 🔴 **nome completo + e-mail**                                  |
| destino do link      | `/patient-access/{token}`                  | `/cadastro/{token}` — **a tela é da Dryelle**                  |
| fila de webhook      | `chatpro_webhook_events` + worker          | `chatpro_eventos` + `/api/chatpro/processar` por cron          |
| tradução de UUID     | `ChatproDirectoryService`                  | `chatpro_diretorio` (tabela) + `ServicoDeDiretorio`            |
| projeção da conversa | `chatpro_sessions`                         | `chatpro_sessoes`                                              |

🔴 **A diferença que mais importa:** lá a decisão-chave foi **não criar** um segundo mecanismo de
token, porque já havia um. Aqui não havia nenhum — então `solicitacoes_cadastro` passa a ser **o**
mecanismo de link com token do sistema, e qualquer necessidade futura de link único (convite de
paciente, confirmação de e-mail) deve usá-la em vez de inventar a segunda.

## §2 — As decisões

### D-01 — O corpo da resposta do `bot-link` É a mensagem do WhatsApp

O bloco "Requisição externa" do construtor de fluxo entrega o corpo da resposta **como mensagem**
na conversa. Por isso `/api/chatpro/bot-link` responde `text/plain` com o texto pronto.

**Rejeitado: responder JSON.** O paciente leria `{"linkDeAcesso":"…"}` na tela do WhatsApp.

**Rejeitado: responder sempre 2xx.** O erro é a rede de segurança: status não-2xx dispara a "Ação
em caso de falha" do painel, que transfere para uma pessoa. Responder 200 com texto de desculpa
deixaria a conversa travada sem ninguém saber.

### D-02 — O payload do webhook é ponteiro, nunca verdade

O ChatPro **não assina** os webhooks: a documentação não menciona HMAC, segredo de corpo nem IPs
de origem, e o painel expõe só "Webhook url" e "Versão". Então nada que chega no corpo é gravado
como fato sobre o paciente. O corpo diz **qual conversa olhar**; quem responde **quem é o
paciente** é uma chamada autenticada de volta à API (`getSessionById` → `findById`).

As camadas, porque nenhuma sozinha basta: segredo no caminho da URL · confirmação reversa ·
deduplicação por `(evento, sessionId, eventoTs)` · limpeza de conteúdo antes de gravar.

**Rejeitado: confiar no corpo por ele "vir do ChatPro".** Sem assinatura, "vir do ChatPro" é uma
afirmação que não se verifica — qualquer um que descubra a URL a faz.

### D-03 — O webhook grava e responde 202; quem processa é o cron

**Rejeitado: processar dentro do request.** Uma chamada lenta à API estouraria o timeout da
plataforma, que reentregaria o mesmo evento — multiplicando exatamente o problema que a
deduplicação existe para resolver.

### D-04 — A reivindicação de evento é atômica

`UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, com o estado intermediário
`processando`. Duas execuções concorrentes acontecem sozinhas quando um cron atrasa e o seguinte
dispara.

**Rejeitado: listar pendentes e marcar ao terminar.** É o defeito real da armadilha 7 do
greens-corp: o funil registrou **4 etapas onde deviam existir 3**.

### D-05 — Conteúdo de mensagem não entra em lugar nenhum

`message`, `alt_message`, `title` e `url` de mídia são removidos **antes** de gravar; mensagens
viram **contador**. Telefone e e-mail saem mascarados em log. Conversa de paciente de canabidiol
é dado de saúde — sensível pelo **art. 11 da LGPD**, e o mínimo necessário aqui é o metadado do
funil, não o que foi conversado.

### D-06 — A tradução do diretório nunca bloqueia o processamento

Nome de fila é conforto de leitura; evento é dado. `nomeDe` devolve o **próprio UUID** quando não
sabe — nunca `null`, nunca vazio, nunca exceção.

**Rejeitado: constante no código com os UUIDs.** Eles são da **conta**, não do produto: mudam
quando a operação cria uma fila ou renomeia um motivo, sem deploy nenhum.

### D-07 — O token só existe como hash, e pedir de novo emite outro

SHA-256 no banco; o valor cru só existe na resposta que vai ao paciente. **Consequência que o
atendimento precisa saber:** o link não é recuperável, e pedir outro **invalida o anterior**. A
mensagem do bot já avisa que vale sempre o mais recente.

### D-08 — A rota do processador falha FECHADA

Sem `CRON_SECRET`, responde `503`. As rotas de cron mais antigas do repositório usam
`if (cronSecret && …)`, que deixa o endpoint **aberto** quando a variável falta — exatamente o
cenário de um ambiente novo, mal provisionado.

⚠️ Isto **não** corrige as rotas antigas. Elas ficam catalogadas no `04`; o que esta decisão
garante é que o caminho novo não repete o defeito.

---

## §3 — O que fica rejeitado

| #    | rejeitado                                     | motivo                                               |
| ---- | --------------------------------------------- | ---------------------------------------------------- |
| R-01 | `bot-link` responder JSON                     | o paciente leria o JSON na tela                      |
| R-02 | `bot-link` responder sempre 2xx               | mata a transferência para humano em caso de falha    |
| R-03 | confiar no corpo do webhook                   | não há assinatura para verificar                     |
| R-04 | processar dentro do request do webhook        | timeout vira reentrega vira duplicata                |
| R-05 | listar-e-marcar-depois na fila                | duplicou etapa de funil no greens-corp               |
| R-06 | UUIDs de departamento como constante          | são da conta, mudam sem deploy                       |
| R-07 | guardar o token cru                           | vazamento do banco abriria o cadastro de qualquer um |
| R-08 | `if (segredo && …)` na rota de cron           | deixa o endpoint aberto quando a variável falta      |
| R-09 | derivar o telefone prefixando `+` aos dígitos | manda o link para outro país — ver a retificação     |

## §4 — Como se prova

| guarda                                    | falha quando                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chatpro-nao-confia-no-que-chega`         | segredo comparado com `===`, telefone/e-mail em log, token cru no banco, uso único fora do UPDATE — **75 casos**                                      |
| `chatpro-processa-uma-vez-e-nao-bloqueia` | o claim perder `SKIP LOCKED`, a falha morrer em `processando`, a tradução virar pré-requisito, conteúdo de mensagem entrar na projeção — **20 casos** |

Os dois foram provados por **18 sabotagens**, todas acusadas.

---

## §5 — 🔴 O que a implementação ensinou (retificações)

### 5.1 — O bug do telefone indonésio

A primeira versão de `normalizarTelefoneWhatsapp` tentava `+${digitos}` **antes** dos dígitos
crus. Para o número brasileiro `(62) 99999-7197` isso produz `+62999997197` — e **62 é o código da
Indonésia**. O parser aceita, `isValid()` responde `true`, e o link vai para o número errado.

O guarda pegou antes de ir ao ar. A ordem correta é dígitos crus primeiro, com o país padrão
resolvendo o DDI; o `+` explícito só se o valor **já** veio com ele.

**A regra que sai daí:** validade sintática não é correção semântica. Um telefone "válido" pode
ser válido em outro país.

### 5.2 — O falso positivo do `cid`

Um caso do guarda proibia dado clínico na resposta da rota do link, procurando a substring `cid`.
Ficou vermelho por casar dentro de **"des-cid-a"** (`desconhecida`, na mensagem de erro). É a
**quinta** ocorrência da mesma classe neste repositório: checagem que confunde menção com uso.
Corrigido com limite de palavra, e com um caso de **controle** que prova a âncora.

### 5.3 — O que o greens-corp descobriu com paciente real, e vale aqui

Dois defeitos que só apareceram em produção lá, registrados em
`docs/chatpro/HERANCA-CHATPRO-DAVI-DRYELLE.md` (atualizado em 08/09/2026):

1. **O menu do bot só aparece no primeiro contato.** Com sessão aberta, o fluxo não recomeça a
   triagem e o bloco "Requisição externa" nunca é alcançado — **sem nenhum registro no log**,
   indistinguível de "não configurado". Lá foram 72 horas de log com uma única chamada, que era
   um `curl` de diagnóstico. É limitação de **desenho do fluxo**, não de código, e é séria: em
   operação real quase todo paciente já falou com a empresa antes. Por isso `/api/chatpro/start`
   existe — ele cobre quem já conversou, sem depender de sessão nem de menu.
2. **PII na query string chega ao log do proxy.** O `bot-link` recebe `name` e — **na BeHemp,
   também `email`** — por query. O log da aplicação **mascara**; o log genérico do servidor web
   grava a URL inteira. Nosso código nunca imprime a URL completa (o guarda cobre), mas **o
   nginx/proxy à frente não é código nosso**. Catalogado no `04`.

### 5.4 — 🔴 O defeito mais grave do módulo, achado só em 09/09 ao construir a tela

O middleware do Clerk protege **tudo** por padrão, e seu matcher declara explicitamente
_"sempre roda para API routes"_. Nem `/cadastro/{token}` nem **`/api/chatpro/*`** estavam na
lista de rotas públicas. Em produção isso significaria:

| quem                  | o que aconteceria                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| o paciente            | clica no link do WhatsApp → cai na tela de **login** → e para se cadastrar precisaria já estar cadastrado |
| o servidor do ChatPro | chama `/bot-link` → recebe **redirect** → o bot registra falha e transfere para triagem                   |
| quem for depurar      | **não vê nada no log**, porque a requisição nunca chega à rota                                            |

🔴 **E os 31 testes ao vivo passaram verdes.** O `.env` de desenvolvimento está **sem as
chaves do Clerk**, e sem elas o middleware não bloqueia coisa alguma. Nenhuma execução local
acusaria — foi preciso **ler** o middleware.

**A regra que sai daí, e vale muito além deste módulo:** _teste que passa por ausência de
configuração não testou nada._ É a mesma família do que o greens-corp viveu com as 72 horas de
log vazio que pareciam "não configurado" e eram "o fluxo nunca chegou".

**Corrigido** com as duas rotas na lista pública — e elas não ficam desprotegidas: o token de
64 hex é a credencial do `/cadastro`, e as rotas do ChatPro têm autenticação própria (segredo
em tempo constante, token no caminho, `CRON_SECRET`). O guarda
`cadastro-por-link-abre-sem-conta` fixa as duas, **e tem um caso de CONTROLE** que fica
vermelho se alguém "resolver" liberando `/medico`, `/admin` ou `/paciente`.

### 5.5 — A tela do cadastro passou a ser nossa (09/09/2026)

A ADR dizia que a tela era da Dryelle. O dono decidiu que **nós a construímos**, e definiu os
campos: nome, CPF, telefone, e-mail, senha, e a pergunta _"já faz tratamento?"_ com caixa de
texto quando a resposta é sim. O contrato em
`docs/chatpro/CONTRATO-DA-PAGINA-DE-CADASTRO.md` continua valendo — virou a descrição do que
foi construído.

**Três decisões que saíram daí:**

- **D-09 — o e-mail é o login, e a senha é do paciente.** A conta nasce no Clerk pelo próprio
  navegador, com confirmação por código de 6 dígitos. **Rejeitado: criar conta sem
  verificar o e-mail** — é por ele que chegam consulta e prescrição, e um endereço digitado
  errado só apareceria quando algo importante não chegasse.
- **D-10 — a ficha clínica só é gravada DEPOIS da sessão existir.** Invertido, uma falha na
  verificação deixaria no banco um paciente **sem dono**, invisível para ele e para o médico.
  Do jeito atual, falhar não deixa resíduo: o link continua válido.
- **D-11 — "já faz tratamento" tem TRÊS estados**: sim, não e **não informado**. Um
  `notNull().default(false)` afirmaria "não faz tratamento" sobre quem se cadastrou por outro
  caminho e nunca respondeu — e é justamente essa resposta que muda a conduta do médico na
  primeira consulta. **Rejeitado: boolean obrigatório com default.**

E o destino, decidido pelo dono: **agendar a teleconsulta**. O link serve os dois negócios —
_"o WhatsApp da Greens vai enviar o link que criaremos da BeHemp"_ — então a tela é uma só,
aqui, com a identidade da BeHemp.

**Fontes.** Primárias lidas: `greens-corp-backend/docs/chatpro/{HERANCA-CHATPRO-DAVI-DRYELLE,
MAPA-DE-CAMPOS,COMO-CONFIGURAR-NO-PAINEL,CONTRATO-API}.md` e `docs/adr/ADR-0001..0005` de lá —
integração **em produção, provada ponta a ponta em 08/09/2026**. Mapeamento de campos **medido
contra a instância real**, porque a documentação oficial do ChatPro publica os schemas de resposta
**vazios**. Segurança: **OWASP API Security Top 10** (API1 BOLA, API2 autenticação quebrada).
LGPD **art. 11** para dado sensível de saúde.

**Princípios e fase:** D-01 **A** (não quebrar o que funciona), fase 3 · D-02/D-07/D-08 **D**
(regra e resiliência), fase 7 · D-03/D-04 **D**, fase 7 · D-05 **F** (dados) + LGPD, fase 5 ·
D-06 **A**, fase 3.
