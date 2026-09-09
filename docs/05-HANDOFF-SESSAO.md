# Handoff de sessão — Be4Hope / BeHemp

> 🔴 **Leia antes de agir.** Se não ler, você refaz o que já foi feito, repete um erro que já
> custou caro, ou reabre uma decisão que já foi tomada.

**Escrito em 24/08/2026**, ao fim da sessão que executou as Sprints 0 a 4 e preparou a 5.

> 🎯 **A próxima sessão começa a Sprint 5** — conduta, prescrição e titulação. **Nada bloqueia o
> início.** Caminho completo na §9. Não comece pelo código: comece pela Fila de execução do
> [`03`](03-CHECKLIST-MESTRE.md).

> ⚠️ **Este arquivo substitui o handoff de 20/08**, que dizia que a próxima sessão executaria a
> Sprint 0. As Sprints **0, 1, 2, 3 e 4 estão feitas**.

---

## §1 — O que está no ar agora

| onde                                    | o quê                                                                                           | desde                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------- |
| **produção** (EC2 + PM2, DT-006/DT-008) | o commit `f894821` — _"Merge pull request #34 from Tech-GreensCorp/fix/triagem-cadastro-flow"_  | **18/08/2026 17:35** |
| **localhost:3000**                      | dev server rodando (PID 205008), HTTP 200, contra **Postgres local na porta 5436**              | 24/08                |
| **banco local**                         | migrations até `0022_reconciliar_medico_ordem.sql` aplicadas; 3 aplicações registradas em 24/08 | 24/08                |
| **Neon (produção)**                     | **intocado.** Nenhuma migration desta sessão foi aplicada lá                                    | —                    |

### 🔴 O dado mais importante desta seção: NADA foi commitado

```
git rev-list --left-right --count origin/main...HEAD  →  0    0
```

**A branch `feat/flow-representatives` está idêntica a `origin/main` em commits.** Quatro dias de
trabalho — Sprints 0 a 4 inteiras — existem **apenas como arquivos não versionados**:

- **60 arquivos novos** (`??`) — todo o módulo de IA clínica, os 8 guardas, as 12 docs, os hooks,
  o portão de baseline
- **22 arquivos modificados** (`M`) — incluindo `middleware.ts`, `lib/db/index.ts`, `lib/env.ts`,
  `CLAUDE.md` e 7 arquivos de teleconsulta

**Isso é deliberado** (`DO-20`: nada vai sem ordem expressa do dono), **e é risco real**: se a
máquina morrer, perde-se tudo. Não há cópia em lugar nenhum.

⚠️ **"Empurrei" não é "subiu".** Nada foi empurrado. `origin/main` não sabe que este trabalho
existe.

---

## §2 — Onde a sessão parou

A sessão executou, em sequência, as Sprints 0 a 4 e terminou preparando a 5. O último bloco de
trabalho foi disparado por uma cobrança do dono — _"você está atualizando as docs obrigatórias do
CLAUDE.md né? inclusive criando as ADRs com nossas decisões certo?"_ — e ela estava certa: as
decisões que ele tomou em 24/08 estavam registradas nas ADRs técnicas e na minha memória, mas
**sem `DO-nn` citável no catálogo**. O catálogo tinha **uma** menção a 24/08. Isso foi fechado:
dez decisões viraram `DO-36` a `DO-45`, e o catálogo passou de 34 para **44** `DO-nn`.

No mesmo movimento o dono mandou transcrever as RDCs (`DO-45`), e a transcrição achou um erro
nosso de quatro dias: a **RDC 327/2019 está revogada** pela RDC 1.015/2026 (Art. 76). Ela estava
citada no catálogo, no plano de sprints e na Sprint 5 — que seria construída sobre norma morta.
As três normas foram transcritas (17 IDs novos), a Sprint 5 ganhou **5 entregáveis** vindos delas,
e a ADR-0009 foi retificada.

A sessão terminou com a **Fila de execução do `03` atualizada para 24/08** e com o dono pedindo o
prompt para abrir uma sessão nova. **Nenhum trabalho ficou pela metade** — o último item foi
concluído e verificado. O que existe são pendências **planejadas**, listadas na §4 e na fila.

Último commit: `f894821`, de 18/08. Pendente de commit: **tudo**.

---

