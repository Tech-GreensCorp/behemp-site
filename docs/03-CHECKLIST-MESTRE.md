# Checklist Mestre — Be4Hope / BeHemp

> **Leitura obrigatória em toda sessão.** Diz **o quê** e **quando**.
> O _como_ está na [LISTA-DE-AFAZERES](04-LISTA-DE-AFAZERES.md). O _por quê_ em [adr/](adr/).
>
> 1. Todo achado novo entra aqui, na seção e prioridade certas.
> 2. Item concluído: `[x]` + data + branch.
> 3. A **Fila de execução** no rodapé é a ordem oficial. Reordenar é decisão de quem manda.
> 4. **A fila é atualizada no mesmo commit que conclui o item.**

**Atualizado em 20/08/2026** (execução da Sprint 0). Branch atual: `feat/flow-representatives`.

---

## Baseline declarada

Números do repositório, para o portão do CI falhar quando **piorar**, não quando estiver
vermelho.

**Medida por execução em 20/08/2026**, na Sprint 0, com `node_modules` presente. Toda linha
abaixo é resultado de comando rodado nesta data — nenhuma é copiada de outra doc.

| medição                      | valor                                            | comando                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| problemas de `pnpm lint`     | **342** = **210 erros** + 132 warnings           | `pnpm lint` · 20/08                                                                                                                                                                                                                                            |
| arquivos fora do Prettier    | **359**                                          | `pnpm format:check` · 20/08 — era 360; o `deploy.yml` entrou em conformidade ao receber o portão, e o teto foi **apertado**                                                                                                                                    |
| erros de `tsc --noEmit`      | ✅ **0**                                         | `pnpm typecheck` · 20/08 — **primeira medição da história do repo**                                                                                                                                                                                            |
| runner de teste              | **Vitest 4.1.11**, script `pnpm test`            | `package.json`                                                                                                                                                                                                                                                 |
| casos de guarda verdes       | **37**, 1 arquivo                                | `pnpm test` · 20/08                                                                                                                                                                                                                                            |
| arquivos de teste de produto | **0**                                            | `find` por `*.test.ts*`/`*.spec.ts` em `app/ db/ lib/ components/`                                                                                                                                                                                             |
| passos de verificação no CI  | **4** — type-check, guardas, baseline e build    | `deploy.yml` + `ci.yml` novo · 20/08                                                                                                                                                                                                                           |
| tabelas em `db/schema`       | **44**, em **33** arquivos                       | `grep -c 'pgTable(' db/schema/*.ts` · **remedido em 25/08/2026** — eram 40 em 20/08; as 4 novas vieram das Sprints 3, 4 e 5 (`medidas_desfecho`, `rastreio_uso_cannabis`, `revisoes_ia`, `rascunhos_revisao_ia`). A doc não estava errada: ficou desatualizada |
| valores em `userRoleEnum`    | 3                                                | `db/schema/enums.ts:9`                                                                                                                                                                                                                                         |
| linhas do `CLAUDE.md`        | **205**                                          | alvo documentado: **200** — 🔴 acima                                                                                                                                                                                                                           |
| skills instaladas            | 20 (7 `agente-*` · 7 `caveman-*` · 6 `metodo-*`) | `.claude/skills/`                                                                                                                                                                                                                                              |
| `node_modules`               | ✅ presente                                      | `pnpm install` · 20/08, 9,4 s                                                                                                                                                                                                                                  |

### 🔴 O que a medição real desmentiu

A baseline anterior vinha do `AGENTS.md` e **nunca havia sido conferida**. Os dois números
estavam otimistas — o portão de CI construído sobre eles nasceria vermelho no primeiro dia:

| medição                            | declarado | **real** | diferença |
| ---------------------------------- | --------- | -------- | --------- |
| erros de lint                      | 117       | **210**  | **+79 %** |
| arquivos fora do Prettier          | 233       | **360**  | **+55 %** |
| arquivos com tabela em `db/schema` | 29        | **33**   | +4        |
| linhas do `CLAUDE.md`              | 192       | **205**  | +13       |

⚠️ **O `AGENTS.md` continua afirmando 117 e 233.** Ele é protegido por hook de propósito, e
corrigi-lo é trabalho próprio, com autorização — não se faz de passagem. Até então, vale esta
tabela, por precedência (`.claude/rules/precedencia-das-instrucoes.md` §1: o código vence a doc).

✅ **A boa notícia é o type-check.** `tsc --noEmit` está em **zero erros**, o que permite pô-lo
no CI como portão **absoluto** — falha em qualquer erro novo, sem teto de tolerância. Lint e
Prettier precisam de teto, porque estão vermelhos por baseline.

---

## 🔴 Prioridade 1 — risco agora

- [x] **Item 37 — ✅ RESOLVIDO em 12/09/2026:** seis defeitos que quebravam o fluxo da Greens
      de ponta a ponta. O cadastro virava falha **depois** de gravar tudo (conta, ficha e link
      consumido) e a tela negava, sem volta; os **dois** destinos pós-cadastro levavam a 404
      (`/agendamento` e `/paciente/teleconsulta`), o que atingia quase todo paciente da Greens;
      a tela da ANVISA pedia documento que o parceiro já mandou; o login não voltava ao cadastro
      e podia levar **para fora** (OWASP A01); uma aba aberta durante o deploy quebrava; e o
      Firefox não conseguia se cadastrar. Diagnóstico e o que ficou de fora em
      [04 — Item 37](04-LISTA-DE-AFAZERES.md). **7 guardas novos, 1104 casos em 42.**
      ⚠️ **Um guarda existente CONGELAVA um dos defeitos** — comparava os destinos com uma lista
      fixa que continha os dois 404. Ficava verde com o paciente caindo em 404, e ficou vermelho
      quando o defeito foi corrigido. Retificado.
- [ ] **Item 36** — 🔴 **produção autentica por uma instância de DESENVOLVIMENTO do Clerk**
      (`relative-blowfish-96.clerk.accounts.dev`, `pk_test`). Medido na própria instância:
      `instance_environment_type = "development"` e `captcha_enabled = true`. O cadastro falha
      com `captcha_missing_token` (400) depois de o Turnstile recusar o challenge (401) — os
      dois códigos reproduzidos fora do navegador. O `clerk.be4hope.org` está no CSP
      (`next.config.ts:108,112`) e **não resolve**: a instância de produção nunca foi criada.
      🔴 **Risco aberto não medido:** se a base de usuários atravessa de uma instância para a
      outra. **Decisão do dono**, com o custo em [04 — Item 36](04-LISTA-DE-AFAZERES.md).
- [ ] **Item 6** — 🔴🔴 **todo upload está em store PÚBLICO do Vercel Blob**: 10+ pontos, com
      RG, comprovante de residência, laudo médico, receita, exames e procuração assinada. Quem
      tem a URL lê **sem autenticação**. E `db/schema/prescricoes.ts:23` **afirma** _"URL
      privada, acesso autenticado"_ — o código contradiz a doc. Diagnóstico e perigo medido em
      [04 — Item 6](04-LISTA-DE-AFAZERES.md).
- [x] **Item 11 — ✅ CORRIGIDO em 20/08** (autorizado pelo dono; commit pendente, `DO-20`):
      **qualquer usuário autenticado podia entrar na teleconsulta de qualquer outro.** `app/api/pusher/auth/route.ts:72-80` autoriza o canal
      `presence-sala-{roomId}` **sem verificar vínculo com a sala**, e
      `app/api/teleconsulta/sinalizar/route.ts:8-30` aceita `roomId` arbitrário do body. Juntos,
      permitem assinar o canal de uma consulta alheia e negociar WebRTC nela. Mais 5 ocorrências
      da mesma classe — incluindo `aprovar-narrativa`, onde **qualquer médico escreve evolução
      clínica no prontuário de qualquer paciente**. O consentimento LGPD é **autodeclarado pelo
      cliente**, e a auditoria **não registra quem agiu**. Diagnóstico completo, com os 3
      controles corretos e o perigo medido, em [04 — Item 11](04-LISTA-DE-AFAZERES.md).
      **Corrigido com o helper único `garantirDonoDaSala` + guarda de 19 casos, nascido
      vermelho nas 7 e provado por 8 sabotagens.** A baseline **melhorou** em 2 warnings; o
      type-check segue em 0.
