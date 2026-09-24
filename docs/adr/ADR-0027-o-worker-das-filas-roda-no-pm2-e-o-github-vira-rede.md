# ADR-0027 — O worker das filas roda no PM2, e o cron do GitHub vira rede de segurança

> **Status:** 📋 **proposta** — 24/09/2026. Escrita **antes** do código, como a ADR-0020 §4
> pediu: _"é decisão própria, com ADR própria"_. **Nenhuma linha do worker existe.** O dono
> revisa este texto antes da implementação.
>
> **Contexto:** o `filas.yml` foi escolhido para o QA como ponte (opção B da ADR-0020 §4). Em
> produção, ele não entrega a cadência que declara, e a Fase 4 do Mercado Pago precisa de uma
> expiração com precisão de minutos.
> **Decisão:** um processo Node próprio, com nome próprio no PM2, que chama **as mesmas rotas
> HTTP** que o `filas.yml` já chama, a cada 60 s. O cron do GitHub **fica**, como rede de segurança.

## §1 — O que a medição provou (24/09/2026, produção)

| fato                                                 | medida                                                                                |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| cadência declarada no `filas.yml`                    | `*/5 * * * *` (`.github/workflows/filas.yml:26`)                                      |
| cadência **real** do `filas.yml`                     | **uma execução a cada ~3,5 a 4 h**                                                    |
| o GitHub garante a pontualidade do `schedule`?       | **não** — a doc oficial avisa que jobs agendados atrasam ou caem sob carga            |
| reservas `reservada` com `expira_em` vencido         | **7**, travando horário de médico                                                     |
| a mais antiga                                        | vencida há **13,7 dias** (Item 40)                                                    |
| fila do Mercado Pago (`processado_em is null`)       | **0 pendentes**                                                                       |
| memória na EC2 (`free -m`)                           | **1,1 GB livres** de 2 GB                                                             |
| `ecosystem.config.*` no repositório                  | **não existe** — o `deploy.yml` sobe o site com `pm2 start server.js --name behemp-site` (`:440`) |
| as 3 rotas chamadas pelo `filas.yml`                 | `/api/chatpro/processar`, `/api/parceiros/enviar`, `/api/mercadopago/processar`       |

⚠️ **O nome da rota dos parceiros é `enviar`, não `processar`.** Está assim no `filas.yml:63` e
em `app/api/parceiros/enviar/route.ts`. Fica registrado porque o pedido desta ADR chamou a rota
de `/api/parceiros/processar`, e quem implementar a partir do pedido chamaria uma rota que não
existe.

**O que os números dizem, lidos juntos.** Com uma execução a cada ~4 h, o paciente que manda
mensagem no WhatsApp espera horas pelo link, e não os cinco minutos que a ADR-0020 já achava
demais. A reserva abandonada trava o horário do médico por um intervalo que ninguém controla.
E um job de expiração que respeite `pix_valido_ate` precisa acordar em minutos: a reserva dura
30 min e o PIX é pedido com 31 min de validade (`lib/mercadopago/cobranca.ts:10,45`), e o job
não pode chegar quatro horas depois deles.

**A fila do Mercado Pago em zero não quer dizer que está tudo bem.** Quer dizer que ainda não
entrou volume. O risco de hoje é zero, mas a Fase 4 só se implementa com segurança quando existir
algo que acorde na hora certa.

## §2 — A decisão

### D-01 — Um processo próprio no PM2, `behemp-filas`, separado do `behemp-site`

Um script Node puro, `scripts/worker-filas.mjs`, sem dependência nova, registrado no PM2 com
nome próprio. Ele **não processa fila nenhuma**: acorda, chama as rotas e volta a dormir. Todo
o trabalho continua dentro do `behemp-site`, nas rotas que já existem.

Ser um processo separado dá três coisas:

1. **Desligar sem derrubar o site.** `pm2 stop behemp-filas` para o worker, e o `filas.yml`
   continua esvaziando a fila no ritmo dele. Não existe outro jeito de desligar o laço sem
   parar o site ou fazer deploy.
