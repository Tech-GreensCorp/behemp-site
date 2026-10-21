# ADR-0020 — Ajustes que precedem o QA: o que trava, em que ordem, e o que não trava

> **Status:** 📋 **proposta** — 10/09/2026. Escrita a pedido do dono, que vai conduzir o QA de
> ponta a ponta **com o chefe**. Ordem dele: _"vamos seguir uma ordem cronológica pra tudo ficar
> pronto pro QA"_.
>
> **A ordem desta ADR é a ordem de execução.** Não é lista de pendências: é sequência. Cada
> bloqueio só faz sentido depois do anterior, e a §5 explica por quê.

## §1 — Contexto: o que apareceu ao ligar produção pela primeira vez

Em 10/09/2026, depois de cinco deploys, produção passou a servir o build atual — o que estava no
ar era de **14/08** (diagnóstico completo no `docs/04-LISTA-DE-AFAZERES.md` Item 28). Com o
código novo no ar, três coisas apareceram **na mesma tarde**, e nenhuma delas teria como aparecer
antes: o código que falhava nunca tinha rodado.

⚠️ **Isto não é coincidência, e vale registrar como método.** Um sistema que não recebe deploy
por 27 dias acumula defeitos que só existem em produção. As três abaixo são todas dessa família:
o `.env` do servidor completava o que o build do CI não tinha, e ninguém sabia porque ninguém
tinha trocado o build.

## §2 — Bloqueio 1 · A teleconsulta morre em "Erro ao iniciar a sala"

**É o primeiro porque é o único que quebra para TODO MUNDO, em QUALQUER rede.**

### O diagnóstico

Não é o TURN. A rota de ICE **degrada de propósito** quando falta credencial
(`app/api/teleconsulta/ice-servers/route.ts:63-71`): devolve `turnDisponivel: false` e servidores
STUN, sem lançar. Quem lança é o Pusher, e o bundle de produção mostra por quê:

```js
let t = env.NEXT_PUBLIC_PUSHER_KEY,
  s = env.NEXT_PUBLIC_PUSHER_CLUSTER;
if (!t || !s) throw Error('[Pusher Client] … devem estar …');
```

Acesso **dinâmico**, não valor congelado — porque a variável não existia no momento do `next
build`. No navegador vira `undefined` e lança. O `catch` do `GlobalTeleconsultaHost.tsx:317`
transforma isso no toast genérico que o dono viu.

**A causa raiz é uma confusão de fronteira, não um esquecimento.** `NEXT_PUBLIC_*` é substituída
pelo **valor** durante o build e viaja dentro do JavaScript que o navegador baixa. O build que
rodava em produção tinha sido feito **à mão no servidor**, onde o `.env` completo existia — as
chaves estavam congeladas dentro dele e a teleconsulta funcionava. O build do CI recebia só
`NEXT_PUBLIC_APP_URL`.

🔴 **Escrever a variável no `.env` do servidor NÃO resolve.** O `.env` alimenta o código que roda
no servidor; o navegador só recebe o que foi embutido no build. É a diferença que o prefixo
`NEXT_PUBLIC_` anuncia e que é fácil ler ao contrário — _"é pública, então qualquer lugar serve"_.

### A correção

Passar as `NEXT_PUBLIC_*` ao passo de build do workflow. Está no **PR #44**, com guarda de
**13 casos** derivado do próprio código: a lista de variáveis sai de uma varredura dos fontes,
nunca de um rol paralelo — rol paralelo é o que desatualiza e aprova o errado.

⚠️ **Depende de ação humana:** os secrets `NEXT_PUBLIC_PUSHER_KEY` e `NEXT_PUBLIC_PUSHER_CLUSTER`
precisam ser cadastrados no GitHub. Os valores estão no `.env` do servidor e **não são segredos**
— são servidos a qualquer visitante dentro do bundle. Estão em `secrets` por conveniência de
gestão, não por sigilo.

**Duas coisas que as sabotagens do guarda acharam, e que ficam registradas:**

1. A primeira versão do guarda usava `rg`. **Guarda que depende de binário externo falha por
   motivo que não é o defeito que ele vigia.** Reescrito em Node puro.
