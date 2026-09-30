# Handoff de sessão — Be4Hope / BeHemp

> 🔴 **Leia antes de agir.** Se não ler, você refaz o que já foi feito, repete um erro que já
> custou caro, ou reabre uma decisão que já foi tomada.

**Escrito em 30/09/2026, fim da tarde**, ao fim da sessão que entregou a **ADR-0029 inteira** (a
aba ANVISA no "Faço eu mesmo", o pedido de atendimento assistido, a procuração ativada pelo admin e
a chamada de atendimento com câmera, tela e print). Quem pediu e testou: **Davi**.

> 🎯 **A próxima sessão começa uma demanda nova, que Davi vai indicar no chat.** Ele disse _"a
> próxima demanda que já está na ADR"_, e **nenhum documento diz qual é**. Os candidatos escritos
> são as pendências da ADR-0029 §5 (o lugar definitivo do botão "Be4Hope faz por mim", avisar o
> admin quando chega um pedido, o arquivo do vídeo). **Pergunte qual, não escolha.**

> ⚠️ Este arquivo **substitui** o handoff de 21 e 22/09 (ChatPro, documentos do paciente,
> migrations). O que dele ainda vale foi trazido para as §4 e §5, marcado.

---

## §1 — O que está no ar agora

| o quê               | estado                                                                                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| produção (`main`)   | `6065964`, merge do **PR #145**, deploy `36764049030` em 30/09/2026 às 16:15 (Brasília). Home 200 durante todo o deploy; o portão do deploy imprimiu _"produção está servindo ESTE build"_ [medido] |
| banco de produção   | Postgres 17.11 (Neon). `__drizzle_migrations` em `53` linhas, `max(created_at)` = `1790784182806` (a 0050), medido por Davi na VPS depois do deploy do PR #141 [medido]                             |
| PR aberto           | **#146** (`docs/fase-2-2-em-producao`): só documentação, este handoff incluso. **Não mesclado.** Mesclar dispara deploy; pode esperar a próxima entrega                                             |
| branches locais     | `feat/anvisa-faco-eu-mesmo`, `feat/atendimento-camera-e-print`, `feat/atendimento-tela-cheia` e `docs/adr-0029-em-producao` já estão **dentro** da `main`. Nada nelas falta subir                   |
| fora do repositório | `.claude/rules/ponte-enderecamento-dos-prompts.md` é **pessoal do Davi**, não rastreado, e **não está no `.gitignore`**. Não fazer `git add .`                                                      |

Os três PRs desta demanda, na ordem: **#141** (Fases 1 e 2, com a migration 0050), **#144** (Fase
2.1: câmera nos dois lados, tela do admin, print ampliado), **#145** (Fase 2.2: miniatura do print,
troca do destaque, tela cheia). Entre eles entrou o **#143** da Dryelle (apagar procuração e
autorização pelo admin), que toca `app/(admin)/admin/anvisa/page.tsx` e
`app/api/anvisa/atualizar-status/route.ts`.

## §2 — Onde a sessão parou

A demanda terminou. Davi testou em produção, com uma conta de paciente e uma de admin em duas
janelas, e escreveu _"tudo funcionando corretamente"_. Depois pediu para atualizar a documentação e
este handoff, e disse que a próxima demanda será feita em outro chat. A ADR-0029 foi marcada como
entregue, o Item 56 fechado no `03` e no `04`, e tudo isso está no PR #146, que ainda não foi
mesclado. Não há código pendente de commit. O último commit de código em produção é `6065964`.

O teste com **dois aparelhos** (por exemplo, paciente no celular) não foi relatado à parte. O
travamento de vídeo que Davi viu era, pela medição dele, a mesma câmera nas duas janelas (§7).

## §3 — O que o dono vai fazer agora

