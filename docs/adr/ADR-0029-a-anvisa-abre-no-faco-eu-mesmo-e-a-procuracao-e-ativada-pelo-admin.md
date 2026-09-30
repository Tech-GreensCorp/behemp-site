# ADR-0029 — A ANVISA abre no "Faço eu mesmo", e a procuração é ativada pelo admin

> **Status:** ✅ **aceita por Davi**, 29/09/2026, com as respostas da §0, linhas 9 a 19. Escrita
> antes do código. **Não há implementação.** A migration está autorizada por escrito em
> `.claude/autorizacoes.txt`, com a condição de seguir o roteiro de integridade da D-05.
>
> **Status anterior (29/09/2026, mesmo dia):** 📋 proposta, com quem pediu ainda sem se identificar.
>
> **Quem decidiu:** **Davi**, depois de reunião com o chefe de desenvolvimento em 29/09/2026.
> Desenvolvem: Davi e a Dryelle.
>
> **Prioridade:** 1 da nova ordem definida na reunião. As outras demandas continuam, depois.
>
> **Princípio:** L (front-end essencial: acessibilidade, estados de vazio) e H (segurança: a
> ativação da procuração é ato do admin, conferido no servidor; o pedido só vale para a
> autorização do próprio paciente). **Fase:** 2, 5 e 6.
>
> ⚠️ **Esta ADR mudou quatro vezes durante o alinhamento, no mesmo dia.** A primeira versão
> criava um papel novo, `acolhimento`. A decisão final é: o **admin** ativa, dentro de uma lista
> de **pedidos de atendimento assistido**. As versões anteriores e o motivo de cada troca estão
> na §8, e não se repropõem sem ler ali.

## §0 — O que foi pedido e respondido, nas palavras de Davi (29/09/2026)

As decisões têm ID no catálogo: `DO-69` a `DO-77` (`docs/02-CATALOGO-DE-REGRAS.md`).

| #   | literal                                                                                                                                                                                                                                                                                                                                                                           | o que fixa                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | _"nessa tela inicial do perfil do paciente, não terá mais o botão para be4hope faz pra mim, esse botão ficará oculto"_                                                                                                                                                                                                                                                            | o paciente **não escolhe** a procuração sozinho                                                                                                                                                                                                  |
| 2   | _"será acionado pelo perfil de acolhimento (nova atualização do sistema, está na main)"_                                                                                                                                                                                                                                                                                          | ⛔ **retificado** pelas linhas 6 e 7                                                                                                                                                                                                             |
| 3   | _"disponibilizando essa tela inicial de como prefere fazer a autorização da anvisa, ela sairá e irá direto para a tela do botão faça eu mesmo"_                                                                                                                                                                                                                                   | a tela "Como prefere fazer?" **sai**; o paciente cai direto no **passo a passo**                                                                                                                                                                 |
| 4   | _"nessa tela terá um local bem grande que terá um video, primeiro você colocará todo o painel e deixar plug to play para so por o video e colocar o caminho dele no arquivo"_                                                                                                                                                                                                     | área **grande** de vídeo, pronta; o vídeo entra trocando **um caminho num arquivo**                                                                                                                                                              |
| 5   | _"terá ao final de todo passo a passo um botão chamado atendimento com suporte, esse atendimento ele vai da para uma outra tela, por enquanto vamos deixar ele sem função"_                                                                                                                                                                                                       | botão **"Atendimento com suporte"** no fim. ⛔ o "sem função" foi **retificado** pela linha 8                                                                                                                                                    |
| 6   | _"o acolhimento na verdade existe na greens, nós teremos que criar um perfil de acolhimento aqui na be4hope"_                                                                                                                                                                                                                                                                     | ⛔ **retificado** pela linha 7 (ver §8)                                                                                                                                                                                                          |
| 7   | _"não vamos fazer um perfil novo de acolhimento na be4hope, na verdade nós faremos esse vínculo pelo perfil de admin no botão de ativação da procuração da anvisa que inclusive aparece logo abaixo do botão do atendimento assistido que nós faremos"_                                                                                                                           | **sem papel novo**. O **admin** ativa a procuração; o botão dela fica **logo abaixo** do de suporte                                                                                                                                              |
| 8   | _"os pacientes que solicitarem atendimento assistido aparecerão na tela de anvisa em uma lista em formato de botão expansível na qual ela vai ter lá o botão de ativar a procuração da anvisa feita por nós, que no caso é a mesma tela que o botão be4hope faz para mim tem, e aí o botão ficará disponível no final da tela e vai ficar em outro lugar mas por enquanto só aí"_ | o pedido de atendimento assistido leva o paciente a uma **lista expansível** no `/admin/anvisa`; dentro do item, **"Ativar procuração"**; o botão do paciente leva à **mesma tela** do "Be4Hope faz por mim", **no final** da tela, por enquanto |
| 9   | _"DAVI"_ (resposta à pergunta de quem decide)                                                                                                                                                                                                                                                                                                                                     | a decisão é de **Davi**                                                                                                                                                                                                                          |
| 10  | _"temos que solucionar isso para funcionar exatamente como eu falei"_ (sobre os três caminhos que prometem a procuração)                                                                                                                                                                                                                                                          | todo caminho leva ao **passo a passo**; nenhum aviso promete a procuração antes de o admin ativar (D-10)                                                                                                                                         |
| 11  | _"isso, só que atendimento com suporte é tipo um meet que já existe em teleconsulta, só que o paciente pode transmitir a tela do celular ou pc dele para ser auxiliado ou ser guiado por voz mesmo"_                                                                                                                                                                              | clicar é o **pedido**, e o botão é um só. O atendimento em si é uma **chamada de voz com compartilhamento de tela**, no molde da teleconsulta (D-11)                                                                                             |
| 12  | _"exatamente seguindo padrão"_ (sobre guardar o vídeo no armazenamento de arquivos)                                                                                                                                                                                                                                                                                               | o vídeo fica no **Vercel Blob**, como os outros arquivos (D-07)                                                                                                                                                                                  |
| 13  | _"ele vai pro status de pendente autorização"_ (sobre o paciente depois de ativado)                                                                                                                                                                                                                                                                                               | ativar muda o pedido para **pendente autorização**; ele não some da lista (D-03)                                                                                                                                                                 |
| 14  | _"pode"_ (sobre desativar antes de o paciente assinar)                                                                                                                                                                                                                                                                                                                            | desativar existe, e só antes da assinatura (D-04)                                                                                                                                                                                                |
| 15  | _"mantém-se"_ (sobre o texto do botão da procuração)                                                                                                                                                                                                                                                                                                                              | o botão continua **"Be4Hope faz por mim"** (D-06)                                                                                                                                                                                                |
| 16  | _"está sim"_ (sobre o texto novo do aviso do painel)                                                                                                                                                                                                                                                                                                                              | o texto da D-10 está **aprovado**                                                                                                                                                                                                                |
| 17  | _"ele pode mandar print no chat que vai ficar na lateral esquerda, em horizontal, ali o paciente pode mandar mensagem ou enviar print"_                                                                                                                                                                                                                                           | a chamada tem um **chat na lateral esquerda**, com mensagem e **print**; é assim que o celular mostra a tela (D-11)                                                                                                                              |
| 18  | _"sim"_ (sobre o pedido virar "concluído" quando a ANVISA aprova)                                                                                                                                                                                                                                                                                                                 | terceiro status, **`concluido`**, sai dos pendentes e **não é apagado** (D-03)                                                                                                                                                                   |
| 19  | _"temos que tomar cuidado e fazer testes além de pesquisas de técnicas para conseguirmos fazer isso mantendo a integridade dos dados"_ · _"eu autorizo"_                                                                                                                                                                                                                          | migration **autorizada**, com o roteiro de integridade da D-05 como condição                                                                                                                                                                     |
| 20  | _"isso vou ter que testar em produção, o importante é o site não cair"_ (sobre ver as telas rodando)                                                                                                                                                                                                                                                                              | as telas se conferem em produção; o pré-deploy prova que **o site não cai**                                                                                                                                                                      |
| 21  | _"ele fica como rejeitado anvisa"_ (sobre o pedido quando a ANVISA rejeita)                                                                                                                                                                                                                                                                                                       | quinta situação do pedido: `rejeitado_anvisa` (`DO-76`)                                                                                                                                                                                          |
| 22  | _"aparece um botão logo abaixo da atendimento com suporte essa opção é o último caso, e só ativada pelo botão e em si possui todo seu rastreio nos logs, se ainda não existe futuramente vamos criar"_                                                                                                                                                                            | o aviso do painel não oferece a procuração; o botão é o único lugar (`DO-77`)                                                                                                                                                                    |
| 23  | _"vamos terminar tudo, testar, e garantir a segurança e compatibilidade e depois nós quando tivermos aptos, testados e comprovados vamos fazer os procedimentos pré-deploy"_                                                                                                                                                                                                      | deploy só depois dos procedimentos de pré-deploy, com tudo provado                                                                                                                                                                               |