- [ ] 🔴🔴 **Dois dos três seeds NÃO recusam rodar em produção** — medido em 25/08/2026.
      `db/seed.ts` e `db/seed-produtos.ts` não têm nenhuma trava; só `db/seed-perfis-teste.ts`
      tem, e a dele é **dupla** (`NODE_ENV=production` **e** URL de Neon — a segunda existe
      porque `NODE_ENV` pode não estar definido num terminal qualquer). `pnpm db:seed` com a
      variável de produção carregada insere **paciente fictício no banco real**: num sistema de
      saúde isso é **contaminação de prontuário**, não incômodo de ambiente.
      ⚠️ **Agravado pelo momento:** o próximo passo do projeto é rodar seed para preparar o QA
      (`DO-53`) — exatamente quando alguém digita o comando sem pensar. **Perigo de mexer:
      BAIXO** (bloco aditivo, padrão já existe em `seed-perfis-teste.ts:60`).
      Ver [04 — Item 17.1](04-LISTA-DE-AFAZERES.md).
- [ ] 🔴 **37 de 44 tabelas ficam sem dado de seed** — os três seeds populam 7. Ficam vazias
      `triagens`, `consultas`, `teleconsultas`, `anamneses`, `dosagens`, `prescricoes`,
      `revisoes_ia`, `notificacoes` e mais 29. **Bloqueia o QA de ponta a ponta**: tela vazia é
      indistinguível de bug para quem testa. Ver [04 — Item 17.2](04-LISTA-DE-AFAZERES.md).
- [ ] 🔴🔴 **PENDÊNCIA 1 DO TURN — criar a conta na Cloudflare e provisionar as chaves.**
      `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN` estão **vazias**. Enquanto
      estiverem, a videochamada usa **só STUN**: funciona na maioria das redes, mas **conexão
      que precise de retransmissão falha**, com aviso na tela. Onde obter: painel da Cloudflare
      → Realtime → TURN. O token é de servidor e nunca vai ao cliente. **Responsável: dono /
      infra.** Ver [ADR-0008](adr/ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md) §4.
- [ ] 🔴🔴 **PENDÊNCIA 2 DO TURN — o Jurídico assinar o DPA da Cloudflare.** 🛑 **Nenhuma
      consulta real deve trafegar por lá antes disso.** A Cloudflare **não lê** a mídia (cifrada
      por DTLS), mas **vê o IP** de médico e paciente — e IP é dado pessoal, o que a torna
      **operadora** sob a LGPD. Sem contrato, é o mesmo defeito que a troca do relay público veio
      corrigir. **Responsável: Jurídico** (mesma trilha de `CF-01` e `GAP-06`).
- [ ] 🔴 **`GAP-15` — quem recusar o consentimento tem outra via de atendimento?** Decide se o
      bloqueio de `DO-22` é **válido**: consentimento obtido sob pena de perder a consulta não é
      livre (LGPD art. 8º, §3º) e é **nulo**. Havendo alternativa real, o bloqueio é legítimo.
      **Responsável: dono.**
- [x] **✅ FEITO em 20/08 — o consentimento LGPD passou a ser perguntado, e bloqueia a IA**
      (`DO-23`, [ADR-0007](adr/ADR-0007-consentimento-da-gravacao-de-teleconsulta.md)). Tela nas
      **duas** pontas, botão grande, o efeito da recusa dito **antes** da escolha, aceite dos
      **dois** lados, registro com **quem/quando/versão do texto**, e revogação. A **consulta
      não é bloqueada** — base legal própria (LGPD art. 11, II, "f"), o que mantém o aceite
      livre e portanto válido. Guarda de **20 casos**, 7 sabotagens. ⚠️ **O texto é rascunho e
      não coleta aceite em produção** até revisão jurídica.
- [ ] 🔴 **`ADR-0007` §4 — falta o texto definitivo do consentimento e 3 decisões:** granularidade
      (aceite único × separado), **prazo de retenção**, e se a revogação apaga evolução clínica já
      assinada. **Responsável: dono + Jurídico.** Enquanto não vier, o recurso fica desligado em
      produção por `CONSENTIMENTO_PRONTO_PARA_USO = false`.
- [x] ~~O consentimento LGPD da teleconsulta não é perguntado a ninguém~~ —
      `components/teleconsulta/GlobalTeleconsultaHost.tsx:83` é `useState(true)`, **sem setter
      e sem UI**. O campo existe no schema e é gravado sempre como aceito. A LGPD (art. 5º,
      XII) exige manifestação **livre, informada e inequívoca**. 🔴 **Não corrigido de
      propósito:** criar a tela e o texto do consentimento é decisão de produto e do Jurídico.
      Ver [04 — Item 11](04-LISTA-DE-AFAZERES.md).
- [ ] **Item 1** — `pnpm db:migrate` roda contra produção **sem ensaio**, e sem rollback, num
      servidor de 2 GB. Ver [04 — Item 1](04-LISTA-DE-AFAZERES.md).
- [x] **Item 3 — FEITO em 20/08 (Sprint 0).** O portão existe, está provado por sabotagem e
      **está ligado ao CI em dois lugares** (`DO-18`): `ci.yml` novo (PR e push de branch) e
      enxertado no `deploy.yml` nos steps 5–7, **antes** do build, do rsync e do `pnpm
db:migrate`. Se falhar, nada chega ao servidor e nenhuma migration é aplicada.
      Autorização escrita em `.claude/autorizacoes.txt`, com granularidade de **dois caminhos
      exatos** — qualquer outro workflow continua bloqueado. ⚠️ Os workflows **ainda não
      rodaram no GitHub**: nada foi commitado nem enviado (`DO-20`).

## 🟠 Prioridade 2 — custa depois

- [ ] **Item 2** — 8 uniões literais de role escritas à mão divergem do `userRoleEnum` em
      silêncio; `app/(admin)/_actions/usuarios.ts:66` é **cast**, não validação.
- [ ] **Item 4** — `prescricoes.medicamentos` é JSONB de texto livre sem FK para `medicamentos`:
      nenhuma soma por medicamento é confiável.
- [ ] 🔴🔴🔴 **O MÓDULO DE IA CLÍNICA PODE SER DISPOSITIVO MÉDICO — ANVISA RDC 657/2022.**
      Descoberto em 20/08 ao esgotar as fontes do domínio. **Esta norma não estava no plano.**

      A RDC 657/2022 regula **software como dispositivo médico** (`ANV-01`), e as exclusões do
      Art. 1º §2º (`ANV-03`) cobrem bem-estar, administrativo-financeiro e processamento
      demográfico **sem finalidade clínica**. Um módulo que **sugere hipóteses diagnósticas** não
      se encaixa em nenhuma delas. Se é SaMD, exige **regularização** — notificação ou registro,
      com classe pela RDC 185/2001 (`ANV-04`).

      🎯 **Ainda não há risco em operação:** o motor não está ligado, e tela sem motor não tem
      finalidade diagnóstica ativa. Foi a ordem da ADR-0002 (UI antes da inteligência) que deu
      essa folga — sem querer, ela protegeu o projeto.

      🔴 **O que precisa acontecer antes da Metade 2 (ligar o motor):**
      1. **Assuntos Regulatórios determinar o enquadramento** e a classe. Não é engenharia que
         decide, e não é leitura de blog que resolve — a RDC 185/2001 precisa ser lida
      2. se for SaMD, **regularizar antes do uso clínico** — não depois
      3. reavaliar o cronograma da Metade 2 com o prazo regulatório dentro dele

      ⚠️ **Não é bloqueio da Metade 1.** Construir tela sem motor segue permitido. O que não pode
      é **ligar o motor** e atender paciente sem essa resposta.