Davi abre um chat novo para a próxima demanda. Ele desenvolve com a **Dryelle**, que publica na
`main` em paralelo (o PR #143 entrou no meio desta sessão). Antes de abrir branch, faça
`git fetch` e compare com a `origin/main`: ela pode ter mudado de novo.

## §4 — Pendências com prazo

### Desta sessão

| o quê                                                                                                        | de quem                | consequência de perder                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O arquivo de backup** `~/backup-behemp-20260930-1711.dump` na VPS (35 MB, **todos os dados de pacientes**) | Davi ou Diniz          | fica na VPS sem prazo de retenção. É dado de saúde fora do banco; apagar ou guardar é decisão dele. **Nunca copiar para fora nem colar conteúdo** |
| **TURN** (`CLOUDFLARE_TURN_*`) ausente em produção (`DO-78`, _"faremos depois"_)                             | Davi                   | teleconsulta e chamada de atendimento só com conexão direta: em rede restritiva, **não conectam**. A tela avisa. Item 63 do `04`                  |
| **Item 64**: o "Registre-se" falha na confirmação do código com `JSON.parse`                                 | Davi (medir)           | quem se cadastra por `/registrar-se` pode travar. Hipóteses e como medir no `04`                                                                  |
| **Item 65**: apagar a autorização (PR #143) não encerra o pedido nem a chamada dela                          | Davi decide o desfecho | linha aberta para sempre e chamada que o paciente ainda abre pelo link. Davi: _"isso corrigiremos depois"_                                        |
| **Item 66**: uma segunda aba do paciente faz o admin renegociar e corta a tela compartilhada                 | —                      | baixo; anterior à Fase 2.1                                                                                                                        |
| Itens **57 a 62** (catalogados na Fase 1 e 2; ver o `04`)                                                    | —                      | o mais grave é o **60**: o anexo do chat geral vai para store **público** e não confere participação                                              |

### De terceiros — trazidas do handoff anterior, **não reconferidas** nesta sessão

- Revisão dos **dois textos de consentimento** e `CONTROLADOR`/`RETENCAO` (Jurídico):
  `CONSENTIMENTO_PRONTO_PARA_USO = false` em `lib/lgpd/consentimento.ts`.
- **`GAP-16`** (uso secundário no RAG), **`GAP-06`** (LLM novo e imagem clínica), **`GAP-03`**
  (corpus validado), **`GAP-11`** (RAM), **`DO-13`** (exames), enquadramento **SaMD**.
- Prazos regulatórios já correndo: SNCR (`REC-02`) é exigência corrente, e `lib/receituario/`
  nunca foi conferido contra ela (Item 11).

## §5 — 🔴 O que NÃO fazer nesta sessão

### Da ADR-0029, rejeitado com motivo

1. **Não devolver ao paciente a escolha "Be4Hope faz por mim".** O único lugar da procuração é o
   botão abaixo de "Atendimento com suporte", liberado pelo **admin** (`DO-77`). O aviso do painel
   também não a oferece.
2. **Não criar papel `acolhimento`.** Foi a versão 2 da ADR e Davi a derrubou: quem ativa é o
   **admin** (ADR-0029 §8).
3. **Não pôr o admin na sala da teleconsulta** para reaproveitar a chamada. A chamada de atendimento
   tem tabelas, rotas e canal próprios (D-13, D-14); misturar quebra o escopo que o guarda
   `autorizacao-tem-escopo-de-objeto` prova.
4. **Não gravar a chamada** (`MediaRecorder`) nem transcrevê-la (D-19). O guarda quebra o build.
5. **Não usar a URL do blob do print.** A imagem vem da rota autenticada, e a miniatura e o modal
   usam **uma** cópia local: cada exibição é **uma** leitura auditada (`DO-83`).
6. **Não impedir o admin de escolher a tela inteira** pelo `displaySurface`: o navegador trata como
   preferência, e a tela prometeria uma proteção que não garante (D-22). O aviso é o controle.
7. **Não tratar "câmera preta" como defeito de rede.** Era o palco vazio, e hoje diz o que falta.

### Trazidas do handoff anterior, ainda valendo

8. Não acrescentar `procuracao_especifica` a `DOCUMENTOS_DO_FLUXO` (vocabulário da Greens, não da
   tela; 22/09).
9. Não rodar `prettier --write` em arquivo de produção que já existe (`DO-35`).
10. Não rodar `pnpm build` com o dev server de pé (o `.next` vira "stale" e dá 500).
11. Não citar a RDC 327/2019 (revogada pela 1.015/2026, `CAN-00`).
12. Não acrescentar campo de dose ao contrato da IA (ADR-0009 D-02).
13. Não corrigir os uploads públicos de passagem (Item 6) nem o Item 60: trabalho próprio, com
    autorização.
14. Não editar `AGENTS.md`, nem contornar um hook editando o hook.
15. **Não mesclar na `main` sem a ordem do dono.** O merge **é** o deploy. Abra o PR e entregue o
    comando (`gh pr merge N --merge`).

## §6 — Decisões tomadas nesta sessão

Todas estão na [ADR-0029](adr/ADR-0029-a-anvisa-abre-no-faco-eu-mesmo-e-a-procuracao-e-ativada-pelo-admin.md),
e as do dono no `02-CATALOGO-DE-REGRAS.md`:

- `DO-69` a `DO-78`: a demanda original, o pedido de atendimento, o status `rejeitado_anvisa`, o
  lugar único da procuração, a 0050 autorizada, o TURN para depois.
- `DO-79`: câmera nos dois lados (D-21). **Começar desligada foi escolha técnica minha**, pela
  necessidade (`LGPD-08`), não de Davi; ele não se opôs.
- `DO-80`: o admin também mostra a tela, com aviso sobre dado de outros pacientes (D-22).
- `DO-81`: o print abre ampliado com zoom (D-23).
- `DO-82`: trocar o destaque e tela cheia (D-25, D-26).
- `DO-83`: o print aparece como miniatura no chat; retifica o "só busca no clique" da D-23.
- Técnica, sem DO: a negociação com três canais sendrecv sem renegociar, e o evento `midia`
  conferido por inteiro na rota (D-24); o erro da câmera pela causa (D-27).

Nenhuma decisão desta sessão ficou sem ADR.

## §7 — O que a sessão aprendeu e não está no código

### Medições

- **Uma câmera atende um programa por vez.** Davi, com a mesma webcam nas duas janelas: _"as 2
  funcionam e 1 fica travada, se eu paro uma e tento outra funciona"_. Teste de chamada com vídeo
  precisa de **dois aparelhos**; num só, o travamento é do hardware.
- **O Chrome não lista a aba da própria chamada** em "Guia do Chrome": com uma aba só, a lista fica
  vazia. "Janela" e "Tela inteira" funcionam (Davi, 30/09).
- **A chamada conectou em produção sem TURN**, nas duas janelas da mesma máquina. Não prova rede
  restritiva.
- **Produção tem 4 linhas em `__drizzle_migrations` que a `main` não conhece** (do catálogo de
  produtos). O migrator pula migration com `when` abaixo do `max(created_at)`: a 0050 foi gerada com
  `when` acima e aplicou. Ver `docs/03`, achado da 0050.
- **Doze autorizações já estavam em `representacao` sem aprovação** antes da ADR-0029; a trava nova
  não tirou delas o checklist da procuração (medido por Davi, 30/09).

### Do ambiente, que custa caro errar

- **O console da AWS corta colagem longa.** Bloco para a VPS: até ~15 linhas, em passos, só
  leitura, testado antes num banco descartável, sem PII na saída. Script maior vai em base64 com
  conferência de sha256.
- **O shell do Bash tool é zsh:** lista em variável não se separa em palavras. Script que troca
  arquivo do repositório vai em `bash -c` com array e `trap` de restauração.
- **Não deixe o shell dentro do scratchpad:** os hooks resolvem caminho pelo diretório atual e
  bloqueiam tudo. Use caminho absoluto.
- **A prova da chamada roda no Chromium sem Clerk:** `scripts/provar-chamada-no-navegador/`, com
  `NEGOCIACAO=<arquivo>` para rodar contra outra versão (sabotagem). A **tela** não roda local (sem
  `CLERK_SECRET_KEY`), e se confere em produção.

### Retratações

- Disse que o "quadro preto" era câmera: **não era**. Era o `<video>` da tela do paciente, desenhado
  sempre, antes de haver vídeo.
- Atribuí o `318` do portão do Prettier ao `docs/04`: **errado**. O `docs/04` já estava fora na
  `main`; o arquivo a mais era a regra pessoal do Davi, não rastreada. No CI o portão dá `317`.
- Li no print 24 que o admin não transmitia a tela: **transmitia**. O que falhou foi a aba "Guia do
  Chrome", pelo motivo acima.

## §8 — Estado da suíte

| comando                                                | resultado                                                                                                        | quando / onde                            |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `pnpm test`                                            | **1861 casos em 77 arquivos, todos verdes**                                                                      | 30/09, local e no CI do PR #145 [medido] |
| `node scripts/conferir-baseline.mjs`                   | lint 202/202, warnings 119/119, type-check 0, Prettier **317/317 no CI** (318 local, pelo arquivo não rastreado) | 30/09, CI do PR #145 [medido]            |
| `pnpm build`                                           | exit 0. O `Dynamic server usage` de `/admin/alertas` no log é aviso de pré-renderização, anterior                | 30/09, local [medido]                    |
| prova no Chromium da negociação                        | **25 de 25**, e 5 sabotagens acusadas                                                                            | 30/09, Fase 2.1 [medido]                 |
| guarda `a-chamada-de-atendimento-nao-grava-e-nao-vaza` | **55 casos**; 25 sabotagens acusadas nas Fases 2.1 e 2.2                                                         | 30/09 [medido]                           |
| integração (`vitest.integracao.mts`, Postgres real)    | **não rodada** nas Fases 2.1 e 2.2: elas não tocaram banco. A última rodada foi na Fase 2 (ADR-0029 §10.4)       | —                                        |

Nenhum teste instável conhecido.
