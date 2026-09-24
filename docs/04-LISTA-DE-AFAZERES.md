# Lista de Afazeres — Be4Hope / BeHemp

> Diz **como**. Cada item traz **diagnóstico** e **evidência no código**.
> O _o quê/quando_ está no [Checklist](03-CHECKLIST-MESTRE.md). O _por quê_ em [adr/](adr/).
>
> **Regra:** nada entra aqui sem `caminho/arquivo.ts:linha`. Item sem evidência é palpite, e
> palpite faz quem pegar começar do zero.

**Atualizado em 20/08/2026.**

> Os itens abaixo foram diagnosticados em 19–20/08/2026 e **todos são deste repositório**.
>
> ⚠️ **A numeração tem um vão: não existe Item 5.** Ele era de um domínio que saiu deste
> repositório. Os números **não** foram reaproveitados de propósito — o Item 6 já é citado como
> "Item 6" no checklist, no handoff e em `.claude/rules/seguranca-lgpd.md`, e renumerar
> quebraria essas citações. Nenhum foi corrigido: são dívida catalogada, aguardando autorização. Cada um
> traz o **perigo de mexer medido** — quantos pontos de chamada, se está em produção, e se
> existe teste que prove o antes e o depois.

---

## 🔴 Item 42 — CATALOGADO, 24/09/2026: o `pm2 startup` nunca foi configurado na EC2, e um reboot derruba produção inteira

**Status:** catalogado, **não corrigido**. **Prioridade alta.** Achado ao medir os valores
pendentes da [ADR-0027](adr/ADR-0027-o-worker-das-filas-roda-no-pm2-e-o-github-vira-rede.md)
(R-03). É um defeito próprio e **anterior** a ela: não depende do worker e não se resolve com ele.

### O que foi medido (24/09/2026, na EC2 de produção, pelo dono)

| pergunta                                  | comando                                                         | resultado                          |
| ----------------------------------------- | --------------------------------------------------------------- | ---------------------------------- |
| existe unit systemd do PM2?               | `systemctl list-unit-files \| grep -i pm2`                      | **nenhuma**                        |
| a unit do usuário está habilitada/ativa?  | `systemctl is-enabled pm2-ubuntu` · `systemctl is-active pm2-ubuntu` | **`not-found`** · **`inactive`** |
| há quanto tempo a máquina está de pé?     | `uptime -s`                                                     | desde **07/08/2026**, **49 dias**  |

⚠️ **O que NÃO foi relatado nesta medição:** o conteúdo do `~/.pm2/dump.pm2`. Sem a unit
systemd, isso não muda o diagnóstico: nada lê o dump no boot. Mas vai importar na correção
(ver abaixo).

### O que isso significa

O site está no ar há 49 dias **só porque a EC2 não reiniciou nesse período**. Se ela reiniciar
por qualquer motivo, **nada volta sozinho**: nem o `behemp-site`, nem qualquer processo que
venha depois, como o `behemp-filas` da ADR-0027. Motivos possíveis incluem manutenção agendada
da AWS, retirement de hardware, kernel panic, `sudo reboot` manual e atualização automática do
Ubuntu que pede reinício.

**O `pm2 save` do deploy dá uma falsa sensação de segurança.** O `.github/workflows/deploy.yml:443`
roda `pm2 save` a cada deploy, e isso grava o `dump.pm2`. Mas quem **lê** o dump no boot é a
unit que o `pm2 startup` cria, e ela não existe. O dump é gravado a cada deploy e nunca é lido.

**Varredura do repositório:** `pm2 startup`, `pm2 resurrect` e `systemctl` aparecem em
**0** arquivos de `.github/`, `scripts/`, `docs/*.md` e `CLAUDE.md`. Nunca houve um passo
versionado para isso. É a mesma classe do Item 28: estado de servidor que ninguém sabia que
faltava.

### Perigo de mexer — medido

- **em produção:** sim. A correção roda na EC2, com `sudo`
- **pontos tocados:** 1 unit systemd nova (`pm2-ubuntu.service`) e o `dump.pm2`. **Nenhum**
  arquivo do repositório precisa mudar para corrigir
- **derruba o site?** não. `pm2 startup` só cria e habilita a unit; `pm2 save` só grava a lista
  que está rodando. Nenhum dos dois reinicia processo
- **teste antes/depois:** `systemctl is-enabled pm2-ubuntu` → `enabled`. A prova completa é um
  reboot controlado, que **derruba o site por alguns minutos** e precisa de janela própria
- **custo de deixar:** o primeiro reboot não planejado tira produção do ar até alguém entrar
  por SSH e subir o processo à mão, com o `.env` e o caminho do `server.js` certos. Foi
  exatamente o que o Item 28 mostrou ser difícil

### A correção, quando autorizada

🔴 **Não aplicada.** É escrita na EC2 e precisa de **autorização explícita separada**, mesmo
sendo simples.

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu   # imprime um comando sudo; rodar o que ele imprimir
pm2 save                                          # grava a lista que está rodando AGORA
systemctl is-enabled pm2-ubuntu                   # → enabled
```

⚠️ **Antes do `pm2 save`, conferir que `pm2 ls` mostra o `behemp-site` com o `script path`
do checkout atual.** É o dump desta hora que o boot vai restaurar. Um `behemp-site` apontando
para um `server.js` velho seria ressuscitado no caminho errado (Unitech/pm2#3054, registrado no
`deploy.yml:405-411`).

**Rejeitado: pôr `pm2 startup` dentro do `deploy.yml`.** O comando precisa de `sudo`, e cada
deploy passaria a mexer em unit systemd. A configuração é feita uma vez só. O que cabe no
repositório é **registrar** que ela existe (este item) e, se valer a pena, um passo de
**verificação** no deploy que só lê `systemctl is-enabled pm2-ubuntu` e avisa, sem corrigir.

### Relação com a ADR-0027

A ADR-0027 R-03 dependia deste valor. O worker sobrevive a **deploy** pelo passo `delete` +
`start` + `pm2 save`, mas só sobrevive a **reboot** depois que este item for corrigido. E isso
vale igual para o site principal. A ADR não fica bloqueada por este item: ela não piora nada que
já não esteja quebrado.

---

## ✅ Item 41 — CORRIGIDO em 23/09/2026: o processador do Mercado Pago exigia login em produção

**Branch:** `fix/mercadopago-processar-publico`. Defeito **meu** (Claude), introduzido no PR
#122 (Item 39).

### O que aconteceu

Medido em produção logo depois do deploy do PR #122:

```
curl https://be4hope.org/api/mercadopago/processar
→ 307  https://be4hope.org/entrar?redirect_url=…%2Fapi%2Fmercadopago%2Fprocessar
```

`middleware.ts` libera `/api/webhooks(.*)` (o webhook funcionava), mas não havia entrada para
`/api/mercadopago/processar`. O Clerk exige sessão **antes** de a rota rodar. O cron do
`filas.yml` (`.github/workflows/filas.yml:80`) não tem sessão, exige 200, e marcaria vermelho
a cada execução. **A conciliação dos pagamentos nunca rodaria.**

**Impacto real, medido:** nenhum pagamento afetado. Nenhuma tela chama a cobrança, e o
`MERCADOPAGO_WEBHOOK_SECRET` não está cadastrado (o log do deploy mostra `gravar … ""`). O cron
não chegou a rodar entre o deploy e a correção: o `schedule` do GitHub estava disparando a
cada ~4 h.

### Por que nenhum teste pegou

A integração (`o-webhook-do-mercado-pago-confirma-o-que-a-api-diz`) chama o handler **direto**,
sem o middleware. Era verde e continuava verdadeira, **sobre a camada que exercitava**. É o
limite _"guarda lê o código, não executa o caminho"_, aqui entre duas camadas. E eu **não**
subi o `server.js` com `curl` na rota antes do deploy, o nível 2 da regra "Deploy CUSTA". Esse
passo teria mostrado o 307 em segundos.

**Segunda vez desta classe:** o Item 21 (09/09) foi o mesmo defeito com as rotas do ChatPro.

### A correção

- `middleware.ts`: uma entrada, o caminho **exato** `'/api/mercadopago/processar'`, nunca o
  prefixo. Autorização do dono registrada em `.claude/autorizacoes.txt`. A rota continua
  autenticada pelo `CRON_SECRET`
- guarda novo `o-cron-chama-rota-que-o-middleware-deixa-passar`: **deriva as URLs do
  `filas.yml` e os padrões do `middleware.ts`**, e casa os dois com o `createRouteMatcher` do
  próprio Clerk. O próximo passo novo do cron nasce coberto. 11 casos, **8 sabotagens**,
  incluindo "prefixo em vez do exato", "catch-all" e "extrator cego". Nasceu vermelho
  apontando só o processador; ChatPro e parceiros verdes

### Prova local (build standalone, `NODE_ENV=production`, Clerk configurado, Postgres local)

| estado                                                                                         | resposta                                          |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **antes** da correção, segredo certo                                                           | `307 → /entrar` (o defeito reproduzido)           |
| depois, `CRON_SECRET` vazio no servidor                                                        | `503` "Processador não configurado"               |
| depois, segredo errado / sem cabeçalho                                                         | `401`                                             |
| depois, segredo certo                                                                          | `200`, `{"reenfileirados":0,"reivindicados":0,…}` |
| controles: `/api/mercadopago/outra-rota`, `/api/medico/mercadopago/conectar`, `/medico/agenda` | `307`, continuam exigindo sessão                  |

⚠️ **Dois artefatos do ambiente local, para quem repetir:**

1. `HOSTNAME=127.0.0.1` fez a rota pública responder **500**: o log diz `Failed to proxy`
   para `localhost:3999`, com `EADDRNOTAVAIL` e `ECONNREFUSED ::1`. O proxy interno do Next
   chama `localhost`. Suba com `HOSTNAME=0.0.0.0`, que é o padrão da VPS
2. `unset CRON_SECRET` **não** testa a ausência. `pnpm build` copia o `.env` para
   `.next/standalone/`, e o `server.js` o recarrega. Para a ausência, exporte a variável
   **vazia**: o `@next/env` não sobrescreve variável já definida

### O que ficou

- as rotas `processar` do ChatPro e dos parceiros seguem sem limite de requisição (Item 39)
- confirmar em produção depois do deploy: `curl …/api/mercadopago/processar` deve dar `401`,
  não `307`
- ⚠️ **LIMITE CONHECIDO DO GUARDA, não implementado:** ele deriva as URLs **do `filas.yml`**.
  Rota chamada por **serviço externo** (o servidor do ChatPro, o da Greens, o Mercado Pago, a
  nuvem do Inngest em `/api/inngest`) não aparece no `filas.yml` e **não é coberta**. Hoje
  essas rotas são públicas por outras entradas do `middleware.ts` (`/api/chatpro(.*)`,
  `/api/parceiros(.*)`, `/api/webhooks(.*)`, `/api/inngest(.*)`). Duas delas têm caso por nome
  (`/api/chatpro` em `cadastro-por-link-abre-sem-conta`, `/api/parceiros` em
  `handoff-do-parceiro-e-assinado-e-idempotente`). **`/api/webhooks` e `/api/inngest` não têm
  nenhum**, e é por `/api/webhooks(.*)` que o webhook do Mercado Pago passa. Uma rota nova de
  máquina fora desses prefixos nasceria descoberta. Cobrir
  exigiria outra fonte de verdade, como uma lista declarada das rotas de máquina, e isso fica
  para decisão própria

---

## 🔴 Item 40 — CATALOGADO, 23/09/2026: o job `liberarReservasExpiradas` do Inngest nunca rodou em produção

**Status:** catalogado, **não corrigido**. Achado ao desenhar a Fase 3 do Mercado Pago, não é
consequência dela.

### O que o código promete

`lib/integrations/inngest/functions.ts:440` declara `liberarReservasExpiradas` com
`triggers: [{ cron: '*/5 * * * *' }]` (`:444`). A cada 5 min ele deveria buscar consultas
`reservada` com `expiraEm` vencido (`:467`), cancelá-las (`:479`, `status: 'cancelada'`) e
avisar o paciente por e-mail. É registrado em `app/api/inngest/route.ts:25`.

### O que produção mostra

**7 reservas `reservada` e vencidas desde 10/09/2026**, travando esses horários: o índice único
de horários trata `reservada` como ativa, então nenhum outro paciente consegue pegá-los.
⚠️ **Esta medição é da sessão da Fase 2/3 em 23/09/2026** (registrada em
`lib/mercadopago/notificacoes.ts:26-27` e no comentário de `ignorarPrazo`,
`lib/agendamento/confirmar-consulta-paga.ts:42-50`). **Não foi refeita nesta sessão**, e o
número precisa ser remedido antes de qualquer decisão.

### Causa — HIPÓTESE, não medida

- ~~`INNGEST_EVENT_KEY` e `INNGEST_SIGNING_KEY` existem em `lib/env.ts:228-229` e **não estão**
  em nenhuma linha `gravar` do `.github/workflows/deploy.yml`, então não chegam ao processo
  (mesma classe de `o-segredo-cadastrado-chega-ao-servidor`, que não varre
  `lib/integrations/inngest`)~~ — 🔴 **RETRATADO em 23/09/2026, ver abaixo**
- o comentário de `app/api/inngest/route.ts` diz _"Em prod: configurar URL no painel Inngest"_:
  não há registro de que isso tenha sido feito

A confirmar **antes** de corrigir: o painel do Inngest tem o app sincronizado? `/api/inngest`
responde em produção? Sem essas duas respostas, não se sabe se falta chave, registro, ou os dois.

#### 🔴 RETRATAÇÃO, 23/09/2026 — as chaves `INNGEST_*` EXISTEM em produção

A primeira hipótese acima estava errada. O log do deploy do PR #122 (run `35917760262`, passo
"Reiniciar Servidor (PM2)") lista o que `preservar-ambiente-do-pm2.mjs` recuperou do processo
em produção, e as duas estão lá:

```
INNGEST_EVENT_KEY  ← ambiente do processo
INNGEST_SIGNING_KEY  ← ambiente do processo
```

**O erro de raciocínio:** tratei "não está na lista `gravar`" como "não chega ao processo". O
`deploy.yml` escreve a lista `gravar` **e** preserva o ambiente que o PM2 já tinha. Uma
variável fora da lista pode existir, herdada de um `pm2 start` antigo. É a mesma classe do
achado de 22/09 (_"sintoma funcionando não prova schema"_), invertida: ler o `deploy.yml` diz o
que ele ESCREVE, e só o processo diz o que EXISTE.

**O que vale agora:** a causa real **não foi medida**. Sobra a segunda hipótese (o app nunca
foi sincronizado no painel do Inngest) e outras ainda não levantadas, como chave de outro
ambiente ou `/api/inngest` recusando a assinatura. As duas perguntas do parágrafo acima
continuam sendo o próximo passo, agora sem a pista falsa.

### 🔴 Os modos de erro — por que NÃO basta "ligar"

1. **O mesmo endpoint serve outras 4 funções** (`verificarValidadeDocumentos`,
   `verificarRecompraMedicamentos`, `enviarEmailRecompraAgendado`, `digestDiarioAdmin`). Elas
   também nunca rodaram. Ligar o Inngest liga **as cinco**, e a primeira execução dispara de
   uma vez o acúmulo de semanas, com e-mail para pessoas reais. É o aviso do achado de 10/09
   (_"NÃO LIGAR os 3 crons antigos sem medir antes"_, `docs/03`) por outro caminho.
2. **A corrida com o pagamento.** Com o job rodando, uma reserva com PIX ainda pagável ou cartão
   `em_processamento` seria cancelada e o horário iria para outro paciente, e aí o pagamento
   aprovado cai em `pago_sem_horario` (`lib/mercadopago/notificacoes.ts:288`). A trava
   `consultas.pix_valido_ate` existe desde a migration `0047`; **o job ainda não a lê**, e
   também não pula `em_processamento`. Esse é o pendente da Fase 4 registrado no commit
   `2214e76`.
3. As 7 reservas vencidas receberiam agora o e-mail de "sua reserva expirou", **duas semanas
   depois**.

### O que já contorna, sem corrigir

- o webhook do Mercado Pago confirma reserva vencida quando a API diz `approved`
  (`ignorarPrazo`, `lib/agendamento/confirmar-consulta-paga.ts:102`). Se continua `reservada`,
  ninguém pegou o horário, e o paciente pagou
- a conciliação da Fase 3 roda pelo `filas.yml` (GitHub Actions), **não** pelo Inngest

### Perigo de mexer — medido pela leitura do código

- **em produção:** sim. Qualquer correção muda comportamento visível (cancelamentos + e-mails)
- **pontos tocados:** `deploy.yml` (chaves), painel do Inngest, `functions.ts` (a trava do
  pagamento, Fase 4), mais uma decisão sobre as outras 4 funções
- **teste antes/depois:** não existe teste de integração do job
- **custo de deixar:** horários travados continuam indisponíveis, e cada reserva abandonada
  nova soma mais um

**Decisão do dono**, a pedir: corrigir junto da Fase 4, com o job lendo `pix_valido_ate` e
pulando `em_processamento`, e primeiro remedir as 7 e o volume das outras 4 funções.

---

## ✅ Item 39 — ENTREGUE em 23/09/2026: webhook do Mercado Pago, fila, conciliação (Parte 2, Fase 3)

**Em produção desde 23/09/2026:** PR #122, merge `d5464fd`, deploy `35917760262` (portão final:
_"produção está servindo ESTE build, e a home responde 200"_). ~~Ainda não commitado nem em
produção.~~ 🔴 **O processador saiu exigindo login** e ficou fora do ar até a correção do
[Item 41](#-item-41--corrigido-em-23092026-o-processador-do-mercado-pago-exigia-login-em-produção).

### O que existe

| peça                                       | onde                                                                                | o que faz                                                                                                                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rota nova `POST /api/webhooks/mercadopago` | `app/api/webhooks/mercadopago/route.ts:38`                                          | limita (`:39`), confere a assinatura com o `data.id` **da URL** (`:63`), ignora corpo divergente, enfileira (`:86`), responde, e processa em `after()` (`:96`) |
| rota nova `GET /api/mercadopago/processar` | `app/api/mercadopago/processar/route.ts:38`                                         | limite de 10/min (`:36`), 503 sem `CRON_SECRET`, 401 com o errado (`:62`), conciliação + lote de 25                                                            |
| assinatura                                 | `lib/mercadopago/assinatura-webhook.ts:84`                                          | HMAC-SHA256 de `id:…;request-id:…;ts:…;`, `timingSafeEqual` (`:108`), recusa tudo sem segredo                                                                  |
| fila e processamento                       | `lib/mercadopago/notificacoes.ts`                                                   | enfileirar **reenfileira** (`:74`), reserva atômica `FOR UPDATE SKIP LOCKED` (`:123`), relê a API e confere id/referência/valor (`:259`)                       |
| variável nova `MERCADOPAGO_WEBHOOK_SECRET` | `lib/env.ts:151`, `deploy.yml:313`                                                  | a assinatura secreta do painel de Webhooks, que **não é** o `client_secret`                                                                                    |
| passo novo no cron                         | `.github/workflows/filas.yml:80`                                                    | chama o processador a cada 5 min, com `if: always()`                                                                                                           |
| ajustes                                    | `lib/mercadopago/conta.ts:166`, `lib/agendamento/confirmar-consulta-paga.ts:50,102` | `userId: null` quando não há ator; `ignorarPrazo` só para o webhook com pagamento aprovado                                                                     |

### Provas

- **guarda novo** `o-webhook-do-mercado-pago-nao-e-forjavel`: 36 casos, 14 sabotagens
- **guardas estendidos:** `as-rotas-sensiveis-tem-limite` (19 casos, com as duas rotas) e
  `o-segredo-cadastrado-chega-ao-servidor` (33 casos, com as duas pastas de rota). O de limite
  achou que o `processar` não tinha limite, e ele ganhou um
- **integração** `__tests__/integracao/o-webhook-do-mercado-pago-confirma-o-que-a-api-diz.test.ts`:
  13 casos contra Postgres real, 12 sabotagens. Duas notificações do mesmo pagamento, reenvio
  idêntico, assinatura forjada (3 variantes + manifesto sem id), corpo adulterado, divergência
  de valor/referência, conciliação. Uma sabotagem achou um caso descoberto: corpo **sem**
  `data.id` + assinatura de manifesto sem id
- `pnpm test` 1478/1478 · integração 72/72 · `tsc` 0 · baseline verde

### O que ficou

- 🔴 **antes do deploy:** cadastrar o secret `MERCADOPAGO_WEBHOOK_SECRET` e a URL do webhook no
  painel do MP. Sem o secret, o webhook recusa tudo e só a conciliação confirma (até 5 min)
- a janela da conciliação é de 2 min a 24 h: PIX pago depois de 24 h só se confirma por
  notificação
- o limite do `processar` é por processo (Item 31)
- as rotas `processar` do ChatPro e dos parceiros continuam **sem** limite (fora do escopo)
- a Fase 4 (job de expiração respeitar `pix_valido_ate` e `em_processamento`) depende do Item 40

---

## ⏳ Item 38 — PENDENTE, 22/09/2026: ligar o bloqueio de agendamento do Mercado Pago

**Status:** o código está pronto e **desligado**. Ligar é trocar um secret — e ligar cedo
derruba o agendamento da plataforma inteira.

### O que já existe

`reservarConsulta` (`app/(public)/_actions/agendamento.ts`) recusa a reserva quando o médico
não tem conta do Mercado Pago conectada. A checagem usa `podeAgendarCom`
(`lib/mercadopago/conta.ts`), que **não decifra nada** — só confere que existe linha sem
`desconectadoEm`.

### 🔴 Por que está desligado

A tabela `medicos_mercadopago_conta` está **vazia** (medido em produção em 22/09/2026, logo
depois da migration `0046`). Com o bloqueio ativo e a tabela vazia, **nenhum paciente consegue
agendar com nenhum médico** — não é degradação parcial, é a agenda inteira parada no mesmo
segundo.

O interruptor é `MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO`, e o padrão é `inativo`.

### O passo manual ANTES de ligar — nenhum código confere isto

| #   | o quê                                                      | como conferir                                                                                                                                                                                     |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | o `redirect_uri` está cadastrado no painel do Mercado Pago | `https://be4hope.org/api/medico/mercadopago/callback`, idêntico. A doc do MP exige URL estática                                                                                                   |
| 2   | **todo médico ativo já conectou a conta**                  | `select count(*) from medicos m where not exists (select 1 from medicos_mercadopago_conta c where c.medico_id = m.id and c.desconectado_em is null and c.deleted_at is null)` — precisa dar **0** |
| 3   | o log de produção parou de acusar médico sem conta         | `grep 'sem conta conectada no agendamento' error.log` na VPS                                                                                                                                      |
| 4   | só então                                                   | `gh secret set MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO` com o valor `ativo`, e redeploy                                                                                                            |