- [x] **✅ FEITO em 20/08 — consentimento de TELECONSULTA implementado** (CFM 2.314/2022 Art. 15,
      `CFM-01`/`CFM-02`). Tela própria no lobby do paciente, **bloqueando a entrada na sala**;
      aceite só do paciente (a norma nomeia o titular); exceção de **emergência médica** com
      motivo obrigatório; e o texto diz que dados podem ser compartilhados e que **negar é
      direito**. Migration `0020` aplicada **em localhost**. ⚠️ O texto é **rascunho** e não
      coleta aceite em produção até revisão jurídica.
- [x] ~~FALTA O CONSENTIMENTO DE TELECONSULTA — exigido pela CFM 2.314/2022, Art. 15~~
      (`CFM-01`, `CFM-02`). Descoberto em 20/08 ao transcrever a norma, **depois** de a
      implementação do consentimento de IA estar pronta. São **dois** consentimentos distintos:

      | # | consentimento | fundamento | bloqueia |
      |---|---|---|---|
      | 1 | atendimento por telemedicina | **CFM 2.314 Art. 15** | 🔴 a teleconsulta — **falta** |
      | 2 | transcrição e IA | LGPD art. 11, I | só a IA — ✅ feito em 20/08 |

      ⚠️ **A análise que levou a `DO-23` estava incompleta:** olhou LGPD e não olhou CFM. Base
      legal dispensa consentimento como fundamento de tratamento de dado; **não dispensa norma
      ética que exige autorização para o ato**. Retificação em
      [ADR-0007 D-08](adr/ADR-0007-consentimento-da-gravacao-de-teleconsulta.md).

      **O que falta:** tela própria bloqueando a entrada na sala · o aceite **no prontuário**
      (`CFM-01` diz "SRES", não coluna solta) · o texto dizendo que dados podem ser compartilhados
      e que **negar é direito** (`CFM-02`) · a exceção de **emergência médica**.

- [ ] 🔴🔴 **PROVA DE QUE O NEON DIVERGIU DO JOURNAL — achado em 20/08/2026.**
      `db/migrations/0007_add_medico_ordem.sql` existe **no disco e FORA do journal**: a posição
      0007 registra `0007_wet_sharon_ventura`, outro nome. É uma migration **escrita à mão**, que
      `pnpm db:migrate` **nunca aplica**.

      O conteúdo dela não é inócuo:
      ```sql
      ALTER TABLE "medicos" ADD COLUMN "ordem" integer;
      ALTER TABLE "medicos" ALTER COLUMN "crm" DROP NOT NULL;
      ```

      **Como isso apareceu:** ao subir o localhost, a home quebrou com
      `column medicos.ordem does not exist` — porque o banco local tem só o que o journal manda.
      **Em produção a coluna existe**, logo alguém rodou aquele SQL à mão no Neon.

      🔴 **Consequência para a reconciliação:** o risco que o procedimento abaixo prevê **está
      confirmado**, não é hipótese. O Neon tem ao menos uma alteração fora do journal, e um
      `db:migrate` que suponha o contrário pode falhar no meio — sem rollback.

      **O que fazer:** decidir se a 0007 manual entra no journal (com o snapshot recalculado) ou
      se o journal é reconciliado contra o estado real do Neon. É trabalho próprio, e precisa de
      autorização — mexer em journal é mexer no que o `db:migrate` acredita.

- [ ] 🔴 **QUATRO migrations aplicadas em LOCALHOST, nunca no Neon** (`DO-34`) — `0018`
      (consentimento IA + enums), `0019` (anamnese-baseline), `0020` (consentimento teleconsulta),
      `0021` (revisão humana). Banco: container `behemp-postgres-dev`, porta 5436, criado para
      isto. **Nada foi aplicado no Neon e nada foi para `main`.** Todas 100 % aditivas —
      conferido linha por linha: zero `DROP`, zero `ALTER COLUMN`, zero `SET NOT NULL`.

      🔴 **Ainda falta aplicar no Neon**, quando o dono mandar. Procedimento de reconciliação:

- [ ] ~~DUAS migrations geradas e NÃO aplicadas~~ — `0018_nifty_xavin` (consentimento + enums
      de IA clínica) e `0019_cheerful_ricochet` (anamnese-baseline: 2 tabelas, 6 enums).
      🛑 **Condição do dono em 20/08:** _"contanto que não subamos para main ou para neon (…)
      temos que garantir a compatibilidade para quando (eu mandar) subirmos a main e dps
      fazermos a reconciliação com banco neon"_.

      **Antes de aplicar — procedimento de reconciliação:**

      1. **Conferir se o Neon divergiu do journal.** `db/migrations/meta/_journal.json` tem 20
         entradas (0–19). Se o banco tiver mudança feita à mão, ou migration aplicada fora do
         journal, `db:migrate` falha no meio — e **não há rollback** (Item 1).
      2. **Ensaiar num banco de cópia primeiro.** É o próprio Item 1 desta lista, ainda aberto.
      3. **Aplicar na ordem**: 0018 antes de 0019.
      4. **Verificar o que cada uma faz** — as duas são **aditivas**, conferido linha por linha:
         `CREATE TABLE`, `CREATE TYPE` e `ADD COLUMN` nullable. Zero `DROP`, zero `ALTER COLUMN`,
         zero `SET NOT NULL`. Nenhuma coluna existente muda de tipo ou de obrigatoriedade.
      5. Se uma tabela já existir no Neon, o `CREATE` **falha visivelmente** — não corrompe.

      ⚠️ **Sem estas duas, o código novo compila mas não grava:** o consentimento LGPD da Sprint 1
      e toda a anamnese-baseline da Sprint 3 dependem de colunas e tabelas que ainda não existem
      no banco.

- [ ] ~~Aplicar a migration `0018_nifty_xavin.sql`~~ — gerada em 20/08, **não aplicada**.
      Traz os 2 enums de IA clínica **e** as 7 colunas de consentimento. Sem ela, o consentimento
      LGPD da Sprint 1 fica **inerte**: as colunas não existem no banco. É aditiva (só `CREATE
TYPE` e `ADD COLUMN` nullable), mas `db:migrate` roda contra produção sem rollback (Item
      1). **Quando aplicar é decisão do dono.**
- [x] **Runner de teste instalado** — Vitest 4.1.11, `pnpm test`, e o guarda dos hooks migrado
      de bash para Vitest com **35 casos** (os 34 originais + 1 que a sabotagem exigiu) · 20/08

## 🟡 Prioridade 3 — dívida que encarece o resto

- [ ] `interface ActionResult` duplicada em **10+** arquivos de action.
- [ ] Sidebar duplicado em 3 arquivos (284 + 221 + 219 linhas). Extrair genérico tocaria 3 áreas
      em produção.
- [ ] `components/ui/table.tsx` existe e é usado em **0** arquivos.
- [ ] `docs/integracoes.md` (pré-existente, commit `f49f4bb`) cita três arquivos que **não
      existem**: `lib/integrations/resend/client.ts`, `.../google-calendar/client.ts`,
      `.../blob/client.ts`. E o de Resend contradiz o `AGENTS.md`, que diz que o e-mail é Brevo.