## §1 — O que existe hoje, medido no código (`origin/main` `7a2f5d9`)

1. A tela é um único Client Component com seis etapas em estado local:
   `'inicio' | 'escolha' | 'checklist' | 'guiada' | 'formulario' | 'acompanhamento'`
   (`app/(paciente)/paciente/anvisa/page.tsx:341`).
2. A etapa **`escolha`** é a tela "Como prefere fazer sua Autorização ANVISA?", com os dois
   cartões: "Faço eu mesmo" → `definirModalidadeAnvisa(id, 'guiada')` e "Be4Hope faz por mim" →
   `definirModalidadeAnvisa(id, 'representacao')` (`page.tsx:638-708`).
3. A etapa **`guiada`** é o "Faço eu mesmo": link do Gov.br, **10 passos** e um cartão final
   "Enviar autorização obtida" (`page.tsx:710-876`). **Não há vídeo nem botão de suporte.**
4. Quem entra em `escolha`: o `handleIniciar` depois de "Iniciar Processo" (`page.tsx:447`), a
   leitura quando `modalidade` é nula (`page.tsx:374-375` e `425-426`), e os dois botões
   **Voltar** (`page.tsx:722` e `894`).
5. ⚠️ A coluna é `modalidade ... .notNull().default('guiada')`
   (`db/schema/autorizacoes-anvisa.ts:22`). Toda autorização **nasce `guiada`**, então o ramo
   "`modalidade` nula → `escolha`" é praticamente morto; a escolha hoje aparece por causa do
   `handleIniciar` e dos Voltar.
6. `representacao` acrescenta `procuracao_especifica` e `laudo_medico` ao checklist
   (`app/(paciente)/_actions/anvisa.ts:214-240`) e mostra o `ProcuracaoEspecificaCard`
   (DocuSign) no checklist (`page.tsx:901`). A action só aceita o **próprio paciente**
   (`verificarPaciente`, escopo por `pacienteId`).
7. **A tela do admin já lista as autorizações**, uma por cartão, com a linha de ações "Iniciar
   no Gov.br" (quando há procuração assinada) e "Atualizar status"
   (`app/(admin)/admin/anvisa/page.tsx:302-318`). É ali que a ativação cabe sem tela nova.
   `verificarAdmin()` já existe (`lib/auth/permissions.ts:121`). Item expansível já existe como
   componente: `components/ui/accordion.tsx`, em uso nas páginas públicas.
8. **Não existe papel "acolhimento" na Be4Hope**, e continua não existindo: `userRoleEnum` é
   `['admin', 'medico', 'paciente']`. Aqui "acolhimento" é só a primeira fase do Kanban
   (`db/schema/enums.ts:78-84`). Na Greens o papel existe (§8).
9. O CSP já permite vídeo do próprio site e do Blob
   (`media-src 'self' blob: https://*.public.blob.vercel-storage.com`, `next.config.ts:139`), e
   **não** permite YouTube nem Vimeo em `frame-src` (`next.config.ts:140`).

10. **A teleconsulta já compartilha tela**, por `navigator.mediaDevices.getDisplayMedia`
    (`components/teleconsulta/GlobalTeleconsultaHost.tsx:437`), sobre WebRTC com TURN contratado
    (ADR-0008, `lib/webrtc/ice-servers.ts`). A sala é de **médico e paciente**: `teleconsultas`
    tem `medicoId` e `pacienteId` (`db/schema/teleconsultas.ts:19-22`), e o guarda
    `autorizacao-tem-escopo-de-objeto` prova o escopo por essas duas pontas. **Admin não é
    parte dessa sala.**
11. 🔴 [medido] **O navegador do celular não compartilha a tela.** Na tabela oficial de
    compatibilidade da MDN (`mdn/browser-compat-data`, `api/MediaDevices.json`, lida em
    29/09/2026), `getDisplayMedia` está em `false` para **Chrome Android**, **Safari iOS** e
    **Firefox Android**. O Chrome Android até expunha o método entre as versões 72 e 88, mas
    _"always failed with `NotAllowedError`"_. No computador funciona (Chrome 72+, Safari 13+,
    Firefox 66+, Edge 79+). Ver D-11, item 2: resolvido pelo chat com print (§0.17).
12. Os status da autorização são `pendente`, `documentos_enviados`, `em_analise`, `aprovado`,
    `pendencia_documental` e `rejeitado` (`db/schema/enums.ts:161-168`). **"Pendente
    autorização" não é nenhum deles**: é o status do **pedido**, não da autorização (D-03).

## §2 — O que depende da tela e quebraria em silêncio

🔴 **Quatro caminhos mandam o paciente para `/paciente/anvisa` prometendo a procuração:**

| origem                                                                 | o que promete                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `components/paciente/AvisoDaProcuracao.tsx:79-90` (painel)             | _"Nós preparamos a procuração… você só confere e assina"_ · **"Fazer a procuração agora"** |
| `lib/parceiros/destino-do-paciente.ts:40` (destino depois do cadastro) | o paciente que só precisa da procuração vai **direto** para `/paciente/anvisa`             |
| `app/(auth)/redirect/page.tsx:218` (login sem autorização)             | leva à tela da procuração                                                                  |
| `docs/11-OS-OITO-FLUXOS.md` fluxos 5, 5b, 3 e 4                        | "direcionado direto para a procuração da ANVISA"                                           |

Com a procuração oculta até o admin ativar, esse paciente chega a uma tela **sem a
procuração**, lendo um aviso que diz que ela está pronta. É a tela desmentindo a si mesma, a
classe de defeito que os guardas `o-aviso-da-procuracao-chega-a-tela` e
`o-destino-do-paciente-segue-o-que-falta` existem para impedir. ⚠️ **Os dois continuariam
verdes**: eles conferem o aviso e o destino, não o que a tela de destino oferece. Resolvido pela **D-10**.

Também dependem da tela: `a-anvisa-aproveita-o-que-ja-chegou`, `o-laudo-avisa-e-nao-trava` e
`ver-o-documento-passa-pela-porta-autenticada`. Nenhum deles cita a etapa `escolha`; precisam
continuar verdes.

## §3 — Decisão

**D-01. A etapa `escolha` sai do caminho do paciente.** "Iniciar Processo" e os dois Voltar
deixam de levar a ela, e a tela abre direto na etapa `guiada`. A escolha entre os dois cartões
deixa de existir: a procuração passa a ser um **botão próprio**, que só aparece depois de o
admin ativar (D-04 e D-06).

**D-02. "Atendimento com suporte" é um pedido que o paciente faz, e o admin vê.** O botão no fim
do passo a passo é o mesmo que Davi chama de "atendimento assistido" (§0.11). Ao clicar, o
paciente **registra um pedido** para a própria autorização. No servidor:

1. action do paciente `pedirAtendimentoAssistido(autorizacaoId)`: `verificarPaciente()`, Zod no
   id, a autorização é **dele** e não está apagada (escopo de objeto, OWASP API1); grava o
   pedido e registra em `logs_auditoria`;
2. **idempotente**: pedir de novo, com um pedido aberto, não cria outro nem muda a data do
   primeiro;