⚠️ **O passo 3 é o que torna isto mensurável em vez de adivinhado.** Com a flag desligada, o
agendamento registra `console.warn` a cada reserva de médico sem conta — sem bloquear ninguém.
É por ali que se sabe quantos faltam, em vez de descobrir pelo paciente.

### O que NÃO fazer

⛔ **Não ligar a flag junto do merge.** Merge e ativação são dois eventos, e é o interruptor
que permite separá-los — foi para isso que ele existe.

⛔ **Não "resolver" removendo a checagem.** Sem ela, a reserva nasce com um pagamento que
ninguém consegue cobrar, e o paciente descobre na etapa de pagamento com o horário já
bloqueado.

### Desligar de volta

Apagar o secret (ou trocar para `inativo`) e redeployar. **Não exige reverter código** — é a
mesma propriedade de `PARCEIRO_TRANSFERENCIA_ATIVA`, e é de propósito.

### Relacionado

- `docs/adr/ADR-0024` — a cifra dos tokens, e §7 sobre perder a chave
- `lib/env.ts` — `MERCADOPAGO_BLOQUEIO_AGENDAMENTO_ATIVO`, com o mesmo aviso
- `.github/workflows/deploy.yml` — a linha `gravar` e o comentário

---

## ✅ Item 37 — RESOLVIDO em 12/09/2026: seis defeitos que quebravam o fluxo da Greens de ponta a ponta

**Achados pelo dono testando em produção**, mais três que apareceram ao medir os 4 fluxos
contra o código. Nenhum tinha erro visível: todos falhavam em silêncio ou com mensagem que
apontava para o lugar errado.

### 1. 🔴 O Firefox não conseguia se cadastrar

`captcha_missing_token` (400) depois de o Turnstile receber `401` do Cloudflare. **Causa:** o
Total Cookie Protection do Firefox particiona o armazenamento de um iframe de terceiro, e o
widget sem armazenamento não emite token.

