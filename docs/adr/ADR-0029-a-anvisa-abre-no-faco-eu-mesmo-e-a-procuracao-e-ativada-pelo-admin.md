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

As decisões têm ID no catálogo: `DO-69` a `DO-75` (`docs/02-CATALOGO-DE-REGRAS.md`).

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
  `concluido` quando a autorização da ANVISA vira `aprovado` (§0.18). O item **não some** ao ser
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
5. 🔴 **D-10, terceiro ponto, NÃO implementado:** _"com o pedido em `pendente_autorizacao`, o aviso
   volta a oferecer a procuração"_. O aviso não sabe se a procuração foi ativada: quem sabe é a
   página do painel (`app/(paciente)/paciente/page.tsx`), protegida e fora da autorização. E o guarda
   `o-aviso-da-procuracao-chega-a-tela` proíbe, de propósito, que o componente busque dado sozinho.
   Hoje o aviso mostra o texto aprovado (`DO-73`) nos dois estados. Ele é **verdadeiro** nos dois,
   porque aponta o passo a passo, onde o botão aparece quando liberado, mas não oferece a procuração
   de volta. Custa duas linhas naquela página, e pede autorização própria.
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
9. ⚠️ **As telas não foram vistas rodando.** O `standalone` local sobe, mas toda rota responde 500
   com `@clerk/nextjs: Missing publishableKey`: não há chave do Clerk nesta máquina (`grep -c CLERK
.env` → 0). É a limitação já registrada no `CLAUDE.md`. As telas se conferem depois do deploy,
   ou com uma chave de desenvolvimento local.

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