## §3 — O que o dono vai fazer agora

**Abrir uma sessão nova, de contexto zero, para executar a Sprint 5** e as pendências das Sprints
1 e 4. Ele recebeu o prompt pronto no chat da sessão anterior.

Consequências práticas para quem lê isto:

- **Não presuma que a sessão anterior continua** — ela não continua.
- **Não comece nada que dependa de decisão dele em tempo real** sem perguntar antes.
- Se ele mandar commitar, o trabalho de 4 dias entra de uma vez: **proponha o fatiamento em
  commits temáticos**, não um commit único de 82 arquivos.

---

## §4 — Pendências com prazo

### De terceiros

| o quê                                                                                                                   | de quem               | consequência de perder                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_TURN_KEY_ID` e `_API_TOKEN` + **assinatura do DPA**                                                         | Cloudflare + Jurídico | a teleconsulta atravessa **só STUN**. Em rede restritiva (NAT simétrico, corporativa, algumas operadoras móveis) a chamada **não conecta**. O código já degrada com `turnDisponivel: false` — mas degradar é falhar mais devagar |
| Revisão dos **dois textos de consentimento** + preencher `CONTROLADOR` (razão social, CNPJ, e-mail do DPO) e `RETENCAO` | Jurídico              | `CONSENTIMENTO_PRONTO_PARA_USO = false` em `lib/lgpd/consentimento.ts`. O texto está no ar em localhost com marcadores `[PENDENTE — …]` **visíveis**. Não pode ir a produção assim                                               |
| **`GAP-16`** — base legal do **uso secundário** do juízo do médico no RAG                                               | Jurídico              | bloqueia a **ingestão** no corpus (Sprint 10). **Não** bloqueia construir os campos (item 8 da fila)                                                                                                                             |
| **`GAP-06`** — base legal e contrato de operador para provedores de LLM novos e para **enviar imagem clínica**          | Jurídico              | bloqueia a Metade 2 e a Sprint 11                                                                                                                                                                                                |
| **`GAP-03`** — corpus de canabidiol validado, e quem o valida                                                           | farmacêutico          | bloqueia a Sprint 10. Enquanto isso, **toda** opção de medicamento chega à tela rotulada `inferido_ia`                                                                                                                           |
| Upgrade de RAM (**`GAP-11`**)                                                                                           | AWS                   | bloqueia a **Metade 2 inteira**                                                                                                                                                                                                  |
| **Conversa do dono com o chefe sobre exames** (`DO-13`)                                                                 | dono                  | a Sprint 7 **não começa** sem ela                                                                                                                                                                                                |
| Enquadramento **SaMD e classe** (`ANV-04` + RDC 185/2001)                                                               | Assuntos Regulatórios | não bloqueia telas; bloqueia **ligar o motor**                                                                                                                                                                                   |

### Prazos regulatórios já em curso — medidos em 24/08/2026

| prazo                                                                                                 | situação hoje                                                                                                                                                           |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modelos de receituário da Portaria 344/1998 **deixaram de valer para novas impressões em 13/02/2026** | **já passou.** Impressos até 12/02/2026 seguem válidos por tempo indeterminado                                                                                          |
| ANVISA disponibiliza o **SNCR** para requisição de numeração **até 01/06/2026**                       | **já passou.** Ou seja, o `REC-02` (numeração do SNCR) é exigência **corrente**, não futura — e `lib/receituario/` **nunca foi conferido** contra ela (Item 11 do `04`) |
| RDC 1.000/2025 entrou em vigor 60 dias após 11/12/2025                                                | **em vigor** desde ~fevereiro de 2026                                                                                                                                   |

### Decisões do dono ainda em aberto

1. **Rótulo e posição da aba** de análise assistida no sidebar da teleconsulta (ADR-0010 §4).
2. Um ajuste de dose que **troca o produto** para outro de faixa de THC diferente muda o tipo de
   receituário (`CAN-04`) — nesse caso a prescrição nova deixa de ser opcional. **Não estava na
   pergunta que gerou o `DO-44`.** Registrado na ADR-0005 D-03.
3. **`GAP-12`** — as escalas do diário do paciente são exatamente as 5 do baseline?

---

## §5 — 🔴 O que NÃO fazer nesta sessão

### Coisas que parecem boa ideia e custaram caro

1. **Não rode `pnpm build` com o dev server de pé.** O build sobrescreve o `.next` que o dev usa e
   a página passa a devolver **500** com _"Next.js (stale)"_. Aconteceu em 24/08 e custou uma
   investigação inteira antes de eu perceber a causa. Pare o dev, ou aceite reiniciá-lo depois.
2. **Não rode `prettier --write` em arquivo de produção que já existe** (`DO-35`). O
   `prettier-plugin-tailwindcss` reordena classe: o CSS final é idêntico e o diff fica ilegível.
   Em `GlobalTeleconsultaHost.tsx` deu **+755/−644** para ~40 linhas de conteúdo real. Formatar
   arquivo inteiro **só se o arquivo for novo**.
3. **Não use `localStorage` para o rascunho da revisão.** Parece o caminho de três linhas e foi
   **rejeitado com motivo** na ADR-0011 D-03: é dado de saúde num navegador de consultório, que
   pode ser compartilhado, e não sobrevive a trocar de máquina — que é justamente o caso do
   `DO-41`. Vai no **servidor**.
4. **Não cite a RDC 327/2019.** Está **revogada** (`CAN-00`, RDC 1.015/2026 Art. 76). A norma de
   produtos de Cannabis é a **1.015/2026**.
5. **Não acrescente campo de dose** (`dose`, `mg`, `frequencia`, `titulacao`, `volume`, ou
   qualquer grafia composta) ao tipo `MedicamentoSugerido` nem aos fixtures. Muda a categoria
   regulatória do produto de `IMD-01` (informar) para `IMD-02` (dirigir) — ADR-0009 D-02. O guarda
   `medicacao-informa-nao-prescreve` quebra o build, e ele **derives por token+radical**, então
   `doseMg` e `dose_mg` também caem.
6. **Não redeclare `evidenciaDa` nem duplique `EvidenciaDaHipotese`.** O dono pediu explicitamente
   que a tela de decisão mostrasse _"o mesmo dado"_ do painel — o que só é verdade se for o
   **mesmo componente**. Duplicar atende hoje e diverge no primeiro ajuste (ADR-0011 D-05).
7. **Não transforme `/preview` em cópia das telas.** O dono propôs isso e foi **recusado com
   motivo**: a cópia e o original divergem, e o que ele aprova deixa de ser o que vai a produção.
   `/preview` importa os **componentes reais**.

### Áreas protegidas — mexer exige autorização escrita

8. **Não altere `prescricoes.medicamentos`** para "arrumar" o JSONB. É o Item 4 do `03`, alimenta
   **PDF assinado e SNCR**, está em produção.
9. **Não corrija os 10+ uploads públicos** existentes de passagem (Item 6 do `03`). Inclui o
   `app/api/upload-exame/route.ts:77`, que usa `access: 'public'`. **Código novo não repete
   isso**; o existente é trabalho próprio, com autorização.
10. **Não edite `AGENTS.md`** — bloqueado pelo hook `escopo-autorizado.py` de propósito. Ele tem
    três afirmações que o código contradiz; a tabela de correção está em
    `.claude/rules/precedencia-das-instrucoes.md` §2.
11. **Não contorne um hook editando o hook.** Se ele acusou inocente, o defeito é **dele**:
    conserte a granularidade e acrescente o caso ao guarda — **nos dois** (`.sh` e `.ts`, `DO-19`).

### Higiene

12. **Não commite sem ordem expressa** (`DO-20`). **`main` é produção** e o push dispara migration
    sem rollback.
13. **Não crie documento visual, artifact ou relatório desenhado** sem pedido (`DO-30`). Terminal
    é o padrão.
14. **Não diga que teste/lint/build está verde sem rodar.** Estado conhecido: `pnpm lint` e
    `pnpm format:check` falham por baseline — reporte separado das suas mudanças.

---

## §6 — Decisões tomadas nesta sessão

### Decisões do dono, agora citáveis (`02-CATALOGO-DE-REGRAS.md`)

| ID      | decisão                                                                                                                                                                       | virou ADR?                                                                                    |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `DO-36` | Até **3 medicamentos** ranqueados por hipótese, com o porquê                                                                                                                  | [ADR-0009](adr/ADR-0009-recomendacao-de-medicamento-informa-sem-posologia.md)                 |
| `DO-37` | Botão em cada opção de "Sua decisão" que expande **a mesma** evidência do painel                                                                                              | ADR-0009 D-05/D-06                                                                            |
| `DO-38` | O preview fica, **separado por perfil** com switch                                                                                                                            | — (não precisa)                                                                               |
| `DO-39` | Análise assistida é **mais uma aba** do sidebar da teleconsulta, etapas dentro dela                                                                                           | [ADR-0010](adr/ADR-0010-analise-assistida-e-uma-aba-do-sidebar-da-teleconsulta.md)            |
| `DO-40` | **Divergir alimenta o RAG** — "por que a IA errou" (opcional) + medicamento a prescrever                                                                                      | [ADR-0011](adr/ADR-0011-a-divergencia-do-medico-alimenta-o-rag.md) D-01/D-02                  |
| `DO-41` | Rascunho da revisão **obrigatório, com histórico**, como no VidAI                                                                                                             | ADR-0011 D-03/D-04                                                                            |
| `DO-42` | **Gatilhos de urgência na tela** + anamnese específica, para evitar medicamento errado                                                                                        | — ⚠️ **devia ter ADR e não tem** (ver abaixo)                                                 |
| `DO-43` | Sprint 5 segue a do VidAI, adaptada a cannabis                                                                                                                                | —                                                                                             |
| `DO-44` | 🔴 **Resolve o `GAP-14`** — ajuste notifica o paciente, anterior fica no histórico em **dois** lugares, tela separa por paciente com filtro geral, desenho não sobrecarregado | [ADR-0005](adr/ADR-0005-a-cadeia-conduta-prescricao-dosagem-titulacao.md) **D-03 retificada** |
| `DO-45` | Transcrever as RDCs **agora**                                                                                                                                                 | —                                                                                             |

### Decisões técnicas

| decisão                                                                                                 | onde                               |
| ------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Recomendação de medicamento **informa opções, nunca posologia** — critério `IMD-01` × `IMD-02` do IMDRF | ADR-0009                           |
| A decisão do driver do banco vira **módulo puro** (`lib/db/driver.ts`), para o guarda poder rodar       | §5-bis de `TECNICA-DOS-GUARDAS.md` |
| Componentes **denunciam** valor fora do contrato em vez de cair ou de assumir padrão silencioso         | ADR-0009 §4                        |
| `/preview` público **só fora de produção**, no `middleware.ts`                                          | —                                  |

### 🔴 Decisão que devia ter ADR e não tem

**`DO-42` — os gatilhos de urgência.** Ele cresceu durante a sessão: começou como "badges de 4
níveis" (E8 da Sprint 4) e, depois da transcrição das RDCs, virou **mecanismo de segurança
normativo** — o `CAN-05` restringe THC > 0,2 % a doença debilitante grave, e o `CAN-04` faz o
mesmo limiar decidir o tipo de receituário. Isso merece ADR própria, com o **mapa 7→4** decidido e
os rejeitados escritos. **Não foi escrita por falta de tempo na sessão.** Escrever antes de
implementar o item 10 da fila.

---

## §7 — O que a sessão aprendeu e não está no código

### Retratações — leia antes de "consertar" um não-defeito

1. **Três contagens de guarda no `CLAUDE.md` estavam erradas.** Eu escrevi 19/13/23; são
   **16/17/27**. Não houve perda de cobertura — os arquivos nunca foram commitados, o `git log`
   deles é vazio. Eu contei casos **planejados** como se fossem medidos. **Contagem de guarda se
   copia da saída do runner, nunca da leitura do arquivo.**
2. **O guarda `contrato-da-ia-e-a-unica-fonte` existia e deixou passar.** Um fixture novo entrou
   com **cinco** valores que o contrato não declara e derrubou o `/preview` inteiro. Dois defeitos
   de classe: ele checava `toBeTruthy()` (existência, não validade) e lia **um** fixture pelo
   nome. Corrigido como guarda de duas pontas + caso de cobertura. **9 sabotagens** provam.
3. **O detector de posologia tinha a mesma doença.** Comparava nome de campo por **igualdade**
   contra uma lista; a sabotagem com `doseMg` **passou verde**. Corrigido por token+radical, com
   18 casos de controle. Era a Regra 1 da técnica sendo violada — _derive, não liste_.
4. **A ADR-0006 D-01 estava sendo violada sem ninguém notar.** A tela nascia com **nenhuma**
   hipótese aberta; a ADR decidiu _"primeira aberta, demais fechadas"_. Corrigido.
5. **Eu citei norma revogada por quatro dias.** A RDC 327/2019 estava em três documentos. Só
   apareceu porque o dono mandou transcrever. **Antes de citar norma: o objeto é o meu tema? está
   em vigor? quais normas ela cita que eu não li?**

### Achados de investigação que não estão em lugar nenhum do código

| achado                                                                                                                                                                                                                                | por que importa                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **O Clerk desta máquina roda em modo `keyless`** — ele criou uma aplicação **temporária** sozinho quando o dev subiu. Chaves em `.clerk/.tmp/keyless.json` (coberto pelo `.gitignore` linha 87), com um `claimUrl` para reivindicá-la | Não há chave do Clerk no `.env`. As 3 contas de teste vivem **nessa app temporária**. Se ela sumir, somem. Para tornar permanente: reivindicar pelo `claimUrl`, ou pôr as chaves reais no `.env` (o script já dá precedência ao `.env`)             |
| **A app de dev tem `password.used_for_first_factor: false`** — medido no `/v1/environment` dela                                                                                                                                       | **Senha não faz login.** O acesso é e-mail + código **`424242`**, porque os e-mails usam o subendereço `+clerk_test@example.com` (recurso do Clerk para instância de development). Provado com sign-in completo na Frontend API: `status: complete` |
| **O driver `@neondatabase/serverless` fala HTTP** e não conecta em Postgres local                                                                                                                                                     | Por isso `lib/db/index.ts` escolhe o driver **pelo hostname da URL**, não por flag. URL malformada assume produção (falha segura). Guarda `banco-usa-driver-certo`, 14 casos                                                                        |
| **Existiam DUAS migrations numeradas 0007** — `0007_add_medico_ordem.sql` está **fora do journal**, e o snapshot 0007 registra `ordem` como já existente, então `db:generate` nunca a regenera                                        | Causava `column medicos.ordem does not exist`. Resolvido com a `0022` idempotente. ⚠️ **A reconciliação do journal continua pendente** — decisão não tomada                                                                                         |
| **O áudio da teleconsulta NÃO é persistido** em lugar nenhum — verificado: sem `put()`, sem blob, sem upload. Só o texto                                                                                                              | Isso é material para o texto do consentimento, e o texto atual já reflete                                                                                                                                                                           |
| **O fluxo de comprovação de renda / medicamento gratuito NÃO existe** — a página é institucional, com zero formulários; `pacientes.rendaFamilia` é texto livre                                                                        | O dono confirmou: **não construir**. Não presuma que existe                                                                                                                                                                                         |
| **Agendamento presencial NÃO existe** — `consultas` não tem campo de modalidade                                                                                                                                                       | Por isso não havia alternativa a oferecer a quem recusa a teleconsulta                                                                                                                                                                              |
| **`components/shared/theme-provider.tsx` usa `forcedTheme="light"`**                                                                                                                                                                  | **O tema escuro nunca se aplica em nenhuma tela.** Catalogado, **não corrigido** — fora do escopo, e o dono não autorizou                                                                                                                           |
| **`app/api/upload-exame/route.ts:77` usa `access: 'public'`**                                                                                                                                                                         | Exame com URL pública lê **sem autenticação**. É o Item 6. Código novo não repete                                                                                                                                                                   |
| **`origin/main` e a branch estão idênticos em commits**                                                                                                                                                                               | Ver §1. Nada foi commitado                                                                                                                                                                                                                          |

### Medições

- Baseline **medida** em 20/08 desmentiu o `AGENTS.md` em **+79 %** (lint) e **+55 %** (Prettier).
- `tsc --noEmit` mediu **0 erros** pela primeira vez, sem `.next` presente — mesmas condições do
  CI. Por isso entrou como portão **absoluto**.
- A auditoria da teleconsulta achou uma **classe** de defeito de BOLA com **7 ocorrências**, com
  **3 controles corretos no mesmo módulo** — o padrão certo era conhecido e não foi aplicado.
- `UrgenciaAnalise` tem **7 valores** no contrato para **3–4** níveis visuais. O mapa 7→4 **não
  está escrito**.
- `parcial` e `completude.nivel` **divergem** no fixture real — por isso `grafoEstaParcial()` lê
  os dois.

---

## §8 — Estado da suíte

**Rodado em 24/08/2026, ao escrever este handoff.** Nenhum número abaixo é copiado.

```
$ pnpm test
 Test Files  8 passed (8)
      Tests  199 passed (199)
   Duration  1.24s
