# Plano de correção do deploy — curto prazo e definitivo

> Escrito em **10/09/2026**, a pedido do dono, depois de descobrir que **nenhum deploy chegou
> ao processo em produção entre 14/08 e 10/09**. O Actions reportava sucesso, o rsync entregava
> os arquivos, o PM2 reiniciava — e o site continuava servindo um build anterior.
>
> Diagnóstico completo, com as medições: `docs/04-LISTA-DE-AFAZERES.md`, **Item 28**.
> Método de deploy e o que cada falha ensinou: `CLAUDE.md`, seção **Deploy**.

## O problema, em uma frase

Quando o PM2 registra um app, ele grava o **caminho absoluto** do arquivo que deve executar.
A partir daí, `pm2 restart` **não relê esse caminho** — reexecuta o mesmo arquivo de sempre.
Nem `--update-env`, nem `reload`, nem `startOrReload` corrigem
([Unitech/pm2#3054](https://github.com/Unitech/pm2/issues/3054)). Só `delete` + `start`.

O deploy fazia `cd .next/standalone` antes do `pm2 restart`. O `cd` engana quem lê: quem decide
é o registro do PM2, não o shell.

---

## As soluções: curto prazo e definitivo

### Curto prazo — o que cabe antes de segunda

**1. Abrir o PR e mesclar.** O deploy se autocorrige: detecta o caminho divergente, preserva o
ambiente, recria o processo. Ninguém precisa entrar no servidor.

- risco: alguns segundos de indisponibilidade, uma vez só (nos deploys seguintes o caminho já
  bate e volta a ser `restart`)
- se algo falhar antes do ponto crítico, ele aborta sem tocar no processo — o site continua no
  ar como está
- e o portão no fim diz, sem ambiguidade, se funcionou

**2. Só então o QA.** Fazer QA agora seria testar o build de agosto. O guia já está pronto em
`docs/chatpro/QA-DA-INTEGRACAO.md`.

**3. Antes do QA, cadastrar os 6 secrets `CHATPRO_*`** — sem eles as rotas do ChatPro respondem
fechado de propósito.

### Definitivo — depois de segunda

| #   | o quê                                                    | por quê                                                                                                    |
| --- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | `/api/versao` com o SHA do commit, conferido pelo portão | mais direto que hash de chunk; não depende de heurística                                                   |
| 2   | Um diretório só no servidor — apagar o antigo            | hoje existem dois, e o deploy converge para um; o outro é uma armadilha adormecida                         |
| 3   | `.env` completo em arquivo, os 61 secrets no GitHub      | enquanto 49 variáveis viverem só na memória de um processo, ninguém pode reiniciar a máquina com segurança |
| 4   | `ecosystem.config.js` versionado ou systemd              | a definição do processo vira código revisável, em vez de um comando que alguém digitou uma vez             |
| 5   | IP Elástico na EC2 (a nº 3 da Dryelle)                   | não é causa disto, mas evita `SERVER_IP` obsoleto num reboot                                               |

**O item 3 é o mais urgente da lista definitiva** — não pelo deploy, mas porque hoje um reboot
da EC2 é um evento de risco não medido.

---

## O que EXATAMENTE está implementado neste PR

Cada linha abaixo foi **medida**, não estimada. O comando e o resultado estão à direita.

### 1. `package.json` — o build volta a poder falhar

```diff
- "build": "next build && cp -r public … 2>/dev/null || true && cp -r .next/static … 2>/dev/null || true"
+ "build": "next build && cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/"
```

**Por quê:** em shell, `&&` e `||` têm a mesma precedência e associam à esquerda —
`(((next build && cpA) || true) && cpB) || true` devolve **0** mesmo com o build quebrado. O
`set -e` do deploy não salva disso: o comando _teve_ sucesso.

| medição                                                     | antes      | depois     |
| ----------------------------------------------------------- | ---------- | ---------- |
| `pnpm build` com o `next.config.ts` sintaticamente quebrado | **exit 0** | **exit 1** |

### 2. `scripts/preservar-ambiente-do-pm2.mjs` (novo) — o que torna o `delete` seguro

🔴 **Sem isto, recriar o processo derruba o site inteiro.**

| medição                                  | valor  |
| ---------------------------------------- | ------ |
| variáveis que o deploy escreve no `.env` | **12** |
| variáveis que `lib/env.ts` declara       | **61** |
| **nunca escritas em arquivo nenhum**     | **49** |

Entre as 49: `CLERK_SECRET_KEY`, `BREVO_API_KEY`, `PUSHER_SECRET`, `DOCUSIGN_*`. Elas vivem só
na memória do processo, herdadas do primeiro `pm2 start` manual — o deploy #37 revelou que
**não existe `.env` no servidor**.

**Reproduzido localmente:** sem `CLERK_SECRET_KEY`, o servidor standalone responde **HTTP 500
em toda rota, inclusive as públicas** (`Error: @clerk/nextjs: Missing secretKey`).

O script copia para o `.env` apenas as chaves que `lib/env.ts` declara — nunca `PATH`, `HOME`
ou variáveis do sistema —, salva um retrato do processo antes, é idempotente e **nunca imprime
valor**: a saída vai para o log público do Actions.

### 3. `scripts/pm2-do-app.mjs` (novo) — comparar em vez de supor

Lê `pm_exec_path` do registro do PM2. O deploy compara com o caminho que está entregando e
decide: iguais → `restart` (sem queda); diferentes → `delete` + `start`.

⚠️ O parser ignora avisos que o PM2 imprime antes do JSON. Pegar o primeiro `[` não serve — o
próprio aviso é `[PM2] …`. **Isso foi achado pelo teste com PM2 simulado, antes de rodar em
produção.**

### 4. `.github/workflows/deploy.yml` — a sequência segura

```
diagnóstico (read-only)  →  preserva o ambiente  →  server.js existe?  →  restart OU delete+start  →  pm2 save
                                                          └─ não: aborta SEM tocar no processo
```

- **imprime** o caminho que o processo usa e o que o deploy entrega — antes era invisível
- **preserva antes de deletar**; depois seria tarde
- **recusa** mexer no processo se o `server.js` novo não chegou: o site fica no ar como está
- **recria só quando o caminho diverge** — no dia seguinte já bate, e volta a ser `restart`

### 5. `deploy.yml` — o portão que impede "verde mentiroso"

É a recomendação nº 1 do diagnóstico da Dryelle, implementada. Depois do restart, o job baixa
da URL pública um chunk com hash **deste** build e exige HTTP 200 em até 100 s.

**Por que isso prova:** quem serve `/_next/static/chunks/*` é o próprio processo Node, a partir
do build que ele carregou. Se o processo for outro, o arquivo não existe lá.

| medição em `be4hope.org`, 10/09/2026 | resultado |
| ------------------------------------ | --------- |
| chunk do build da vez                | **404**   |
| → portão                             | **FECHA** |

É a única afirmação do workflow que não depende de nenhum passo ter "dado certo".

### 6. `next.config.ts` — `outputFileTracingRoot`

**Não era a causa da falha de produção** — o log do deploy #40 mostra o rsync enviando
`.next/standalone/server.js`, no lugar certo. O runner do GitHub clona só este repositório e o
gatilho não existe lá.

Vale por outra coisa: em máquina de desenvolvimento com projetos ao lado, o Next encontra o
lockfile de um **vizinho** e muda a raiz do empacotamento, gerando
`.next/standalone/Developer/Projects/behemp-site/server.js`. Foi **essa divergência entre o meu
build e o do CI que me fez apontar a causa errada**. Fixar a raiz elimina a classe.

### 7. `__tests__/guardas/o-deploy-entrega-o-que-buildou.test.ts` (novo)

**21 casos**, provados por **9 sabotagens**:

| sabotagem                                      | guarda |
| ---------------------------------------------- | ------ |
| volta o `\|\| true` no build                   | acusou |
| volta `pm2 restart … \|\| pm2 start …`         | acusou |
| tira a leitura do caminho do processo          | acusou |
| tira a verificação de que o `server.js` existe | acusou |
| troca o preservador de ambiente por outro      | acusou |
| **preserva DEPOIS de deletar** (ordem)         | acusou |
| tira o `outputFileTracingRoot`                 | acusou |
| o `exit 1` final do portão vira aviso          | acusou |
| o `exit 0` do sucesso vira `echo`              | acusou |

⚠️ **Uma sabotagem achou um defeito no próprio guarda.** Ele checava a _presença_ de `exit 1`
no portão — e o passo tem dois. Trocar só o final por um `echo` deixava o portão decorativo e o
teste verde. Corrigido para medir **o caminho de falha**, não a presença.

---

## Estado medido no fechamento deste PR

| conferência                    | comando                              | resultado                    |
| ------------------------------ | ------------------------------------ | ---------------------------- |
| guardas                        | `pnpm test`                          | **625 casos, 19 arquivos** ✓ |
| type-check                     | `pnpm typecheck`                     | **0 erros**                  |
| baseline (lint/Prettier/tipos) | `node scripts/conferir-baseline.mjs` | **verde, nada piorou**       |
| build                          | `pnpm build`                         | **exit 0**                   |

## O que NÃO está aqui, e por quê

- **`/api/versao` com o SHA** — é o item 1 do definitivo. O hash do chunk já prova o que
  precisa hoje, e a rota nova exigiria mexer no middleware.
- **Unificar os diretórios no servidor** — o deploy passa a convergir sozinho para o diretório
  do rsync, mas o diretório antigo continua na máquina. Limpeza é trabalho próprio, com acesso
  ao servidor.
- **Os 6 secrets `CHATPRO_*`** — cadastro no GitHub, não é mudança de código.

## O que observar quando este PR for mesclado

1. No passo **Reiniciar Servidor (PM2)**, as duas linhas `[pm2] o processo roda:` e
   `[pm2] o deploy entrega:`. **Elas revelam, pela primeira vez, o caminho real.**
2. O passo **Produção está servindo ESTE build?** — se ficar verde, acabou. Se ficar vermelho,
   ele diz onde olhar.
3. Depois: `curl -o /dev/null -w "%{http_code}" https://be4hope.org/cadastro` deve responder
   algo diferente de **307**. Hoje responde 307 porque o middleware em execução é o antigo.