3. depois do clique, a tela **diz o que aconteceu** (_"Recebemos seu pedido. Nossa equipe vai
   entrar em contato."_) e o botão mostra que o pedido já foi feito. Clique sem retorno faz o
   paciente clicar de novo e achar que o site travou.

**D-03. No `/admin/anvisa`, os pedidos aparecem numa lista de itens expansíveis, com status.**
Uma seção nova na tela que o admin já usa, **"Pedidos de atendimento assistido"**, com um item
por pedido, montada com o `Accordion` que já existe (`components/ui/accordion.tsx`; nenhum
componente novo, sem `<Table>`).

- **status do pedido**: `aguardando_ativacao` ao nascer; `pendente_autorizacao` depois que o
  admin ativa (§0.13); de volta a `aguardando_ativacao` se o admin desativar (D-04);
  `concluido` quando a autorização da ANVISA vira `aprovado` (§0.18); `rejeitado_anvisa` quando ela
  vira `rejeitado` (§0.21, `DO-76`), e o paciente pode pedir de novo. O item **não some** ao ser
  ativado: muda de status e mostra quem ativou e quando. `concluido` sai dos pendentes, e a linha
  **nunca é apagada**;
- fechado, o item mostra nome do paciente, status do pedido e desde quando ele pediu. Aberto,
  mostra o botão **"Ativar procuração"** (ou **"Desativar"**, D-04);
- quem lê: só **admin**, conferido no servidor, como a listagem atual
  (`app/api/admin/anvisa/listar/route.ts:8-13`);
- o que aparece: o **mínimo** para o admin agir. Sem CPF, sem documento, sem prescrição dentro
  do item (LGPD art. 6º, III). O cartão da autorização, mais abaixo, continua como está;
- a lista vem do banco, filtrada na query.

**D-04. O admin ativa e pode desativar, e só antes da assinatura.** No servidor:

1. `ativarProcuracaoAnvisa(pedidoId)`: `verificarAdmin()`, Zod, o pedido existe e está em
   `aguardando_ativacao`; muda para `pendente_autorizacao`, grava **quem ativou e quando** e
   registra em `logs_auditoria`;
2. `desativarProcuracaoAnvisa(pedidoId)` (§0.14): `verificarAdmin()`; **recusa** se a
   procuração já foi assinada; volta o status, grava quem desativou e quando, e registra em
   `logs_auditoria`. A ativação anterior **não se apaga**: fica no registro (proibição 4 do
   `CLAUDE.md`);
3. `definirModalidadeAnvisa(…, 'representacao')` **deixa de ser aceita vinda do paciente**
   sem pedido em `pendente_autorizacao`. Esconder o botão sem mudar a action não basta: a
   Server Action continua chamável por quem conhece o id, e o "oculto" seria só visual (OWASP
   API5, função de outro papel chamada pelo cliente).
   ⚠️ **Desativar depois de o paciente clicar e antes de assinar**: a autorização já estaria em
   `representacao`. Desativar volta a modalidade para `guiada`, e o checklist deixa de pedir a
   procuração. Isso se prova com teste antes de existir.

**D-05. O pedido mora numa tabela própria, com migration só aditiva, provada antes.** Tabela
nova `pedidos_atendimento_assistido`: autorização, paciente, status (enum novo), quando pediu,
quem ativou e quando, quem desativou e quando. Todos os campos de ato humano são anuláveis, e
nenhuma linha se apaga.

Rejeitado: **colunas em `autorizacoes_anvisa`** (versão 4 desta ADR). Ativar, desativar e
ativar de novo sobrescreveriam o "quem e quando" anterior. E o atendimento por chamada (D-11)
precisa de um lugar para pendurar as sessões, que não é a autorização.

**A técnica, pelo pedido de Davi de manter a integridade dos dados (§0.19):**

1. **Nomear:** é a fase _expand_ da **mudança paralela** (Fowler, _ParallelChange_: _"augment
   the interface to support both the old and the new versions"_). Aqui não há fase _contract_:
   nada antigo sai. A migration **só acrescenta** (tabela e tipo novos); nenhuma coluna, tabela
   ou valor de enum existente muda, e nenhuma linha existente é tocada. Desfazer é apagar os
   dois objetos novos.
2. **A duplicidade é barrada pelo banco, não só pela action.** Um índice único **parcial**
   permite um único pedido **aberto** por autorização (status diferente de `concluido`), e
   quantos concluídos houver. É o exemplo 11.3 da doc do PostgreSQL 16 ("Partial Indexes"):
   _"only one 'successful' entry … but there might be any number of 'unsuccessful' entries"_.
   Dois cliques simultâneos não criam dois pedidos, mesmo que a checagem da action perca a
   corrida.
3. **Chaves estrangeiras** para `autorizacoes_anvisa` e `pacientes`, sem `ON DELETE CASCADE`:
   entidade clínica tem soft delete aqui, e cascata apagaria histórico (proibição 4 do
   `CLAUDE.md`). [lido] A doc do PostgreSQL 16 (CREATE TABLE): _"The addition of a foreign key
   constraint requires a SHARE ROW EXCLUSIVE lock on the referenced table."_ O lock é de
   instantes, durante o deploy, e não bloqueia leitura.
4. **Gerada pelo `drizzle-kit generate --name pedidos_atendimento_assistido`**, SQL, snapshot
   e journal commitados juntos, sem edição à mão (`AGENTS.md`).
5. 🔴 **Duas armadilhas deste repositório, as duas medidas antes (`docs/03`, achado de
   13/09/2026; `docs/04`, Item 32):**
   - **as migrations não rodam do zero**: contra banco vazio, o histórico quebra numa migration
     antiga (`ALTER TABLE consultas ALTER COLUMN status SET DEFAULT 'reservada'`). Aplicar
     0000..0049 em Docker **não** reproduz produção;
   - **o migrator pula em silêncio** a migration cujo `when` no journal seja menor que o
     `max(created_at)` já aplicado. A 0039 ficou assim, sem ninguém saber, e o consentimento
     LGPD deixou de ser gravado. A última do journal é a 0049, `when` `1790193675250`.
6. **Provada antes do deploy, pelo caminho que provou a 0045** (`docs/04`, Item 32: _"Postgres
   16 descartável + `BEGIN … ROLLBACK` contra o schema real de produção"_):
   1. [Davi ou Diniz, na VPS] três medidas só de leitura, sem dado de paciente: o schema de
      produção (`pg_dump --schema-only`), o `max(created_at)` e a contagem de linhas de
      `drizzle.__drizzle_migrations`. A contagem diz se **todas** as 0046..0049 estão aplicadas;
      se faltar alguma, o migrator aplica junto, e isso se decide antes (foi o caso da 0044);
   2. Postgres 16 em Docker com **esse** schema; semear um cenário por caso (autorização sem
      pedido, com pedido aberto, com pedido concluído, apagada) **e um controle limpo**;
   3. medir antes: contagem e hash das linhas de `autorizacoes_anvisa`, `pacientes` e
      `procuracoes_especificas`;
   4. aplicar a 0050 pelo **mesmo migrator de produção** (`scripts/migrar.mjs`, e não o
      `drizzle-kit push` da integração), e medir de novo. Os números têm de ser **idênticos**;
   5. conferir que o `when` da 0050 é **maior** que o `max(created_at)` medido no passo 1;
   6. provar o índice parcial: um segundo pedido aberto na mesma autorização **falha**, e um
      segundo depois de `concluido` **passa**;
   7. rodar o migrator **duas vezes**: a segunda não pode fazer nada;
   8. antes do deploy, **backup conferido** por Davi ou Diniz (`pg_dump` na EC2 e
      `pg_restore --list`), como em 21/09/2026.
      **O bloco do passo 6.1 foi escrito e testado em 29/09/2026**, e entregue no chat (a Ponte não
      cria arquivo). Ele lê o `.env` de `.next/standalone/.env`, que é onde o deploy o grava
      (`.github/workflows/deploy.yml`, `ENVFILE=.next/standalone/.env`), com volta para `./.env`.
      Tem duas travas: só `SELECT`/`SHOW` passam, e tudo roda em `BEGIN READ ONLY`. Compara **cada**
      entrada do journal com o banco, pelo `when` e pelo sha256 do arquivo, que é como o migrator
      do `drizzle-orm` 0.44.2 registra (`migrator.js`: `hash: sha256(query)`, `created_at =
folderMillis`). O enum novo se chamará `pedido_atendimento_status`, e o bloco confere que o
      nome está livre. Testado em Postgres 16 descartável, com um container que simula a VPS:
   - controle limpo: 50 de 50, nada faltando, nomes livres, `pg_dump` sem nenhuma linha de dado;
   - acusou a migration **pulada para sempre**, o arquivo **editado** depois de aplicado, a
     linha que só existe no banco e a tabela com o nome ocupado. ⚠️ Nesse cenário a contagem
     dava **50 de 50**, e só a comparação uma a uma denunciou;
   - acusou a migration **pendente** (a última), que o próximo migrate aplica;
   - `pg_dump` 16 contra servidor 17: recusa com _"server version mismatch"_, e o bloco diz para
     parar;
   - sem `DATABASE_URL`: para sem ler nada e sem rodar o `pg_dump`;
   - duas sabotagens: um `INSERT` foi barrado pelo filtro, e um `SELECT` que escreve por dentro
     de uma função foi barrado pelo `READ ONLY` (_"cannot execute INSERT in a read-only
     transaction"_). O banco ficou idêntico antes e depois.
     Dois defeitos do próprio bloco apareceram no teste e foram corrigidos: sem URL, ele imprimia
     `FALHOU:` vazio e o `pg_dump` tentava o socket local.
     ⚠️ **Não testado:** TLS e o pooler reais do Neon, e a versão do `pg_dump` instalada na VPS.

   **[medido] Rodado por Davi na VPS em 30/09/2026, 14:23 (horário da VPS)**, saída colada no chat:
   - servidor **PostgreSQL 17.11** (Neon); cliente `pg_dump` **18.6**, mais novo que o servidor,
     o que o `pg_dump` aceita. Conexão pooled, trocada pela direta. Cópia da estrutura com
     **3774 linhas, 100K, impressão `628bf3348369`, 0 linhas de dado**;
   - journal da VPS **50**, linhas no banco **52**. `max(created_at)` = `1790193675250`, que é o
     `when` da 0049. **Nenhum arquivo diferente do que foi aplicado**;
   - **faltando no banco: 0038 e 0039**, as duas marcadas "pulada para sempre". **Já eram
     conhecidas** (`docs/04`, Item 32): os objetos da 0038 foram aplicados por fora, e a 0039 foi
     refeita pela 0045, aplicada em 21/09/2026. A cópia da estrutura confirma ou desmente isso;
   - **no banco e fora do journal: 4 linhas.** Três são as migrations 0018, 0019 e 0020 da branch
     `origin/feature/product-catalog-v2` (commit `7f6c682`, 13/08/2026, catálogo de produtos):
     o banco de produção tem as tabelas `produtos` e `produto_arquivos`, que a `main` não
     declara. A quarta (`1787338669959`, 21/08/2026 18:57 UTC) **não está em nenhuma branch
     remota**. Achado catalogado no `03`, fora do escopo desta ADR;
   - nomes novos **livres** (tabela e enum);
   - autorizações ANVISA (só contagem): aprovado 1 guiada e 1 representação; documentos enviados
     1 guiada e 4 representação; pendente 2 guiada e **8 representação**. As **12** em
     `representacao` que ainda não foram aprovadas são as que a D-08 protege: seguem como estão,
     sem pedido.

   **[medido] Revisão de integridade pedida por Davi, 30/09/2026, depois de duas colagens
   corrompidas pelo console da AWS no navegador** (ele corta o fim de colagens longas; uma parou
   em `SyntaxError` antes de executar, a outra foi cancelada com Ctrl+C antes de fechar o `if`):
   nova cópia da estrutura comparada com a das 14:23 por `diff` (sem as linhas `\restrict`, que
   mudam a cada `pg_dump`) → **`ESTRUTURA IDENTICA A DAS 14:23`**, 3772 linhas nos dois lados;
   `__drizzle_migrations` → **`52|1790193675250`**, igual; autorizações ANVISA → as **mesmas
   contagens** das 14:23. Daqui em diante, bloco para a VPS vai em **passos de até 15 linhas**,
   com conferência por impressão antes de executar.

   **[medido] As quatro tabelas que a 0050 referencia são idênticas em produção e na `main`**
   (Davi, 30/09/2026, em cinco passos curtos com conferência de impressão antes de executar):
   `autorizacoes_anvisa`, `pacientes`, `users` e `procuracoes_especificas`, com colunas, tipos,
   nulidade, padrões, restrições e índices, dão **131 linhas e impressão `aed3faa3c864`** nos dois
   lados. Por isso o Postgres descartável montado com o schema da `main` é **fiel a produção** no
   que a 0050 toca, e a prova do item 6 roda contra ele. As tabelas que só existem em produção
   (`produtos`, `produto_arquivos`) não são referenciadas pela 0050.

   **[medido] A 0050 provada em 30/09/2026**, na branch `feat/anvisa-faco-eu-mesmo`, em
   PostgreSQL 17 descartável montado com o schema da `origin/main` (as quatro tabelas que
   batem com produção) e o registro de migrations **igual ao de produção**: 52 linhas, sem a
   0038 e a 0039, com as quatro extras. Gerada por `drizzle-kit generate --name
   pedidos_atendimento_assistido`, `when` `1790779511501`, só `CREATE TYPE`, `CREATE TABLE`,
   as quatro chaves e os três índices da tabela nova. Aplicada por `scripts/migrar.mjs`:
   - o registro foi de **52 para 53**: aplicou **só** a 0050; a 0038 e a 0039 continuaram puladas;
   - `users`, `pacientes`, `autorizacoes_anvisa`, `procuracoes_especificas` e `logs_auditoria`
     com a **mesma contagem e a mesma impressão** (md5 das linhas) antes e depois;
   - índice parcial: o 2º pedido aberto é **recusado** (`23505`), também com o 1º em
     `pendente_autorizacao`; um pedido novo depois de `concluido` é **aceito**; outra
     autorização, em paralelo, é aceita;
   - chaves: autorização inexistente e `ativado_por` inexistente **recusados** (`23503`); status
     fora do enum recusado (`22P02`);
   - o migrator rodado **de novo** não fez nada (continuou em 53);
   - duas sabotagens do índice: **único sem o filtro** passou a recusar o pedido novo depois do
     concluído, e **sem índice** passou a aceitar dois abertos. O teste pegou as duas.
     `pnpm test`: **1668 casos em 72 arquivos**, verdes. Portão de baseline: type-check 0; Prettier
     318 contra teto 317, e o arquivo a mais é `.claude/rules/ponte-enderecamento-dos-prompts.md`,
     pessoal e fora do git, que só o `.gitignore` do commit `ac56243` (ainda fora da `main`)
     esconde. Nenhum arquivo desta branch piorou.

   **[medido] A 0050 foi GERADA DE NOVO em 30/09/2026**, depois do `DO-76`, antes de chegar a
   produção. Não se criou uma segunda migration: uma 0051 com `ALTER TYPE … ADD VALUE` para uma
   tabela que ainda não existe em lugar nenhum seria ruído no histórico. A versão anterior foi
   removida e o `drizzle-kit generate` gerou outra, com o mesmo nome; o `diff` entre as duas são
   **exatamente** as duas mudanças: `rejeitado_anvisa` no enum e `concluido_em` → `encerrado_em`.
   `when` novo `1790783178259`, ainda maior que o `max(created_at)` de produção. A prova do item 6
   foi **refeita inteira** contra o registro igual ao de produção: 52 → 53, tabelas existentes
   idênticas, índice recusando o 2º aberto, aceitando um pedido novo depois de `concluido` **e**
   depois de `rejeitado_anvisa`, migrator idempotente.
   ⚠️ O banco local da integração precisou recriar a tabela: `drizzle-kit push` parou numa
   pergunta interativa (renomear ou criar coluna). **Produção não passa por isso**: aplica pelo
   `scripts/migrar.mjs`, que roda o SQL gerado.

   **O que isso decide para a 0050:** ela entra com `when` maior que `1790193675250`, então o
   migrator a aplica, e **só ela**: a 0038 e a 0039 continuam puladas, como hoje, e as quatro
   extras não são tocadas. Nenhum nome colide. ⚠️ **A prova precisa cobrir o caso das 12:** uma
   autorização já em `representacao` e **sem** pedido não pode perder o checklist da procuração
   quando a action passar a exigir o pedido (D-04.3 vale para **entrar** em `representacao`, não
   para quem já está nela).

7. **Autorizada por escrito** em `.claude/autorizacoes.txt` (Davi, 29/09/2026), nos três
   arquivos exatos. ⚠️ Se outra branch gerar a 0050 antes, o número muda e a autorização se
   reescreve.

**D-06. Na tela do paciente, a ordem do passo a passo, de cima para baixo, é esta:**

1. área de vídeo (D-07);
2. link do Gov.br e os 10 passos, como hoje;
3. cartão "Após concluir o processo no Gov.br", como hoje;
4. botão **"Atendimento com suporte"**, que registra o pedido (D-02);
5. **no final da tela, logo abaixo dele**, o botão **"Be4Hope faz por mim"** (§0.15), que só
   aparece com o pedido em `pendente_autorizacao`. Ao clicar, chama
   `definirModalidadeAnvisa(…, 'representacao')` e segue para o checklist com a procuração:
   **a mesma tela a que ele leva hoje**.

⚠️ Davi disse que esse botão _"vai ficar em outro lugar, mas por enquanto só aí"_. O lugar
definitivo é outra decisão, e fica fora desta fatia (§5).

**D-07. A área de vídeo nasce pronta, e o vídeo fica no Vercel Blob (§0.12).** Um arquivo de
configuração, `lib/anvisa/video-do-passo-a-passo.ts`, exporta a URL do vídeo no Blob (e a
legenda, se houver). Com a URL vazia, a área mostra um **estado vazio honesto** (_"vídeo em
breve"_), nunca um player quebrado nem um espaço em branco. Com a URL preenchida, um
`<video controls playsInline preload="metadata">` ocupa a largura do painel, em 16:9, acima dos
10 passos. O CSP já permite `https://*.public.blob.vercel-storage.com` em `media-src` (§1.9).
O vídeo é **institucional, sem dado de paciente**: o store público serve, e a regra do store
privado (Item 6) é para documento de paciente.

**D-08. Autorização que já está em `representacao` continua como está.** Quem já escolheu a
procuração, ou já assinou, segue no checklist com o `ProcuracaoEspecificaCard`. Esta ADR muda a
**entrada**, não o processo em andamento. Nenhuma migration de dado.

**D-09. Sem cor nem animação nova.** Área de vídeo, botões e lista usam os tokens e componentes
que a etapa `guiada` e a tela do admin já usam (`Card`, `Button`, `Accordion`,
`rounded-2xl border-border bg-white`).

**D-10. Nenhum caminho promete a procuração antes de o admin ativar** (§0.10). Os três caminhos
da §2 continuam levando a `/paciente/anvisa`, que agora abre no passo a passo, o que já é
"exatamente como Davi falou". O que muda é **o que o aviso do painel diz**:

- hoje: _"Nós preparamos a procuração com os documentos que você já enviou — você só confere e
  assina."_ · **"Fazer a procuração agora"**;
- **aprovado por Davi (§0.16)**: _"Ela é o que permite importar o medicamento. Veja o passo a passo para fazer pelo
  Gov.br. Se precisar de ajuda, peça atendimento com suporte."_ · **"Ver o passo a passo"**;
- com o pedido em `pendente_autorizacao`, o aviso volta a oferecer a procuração, porque aí ela
  existe.

O destino depois do cadastro e o pós-login **não mudam** de URL. O `docs/11-OS-OITO-FLUXOS.md`
(fluxos 5, 5b, 3 e 4) se atualiza no mesmo commit da implementação.

**D-11. O atendimento com suporte é uma chamada de voz com compartilhamento de tela, e fica
para a próxima fatia** (§0.11). Esta fatia entrega o **pedido** e a **ativação**; a chamada
entra depois, e esta ADR já fixa o que ela precisa respeitar:

1. reusa a infraestrutura da teleconsulta (WebRTC, TURN contratado, compartilhamento de tela
   que já existe), mas **não** a sala médica: a sala da teleconsulta é de médico e paciente, e
   pôr um admin nela quebraria o escopo que o guarda `autorizacao-tem-escopo-de-objeto` prova.
   Sala própria, pendurada no pedido;
2. 🔴 **no celular, o navegador não compartilha a tela** (§1.11). No computador funciona. A
   resposta de Davi (§0.17): a tela da chamada tem um **chat na lateral esquerda**, em
   horizontal, em que o paciente manda **mensagem ou print**. É por ele que o celular mostra o
   que está vendo;
3. o print é **arquivo sensível** (pode mostrar RG, receita, tela do Gov.br): vai para store
   **privado**, é entregue por rota autenticada com escopo de objeto, e cada visualização é
   auditada, como os documentos do paciente. Prazo de retenção: decisão jurídica, e o campo
   nasce vazio até ela (`.claude/rules/seguranca-lgpd.md`). O chat que já existe (Pusher,
   `private-chat-{grupoId}`) é candidato a reuso, a medir nessa fatia;
4. a tela do paciente pode mostrar RG, receita e dado do Gov.br. Por isso a chamada **não é
   gravada**, e o compartilhamento só começa por gesto do paciente (o navegador já exige isso).
   Gravar exigiria outra decisão, com base legal.

## §4 — Rejeitado

| proposta                                                           | por que não                                                                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| papel novo `acolhimento` na Be4Hope                                | decidido em 29/09/2026: o admin faz a ativação (§0.7, §8)                                              |
| só esconder o botão da procuração no JSX                           | a action continua aceitando `representacao` do paciente; o controle seria cosmético (D-04.3)           |
| botão de suporte desabilitado, "em breve" (versão 3)               | superado pela §0.8: o clique é o pedido que faz o paciente aparecer na lista do admin                  |
| "Ativar procuração" solto no cartão de toda autorização (versão 3) | superado pela §0.8: a ativação fica dentro do item de quem **pediu**                                   |
| colunas do pedido em `autorizacoes_anvisa` (versão 4)              | desativar e reativar sobrescreveria quem ativou; a chamada futura não tem onde pendurar sessões (D-05) |
| o item sumir da lista ao ser ativado                               | Davi decidiu que ele muda para **pendente autorização** (§0.13)                                        |
| pôr o admin dentro da sala da teleconsulta                         | a sala é médico-paciente e o escopo dela é provado por guarda; o atendimento tem sala própria (D-11)   |
| apagar a modalidade `representacao` ou migrar as existentes        | quebra processo em andamento e procuração já assinada (D-08; proibição 4 do `CLAUDE.md`)               |
| embed do YouTube                                                   | exige abrir `frame-src` no CSP e leva o paciente a um terceiro; Davi escolheu o Blob (§0.12)           |

## §5 — O que fica de fora desta fatia

- a **chamada** de atendimento com suporte (voz e tela), com as regras da D-11, na próxima fatia;
- o lugar definitivo do botão "Be4Hope faz por mim" (_"vai ficar em outro lugar, mas por
  enquanto só aí"_);
- avisar o admin por e-mail ou notificação quando chega um pedido: por ora ele vê na lista;
- o arquivo do vídeo em si;
- revisar os textos dos 10 passos (mudam só se pedido);
- qualquer papel novo, e qualquer sincronização de papel com a Greens.

## §6 — Perguntas

Respondidas por Davi em 29/09/2026: quem decide, os três caminhos, o botão de suporte, o vídeo,
o status depois de ativar, desativar e o texto do botão (§0, linhas 9 a 15).

Respondidas também, no mesmo dia: o texto do aviso (§0.16), o celular na chamada (§0.17), o
pedido concluído (§0.18) e a migration (§0.19).

**Continuam abertas, para a fatia da chamada (D-11), e nenhuma trava esta:**

- **P10.** Por quanto tempo o print e as mensagens do chat ficam guardados? É decisão jurídica.
- **P11.** Quem atende a chamada é qualquer admin, ou uma pessoa definida?

## §7 — Como vai ser provado (quando houver código)

- guarda novo: o pedido só vale para a autorização do **próprio** paciente e é idempotente; só
  admin ativa e desativa; desativar recusa depois da assinatura e não apaga a ativação
  anterior; a action do paciente recusa `representacao` sem pedido ativado e aceita com; a
  tela não renderiza a etapa `escolha`; o botão "Be4Hope faz por mim" só aparece ativado e fica
  **depois** do de suporte; o aviso do painel não promete a procuração sem ativação; a lista do
  admin não traz CPF nem documento; a área de vídeo tem estado vazio; o botão de suporte dá
  retorno ao clique. Nasce vermelho, e cada caso é provado por sabotagem;
- os cinco guardas da §2 continuam verdes, e o `o-aviso-da-procuracao-chega-a-tela` ganha o
  caso do texto novo;
- a migration provada em Postgres de Docker pelo roteiro da D-05, item 6, com a saída crua
  anexada ao PR;
- `pnpm build` + `node .next/standalone/server.js` + Chromium nas duas telas, com e sem vídeo
  configurado. ⚠️ As telas exigem sessão, e sem `CLERK_SECRET_KEY` local o clique não se vê
  rodando.

## §9 — O que a implementação ensinou (30/09/2026, branch `feat/anvisa-faco-eu-mesmo`)

As decisões da §3 ficam como foram escritas; aqui está onde a implementação as cumpriu, e onde
não conseguiu ainda.

1. **D-01:** a etapa `escolha` foi **removida** da tela, com o tipo e o JSX. Não ficou código morto
   que alguém religaria sem ler esta ADR. O guarda proíbe `'escolha'` e "Como prefere fazer" na tela.
2. **D-02 a D-04:** as actions moram em `app/_actions/pedido-atendimento-assistido.ts`, e a regra pura
   em `lib/anvisa/pedido-de-atendimento.ts`. Ativar e desativar gravam a mudança **e** a auditoria
   na mesma transação (`dbTransacional`), com `select … for update`. A trava (D-04.3) está em
   `definirModalidadeAnvisa` e usa a modalidade **gravada**. Desativar tira do checklist a procuração
   e o laudo **não enviados**; documento já enviado é do paciente e fica.
3. **Os componentes novos moram em `components/`**, não em `app/(paciente)/…/_components`: o hook
   `escopo-autorizado` protege as pastas de rota, e a autorização do Davi cobre três arquivos
   exatos. Assim as páginas protegidas mudaram pouco: a do admin, **4 linhas**; a do paciente,
   **+44/−81**, quase todas as removidas sendo o bloco da escolha.
4. **D-07:** a URL do vídeo passa por `urlDoVideo()`, que só aceita o próprio site ou
   `https://*.public.blob.vercel-storage.com`. Um endereço que o CSP bloquearia, como YouTube, cai
   no "vídeo em breve" em vez de um player quebrado. O guarda testa oito entradas, incluindo
   `…vercel-storage.com.evil.com`.
5. **D-10, terceiro ponto — RETIFICADO por Davi em 30/09/2026 (`DO-77`), não é mais pendência.**
   Ele dizia que o aviso do painel voltaria a oferecer a procuração depois da ativação. Davi decidiu
   que o **único** lugar dela é o botão logo abaixo de "Atendimento com suporte", liberado só pela
   ativação: _"essa opção é o último caso, e só ativada pelo botão"_. O aviso fica com o texto
   aprovado (`DO-73`) em todos os estados, e a página do painel não muda. A versão anterior deste
   item dizia "NÃO implementado, custa duas linhas": era verdade, e deixou de ser necessário.
   ⚠️ **O rastreio que ele citou existe em parte:** pedir, ativar, desativar e listar gravam
   auditoria com quem e o antes e o depois; o clique em "Be4Hope faz por mim" grava
   `DEFINIR_MODALIDADE` **sem `userId` e sem o antes e o depois**. Davi: _"se ainda não existe,
   futuramente vamos criar"_. Catalogado como `docs/04`, Item 59.
6. **Um guarda antigo congelava a frase:** `o-destino-do-paciente-segue-o-que-falta` exigia o literal
   "Fazer a procuração agora". O caso foi **retificado** para conferir o que protege, o aviso
   levar à tela da ANVISA em um clique, com o motivo escrito no próprio teste.
7. 🔴 **A revisão independente achou um desvio da trava, e ele foi fechado** (30/09/2026, antes
   do commit das telas). Condição do Davi: _"com cuidado e revisão"_.
   - **Alta:** `app/api/anvisa/procuracao/route.ts` gerava a procuração para qualquer autorização
     do paciente, **sem conferir a modalidade**. Um paciente no passo a passo, sem pedido
     ativado, chamava a rota direto, e o teste mediu a chamada chegando **até o upload do PDF**.
     Agora a rota recusa com 409 quem não está em `representacao` gravada, antes de gerar ou
     enviar qualquer coisa.
   - **Média:** desativar só travava com a procuração **assinada**. Com o envelope já enviado, o
     paciente podia assinar pelo e-mail depois da desativação, e o banco ficava incoerente.
     Agora `procuracao_em_assinatura` também trava (envelope `enviado` ou `visualizado`).
   - **Média:** `definirModalidadeAnvisa` conferia o pedido e gravava a autorização em passos
     separados. Agora faz as duas coisas numa transação, com `for update` no pedido, na mesma
     ordem de trava do desativar. Provado por uma corrida **forçada** no teste de integração.
   - **Baixa:** ativar não conferia se a autorização foi apagada. Agora confere. E falha de rede
     não trava mais as duas telas, porque os carregamentos têm `catch`.
   - **Não corrigido, pergunta ao Davi:** com a autorização **rejeitada**, o pedido fica aberto na
     lista para sempre. Só a aprovação o conclui (`DO-72`). Rejeitar também conclui? É regra de
     negócio.
   - **Não corrigido, aceito:** o paciente só vê "Be4Hope faz por mim" depois de recarregar ou
     trocar de etapa, porque o status do pedido é lido ao montar a tela. O estado fica atrasado,
     mas não fica errado.
   - **Catalogado, anterior a esta branch:** quem está no passo a passo e faz upload no checklist
     volta para o passo a passo, porque `recarregarAutorizacao` manda `guiada` para `guiada`
     (`docs/04`, Item 58).
8. **Prova, depois da revisão:** guarda `o-pedido-de-atendimento-abre-a-procuracao` com **67
   casos**; integração homônima com **25 casos** contra Postgres real; **23 sabotagens**, todas
   acusadas por pelo menos um dos dois. Duas sobreviveram na primeira rodada e mudaram o teste: a
   corrida de cliques, que não se reproduzia, e a trava do pedido (sabotagem 22), que o guarda
   casava na consulta errada. `pnpm test`: **1735 em 73**; integração: **181 em 16**; `pnpm build`:
   `exit 0`; type-check: 0; lint: **202**, um a menos (o `any` que saiu de `definirModalidadeAnvisa`),
   com o teto apertado em `baseline.json`.
   **Depois do `DO-76` (rejeitado ANVISA), no mesmo dia:** guarda com **75 casos**, integração
   homônima com **27**, **27 sabotagens** acusadas. `pnpm test`: **1743 em 73**; integração inteira:
   **183 em 16**.
9. ⚠️ **As telas não foram vistas rodando.** Davi, 30/09/2026: _"isso vou ter que testar em produção,
   o importante é o site não cair"_ (§0.20). O `standalone` local sobe, mas toda rota responde 500
   com `@clerk/nextjs: Missing publishableKey`: não há chave do Clerk nesta máquina (`grep -c CLERK
.env` → 0). É a limitação já registrada no `CLAUDE.md`. As telas se conferem depois do deploy,
   ou com uma chave de desenvolvimento local.

## §10 — Fase 2: a chamada de atendimento com suporte (decidida em 30/09/2026)

Davi, 30/09/2026: _"vai ser tudo no mesmo deploy, teste tudo, temos que fazer com segurança e
disciplina… você está autorizado a utilizar todo o CLAUDE.md para terminar isso com um código de
qualidade e lógica ideal baseada nos nossos alinhamentos"_. As regras de negócio abaixo saem das
falas dele, citadas; as técnicas saem da investigação medida em 30/09.

### 10.1 O que existe, medido

- **A sala da teleconsulta não serve como está:** `teleconsultas.medicoId` é `notNull`
  (`db/schema/teleconsultas.ts:19`), só o médico cria a sala
  (`app/(medico)/_actions/teleconsulta.ts:15`), e o código da chamada vive **misturado** com
  prontuário, prescrição, copiloto e transcrição (`components/teleconsulta/GlobalTeleconsultaHost.tsx`,
  732 linhas). Não existe hook de WebRTC reutilizável.
- **O que É reutilizável:** o TURN contratado da Cloudflare, com credencial efêmera e TTL de 2 h
  (ADR-0008, `app/api/teleconsulta/ice-servers/route.ts`); a sinalização pelo servidor, com Zod e
  `pusher.trigger` (`app/api/teleconsulta/sinalizar/route.ts`); a autorização de canal por ramo e
  negando por padrão (`app/api/pusher/auth/route.ts:114`); o store privado
  (`lib/documentos/store-privado.ts:66`); e o limite de requisição
  (`lib/seguranca/limite-de-requisicao.ts`).
- 🔴 **Não reutilizável, e catalogado:** o anexo do chat (`enviarArquivoChat`,
  `app/_actions/chat.ts:608`) sobe para store **público** e não confere participação (Item 60).
  O id da sala da teleconsulta sai de `Math.random` com 6 caracteres
  (`app/(medico)/_actions/teleconsulta.ts:30`). A tela do paciente na teleconsulta liga uma
  **gravação local sem condição** (`app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx:176-196`).
  Nenhum dos três se repete aqui.
- **Celular:** o navegador não compartilha a tela (§1.11, MDN).

### 10.2 Decisões

**D-12. Quem atende é o admin, e quem abre a sala é o paciente.** `DO-70` fez do admin o perfil do
atendimento. E a fala original (§0.5) diz que o botão _"vai dar para uma outra tela"_. Então, ao
pedir, o paciente ganha **"Entrar no atendimento"**, que abre a tela da chamada, onde ele espera. Na
lista de pedidos, o admin ganha **"Entrar no atendimento"** no item. Qualquer admin pode atender,
porque a lista é do papel e não de uma pessoa. A sala é do **pedido**: só existe com pedido
**aberto**, e fecha quando o admin encerra ou o pedido se encerra.

**D-13. A chamada tem tabela própria, e não usa a da teleconsulta.** `chamadas_de_atendimento`
(pedido, `sala` aleatória de 32 caracteres de `crypto.randomUUID`, aberta e encerrada, com quem) e
`mensagens_de_atendimento` (chamada, autor, texto, e o print guardado no store privado). As duas
entram na **mesma 0050**, que ainda não chegou a produção.
Rejeitado: pôr o admin na sala médica (`teleconsultas`), porque quebraria o escopo que o guarda
`autorizacao-tem-escopo-de-objeto` prova e obrigaria a tabela a aceitar sala sem médico.

**D-14. A voz e a tela passam pelo mesmo caminho seguro da teleconsulta, sem mexer nela.** Rotas
próprias em `app/api/atendimento/` (sinalizar e ICE), canal Pusher próprio
`presence-atendimento-{sala}`, com ramo próprio no `/api/pusher/auth`. O escopo é conferido **no
servidor** em todas elas: paciente dono do pedido, ou admin. A credencial de TURN usa a mesma conta
Cloudflare com a mesma TTL, e **só** para quem está na sala, porque TURN é recurso pago.
Rejeitado: reescrever a teleconsulta para extrair um hook comum agora. É o módulo mais delicado em
produção, e travado por guardas de layout. Fica catalogado como limpeza futura, não entra no mesmo
deploy.

**D-15. Negociação sem renegociar.** O admin faz a oferta com um canal de **áudio** de ida e volta
e um de **vídeo** só de recebimento. Ao responder, o paciente fica com o envio de vídeo já
negociado e vazio. Compartilhar a tela é trocar a faixa (`replaceTrack`), sem nova oferta. É o
mesmo mecanismo que a teleconsulta usa para a tela do médico (`GlobalTeleconsultaHost.tsx:437`).

**D-16. O celular fala por voz e mostra a tela pelo print.** Onde o navegador não tem
`getDisplayMedia`, o botão "Compartilhar tela" **não aparece**, e a tela aponta o chat. Em nenhum
caso aparece um botão que não funciona.

**D-17. O chat fica na lateral esquerda** (Davi: _"na lateral esquerda, em horizontal, ali o paciente
pode mandar mensagem ou enviar print"_). Na tela larga, o chat é a coluna da esquerda e a chamada
fica à direita. Na tela estreita, as duas se empilham, com o chat primeiro.

**D-18. O print é arquivo sensível.** Imagem PNG, JPEG ou WebP de até 8 MB, conferida **no servidor**.
Guardada por `guardarDocumentoPrivado`, e entregue só pela rota autenticada
`GET /api/atendimento/print/{mensagemId}`: escopo de objeto (admin ou o paciente do pedido), 404
igual para negado e inexistente, `visualizar` auditado, limite de requisição e `no-store`. A URL do
blob **nunca** vai ao navegador nem ao Pusher: o evento leva só o id da mensagem.

**D-19. Nada é gravado, e tudo é auditado.** Não há `MediaRecorder` nem transcrição. Abrir, entrar,
encerrar e cada mensagem ficam em `logs_auditoria` ou na própria tabela, com quem e quando. Antes de
compartilhar a tela, o paciente lê o aviso: _"a equipe vai ver sua tela; não mostre senhas; nada é
gravado"_. O compartilhamento só começa pelo gesto dele, porque o navegador exige.

**D-20. Retenção:** `retencao_ate` anulável e **vazio** nas duas tabelas, porque o prazo é decisão
do Jurídico (`.claude/rules/seguranca-lgpd.md`; mesmo padrão de
`db/schema/rascunhos-revisao-ia.ts:58`).

### 10.3 Como se prova sem Clerk local

Guarda e integração, como nas fases anteriores, para as regras do servidor. Para a **chamada em
si**, o Chromium headless do projeto roda dois pares WebRTC com mídia falsa numa página de teste
local: a negociação (áudio de ida e volta, tela trocada sem renegociar) é o mesmo módulo que as
telas usam, executado de verdade. O que só produção prova: o TURN real e dois dispositivos
diferentes. Por isso a lista de pós-deploy inclui uma chamada real entre dois aparelhos.

### 10.4 O que a implementação provou (30/09/2026)

- **A negociação no Chromium** (`scripts/provar-chamada-no-navegador/`): **15 de 15** passos. Voz nos
  dois sentidos (80 pacotes de áudio de cada lado); nenhum quadro de vídeo antes de compartilhar; 63
  quadros compartilhando, **sem nenhuma renegociação**; os quadros param ao parar e voltam ao
  compartilhar de novo. Duas sabotagens do módulo acusadas: vídeo `inactive` (0 quadros) e paciente
  sem microfone (0 pacotes). Uma terceira pareceu sobreviver e **não tinha sido aplicada**: o `sed`
  não achou o texto que o `tsc` quebrou em duas linhas. Refeita sobre a linha real, foi acusada.
- **Integração** `a-chamada-de-atendimento-so-tem-duas-pessoas`, com **21 casos** contra Postgres real,
  executando actions **e** rotas (sinalizar, TURN, canal Pusher, entrega do print). Guarda
  `a-chamada-de-atendimento-nao-grava-e-nao-vaza`, com **34 casos**. **20 sabotagens**, todas acusadas
  por pelo menos um dos dois. Duas sobreviveram na primeira rodada:
  - **F2-6** é **mutante equivalente**, e não teste fraco. A conferência da assinatura do arquivo só
    aceita PNG, JPEG e WebP, então tirar a conferência do tipo não muda nenhum resultado possível. São
    camadas redundantes de propósito;
  - **F2-14** era real: a corrida ao entrar não se reproduzia, **o mesmo defeito de teste da Fase 1**.
    Ganhou uma corrida forçada, que a reproduz.
- **Um guarda antigo estava cego:** `todo-ramo-do-pusher-autoriza-no-proprio-ramo` só reconhecia
  `startsWith('literal')`. O ramo novo usa uma constante, e o anterior "engolia" o bloco novo, com o
  guarda verde. Foi retificado e ganhou uma contagem cruzada.
- **Os guardas `sem-relay-de-terceiro-na-teleconsulta` e `as-rotas-sensiveis-tem-limite`** passaram a
  cobrir a tela e as três rotas novas.
- 🔴 **Revisão independente, antes do commit:** nenhum furo de escopo. Achou três médios e quatro
  baixos, **todos corrigidos e protegidos**:
  - fechar a chamada pelo pedido **não avisava as telas**, e a voz seguia ponto a ponto;
  - duas abas, ou dois admins, disputavam a chamada, e o primeiro caía em silêncio. Agora cada oferta
    tem um **id de negociação**, e a aba repetida fica só com as mensagens;
  - sair durante a permissão deixava o **microfone aceso**;
  - o microfone ficava ligado depois de encerrar;
  - depois de 200 mensagens, recarregar mostrava as primeiras;
  - canal recusado deixava a tela em "Entrando…";
  - entrar não tinha limite;
  - o **id interno do usuário** ia ao canal. Agora vai um id opaco e por aba.
- ⚠️ **Não provado local, e só produção prova:** a tela inteira com login (sem chave do Clerk local),
  o TURN real e dois aparelhos diferentes. A lista de pós-deploy cobre isso (§11).

## §11 — O roteiro de pré-deploy (30/09/2026)

Davi: _"quando tivermos aptos, testados e comprovados vamos fazer os procedimentos pré-deploy"_ e
_"o importante é o site não cair"_. Quem faz deploy: Davi, Dryelle ou Gabriel. Nenhuma sessão decide.

### 11.1 O que já está provado, local

- **Compatibilidade:** a `origin/main` (PRs #137 a #139) foi trazida para a branch **sem conflito**.
  Sobre o código combinado: `pnpm test` **1798 em 75**; integração **204 em 17**; `pnpm build` ok;
  prova no Chromium **15 de 15**; type-check 0; lint 202 (teto); Prettier 318, e o único a mais é o
  arquivo pessoal da Ponte, fora do git.
- **A 0050 final** (com as tabelas da chamada) provada contra o registro igual ao de produção:
  52 → 53, **só ela**, tabelas existentes idênticas, índices e restrições recusando o que devem,
  migrator idempotente. ⚠️ A primeira rodada desta prova tinha um defeito **meu**: `'a'*32` em
  JavaScript é `NaN`, e as duas salas saíram iguais, então quem recusava era o índice da sala, e não
  o de "uma aberta por pedido". Corrigido para `'a'.repeat(32)`, e quem recusa passou a ser o índice
  certo, `chamadas_atendimento_aberta_unq`.
- **O que não se prova local:** as telas com login (sem chave do Clerk), o TURN real e dois
  aparelhos. Isso vai para o pós-deploy (11.4).

### 11.2 Antes do merge (Davi ou Diniz, na VPS e no GitHub)

1. **As chaves que a chamada usa chegam ao processo?** `CLOUDFLARE_TURN_*` **não estão** na lista
   que o `deploy.yml` grava; só o ambiente guardado pelo PM2 as traria. O bloco só de leitura
   (entregue no chat) mostra "definido" ou "AUSENTE", sem valor, e foi testado com PM2 simulado,
   incluindo o aviso `[PM2]` antes do JSON. Se o TURN estiver ausente, a chamada **e a teleconsulta
   de hoje** funcionam só com conexão direta. A decisão é do Davi: cadastrar os secrets e acrescentá-los
   ao `deploy.yml`, que é arquivo protegido e pede autorização, ou seguir sem TURN.
   **[medido] 30/09/2026, por Davi:** `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN`
   **AUSENTES** no processo e no `.env`; `BLOB_TOKEN_PRIVADO` e `PUSHER_SECRET` definidos no processo.
   **Decisão (`DO-78`):** _"sobre isso faremos depois"_. O deploy segue sem TURN (`docs/04`, Item 63).
2. **O registro de migrations não mudou desde a medição** (`max(created_at)` = `1790193675250`):
   refazer a revisão de integridade (entregue no chat) logo antes do merge.
3. **Backup do banco conferido:** `pg_dump -Fc` na VPS e `pg_restore --list` contando os objetos,
   como em 21/09/2026.
   **[medido] 30/09/2026, 17:11 (horário da VPS), por Davi:** revisão de integridade logo antes,
   com `ESTRUTURA IDENTICA A DAS 14:23` e `52|1790193675250`. Backup
   `~/backup-behemp-20260930-1711.dump`: **35 MB, 420 objetos, 58 tabelas com dado**, impressão
   `5bd5a7e84c05`, legível só pelo usuário da VPS (`umask 077`). O bloco foi testado antes com
   restauração num banco limpo, e na falha apaga o arquivo em vez de deixar um backup vazio. ⚠️ Os
   420 objetos não se comparam com os 424 de 21/09: a contagem de hoje exclui as linhas de
   comentário da listagem.
4. **Push da branch e PR para a `main`**, com o link desta ADR. O CI roda o portão.

### 11.3 Durante o deploy

Ler o **log do passo**, e não só o ícone (`CLAUDE.md`, seção de deploy):
`gh run view <id> --log | grep -E "migrar|ELIFECYCLE|error"` deve mostrar `[migrar] ✓ concluído`.
Acompanhar a home com `curl -o /dev/null -w "%{http_code}"` a cada rodada: tem de continuar 200.

### 11.4 Depois do deploy (em produção, pelo Davi)

1. Refazer a revisão de integridade: `__drizzle_migrations` com **53** linhas e as três tabelas novas.
2. Paciente de teste no passo a passo: vídeo "em breve", 10 passos, "Atendimento com suporte" →
   "Recebemos seu pedido" → "Entrar no atendimento".
3. Admin em `/admin/anvisa`: o pedido aparece; "Entrar no atendimento"; "Ativar procuração"; o
   paciente vê "Be4Hope faz por mim" e chega à procuração.
4. **A chamada, com dois aparelhos:** um computador (paciente) e outro aparelho (admin). Voz nos dois
   sentidos; "Mostrar minha tela" com o aviso; o admin vê a tela; parar e voltar. Depois, repetir com
   o paciente num celular: o botão de tela não aparece, e o print pelo chat chega ao admin.
5. Encerrar pelo admin: as duas telas mostram "Atendimento encerrado".
6. Rejeitar uma autorização de teste: o pedido fica "Rejeitado ANVISA", e a chamada aberta fecha.
7. Um dos 12 pacientes que já estavam em `representacao` continua vendo o checklist da procuração.

### 11.5 Se precisar desfazer

Reverter o merge na `main` gera um novo deploy com o código anterior. **As tabelas novas ficam**,
porque são só aditivas e nada antigo as lê. **Não apagar tabela em produção:** apagar é que
arriscaria dado.

## §8 — O que mudou durante o alinhamento (29/09/2026)

**Versão 1**, escrita a partir da §0.2: quem liberaria a procuração seria um "perfil de
acolhimento", dito como "já na main". Medido: **não havia** papel com esse nome na
`origin/main` nem em branch remota nenhuma.

**Versão 2**, depois da §0.6: criar o papel `acolhimento` aqui, com enum novo (migration), área
`app/(acolhimento)`, pós-login próprio e atribuição pelo admin. Referência lida na Greens
(`greens-corp-backend` `origin/main` `de8bded`): lá `ACOLHIMENTO` entrou em
`prisma/migrations/20260928145506_add_acolhimento_role` e tem acesso a **todos** os pacientes,
sem carteira, podendo criar e editar paciente, enviar documento e vincular médico
(`src/modules/acolhimento/routes/acolhimentoRouter.ts:12-20`). A versão 2 também notava que,
aqui, papel desconhecido cai como `paciente` (`lib/auth/permissions.ts:39-43`), e perguntava o
que esse papel poderia ler.

**Versão 3**, depois da §0.7: **sem papel novo**; o admin ativa, com "Ativar procuração" na
linha de ações do cartão de **cada** autorização, e o botão de suporte **desabilitado**, com
"em breve". Duas colunas novas.

**Versão 4**, depois da §0.8: o botão de suporte **registra um pedido**; só quem pediu aparece
para o admin, numa lista de itens expansíveis, e é dentro do item que se ativa. Três colunas
novas em `autorizacoes_anvisa`.

**Versão 5, a atual**, depois das respostas de Davi (§0.9 a §0.15): o pedido ganha **status**
(`aguardando_ativacao` → `pendente_autorizacao`), a ativação **pode ser desfeita** antes da
assinatura, e por isso o pedido vai para uma **tabela própria** em vez de colunas (D-05). O
aviso do painel deixa de prometer a procuração (D-10). O atendimento com suporte passa a ter
forma, uma chamada de voz com tela, e fica para a próxima fatia, com o achado de que o celular
não compartilha tela pelo navegador (D-11).

**Depois da versão 5, no mesmo dia (§0.16 a §0.19):** o texto do aviso foi aprovado; a chamada
ganhou o chat lateral com print, que resolve o celular; o pedido ganhou o status `concluido`;
e a migration foi autorizada com o roteiro de integridade da D-05. Nenhuma decisão anterior foi
revertida: são acréscimos.