2. **Menção vs uso, nona vez neste repositório.** O comentário do passo cita
   `NEXT_PUBLIC_PUSHER_KEY` ao explicar o incidente, e apagar a declaração real deixava o guarda
   **verde**. O bloco passou a ser lido sem comentários, com um caso de controle que prova o
   filtro.

## §3 — Bloqueio 2 · O TURN da Cloudflare não está configurado

**É o segundo porque só faz diferença depois que a sala abre.** Com o Pusher quebrado, a
negociação de mídia nem começa — criar a conta hoje não mudaria nada na tela.

### O que muda com e sem

**Sem TURN a teleconsulta funciona** — em rede boa. O que o TURN resolve é o caso em que os dois
lados estão atrás de NAT restritivo: 4G corporativo, wi-fi de hospital, VPN. Aí a mídia não acha
caminho direto e precisa de um retransmissor.

⚠️ **Para o QA isso importa mais do que parece.** Se o dono e o chefe testarem do mesmo escritório,
na mesma rede, a chamada conecta sem TURN e o teste passa — e o problema aparece com o primeiro
paciente em 4G. **Um QA que não exercita rede ruim não testou a teleconsulta**, testou o caminho
feliz.

### A decisão já existe: ADR-0008

Aprovada em 20/08/2026, com preço medido em fonte primária:

| provedor                     | preço                                        |
| ---------------------------- | -------------------------------------------- |
| **Cloudflare Realtime TURN** | **US$ 0,05/GB**, com **1.000 GB/mês grátis** |
| Twilio NTS — São Paulo       | US$ 0,80/GB                                  |
| `coturn` próprio na AWS      | US$ 0,09/GB + instância + operação           |

A ADR-0008 mede que 30 min de consulta relayada gastam ≈ **0,54 GB**. Mesmo no cenário
impossível de **100%** das chamadas precisarem de relay, 1.000 consultas/mês dão 540 GB —
**dentro do free tier**.

### O que exige o dono

Criar a conta e gerar as credenciais no painel da Cloudflare, como foi feito com o ChatPro.
Depois, dois secrets: `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN`.

**O código já está pronto e não muda:** `app/api/teleconsulta/ice-servers/route.ts` gera
credencial **efêmera** no servidor, só para quem participa da sala, e o guarda
`sem-relay-de-terceiro-na-teleconsulta` (17 casos) impede que credencial volte para dentro do
código ou que a mídia volte a atravessar relay gratuito de terceiro.

## §4 — Bloqueio 3 · A fila do ChatPro é aceita e nunca processada

### O que está medido

O webhook funciona ponta a ponta — o painel do ChatPro registrou **`202 · 496ms · Entregue com
sucesso`**, e um POST com token inválido responde **401**. O evento entra em `chatpro_eventos`
como `pendente`.

**E fica lá.** Nada chama `/api/chatpro/processar`:

| onde os crons estão declarados      | e o que isso vale                                           |
| ----------------------------------- | ----------------------------------------------------------- |
| `vercel.json` — 3 crons             | **o projeto não roda na Vercel** (EC2 + PM2, DT-006/DT-008) |
| workflows do GitHub com `schedule:` | **nenhum**                                                  |
| `/api/chatpro/processar`            | existe, **não está agendado em lugar nenhum**               |
| `/api/parceiros/enviar`             | idem — o aviso de volta à Greens também não sai             |

**Consequência para o QA:** o paciente manda mensagem, o ChatPro entrega, nós aceitamos com
202 — e **o link nunca chega nele**. O teste para exatamente aí, com todos os sinais verdes.

⚠️ Isto não quebrou nada até hoje porque as duas filas nasceram em 09/09. O `vercel.json` é
resíduo de quando o projeto rodava na Vercel, e ninguém percebeu porque os três crons antigos
também não rodam — o que é um segundo achado, e maior: **validade de documento, recompra e
revisão de dosagem não estão sendo verificadas por ninguém**.

### As três saídas, com o custo de cada