- [ ] 🔴 **A skill `cavecrew` está quebrada como instalada:** o `README.md` dela referencia
      `.claude/agents/cavecrew-{investigator,builder,reviewer}.md`, e **esses arquivos não
      existem**. Mais 5 skills `caveman-*` com link morto para `../../README.md`. Pré-existentes,
      não corrigidos.

## ⚪ Achados catalogados, sem data

Registrados com diagnóstico para que a revisão futura não comece do zero. **Nenhum se corrige
de passagem.**

- [ ] **Fluxo de comprovação de renda / medicamento gratuito não existe** — `DO-28`, catalogado
      em 20/08 e **fora de escopo por decisão do dono**. Medido: `app/(public)/programa-acesso-solidario/page.tsx`
      é institucional (612 linhas, **zero formulário**), e `db/schema/pacientes.ts:55` tem
      `rendaFamilia` como **texto livre**, sem tabela de elegibilidade, aprovação ou gratuidade.
      Se o programa for operar de verdade, isso é sprint própria.
- [ ] 🔴🔴 **`app/(paciente)/_actions/dosagem.ts` não tem autenticação nenhuma** — medido em
      24/08/2026: grep por `auth()`, `verificarMedico`, `verificarPaciente`, `verificarRole` e
      `currentUser` no arquivo inteiro dá **zero**. `criarDosagem:43` aceita `pacienteId` do
      cliente e insere; `listarDosagensPaciente:129` devolve o plano terapêutico de qualquer
      paciente. `'use server'` publica todo export como **endpoint POST** — nenhum componente
      importar reduz a descoberta, não o acesso. **Perigo de mexer: BAIXO**, zero pontos de
      chamada. Ver [04 — Item 13.1](04-LISTA-DE-AFAZERES.md).
- [ ] 🔴 **As 8 actions de dosagem autorizam por PAPEL, sem escopo de objeto** (OWASP API1/BOLA)
      — `app/_actions/dosagens.ts:47,120,190,225` e `app/_actions/ajustes-dosagem.ts:34,72,108,152`
      usam `verificarMedicoOuAdmin`. Médico A opera o paciente do médico B. Mesma classe do Item 11,
      **mas com uso real em produção**, ao contrário da teleconsulta. E o
      `garantirMedicoDoPaciente` existe **duplicado** em `revisao-ia.ts:33` e
      `anamnese-baseline.ts:52`, nunca em `lib/auth/`. ⚠️ Corrigir exige decidir se **admin**
      continua vendo dosagem de qualquer paciente — regra de negócio, vai ao dono.
      Ver [04 — Item 13.5](04-LISTA-DE-AFAZERES.md).
- [ ] 🔴 **Dois rejeitados da ADR-0005 estão implementados** — `atualizarDosagem`
      (`app/_actions/dosagens.ts:120-159`) faz `UPDATE` em `gotasPorDia`, que é o **R-03**
      (_"apaga a curva de titulação"_); e `editarAjusteDosagem`
      (`app/_actions/ajustes-dosagem.ts:127`) faz **`DELETE` físico** dos itens do ajuste antes de
      reinserir — proibição nº 4 do `CLAUDE.md`. ⚠️ E a UI mente nos dois sentidos:
      `tab-dosagem.tsx:144` avisa _"removido permanentemente"_ para uma exclusão que é **soft
      delete** (`:159`), e não avisa nada da edição que **apaga de verdade**.
      Ver [04 — Item 13.3 e 13.4](04-LISTA-DE-AFAZERES.md).
- [ ] **Duas `criarDosagem` divergentes e as duas chamáveis** — `app/_actions/dosagens.ts:47` (a
      que a UI usa, com `verificarMedicoOuAdmin`) e `app/(paciente)/_actions/dosagem.ts:43` (sem
      auth). Só a segunda cria `recompras`. Unificar exige decidir qual comportamento é o certo —
      criação automática de recompra é **regra de negócio**. Ver [04 — Item 13.2](04-LISTA-DE-AFAZERES.md).
- [ ] `package-lock.json` (587 KB) convive com `pnpm-lock.yaml` — dois lockfiles no mesmo repo.
- [ ] `.nvmrc` = 18 e o CI usa Node 20 (`deploy.yml:24`). 🔴 **Agravado em 20/08:** Vitest 4
      exige Node `^20 || ^22 || >=24`. Quem rodar `nvm use` pega o 18 e **`pnpm test` nem
      inicia** — e o `.npmrc` tem `engine-strict=true`. O CI (Node 20) e a máquina do dono
      (Node 24) estão bem; só o `.nvmrc` mente. Trocar 18 → 20 é uma linha, mas é fora do
      escopo da Sprint 0, que declara explicitamente _"não mexer aqui"_.
- [ ] `AGENTS.md` diz heading em **Fraunces**; `app/globals.css:19-20` aponta para **Outfit**.
- [ ] `AGENTS.md` diz _"prefira Server Components"_; **11 de 16** páginas de `(admin)` são `'use client'`.
- [ ] `AGENTS.md` diz deploy na **Vercel**; produção é AWS EC2 (DT-006/DT-008), e `vercel.json` ainda existe.
- [ ] Swap de 8 GB **não persistido** no `/etc/fstab` (DT-006) — build falha após restart.
- [ ] IP público **dinâmico** sem Elastic IP (DT-006) — stop/start muda o IP e o site sai do ar.
- [x] **✅ CORRIGIDO em 20/08** — TURN público gratuito hardcoded na teleconsulta:
      `openrelay.metered.ca` com credencial pública `openrelayproject`. Provedor escolhido pelo
      dono: **Cloudflare Realtime TURN** (grátis no volume desta plataforma; ver a comparação
      com preço em [04 — Item 8](04-LISTA-DE-AFAZERES.md)). Credencial agora é **efêmera**,
      gerada no servidor, só para quem está na sala. Guarda `sem-relay-de-terceiro` com 13
      casos e 5 sabotagens. ⚠️ **falta o DPA pelo Jurídico e provisionar as env vars** — sem
      elas a chamada usa só STUN e avisa.
      Eram **DOIS arquivos**, não
      um — `components/teleconsulta/GlobalTeleconsultaHost.tsx:194-196` **e**
      `app/(paciente)/paciente/teleconsulta/[roomId]/page.tsx:156-158` (este em área
      protegida). Existe ainda uma **terceira** implementação de `RTCPeerConnection` em
      `app/(medico)/medico/teleconsulta/page.tsx:160`, só com STUN — provável código legado.
      A mídia da consulta médica atravessa relay de terceiro **sem contrato de operador**, sem
      SLA, com credencial compartilhada. Ver [04 — Item 8](04-LISTA-DE-AFAZERES.md).
- [ ] ⚠️ **O mascaramento de PII da transcrição protege menos do que o comentário afirma** — não
      há regex de endereço apesar de o comentário citar endereços; telefone só casa com DDD
      entre parênteses; nome próprio não é mascarado. E o áudio bruto vai ao **Google STT antes**
      de qualquer máscara, então **dois** operadores externos recebem dado de saúde nesta rota.
      Ver [04 — Item 12](04-LISTA-DE-AFAZERES.md).