```

| guarda                                      | casos |
| ------------------------------------------- | ----- |
| `hooks-de-escopo`                           | 37    |
| `medicacao-informa-nao-prescreve`           | 46    |
| `anamnese-e-serie-nao-sobrescrita`          | 27    |
| `contrato-da-ia-e-a-unica-fonte`            | 22    |
| `consentimento-governa-a-ia-nao-a-consulta` | 20    |
| `sem-relay-de-terceiro-na-teleconsulta`     | 17    |
| `autorizacao-tem-escopo-de-objeto`          | 16    |
| `banco-usa-driver-certo`                    | 14    |

```
$ node scripts/conferir-baseline.mjs
  ✓ erros de lint: 210 (teto 210)
  ✓ warnings de lint: 130 (teto 130)
  ✓ arquivos fora do Prettier: 348 (teto 348)
  ✓ erros de type-check: 0 (teto 0)
  verde — nada piorou em relação à baseline declarada.
```

```
$ pnpm build   →  exit 0
```

**Nenhum teste instável observado** nas ~15 execuções desta sessão. Duração sempre ~1 s.

⚠️ **O que NÃO foi rodado nesta sessão:**

- `pnpm lint` **completo sem o portão** — o portão o executa e compara; o número bruto (210 erros)
  vem de lá.
- **Nenhum teste de navegador, e2e ou de acessibilidade.** Não existem no projeto.
- **O CI nunca rodou de verdade** — `.github/workflows/ci.yml` está escrito e **não commitado**.
  O gate está injetado nos **dois** workflows, mas nada disso executou no GitHub ainda.
- A tela foi verificada por **`curl` + grep no HTML** e pelo relato visual do dono, não por
  ferramenta de teste de UI.

---

## §9 — Por onde a próxima sessão começa

1. **Leia** `CLAUDE.md` → este handoff → a **Fila de execução** no rodapé do
   [`03`](03-CHECKLIST-MESTRE.md). Nunca comece pelo código.
2. **Item 7 da fila: Sprint 5** — [`sprints/SPRINT-5-conduta-prescricao-e-titulacao.md`](sprints/SPRINT-5-conduta-prescricao-e-titulacao.md).
   13 entregáveis. **Nada bloqueia o início.**
   - Leia antes a **ADR-0005 D-03 retificada** — as duas versões estão lá, leia as duas.
   - Os schemas já existem: `medicamentos` (tem `cbdMgPorGota`), `dosagens`, `ajustesDosagem`.
   - ⚠️ **Antes do entregável 10, transcreva a RDC 38/2013** — define "doença debilitante grave",
     que é a régua do `CAN-05`.
3. **Itens 8, 9 e 10** — o que ficou da Sprint 4 (E3, E7, E8). Diagnóstico com `caminho:linha` nos
   Itens 8, 9 e 10 do [`04`](04-LISTA-DE-AFAZERES.md); decisões na ADR-0011.
   - **Antes do item 10, escreva a ADR do `DO-42`** com o mapa 7→4 (ver §6).
4. **Item 11** — a aba da análise assistida na teleconsulta (ADR-0010). ⚠️ **Pergunte ao dono o
   rótulo e a posição da aba antes de implementar.**

🔴 **Ao terminar qualquer item:** `03` (item + **fila**), `04` (o que foi corrigido **e o que
ficou**), `docs/adr/` (retificar sem apagar), `docs/sprints/` (o que ficou de fora, com motivo). E
**toda decisão do dono vira `DO-nn` no `02`, com a frase literal dele** — foi exatamente isso que
faltou nesta sessão até ele cobrar.

**O teste que diz se este handoff está bom:** uma sessão nova, sem histórico, retoma lendo só o
disco? Se a resposta depender de _"a gente tinha combinado que…"_, falta seção aqui.