| #   | opção                      | como funciona                                      | custo real                                                                                      |
| --- | -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A   | **cron do sistema no EC2** | `crontab -e` chamando as rotas com o `CRON_SECRET` | 2 linhas, roda em 1 min — mas **mora fora do repositório**: invisível para quem lê o código     |
| B   | **workflow agendado**      | `on: schedule` no GitHub chamando as rotas         | versionado e auditável; granularidade ~5 min e **o GitHub atrasa em horário de pico**           |
| C   | **worker próprio no PM2**  | processo que consome a fila em laço                | latência de **segundos**, não minutos — mas é serviço novo para manter, e a `t2.small` tem 2 GB |

**Recomendação, e ela é dupla porque o horizonte é diferente:**

- **Para o QA de segunda: B.** Fica no repositório, aparece no `git log`, e cinco minutos de
  atraso não invalidam um teste conduzido por duas pessoas na mesma sala.
- **Para o produto: C.** Um paciente esperando um link no WhatsApp não espera cinco minutos. Mas
  é decisão própria, com ADR própria, e não cabe antes de segunda.

**Rejeitado: A como solução permanente.** Configuração que existe só dentro de uma máquina é
exatamente o que produziu o Item 28 — o `.env` que ninguém sabia que existia, e o `pm2 start`
cujo caminho ninguém conseguia ler. Repetir o padrão agora, sabendo disso, seria escolher o erro.

⚠️ **A opção B tem um limite honesto:** ela depende do GitHub Actions estar de pé. Se o Actions
cair, a fila para. Para o QA é aceitável; para produção, não — e é mais um argumento para C.

## §5 — Por que esta ordem, e não outra

```
1. Pusher   →  sem isto a sala não abre para ninguém, em rede nenhuma
2. TURN     →  só importa depois que a sala abre; e é o que faz abrir em rede ruim
3. Fila     →  o ChatPro entrega e nós aceitamos; sem isto o paciente nunca recebe o link
```

**1 antes de 2** porque o TURN é invisível enquanto a sala não abre.
**1 e 2 antes de 3** porque a teleconsulta é o fluxo que o dono vai demonstrar ao chefe, e a fila
do ChatPro é a porta de entrada de um paciente novo — que só é exercitada num segundo roteiro.

## §6 — O que NÃO bloqueia o QA

- **Os ajustes do módulo clínico** (ADR-0019): a trilha sem progresso e o cartaz desatualizado
  são incômodos, não impedimentos. Ninguém trava um teste por causa deles.
- **Exames (Sprint 7):** segue aguardando `DO-13`.
- **O motor de IA:** a Análise assistida mostra o texto de espera. É a ADR-0001, e o QA não
  depende dela.

## §7 — Critério de pronto

O QA pode começar quando as quatro linhas abaixo forem verdadeiras **e medidas**, não presumidas:

1. `curl -o /dev/null -w "%{http_code}" https://be4hope.org/` → **200**
2. A sala de teleconsulta abre entre dois navegadores, **em redes diferentes** — uma delas
   fora do escritório, senão o TURN não é exercitado
3. Uma mensagem no WhatsApp faz o link **chegar ao paciente**, sem ninguém apertar nada no
   servidor
4. Uma receita assinada faz o aviso **chegar à Greens** — o que exige combinar o início dos
   testes com o outro lado

⚠️ **O item 4 depende de terceiro.** O Claude da Greens precisa saber que os testes começaram, e
os dois lados precisam concordar em qual ambiente. Combinar isso é passo do QA, não detalhe.

## Princípios e fase

§2 **L** (front-end) + **N** (operação), fase 2 · §3 **N**, fase 12 · §4 **J** (integridade de
fila), fase 8.

## Fontes lidas

- `docs/adr/ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md` — a decisão, o preço
  medido e o cálculo de 0,54 GB por consulta relayada
- `docs/adr/ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md` — o contrato do
  202 e por que o webhook não é fonte de verdade
- `docs/04-LISTA-DE-AFAZERES.md` Item 28 — por que os três defeitos apareceram juntos
- O bundle de produção e o código: `app/api/teleconsulta/ice-servers/route.ts`,
  `components/teleconsulta/GlobalTeleconsultaHost.tsx:317`, `vercel.json`