- [ ] 🔴🔴 **O hook `escopo-autorizado` só vê escrita por ferramenta, não por ação — medido em
      20/08/2026.** `FERRAMENTAS_DE_ESCRITA` em `.claude/hooks/escopo-autorizado.py:44` lista
      `Write|Edit|MultiEdit|NotebookEdit`. Então:

      | ação | decisão do hook |
      |---|---|
      | `Write` em `app/(medico)/medico/x.tsx` | ✅ BLOQUEIA |
      | `cat > "app/(medico)/medico/x.tsx" <<EOF` via Bash | 🔴 **PASSA** |
      | `sed -i s/a/b/ AGENTS.md` via Bash | 🔴 **PASSA** |

      O `git-perigoso`, que é quem olha Bash, não confere caminho de escrita — só comando
      destrutivo. Ou seja: **a proteção das áreas clínicas, das migrations e do `AGENTS.md`
      vale para as ferramentas de edição e não vale para o shell.** Nesta sessão a disciplina
      foi de quem editava, não do mecanismo.

      **PERIGO DE MEXER:** alto, e é por isso que fica catalogado. Cobrir Bash exige decidir a
      granularidade de *"este comando escreve em tal caminho?"* — o mesmo problema que já
      produziu **dois incidentes de falsa acusação** em 19/08 (redirecionamento em heredoc,
      `sed` cujo argumento menciona um caminho, `tee`, `mv`, `cp`, `>>`, `python3 -c` com
      `open(...,'w')`). Guarda mal fatiado aqui bloqueia trabalho legítimo e acaba desligado.
      Trabalho próprio, com os casos de falsa acusação escritos **antes** da regra.

- [ ] 🔴 **Credenciais em texto claro no projeto de origem VidAI** — senha root de VPS em
      `deploy-novo-vps.sh:16`, senhas de Postgres/Redis no `docker-compose.prod.yml`, e **6
      arquivos `.env`** nas duas árvores. Não é código deste repo, mas **rotacionar as chaves é
      recomendação registrada**, e nenhuma configuração do VidAI é importada (ADR-0001 D-08).

> As três divergências do `AGENTS.md` estão resolvidas por precedência em
> `.claude/rules/precedencia-das-instrucoes.md`, sem editar o arquivo — ele é protegido por hook
> de propósito.

---

### 🔴 Achado de 13/09/2026 — as migrations NÃO RODAM DO ZERO

**Medido** ao subir um Postgres em Docker para provar as migrations da Sprint 8 sem gastar
deploy. Contra banco **vazio**, o histórico quebra numa migration antiga:

```
ALTER TABLE consultas ALTER COLUMN status SET DEFAULT 'reservada'
```

⚠️ **O que isso significa, e é maior que parece:** um banco novo **não pode ser criado a partir
do histórico de migrations**. Hoje produção está de pé porque o banco dela foi evoluindo junto;
mas um ambiente de homologação, um restore limpo, ou a máquina de um dev novo não têm como
chegar ao schema atual pelo caminho oficial.

**O perigo de mexer:** as migrations já aplicadas em produção **não podem ser reescritas** — o
`drizzle` guarda o hash no journal, e alterar uma aplicada faz o próximo deploy divergir. A
correção é uma migration nova que torne o estado alcançável, ou um dump de baseline versionado.

**Custo de deixar:** nenhum ambiente novo nasce. Custo de mexer: uma sessão, sem tocar em nada
que já rodou. **Não é escopo da Sprint 8** — catalogado, não corrigido.

### 🔴 Achado de 13/09/2026 — um guarda CONGELAVA o defeito que devia impedir (corrigido)

`a-revogacao-para-a-fila` afirmava `expect(bloco).toMatch(/marcarFalha/)` — exigia a
implementação de então. O D-14 da ADR-0022 decidira o contrário (`cancelado_por_revogacao`), a
migration `0043` fora autorizada para isso, e o valor ficou no enum com **zero** usos.

O guarda ficava **verde com o defeito** e vermelho quando a correção chegou.

⚠️ **Segunda ocorrência desta classe** — a primeira foi
`o-destino-do-paciente-segue-o-que-falta`, que comparava destinos com uma lista fixa contendo os
dois 404. **A regra que sai:** guarda mede a PROPRIEDADE, nunca o nome do método que a produz.
Corrigido em 13/09; ver ADR-0022 §33.2.

### ⚪ Achado de 13/09/2026 — a chave do Clerk não destrava o teste local

O `.env` local tem **zero** variáveis do Clerk, e por isso nenhuma tela com sessão renderiza
localmente. O secret existe no GitHub — mas **não é legível** (a API devolve nome e datas, valor
nenhum) e, mais decisivo, **não serviria**: a doc do Clerk diz que chave de produção só funciona
no domínio de produção, com erro literal _"Production Keys are only allowed for domain
'…'"_.

**O que destrava** é uma chave de **desenvolvimento** (`sk_test_`/`pk_test_`), grátis, de uma
instância separada — só o dono pega no dashboard. Sem ela, o Nível 3 (Chromium) da regra de
provar local alcança só tela sem sessão. Ver ADR-0022 §33.4.

### ⚪ Achado de 09/09/2026 — sem data

**`users.telefone` é texto livre** (`04` Item 26). Quatro caminhos gravam, nenhum normaliza — e
isso impede reconhecer paciente por telefone em **qualquer** lugar do sistema, não só no bot.
A proporção de dados sujos **não foi medida**: o banco local tem 1 paciente e 0 telefones.
Normalizar o campo exige migração de dados e autorização.

### 🔴 Achado de 10/09/2026 — CORRIGIDO no mesmo dia