⚠️ **A cura é a instância de produção do Clerk, e a doc deles prova:** em desenvolvimento o
FAPI fica em `accounts.dev`, que é **cross-site** com `be4hope.org`; em produção fica num
**subdomínio** (`clerk.be4hope.org`) via CNAME, e aí o cookie é primeira-parte. Fica no
[Item 36](#) — os dois trabalhos são um só.

### 2. 🔴 O cadastro virava falha DEPOIS de gravar tudo

Protocolo SOL-000046. Conta criada, sessão ativa, ficha gravada, link de uso único consumido —
e a tela dizendo _"Não conseguimos concluir seu cadastro"_. Sem volta possível, porque o token
é de uso único (ADR-0016 D-04) e a ADR não previu a gravação falhar depois dele.

**E o log não ajudava:** `app/_actions/cadastro-por-link.ts` registrava só `erro.name`, que num
`new Error(…)` é sempre a string `'Error'`. Produção escreveu, literalmente,
`{ erro: 'Error' }`.

**Corrigido:** `cadastroGravado` vira `true` quando a transação commita, e o catch devolve `ok`
a partir daí. O log ganhou `etapa` (rótulo nosso, nunca entrada do usuário) e `em:` com a
primeira linha do **stack** — nunca `erro.message`, que cita o valor que violou a restrição, e
as colunas aqui são CPF e telefone.

### 3. 🔴 Os DOIS destinos pós-cadastro levavam a 404

```
DESTINOS.agendamento  = '/agendamento'            → o disco só tem /paciente/agendamento
DESTINOS.teleconsulta = '/paciente/teleconsulta'  → só existe /paciente/teleconsulta/[roomId]
```

Entre os dois, **quase todo paciente da Greens**: `agendamento` é o passo 4 do fluxo 2 e o
passo 3 do fluxo 4; `teleconsulta` é o paciente sem pendência, a recompra do fluxo 3.

⚠️ **E o guarda existente CONGELAVA o defeito.** `o-destino-do-paciente-segue-o-que-falta`
comparava os destinos com uma **lista fixa que continha os dois 404** — ficava verde enquanto o
paciente caía em 404, e ficou vermelho quando o defeito foi corrigido. Causa de classe: lista
paralela. Retificado, e o caso anterior fica escrito no arquivo.

### 4. 🔴 A tela da ANVISA pedia documento que o parceiro já mandou

`app/(paciente)/_actions/anvisa.ts` criava o checklist com `enviado: false` **fixo** e nunca
consultava a tabela `documentos`. A tela anterior tinha prometido o contrário: _"Os documentos
que você já enviou vêm junto"_.

**Causa de fundo: três vocabulários para o mesmo documento.** `documento_identidade` (fluxo),
`rg` (enum da coluna) e `rg_paciente` (inventado no checklist, e que **não existe** no enum).
Nenhum erro em runtime — a coluna é JSON e aceita qualquer string.

### 5. 🔴 O login não voltava ao cadastro — e podia levar para fora

O botão _"Entrar na minha conta"_ apontava para `/entrar` sem `redirect_url`; o efeito de sessão
viva fazia `router.replace('/redirect')` fixo. O paciente da recompra ia parar no painel, com o
token perdido.

⚠️ **E corrigir isso abriu um terceiro, que já existia:** `redirect_url` vem da URL, logo é
entrada do usuário — `?redirect_url=https://site-falso.com` leva o paciente para fora **depois**
de ele digitar a senha (OWASP A01). `lib/auth/destino-interno.ts` filtra por **origem**, nunca
por prefixo.

### 6. 🔴 Uma aba aberta durante o deploy quebrava

`Failed to find Server Action "008065c0…"` — os ids são hashes gerados no build. A tela mandava
_"tentar novamente"_, e tentar não resolve: só recarregar. Corrigido com `deploymentId` =
`github.sha`, **nas duas pontas** (build e runtime).

### E duas telas órfãs foram ligadas

- **`/paciente/privacidade`** entrou no menu. Existia desde 11/09 e nenhuma navegação levava a
  ela. A LGPD art. 8º §5º exige que revogar seja _"por procedimento gratuito e FACILITADO"_.
- **O perfil** passou a mostrar o checklist de documentos por tipo, em vez de só _"nenhum
  documento enviado ainda"_.

### O que ficou de fora, e por quê

| item                                       | por quê                                                                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/acesso` continua órfã                    | é a P4 do fluxo 3, e o `/cadastro/[token]` já detecta conta existente **dinamicamente**, o que é melhor que dois botões cegos. Ligar ou aposentar é **decisão do dono** |
| consentimento pós-fluxo (fluxo 4, passo 5) | o consentimento é colhido no cadastro. Pedir de novo depois da ANVISA é desenho de produto, não correção                                                                |
| `laudo_medico` sem tipo no enum            | exige migration, e migration não entra de passagem                                                                                                                      |
| notificação de ANVISA **rejeitada**        | só `aprovado` notifica hoje; rejeitado tem só Pusher efêmero                                                                                                            |
| WhatsApp na aprovação                      | Item 29 — sem doc do endpoint                                                                                                                                           |

**Guardas novos:** `o-cadastro-feito-nao-vira-falha` (10), `o-painel-diz-o-que-falta` (10),
`todo-destino-e-uma-rota-que-existe` (8), `a-anvisa-aproveita-o-que-ja-chegou` (8),
`o-login-nao-leva-para-fora` (18), `a-aba-aberta-sobrevive-ao-deploy` (8),
`o-csp-conhece-o-captcha-do-clerk` (7). Medido: **1104 casos em 42 guardas**.

---

## 🔴 Item 36 — CATALOGADO em 11/09/2026: produção autentica por uma instância de DESENVOLVIMENTO do Clerk

> ⚠️ **REMEDIÇÃO, 22/09/2026 — continua valendo, e agora com o efeito isolado.**
>
> O `.env` de produção tem **`pk_test_` / `sk_test_`**, e **zero** ocorrência de `live`. O código
> de verificação sai de `notifications@accounts.dev` com **`[Development]`** no assunto.
>
> 🔴 **Os logs do Clerk mostram que TODOS os códigos foram enviados** — o defeito não é de envio,
> é de **entrega**: o domínio `accounts.dev` é compartilhado, e a reputação dele não é nossa.
>
> **O que isso simplifica:** os usuários dessa instância são **todos de teste**; não há paciente
> real. Migrar para instância de produção com domínio próprio **não exige migração de conta** —
> é configuração, não mudança de dado.

**Achado pela Greens**, testando o handoff em produção. Ao clicar em "Criar conta e continuar",
a tela diz _"Não conseguimos concluir agora"_ e o devtools mostra:

```
POST https://relative-blowfish-96.clerk.accounts.dev/v1/client/sign_ups?…   → 400
GET  https://challenges.cloudflare.com/cdn-cgi/challenge-platform/…         → 401
```

### O diagnóstico, medido — não inferido

Eles suspeitaram pelo `pk_test` do `.env.example`. **Perguntei à própria instância**
(`GET /v1/environment`), e ela responde por escrito:

| campo                                      | valor             |
| ------------------------------------------ | ----------------- |
| `display_config.instance_environment_type` | **`development`** |
| `user_settings.sign_up.captcha_enabled`    | `true`            |
| `display_config.captcha_provider`          | `turnstile`       |
| `display_config.captcha_widget_type`       | `smart`           |

E reproduzi o `400` fora do navegador, contra a mesma instância. São **dois** códigos, na ordem
em que o navegador os encontra:

| #   | `errors[].code`                     | quando                                                                      |
| --- | ----------------------------------- | --------------------------------------------------------------------------- |
| 1   | `dev_browser_unauthenticated` (401) | sem o cookie do dev browser — **só existe em instância de desenvolvimento** |
| 2   | `captcha_missing_token` (400)       | com o dev browser resolvido, que é o caso do paciente                       |

🔴 **`captcha_missing_token` fecha o circuito com o `401` que a Greens viu.** O
`GET challenges.cloudflare.com → 401` é o widget do Turnstile falhando; widget que falha não
produz token; sem token, o `sign_ups` devolve 400 com esse código. As duas linhas do devtools
são o mesmo evento, em dois atos.

⚠️ **O limite da medição, dito por escrito:** um `curl` nunca resolve um Turnstile, então o
`captcha_missing_token` do meu teste é esperado _por construção_. O que ele prova é que **a bot
protection está ligada e é obrigatória no cadastro**. O `401` da Greens é que prova o resto.

### O que NÃO é a causa — conferido antes de acusar

- **O `<div id="clerk-captcha" />` existe nos dois fluxos:**
  `app/(auth)/registrar-se/[[...sign-up]]/page.tsx:582` e
  `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx:1130`.
  A doc do Clerk diz que, sem ele, o SDK _"transparently fall back to an invisible widget"_ —
  que bloqueia sem dar ao usuário chance de provar que é humano. Não é o nosso caso.
- **O CSP não bloqueia nada:** `next.config.ts:105` emite
  `Content-Security-Policy-Report-Only`, não `Content-Security-Policy`. Que
  `challenges.cloudflare.com` não esteja listado gera ruído no console e nada mais.
  🔴 Retrato minha leitura anterior — eu disse "o CSP já permite os domínios do Clerk", o que
  estava certo pelo motivo errado. Ele não permite nem proíbe; **observa**.

### 🔴 `clerk.be4hope.org` está no CSP e NÃO EXISTE

```
$ getent hosts clerk.be4hope.org
  (nada — não resolve)
```

O domínio entrou em `next.config.ts:108,112` como preparação para a instância de produção, e
**ela nunca foi criada**. Produção autentica hoje por uma instância de desenvolvimento, com bot
protection de desenvolvimento, num domínio real e com tráfego real.

### O perigo de mexer, medido

| eixo                                 | medição                                                                                                                                                                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| está em produção?                    | **sim** — é o login e o cadastro de todo mundo                                                                                                                                                                                                       |
| quantos pontos de chamada            | a chave pública é substituída **no build** (`deploy.yml:73`); o guarda `next-public-existe-no-build` cobre a ausência, não a troca                                                                                                                   |
| existe teste que prove antes/depois? | **não**, e não pode haver: instância do Clerk é infraestrutura externa                                                                                                                                                                               |
| o que quebra em quem consome hoje    | 🔴 **risco aberto: não medi se a base de usuários atravessa de uma instância para a outra.** A doc de deploy do Clerk é silenciosa sobre migração de usuários — fala de SSO, integrações e paths que _não_ são copiados, e não diz nada sobre contas |
| custo de fazer                       | domínio próprio + registros DNS + certificados. A doc do Clerk: _"It can take up to 48hrs for DNS records to fully propagate"_                                                                                                                       |
| custo de deixar                      | cadastro falhando de forma intermitente em produção, sem mensagem que ajude o paciente                                                                                                                                                               |

### O que falta decidir — e é do dono, não meu

1. **Criar a instância de produção do Clerk?** É decisão de negócio (custo do plano, janela de
   DNS, e o risco da base de usuários).
2. **Antes disso: medir se os usuários existentes sobrevivem à troca.** Enquanto não estiver
   medido, isto é risco aberto — não detalhe de configuração.

**Fonte:** doc de erros do Clerk (`dev_browser_unauthenticated`, 401, _"Unable to authenticate
this browser for your development instance"_) e o guia de bot protection em fluxo customizado.
Registrado no §12 do `CONTRATO-S2-BEHEMP-PARA-GREENS.md`, que era a resposta que eles pediram.

---

## ✅ Item 35 — RESOLVIDO em 11/09/2026: a confirmação do e-mail tinha dois becos

**Achado pelo dono testando em produção**, horas antes da apresentação: _"a validação do código
de e-mail não está funcionando… o código chega mas não é válido"_.

**O sintoma era um; as causas, duas** — e nenhuma no código de verificação.

### 1. "Reenviar código" não dava retorno nenhum

`formulario-de-cadastro.tsx`, `reenviarCodigo()`: chamava
`prepareEmailAddressVerification` e **não mudava nada na tela**. Quem clica e não vê resposta
clica de novo — e **cada reenvio invalida o código anterior** (comportamento do Clerk). O
paciente então digita o código do primeiro e-mail e recebe _"código incorreto"_.

A mensagem aponta para o lugar errado: o código estava certo, só era de um e-mail que deixou
de valer.

**Corrigido:** o reenvio **limpa o campo** (o que estava digitado é o código morto), mostra
_"Enviamos um código novo. O anterior deixou de valer"_, desabilita o botão enquanto envia e
recusa reentrada.

### 2. "Corrigir meus dados" virava saída

O botão volta para a etapa de dados — e enviar de novo chamava `signUp.create` com um cadastro
**já pendente**. O Clerk responde `form_identifier_exists`, e a tela dizia **"Já existe uma
conta com este e-mail. Use a opção de entrar."** para alguém que estava no meio do próprio
cadastro e **não tem conta**. O caminho de correção mandava a pessoa embora.

**Corrigido:** quando o cadastro pendente é do mesmo e-mail, a tela **reenvia o código e
segue** em vez de recriar. A mensagem de "já existe conta" continua — ela é verdadeira para
quem realmente tem.

🔴 **O que as duas têm em comum:** a tela responsabilizava o paciente por um estado que ela
própria criou. É a classe de erro que mais custa num funil, porque a pessoa acredita que errou
e desiste.

## 🔴 Item 34 — o aviso `consentimento_revogado` depende do lado da Greens, não só do nosso

**Prometido à Greens em 10/09** (proposta deles, aceita por mim) e **não implementado**. O
diagnóstico mudou em 11/09/2026, depois de eu ler o código deles.

### 🔴 RETRATAÇÃO — a primeira versão deste item errou duas coisas

Eu escrevi que o obstáculo era **só o nosso índice** e que um evento recusado ficaria **"em
retry para sempre"**. As duas estão erradas, e a medição está no código:

| eu escrevi                         | o que o código mostra                                                                                      |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| o obstáculo é o nosso índice único | **o validator deles rejeita o tipo antes disso**                                                           |
| um 400 ficaria em retry eterno     | `lib/parceiros/enviador.ts:40` — `VALE_TENTAR_DE_NOVO` não inclui 400; o evento vira **falhado**, não loop |

**O bloqueio real**, medido em
`greens-corp-backend/src/modules/parceiros/behemp/behempValidator.ts`:

```ts
tipo: z.enum(["receita_emitida", "anvisa_aprovada"]),
```

Um `consentimento_revogado` é recusado com **400** na porta deles. Implementar do nosso lado
antes que eles aceitem o tipo é construir contra um contrato que não existe — e o resultado
seria um evento falhado por paciente que revoga, sem ninguém do outro lado sabendo.

### O que o nosso lado ainda precisa, quando o deles aceitar

1. `consentimento_revogado` no enum `parceiro_evento_tipo` (migration de enum).
2. **Um caminho que permita mais de um aviso por solicitação.** O índice
   `uniqueIndex(parceiro, tipo, solicitacaoId)` faz um por solicitação, para sempre — e quem
   revoga, reconsente e revoga de novo geraria **um**. O segundo seria engolido pelo
   `onConflictDoNothing`, que existe de propósito para `receita_emitida`.

   **Recomendação: tabela própria**, com o seu próprio índice. Não toca na idempotência de
   `receita_emitida`, que decide **gateway e desconto** do lado deles — e essa é exatamente a
   peça que não se mexe por causa de outra.

### ⚠️ O que vale ENQUANTO isso não existe

Revogar impede envios **futuros** — a P5 lê o consentimento vigente a cada envio, e há guarda
provando. O que já foi enviado continua com quem recebeu. A tela `/paciente/privacidade` diz
isso ao paciente, em vez de prometer o que o sistema não cumpre.

**Bloqueado por:** a Greens aceitar o tipo no `atualizacaoBehempValidator`. Está no prompt que
vai para eles.

## ✅ Item 33 — RESOLVIDO em 11/09/2026: a declaração virou coluna

**Achado em 11/09/2026, ao plugar a P2.** `app/_actions/cadastro-por-link.ts:298-299` grava
`declarouTerAutorizacaoAnvisa` e `declarouTerReceitaMedica` **apenas dentro de
`registrarAuditoria`**. Não existe coluna para nenhuma das duas — nem em
`solicitacoes_cadastro`, nem em `pacientes`. Log de auditoria não é fonte de leitura de
produto.

**O que isso custou:** o comentário de `components/paciente/AvisoDaProcuracao.tsx` afirmava que
o cadastro gravava a declaração. Afirmação falsa, que sobreviveu porque **o componente não era
renderizado por tela nenhuma** — ninguém a exercitou. Retratado no próprio arquivo em 11/09.

**Como ficou funcionando sem isso:** o aviso passou a sair do **estado real** —
`autorizacoes_anvisa` sem linha `aprovado` dentro da validade. É informação melhor: descreve o
que existe, em vez do que o paciente lembrou de responder.

**O que ainda se perde sem a coluna:** não conseguimos deixar de repetir a pergunta em outras
telas, que era o propósito original da declaração. E o fluxo BeHemp 1 continua sem saber
distinguir _"declarou que não tem"_ de _"nunca respondeu"_.

**Corrigido em 11/09/2026**, com autorização escrita em `.claude/autorizacoes.txt`. Migration
`0035_huge_sugar_man.sql`: dois `ADD COLUMN … boolean` nullable — o Postgres 11+ faz isso sem
reescrever a tabela.

**E ao corrigir apareceu um segundo defeito, de acoplamento:** uma flag só
(`jaDeclarouSobreAnvisa`) decidia **as duas** perguntas. Quem vinha do formulário da Greens não
era perguntado sobre **receita** — e lá ninguém pergunta sobre receita. O destino saía errado
por isso, e era invisível porque a flag tinha nome de ANVISA. Agora cada pergunta olha a
própria declaração.

**Três estados, e o terceiro é o motivo de a coluna existir:** `true` = tem · `false` =
declarou que **não** tem · `null` = **nunca respondeu**. A tela usa `!== null`, não
`=== true` — quem respondeu "não tenho" também já respondeu, e repetir a pergunta a ele é o
mesmo defeito que o dono apontou em 10/09.

⚠️ **E o aviso da procuração continua NÃO usando a declaração.** Ela diz o que o paciente
respondeu; quem decide se falta a autorização é `autorizacoes_anvisa` — o que **existe**, não o
que ele lembrou. Trocar uma pela outra faria o aviso sumir para quem declarou ter e nunca
enviou. Há caso de guarda exatamente para isso.

## 🔴 Item 32 — CONCLUÍDO em 11/09/2026: a tela do consentimento

**O diagnóstico, que só apareceu ao ligar a P5:** `lib/parceiros/transferencia-de-cadastro.ts`
recebia `finalidadesConsentidas: Finalidade[]` por parâmetro. A regra estava certa e o dado
que ela julgava vinha de quem chama — um consentimento **alegado**, não lido.

**Onde ficou:**

| peça                                                           | o quê                                              |
| -------------------------------------------------------------- | -------------------------------------------------- |
| `db/schema/consentimentos.ts` + `db/migrations/0034_*.sql`     | uma linha por finalidade; aditiva, sem `DROP`      |
| `lib/parceiros/consentimento-registrado.ts`                    | ler / conceder / revogar — sem auth, sem `next/*`  |
| `app/(paciente)/_actions/consentimento.ts`                     | paciente vem da **sessão**, nunca do formulário    |
| `components/paciente/ConsentimentoDoCompartilhamento.tsx`      | o texto integral, as 3 caixas, o efeito de recusar |
| `app/(paciente)/paciente/privacidade/`                         | ver e **revogar** (art. 8º §5º)                    |
| `app/(auth)/cadastro/[token]/…/formulario-de-cadastro.tsx:+18` | o bloco no cadastro por link                       |
| `app/_actions/cadastro-por-link.ts:+40`                        | grava pelo mesmo caminho, sem `insert` próprio     |

**O que ficou de fora, e por quê:**

- 🟠 **O consentimento não aparece no formulário completo (P3)** — só no cadastro por link e no
  painel. Quem chega pela P3 ainda não tem onde consentir na própria tela; ele consegue pelo
  `/paciente/privacidade` depois. **Fica como pendência.**
- 🟠 **Revogar não avisa a Greens.** O S1 `consentimento_revogado` foi aceito em conversa com o
  lado deles e **ainda não foi implementado** — hoje a revogação impede envios **futuros**, e
  o que já foi continua lá. A tela diz isso ao paciente, em vez de prometer o que não cumpre.

## Item 1 — 🔴 A migration estreia contra a produção, sem ensaio

Achado ao ler o pipeline para dimensionar o custo de ~10 tabelas novas. Não veio de
relato: veio da leitura do workflow.

### O diagnóstico

O único workflow do repositório é o de deploy, e ele aplica migration por SSH no
servidor de produção:

```yaml
# .github/workflows/deploy.yml:74
# Aplica eventuais migrações do banco
pnpm db:migrate
```

A ordem é `rsync` → `pnpm install --prod` → `cp .env` → **`db:migrate`** →
`cp` estáticos → `pm2 restart`. A ordem em si está certa (migration antes do
restart), mas:

- não existe ensaio em banco descartável antes
- não existe `--dry-run`, nem rollback
- roda numa t2.small de 2 GB (DT-006), com swap **não persistido no `/etc/fstab`**

E há uma armadilha específica de PostgreSQL que este fluxo aciona:

```
ALTER TYPE "user_role" ADD VALUE 'gerente';
```

O valor novo de um enum **não pode ser usado na mesma transaction em que foi
criado**. Se o `drizzle-kit migrate` embrulhar tudo numa transaction e a mesma
migration já referenciar `'gerente'` (numa `DEFAULT`, num `CHECK` ou numa tabela
nova), ela falha — em produção, no meio do deploy.

### Como corrigir

1. Ensaiar toda migration deste domínio em banco descartável (branch do Neon ou
   Postgres local) e anexar o resultado ao item.
2. **Separar em duas migrations:** uma só com os `ADD VALUE`, outra que os usa.
3. Confirmar se o swap está no `/etc/fstab` antes de qualquer deploy que traga
   migration (DT-006 diz que **não está**).

⚠️ **O que NÃO fazer:** tirar `db:migrate` do deploy. Sem ele a migration passa a
depender de alguém lembrar — e migration esquecida com código novo no ar é pior que
migration arriscada.

### O guarda

Nenhum. Este é risco de processo, não de código — a mitigação é o ensaio
(ver `docs/03-CHECKLIST-MESTRE.md`), não um teste.

---

---

## Item 2 — 🔴 O tipo do role está escrito à mão em 8 lugares, e um deles é cast

Achado ao dimensionar o custo de acrescentar 4 papéis ao `userRoleEnum`.

### O diagnóstico

O enum tem 3 valores:

```ts
// db/schema/enums.ts:9
export const userRoleEnum = pgEnum('user_role', ['admin', 'medico', 'paciente']);
```

E oito lugares repetem a união **sem derivar dela**:

```
lib/auth/permissions.ts:16          export type Role = 'admin' | 'medico' | 'paciente'
types/globals.d.ts:11               role?: 'admin' | 'medico' | 'paciente'
app/(auth)/redirect/page.tsx:111    as 'admin' | 'medico' | 'paciente'
app/(admin)/_actions/usuarios.ts:66     params.role as 'admin' | 'medico' | 'paciente'
app/(admin)/_actions/usuarios.ts:216    novaRole: 'admin' | 'medico' | 'paciente'
app/api/webhooks/clerk/route.ts:196     role as 'admin' | 'medico' | 'paciente'
db/sync-clerk.ts:36                 public_metadata: { role?: ... }
scripts/fix-user-role.ts:21         as ... | undefined
```

O mais perigoso:

```ts
// app/(admin)/_actions/usuarios.ts:66
condicoes.push(eq(users.role, params.role as 'admin' | 'medico' | 'paciente'));
```

É **cast**, não validação. `params.role` chega de fora como `string`. Depois do
`ALTER TYPE`, um filtro por `'gerente'` compila, roda, e o tipo declara que aquele
valor não existe — divergência que compila e não acusa.

### Como corrigir

```ts
// lib/auth/permissions.ts
export type Role = (typeof userRoleEnum.enumValues)[number];
```

Os outros sete importam esse tipo. Em `usuarios.ts:66`, trocar o cast por validação
Zod contra `userRoleEnum.enumValues`.

⚠️ **O que NÃO fazer:** acrescentar os 4 literais novos nas 8 uniões. Funciona hoje
e envelhece no quinto papel — é listar em vez de derivar.

### O guarda

`roleDerivaDoEnum` — quebra o build se aparecer união literal de role escrita à mão
em qualquer `.ts`/`.tsx`. Derivado de `userRoleEnum.enumValues`.

- **teste de vacuidade:** precisa provar que enxerga ≥7 valores após o `ALTER TYPE`
- **sabotagem:** reintroduzir a união em **um** dos oito arquivos, não em todos. A
  sabotagem parcial é a que encontra buraco de granularidade

---

---

## Item 3 — 🟠 O CI não tem portão: lint, type-check e teste não rodam antes do deploy

### O diagnóstico

```yaml
# .github/workflows/deploy.yml:3-6
on:
  push:
    branches:
      - main
```

Um job único, `build-and-deploy`. Os passos são install → build → rsync → PM2. Não
há `pnpm lint`, não há type-check isolado, não há teste — porque não existe teste:
`find` por `*.test.ts*`/`*.spec.ts` devolve **0 arquivos** e o `package.json` não
tem runner.

Consequência: o único portão real é o `pnpm build` falhar. Erro de lint, `any` novo
e regressão de comportamento passam.

### Como corrigir

Job `verificar` (type-check + `pnpm test` + lint comparado à baseline) e
`needs: verificar` no job de deploy.

⚠️ **O que NÃO fazer:** rodar `pnpm lint` como portão absoluto. Com 117 erros de
baseline, o portão fica vermelho no dia 1 e desligado no dia 2. E **não** rodar
`pnpm format` global para zerar — reescreve 233 arquivos fora de escopo, o que o
`AGENTS.md` proíbe sem pedido explícito.

⚠️ E sem `needs`, os jobs rodam em paralelo e o deploy sai com guarda vermelho —
que é o mesmo que não ter guarda.

### O guarda

O próprio job. Precisa ser provado vermelho: abrir PR com guarda sabotado e conferir
que o deploy **não** roda.

---

---

## Item 4 — 🔴 `prescricoes.medicamentos` é JSONB de texto livre: nenhuma soma por medicamento é confiável

Achado em 19/08/2026, ao dimensionar um relatório que precisava somar quantidade por
medicamento. O relatório em si era de outro projeto e saiu de escopo, **mas o defeito é deste
repositório** e afeta qualquer agregação por medicamento aqui.

### O diagnóstico

Os medicamentos de uma prescrição são **texto livre dentro de um JSONB**, sem referência ao
catálogo:

```ts
// db/schema/prescricoes.ts:37
medicamentos: jsonb('medicamentos').notNull().default([]),

// db/schema/prescricoes.ts:25 — comentário do próprio arquivo
// medicamentos: array de { nome, dose?, forma?, posologia?, quantidade? }
```

Três consequências, todas no mesmo campo:

1. `nome` é texto livre e não tem FK para `medicamentos` → _"Canabidiol 200mg"_,
   _"CBD 200 mg"_ e _"cbd 200mg"_ somam como **três** medicamentos distintos.
2. `quantidade` é **opcional** e sem unidade → 2 frascos, 30 ml e 900 gotas cabem no mesmo
   campo, e somar produz número sem significado.
3. Nada liga ao catálogo, que **já tem** marca, concentração, espectro e preço
   (`db/schema/medicamentos.ts`) — justamente o que o Head vai querer cruzar.

### Como corrigir

Tabela **aditiva** de itens de prescrição, com FK para `medicamentos`, quantidade **e unidade**.
Nada em `prescricoes` é alterado.

⚠️ **O que NÃO fazer:** agregar por nome sobre o JSONB com `LOWER(TRIM())`. Resolve dois casos,
falha no terceiro **em silêncio**, e o número resultante parece certo.

⚠️ **E também não:** alterar `prescricoes`. É tabela clínica em produção que alimenta PDF
assinado e SNCR. Normalizá-la é o desenho certo e é **trabalho próprio, com autorização
própria**.

### O guarda

Só **depois** da correção. Guarda que acusa violação conhecida no dia 1 é guarda que alguém
desliga.

---

## Item 6 — 🔴 Todo documento clínico está em store público do Vercel Blob, e a doc afirma o contrário

> 🔴 **ACRÉSCIMO, 22/09/2026 — a procuração assinada é um caso vivo deste item, e NÃO foi corrigida.**
>
> `app/api/webhooks/docusign/route.ts:114` grava o PDF assinado com **`access: 'public'`**, e o
> botão **"Baixar"** da tela usa a coluna direto:
> `app/(paciente)/paciente/documentos/page.tsx:276` → `handleDownload(doc.urlBlob, …)`.
>
> **O que está exposto:** uma procuração com nome e dados do paciente, **legível por quem tiver a
> URL, sem login, sem escopo e sem auditoria**. Medido em 22/09: há **25** procurações concluídas
> com PDF e **5** linhas em `documentos` do tipo `procuracao_especifica`.
>
> ⚠️ **O botão "Ver" ao lado é seguro** (`page.tsx:268` → `<VisualizadorDeDocumento>` →
> `GET /api/documentos/{id}/arquivo`, autenticada, com escopo de objeto, auditoria e 404
> universal). Os dois botões vivem na mesma linha da tela: um passa pela porta, o outro não.
>
> **Pendência, não bug resolvido.** Nada foi mudado em 22/09.

> 🔴 **RETIFICAÇÃO, 13/09/2026 — o Item 6 tinha um segundo andar, e ele era pior.**
>
> Os seis caminhos de documento **já pediam** `access: 'private'` desde 10/09, com comentário
> explicando por quê. Nenhum funcionava: acesso é propriedade do **STORE**, escolhida na criação
> e imutável, e o store que os tokens resolviam era público. O SDK recusava com `Cannot use
private access on a public store` — e **cinco dos seis engoliam o erro** num `catch` que
> logava `erro.name`, sempre `'Error'` para um `new Error`.
>
> **A consequência prática, e ela é diferente da do Item 6:** não havia documento em store
> público. Não havia documento **nenhum**. `anexo-do-cadastro.ts:101` desde 10/09,
> `documentos-do-parceiro.ts` desde 13/09 — o paciente anexava, a tela dizia "pronto", e o
> arquivo não existia em lugar algum. O Item 6 é sobre arquivo legível demais; isto era sobre
> arquivo que não chegou a nascer.
>
> **Corrigido** com `lib/documentos/store-privado.ts` (D-23 da ADR-0022): um terceiro store,
> `BLOB_TOKEN_PRIVADO`, e `access`/`token` deixam de ser parâmetro de quem chama. Falha fechada:
> sem o token, lança — nunca cai para público.
>
> ⚠️ **E `BLOB_BEHEMP_READ_WRITE_TOKEN` não servia**, o que só apareceu ao varrer quem mais a
> usa: `app/api/upload-avatar/route.ts:55` e `app/api/upload-exame/route.ts:78` gravam
> `access: 'public'` com ela. Um token, um store, um acesso.
>
> **O que continua valendo deste Item 6:** os blobs **antigos** seguem no store público, e a
> entrega os serve pelo caminho legado (`app/api/documentos/[id]/arquivo/route.ts`). Migrá-los é
> trabalho próprio.

Achado ao verificar o que significa **guardar** a imagem de uma receita — depois de o dono
decidir que segurança e LGPD são requisito desta implementação.

⚠️ **Decisão do dono em 19/08/2026:** _"o que já tinha sido feito nós deixamos para revisar
futuramente"_. Catalogado com diagnóstico para que a revisão futura não comece do zero.
**É o achado de segurança mais grave registrado neste repositório.**

### O diagnóstico

Todas as chamadas de upload usam store público:

```
app/_actions/documentos-paciente.ts:71          access: 'public'
app/_actions/documentos-paciente-self.ts:128    access: 'public'
app/_actions/documentos.ts:99                   access: 'public'
app/_actions/exames.ts:38                       access: 'public'
app/_actions/chat.ts:628                        access: 'public'
app/api/anvisa/upload-documento/route.ts:69     access: 'public'
app/api/anvisa/procuracao/route.ts:121          access: 'public'
app/(paciente)/_actions/anvisa.ts:315           access: 'public'
app/api/upload-exame/route.ts:77                access: 'public'
app/api/upload-relatorio/route.ts:10            access: 'public'
```

O conteúdo inclui **RG, comprovante de residência, laudo médico, receita médica, exames,
procuração assinada e anexo de chat**. Em store público do Vercel Blob, **quem tem a URL lê o
arquivo sem autenticação** — a proteção é a URL ser difícil de adivinhar, não o acesso ser
verificado. URL que vaza em log, e-mail, print ou dump de banco é acesso permanente.

E há a divergência doc × código:

```ts
// db/schema/prescricoes.ts:23
// urlPdf / urlPdfAssinado: Vercel Blob (URL privada, acesso autenticado).
```

**Não é URL privada.** O comentário descreve a intenção, não o comportamento — e alguém que
leia só a doc vai concluir que o controle existe.

### O perigo de mexer, medido

| fator                        | medida                                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| pontos de chamada            | **10+**, em `app/_actions`, `app/api` e `(paciente)`                                                                               |
| área                         | clínica, **em produção**                                                                                                           |
| suíte que prove antes/depois | **não existe**                                                                                                                     |
| efeito colateral             | store privado exige **store novo**; as URLs já gravadas no banco apontam para o store antigo → precisa migrar arquivo **e** coluna |
| entrega ao usuário           | passa a exigir Route Handler autenticado ou URL assinada — muda todo consumidor de `urlPdf`/`url`                                  |

### Como corrigir (quando autorizado)

Trabalho próprio, com ADR e autorização próprias. Ordem que reduz dano: (1) store privado
para uploads **novos**; (2) proxy autenticado de entrega; (3) migração dos arquivos antigos com
reescrita de coluna; (4) revogação do store público.

⚠️ **O que NÃO fazer:** trocar `access: 'public'` por `'private'` nos 10 pontos e achar que
terminou. As URLs gravadas continuariam apontando para o store antigo, e a entrega quebraria
em toda tela que hoje usa a URL direto.

### O guarda

Só **depois** da correção — guarda que acusa 10 violações conhecidas no dia 1 é guarda que
alguém desliga. Para código **novo**, a regra já vale: `.claude/rules/seguranca-lgpd.md`.

---

## Item 7 — ⚠️ RETRATADO: eu disse que o schema tem 31 tabelas

Afirmei **31 tabelas** em `db/schema`, e repeti o número em várias docs desta sessão — incluindo
as que foram para outro projeto.

**Estava errado. São 40 tabelas, em 29 arquivos.**

O erro foi de método: contei **arquivos**, não tabelas. Quatro arquivos declaram mais de uma:

```
db/schema/invoices.ts        -> 9 tabelas
db/schema/teleconsultas.ts   -> 2
db/schema/grupos-chat.ts     -> 2
db/schema/ajustes-dosagem.ts -> 2
```

A medição correta é `rg -c 'pgTable\(' db/schema/*.ts`, que soma 40.

Corrigido em `03-CHECKLIST-MESTRE.md`, em `01-REGRA-DE-NEGOCIO.md` e nas duas ADRs que já
tinham saído para o outro projeto.

Fica registrado porque **retratar por escrito ensina mais que acertar** — e porque o padrão do
erro é reaproveitável: _contar o continente em vez do conteúdo_. Vale para tabela em arquivo,
rota em router, e caso de teste em arquivo de teste.

---

## Item 8 — ✅ CORRIGIDO em 20/08/2026 — TURN público de terceiro na teleconsulta, com credencial compartilhada

> ✅ **Corrigido em 20/08/2026.** O dono escolheu **Cloudflare Realtime TURN** entre 4 opções
> comparadas com preço (ver o fim deste item). A credencial pública saiu dos **dois** arquivos;
> a lista de `iceServers` passou a vir de `/api/teleconsulta/ice-servers`, que gera credencial
> **efêmera (2 h)** no servidor e só a entrega a quem participa da sala.
>
> Guarda: `sem-relay-de-terceiro-na-teleconsulta` — **13 casos**, com **4 de controle contra
> falsa acusação**, e **5 sabotagens provadas vermelhas**. Nasceu **verde**, de propósito:
> guarda para violação não corrigida nasce vermelho e fica vermelho.
>
> 🔴 **DUAS PENDÊNCIAS BLOQUEIAM O USO REAL** (também no `03` e na
> [ADR-0008](adr/ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md) §4):
>
> | #   | pendência                                                                                            | de quem          | sem isso                                                                  |
> | --- | ---------------------------------------------------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------- |
> | 1   | **criar a conta** na Cloudflare e provisionar `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_API_TOKEN` | **dono / infra** | só STUN; conexão que precise de relay **falha**, com aviso na tela        |
> | 2   | **assinar o DPA** da Cloudflare                                                                      | **Jurídico**     | 🛑 nenhuma consulta real deve passar por lá — seria operador sem contrato |
>
> Onde obter as chaves: painel da Cloudflare → **Realtime** → **TURN**. O token é de servidor e
> **nunca** vai ao cliente — a credencial do navegador é gerada em
> `/api/teleconsulta/ice-servers`, com validade de 2 h.
>
> ⚠️ A pendência 2 **não é formalidade**: a Cloudflare não lê a mídia, mas vê o IP de médico e
> paciente, e IP é dado pessoal. Isso a torna **operadora**.
>
> A degradação para STUN é **regressão deliberada**, registrada em `.claude/autorizacoes.txt`:
> melhor falhar do que atravessar relay de estranho com dado de saúde.

**Onde:** 🔴 **corrigido em 20/08/2026 — são DOIS arquivos, não um:**

| arquivo                                                  | linhas      | lado     |
| -------------------------------------------------------- | ----------- | -------- |
| `components/teleconsulta/GlobalTeleconsultaHost.tsx`     | **194-196** | médico   |
| `app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx` | **156-158** | paciente |

⚠️ E existe uma **terceira** implementação de `RTCPeerConnection`, em
`app/(medico)/medico/teleconsulta/page.tsx:160`, com **só STUN e sem TURN** — provavelmente
código legado, que nenhuma correção do TURN alcançaria.

```
{ urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' }
{ urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' }
{ urls: 'turn:openrelay.metered.ca:443?transport=tcp', ... }
```

**O defeito, em três camadas:**

1. **Dado.** Quando o WebRTC não consegue conexão direta, **toda a mídia da consulta médica**
   — vídeo e áudio de paciente e médico — passa pelo relay. É um **operador de dado pessoal
   sensível sem contrato**, o que a regra de LGPD deste repositório trata como decisão do
   Jurídico.
2. **Disponibilidade.** Serviço gratuito, sem SLA. Quando satura ou sai do ar, a consulta cai —
   e nada no produto explica por quê.
3. **Credencial.** `openrelayproject` é pública e compartilhada com o mundo inteiro.

**Perigo de mexer: BAIXO** — e é a exceção neste repositório.

| pergunta                             | resposta                                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| pontos de chamada                    | **2 arrays** em 2 arquivos (o diagnóstico anterior dizia 1)                                             |
| está em produção?                    | o código está; **o uso clínico não** (`DO-02`: nunca foi usada de verdade)                              |
| existe teste que prove antes/depois? | não — nenhum. É o que a Sprint 1 cria                                                                   |
| o que quebra em quem consome hoje?   | **ninguém consome de verdade**                                                                          |
| ⚠️ e o hook?                         | um dos dois arquivos está em `app/(paciente)/` — **área protegida**. Corrigir exige autorização escrita |

**Correção:** TURN com contrato (serviço gerenciado) ou `coturn` próprio, com credencial
efêmera em variável de ambiente. Guarda que falhe se voltar credencial hardcoded.
**Entra na [Sprint 1](sprints/SPRINT-1-auditoria-da-teleconsulta.md).**

### As opções, com preço — pesquisa de 20/08/2026

**A conta, com as premissas explícitas.** WebRTC de vídeo consome ~1,2 Mbps por direção
(720p típico); uma consulta de 30 min relayada gasta ≈ **0,54 GB** (1,2 Mbps × 1800 s × 2
sentidos). O TURN só entra quando a conexão direta falha.

| provedor                        | preço                                                                                               | fonte                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Cloudflare Realtime TURN**    | **US$ 0,05/GB**, com **1.000 GB/mês grátis**                                                        | [doc oficial](https://developers.cloudflare.com/realtime/turn/faq/) |
| **Twilio NTS — São Paulo**      | US$ 0,80/GB                                                                                         | [pricing oficial](https://www.twilio.com/en-us/stun-turn/pricing)   |
| Twilio NTS — US West / Alemanha | US$ 0,40/GB                                                                                         | idem                                                                |
| **`coturn` próprio na AWS**     | banda de saída **US$ 0,09/GB** (primeiros 10 TB, após 100 GB grátis) **+** instância **+** operação | pesquisa de custo AWS                                               |

🔴 **A conclusão não depende da premissa incerta.** Mesmo no **pior caso** — supondo que
**100 %** das consultas precisem de relay, o que nunca acontece na prática — 1.000
consultas/mês dão **540 GB**, ainda **dentro do free tier de 1.000 GB** da Cloudflare. Ou seja:

| cenário                                   | Cloudflare | Twilio (SP) | coturn AWS (só banda)                 |
| ----------------------------------------- | ---------- | ----------- | ------------------------------------- |
| 1.000 consultas/mês, 100 % relay (540 GB) | **US$ 0**  | US$ 432     | US$ 40 + instância + operação         |
| 100 consultas/mês, 15 % relay (8 GB)      | **US$ 0**  | US$ 6,50    | US$ 0 (dentro dos 100 GB) + instância |

**Recomendação: Cloudflare Realtime TURN.** Três razões, na ordem que importa:

1. **LGPD.** A doc oficial declara que a Cloudflare **não pode acessar o conteúdo da mídia** —
   WebRTC é cifrado com DTLS e ela relaya pacotes cifrados, processando só metadados
   (IP, porta, timing). E existe [DPA com cláusula específica de LGPD](https://www.cloudflare.com/cloudflare-customer-dpa/)
   (seção 7), com a ANPD como autoridade competente declarada. ⚠️ IP **é** dado pessoal, então
   ela continua sendo **operador** e o DPA precisa ser assinado — é decisão do Jurídico
   (`CF-01`, `GAP-06`), não de TI.
2. **Preço.** Zero na escala previsível, e 16× mais barato que o Twilio-SP acima do free tier.
3. **Operação.** Não há servidor para manter, atualizar nem monitorar — e hoje não existe
   ninguém designado para operar um `coturn`.

**O contra-argumento do `coturn`, honestamente:** é a única opção **sem operador externo
novo**, portanto sem base legal nova a obter. Mas não elimina o problema de dado pessoal — o
servidor ainda vê os IPs de médico e paciente —, custa mais que zero, e transfere para a equipe
a disponibilidade de um componente sem o qual a consulta cai. Como a máquina de produção é uma
**t2.small de 2 GB** que já não cabe o motor de IA (ADR-0001), o `coturn` exigiria instância
própria.

⚠️ **O que NÃO foi confirmado em fonte primária:** o preço da instância em **sa-east-1**. O
valor localizado (**US$ 15,18/mês** para `t3.small`) é de **us-east-1**; São Paulo é mais caro,
e o número exato não foi lido. Também não foi verificada em fonte primária a taxa típica de
conexões que precisam de relay — por isso a conta acima usa o pior caso, que dispensa a
premissa.

---

## Item 9 — Credenciais em texto claro no projeto de origem VidAI

**Onde:** fora deste repositório —
`~/Developer/Projects/vidai_lancamento/vidai_lancamento/`

| arquivo                   | o que contém                                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| `deploy-novo-vps.sh:16`   | **senha root do VPS** de produção, em texto claro, com IP e usuário           |
| `deploy-novo-vps.sh`      | senha do PostgreSQL                                                           |
| `docker-compose.prod.yml` | `POSTGRES_PASSWORD` e `REDIS_PASSWORD` default em texto claro                 |
| 6 × `.env`                | nas duas árvores; o README declara chaves de Groq, Anthropic, Google e OpenAI |

⚠️ **Não li o conteúdo de nenhum `.env`.** O diagnóstico vem dos scripts e do README.

**Não é código deste repositório** e não se corrige aqui. Fica registrado por duas razões:

1. **Recomendação de rotação.** As árvores circularam como arquivo compactado (há `__MACOSX`).
   Tratando pelo pior caso plausível: rotacionar a senha root do VPS e as quatro chaves de API.
2. **Nada disso é importado.** [ADR-0001](adr/ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)
   D-08 rejeita reaproveitar `.env`, `docker-compose.prod.yml` ou scripts de deploy do VidAI —
   importa-se **código**, nunca configuração.

---

## Item 10 — O comentário do `requirements.txt` do VidAI diverge do código

**Onde:** `IA-you-ai-main/requirements.txt` × `IA-you-ai-main/agents/embedding_service.py:35`

O comentário documenta `paraphrase-multilingual-mpnet-base-v2` (278 MB). O código carrega
`nomic-ai/nomic-embed-text-v1`. **O código vence** — e o modelo real é o maior dos dois.

Importa porque o dimensionamento da máquina da [ADR-0001](adr/ADR-0001-motor-de-ia-roda-como-servico-python-separado.md)
depende deste número. Quem confiar no comentário subdimensiona.

**Não é defeito deste repositório.** Registrado para não ser redescoberto na Metade 2.

---

## Item 11 — ✅ CORRIGIDO em 20/08/2026 — a teleconsulta autorizava por PAPEL e confiava em id vindo do cliente

> ✅ **Corrigido em 20/08/2026**, autorizado pelo dono (as 7 ocorrências + consentimento +
> auditoria), com o guarda `autorizacao-tem-escopo-de-objeto`, que **nasceu vermelho nas 7** e
> hoje tem **19 casos**. As **8 sabotagens** foram provadas vermelhas. Portão verde: lint 210
> (inalterado), type-check 0, e a baseline até **melhorou** em 2 warnings.
>
> 🔴 **Um achado desta correção NÃO foi corrigido, porque não é decisão técnica:** o
> consentimento LGPD nunca é perguntado a ninguém — ver o fim deste item.

**Achado na auditoria da [Sprint 1](sprints/SPRINT-1-auditoria-da-teleconsulta.md), 20/08/2026.**
Não é uma falha: é **uma classe**, com 7 ocorrências e 3 controles corretos que provam que o
padrão certo era conhecido.

### O diagnóstico

O módulo pergunta _"quem é você?"_ e nunca _"este objeto é seu?"_. O identificador (`roomId`,
`salaId`, `pacienteId`) chega **do cliente** e é usado direto no `where`. É OWASP **API1:2023
(BOLA)** — apontado em `.claude/rules/seguranca-lgpd.md` como _"o risco número um deste
projeto"_.

#### 🔴 O pior: qualquer usuário autenticado entra em qualquer consulta

Dois defeitos que **se compõem**:

| #   | onde                                           | o que faz                                                                                                                    |
| --- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A   | `app/api/pusher/auth/route.ts:72-80`           | o ramo `presence-sala-` autoriza **qualquer** usuário autenticado em **qualquer** sala. Sem uma única verificação de vínculo |
| B   | `app/api/teleconsulta/sinalizar/route.ts:8-30` | valida só `auth()`; aceita `roomId` arbitrário do body e faz `trigger` no canal. Sem Zod, sem checar sala                    |

Compostos, permitem a um paciente qualquer: **assinar o canal da consulta de outro**, receber
`offer`/`answer`/`ICE` da negociação, injetar a própria sinalização e **estabelecer conexão
WebRTC** — ou seja, assistir a uma consulta médica alheia. O `roomId` tem 6 caracteres gerados
por `Math.random()` (`app/(medico)/_actions/teleconsulta.ts:28`), que não é criptográfico, e não
há rate limit em nenhum dos dois endpoints.

O contraste está no **mesmo arquivo**: `private-user-` confere que o canal é do próprio
usuário, `private-chat-` confere participação no grupo. Só `presence-sala-` não confere nada.
E o `autenticarCanal` final, fora dos três ramos, autoriza **qualquer nome de canal** — o
default é permitir, não negar (_fail-open_).

#### As outras 5 ocorrências

| onde                                                       | o que aceita do cliente    | consequência                                                                                                                        |
| ---------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/teleconsulta/aprovar-narrativa/route.ts:11,23-29` | `pacienteId` **e** o texto | 🔴 **qualquer médico escreve evolução clínica no prontuário de qualquer paciente**. Sem Zod, sem auditoria                          |
| `app/api/teleconsulta/transcrever/route.ts:28-33`          | `salaId`                   | o comentário diz _"Verificar acesso à sala"_ e só verifica **existência**. Grava transcrição com o `medicoId` da sala, não do autor |
| `app/(medico)/_actions/teleconsulta.ts:62`                 | `salaId`                   | qualquer médico altera o consentimento LGPD de sala alheia                                                                          |
| `app/(medico)/_actions/teleconsulta.ts:81`                 | `salaId`                   | qualquer médico encerra consulta alheia e marca a consulta como `realizada`                                                         |
| `app/(paciente)/_actions/teleconsulta.ts:90`               | `salaId`                   | qualquer paciente muda para `em_andamento` a sala de outro                                                                          |

#### Os 3 controles que provam que o padrão certo era conhecido

`criarSalaTeleconsulta:37` filtra `medicoId` · `buscarSalaPorRoomId:47` filtra `pacienteId` ·
`transcricao/route.ts:31-37` confere que o médico é o dono, ou admin. **O mesmo módulo acerta
na leitura e erra na escrita** — é o eixo da classe, e o que um guarda precisa fatiar.

#### E o consentimento LGPD não é exigido: é autodeclarado pelo cliente

Resposta ao **entregável 6** da Sprint 1. `transcrever/route.ts:15` lê `consentimento` do
`formData` e grava `consentimentoObtido: true` (linha 40) **sem nunca consultar**
`teleconsultas.consentimentoLgpd` no banco. O campo existe, é gravado — e não governa nada.
Pior: em `GlobalTeleconsultaHost.tsx:176-182`, `registrarConsentimentoLgpd` roda dentro de
`try/catch` que só faz `console.error` e **prossegue** — a gravação de áudio começa mesmo se o
registro do consentimento falhar. E as linhas 22-26 do handler são **código morto**: a
validação anterior já garantiu `consentimento === true`.

#### A auditoria não registra quem agiu

`db/schema/logs-auditoria.ts:15` **tem** `userId` e `ip`. As chamadas passam só
`{acao, entidade, entidadeId}` — em `teleconsulta.ts:66,131`, `(paciente)/teleconsulta.ts:99` e
`transcrever/route.ts:180`. Todas com `.catch(() => {})`, então a falha é silenciosa. A tabela
que a própria doc chama de _"obrigatório pela LGPD"_ registra **o quê**, nunca **quem**.

### O perigo de mexer, medido

| pergunta                             | resposta                                                                                                    |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| pontos a corrigir                    | **7** de autorização + 4 de auditoria + 1 de consentimento                                                  |
| está em produção?                    | 🔴 **o código está, e as rotas respondem.** O uso clínico não (`DO-02`)                                     |
| existe teste que prove antes/depois? | **nenhum.** É o que esta sprint precisa criar primeiro                                                      |
| o que quebra em quem consome hoje?   | nada de uso real; o risco é **regressão silenciosa** — um `where` a mais que passe a negar acesso legítimo  |
| hook                                 | 3 dos arquivos estão em `app/(medico)/` e `app/(paciente)/` — **área protegida**. Exige autorização escrita |

### Como corrigir

1. **Primeiro o guarda, vermelho** — um caso por ocorrência, mais os 3 controles corretos como
   prova de que a regra não é vácua.
2. `pusher/auth`: o ramo `presence-sala-` confere que o usuário é o médico **ou** o paciente
   daquela sala; e o default final passa a **negar** canal desconhecido.
3. `sinalizar`: Zod no payload + conferir vínculo do usuário com o `roomId`.
4. Um helper único — `garantirDonoDaSala(salaId | roomId, papel)` — em vez de repetir o `where`
   em 7 lugares. Repetição é o que produziu a divergência.
5. `aprovar-narrativa`: derivar `pacienteId` **da sala**, nunca do body.
6. Consentimento: ler do banco, não do cliente; e falhar a consulta se o registro falhar.
7. Auditoria: passar `userId` e `ip`, e **deixar de engolir** o erro.

### 🔴 O que NÃO foi corrigido: o consentimento não é perguntado a ninguém

`components/teleconsulta/GlobalTeleconsultaHost.tsx:83`

```ts
const [consentimentoTranscricao] = useState(true);
```

**Sem setter. Sem UI. Sem nenhum lugar onde alguém marque a caixa.** O campo existe no schema,
é gravado, e o valor é `true` **por construção** — não porque alguém consentiu. A pergunta do
entregável 6 (_"são exigidos, não só armazenados?"_) tem resposta pior que _"não são
exigidos"_: **não são obtidos**.

A LGPD (art. 5º, XII) define consentimento como manifestação **livre, informada e inequívoca**.
Um `useState(true)` não é manifestação de ninguém.

**Não corrigi de propósito:** criar a tela e escrever o texto do que se consente é decisão de
produto e do Jurídico — inventar o texto seria pior que a ausência, porque quem lê acredita.
🔴 **Precisa de decisão do dono.**

O que **foi** feito nesse eixo, sem inventar regra: a falha do registro deixou de ser engolida
por um `console.error`, e **a gravação de áudio só começa se o consentimento estiver registrado
no banco** (`consentimentoRegistradoRef`). A consulta em si prossegue — recusar atendimento
médico por falha de registro seria pior para o paciente que perder a transcrição.

### O guarda

`__tests__/guardas/autorizacao-tem-escopo-de-objeto.test.ts` — **19 casos.** Falha quando um handler ou action
de teleconsulta usa `salaId`/`roomId`/`pacienteId` vindo do cliente num `where` **sem** conjunção
de escopo do usuário. Fatiado **por função**, não por arquivo: a Regra 2 de
[TECNICA-DOS-GUARDAS](TECNICA-DOS-GUARDAS.md) — o defeito acontece por função, e um guarda por
arquivo passaria sobre o arquivo que acerta em 2 de 5 funções. Os 3 controles corretos entram
como casos que devem **passar**.

🔴 **A sabotagem encontrou um furo no próprio guarda.** Das 8 mutações, 7 morreram e **uma
sobreviveu**: devolver a `aprovar-narrativa` o `pacienteId` do body, **mantendo** a chamada a
`garantirDonoDaSala`. O guarda provava que a sala foi verificada, não que os dados **derivam**
dela — e verificar o dono para então gravar em outro dono é checagem decorativa. Virou o caso
_"o paciente gravado deriva da sala"_, fatiado no **insert** (não no arquivo, porque
`select({ pacienteId: teleconsultas.pacienteId })` é legítimo e não pode ser acusado). Com ele,
as 8 morrem. Registro no topo do arquivo do guarda.

---

## Item 12 — ⚠️ O mascaramento de PII da transcrição protege menos do que o comentário afirma

**Onde:** `app/api/teleconsulta/transcrever/route.ts:154-160`

✅ **Confirmado o que o critério de aceite da Sprint 1 pedia:** o mascaramento **existe** e a
versão **mascarada é a persistida** (linha 172, `textoCompleto: textoMascarado`). A precaução de
`.claude/rules/seguranca-lgpd.md` está mantida — e deve continuar.

Mas o comentário do código diz _"Remover CPF, RG, telefones, emails, endereços"_, e:

| o que o comentário afirma | o que o código faz                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| endereços                 | 🔴 **não existe regex de endereço.** A afirmação é falsa                                                                     |
| telefones                 | só com DDD entre parênteses: `(11) 99999-9999` pega; `11999999999` **não** — e transcrição de fala raramente traz parênteses |
| nome próprio              | não é mencionado, e **não é mascarado** — numa conversa clínica, é a PII mais frequente                                      |

🔴 **E o limite estrutural:** o mascaramento acontece **depois** do Google STT. O áudio bruto —
voz, nome falado, tudo — **sai da plataforma** para o Google antes de qualquer máscara. Áudio
não se mascara com regex, exatamente como imagem não se mascara (o motivo pelo qual a extração
automática de documento foi recusada em 19/08/2026). O mascaramento protege a etapa **Gemini**,
não a etapa **STT**.

⚠️ Portanto **há dois operadores externos** recebendo dado de saúde nesta rota, não um. Base
legal e contrato de operador são decisão do Jurídico (`CF-01`, `GAP-06`), não de TI.

Menor, no mesmo trecho: `hashTexto` (linha 167) é calculado sobre o texto **não** mascarado,
enquanto o que se persiste é o mascarado — a idempotência se apoia num texto que não existe mais.

---

## Modelo de item RETRATADO

Quando algo reportado aqui não era defeito:

## Item NN — ⚠️ RETRATADO: {{o que eu disse}}

Reportei que {{X}}. **Estava errado.** {{Por quê, com a evidência.}}

O erro foi {{a causa — grep estreito, leitura apressada, doc desatualizada tomada como código}}.

Fica registrado porque retratar por escrito ensina mais que acertar — e porque a próxima sessão
não pode "consertar" um não-defeito.

---

## Itens abertos da Sprint 4 — diagnosticados em 24/08/2026

Encontrados ao conferir os 8 entregáveis da sprint contra o disco, depois de implementar o que o
dono pediu (opções de medicamento, botão de revisar, preview por perfil). **Nenhum destes foi
pedido** — ficam registrados para não serem planejados como se existissem.

### Item 8 — Caminho de hipótese manual não existe (E3 da Sprint 4)

**Onde:** `components/ia-clinica/RevisaoHumana.tsx:177-260` — a lista de opções só oferece as
hipóteses **do grafo**. `rg "manual" components/ia-clinica/` devolve zero.

**Por que importa:** o médico que conclui algo que a IA não levantou hoje só tem o caminho
"Divirjo da análise", que grava `validacao: 'divergente'` e a conclusão em texto livre — sem CID
estruturado ligado a uma hipótese própria. Funciona, mas mede errado: divergência com hipótese
nomeada e divergência sem hipótese ficam indistinguíveis no `revisoes_ia`, e é justamente essa
distinção que diria se o modelo **errou** ou se apenas **não cobriu**.

**Perigo de mexer:** baixo. Um campo novo em `revisoes-ia.ts` (nullable) e um caminho na tela.
Nenhum consumidor em produção — a tabela não é lida por nada ainda. Não há teste que prove o
antes.

### Item 9 — Rascunho da revisão não persiste (E7 da Sprint 4)

**Onde:** `components/ia-clinica/RevisaoHumana.tsx:53-60` — `modo`, `hipoteseId`, `conclusao` e
`cid` são `useState` puro. Fechar a aba perde tudo.

**Por que importa:** a conclusão do médico é texto escrito à mão, no meio de consulta. Perder por
recarregamento é a classe de defeito que faz o médico deixar de escrever justificativa — e a
justificativa é o que sustenta a Trava 2.

**Perigo de mexer:** baixo, mas com uma pergunta de LGPD antes: rascunho de conclusão clínica em
`localStorage` é **dado de saúde no navegador**, e o navegador pode ser compartilhado. A resposta
provável é rascunho no **servidor**, ligado ao médico, não no cliente — e isso muda o desenho.
**Não implementar antes de decidir isso.**

### Item 10 — Urgência não vai à tela, e o mapeamento 7→4 não está escrito (E8 da Sprint 4)

**Onde:** `lib/ia-clinica/contrato.ts` — `UrgenciaAnalise` tem **7 valores**; o desenho pede
**4 níveis** de badge nos tokens `--chart-*`. Nenhum componente lê o campo.

**Por que importa:** urgência é o dado que muda o que o médico faz **primeiro**. Estar no
contrato e não na tela é coleta sem consumidor — o oposto do que o projeto exige.

**Perigo de mexer:** médio, e não é código: o mapeamento 7→4 é **decisão de desenho** e, se dois
lugares mapearem diferente, a mesma análise aparece com urgências distintas em telas distintas.
Escrever o mapa numa constante única, com guarda de exaustividade, antes de renderizar.

---

## Normas que as normas citaram — pendentes em 24/08/2026

Descobertas **dentro** do texto das três RDCs transcritas hoje. Norma que cita norma cria
dependência, e ignorá-la é o mesmo erro de citar a 327/2019 revogada.

| norma            | quem a cita                              | o que ela decide, e o que trava sem ela                                                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RDC 38/2013**  | `CAN-05` (RDC 1.015/2026, Art. 5º)       | define **"doença debilitante grave"** — o critério que autoriza THC acima de 0,2 %. Sem ela, a trava de indicação da Sprint 5 (entregável 10) não tem régua, e **o nosso próprio fixture** sugere `CBD:THC 1:1` para polineuropatia diabética sem saber se ela se qualifica |
| **RDC 873/2024** | `REC-05` (RDC 1.000/2025, Art. 3º, VIII) | **institui o SNCR**. O `REC-02` exige numeração vinda dele; como se requisita, o que se registra e o que acontece na indisponibilidade estão nesta norma, não na 1.000                                                                                                      |
| **RDC 185/2001** | `ANV-04` (RDC 657/2022, Art. 4º)         | as **classes de risco** de dispositivo médico. Completa o enquadramento SaMD; não bloqueia telas, bloqueia **ligar o motor**                                                                                                                                                |

⚠️ **Perigo de mexer: nenhum** — é transcrição, não código. O perigo é o oposto: decidir sem elas.

## Item 11 — `lib/receituario/` não foi conferido contra `REC-02` e `REC-03`

**Onde:** `lib/receituario/`, `app/api/receituario/`, `app/(medico)/_actions/prescricoes.ts`.

**O que a norma exige** (RDC 1.000/2025, em vigor desde ~fevereiro de 2026):

- `REC-02` — _"Cada receituário eletrônico deve conter a **numeração individualizada previamente
  concedida por meio do SNCR**"_ (Art. 7º)
- `REC-03` — deve _"ser subscrito com **assinatura eletrônica qualificada**"_, isto é, certificado
  **ICP-Brasil** (Art. 8º, I + Art. 3º, II)

**Por que importa:** a Sprint 5 faz a **ponte** da conduta para a prescrição. Se o que existe hoje
não cumpre `REC-02`/`REC-03`, a ponte entrega conduta a um caminho não conforme — e o defeito
passa a ter origem na tela nova.

**Perigo de mexer: ALTO.** `prescricoes.medicamentos` é JSONB que alimenta **PDF assinado e
SNCR** (Item 4 do checklist). É produção. **Catalogar e medir antes**, com autorização própria —
não corrigir de passagem, e nunca no commit da Sprint 5.

**O que fazer primeiro, e não é código:** ler a **RDC 873/2024**, que é quem define o SNCR.

---

## Item 13 — 🔴 A cadeia de dosagem em produção: sem vínculo, sem escopo de objeto, e sobrescrevendo histórico

**Achado em 25/08/2026**, ao ler o código antes de começar a Sprint 5 (item 7 da fila). São
**cinco defeitos** na mesma família — a cadeia `conduta → dosagem → titulação` — e nenhum estava
catalogado. **Nenhum se corrige nesta sprint**: o desenho do caminho novo está na
[ADR-0012](adr/ADR-0012-o-sistema-avisa-o-medico-decide-na-cadeia-da-conduta.md).

### 13.1 — 🔴🔴 `criarDosagem` do route group do paciente **não tem autenticação nenhuma**

**Onde:** `app/(paciente)/_actions/dosagem.ts:43` (`criarDosagem`), `:129`
(`listarDosagensPaciente`), `:166` (`pedirRecompra`).

**Medido:** grep por `auth()`, `verificarMedico`, `verificarPaciente`, `verificarRole` e
`currentUser` no arquivo inteiro → **zero ocorrências**. As três actions aceitam `pacienteId` ou
`dosagemId` do cliente e operam direto no banco.

**Por que é grave e não é teórico:** `'use server'` publica **todo export como endpoint POST**.
Não é preciso que um componente importe a função para que ela seja chamável — o Next gera o
endpoint a partir do módulo. Que nenhum componente a importe **reduz a descoberta, não o acesso**.

**Perigo de mexer: BAIXO — e é o achado mais fácil desta lista.**

- pontos de chamada: **zero** (`app/_actions/dosagens.ts` é a versão que a UI usa — ver 13.2)
- em produção? o arquivo está em `main`, sim
- o que quebra em quem consome hoje: **nada**, porque ninguém consome
- ⚠️ a decisão a tomar não é técnica: **apagar o arquivo** ou **acrescentar auth**. Apagar remove
  superfície; acrescentar preserva um caminho que talvez tenha sido feito para algo.

### 13.2 — Duas `criarDosagem`, e as duas são chamáveis

**Onde:** `app/_actions/dosagens.ts:47` **e** `app/(paciente)/_actions/dosagem.ts:43`.

A primeira tem `verificarMedicoOuAdmin` e é a que `tab-rastreio.tsx:13` importa. A segunda é a de
13.1. Divergem também no comportamento: só a segunda cria `recompras`.

**Perigo de mexer: MÉDIO.** Unificar exige decidir qual comportamento é o certo — e a criação
automática de `recompras` é regra de negócio, não detalhe.

### 13.3 — 🔴 `atualizarDosagem` faz `UPDATE` em `gotasPorDia`

**Onde:** `app/_actions/dosagens.ts:120-159`.

É literalmente o **R-03** da [ADR-0005](adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md):
_"`UPDATE` em `dosagens.gotasPorDia` apaga a curva de titulação — e viola a proibição de
sobrescrever histórico clínico"_. A ADR rejeitou; o código faz.

**Perigo de mexer: MÉDIO.**

- pontos de chamada medidos: **nenhum componente a importa** hoje — mas ela é endpoint, como 13.1
- corrigir significa **trocar semântica**: "atualizar" vira "desativar + inserir nova"
- existe teste que prove antes/depois? **não** — e é por isso que o guarda
  `titulacao-nao-sobrescreve-o-anterior` nasce cobrindo o caminho novo primeiro

### 13.4 — 🔴 `editarAjusteDosagem` apaga fisicamente os itens do ajuste

**Onde:** `app/_actions/ajustes-dosagem.ts:108-127` — `db.delete(itensAjusteDosagem).where(...)`,
`DELETE` físico, seguido de reinserção.

Um ajuste de dose editado **perde o que dizia antes**, sem versão anterior e sem motivo. É a
proibição nº 4 do `CLAUDE.md` — _"alteração preserva o anterior, a data e o motivo"_.

⚠️ E a UI **diz o contrário do que o código faz** nos dois sentidos: `tab-dosagem.tsx:144` avisa
que o ajuste _"será removido permanentemente"_, mas `excluirAjusteDosagem:159` faz **soft delete**
(`deletedAt`). O usuário é avisado de uma destruição que não acontece, e não é avisado da que
acontece.

**Perigo de mexer: MÉDIO-ALTO.** É tela em produção com dado clínico já digitado. `DO-48` resolve
o lado do fluxo — a tela para de aceitar dado novo — mas **as actions continuam exportadas**, e
tirar export de `'use server'` sem varrer todos os pontos de chamada é mudança de superfície de
API em produção.

### 13.5 — 🔴 Nenhuma das actions de dosagem tem escopo de objeto (OWASP API1 / BOLA)

**Onde:** `app/_actions/dosagens.ts:47,120,190,225` · `app/_actions/ajustes-dosagem.ts:34,72,108,152`.

Todas usam `verificarMedicoOuAdmin`, que prova **papel** e não **vínculo**. Médico A cria, lista,
ajusta e desativa a dosagem do paciente do médico B — basta enviar o `pacienteId` dele. É a mesma
classe corrigida na teleconsulta em 20/08 pelo `garantirDonoDaSala` (Item 11), e a norma é
explícita: `CAN-02` restringe a prescrição a quem **acompanha clinicamente** o paciente.

**E o helper que resolveria isso existe duplicado, fora de `lib/auth/`:**
`app/_actions/revisao-ia.ts:33` e `app/_actions/anamnese-baseline.ts:52` declaram cada um o seu
`garantirMedicoDoPaciente`.

**Perigo de mexer: MÉDIO.**

- **8 funções** em 2 arquivos, mais 3 telas que as consomem (`tab-dosagem`, `tab-rastreio`, e o
  painel de teleconsulta que lê `dosagens` direto)
- em produção, **e com uso real** — diferente da teleconsulta, que nunca foi usada (`DO-02`)
- o risco concreto é **regressão de acesso legítimo**: um `where` a mais que passe a negar o
  médico certo. Mitigação exigida: guarda por função, **vermelho antes**, com os casos de acesso
  legítimo como controle
- ⚠️ **admin**: `verificarMedicoOuAdmin` hoje deixa o admin passar. Qualquer correção precisa
  decidir se o admin continua vendo dosagem de qualquer paciente — **isso é regra de negócio**,
  vai ao dono

### 13.6 — 🔴 `prescricaoTipoEnum` não comporta a **Notificação de Receita "A"**, que o `CAN-04` exige

**Onde:** `db/schema/enums.ts:107-111`.

```
prescricaoTipoEnum = ['simples', 'controle_especial', 'personalizado']
```

**O que a norma exige** (`CAN-04`, RDC 1.015/2026, Art. 37, §§ 1º e 2º): produto de Cannabis com
teor de THC **acima de 0,2%** exige que a prescrição seja acompanhada de **Notificação de Receita
"A"**. O enum não tem esse valor — então o sistema **não consegue registrar** o tipo de documento
que a norma manda usar.

**Como a Sprint 5 lidou com isso, sem corrigir:** a ponte (`lib/conduta/ponte-prescricao.ts`)
grava `controle_especial`, que é o mais próximo disponível, e a tela **avisa em vermelho** que a
Notificação "A" precisa ser emitida fora do sistema. O que o sistema avisou e o que o médico
decidiu ficam em auditoria.

🔴 **Por que denunciar em vez de gravar calado.** Gravar `controle_especial` em silêncio faria
existir um documento **plausível com o tipo errado** — e receituário controlado com tipo errado é
pior que receituário ausente, porque ninguém desconfia. É a mesma decisão de desenho que os
componentes de IA tomaram ao renderizar _"origem desconhecida: X"_ em vez de cair para um padrão.

**Perigo de mexer: ALTO.**

- `prescricoes.tipo` alimenta o **PDF assinado** e o fluxo do **SNCR** — é o Item 4 do checklist
- acrescentar valor a `pgEnum` exige migration com `ALTER TYPE ... ADD VALUE`, que **não é
  reversível** no Postgres sem recriar o tipo
- há **3 telas** que leem ou escrevem `tipo` (`tab-prescricoes.tsx`, `receituarios/page.tsx`,
  `prescricao-inline.ts`) e um `layout-builder` que decide o desenho do papel por ele
- ⚠️ e a pergunta que precede o código: **a Be4Hope pode emitir Notificação de Receita "A"?**
  Ela é documento de controle especial com numeração própria — isso é **regra de negócio e
  regulatória**, não decisão de TI. Vai ao dono antes de qualquer migration.

**O guarda já cobra a reversão:** `a-conduta-avisa-e-nao-decide` tem um caso que fica **vermelho
no dia em que o enum ganhar `notificacao_a`**, nomeando que o contorno da ponte pode sair.

### O que a Sprint 5 faz, e o que ela não faz

| faz                                                                                                  | não faz                                          |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| o caminho novo nasce com `garantirMedicoDoPaciente` de `lib/auth/escopo-paciente.ts` (ADR-0012 D-05) | corrigir as 8 funções existentes                 |
| o caminho novo insere linha nova, nunca `UPDATE` em `gotasPorDia`                                    | corrigir `atualizarDosagem`                      |
| a tela antiga para de aceitar dado novo (`DO-48`)                                                    | remover os exports de `editar`/`excluir`         |
| a conduta grava `medicamentoId` (ADR-0005 D-05)                                                      | mexer em `prescricoes.medicamentos` — é o Item 4 |

---

## Item 14 — ⚠️ RETRATADO: datei o trabalho da Sprint 5 como 24/08 quando era **25/08/2026**

Escrevi `24/08/2026` nas decisões `DO-46`, `DO-47` e `DO-48`, na ADR-0012, na terceira versão da
ADR-0005 D-03, no Item 13 deste arquivo, na Sprint 5 e no `baseline.json` — **todos feitos em
25/08/2026**. A sessão anterior é que foi 24/08, e eu herdei a data dela sem conferir o relógio.

**Corrigido em 25/08/2026**, alvo por alvo. As datas legítimas de 24/08 — `DO-36` a `DO-45`, a
transcrição das RDCs, a Sprint 4 — **não foram tocadas**.

**Por que isto importa mais do que parece:** a frase citada de uma decisão do dono vale pelo par
_frase + data_. Duas decisões sobre o mesmo assunto no mesmo dia são um contexto; em dias
diferentes são uma **mudança de posição**, e quem lê depois precisa saber qual é o caso. O `DO-44`
(24/08) e o `DO-47` (25/08) são exatamente esse par: o segundo responde a pergunta que o primeiro
deixou aberta, **no dia seguinte**, depois de a transcrição das RDCs trazer dado novo. Datados no
mesmo dia, pareceriam contradição; datados certo, são o caminho.

**A regra que sai daí:** data de registro se lê do relógio (`date`), nunca da data do documento
que se está editando. Sessão que começa lendo um handoff de ontem herda a data de ontem se
ninguém conferir.

---

## Item 15 — ✅ Cartões 16 a 19 do Trello, concluídos em 25/08/2026 (fecham a Sprint 4)

| cartão | o quê                                | onde                                                                            |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------- |
| **16** | E3 — divergir alimenta o RAG         | `app/_actions/revisao-ia.ts` · `db/schema/revisoes-ia.ts` · `RevisaoHumana.tsx` |
| **17** | E7 — rascunho da revisão no servidor | `app/_actions/rascunho-revisao.ts` · `db/schema/rascunhos-revisao-ia.ts`        |
| **18** | E8 — urgência na tela                | `lib/ia-clinica/urgencia.ts` · `components/ia-clinica/SeloDeUrgencia.tsx`       |
| **19** | aba `IA Clínica` na teleconsulta     | `components/teleconsulta/PainelClinicoLateral.tsx`                              |

Decisões: `DO-49` (rótulo), `DO-50` (posição), `DO-51` (4º nível de urgência) ·
[ADR-0013](adr/ADR-0013-o-mapa-de-urgencia-mora-num-lugar-so.md) nova · ADR-0010 §5 e ADR-0011 §5
retificadas.

### 🔴 O que a implementação corrigiu no que eu tinha escrito

**O mapa de urgência não era 7→4. É 7→3, mais um derivado.** Ao medir `UrgenciaAnalise` para
implementar, os sete valores mostraram ser **dois vocabulários** — cor (`verde`/`amarelo`/
`vermelho`) e estado (`ok`/`normal`/`atencao`/`critico`) — para **três** níveis. O próprio
contrato confirma em `contrato.ts:339`: `nivel_urgencia?: 'normal' | 'atencao' | 'critico'`.

O "código roxo" de 4 níveis que eu havia descrito é do **VidAI**, e eu o repeti sem conferir o
nosso contrato. É o mesmo erro de método da retratação das contagens de guarda: **copiar um
número em vez de medi-lo**.

O 4º nível existe, mas por decisão explícita (`DO-51`) e com origem declarada: emergência **e**
`red_flags_nao_explicadas > 0` — dois campos que o motor já produz.

### O que NÃO foi feito, e por quê

- **A ingestão no corpus** — `GAP-16` (Jurídico) segue aberto. A coluna `ingeridoNoCorpusEm`
  existe e **fica vazia**, e um caso de guarda varre `app/`, `lib/` e `components/` procurando
  qualquer escrita nela. Sem a coluna, _"não ingerimos ainda"_ seria afirmação sem prova.
- **O prazo de retenção do rascunho** — decisão do Jurídico. A coluna existe e fica vazia.
- **O grafo real na aba da teleconsulta** — o motor é a Metade 2 (`DO-06`). A aba mostra o estado
  vazio, sem botão inerte.

### Achado de ambiente

🔴 **O Postgres local é um container que pode estar parado.** `behemp-postgres-dev` estava
`Exited` no meio desta sessão, e `pnpm db:migrate` falhou com `ECONNREFUSED` — erro que **não
diz** que o container caiu. Antes de culpar a migration: `docker start behemp-postgres-dev`.

---

## Item 16 — 🔴 RETRATADO: declarei os cartões 17 e 18 completos, e não estavam

Em 25/08/2026 reportei os quatro cartões (16 a 19) como entregues. O dev Davi condicionou o passo
seguinte — _"vamos para o card 7 SE e somente SE terminamos o cartão de 16 a 19 completamente"_ —
e a verificação mostrou **dois incompletos**. Ele estava certo em condicionar.

### 17 — o rascunho não protegia de "sair sem querer"

**Medido:** `grep` por `setInterval|setTimeout|beforeunload|onBlur` em `RevisaoHumana.tsx`
retornava **zero**. `salvarRascunho` só era chamada no `onClick` do botão.

**Por que isso é falhar o requisito, não uma limitação aceitável:** o `DO-41` diz literalmente
_"o médico **pode sair sem querer** e esse dado precisa ficar salvo"_. Quem sai sem querer, por
definição, **não clicou**. O mecanismo não cumpria o motivo pelo qual foi pedido — cumpria a
descrição da tela ("tem um botão de salvar rascunho"), que é coisa diferente.

**Corrigido:** auto-save com debounce de **2 s** (não por tecla — cada salvamento insere linha
nova, e salvar por tecla transformaria o histórico em ruído), mais `beforeunload` avisando quem
tenta fechar dentro da janela dos 2 s. O botão manual fica, para quem quer salvar de propósito.

⚠️ O `beforeunload` **não tenta salvar**: requisição disparada ali é cancelada pelo navegador na
maior parte das vezes, e prometer um salvamento que não acontece é pior que não prometer.

### 18 — o gatilho de urgência não estava em tela nenhuma

**Medido:** `SeloDeUrgencia` aparecia em **dois** arquivos — nele mesmo e no `PreviewGaleria.tsx`.

**Por que isso é falhar o requisito:** o `DO-42` diz _"precisamos disso **na tela**"_. Componente
que só vive no `/preview` é protótipo, não entrega. Eu construí a peça, testei a peça, e não a
montei.

**Corrigido:** montado em `PainelHipoteses.tsx`, em dois lugares e por razões diferentes:

- **selo compacto no cabeçalho**, junto da síndrome — presença permanente;
- **aviso explicado ANTES das hipóteses** — porque o nível de urgência **calibra a leitura de
  todas elas**, o mesmo raciocínio pelo qual a incompletude já aparecia antes. Em `rotina` não
  renderiza nada: aviso que aparece sempre deixa de avisar.

### O guarda também falhou, e essa é a parte que importa

Os dois passaram verdes porque o guarda checava que **o arquivo existia**, não que ele **cumpria
o motivo pelo qual foi pedido**. É uma classe de falso-verde diferente das anteriores: não é
menção × uso, é **existência × montagem**.

**Seção 6 nova no guarda**, com 6 casos: o selo está em tela de produção · o aviso vem antes das
hipóteses · o selo recebe `red_flags_nao_explicadas` (senão o 4º nível nunca acende) · o rascunho
salva sozinho · o debounce é ≥ 1 s · o botão manual continua existindo.

**4 sabotagens provam**, e duas delas reproduzem exatamente o estado anterior — o selo só no
preview, e o auto-save virando botão manual.

### A regra que sai daí

**Guarda de entrega verifica MONTAGEM, não existência.** Perguntar "o arquivo existe?" aprova
protótipo. A pergunta é "alguma tela de produção o monta?" — e, quando o requisito diz _como_ a
coisa deve funcionar ("salvar sem que o médico clique"), o guarda tem de checar **o mecanismo**,
não o rótulo do botão.

---

## Item 17 — 🔴 Dois dos três seeds não recusam rodar em produção, e 37 de 44 tabelas ficam sem dado

**Achado em 25/08/2026**, ao preparar os cartões 20 e 21 do Trello (mapeamento e seed). Os dois
achados são da mesma família e bloqueiam o QA de ponta a ponta.

### 17.1 — 🔴🔴 `db/seed.ts` e `db/seed-produtos.ts` NÃO têm a trava de produção

**Medido:** `grep NODE_ENV db/seed*.ts` acusa **um** arquivo de três.

| arquivo                   | trava                                                  |
| ------------------------- | ------------------------------------------------------ |
| `db/seed-perfis-teste.ts` | ✅ **dupla** — `NODE_ENV=production` **e** URL de Neon |
| `db/seed.ts`              | 🔴 **nenhuma**                                         |
| `db/seed-produtos.ts`     | 🔴 **nenhuma**                                         |

**A convenção do `CLAUDE.md` é explícita** (seção _"Onde script, teste e seed moram"_): seed
_"recusa rodar com `NODE_ENV=production`; idempotente; sem identificador real"_. Dois violam.

**Por que a trava dupla do `seed-perfis-teste.ts` é o padrão certo**, e está escrito no próprio
arquivo (`:15-16`): `NODE_ENV` **pode simplesmente não estar definido** num terminal qualquer.
Uma trava que depende de variável ausente não é trava. A segunda verificação — a URL apontar para
Neon — pega o caso em que alguém carregou o `.env` de produção sem definir `NODE_ENV`.

**O risco concreto:** `pnpm db:seed` com a variável de produção carregada insere **paciente
fictício no banco real**. Num sistema de saúde, dado fictício misturado a dado clínico real não é
inconveniente de ambiente — é **contaminação de prontuário**, e não há como distinguir depois
sem auditoria linha a linha.

⚠️ E o momento agrava: o próximo passo do projeto é justamente **rodar seed para preparar o QA**
(`DO-53`). É exatamente quando alguém digita `pnpm db:seed` sem pensar duas vezes.

**Perigo de mexer: BAIXO.**

- a mudança é **aditiva**: um bloco de guarda no início da função, antes de qualquer `insert`
- o padrão a copiar **já existe e funciona** — `db/seed-perfis-teste.ts:60`
- nada no comportamento em desenvolvimento muda
- ⚠️ o único efeito colateral possível é o seed **parar de rodar** onde hoje roda, se o ambiente
  estiver mal configurado — o que é o objetivo

### 17.2 — 37 de 44 tabelas ficam sem dado nenhum

**Medido:** os três seeds populam **7** tabelas — `users`, `pacientes`, `medicos`,
`medicamentos`, `gruposChat`, `participantesGrupo`, `alertasConfig`. O schema tem **44**.

**Ficam vazias**, entre outras: `triagens`, `consultas`, `teleconsultas`, `anamneses`,
`medidasDesfecho`, `rastreioUsoCannabis`, `dosagens`, `ajustesDosagem`, `itensAjusteDosagem`,
`prescricoes`, `revisoesIa`, `rascunhosRevisaoIa`, `notificacoes`, `exames`,
`autorizacoesAnvisa`, `recompras`, `evolucoes`.

**O que isso significa na tela:** existe médico, existe paciente, existe catálogo — e **não
existe um tratamento acontecendo**. Nenhuma consulta, nenhuma dose, nenhum ajuste, nenhum
histórico.

🔴 **Por que isso bloqueia o QA e não é só desconforto:** o produto tem um encadeamento de
bloqueios — paciente sem triagem não chega à teleconsulta, sem consentimento dos dois lados a
sala não abre, sem conduta não há titulação. Quem testar a sexta tela sem dado nas cinco
primeiras encontra tela vazia — e **tela vazia é indistinguível de bug para quem testa**.

**O caso mais concreto do custo:** o 4º nível de urgência (`DO-51`) só acende com emergência
**e** red flag não explicada ao mesmo tempo. Sem um paciente com essa combinação no seed, esse
nível existe no código, está coberto por guarda, e **nunca é visto por um humano** antes de um
paciente real.

### O que fazer, e em que ordem

1. **Cartão 20** — mapear quais cenários o seed precisa criar, e o que cada um torna visível
2. **Cartão 21** — escrever o seed, com a trava dupla **antes de qualquer `insert`**, e
   acrescentar a mesma trava nos dois seeds antigos
3. **Cartão 7** — só então o QA de ponta a ponta

⚠️ **A trava dos dois seeds antigos entra no Cartão 21, não em commit separado.** É exceção
consciente à regra de _"corrigir em trabalho próprio"_: rodar um seed sem trava **para preparar o
QA** é a situação de risco, e corrigir depois seria correr o risco primeiro.

### Guarda que isto pede — depois da correção, não antes

`todo-seed-recusa-producao`: varre `db/seed*.ts` e exige que **cada** arquivo tenha as duas
travas antes do primeiro `insert`. Nasce vermelho nos dois atuais — por isso entra **junto** com
a correção, e não antes (`.claude/rules/seguranca-lgpd.md`: guarda que acusa violação conhecida e
não corrigida é guarda que alguém desliga).

---

## Item 18 — ✅ Integração ChatPro, implementada e testada em 09/09/2026

**O que foi pedido:** replicar na BeHemp a integração com o ChatPro que já roda **validada em
produção** no `greens-corp` (_"O QUE ESTÁ LÁ JÁ ESTÁ VALIDADO O USO"_), com uma diferença de
fluxo: aqui o bot coleta **nome completo + e-mail**, e lá só o nome. Ao final, o link leva à
página de cadastro que a **Dryelle** está construindo.

**Decisões:** `docs/adr/ADR-0015`. **Configuração manual:** `docs/chatpro/COMO-CONECTAR-NO-PAINEL.md`.
**Contrato da tela:** `docs/chatpro/CONTRATO-DA-PAGINA-DE-CADASTRO.md`.

### O que existe no disco

| camada                               | arquivo                                                                                              |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| normalização de telefone             | `lib/chatpro/telefone.ts`                                                                            |
| segredo em tempo constante           | `lib/chatpro/segredo.ts`                                                                             |
| cliente da CHAT API                  | `lib/chatpro/cliente.ts`                                                                             |
| texto da mensagem (puro)             | `lib/chatpro/mensagem-do-link.ts`                                                                    |
| núcleo: cria/reaproveita solicitação | `lib/chatpro/solicitacao.ts`                                                                         |
| tradução de UUID → nome              | `lib/chatpro/diretorio.ts`                                                                           |
| consumo da fila de eventos           | `lib/chatpro/processador.ts`                                                                         |
| validação do token do link           | `lib/chatpro/token-de-cadastro.ts`                                                                   |
| rotas                                | `app/api/chatpro/{bot-link,intake,start,processar}/`, `webhook/[pathToken]/`, `solicitacao/[token]/` |
| tabelas                              | `solicitacoes_cadastro`, `chatpro_eventos`, `chatpro_diretorio`, `chatpro_sessoes`                   |
| migrations                           | `0025_sudden_forge.sql`, `0026_bumpy_red_hulk.sql` — **zero destrutivo**                             |

### Como foi provado

**31 testes ao vivo** contra o servidor local, com o banco conferido a cada passo: segredo
ausente/errado/certo, reaproveitamento de protocolo com token novo, paciente novo, contato não
identificado, intake JSON, nome de uma palavra, webhook com token errado/certo, limpeza de
conteúdo clínico, processamento do lote, vínculo conversa↔solicitação, contador de mensagens, e
os quatro estados de recusa do link.

**417 casos em 12 guardas**, verdes. Os dois do ChatPro somam **95 casos** e foram provados por
**18 sabotagens**, todas acusadas. `pnpm build` exit **0**, com as 6 rotas presentes.

### 🔴 O que NÃO foi feito, e por quê

| #   | o que                             | por quê                                                                                             |
| --- | --------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | A tela `/cadastro/{token}`        | é trabalho da **Dryelle**. O que entreguei é o contrato que ela consome                             |
| 2   | Migration aplicada no **Neon**    | só rodou no Postgres local (`localhost:5436`). Produção é decisão de deploy                         |
| 3   | Configuração do painel do ChatPro | tarefa do dono — o guia está pronto no `COMO-CONECTAR-NO-PAINEL.md`                                 |
| 4   | Cron do processador ligado        | idem. Enquanto não estiver, eventos acumulam em `pendente` — nada se perde, mas o funil não se move |
| 5   | Teste com WhatsApp real           | exige URL pública e as credenciais do passo 1                                                       |

---

## Item 19 — 🔴 CATALOGADO: PII na query string chega ao log do proxy, que não é código nosso

**Descoberto em 09/09/2026**, lendo o que o greens-corp aprendeu com paciente real
(`HERANCA-CHATPRO-DAVI-DRYELLE.md`, atualizado em 08/09/2026 — "defeito novo 2").

**O problema.** O bloco "Requisição externa" do ChatPro chama por **GET com query string**. Lá a
query carrega `name` e `number`; **na BeHemp carrega também `email`**:

```
/api/chatpro/bot-link?name=Joana+Ribeiro+Alves&email=joana@exemplo.com&sessionId=…
```

Lá, o log da aplicação mascarava (`+559****4822`) e **o log HTTP genérico gravou a URL inteira em
texto puro**, em arquivo. Viola a regra de nunca registrar telefone em log, e é dado pessoal do
art. 11 gravado em disco.

**O nosso estado, medido:** nenhum arquivo de `app/api/chatpro/` ou `lib/chatpro/` imprime
`request.url`, `nextUrl.href` ou a query — conferido por varredura, e o guarda
`chatpro-nao-confia-no-que-chega` mantém isso (o caso quebra se telefone ou e-mail aparecer em
bloco de `console.*`).

**O que continua exposto, e é fora do código:** o **nginx/proxy à frente** (DT-006/DT-008: EC2 +
PM2) grava `access_log` com a URL completa por padrão. Nenhuma linha de TypeScript impede isso.

**O perigo de mexer:** baixo em código (não há o que mudar), médio em infraestrutura — mexer em
`access_log` afeta o diagnóstico de todas as rotas, não só desta.

**As saídas, em ordem de custo:**

| #   | saída                                                        | custo              | efeito                                               |
| --- | ------------------------------------------------------------ | ------------------ | ---------------------------------------------------- |
| 1   | `access_log off;` **só** no `location /api/chatpro/bot-link` | baixo              | resolve o caso, mantém o resto                       |
| 2   | formato de log sem `$query_string` para esse location        | baixo              | idem, preservando o `path`                           |
| 3   | mudar o canal para POST                                      | **não disponível** | o bloco do painel chama por GET; não é escolha nossa |

⚠️ **Não corrigido nesta tarefa** — é infraestrutura, está fora do escopo pedido, e exige
autorização (`CLAUDE.md`, seção de escopo). **Fica catalogado com o perigo medido.**

---

## Item 20 — ✅ A tela de cadastro do link do WhatsApp, construída em 09/09/2026

**O que foi pedido:** a tela que a Dryelle ia construir passou a ser nossa. Campos definidos
pelo dono: **nome, CPF, telefone, e-mail, senha** e _"já faz tratamento?"_ com caixa de texto
quando a resposta é sim. Motivo declarado: _"imagine o paciente que chegou na Greens ou na
BeHemp e não possui receita, ele teria que fazer a nossa teleconsulta"_. O mesmo link serve os
dois negócios — _"o WhatsApp da Greens vai enviar o link que criaremos da BeHemp"_.

### O que existe no disco

| camada                                                          | arquivo                                                                     |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| a tela (Server Component, valida o token antes de pintar campo) | `app/(auth)/cadastro/[token]/page.tsx`                                      |
| o formulário (client, duas etapas do Clerk)                     | `app/(auth)/cadastro/[token]/_components/formulario-de-cadastro.tsx`        |
| a action que grava                                              | `app/_actions/cadastro-por-link.ts`                                         |
| validação de CPF por dígito verificador                         | `lib/validacao/cpf.ts`                                                      |
| guarda                                                          | `__tests__/guardas/cadastro-por-link-abre-sem-conta.test.ts` — **32 casos** |
| migration                                                       | `0027_magenta_shockwave.sql` — 5 `ADD COLUMN`, **zero destrutivo**          |

**Fluxo:** dados + senha → conta no Clerk (e-mail é o login) → código de 6 dígitos → sessão →
ficha gravada → **agendar teleconsulta**.

**Visual:** aurora de três manchas em movimento lento usando **só** `--primary`, `--secondary` e
`--color-peach`; sombra em duas camadas; validação com retorno imediato por campo; medidor de
força de senha; a caixa de texto do tratamento cresce por `grid-rows` quando a resposta é "sim".
Sem `framer-motion` (proibição 3) e sem cor nova. O CSS da aurora fica **no arquivo da página**,
via `<style precedence>` do React 19 — decoração de uma tela não engorda o design system global.
Respeita `prefers-reduced-motion`.

---

## Item 21 — 🔴 CORRIGIDO: o middleware bloquearia a integração inteira em produção

**Descoberto em 09/09/2026**, ao construir a tela. É o defeito mais grave desta frente, e o
mais fácil de não ver.

**O problema.** O middleware do Clerk protege tudo por padrão, e seu matcher declara
_"sempre roda para API routes"_. Nem `/cadastro/{token}` nem **`/api/chatpro/*`** estavam na
lista de rotas públicas (`middleware.ts:16-45`).

| quem                  | o que aconteceria em produção                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| o paciente            | clica no link do WhatsApp → cai no **login** → para se cadastrar, precisaria já estar cadastrado |
| o servidor do ChatPro | chama `/bot-link` → recebe **redirect** → o bot registra falha e transfere para a triagem humana |
| quem depurasse        | **não veria nada no log da aplicação** — a requisição nunca chega à rota                         |

🔴 **E os 31 testes ao vivo passaram verdes.** O `.env` de desenvolvimento está **sem as chaves
do Clerk** (`CLERK_SECRET_KEY` e `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ausentes, medido), e sem
elas o middleware não bloqueia nada. Nenhuma execução local acusaria: foi preciso **ler** o
middleware.

**A regra que sai daí:** _teste que passa por ausência de configuração não testou nada._ Mesma
família do que o greens-corp viveu — 72 horas de log vazio que pareciam "não configurado" e
eram "o fluxo nunca chegou".

**Corrigido:** `'/cadastro(.*)'` e `'/api/chatpro(.*)'` na lista pública, cada um com o motivo
escrito ao lado. Não ficam desprotegidos — o token de 64 hex é a credencial do `/cadastro`, e as
rotas do ChatPro têm autenticação própria (segredo em tempo constante, token no caminho,
`CRON_SECRET`). Provado por sabotagem, com um caso de **CONTROLE** que fica vermelho se alguém
"resolver" liberando `/medico`, `/admin` ou `/paciente`.

⚠️ **O que isto sugere e NÃO foi feito:** varrer as demais rotas de API do repositório
procurando outras que dependam do middleware sem estar na lista — ou que estejam na lista sem
precisar. É trabalho próprio, fora do escopo desta tarefa, e exige autorização.

---

## Item 22 — 📋 Handoff do cadastro da Greens → BeHemp (ADR-0016)

**Decidido em 09/09/2026**, com rodadas de pesquisa antes: os dados vão por back-channel
assinado e só o token viaja com o paciente. Decisões, rejeitados e fontes em
[ADR-0016](adr/ADR-0016-o-cadastro-da-greens-chega-por-back-channel-e-so-o-token-viaja.md).
Espelho do lado da Greens: `greens-corp-backend/docs/adr/ADR-0027`.

### 🔴 Bloqueado por (não começar antes)

| #   | o quê                                                                                                                                           | dono    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | **A atualização do formulário da Greens** — a Dryelle vai subir. A lista de campos de 09/09 precisa ser reconferida antes de congelar o payload | Dryelle |
| 2   | O **aceite** do paciente no fluxo do intake (base legal da transferência) — já está sendo tratado lá                                            | Dryelle |
| 3   | O segredo compartilhado `GREENS_HANDOFF_SECRET` nos dois `.env`                                                                                 | dono    |

### Entregáveis — lado BeHemp (quem recebe)

| #   | entregável                                                                                                                                  | aceite                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `lib/parceiros/assinatura.ts` — HMAC-SHA256 sobre `id + timestamp + corpo`, comparação em tempo constante, janela de **300 s**              | recusa assinatura errada, corpo alterado e carimbo fora da janela   |
| 2   | `POST /api/parceiros/greens/cadastro` — valida, cria `solicitacoes_cadastro` com `origem = 'greens_handoff'`, devolve `{ token, expiraEm }` | id repetido devolve o **mesmo** token, não cria segunda solicitação |
| 3   | Enum `solicitacaoCadastroOrigemEnum` + `'greens_handoff'`, e as colunas do manifesto de documentos                                          | migration aditiva; nenhuma coluna obrigatória sem default           |
| 4   | A rota do middleware liberada (`/api/parceiros(.*)`)                                                                                        | **não esquecer** — foi o `Item 21`, e o sintoma é log vazio         |
| 5   | Tela `/continuar/{token}` — dados preenchidos e editáveis, senha, código de 6 dígitos, `clerk-captcha`                                      | e-mail que já tem conta vai para o login (D-07)                     |
| 6   | Pendências dos 5 documentos visíveis e **não bloqueantes**                                                                                  | conclui o cadastro com zero documento                               |
| 7   | Encaminhar para `/paciente/anvisa` (a procuração **já existe**, não se cria)                                                                | chega na procuração logado                                          |
| 8   | Botão de volta ao **login da Greens** ao fim da procuração                                                                                  |                                                                     |
| 9   | Os 4 guardas do §4 da ADR                                                                                                                   | nascem vermelhos, provados por sabotagem                            |

### O que fica de fora, declarado

**A cópia dos arquivos** (fase 2). Fase 1 move dados de texto e o manifesto. Copiar blob de
saúde entre empresas exige URL assinada na origem, validação de MIME e tamanho no destino, store
**privado** e prazo de retenção — e o `Item 6` registra que este repositório já tem 10+ uploads em
store público, defeito conhecido e não corrigido. Código novo não repete isso.

---

## Item 23 — 📋 As três portas de entrada, e o caminho de volta (ADR-0016, 0017, 0018)

**Decidido em 09/09/2026.** Três formas de o mesmo paciente chegar, um só corredor depois — e,
para quem veio da Greens, um **retorno automático** com o que ficou pronto aqui.

```
              PACIENTE SEM RECEITA NOSSA / SEM ANVISA
                              │
     ┌────────────────────────┼────────────────────────┐
  formulário               WhatsApp                 WhatsApp
  da GREENS                da BEHEMP                da GREENS
     │ ADR-0016               │ ADR-0017              │ ADR-0018
     └────────────────────────┼────────────────────────┘
                              ▼
       solicitacoes_cadastro · mesma tela · mesma procuração
                              ▼
                  receita emitida / ANVISA concluída
                              │
                              ▼  (só para quem veio da Greens)
              ADR-0016 D-09 · retorno automático ──► Greens
```

### Ordem de execução, e o porquê dela

| #   | item                                               | por que nesta posição                                                     |
| --- | -------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | **ADR-0016 ida** — recebe o cadastro da Greens     | é o único fluxo cujas duas pontas estão paradas hoje                      |
| 2   | **ADR-0016 D-09 volta** — devolve receita e ANVISA | a ADR-0018 **depende** deste canal; construí-lo aqui evita construir dois |
| 3   | **ADR-0017** — gatilho do bot da BeHemp            | a mecânica já está pronta (ADR-0015); falta só a regra de quando ofertar  |
| 4   | **ADR-0018** — bot da Greens com link da BeHemp    | precisa do canal de volta (2) e da regra de gatilho (3)                   |

🔴 **O item 2 antes do 4 é o que evita retrabalho.** Se a ADR-0018 fosse implementada primeiro,
ela criaria seu próprio caminho de volta — e teríamos duas rotas fazendo a mesma coisa, que é o
R-05 daquela ADR.

### Bloqueios, por item

| item          | bloqueado por                                                                    | dono           |
| ------------- | -------------------------------------------------------------------------------- | -------------- |
| ADR-0016      | atualização do formulário da Greens · aceite no intake · segredo nos dois `.env` | Dryelle / dono |
| ADR-0016 D-09 | segredo **do sentido de volta** (diferente do de ida)                            | dono           |
| ADR-0017      | nada técnico — a mecânica está no PR #36                                         | —              |
| ADR-0018      | o canal de volta pronto · credenciais da conta de ChatPro **da Greens**          | nós / dono     |

### 🔴 Duas regras que valem nas três, e não são técnicas

**1. Quem confere a receita é gente.** Manual, no painel da BeHemp, depois do envio de tudo
(ADR-0017 D-02). O dono declarou que virá IA ou orquestração — e quando vier, entra como decisão
própria, não como descoberta.

**2. A tela nunca diz que a receita é inválida.** A regra real é "só serve receita do nosso
receituário", e ela é **interna**. Receita de outro médico é **legalmente válida**: uma tela que
diga o contrário faz afirmação falsa sobre o ato de outro profissional. O que a tela diz — e é
verdade — é _"em análise"_ e _"você precisa de uma avaliação com um médico parceiro"_. Vale **nos
dois sistemas**, e pesa mais na Greens, que fala com o paciente primeiro.

### O que fica de fora das três, declarado

**Os arquivos** (fase 2, nas duas direções): manifesto agora, blob depois.
**A automação da conferência** (ADR-0017 §5): declarada como futura, com dono e sem data.

---

## Item 24 — ✅ Lado BeHemp da ADR-0016 (ida), implementado em 09/09/2026

**O que foi feito:** a ponta que **recebe** o cadastro que vem da Greens. A ponta que envia é
trabalho de lá (ADR-0027), e o caminho de volta (D-09) é item próprio.

### O contrato, que estava escondido no schema da Greens

O `§6.1` bloqueou esta implementação até o `CONTRATO §4/§6` ser cruzado. Ele **não existe como
documento** — é citado no schema e nunca foi escrito. O schema é a fonte, e especifica:

| campo (lá)         | o que fixa                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `behempReferralId` | `VarChar(64)`, **nosso** id · _"é por ele que o webhook da Behemp localiza a solicitação"_ |
| — não é `@unique`  | deliberado: unique faria reentrega de webhook virar erro 500                               |
| `behempJourney`    | `!= NONE` → **Mercado Pago com desconto collab**; `NONE` → Cannect                         |

🔴 **Isso muda o peso do handoff:** ele não decide só um cadastro — decide **o gateway e o preço
de uma compra**. A idempotência deixou de ser higiene e virou requisito de dinheiro.

### O que existe no disco

| camada                         | arquivo                                                                          |
| ------------------------------ | -------------------------------------------------------------------------------- |
| HMAC + janela de 300 s         | `lib/parceiros/assinatura.ts`                                                    |
| recebe, idempotente por evento | `lib/parceiros/handoff.ts`                                                       |
| rota                           | `app/api/parceiros/greens/cadastro/route.ts`                                     |
| rota liberada do Clerk         | `middleware.ts` — `'/api/parceiros(.*)'`                                         |
| campos                         | `parceiro`, `evento_do_parceiro`, `pedido_do_parceiro` + origem `greens_handoff` |
| migration                      | `0028_plain_pretty_boy.sql` — **zero destrutivo**                                |
| guarda                         | `handoff-do-parceiro-e-assinado-e-idempotente` — **29 casos**, 13 sabotagens     |

### Como foi provado, ao vivo

| #   | teste                                                        | resultado                                           |
| --- | ------------------------------------------------------------ | --------------------------------------------------- |
| 1–3 | sem assinatura · assinatura errada · fora da janela (10 min) | **401** nos três                                    |
| 4   | assinatura correta                                           | **200** com `referralId` (cuid2, cabe nos 64)       |
| 5   | 🔴 **reenvio do mesmo evento**                               | **mesmo** `referralId` e protocolo, `reenvio: true` |
| 6   | corpo adulterado com assinatura do original                  | **401**                                             |
| 7   | `eventoId` do corpo divergindo do cabeçalho                  | **422 EVENTO_DIVERGENTE**                           |
| 8   | sem e-mail nem telefone                                      | **422 CONTATO_INSUFICIENTE**                        |
| 9   | banco após o reenvio                                         | **1 linha**, não duas                               |
| 10  | o paciente abre o link                                       | nome, e-mail e telefone da Greens pré-preenchidos   |

### 🔴 Dois defeitos que o próprio processo pegou

**1. O corpo sobrescrevia o `eventoId` do cabeçalho.** O `...analise.data` vinha **depois** do
`eventoId` — o oposto do que o comentário ao lado afirmava. O `tsc` acusou (`TS2783`).
**Corrigido eliminando a classe:** campo a campo, sem spread. Trocar a ordem resolveria o caso de
hoje; proibir o spread impede que um campo novo no corpo, amanhã, alcance parâmetro que ninguém
listou de propósito. O guarda cobra a ausência do spread, não a ordem.

**2. O container do Postgres estava parado** e o `db:migrate` falhava com erro que não diz isso.
Já catalogado antes; repetiu.

### O que fica de fora, declarado

| #   | o quê                                         | por quê                          |
| --- | --------------------------------------------- | -------------------------------- |
| 1   | O **caminho de volta** (ADR-0016 D-09)        | item próprio; precede a ADR-0018 |
| 2   | A ponta que **envia**, na Greens              | ADR-0027, trabalho de lá         |
| 3   | Cópia dos 5 arquivos                          | fase 2, nas duas direções        |
| 4   | `PARCEIRO_GREENS_SEGREDO_ENTRADA` em produção | segue com o dono                 |

---

## Item 25 — ✅ O caminho de volta (ADR-0016 D-09), implementado em 09/09/2026

A BeHemp avisa a Greens quando receita ou ANVISA ficam prontas, para o pedido do paciente
destravar lá **sem ninguém digitar nada**. É a segunda direção do mesmo par.

### A decisão de desenho que sustenta tudo: fila, não `fetch`

O aviso nasce no instante em que o médico assina. Um `fetch` direto ali tem **dois** modos de
falha, os dois silenciosos:

| se…                                   | o que aconteceria                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| a Greens estiver fora naquele segundo | o aviso **se perde para sempre** — e ninguém descobre: o médico viu a receita ser assinada, o sistema não reclamou, e o pedido nunca destrava lá |
| a Greens estiver **lenta**            | a tela do médico **trava** esperando um parceiro comercial responder                                                                             |

Gravando primeiro, indisponibilidade vira **atraso**, não perda. E `notificarParceiro` **nunca
lança**: quem a chama está no meio de um ato clínico, e falhar em avisar não pode impedir alguém
de prescrever.

### O que existe

| camada                      | arquivo                                                          |
| --------------------------- | ---------------------------------------------------------------- |
| fila durável                | `db/schema/parceiro-eventos-saida.ts`                            |
| enfileira (nunca lança)     | `lib/parceiros/notificar.ts`                                     |
| entrega com retry e backoff | `lib/parceiros/enviador.ts`                                      |
| cron                        | `app/api/parceiros/enviar/route.ts`                              |
| migration                   | `0030_lame_madripoor.sql` — **zero destrutivo**                  |
| guarda                      | `o-aviso-ao-parceiro-nao-se-perde` — **19 casos**, 13 sabotagens |

### 🔴 Uma diferença de índice que parece inconsistência e não é

| fila                                  | índice    | por quê                                                                                        |
| ------------------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| **entrada** (`solicitacoes_cadastro`) | **comum** | o remetente é o ChatPro/Greens; a reentrega deles é normal e precisa ser absorvida em silêncio |
| **saída** (`parceiro_eventos_saida`)  | **único** | quem cria somos **nós**; criar duas vezes seria bug nosso — e bug nosso deve estourar          |

### Provado ao vivo, contra um servidor que faz o papel da Greens

| #   | cenário                 | resultado                                                     |
| --- | ----------------------- | ------------------------------------------------------------- |
| 1   | entrega normal          | **200**, e a assinatura **conferiu do outro lado**            |
| 2   | Greens fora do ar (500) | reagendado, volta a `pendente`, **não se perde**              |
| 3   | cron antes da hora      | **0 reivindicados** — respeitou o backoff                     |
| 4   | Greens volta            | entregue com o **mesmo id do evento**                         |
| 5   | resposta 400            | **`falhou` na 1ª tentativa** — 4xx não se conserta insistindo |
| 6   | mesmo fato duas vezes   | `duplicate key`, **1 aviso** no banco                         |

⚠️ **O que NÃO foi testado:** a rota real da Greens — ela ainda não existe. O teste foi contra
servidor falso, que prova assinatura, retry, backoff e idempotência, **não** a integração real.
Isso só é possível depois que o lado deles subir.

### O que falta para funcionar de verdade

| #   | pendência                                                                                             | dono             |
| --- | ----------------------------------------------------------------------------------------------------- | ---------------- |
| 1   | A rota `POST /api/parceiros/behemp/atualizacao` na Greens                                             | Claude da Greens |
| 2   | `PARCEIRO_GREENS_SEGREDO_SAIDA` e `PARCEIRO_GREENS_API_URL` no `.env`                                 | dono             |
| 3   | Cron de `/api/parceiros/enviar`                                                                       | dono/deploy      |
| 4   | 🔴 **O GATILHO** — chamar `notificarParceiro()` quando a receita é assinada e quando a ANVISA conclui | ver abaixo       |

### 🔴 O gatilho NÃO foi ligado, e isso é deliberado

`notificarParceiro()` existe e funciona, mas **nada a chama ainda**. Ligá-la exige tocar o fluxo
de receituário (`lib/receituario/`) e o de ANVISA — as duas **áreas protegidas pelo hook
`escopo-autorizado`**, as duas em produção, e o `CLAUDE.md` é explícito: achado ou mudança fora do
escopo se **cataloga e pede autorização**, não se faz de passagem.

**O custo de mexer, medido:** dois pontos de chamada, uma linha cada, ambos em código clínico que
já roda. **O custo de deixar:** a fila existe e fica vazia — nenhum aviso é gerado.

**Peço autorização para ligar os dois gatilhos como trabalho próprio, em commit próprio.**

---

## Item 26 — 🔴 CATALOGADO: `users.telefone` é texto livre, e isso impede casar paciente por telefone

**Descoberto em 09/09/2026**, ao investigar se o bot da BeHemp poderia reconhecer sozinho um
paciente que já existe.

### O diagnóstico

Quatro caminhos gravam `users.telefone`. **Nenhum normaliza:**

| ponto                                           | `caminho:linha`                         | formato que grava                                                                            |
| ----------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| webhook do Clerk — **todo cadastro passa aqui** | `app/api/webhooks/clerk/route.ts:147`   | `phone_numbers[0]` (E.164) **ou** `unsafe_metadata.phone` — **misto**                        |
| médico cadastrando à mão                        | `app/(medico)/_actions/pacientes.ts:17` | `z.string().optional()` — **texto livre, zero validação**                                    |
| admin editando                                  | `app/(admin)/_actions/usuarios.ts:145`  | regex `^[\d\s()\-+]{8,20}$` — aceita `(62) 99999-9999`, `62999999999` **e** `+5562999999999` |
| cadastro por link (novo)                        | `app/_actions/cadastro-por-link.ts`     | ✅ E.164 — **o único que normaliza**                                                         |

O campo é **texto livre na prática**. Comparar por igualdade de string falha na maioria dos
casos — e falha **em silêncio**: quem procura conclui "não existe" em vez de "não sei dizer".

### O perigo de mexer, medido

|                                      |                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| pontos de escrita                    | **4**                                                                                |
| está em produção?                    | **sim** — os quatro                                                                  |
| existe teste que prove antes/depois? | **não**                                                                              |
| o que quebra ao normalizar           | nada em leitura (é só exibição hoje); a migração de dados é o risco real             |
| proporção de dados sujos             | 🔴 **NÃO MEDIDA** — o banco local tem 1 paciente e 0 telefones. Só produção responde |

### O custo de deixar

Enquanto isso vale, **nenhum lugar do sistema consegue reconhecer um paciente pelo telefone** —
não é limitação do bot, é do campo. Vale para o ChatPro, para o atendimento e para qualquer
integração futura que receba um número de fora.

### Duas correções, e elas são independentes

1. **Normalizar na comparação** (barato, sem migração): comparar só os dígitos. Resolve
   formatação e DDI; **não resolve** o celular antigo sem o 9.
2. **Normalizar o campo** (migração de dados): resolve de verdade. Exige backup, script
   idempotente, e medir antes quantas linhas mudam.

⚠️ **Nenhuma das duas foi feita.** A (1) entra na ADR-0017 como auxílio de busca — nunca como
decisão. A (2) precisa de autorização e é trabalho próprio.

---

## Item 27 — ✅ ADR-0017 implementada: a triagem do bot da BeHemp

**O que faltava:** a ADR-0015 resolveu **como** o link nasce; faltava **quando** oferecê-lo.

### O que existe

| camada                                   | arquivo                                                      |
| ---------------------------------------- | ------------------------------------------------------------ |
| o gatilho (consulta receita e ANVISA)    | `lib/chatpro/triagem.ts`                                     |
| interpreta o que o paciente escreveu     | `lib/chatpro/resposta-do-paciente.ts`                        |
| os textos, e o que eles nunca dizem      | `lib/chatpro/texto-da-triagem.ts`                            |
| a rota (`text/plain`, como o `bot-link`) | `app/api/chatpro/triagem/route.ts`                           |
| guarda                                   | `a-triagem-roteia-e-nao-julga` — **44 casos**, 14 sabotagens |

### 🔴 O defeito que só apareceu no teste ao vivo

A primeira versão interpretava a resposta com `/^(sim|nao|não|n|s)$/` — âncora total,
palavra exata. Testei com as respostas que uma pessoa dá de verdade:

| o paciente escreve     | a 1ª versão entendia | consequência                                     |
| ---------------------- | -------------------- | ------------------------------------------------ |
| `"não"`                | ✅ não tem           | ok                                               |
| **`"Não, ainda não"`** | ❌ **"não sei"**     | 🔴 **o link NÃO era oferecido a quem precisava** |
| `"Ainda não tenho"`    | ❌ "não sei"         | idem                                             |
| `"tenho mas venceu"`   | ❌ "tem"             | 🔴 mandado para o caminho errado                 |

**O paciente não escolhe entre opções — ele conversa.** A correção lê negação e afirmação
**no texto**, e trata menção a vencimento como não-ter: _"tenho, mas venceu"_ é afirmação
seguida de uma informação que a anula.

⚠️ **A negação é procurada ANTES da afirmação**, e a ordem não é detalhe: **"não tenho"
contém "tenho"**. Na ordem inversa, toda negação viraria afirmação.

### O que a tela nunca diz, e a única exceção

| ❌ nunca                        | ✅ e é verdade                                         |
| ------------------------------- | ------------------------------------------------------ |
| "sua receita é inválida"        | "você precisa de uma avaliação com um médico parceiro" |
| "não aceitamos receita de fora" | "seu documento está em análise"                        |

🔴 **A exceção é o vencimento**, e ela é nomeada: _"sua receita está vencida — receitas de
canabidiol valem 30 dias"_. É fato objetivo, regra pública (RDC 1.015/2026), e **não julga
quem a emitiu**. Esconder tiraria do paciente algo que ele confere sozinho no documento.

O guarda varre o **arquivo de textos**, não só o resultado das funções — um texto novo,
amanhã, também é alcançado.

### Provado ao vivo

| cenário                                   | resultado                                |
| ----------------------------------------- | ---------------------------------------- |
| receita vigente + ANVISA                  | não oferece · `tem_tudo`                 |
| receita **vencida**                       | oferece · **e diz que venceu**           |
| receita ok, sem ANVISA                    | oferece · _"nós cuidamos dela com você"_ |
| só **rascunho** de receita                | oferece — rascunho não é documento       |
| paciente diz "não tenho" contra a base    | **oferece** — a resposta dele vence      |
| a palavra "inválida" em qualquer resposta | **0 ocorrências**                        |

E a busca por dígitos casou os **quatro** formatos gravados: `(62) 98111-1111`,
`+5562982222222`, `62983333333` e `(62) 9 8444-4444`.

### O que fica de fora

**A configuração do fluxo no painel** — quem chama esta rota e o que faz com o cabeçalho
`x-triagem-motivo` é decisão do painel, não do código. Guia para o dono no
`docs/chatpro/COMO-CONECTAR-NO-PAINEL.md`.

## Item 28 — ✅ CORRIGIDO: o deploy passava verde e produção servia um build antigo

**Descoberto em 10/09/2026.** Entre 14/08 e 10/09 **nenhum deploy chegou ao processo em
produção**. O Actions reportava sucesso, o rsync entregava os arquivos, o PM2 reiniciava — e
o site continuava servindo um build anterior. Não havia erro em log nenhum.

### O diagnóstico

Três defeitos independentes cooperavam. **Cada um sozinho já bastava para esconder o problema.**

| #   | defeito                                                        | efeito                                                    |
| --- | -------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | `package.json:7` — o script `build` terminava em `\|\| true`   | build quebrado devolvia **exit 0**                        |
| 2   | `deploy.yml` — `pm2 restart … \|\| pm2 start …`                | `restart` **reusa o caminho gravado** e não relê o script |
| 3   | nenhum passo conferia se produção passou a servir o build novo | "verde" não significava nada                              |

O (2) é a causa direta, e é comportamento documentado do PM2 ([Unitech/pm2#3054](https://github.com/Unitech/pm2/issues/3054)):
trocar o `script` e reiniciar mantém o arquivo antigo em execução. `--update-env`, `reload` e
`startOrReload` **não** corrigem — só `delete` + `start`.

**Medições que fecharam o caso:**

- produção redirecionava para `/entrar` até uma rota **inexistente** → o middleware em
  execução não era o do build entregue
- um chunk do build da vez respondia **404** em produção → quem serve os estáticos é o
  processo, e o processo era outro
- a Dryelle mediu no servidor, em 09/09: `.next/standalone/server.js` com **mtime de 14/08**
- o `git pull` + `pnpm build` manual dela **funcionou** justamente por rodar no diretório de
  onde o PM2 executa — o que confirma que rsync e PM2 estavam em diretórios diferentes

### 🔴 O risco que a correção precisou desarmar antes

`pm2 delete` não apaga arquivo, log nem código — mas **descarta o ambiente vivo do processo**.
E medimos: o deploy escrevia **12** variáveis no `.env`, enquanto `lib/env.ts` declara **61**.
As outras 49 — `CLERK_SECRET_KEY`, `BREVO_API_KEY`, `PUSHER_SECRET`, `DOCUSIGN_*` — nunca
foram escritas em arquivo nenhum: viviam só na memória do processo, herdadas do primeiro
`pm2 start` manual (o deploy #37 já tinha revelado que **não existe `.env` no servidor**).

Reproduzido localmente: **sem `CLERK_SECRET_KEY`, toda rota responde 500, inclusive as
públicas.** Um `pm2 delete` sem preservar teria derrubado o site inteiro.

### Como foi corrigido

1. `package.json` — o `build` volta a propagar falha. Provado: com o `next.config.ts`
   quebrado, antes `exit 0`, agora `exit 1`.
2. `scripts/preservar-ambiente-do-pm2.mjs` — copia para o `.env` as variáveis que só existem
   no processo, **restrito às chaves que `lib/env.ts` declara** (nunca `PATH`/`HOME`), com
   retrato do PM2 salvo antes e **nenhum valor impresso** — a saída vai para log público.
3. `scripts/pm2-do-app.mjs` — lê o caminho que o processo usa, para o deploy **comparar em vez
   de supor**.
4. `deploy.yml` — imprime o diagnóstico, preserva o ambiente, recusa mexer no processo se o
   `server.js` novo não chegou, e recria (`delete` + `start`) **apenas quando o caminho
   diverge**; caminho igual continua sendo `restart`, sem indisponibilidade.
5. `deploy.yml` — **portão pós-deploy**: baixa da URL pública um chunk com hash deste build e
   falha o job se não vier 200 em 100 s. É a única afirmação do workflow que não depende de
   nenhum passo ter "dado certo".
6. `next.config.ts` — `outputFileTracingRoot: path.join(__dirname)`, para o build local não
   divergir do build do CI. **Não era a causa** (o log do deploy #40 mostra o `server.js` no
   lugar certo), mas foi a divergência que me fez apontar a causa errada.

### O guarda

`__tests__/guardas/o-deploy-entrega-o-que-buildou.test.ts` — **21 casos**, provados por
**9 sabotagens**. Uma delas achou um defeito no próprio guarda: ele checava a _presença_ de
`exit 1` no portão, e o passo tem dois — trocar só o final por um `echo` deixava o portão
decorativo e o teste verde. Corrigido para medir o caminho de falha, não a presença.

### O que ficou de fora

- **`/api/versao` com o SHA do commit**, conferido pelo portão em vez do hash do chunk. É mais
  direto e não depende de heurística. Fora do escopo desta correção — o chunk já prova o que
  precisa hoje, e a rota nova exigiria mexer no middleware.
- **Unificar os diretórios do rsync e do PM2 no servidor.** A correção faz o deploy convergir
  sozinho para o diretório do rsync, mas o diretório antigo continua existindo na máquina.
  Limpeza é trabalho próprio, com acesso ao servidor.
- **IP Elástico na EC2** (recomendação da Dryelle). Não é causa deste incidente; evita que o
  `SERVER_IP` fique obsoleto num reboot.

## Item 29 — 🟡 PARCIAL (11/09/2026): e-mail e sistema feitos; WhatsApp bloqueado por falta de doc

**Adiado pelo dono em 10/09/2026**, ao descrever o fluxo 1 da Greens: _"isso nós fazemos depois,
deixe anotado como pendência"_. O passo 7 do fluxo dele pede _"recebe notificação email, celular
e no sistema"_.

### O diagnóstico

`app/api/anvisa/atualizar-status/route.ts:63-72` notifica **só pelo Pusher**:

```ts
await pusher.trigger(`private-user-${atualizado.pacienteId}`, 'anvisa:status-atualizado', {…});
```

Dentro do sistema funciona. Fora dele, o paciente não fica sabendo — e o paciente que veio da
Greens **não tem motivo para abrir a nossa plataforma de novo**: ele entrou para resolver a
autorização e saiu.

### O que existe e não está ligado neste ponto

| canal    | peça no projeto                     | ligada aqui? |
| -------- | ----------------------------------- | ------------ |
| e-mail   | Brevo — `lib/email/notificacoes.ts` | ❌           |
| WhatsApp | ChatPro — `lib/chatpro/cliente.ts`  | ❌           |
| sistema  | Pusher — `private-user-<id>`        | ✅           |

### A decisão de conteúdo já está tomada, e é o que destrava

A ADR-0017 fixou a regra: **fato que o paciente sente sai automático; texto que alguém compõe
passa por aprovação.** _"Sua autorização da ANVISA foi aprovada"_ é fato — sai automático, sem
fila de aprovação.

⚠️ E o que **não** pode ir junto: número do processo, nome do medicamento, ou qualquer coisa que
transforme a notificação num documento clínico trafegando por WhatsApp. O aviso diz que ficou
pronto e onde ver — o conteúdo fica na plataforma, com controle de acesso. É a mesma regra que
o guarda `o-aviso-ao-parceiro-nao-se-perde` já aplica ao aviso que vai para a Greens.

### O guarda que vai junto

Quando for implementado: o aviso ao paciente não pode carregar dado clínico, e a falha de um
canal não pode impedir os outros — nem derrubar a atualização de status, que é o fato que
importa.

### ✅ O que foi feito em 11/09/2026

`lib/anvisa/avisar-aprovacao.ts`, chamado por `app/api/anvisa/atualizar-status/route.ts` quando
o status vira `aprovado`:

| canal                  | estado                                     | nota                                                          |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| **no sistema**         | ✅ linha em `notificacoes`, com `linkAcao` | vem **primeiro**: é o único canal que não depende de terceiro |
| **e-mail**             | ✅ Brevo, `enviarEmailAnvisaAprovada`      | leva o número do processo; **nada clínico**                   |
| **celular (WhatsApp)** | 🔴 **não**                                 | ver abaixo                                                    |

O Pusher continua — ele é o canal **imediato**, não o substituto. O defeito era ele ser o
**único**: tempo real significa que quem não estava com a aba aberta nunca soube, e a
autorização demora semanas.

### 🔴 Item 29b — por que o WhatsApp NÃO entrou

**Não é esquecimento, é ausência de fonte.** `lib/chatpro/cliente.ts` só **busca** contato e
sessão — não tem método de envio. Procurei o endpoint de envio ativo nos **dois** repositórios
em 11/09/2026: a única ocorrência é o valor de enum `v5_send_message` em
`greens-corp-backend/src/modules/chatpro/types/chatpro.ts`, **sem nenhuma implementação**. Nem
o lado da Greens envia mensagem ativa.

Deduzir o path daria um envio que **falha em silêncio** — pior que canal ausente, porque
alguém passa a contar com ele.

**O que destrava:** a documentação do ChatPro para envio ativo, ou o endpoint confirmado pelo
painel. Há caso de guarda (`a-anvisa-aprovada-avisa-o-paciente`) que fica **vermelho** se
alguém acrescentar envio ao cliente sem essa conversa acontecer.

## Item 30 — 🟡 O store privado começou pelos caminhos novos (Item 6 segue aberto)

**Decisão do dono em 10/09/2026:** _"então vamos colocar no nosso store privado"_.

### O que mudou

Os **dois caminhos criados nesta sessão** passaram a gravar `access: 'private'`:

| caminho                                  | arquivo                                   |
| ---------------------------------------- | ----------------------------------------- |
| anexo enviado pelo paciente no cadastro  | `lib/documentos/anexo-do-cadastro.ts`     |
| documento que vem do parceiro no handoff | `lib/parceiros/documentos-do-parceiro.ts` |

E nasceu a porta de entrega: **`/api/documentos/<id>/arquivo`** — autentica, confere **escopo
de objeto** (o paciente, o médico DELE, ou admin), audita a leitura, e nunca entra em cache
compartilhado.

⚠️ **Ela serve os dois mundos de propósito:** blob antigo (público) é redirecionado; blob novo
é entregue por streaming autenticado. Assim a tela usa **um endereço** para qualquer documento,
e terminar o Item 6 não vai exigir tocar em tela nenhuma.

### ✅ 11/09/2026 — o grupo da tabela `documentos` foi fechado

Decisão do dono: _"AGORA É O MOMENTO de ajustarmos isso"_.

**Quatro pontos** passaram a gravar privado, e as **três telas** que os abriam passaram a
apontar para a rota autenticada — a tela ANTES do upload, que é a ordem que impede o documento
de sumir:

| ponto                                      | tela que o abre                |
| ------------------------------------------ | ------------------------------ |
| `app/_actions/documentos.ts`               | `tab-documentos.tsx` (médico)  |
| `app/_actions/documentos-paciente.ts`      | `paciente/perfil/page.tsx`     |
| `app/_actions/documentos-paciente-self.ts` | `paciente/documentos/page.tsx` |
| `app/api/upload-documento/route.ts`        | as três acima                  |

### 🔴 O que ainda falta, e por que cada um é um caso diferente

**Sete pontos continuam gravando público, e eles NÃO são iguais entre si:**

| grupo                      | pontos                                                              | por que ainda não                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **ANVISA** (jsonb, sem id) | `anvisa/upload-documento`, `anvisa/procuracao`, `webhooks/docusign` | 🔴 os documentos vivem num **jsonb dentro de `autorizacoes_anvisa`**, não na tabela `documentos` — **não têm id**, e a rota atual endereça por id. Precisa de rota própria, ou de migrar para a tabela |
| **exames**                 | `_actions/exames.ts`, `api/upload-exame`                            | tabela própria (`exames`) — mesma solução, rota própria                                                                                                                                                |
| **chat**                   | `_actions/chat.ts`                                                  | anexo de conversa; escopo é o grupo, não o paciente                                                                                                                                                    |
| **avatar**                 | `api/upload-avatar`                                                 | ⚠️ **decisão: fica público.** Foto de perfil não é dado de saúde, e privá-la só acrescentaria uma rota autenticada em todo carregamento de tela                                                        |
| **relatório**              | `api/upload-relatorio`                                              | verificar o que contém antes de decidir                                                                                                                                                                |

⚠️ **O caso da ANVISA é o mais importante e o mais caro** — é onde está a procuração assinada.
Ele exige decidir se aqueles documentos migram para a tabela `documentos` (o que resolveria de
uma vez, e daria id a eles) ou se ganham rota própria endereçada por autorização + tipo.

**Antes eram 12; são 7.** Eles não foram tocados: mexer em 14 lugares
no meio de outra tarefa é exatamente o que o `CLAUDE.md` proíbe, e cada um tem uma tela que lê
`urlBlob` direto.

```
app/_actions/documentos.ts · documentos-paciente.ts · documentos-paciente-self.ts
app/_actions/exames.ts · chat.ts
app/api/upload-documento · upload-exame · upload-avatar · upload-relatorio
app/api/anvisa/upload-documento · anvisa/procuracao
lib/integrations/blob/index.ts
```

**O perigo de mexer, medido:** cada ponto tem uma tela que usa `urlBlob` como `href`. Trocar o
upload sem trocar a tela deixa o documento invisível — e invisível é pior que público, porque
some sem avisar.

**A ordem que funciona**, e é a mesma que esta sessão usou: a rota de entrega primeiro (feita),
depois cada tela passando a apontar para ela, e **só então** o upload virando privado. Um ponto
por vez, com a tela junto.

⚠️ E os arquivos **já gravados** continuam públicos. Torná-los privados exige copiá-los, o que
é migração de dado — trabalho próprio, com o histórico preservado (proibição 4).

## Item 31 — 🟡 O limite de requisição é por PROCESSO, não compartilhado

**Criado junto com a defesa**, em 10/09/2026, e registrado no mesmo movimento porque é o tipo
de limitação que some da memória de quem não a escreveu.

`lib/seguranca/limite-de-requisicao.ts` guarda o contador **na memória do processo**. Isso
funciona hoje porque há **uma instância** (EC2 + PM2 — DT-006/DT-008).

| cenário              | efeito                                             |
| -------------------- | -------------------------------------------------- |
| uma instância (hoje) | o limite vale o que diz                            |
| duas instâncias      | cada uma conta metade — o limite efetivo **dobra** |
| reinício do processo | o contador **zera**                                |

**Quando trocar:** no dia em que houver mais de uma instância, ou um balanceador. A troca é
substituir a função `consumir` por uma sobre store compartilhado (Redis, ou a própria tabela
com `FOR UPDATE SKIP LOCKED`, que o projeto já usa nas filas). **Quem chama não muda** — foi
desenhado assim de propósito.

⚠️ **Não é motivo para adiar nada.** Sem limite nenhum, o custo de cada tentativa de força
bruta era do servidor. Com este, o atacante precisa de muitas origens para o mesmo efeito.
Melhor que nada por uma margem enorme, pior que compartilhado por uma margem conhecida.

### Como a auditoria chegou aqui

Contra o **OWASP API Security Top 10 (2023)**, medido em 10/09/2026:

| risco                           | estado                                                 |
| ------------------------------- | ------------------------------------------------------ |
| API1 — BOLA                     | ✅ escopo de objeto em 9 pontos                        |
| API2 — autenticação quebrada    | ✅ `timingSafeEqual` nos dois segredos                 |
| API3 — exposição de propriedade | ✅ guardas contra PII em log e dado clínico no payload |
| **API4 — consumo irrestrito**   | 🔴 **era o único sem defesa nenhuma** → corrigido aqui |
| replay                          | ✅ janela de 300 s com `Math.abs`                      |
| enumeração de identificador     | ✅ `cuid2`, não sequencial                             |

## Item 32 — ✅ CORRIGIDO em 21/09/2026: a migration `0039` nunca foi aplicada, e o consentimento LGPD **não era gravado em produção desde então**

**Medido em 21/09/2026** contra o banco de produção (leitura apenas), ao preparar o merge do
PR #110. Não é achado de leitura de código: é estado do banco.

### O que está faltando no banco

```
colunas reais de consentimentos:
  id, created_at, updated_at, paciente_id, finalidade,
  versao, texto_apresentado, concedido_em, revogado_em, origem
                                            ↑ sem `idioma`

enum parceiro_evento_tipo em produção: receita_emitida, anvisa_aprovada
                                       ↑ sem `cadastro_transferido`
```

Os dois objetos são exatamente o conteúdo de `db/migrations/0039_secret_randall.sql`. A
entrada dela **existe** no journal (`db/migrations/meta/_journal.json`, idx 39) e **não existe**
linha correspondente em `drizzle.__drizzle_migrations`. O mesmo vale para a `0038` — mas os
objetos da 0038 estão lá, aplicados por fora.

### 🔴 Por que ela nunca mais seria aplicada sozinha

`node_modules/drizzle-orm/pg-core/dialect.js` → `migrate()` escolhe as pendentes assim:

```js
const lastDbMigration = dbMigrations[0];          // ORDER BY created_at DESC LIMIT 1
if (!lastDbMigration || Number(lastDbMigration.created_at) < migration.folderMillis) { … }
```

Compara com o **máximo já gravado**, não com o conjunto do que rodou. Em produção o máximo é
`1789271398148` (a 0043). O `when` da 0039 é `1789142042567`, **menor**. Ela é pulada **em
silêncio**, para sempre, com qualquer conteúdo que tenha.

⚠️ **Portanto reescrever a 0039 não conserta nada.** A correção precisa ser uma migration com
`when` maior que o máximo do banco.

### O efeito, e é ativo — não é código não alcançado

| #   | caminho:linha                                   | o que acontece                                                                                                                 |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `lib/parceiros/consentimento-registrado.ts:104` | `conceder()` faz `INSERT` com `idioma: IDIOMA_DO_CONSENTIMENTO`. Sem a coluna, **falha sempre**                                |
| 2   | `lib/parceiros/consentimento-registrado.ts:53`  | `consentimentosVigentes()` faz `SELECT consentimentos.idioma` — mesma falha                                                    |
| 3   | `app/_actions/cadastro-por-link.ts:600`         | chama `conceder()` dentro de `try/catch` que só faz `console.error` → **o cadastro conclui e o consentimento não é gravado**   |
| 4   | `app/(paciente)/_actions/consentimento.ts:96`   | o mesmo `conceder()` pelo painel do paciente                                                                                   |
| 5   | `lib/parceiros/enfileirar-transferencia.ts:54`  | grava `tipo: 'cadastro_transferido'` — valor que não existe no enum. **Latente**: fica atrás do consentimento, que nunca grava |

🔴 **A prova de que é executado e falha, não de que não foi alcançado:**

```
consentimentos        : 0 linhas
solicitacoes_cadastro : 77  — das quais 7 com `status='enviada'` e `paciente_id` preenchido
```

⚠️ **O denominador honesto é 7, não 77.** `conceder()` só é chamado depois de a conta e a ficha
existirem (`cadastro-por-link.ts:600`), então as 70 solicitações que pararam em `link_gerado`
ou `link_acessado` nunca chegaram ao ponto de consentir — contá-las infla o número sem
acrescentar prova. **Zero em 7 é o que mede:** sete cadastros passaram pelo ponto onde a linha
seria gravada, e nenhuma linha existe. Se fosse código não alcançado, não haveria tentativa;
há tentativa, e ela falha todas as vezes, engolida pelo `catch`.

### E a consequência que ninguém ligaria a isto

O comentário do próprio código, em `app/_actions/cadastro-por-link.ts:593-597`, escreve o
desfecho: _"se esta gravação falhar, o que acontece é que **nada é enviado à Greens** (a P5 lê
daqui antes de montar qualquer envio)"_. Ou seja, **a transferência S2 nunca dispara**, e a
causa está três camadas abaixo de onde ela seria procurada. Ver [Item 33](#item-33) para o
motivo de o log não ter ajudado.

### Correção — preparada, provada e APLICADA em 21/09/2026

`db/migrations/0045_idioma_e_cadastro_transferido.sql`, idempotente nos dois statements, com
`when` maior que o da 0044. A 0039 fica **intacta** — num banco reconstruído do zero ela aplica
e a 0045 vira no-op. Autorização e perigo medido em `.claude/autorizacoes.txt` (21/09/2026).

**Provada com 5 cenários** em Postgres 16 descartável + `BEGIN … ROLLBACK` contra o schema real
de produção: cenário vermelho (o `INSERT` do `conceder()` falhando hoje com
`column "idioma" of relation "consentimentos" does not exist`), cenário verde (o mesmo `INSERT`
passando depois), idempotência (duas execuções seguidas, `enum_total` continua 3), no-op num
banco onde a 0039 rodou, e o valor de enum utilizável depois do `COMMIT`.

### ✅ Aplicada em produção em 21/09/2026

Autorizada pelo dono depois de backup conferido por ele (`pg_dump` na EC2,
`behemp-prod-20260921-184137.dump`, 40 MB, 424 objetos confirmados via `pg_restore --list`).

⚠️ **Foram aplicadas as DUAS, 0044 e 0045, e isso foi decisão explícita.** O migrator não
consegue aplicar uma só: ele seleciona por `max(created_at)` e pega tudo acima disso. Medido
antes de rodar, a 0044 era **no-op completo** em produção — os três objetos de schema já
existiam, o `UPDATE` de dado atingia **0 linhas** (`alertas_config` tem 1 linha e não era
`[60,30]`), e só o `SET DEFAULT` tinha efeito.

🔴 **O caminho que foi descartado, e o motivo:** aplicar a DDL da 0045 e gravar só a linha de
journal dela faria `max(created_at)` virar `1790014838175`, e a **0044 passaria a ser pulada
para sempre** — recriando exatamente o defeito que este item descreve.

**Comando, pelo caminho documentado:** `pnpm db:migrate:prod` → `[migrar] ✓ concluído`.

#### A medição, antes e depois

| o quê                                    | antes (21/09, manhã)                                          | depois (21/09, 18h41)                                                                           |
| ---------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `consentimentos.idioma`                  | **não existia**                                               | `text`, `NOT NULL`, default `'pt'::text`                                                        |
| enum `parceiro_evento_tipo`              | `receita_emitida, anvisa_aprovada`                            | **+ `cadastro_transferido`**                                                                    |
| linhas em `drizzle.__drizzle_migrations` | 46, com a 0039 ausente e `max` na 0043                        | **48**, com as entradas 44 e 45                                                                 |
| o `INSERT` do `conceder()`               | `column "idioma" of relation "consentimentos" does not exist` | **passou** — devolveu `{finalidade:'retorno_ao_parceiro', idioma:'pt', versao:'2026-09-10.v1'}` |
| linhas em `consentimentos`               | **0**, para os 7 cadastros que chegaram lá                    | 0 — mas agora por **ausência de cadastro novo**, não por falha                                  |

⚠️ **O teste do `INSERT` não invocou a função `conceder()`.** O `tsx` é devDependency e não
está instalado, então o módulo TS não pôde ser importado. O que rodou foi o **mesmo statement**
que ela monta (`consentimento-registrado.ts:98-107`), com as constantes reais e contra um
**paciente real** — a FK precisava ser exercida, porque um `paciente_id` inventado mascarou uma
primeira tentativa. Rodou dentro de `BEGIN … ROLLBACK`: nenhum consentimento falso persistiu.

🔴 **O QUE AINDA NÃO ESTÁ PROVADO.** O que se provou é que **o banco aceita** o `INSERT`. Que
a perda de consentimento parou **no fluxo real** só se prova com um cadastro de verdade
passando pelo `cadastro-por-link` e deixando linha em `consentimentos`. Até lá, este item está
corrigido na causa e **não confirmado no efeito**.

### Relacionado

Este é o segundo caso da família descrita em [03 — as migrations NÃO RODAM DO ZERO](03-CHECKLIST-MESTRE.md).
Lá o sintoma é "banco novo não nasce"; aqui é "banco existente diverge do journal **e ninguém
vê**". A causa comum é a seleção por `max(created_at)`, que trata o histórico como uma régua
e não como um conjunto.

---

## Item 33 — 🔴 `erro.name` num `new Error` é sempre `'Error'`, e foi isso que escondeu o Item 32

**Medido em 21/09/2026.** O `catch` que engole a falha do consentimento registra assim:

`app/_actions/cadastro-por-link.ts:606-609`

```ts
console.error('[cadastro] consentimento não gravado', {
  protocolo: solicitacao.protocolo,
  erro: erroDoConsentimento instanceof Error ? erroDoConsentimento.name : 'desconhecida',
});
```

`erro.name` de qualquer `new Error(...)` é a string `'Error'`. O log de produção, portanto,
diz literalmente `{ protocolo: 'SOL-000xxx', erro: 'Error' }` — **em todas as falhas, qualquer
que seja a causa**. A mensagem real (`column "idioma" of relation "consentimentos" does not
exist`) nunca chegou a lugar nenhum.

### Por que isto já era classe conhecida, e escapou assim mesmo

É exatamente o defeito que o guarda `o-motivo-do-erro-diagnostica-sem-vazar` existe para
impedir — ele nasceu de `o-cadastro-feito-nao-vira-falha`, onde o mesmo `erro.name` escondeu
por quatro dias a falha que impedia **todo** documento de paciente de ser gravado.

⚠️ **O guarda cobre a função de formatação de erro; não cobre um `console.error` escrito à mão
em outro arquivo.** A classe voltou por uma porta que o guarda não olha.

### O que a correção precisa equilibrar

As duas pontas puxam em direções opostas, e já estão resolvidas no helper existente:

- **dizer de menos** → `'Error'`, que não diagnostica nada
- **dizer demais** → o Drizzle monta a mensagem com a query inteira e os valores inline:
  `Failed query: insert into pacientes values ('529.982.247-25', …)` — PII no log

A forma já decidida no repositório é `code:constraint:table` para erro de banco, que diagnostica
melhor que a mensagem **e** não carrega valor nenhum.

### Correção proposta (não implementada)

Trocar o `erro.name` do `catch` pelo helper que já existe, e **acrescentar ao guarda** o caso
que pega `console.error` com `.name` cru fora do helper — derivado do código, não listado, para
que o próximo `catch` escrito à mão nasça coberto.

**Perigo de mexer:** baixo — é uma linha de log, sem efeito em fluxo. **Custo de deixar:** alto
e já cobrado uma vez: a próxima falha silenciosa também levará semanas para aparecer, e a
única pista será `'Error'`.

**Fora do escopo de 21/09** — catalogado, não corrigido, conforme a regra de escopo.