2. **Memória medida sozinha.** `pm2 describe behemp-filas` mostra o custo do worker sem misturar
   com o consumo do Next (ver §4, R-01).
3. **Ciclo de vida desacoplado do build.** O worker não depende do `.next/standalone` que cada
   deploy troca.

### D-02 — Chama as rotas por HTTP, nunca as funções de `lib/` diretamente

O worker faz `GET` em cada rota com `Authorization: Bearer $CRON_SECRET`, exatamente como o
`filas.yml`. Assim:

- **existe um único ponto de entrada** para cada fila, e o worker e o GitHub passam pela mesma
  autenticação (503 sem segredo, 401 com o errado), pelo mesmo limite e pelo mesmo log;
- **duas execuções simultâneas não processam o mesmo evento**, porque o trabalho é reivindicado
  com `FOR UPDATE SKIP LOCKED` nas três filas: `lib/chatpro/processador.ts:126`,
  `lib/parceiros/enviador.ts:158` e `lib/mercadopago/notificacoes.ts:123`. Quem perde a corrida
  não encontra nada para reivindicar;
- o `reenfileirarPagamentosEmTransito()` que o `mercadopago/processar` chama antes da fila é um
  `UPDATE … WHERE` idempotente (`lib/mercadopago/notificacoes.ts:88`), então rodar duas vezes
  seguidas não duplica nada.

**O destino é `http://127.0.0.1:$PORT`**, e não `https://be4hope.org`. A chamada não sai da
máquina, não depende de DNS, TLS, Cloudflare ou nginx, e não gasta cota de ninguém. **A porta é
3000**, medida na EC2 em 24/09/2026: é o padrão do standalone, confirmado por `ss -ltnp` e pelo
`script path` do PM2. **Não existe `PORT`** nem no ambiente do processo nem no `.env`. O worker
lê `PORT` do ambiente e cai em 3000 quando ela não existe, a mesma regra do `server.js`, para que
os dois nunca discordem.

### D-03 — `setTimeout` encadeado de 60 s, não `setInterval` nem `node-cron`

```
rodada():
  para cada rota, EM SEQUÊNCIA:
    fetch(rota, { headers: Bearer, signal: AbortSignal.timeout(90 s) })
    registra 1 linha: rota · status HTTP · duração · resumo do JSON
    erro de rede ou timeout → registra e segue para a próxima rota
  agenda a próxima rodada para 60 s DEPOIS DO FIM desta
```

- **`setTimeout` encadeado**, porque a próxima rodada só é agendada quando a anterior termina.
  Uma rota lenta nunca empilha rodadas. Com `setInterval`, uma chamada de 90 s abriria uma
  segunda rodada por cima da primeira.
- **Em sequência, não em paralelo.** São três (depois quatro) rotas no mesmo processo Next.
  Disparar todas juntas cria um pico que o intervalo de 60 s não pede.
- **60 s** atende à precisão de minutos que a expiração precisa. Também fica bem abaixo do
  limite de 10/min do `mercadopago/processar` (`app/api/mercadopago/processar/route.ts:36`).
- **Intervalo como constante no código**, não como variável de ambiente. Mudar a cadência
  passa a ser um commit que aparece no `git log`, não um valor que só existe no servidor. É o
  princípio do Item 28.
- **Sem tratamento especial para `CRON_SECRET` ausente.** A rota já responde 503 e o worker
  registra o 503. Repetir a checagem no worker seria duplicar uma regra que já tem dono.
- **O worker nunca derruba a si mesmo por erro de rota.** Se o processo morrer por outra causa,
  o PM2 o reinicia.

### D-04 — Sobe pelo `deploy.yml`, sempre com `delete` + `start`

Como não existe `ecosystem.config.*`, o "equivalente" é um passo **versionado** no
`deploy.yml`, logo depois do restart do `behemp-site` e antes do `pm2 save` (`:443`):