**Nenhum deploy chegou a produção entre 14/08 e 10/09.** O Actions reportava sucesso e o site
servia um build antigo: `pm2 restart` reusa o caminho gravado e não relê o script
(Unitech/pm2#3054), o `pnpm build` perdoava a própria falha com `|| true`, e nada conferia se
produção passou a servir o build novo.

⚠️ **Consequência para o planejamento:** os 19 commits do PR #36 — IA clínica com revisão
humana, cadeia conduta-prescrição-titulação, `tab-prescricoes`, `tab-dosagem`, ChatPro,
cadastro por link e handoff de parceiros — **nunca estiveram em produção**. Não se perdeu
nada: está tudo na `main`. O que faltava era o processo executar o que já lhe entregavam.

Diagnóstico completo, risco medido e o que ficou de fora: `docs/04-LISTA-DE-AFAZERES.md`
Item 28. Guarda: `o-deploy-entrega-o-que-buildou` (21 casos, 9 sabotagens).

### ⚪ Achado de 10/09/2026 — o índice de ADRs está 11 entradas atrás

`docs/adr/README.md` lista até a **0007**. As ADRs **0008 a 0018** existem em disco e não estão
lá. Quem consultar o índice para saber se algo já foi decidido vai concluir que não foi.

**O custo já apareceu:** ao responder sobre o wizard da IA clínica, eu li o documento que
descreve o VidAI e não a ADR-0004 que decidiu o que fazer com ele — e afirmei ao dono que
faltava implementar algo que tinha sido **rejeitado com fundamento**. Índice incompleto não é
desorganização: é decisão perdida.

Correção: uma linha por ADR, e o status conferido contra o arquivo. Trabalho próprio.

### 🔴 Achado de 10/09/2026 — os crons NUNCA rodaram neste servidor

`vercel.json` declara três crons — validade de documento, recompra e revisão de dosagem. **O
projeto não roda na Vercel** (EC2 + PM2, DT-006/DT-008), e não existe nenhum workflow com
`schedule:`. Logo: os três nunca foram executados.

E as duas filas novas herdam o mesmo buraco: `/api/chatpro/processar` e `/api/parceiros/enviar`
existem, funcionam quando chamados, e **ninguém os chama**. O webhook do ChatPro aceita com 202 —
medido em produção — e o evento fica `pendente` para sempre.

Bloqueia o QA. Diagnóstico, as três opções e a recomendação: `docs/adr/ADR-0020-ajustes-pre-QA.md`
§4.

### 🔴 Achado de 10/09/2026 — NÃO LIGAR os 3 crons antigos sem medir antes

Ao criar o workflow que esvazia as filas novas, a tentação óbvia era ligar junto os três crons
que estavam no `vercel.json` e nunca rodaram: `verificar-validade-documentos`,
`verificar-recompra-medicamentos` e `verificar-revisoes-dosagem`.

⚠️ **Não foram ligados, de propósito.** O primeiro deles chama
`enviarEmailRenovacaoDocumentoEquipe` via Brevo (`app/api/cron/verificar-validade-documentos/route.ts:308`).
Ele nunca rodou **neste servidor** — então há meses de documentos vencidos acumulados, e a
primeira execução dispararia a enxurrada toda de uma vez, para pessoas reais.

**Antes de ligar, medir:** quantos registros a query devolveria hoje · quantos e-mails sairiam ·
para quem. Se for volume grande, o primeiro disparo precisa de janela ou de corte por data.

Ligar um cron parado não é retomar de onde parou: é executar meses de acúmulo em um minuto.

## Concluído

- [x] 🔴 **A TELA DO CONSENTIMENTO — o ato que faltava** · 11/09 · `feat/a-tela-do-consentimento`.
      A P5 lia um consentimento que **nenhuma tela colhia**: havia módulo, tipo e regra, e não
      havia lugar onde o paciente dissesse sim. Pior, `prepararTransferencia` recebia as
      finalidades **por parâmetro** — quem envia alegava o consentimento de quem é enviado.
      Entregue: tabela `consentimentos` (migration `0034`), leitura/escrita em
      `lib/parceiros/consentimento-registrado.ts`, bloco no **cadastro por link**, tela
      `/paciente/privacidade` com **revogação** (art. 8º §5º), e a P5 passando a **ler** do
      banco — inclusive o `texto` e a `versao` que o paciente leu, não os de hoje. Guarda
      `o-consentimento-e-colhido-antes-de-sair` com **45 casos**, provado por **17 sabotagens**
      (uma achou defeito meu: o caso do `revalidatePath` media presença, e havia duas chamadas).
      Decisão nova: **ADR-0021 D-06** — caixas desmarcadas, e o consentimento **não trava** o
      cadastro.
- [x] 🔴 **RASTREIO DE DECISÕES — buraco encontrado e fechado** · 24/08. O dono cobriu:
      _"você está atualizando as docs obrigatórias... inclusive criando as ADRs com nossas
      decisões certo?"_. **Ele estava certo.** As decisões dele de 24/08 estavam só nas ADRs
      técnicas e na minha memória, **sem `DO-nn` citável** — o catálogo tinha **uma** menção a
      24/08. Registradas **`DO-36` a `DO-45`** (10 decisões). Catálogo: 34 → **44 `DO-nn`**.
- [x] **ADR-0010** — a análise assistida é **aba do sidebar** da teleconsulta, etapas dentro dela
      (`DO-39`). O design do chefe não se altera · 24/08
- [x] **ADR-0011** — a **divergência alimenta o RAG** (`DO-40`) e o **rascunho persiste no
      servidor com histórico** (`DO-41`). `localStorage` **rejeitado com motivo**: dado de saúde
      em navegador de consultório compartilhado. Abriu **`GAP-16`** (Jurídico: base legal do uso
      secundário) · 24/08
- [x] **ADR-0005 D-03 retificada — `GAP-14` RESOLVIDO** por `DO-44` · 24/08. As duas versões
      ficam. O dono não delimitou _quando_ gerar prescrição: definiu o que **sempre** acontece —
      notifica o paciente, o anterior fica no histórico em **dois** lugares, visão por paciente
      com filtro geral, desenho não sobrecarregado.
- [x] 🔴 **AS TRÊS RDCs TRANSCRITAS** (`DO-45`) · 24/08 — e a primeira coisa que a transcrição
      achou foi **erro nosso**: a **RDC 327/2019 está REVOGADA** pela **RDC 1.015/2026** (Art. 76,
      `CAN-00`). Catálogo, plano de sprints e Sprint 5 citavam **norma morta**. 17 IDs novos:
      `CAN-00`…`CAN-06`, `IMP-01`…`IMP-04`, `REC-01`…`REC-06`.
      ⚠️ **`CAN-04` muda a Sprint 5:** o **tipo de receituário é derivado do teor de THC**
      (≤0,2 % Controle Especial · >0,2 % **Notificação de Receita "A"**), e `CAN-05` restringe
      THC alto a **doença debilitante grave**. Cinco entregáveis novos na Sprint 5.

- [x] 🔴 **RETRATAÇÃO — o guarda do contrato existia e deixou passar** · 24/08. Um fixture novo
      com **5** valores inexistentes no contrato derrubou o preview
      (`can't access property 'icone'`) com o guarda **verde**. Causa: `toBeTruthy()` verificava
      existência, não validade, e ele lia **um** fixture pelo nome. Corrigido como guarda de
      duas pontas — deriva os válidos do contrato, varre **todos** os `.json`, e tem caso de
      cobertura que acusa tipo de união novo sem varredura. **9 sabotagens** provam. Guardas:
      **199 casos** em 8 arquivos.
- [x] **Componentes denunciam valor fora do contrato** · 24/08 — `ChipAchado` e
      `MedicacoesSugeridas` renderizam "origem/procedência desconhecida: X" em vermelho em vez de
      estourar. Cair para um padrão silencioso foi rejeitado: afirmaria origem que ninguém
      declarou, e origem é o que separa sugestão de fato.
- [x] **ADR-0006 D-01 estava sendo violada sem ninguém notar** · 24/08 — a tela nascia com
      **nenhuma** hipótese aberta; a ADR decidiu "primeira aberta, demais fechadas". Corrigido.

- [x] **Opções de medicamento dentro de cada hipótese** · 24/08 — pedido do dono: até 3,
      ranqueadas, com o porquê e o que pesa contra. **Sem dose**, e o critério não é de gosto:
      `IMD-01` (informar opções) × `IMD-02` (dose = dirigir), catalogado e decidido em
      **ADR-0009**. Novo: `MedicacoesSugeridas.tsx`, tipo `MedicamentoSugerido` no contrato,
      fixture `resposta-canabidiol-dor-cronica.json` com os 3 estados (3 opções, 2, e **zero**).
- [x] **Botão de revisar dentro de cada opção da tela "Sua decisão"** · 24/08 — abre o **mesmo**
      componente de evidência do painel (`EvidenciaDaHipotese.tsx`), não uma cópia. Abrir para
      reler **não** seleciona: dois botões irmãos, estados separados (ADR-0009 D-06).
- [x] **Modo `denso` para o sidebar da teleconsulta** · 24/08 — cartões fechados, tipografia um
      passo menor, rótulo do botão vira ícone. **Nenhum conteúdo sai** para caber (D-07).
- [x] **Preview separado por perfil, com switch** · 24/08 — Médico · Paciente · Admin. Entraram
      os dois que faltavam (`RastreioUso`, `FormMedidas`), o caso de canabidiol e a simulação do
      sidebar em 380 px. A aba do admin **diz que não há tela** e por quê, em vez de ficar vazia.
- [x] **Guarda `medicacao-informa-nao-prescreve`** · 24/08 — **44 casos**. ⚠️ Primeira versão
      tinha detector defeituoso: `doseMg` sobreviveu à sabotagem. Corrigido por token+radical,
      com 18 casos de controle. Retratação na ADR-0009 §4.
- [x] **RETRATAÇÃO — três contagens de guarda no `CLAUDE.md` estavam erradas** · 24/08:
      autorização 19→**16**, relay 13→**17**, anamnese 23→**27**. Sem perda de cobertura (os
      arquivos nunca foram commitados); eu contei casos **planejados** como se fossem medidos.
      Total real medido: **191 casos em 8 guardas**.

- [x] **Como VER as telas sem login — `/preview`** · 24/08. Rota que renderiza os **componentes
      reais** (não cópia) com dado de fixture, em 7 seções, cada uma nomeando o arquivo que
      desenha. `notFound()` em produção **e** só entra nas rotas públicas do middleware fora de
      produção. A alternativa que o dono propôs — copiar as telas, aprovar a cópia, transicionar
      depois — foi **recusada com motivo**: a cópia e o original divergem, e o que foi aprovado
      deixa de ser o que vai a produção.
- [x] **Credenciais de teste, uma por papel, que fazem login de verdade** · 24/08.
      `scripts/criar-usuarios-clerk-teste.mjs` cria as contas no Clerk, define
      `publicMetadata.role` e casa o `clerk_id` com as linhas do seed. **Provado** por sign-in
      completo na Frontend API (`status: complete`, sessão criada), não afirmado.
      ⚠️ **Login é e-mail + código `424242`, não senha** — a aplicação de desenvolvimento tem
      `password.used_for_first_factor: false`, medido no `/v1/environment` dela.
- [x] **Guarda `banco-usa-driver-certo` NÃO RODAVA** · 24/08 — e mostrava `Tests 133 passed` ao
      lado de `Test Files 1 failed`. Corrigido extraindo a decisão para `lib/db/driver.ts`
      (módulo puro) + 5 casos que impedem a volta, dos quais **2 de controle contra falsa
      acusação**. Lição registrada em `docs/TECNICA-DOS-GUARDAS.md` §5-bis.
      ⚠️ O total "147 casos, 7 arquivos" escrito aqui na hora **está superado**: a medição de
      24/08 dá **191 casos em 8 guardas**. Ver a retratação das contagens acima.

- [x] **Método de documentação instalado** — princípios, árvore do conhecimento, técnica dos
      guardas, ADR com rejeitados, catálogo com ID citável · 19/08
- [x] **`CLAUDE.md` com índice, proibições e regras de trabalho** — só por acréscimo · 19–20/08
- [x] **2 hooks `PreToolUse`** (`git-perigoso`, `escopo-autorizado`) + guarda com **34 casos**,
      incluindo 3 regressões de falsa acusação · 19/08
- [x] **6 skills `metodo-*`** instaladas, com avaliação por 3 cenários cada · 19/08.
      ⚠️ baseline sem a skill **não medida**
- [x] **`06-PADROES-DO-CODIGO.md`** — o sistema visual, as convenções e o padrão de action,
      todos **medidos** · 19/08
- [x] **Achados 1, 2, 3, 4 e 6 diagnosticados** com `caminho:linha` e perigo de mexer medido ·
      19–20/08. ⚠️ **Não existe Item 5** — era de outro domínio; os números não foram
      reaproveitados para não quebrar citação
- [x] **Item 7 — RETRATAÇÃO por escrito:** eu afirmei 31 tabelas em `db/schema`; **são 40**.
      Contei arquivos em vez de tabelas · 20/08
- [x] **Domínio comercial removido deste repositório** — pertence a outro projeto · 20/08
- [x] **Sprint 0 — baseline MEDIDA** e não mais copiada: `pnpm install` (9,4 s), lint **210
      erros**, Prettier **360 arquivos**, `tsc --noEmit` **0 erros** (primeira medição já
      feita). Os dois primeiros desmentiram o `AGENTS.md` em +79 % e +55 % · 20/08
- [x] **Sprint 0 — runner + guarda migrado**: Vitest 4.1.11, `pnpm test` (~1 s), 35 casos
      verdes. 🔴 **A prova de sabotagem encontrou um mutante sobrevivente**: neutralizar
      `sem_heredoc` mantinha os 34 casos verdes, porque nenhum deles punha o comando perigoso
      no INÍCIO de uma linha do heredoc. Virou a REGRESSÃO 4; agora as 5 sabotagens ficam
      vermelhas · 20/08
- [x] **Sprint 0 — portão de baseline**: `scripts/conferir-baseline.mjs` + `baseline.json`.
      Falha quando **piora**, não quando está vermelho; type-check entra como portão
      **absoluto** porque está em zero. Provado por sabotagem: 1 erro novo de lint → vermelho,
      removido → verde · 20/08
- [x] **Sprint 0 — portão LIGADO ao CI** (`DO-18`): `ci.yml` novo + enxerto no `deploy.yml`
      antes do build/rsync/migration. Autorização com granularidade de dois caminhos exatos ·
      20/08
- [x] **Sprint 0 — os dois guardas ficam** (`DO-19`), com **caso de paridade** que fica vermelho
      nomeando o caso que faltar. Provado: caso órfão no `.sh` → Vitest acusa pelo nome ·
      20/08. **37 casos**, e as **6 sabotagens** morrem

---

## 🎯 Fila de execução (atualizada **24/08/2026**)

**Um item por vez.** O detalhe de cada fatia está em
[`sprints/00-PLANO-DE-SPRINTS.md`](sprints/00-PLANO-DE-SPRINTS.md).
Branch: `feat/flow-representatives`. **82 arquivos não commitados** — nada vai sem ordem do dono (`DO-20`).

### ✅ Concluídas

| #     | item                                                                                                                                                                                                                                                                                                                                                        | sprint                                                   |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ~~1~~ | `pnpm install`, baseline **medida** · 20/08                                                                                                                                                                                                                                                                                                                 | [S0](sprints/SPRINT-0-fundacao.md)                       |
| ~~2~~ | Vitest, portão de baseline, CI nos dois workflows · 20/08. ⚠️ **falta commitar e enviar** para rodar no GitHub                                                                                                                                                                                                                                              | [S0](sprints/SPRINT-0-fundacao.md)                       |
| ~~3~~ | Auditoria da teleconsulta — 7 defeitos de BOLA corrigidos (`garantirDonoDaSala`), TURN Cloudflare com credencial efêmera, consentimento CFM bloqueando a sala · 20–24/08                                                                                                                                                                                    | [S1](sprints/SPRINT-1-auditoria-da-teleconsulta.md)      |
| ~~4~~ | Contrato congelado + 3 fixtures + módulo em `/medico/ia-clinica` · 20–24/08                                                                                                                                                                                                                                                                                 | [S2](sprints/SPRINT-2-contrato-e-fundacao.md)            |
| ~~5~~ | Anamnese como série + rastreio de uso (`DO-26`) + primeiro uso (`DO-27`) · 20/08                                                                                                                                                                                                                                                                            | [S3](sprints/SPRINT-3-anamnese-assistida.md)             |
| ~~6~~ | Hipóteses, evidência, **opções de medicamento** (ADR-0009) e revisão humana · 20–24/08. ⚠️ **E3, E7 e E8 NÃO feitos** — viram os itens 7, 8 e 9 abaixo                                                                                                                                                                                                      | [S4](sprints/SPRINT-4-hipoteses-e-revisao-humana.md)     |
| ~~7~~ | 🔴 **Conduta, prescrição e titulação** (S5) — **13 de 15** entregáveis · 25/08. Retificada por `DO-46`/`DO-47`: o teor é campo do **médico** e o sistema **avisa** em vez de derivar ou travar. ⚠️ **Ficaram o 10** (aviso do `CAN-05` — falta ler a RDC 38/2013 **e** perguntar ao dono) **e o 13** (conferir `lib/receituario/`, que é o Item 11 do `04`) | [S5](sprints/SPRINT-5-conduta-prescricao-e-titulacao.md) |

### 🎯 A fazer, nesta ordem

| #        | item                                                                                                                                 | sprint                                                                                     | bloqueado por                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| ~~8~~ ✅ | **E3 da S4** — divergir com "por que a IA errou" (opcional) + medicamento a prescrever, alimentando o RAG                            | S4 · [ADR-0011](adr/ADR-0011-a-divergencia-do-medico-alimenta-o-rag.md)                    | `GAP-16` bloqueia só a **ingestão**, não os campos         |
| ~~9~~ ✅ | **E7 da S4** — rascunho da revisão **no servidor**, com histórico                                                                    | S4 · ADR-0011 D-03/D-04                                                                    | prazo de retenção = Jurídico (campo fica vazio)            |
| 10       | **E8 da S4** — urgência na tela, 4 níveis, com o mapa **7→4 escrito antes**. É gatilho contra medicamento errado (`DO-42`, `CAN-05`) | S4                                                                                         | escrever o mapa 7→4                                        |
| 11       | **Análise assistida como ABA do sidebar da teleconsulta**, etapas dentro dela                                                        | S1/S4 · [ADR-0010](adr/ADR-0010-analise-assistida-e-uma-aba-do-sidebar-da-teleconsulta.md) | rótulo e posição da aba = perguntar ao dono                |
| 12       | **Área do paciente** — diário, dose, resumo                                                                                          | [S6](sprints/SPRINT-6-area-do-paciente.md)                                                 | `GAP-12` · **exige a S5 pronta** (entregável 7 dela)       |
| 13       | **Exames** — anexar, ver, vincular. A última da Metade 1                                                                             | [S7](sprints/SPRINT-7-exames.md)                                                           | 🔴 conversa do dono com o chefe (`DO-13`)                  |
| 14       | **Metade 2** — motor, RAG, corpus, exames com IA                                                                                     | S8–S12                                                                                     | 🔴 AWS (`GAP-11`) · Jurídico (`CF-01`, `GAP-06`, `GAP-16`) |
| 15       | **Item 6** — store privado nos 10+ uploads existentes                                                                                | —                                                                                          | autorização                                                |
| 16       | **Item 11** — conferir `lib/receituario/` contra `REC-02`/`REC-03`                                                                   | —                                                                                          | ler a RDC 873/2024 primeiro · autorização                  |

### ✅ Fora da fila original — feito em 09/09/2026 a pedido do dono

| item                                                                                                   | estado                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Integração ChatPro** — link único de cadastro entregue pelo WhatsApp, com nome completo **e e-mail** | ✅ **código pronto e testado**. [ADR-0015](adr/ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md) · diagnóstico no [`04` Item 18](04-LISTA-DE-AFAZERES.md) |

**O que falta, e é do dono, não do código:**

| #        | pendência                                                                                                                                                                                        | dono              | bloqueia                                |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------- |
| 1        | Configurar o painel do ChatPro — guia pronto em [`COMO-CONECTAR-NO-PAINEL.md`](chatpro/COMO-CONECTAR-NO-PAINEL.md)                                                                               | dono              | o link chegar ao paciente               |
| ~~2~~ ✅ | A tela `/cadastro/{token}` — **construída em 09/09/2026** por decisão do dono: nome, CPF, telefone, e-mail, senha e a pergunta sobre tratamento em curso. Fica em `app/(auth)/cadastro/[token]/` | —                 | —                                       |
| 3        | Ligar o cron de `/api/chatpro/processar`                                                                                                                                                         | dono/deploy       | o funil se mover (nada se perde até lá) |
| 4        | Migration `0026` no Neon — só rodou no Postgres **local**                                                                                                                                        | deploy            | tudo, em produção                       |
| 5        | 🔴 Base legal da LGPD art. 11 para dado sensível de saúde                                                                                                                                        | chefia + jurídico | operação com paciente real              |

### 📋 Handoff Greens → BeHemp (decidido em 09/09/2026)

| item                                                    | estado                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| **ADR-0016** — back-channel assinado, só o token na URL | ✅ escrita, com pesquisa fundamentada              |
| **ADR-0027** no `greens-corp` — o lado de quem envia    | ✅ escrita (espelho; a fonte do contrato é a 0016) |
| Implementação                                           | 📋 **bloqueada** — ver `04` Item 22                |

🔴 **Não começar a implementar antes de:** a Dryelle subir a atualização do formulário da Greens
(a lista de campos de 09/09 precisa ser reconferida), o aceite existir no fluxo do intake, e o
segredo compartilhado estar nos dois `.env`.

**As três ADRs estão escritas** (09/09/2026), e a ordem de EXECUÇÃO está no `04` Item 23:

| #   | ADR      | o quê                                                                         | espelho no greens-corp |
| --- | -------- | ----------------------------------------------------------------------------- | ---------------------- |
| 1   | **0016** | cadastro da Greens chega por back-channel · **e o retorno automático** (D-09) | ADR-0027               |
| 2   | **0017** | o bot da BeHemp oferece o link quando falta receita nossa ou ANVISA           | —                      |
| 3   | **0018** | o bot da Greens usa o link da BeHemp e devolve o paciente                     | ADR-0028               |

🔴 **O canal de VOLTA (0016 D-09) vem antes da 0018**, senão a 0018 cria um segundo caminho de
retorno — que é o rejeitado R-05 dela.

### Trabalho próprio que precede itens da lista

🔴 **Transcrever normas** ([`02`](02-CATALOGO-DE-REGRAS.md)):

- ✅ **RDC 1.015/2026** (revogou a 327/2019), **660/2022** e **1.000/2025** — transcritas 24/08 (`DO-45`)
- ⏳ **RDC 38/2013** — define "doença debilitante grave", régua do `CAN-05`. **Precede o entregável 10 da S5**
- ⏳ **RDC 873/2024** — institui o SNCR, citada pelo `REC-05`. **Precede o Item 11**
- ⏳ **RDC 185/2001** — classes de risco SaMD, completa o `ANV-04`. Não bloqueia telas; bloqueia **ligar o motor**
- ⏳ **CFM 2.299/2021** na parte de documento eletrônico — só o **objeto** foi lido

> 🎯 **O próximo NÃO é a Sprint 6.** Entre ela e o que já foi feito entram **quatro etapas em
> sequência**, decididas em 25/08/2026 (`DO-52`, `DO-53` · [ADR-0014](adr/ADR-0014-o-qa-de-ponta-a-ponta-precede-a-sprint-6.md)):
>
> | #   | etapa                       | por que precede a seguinte                                            |
> | --- | --------------------------- | --------------------------------------------------------------------- |
> | A   | **Mapear os dados do seed** | seed escrito sem mapa descobre o que falta na execução — duas rodadas |
> | B   | **Escrever o seed**         | sem dado, o QA falha por **estado vazio**, que parece bug e não é     |
> | C   | **QA de ponta a ponta**     | primeiro teste humano das 5 sprints; achado aqui é mais barato        |
> | D   | **Visualizar as telas**     | o aceite visual, que é do dev Davi                                    |
>
> 🔴 **O encadeamento de bloqueios é a razão de B vir antes de C:** paciente sem triagem não
> chega à teleconsulta, sem consentimento a sala não abre, sem conduta não há titulação. Testar
> a tela 6 exige que 1 a 5 tenham dado.
>
> Só depois vêm os **`GAP-nn`** (um cartão só, `DO-54`) e as **transcrições** — que agora só
> terminam quando o ID aparece **no código**, não só no catálogo (`DO-55`).
>
> ✅ **Itens 8, 9, 10 e 11 concluídos em 25/08/2026** — E3, E7, E8 e a aba `IA Clínica`.
> Com eles, **a Sprint 4 fecha** e a Metade 1 fica só com as Sprints 6 e 7.
>
> ⚠️ **Trabalho próprio que passou a preceder o item 10 da S5:** ler a **RDC 38/2013** e
> **perguntar ao dono** se o `CAN-05` também é aviso, como ele decidiu para o `CAN-04`.
>
> ⚠️ Fila desatualizada faz o projeto trabalhar na prioridade errada. Se houver item concluído
> com data mais recente que a do cabeçalho, **a fila está mentindo**.