```
pm2 delete behemp-filas 2>/dev/null || true
pm2 start scripts/worker-filas.mjs --name behemp-filas --update-env
```

**Sempre `delete` + `start`, nunca `restart`.** O `deploy.yml:405-411` já documenta que
`pm2 restart` **reusa o caminho do script gravado no primeiro `start`** (Unitech/pm2#3054) e
que isso fez o site servir um build antigo. O worker é só um temporizador: recriá-lo custa
nada e elimina essa classe de erro inteira. O `pm2 save` que já existe grava os dois processos no
`dump.pm2`. 🔴 **Mas um reboot NÃO traz nenhum dos dois de volta hoje:** o `pm2 startup` nunca foi
configurado nesta EC2 ([Item 42](../04-LISTA-DE-AFAZERES.md)). Sobreviver a deploy e sobreviver a
reboot são coisas diferentes, e esta ADR só resolve a primeira. ✅ **Retificado em 24/09/2026:**
a segunda foi resolvida à parte pelo Item 42, com prova por reboot real (ver R-03).

O worker precisa do `CRON_SECRET` e da `PORT` no próprio ambiente. Ele tem de receber o mesmo
ambiente que `scripts/preservar-ambiente-do-pm2.mjs` monta para o site, e isso se prova na
implementação (§4), não se presume aqui.

### D-05 — A rota de expiração da Fase 4 entra no mesmo laço, com as mesmas regras

Quando a Fase 4 criar a rota de expiração de reservas, ela entra como a **quarta** chamada do
worker **e** como um passo novo do `filas.yml`. Ela nasce com as mesmas regras das outras três:

1. `CRON_SECRET` com falha **fechada** (503/401);
2. reivindicação com `FOR UPDATE SKIP LOCKED`, porque o worker e o GitHub vão chamá-la ao mesmo
   tempo;
3. liberação no `middleware.ts` **pelo caminho exato**, nunca pelo prefixo. Sem isso, a chamada
   recebe 307 para o login, como aconteceu com o `mercadopago/processar` no Item 41, e o guarda
   `o-cron-chama-rota-que-o-middleware-deixa-passar` existe para pegar exatamente isso;
4. leitura de `consultas.pix_valido_ate` e **pulo** de pagamento `em_processamento`, que é o
   pendente da Fase 4 (Item 40, modo de erro 2).

O nome e o caminho dessa rota **não** são decididos aqui. São da Fase 4.

### D-06 — O cron do GitHub continua, sem mudar a cadência

O `filas.yml` **não é removido nem alterado**. Se o worker parar (processo morto, bug, `pm2
stop` esquecido), a fila continua sendo esvaziada, no ritmo ruim de hoje, mas esvaziada. O
`SKIP LOCKED` torna as duas fontes compatíveis. O `workflow_dispatch` segue como o botão manual
do QA.

## §3 — O que fica rejeitado

| alternativa                                               | por quê                                                                                                                                                                                                                                                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inngest** (religar o `liberarReservasExpiradas`)        | o job devolve `pacienteNome` e `pacienteEmail` no retorno do `step.run` (`lib/integrations/inngest/functions.ts:447-473`), e o Inngest **guarda o retorno de cada step na nuvem dele**. Isso cria um **operador de dados externo novo**, que exige base legal e contrato pela LGPD. E ligar o endpoint religa **de uma vez** as outras 4 funções represadas que nunca rodaram, disparando semanas de acúmulo com e-mail para pessoas reais (Item 40, modo de erro 1) |
| **cron do sistema na EC2** (`crontab -e`)                 | já rejeitado pela ADR-0020 §4: configuração que só existe dentro da máquina, invisível para quem lê o código. Foi a causa do **Item 28**                                                                                                                              |
| **manter só o `filas.yml`**                               | medido: ~3,5 a 4 h entre execuções, não 5 min. Incompatível com expiração de reserva e de PIX                                                                                                                                                                        |
| **remover o `filas.yml`** quando o worker entrar          | o worker vira ponto único de falha. As duas fontes custam nada juntas, graças ao `SKIP LOCKED`                                                                                                                                                                       |
| **`node-cron`**                                           | dependência nova para fazer o que um `setTimeout` faz, com granularidade de minuto e **sem** impedir sobreposição de rodadas por padrão                                                                                                                                |
| **`setInterval`**                                         | empilha rodadas quando uma rota demora mais que o intervalo                                                                                                                                                                                                          |
| **timer dentro do `behemp-site`** (`instrumentation.ts`)  | não dá para desligar o laço sem parar o site. A memória do worker se mistura à do Next. O processo passaria a chamar a si mesmo por HTTP durante o próprio boot                                                                                                         |
| **worker chamando `processarFila()` direto de `lib/`**    | dois pontos de entrada para a mesma fila: um passa pela autenticação e pelo limite, o outro não. Também exigiria compilar TypeScript e abrir um segundo pool de conexões com o banco                                                                                    |
| **fila própria no worker** (BullMQ, Redis)                | as três filas já existem no Postgres, com reivindicação atômica. Uma segunda fila seria uma segunda verdade                                                                                                                                                          |
| **intervalo em variável de ambiente**                     | configuração que só existe no servidor, a mesma classe do Item 28                                                                                                                                                                                                    |
| **chamar `https://be4hope.org`** em vez de `127.0.0.1`    | a chamada sairia da máquina e dependeria de DNS, TLS e proxy para falar consigo mesma                                                                                                                                                                                |
| **incluir as 3 rotas de `/api/cron/*`** no worker         | são validade de documento, recompra e revisão de dosagem, que nunca rodaram. Ligá-las dispara o acúmulo, e a proibição de 10/09 (_"NÃO LIGAR os 3 crons antigos sem medir antes"_, `docs/03`) continua valendo                                                          |

## §4 — Riscos, e como cada um se prova

| #    | risco                                         | o que fazer                                                                                                                                                                                                                                                                                  |
| ---- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-01 | **memória do processo novo** na `t2.small`    | 🔴 **não estimar agora.** Medir depois de implementado: `free -m` e `pm2 describe behemp-filas` antes, logo depois do start e **após 24 h** (para pegar vazamento). Um `--max-memory-restart` só entra com número derivado dessa medida                                                     |
| R-02 | **não sobreviver ao deploy**                  | o passo `delete` + `start` do D-04 e o `pm2 save`. Prova: depois do primeiro deploy com o worker, `pm2 ls` mostra `behemp-filas` `online`, com uptime menor que o do deploy e o caminho de script deste checkout                                                                            |
| R-03 | **não sobreviver a reboot da EC2**            | 🔴 **medido em 24/09/2026: não sobrevive, e o site principal também não.** A unit `pm2-ubuntu` não existe (`not-found`/`inactive`), e a máquina está de pé desde 07/08 (49 dias). Catalogado à parte como **[Item 42](../04-LISTA-DE-AFAZERES.md)**, prioridade alta. A correção é escrita na EC2 e tem autorização própria. O worker **não** piora isso: ele herda o conserto quando o Item 42 for aplicado. ✅ **Retificado em 24/09/2026:** o Item 42 foi corrigido e **provado com reboot real** (`pm2-ubuntu` `enabled`; site de volta com 200 em ~46 s, sem intervenção). O worker herda isso desde que o deploy rode `pm2 save` depois de subi-lo |
| R-04 | **ambiente incompleto** no worker             | sem `CRON_SECRET`, todas as rotas respondem 503, o que é visível no log do worker mas silencioso para o paciente. Prova: a primeira rodada depois do deploy registra `200` nas três rotas                                                                                                    |
| R-05 | **limite do `mercadopago/processar`**         | chamando `127.0.0.1` sem `x-forwarded-for`, o worker cai no balde `mp-processar:desconhecido` (`lib/seguranca/limite-de-requisicao.ts:108`). 1/min contra um limite de 10/min está folgado, mas **qualquer outro chamador sem cabeçalho divide o mesmo balde**. O limite também é por processo (Item 31) |
| R-06 | **a rota da Fase 4 esquecida no middleware**  | D-05 item 3. O guarda `o-cron-chama-rota-que-o-middleware-deixa-passar` precisa passar a ler também as rotas que o worker chama, não só as do `filas.yml`                                                                                                                                    |
| R-07 | **worker parado sem ninguém perceber**        | a rede do GitHub continua (D-06), mas volta à cadência de horas. Um alerta fica **fora desta ADR**. Registrado aqui para não se confundir "a fila anda" com "o worker está vivo"                                                                                                             |
| R-08 | **o worker liga o que estava represado**      | não liga: ele só chama rotas que o `filas.yml` já chama hoje. Não toca em `/api/inngest` nem em `/api/cron/*`                                                                                                                                                                               |

**Critério de pronto da implementação**, medido e não presumido:

1. `pm2 ls` mostra `behemp-site` e `behemp-filas` `online` depois de um deploy;
2. o log do `behemp-filas` mostra rodadas a cada ~60 s, com `200` nas três rotas;
3. um evento de ChatPro de teste sai de `pendente` em **menos de 2 min**, sem `workflow_dispatch`;
4. a memória do R-01 foi medida nos três momentos e ficou registrada nesta ADR (§6).

## §5 — O que isto destrava

A **Fase 4** do Mercado Pago é o job de expiração que lê `consultas.pix_valido_ate` e pula
`em_processamento`, e que finalmente libera as reservas vencidas do Item 40. Ela **só se
implementa com segurança depois desta ADR**, porque:

- **sem um despertador de minutos**, a expiração ou chega horas atrasada (`filas.yml`) ou exige
  o Inngest, com o custo de LGPD e o acúmulo das outras 4 funções (§3);
- **com o worker**, a rota de expiração nasce já com dois chamadores (worker e GitHub). Isso
  força o `SKIP LOCKED` desde o primeiro commit, em vez de descobri-lo depois, com duas
  execuções cancelando a mesma reserva.

⚠️ **Antes da Fase 4 cancelar qualquer coisa**, as 7 reservas vencidas precisam de decisão
própria. O e-mail de "sua reserva expirou" chegaria duas semanas depois (Item 40, modo de
erro 3). Isso é escopo da Fase 4, não deste worker.

## §6 — O que a implementação ensinou

{escrita DEPOIS da implementação: a memória medida (R-01) e o que o primeiro deploy mostrou}

**Medido antes da implementação (24/09/2026):** a porta é 3000, sem `PORT` configurada (D-02).
O `pm2 startup` nunca foi configurado, então nada sobrevive a reboot (R-03, Item 42).
✅ **Mesmo dia, depois:** o Item 42 foi corrigido e provado com reboot real.

## Fontes lidas

- `docs/adr/ADR-0020-ajustes-pre-QA.md` §4: as opções A/B/C e o pedido de ADR própria
- `docs/04-LISTA-DE-AFAZERES.md`: Item 40 (reservas vencidas, modos de erro, retratação das
  chaves do Inngest), Item 28 (configuração viva só no servidor), Item 31 (limite por processo),
  Item 41 (middleware devolvendo 307 ao cron)
- `.github/workflows/filas.yml`: as três rotas, o `concurrency`, o `workflow_dispatch`
- `.github/workflows/deploy.yml:340-443`: `pm2 restart` vs `delete` + `start`, `pm2 save`
- `lib/integrations/inngest/functions.ts:440-510`: o retorno do step com nome e e-mail
- `app/api/{chatpro/processar,parceiros/enviar,mercadopago/processar}/route.ts`: `CRON_SECRET`
  e o limite de 10/min
- `lib/chatpro/processador.ts`, `lib/parceiros/enviador.ts`, `lib/mercadopago/notificacoes.ts`:
  `FOR UPDATE SKIP LOCKED`
- `lib/seguranca/limite-de-requisicao.ts`: o balde `desconhecido`
- `middleware.ts:90-101`: a liberação pelo caminho exato
