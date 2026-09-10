# CLAUDE.md

Siga primeiro `AGENTS.md`. Este arquivo define apenas o modo operacional do Claude neste repositorio.

@AGENTS.md

<!-- O import acima existe porque a doc oficial e explicita: "Claude Code reads CLAUDE.md,
     not AGENTS.md". Sem ele, o contrato do projeto NAO entrava no contexto da sessao —
     confirmado empiricamente em 19/08/2026. Fonte: code.claude.com/docs/en/memory -->

## Modo de trabalho

- Seja conciso, tecnico e critico. Nao concorde por padrao; teste o ponto fraco da ideia antes de endossar.
- Antes de editar, rode exploracao suficiente: `git status --short --branch`, `rg`/leitura dos arquivos afetados e confirmacao dos padroes existentes.
- A worktree pode estar suja. Nunca reverta, formate ou reescreva mudancas que voce nao fez sem pedido explicito.
- Prefira mudancas pequenas e localizadas. Nao corrija dividas tecnicas fora do escopo apenas porque apareceram durante a tarefa.

## Docs e ferramentas

- Use Context7 quando comportamento atual de biblioteca importar, especialmente Next.js, React, Clerk, Drizzle, Tailwind, shadcn/ui, Inngest ou SDKs externos.
- Use `rg` para busca e `apply_patch` para edicoes focadas. Evite scripts de rewrite salvo quando a mudanca for mecanica e bem delimitada.
- Nao use comandos destrutivos (`git reset --hard`, `git checkout --`, remocao recursiva) sem autorizacao explicita.
- Se precisar rodar checks, prefira comandos especificos antes de comandos globais caros.

## Padrao de implementacao

- Fluxo seguro para mutation: autenticar/autorizar, validar com Zod, checar escopo por role, executar DB, registrar auditoria quando sensivel, disparar notificacao/revalidacao quando necessario.
- Em React 19, evite componentes declarados dentro do render, `setState` sincronico em effects e suppressions de hooks. Corrija a causa ou isole a interatividade.
- Em Server Components, mantenha `metadata` no arquivo server e extraia interatividade para componente client separado.
- Em Drizzle, prefira tipos inferidos (`$inferInsert`, `$inferSelect`) e query builder. Use `sql` cru com parametros, nunca string concatenada.
- Em arquivos de env/docs, trate `lib/env.ts`, `.env.example`, `package.json` e codigo de integracao como fontes de verdade quando houver divergencia.

## Validacao e entrega

- Para mudancas nestes arquivos de regras, valide com `pnpm format:check AGENTS.md CLAUDE.md` quando o Prettier aceitar os paths.
- Para mudancas de codigo, rode no minimo `pnpm lint` quando plausivel; rode `pnpm build` quando tocar rotas, schemas, env, auth, Next config ou fluxo server.
- Se um check falhar por baseline existente, reporte isso claramente e cite exemplos; nao esconda a falha.
- Antes de responder, confira `git diff -- AGENTS.md CLAUDE.md` ou o diff dos arquivos tocados para garantir que o escopo foi respeitado.

## Documentação deste projeto — índice

**Este bloco é índice, não conteúdo** — abra a fonte, não parafraseie o resumo.

| abra quando                                                                                                        | arquivo                                                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 🔴 **sessão nova** — onde a anterior parou e o que **não** fazer                                                   | `docs/05-HANDOFF-SESSAO.md`                                                                 |
| 🔴 **toda sessão** — o que falta, por prioridade, e a fila oficial                                                 | `docs/03-CHECKLIST-MESTRE.md`                                                               |
| 🔴 **vai escrever código ou UI** — cores, animações, componentes e convenções **medidos**                          | `docs/06-PADROES-DO-CODIGO.md`                                                              |
| vai executar um item — traz diagnóstico e `caminho:linha`                                                          | `docs/04-LISTA-DE-AFAZERES.md`                                                              |
| precisa saber o que o produto faz: atores, papéis, entidades                                                       | `docs/01-REGRA-DE-NEGOCIO.md`                                                               |
| vai citar regra externa (ANVISA, CFM, RDC, LGPD) — **cite o ID, nunca a paráfrase**                                | `docs/02-CATALOGO-DE-REGRAS.md`                                                             |
| vai decidir algo, ou propor algo que talvez já tenha sido **rejeitado**                                            | `docs/adr/`                                                                                 |
| quer o escopo de uma fatia: entregáveis, aceite e o que fica fora                                                  | `docs/sprints/`                                                                             |
| 🔴 **ANTES DE CADA SPRINT** (`DO-32`) — as decisões abertas de IA clínica e a regra de desenho que sai delas       | `docs/decisoes-visuais/ia-clinica-e-anvisa.html` + o `LEIA-ANTES-DE-CADA-SPRINT.md` ao lado |
| 🔴 **vai construir tela nova de IA clínica** — a lógica de construção do VidAI (P1–P7) e o mapa de tradução visual | `docs/09-FRONTEND-VIDAI-MEDIDO.md`                                                          |
| 🔴 **vai justificar uma decisão** — princípios A–P e fases 0–15                                                    | `docs/PRINCIPIOS.md`                                                                        |
| precisa da teoria de um tópico — **abra só o ramo**, nunca a árvore toda                                           | `docs/arvore-do-conhecimento/00-RAIZ.md`                                                    |
| vai escrever um teste que impeça uma classe de erro de voltar                                                      | `docs/TECNICA-DOS-GUARDAS.md`                                                               |
| 🔴 **duas instruções divergem**, ou não sabe por que uma skill não apareceu                                        | `.claude/rules/precedencia-das-instrucoes.md`                                               |
| 🔴 **vai mexer em cadastro, handoff ou ANVISA** — os 5 fluxos do dono e o estado medido de cada passo              | `docs/11-OS-CINCO-FLUXOS.md`                                                                |
| 🔴 **o deploy não chegou a produção** — o plano curto/definitivo e o que está implementado                         | `docs/PLANO-DE-CORRECAO-DO-DEPLOY.md`                                                       |
| decisão de infraestrutura e deploy (DT-001 a DT-010)                                                               | `docs/DECISOES_TECNICAS.md` — **não migrar, não apagar**                                    |
| 🔴 **vai escrever ou revisar cartão do Trello** — anatomia obrigatória e o formato que o Trello aceita             | `docs/10-PADRAO-DO-KANBAN.md`                                                               |
| o mapa completo das docs                                                                                           | `docs/00-LEIA-PRIMEIRO.md`                                                                  |

### Cinco proibições

1. 🔴 **Segurança e LGPD são requisito, não etapa final.** Todo item novo responde, **antes** de
   existir: quem pode ler · quanto tempo fica · o acesso é auditado. Arquivo sensível vai para
   store **privado**, entregue com autenticação. Achado em código existente se **cataloga com o
   perigo medido**, não se corrige no meio da tarefa. Procedimento em
   `.claude/rules/seguranca-lgpd.md`.
2. 🔴 **Nenhuma saída de modelo chega ao prontuário sem ato humano registrado** (`DO-29`,
   `DO-33`). Toda tela que mostra sugestão de IA: rotula a **origem** de cada achado, tem passo
   humano **obrigatório** antes do registro, e grava **quem** decidiu — inclusive quando decide
   diferente. Sem caminho de um clique entre sugestão e prescrição. É o que sustenta que o
   sistema **informa** em vez de **dirigir** — distinção que a ANVISA RDC 657/2022 observa
   (`ANV-01`…`ANV-04`). Desenho e teste em `docs/decisoes-visuais/`.
3. **Não inventar identidade visual.** Reuse token, componente e animação existentes: zero cor
   nova, zero animação nova, sem `<Table>` (0 usos no produto) e sem `framer-motion` fora de
   teleconsulta. Medido em `docs/06-PADROES-DO-CODIGO.md`.
4. **Não sobrescrever histórico clínico nem registro de auditoria.** Alteração preserva o
   anterior, a data e o motivo. Soft delete em entidade clínica; blob não se remove se o
   histórico precisar existir.
5. **Não presumir regra de negócio.** Se não está em `docs/01`, no `AGENTS.md` ou no código,
   **pergunte** — regra presumida é pior que regra ausente, porque quem lê acredita.

### Guardas ativos

Runner: **Vitest 4** desde a Sprint 0 (20/08/2026). `pnpm test` roda todos.

🔴 **Os números abaixo foram MEDIDOS com `pnpm test`, não estimados.** Última medição:
**10/09/2026 — 625 casos em 19 guardas.** (Eram 199 em 8 na medição de 24/08, quando três
estavam errados — ver a retratação ao pé da tabela.)

| guarda                                         | quebra o build se…                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | como rodar                           |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | --------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `hooks-de-escopo`                              | um hook de bloqueio parar de bloquear o que deve, **ou voltar a acusar inocente** — **37 casos**, incluindo **4** regressões de falsa acusação, 2 provas do mecanismo de autorização e a **paridade** com o guarda em bash                                                                                                                                                                                                                                                                         | `pnpm test`                          |
| `autorizacao-tem-escopo-de-objeto`             | uma action ou handler de teleconsulta usar `salaId`/`roomId`/`pacienteId` **do cliente** sem provar escopo de objeto (OWASP API1/BOLA) — **16 casos**, fatiados por função                                                                                                                                                                                                                                                                                                                         | `pnpm test`                          |
| `sem-relay-de-terceiro-na-teleconsulta`        | a mídia da consulta voltar a atravessar relay gratuito de terceiro, ou credencial de ICE voltar ao código — **17 casos**, com 4 de controle contra falsa acusação                                                                                                                                                                                                                                                                                                                                  | `pnpm test`                          |
| `consentimento-governa-a-ia-nao-a-consulta`    | a transcrição rodar sem o aceite **dos dois** lados, ou a **consulta** passar a ser bloqueada pelo consentimento (o que torna o aceite nulo, LGPD art. 8º §3º) — **20 casos**                                                                                                                                                                                                                                                                                                                      | `pnpm test`                          |
| `anamnese-e-serie-nao-sobrescrita`             | uma medida de desfecho for sobrescrita em vez de inserida, uma action perder escopo de objeto, a faixa plausível sair de um dos caminhos de entrada, ou a tela voltar a usar `<Table>` — **27 casos**                                                                                                                                                                                                                                                                                              | `pnpm test`                          |
| `contrato-da-ia-e-a-unica-fonte`               | alguém redeclarar tipo do grafo fora de `lib/ia-clinica/contrato.ts`, exibir `probabilidade` como número (ADR-0006), ou o fixture divergir do contrato — **22 casos** (era 16 antes da correção de duas pontas; medido em 25/08)                                                                                                                                                                                                                                                                   | `pnpm test`                          |
| `banco-usa-driver-certo`                       | URL de Neon resolver para o driver TCP (quebraria em produção, só em runtime), ou a decisão voltar a morar em módulo com efeito colateral — **14 casos**, dos quais 5 impedem o guarda de deixar de rodar                                                                                                                                                                                                                                                                                          | `pnpm test`                          |
| `medicacao-informa-nao-prescreve`              | um campo de **dose** entrar no contrato ou no fixture, um clique ligar sugestão a prescrição, a procedência ficar opcional, o limite de 3 sair da constante, ou a evidência da tela de decisão deixar de ser o **mesmo** componente do painel — **46 casos**, dos quais 18 são o detector de posologia com controle contra falsa acusação                                                                                                                                                          | `pnpm test`                          |
| `divergencia-alimenta-o-rag-sem-ingerir`       | a divergência do médico deixar de exigir ato humano, ou a ingestão no RAG acontecer sem o `GAP-16` resolvido — **47 casos**                                                                                                                                                                                                                                                                                                                                                                        | `pnpm test`                          |
| `a-conduta-avisa-e-nao-decide`                 | a tela da conduta **derivar** o teor de THC em vez de o médico informá-lo, ou o aviso de troca de receituário virar bloqueio (`DO-46`, `DO-47`) — **76 casos**                                                                                                                                                                                                                                                                                                                                     | `pnpm test`                          |
| `chatpro-nao-confia-no-que-chega`              | segredo comparado com `===`, telefone/e-mail em log, token do link guardado cru, uso único fora do `UPDATE`, ou a rota do link passar a devolver dado clínico — **75 casos**, com controles contra falsa acusação                                                                                                                                                                                                                                                                                  | `pnpm test`                          |
| `chatpro-processa-uma-vez-e-nao-bloqueia`      | o claim de evento perder `FOR UPDATE SKIP LOCKED`, uma falha morrer em `processando` sem voltar à fila, a tradução de UUID virar pré-requisito do processamento, ou conteúdo de mensagem entrar na projeção da conversa — **20 casos**                                                                                                                                                                                                                                                             | `pnpm test`                          |
| `cadastro-por-link-abre-sem-conta`             | `/cadastro` ou `/api/chatpro` saírem das rotas públicas do middleware (o paciente cairia no login para poder criar conta, e o ChatPro receberia redirect), a ficha nascer antes da sessão, o papel vir do formulário, ou "já faz tratamento" perder o estado **não informado** — **32 casos**, com controle que impede "resolver" liberando `/medico`                                                                                                                                              | `pnpm test`                          |
| `handoff-do-parceiro-e-assinado-e-idempotente` | a assinatura deixar de cobrir corpo ou id, a janela de 300 s sumir, a rota ler `json()` antes de verificar, o corpo voltar a sobrescrever o id do evento, o índice do evento virar `unique` (reentrega passaria a dar 500), `/api/parceiros` sair das rotas públicas, a URL de retorno passar a ser conferida por PREFIXO em vez de origem (redirecionamento aberto), ou pendência de documento virar bloqueio — **46 casos**. A idempotência aqui decide **gateway e desconto** do lado da Greens | `pnpm test`                          |
| `o-aviso-ao-parceiro-nao-se-perde`             | enfileirar um aviso voltar a **lançar** (derrubaria a assinatura da receita), o envio virar `fetch` direto (perderia o aviso com a Greens fora do ar), o id do evento passar a ser gerado a cada retry (cada reenvio viraria fato novo lá), o índice do fato virar comum, ou dado clínico entrar no payload — **19 casos**                                                                                                                                                                         | `pnpm test`                          |
| `a-triagem-roteia-e-nao-julga`                 | a resposta do paciente deixar de vencer a base, a interpretação voltar a exigir palavra exata (**"Não, ainda não" deixaria de ser reconhecido**), rascunho passar a contar como receita, ou a tela dizer que a receita de alguém é "inválida" — **44 casos**                                                                                                                                                                                                                                       | `pnpm test`                          |
| `duas-contas-de-chatpro-nao-se-misturam`       | as duas contas passarem a usar o mesmo segredo, a comparação ganhar `break` (o tempo diria **qual** conta casou), a conta sair da chave do dicionário de UUIDs (a tradução erraria **em silêncio**), a conta passar a vir da URL em vez do segredo, ou ser identificada e **não repassada** — **20 casos**                                                                                                                                                                                         | `pnpm test`                          |
| `o-deploy-entrega-o-que-buildou`               | o `build` voltar a perdoar a própria falha com `                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                      | true`, o deploy voltar a `pm2 restart … |     | pm2 start …`(que **reusa o caminho antigo** e faz produção servir build velho em silêncio), o ambiente ser preservado DEPOIS do`pm2 delete` (o site cairia inteiro em 500), ou o portão que confere produção virar aviso — **21 casos**, provados por **9 sabotagens**, uma das quais achou um defeito no próprio guarda | `pnpm test` |
| portão de baseline                             | lint, Prettier ou type-check **piorarem** em relação a `baseline.json`. Não exige zero — exige não piorar                                                                                                                                                                                                                                                                                                                                                                                          | `node scripts/conferir-baseline.mjs` |

Os **dois** guardas dos hooks ficam (`DO-19`): o `.sh` roda **sem `node_modules`**, o `.ts` roda
com o runner. Para que não divirjam em silêncio, o `.ts` tem um caso de **paridade** que fica
vermelho nomeando o caso que faltar. **Caso novo entra nos dois.**

#### 🔴 RETRATAÇÃO, 24/08/2026 — três contagens desta tabela estavam erradas

Ao medir com `pnpm test` para acrescentar as três linhas novas, os números não bateram:

| guarda                                  | eu escrevi | é      |
| --------------------------------------- | ---------- | ------ |
| `autorizacao-tem-escopo-de-objeto`      | 19         | **16** |
| `sem-relay-de-terceiro-na-teleconsulta` | 13         | **17** |
| `anamnese-e-serie-nao-sobrescrita`      | 23         | **27** |

**Não houve perda de cobertura:** os arquivos nunca foram commitados, então não existe versão
anterior com mais casos — o `git log` deles é vazio. O que houve foi eu **contar casos planejados
em vez de casos executados**, e escrever a estimativa como se fosse medição. É pior que o erro
aritmético: um `it.each` com 5 entradas conta 5, e quem lê "19" acredita que 19 asserções rodaram.

**A regra que sai daí:** contagem de guarda se copia da saída do runner, nunca da leitura do
arquivo. E o número no `CLAUDE.md` se confere junto com o portão, não de memória.

#### 🔴 SEGUNDA RETRATAÇÃO, 24/08/2026 — um guarda existia e deixou passar

Um fixture novo entrou com **cinco** valores que o contrato não declara — `relato_paciente`,
`medida_registrada`, `lab_importado`, `urgencia: 'rotina'` e um `sindrome.status` que nem existe
como campo. A tela de preview **caiu inteira**: `PROVENIENCIA[valor]` deu `undefined` e o React
estourou em _"can't access property 'icone'"_.

O `contrato-da-ia-e-a-unica-fonte` estava verde. Dois defeitos, os dois de classe:

1. Ele checava `toBeTruthy()` — que o campo **exista**, não que o valor seja **válido**.
   `'relato_paciente'` é truthy, e a asserção não dizia nada.
2. Ele lia **um** fixture, pelo nome. Fixture novo nunca era verificado.

O TypeScript não cobriu porque o import de JSON usa `as never` — decisão que evita escrever tipos
de fixture à mão e que, sem ninguém notar, transferiu toda a responsabilidade para o guarda.

**Corrigido como guarda de duas pontas:** extrai os valores válidos do **próprio contrato**
(nunca de uma lista paralela, que é o que desatualiza e aprova o errado) e varre **todos** os
`.json`. Mais um caso de **cobertura**, que fica vermelho nomeando qualquer tipo de união novo do
contrato que não esteja sendo varrido. Provado com **9 sabotagens**, incluindo os quatro valores
que passavam verdes antes.

⚠️ **E os componentes passaram a denunciar em vez de cair.** Valor fora do contrato agora
renderiza _"origem desconhecida: X"_ em vermelho. Cair para um padrão silencioso teria sido pior
que quebrar: a tela afirmaria uma origem que ninguém declarou, e origem de achado é **regra**
aqui — é o que separa sugestão de fato.

### Ao compactar o contexto, preserve isto

A lista de arquivos modificados · os comandos que rodaram e o **resultado real** · as
decisões desta sessão que **ainda não viraram ADR** · o que foi retratado.

Descartável: output bruto de ferramenta, listagem de diretório, conteúdo de arquivo já
lido.

## Git, conflitos e o que os hooks bloqueiam

- **`main` É produção.** Push em `main` dispara o deploy (`.github/workflows/deploy.yml`),
  que aplica migration no banco de produção sem rollback. Trabalho em `feat/*`.
- **Conflito de merge/rebase:** nunca `--abort` sem autorização (perde a resolução já
  feita), nunca resolver descartando o lado do outro sem ler, nunca resolver em `main`
  sem o dono. Em dúvida, pare e mostre os dois lados.
- **Dois hooks `PreToolUse` bloqueiam de fato** (`.claude/hooks/`): `git-perigoso.py`
  (comando git destrutivo, push em main, formatação global, remoção recursiva) e
  `escopo-autorizado.py` (escrita nas áreas clínicas em produção, em `db/migrations/`,
  nas libs de receituário/DocuSign/teleconsulta/alertas, no pipeline e no `AGENTS.md`).
  **Leitura nunca é bloqueada.**
- **Autorização é por escrito**, em `.claude/autorizacoes.txt`, com quem autorizou,
  quando e por quê. Bloqueio não se contorna editando o hook — se ele acusou um inocente,
  isso é defeito **do hook**: conserte a granularidade e acrescente o caso ao guarda.

## Fundamentação técnica obrigatória

**Nenhuma decisão, diagnóstico ou implementação entra sem fundamento citado.** Vale
para proposta em texto, não só para código.

**Obrigatório pesquisar antes** quando: escolher entre duas técnicas · tocar
auth/autorização/dado pessoal · usar recurso que não se usa todo dia · **replicar
solução que já existe no próprio código** · o problema tem nome próprio na literatura.

**Ordem de autoridade:** especificação/doc oficial (**é a única que decide**) >
padrão de segurança (OWASP Top 10, API Top 10) > normativa do domínio (ANVISA, CFM,
LGPD) > autor canônico (Fowler, Evans, Ousterhout, Nygard) > pesquisa acadêmica > blog
de engenharia > Stack Overflow (só para descobrir o **nome** do problema).

- 🔴 **Não inventar fundamento.** Se a pesquisa não achou nada conclusivo, dizer isso e
  decidir com o que há. **Citar fonte que não se leu é pior que não citar** — separe
  explicitamente o que foi lido do que só foi localizado.
- 🔴 **UMA fonte não fecha a questão. Esgote as fontes do domínio antes de decidir.**
  Decisão do dono em 20/08/2026: _"devemos buscar em várias bases de dados confiáveis em várias
  fontes para que isso justamente seja evitado, já que nós devemos ter o máximo de cuidado com o
  que construímos"_.

  **O incidente que originou esta regra:** em 20/08 eu desenhei o consentimento da teleconsulta
  com base **só na LGPD**, concluí que a consulta não precisava de aceite (art. 11, II, "f") e
  argumentei contra a decisão do dono, que queria bloquear. Ao transcrever a **CFM 2.314/2022**
  depois, o Art. 15 dizia o contrário: o paciente _"deverá autorizar o atendimento por
  telemedicina"_. **Base legal dispensa consentimento como fundamento de tratamento de dado; não
  dispensa norma ética que exige autorização para o ato.** As duas valem, e eu tinha lido uma.

  **Antes de decidir em matéria regulada, a varredura mínima é:**

  | eixo               | onde olhar                                                         |
  | ------------------ | ------------------------------------------------------------------ |
  | dado pessoal       | LGPD (e a base legal **específica** do art. 11 para dado sensível) |
  | ato médico         | **CFM** — resolução do tema **e** o Código de Ética Médica         |
  | produto e software | **ANVISA** — inclusive se o software é **dispositivo médico**      |
  | quem pode fazer    | Lei do Ato Médico (12.842/2013)                                    |

  ⚠️ **Norma citada é norma que pode estar errada de assunto.** O `02` atribuía teleconsulta à
  CFM **2.299/2021**; o objeto real dela é _"emissão de documentos médicos eletrônicos"_. A
  telemedicina é a **2.314/2022**. Conferir o **objeto** da norma antes de citá-la como
  fundamento — a ementa está na primeira página, e ler leva trinta segundos.

  🔴 **E conferir se ela ainda está EM VIGOR.** Segundo caso da mesma família, 24/08/2026: o
  catálogo, o plano de sprints e a Sprint 5 citavam a **RDC 327/2019** como a norma de produtos de
  Cannabis. Ela foi **revogada** pela **RDC 1.015/2026, Art. 76** — e só apareceu porque o dono
  mandou transcrever (`DO-45`). Norma revogada é pior que norma de assunto errado: ela **parece**
  certa, o texto até existe, e quem lê não desconfia.

  **Portanto, três perguntas antes de citar, não uma:** o **objeto** é o meu tema? está **em
  vigor**? **quais normas ela cita** que eu ainda não li? A terceira também rendeu: a RDC
  1.015/2026 aponta para a **RDC 38/2013** ("doença debilitante grave") e a RDC 1.000/2025 para a
  **RDC 873/2024** (institui o SNCR) — as duas entraram no `04` como pendência.

- Toda decisão cita também o **princípio (A–P)** e a **fase (0–15)** de
  `docs/PRINCIPIOS.md`. Princípio diz de que família é o argumento; a fonte diz se ele
  está certo. As duas coisas, não uma.
- Teoria de um tópico: abrir **só o ramo relevante** de `docs/arvore-do-conhecimento/`,
  nunca a árvore inteira.

## Dúvida de negócio se pergunta; dúvida técnica se pesquisa

🔴 **Decisão do dono em 20/08/2026 (`DO-17`).** Ao travar numa dúvida, classifique antes de agir:

| tipo de dúvida                                                                              | o que fazer                                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **regra de negócio** — quem pode o quê, qual fluxo, o que a norma exige, o que fica de fora | **perguntar ao dono.** Nunca presumir, nunca inferir do código                                                          |
| **programação e design** — qual técnica, qual estrutura, qual padrão de tela                | **rodada de pesquisa** e **apresentar opções comparadas**, com o custo de cada uma. Recomendar uma, não decidir sozinho |

Opção apresentada sem fonte é palpite. Opção apresentada sem alternativa é decisão disfarçada
de pergunta — a mesma falha que uma ADR sem rejeitado.

## Não reformatar arquivo de produção que você não precisa mudar

🔴 **`DO-35`, 20/08/2026.** Palavras do dono: _"não faça isso, tem que manter o mesmo padrão de
produção, alterar essas coisas é mudança de padrão já existente e pode dar problema para mim"_.

**O incidente:** rodei `prettier --write` em arquivos inteiros de produção para satisfazer o
portão. Resultado em `GlobalTeleconsultaHost.tsx`: **+755 / −644** num arquivo de 690 linhas,
quando o conteúdo real mudava **~40**. O `prettier-plugin-tailwindcss` reordena classe — o CSS
final é idêntico, e por isso é fácil achar inofensivo. Não é: o diff fica ilegível, o review
vira impossível, e um merge conflitante chega com 700 linhas.

**Como fazer, em arquivo de produção que já existe:**

1. Mudar **só as linhas do conteúdo**. Não rodar formatador no arquivo inteiro.
2. Se o portão do Prettier acusar, o arquivo **já estava fora dele antes** — e continuar fora não
   é piorar. Conferir com `git diff --numstat`: se as deleções superam de longe o conteúdo
   mudado, é ruído de formatação.
3. Formatar arquivo inteiro **só quando o arquivo é novo**, ou quando o dono pedir a limpeza como
   tarefa própria — em commit próprio, nunca junto de mudança de comportamento.

⚠️ Um teto de baseline que **caiu** por causa de formatação indevida deve **voltar a subir** ao
desfazer. Isso não é afrouxar o portão: é restaurar o estado de produção. O motivo fica escrito
em `baseline.json`.

## Documento visual só quando pedido

⛔ **`DO-30`, 20/08/2026:** _"não crie documentos como esse ao menos que eu peça"_. Não criar
página, artifact ou relatório desenhado por iniciativa própria — responder no terminal é o
padrão. O que foi pedido fica em `docs/decisoes-visuais/`, com um `LEIA-ANTES` explicando quando
abrir.

🔴 **`DO-31`:** em compensação, **toda base pesquisada vira regra de negócio no mesmo movimento**
— ID citável no `02`, com o artigo e o texto. Pesquisa que não vira regra se perde, e a próxima
sessão repesquisa ou, pior, decide sem ela.

## Escopo — não mexer fora dele

**O escopo é o que foi pedido, nem mais nem menos.** Dívida técnica que aparece durante
a tarefa **não** se corrige de passagem.

Ao encontrar algo fora do escopo, nesta ordem:

1. **Catalogar** em `docs/03-CHECKLIST-MESTRE.md`, seção _achados catalogados_
2. **Medir o perigo de mexer**: o que quebra, quantos arquivos toca, se está em produção,
   se existe teste que prove o antes e o depois
3. **Pedir autorização**, com fundamentação técnica e o custo de mexer × o custo de deixar
4. **Só então** mexer — e nunca no mesmo commit da tarefa original

⚠️ Isto vale inclusive para "melhorar" algo que uma ADR **rejeitou por escopo**. Antes
de refatorar, procurar a decisão: `rg -l "rejeitado" docs/adr/ docs/DECISOES_TECNICAS.md`.

⚠️ Esta regra é **advisory** — o `CLAUDE.md` não é camada de bloqueio. O que garante é hook
`PreToolUse`, e há dois ativos (ver a seção de git abaixo). Fora do que eles cobrem, a
responsabilidade é de quem edita.

## Os documentos vivos ficam sempre atualizados

🔴 **Decisão do dono em 20/08/2026:** _"sempre lembrar de atualizar após as implementações as
ADR, CHECKLIST, AFAZERES E SPRINTS"_. **Implementação não está terminada enquanto os cinco
abaixo não refletirem o que existe no disco.** Atualizar depois é não atualizar: a próxima
sessão lê o documento, não a sua memória.

| documento                      | quando se escreve                                | **e SEMPRE ao terminar de implementar**                                                    |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `docs/03-CHECKLIST-MESTRE.md`  | ao descobrir                                     | item concluído **e a fila** atualizados no MESMO commit                                    |
| `docs/04-LISTA-DE-AFAZERES.md` | ao diagnosticar — com `caminho/arquivo.ts:linha` | marcar o que foi corrigido, e **o que ficou**                                              |
| `docs/adr/`                    | **antes** de implementar                         | retificar com o que a implementação ensinou; se a decisão mudou, **as duas versões ficam** |
| `docs/sprints/`                | ao planejar a fatia                              | marcar entregável e critério de aceite, com **o que ficou de fora e por quê**              |
| `docs/05-HANDOFF-SESSAO.md`    | ao fim de sessão longa                           | via `/metodo-handoff` — só roda se o dono chamar                                           |

### O que "atualizado" quer dizer, na prática

- **Número que mudou, muda no documento.** "37 casos" que viraram 53 e seguem escritos como 37
  fazem a doc mentir mais que a ausência de doc.
- **Decisão revertida não se apaga: se retifica.** As versões anteriores ficam, com o motivo da
  mudança. O caminho ensina mais que o destino — ver ADR-0007 D-03, que mudou duas vezes.
- **O que ficou de fora entra escrito**, com o motivo. Entregável silenciosamente não feito é o
  que faz alguém planejar em cima de trabalho que não existe.
- **Achado novo durante a implementação vira item**, mesmo que não seja corrigido — e
  especialmente quando não é.

**O teste que diz se está bom:** uma sessão nova, sem histórico, consegue retomar lendo
só o disco? Se a resposta depende de _"a gente tinha combinado que…"_, escreva antes de
continuar.

🔴 **Sessão nova começa por:** handoff → checklist → o item da vez. Nunca pelo código.

## Todo bug vira teste, e todo teste que importa é guarda

- **O teste nasce vermelho antes da correção.** Teste que nunca foi visto falhar não
  prova nada — mostrar a saída vermelha, não afirmar que estava vermelha.
- **Corrija a classe, não o caso.** Ver [a técnica](docs/TECNICA-DOS-GUARDAS.md):
  derive do código (não liste), fatie na granularidade do defeito, teste de vacuidade,
  e **prove vermelho por sabotagem**. Guarda que passa na sabotagem é guarda defeituoso.
- **Bug que chegou a um ambiente compartilhado vira teste ANTES de ser corrigido.**
- **Reportar o que aconteceu, não o que se esperava.** Falhou → mostrar a saída. Passo
  pulado → dizer qual e por quê. Correção que não funcionou → **retratar por escrito**.
- Nunca dizer que lint/build/teste está verde sem ter rodado. Estado conhecido:
  `pnpm lint` e `pnpm format:check` falham por baseline — reportar separado das próprias
  mudanças.

**O seed é instrumento de diagnóstico, não só de dado:** um cenário por classe de
defeito · um cenário composto · **um CONTROLE limpo**. Sem o controle, verde não
significa nada. Se o cenário que isola X não acusa X, a regra não existe.

## Deploy: como se sobe, se observa e se diagnostica

🔴 **Método fixado em 10/09/2026**, depois de **quatro** deploys seguidos que falharam por
motivos diferentes — e o primeiro deles passou **verde** com o banco desatualizado.

### 1. Segredo vai do arquivo direto para o GitHub, nunca pelo chat

```bash
openssl rand -hex 32 > ~/.nome-do-segredo && chmod 600 ~/.nome-do-segredo
tr -d '\n' < ~/.nome-do-segredo | gh secret set NOME_DA_VARIAVEL --repo Org/repo
```

**Por que assim:** o valor não passa por clipboard, navegador nem conversa. E `tr -d '\n'`
não é detalhe — sem ele, o segredo cadastrado tem uma quebra de linha a mais que o do outro
lado, e o HMAC não bate.

**Conferência entre dois sistemas, sem revelar nada:**

```bash
tr -d '\n' < ~/.arquivo | sha256sum | cut -c1-12
```

⚠️ **A fórmula precisa ser a MESMA nos dois lados.** Em 10/09 comparamos duas impressões
que pareciam divergir e eram do mesmo valor: uma calculada sobre os 64 hex, outra sobre os
65 bytes do arquivo com `\n`. Impressão calculada de jeito diferente não prova nada.

### 2. Monitorar o deploy — e o site junto

```bash
gh run list --limit 3 --json databaseId,status,conclusion,workflowName,displayTitle
gh run view <id> --json jobs        # passo a passo
gh run view <id> --log | grep -iE "err:|error|ELIFECYCLE"
```

🔴 **Verde não é prova.** Um passo pode rodar, falhar por dentro e ser marcado ✓ — foi o
que aconteceu no deploy do PR #36: `drizzle-kit: not found` e o script seguiu. **Ler o log
do passo, não só o ícone.**

E acompanhar o **site** durante o deploy, não só o workflow: `curl -o /dev/null -w "%{http_code}"`
a cada rodada diz se o restart derrubou algo.

### 3. Diagnosticar: correlacionar, não adivinhar

**A ordem que funcionou**, nesta sequência:

| #   | passo                                   | o que evita                  |
| --- | --------------------------------------- | ---------------------------- |
| 1   | ler o **log do passo**, não a conclusão | o ✓ que esconde erro         |
| 2   | **reproduzir** num shell isolado        | corrigir o que não é a causa |
| 3   | **pesquisar** o erro com o nome dele    | resolver por tentativa       |
| 4   | corrigir **e** escrever o guarda        | a volta silenciosa           |

⚠️ **Reproduzir antes de corrigir.** O `DATABASE_URL ausente` do deploy #39 tinha o secret
cadastrado e o `source` no lugar. Só reproduzindo num `bash -c` isolado ficou claro que a
URL do Neon (`?sslmode=require&channel_binding=require`) **vira string vazia** ao ser
carregada sem aspas — o `&` manda para background e corta o resto.

### 4. As quatro falhas, e o que cada uma ensinou

| deploy | falhou com                                   | a lição                                                               |
| ------ | -------------------------------------------- | --------------------------------------------------------------------- |
| #36    | `drizzle-kit: not found`, e passou **verde** | script remoto sem `set -e` transforma falha em silêncio               |
| #37    | `Sem .env na raiz nem no standalone`         | a guarda revelou que **não havia** `.env` — o app vivia do `dump.pm2` |
| #38    | `DATABASE_URL ausente`                       | escrever o `.env` não basta: arquivo **não vira ambiente** sozinho    |
| #39    | `DATABASE_URL ausente` de novo               | `source` **interpreta**; um `.env` é dado, não código                 |

🔴 **As quatro eram silenciosas.** Nenhuma quebrou o site — o que as tornou difíceis é
exatamente isso: o sistema continuava de pé afirmando que estava atualizado.

### 5. O que todo script de deploy precisa ter

- **`set -e`** no script remoto — sem ele, falha vira silêncio
- **variável no comando** quando o valor é crítico: `VAR="…" comando`, em vez de depender
  de arquivo carregado
- **aspas** ao gravar valor em `.env` — URL de banco tem `?` e `&`
- **valor vazio não sobrescreve** o que já existe, senão o primeiro deploy depois de
  acrescentar uma variável apaga as outras
- **migration com a ferramenta de runtime**, nunca com CLI de desenvolvimento: `pnpm
install --prod` poda `devDependencies`, e o log diz `devDependencies: skipped`

### 6. 🔴 O log do deploy no GitHub é FONTE — e vem ANTES da hipótese

**Decisão do dono em 10/09/2026:** _"já coloque no claude.md essa regra para sempre verificar
os logs do deploy pelo github"_.

O log não serve para confirmar o que já se decidiu. Ele é a **primeira** medição, e
frequentemente **desmente** a hipótese formada no repositório local.

```bash
RUN=$(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')
gh run view "$RUN" --log | grep -iE "err:|error|ELIFECYCLE"   # o que quebrou
gh run view "$RUN" --log | grep -F  "standalone/server.js"    # o que foi de fato ENVIADO
gh run view "$RUN" --log | grep -iE "pm2|restart|rsync"       # o que o servidor fez
```

**O incidente que originou a regra.** Diagnostiquei o 307 das rotas novas como
`outputFileTracingRoot` ausente: o build **da minha máquina** punha o `server.js` em
`.next/standalone/Developer/Projects/behemp-site/`, e não na raiz — porque o Next procura
lockfile para cima e encontra o de um projeto **vizinho**. Estava certo, e era verificável.
Levei ao dono como causa raiz de produção.

O log do deploy #40 mostrava, na listagem do rsync, `.next/standalone/server.js`. O runner
do GitHub clona **só este repositório**: não existe lockfile vizinho lá, o gatilho nunca
ocorreu, e o arquivo sempre chegou no lugar certo. **A causa era outra.**

🔴 **A regra:** máquina de desenvolvimento e runner de CI são ambientes diferentes, e o que
se mede num não vale no outro. Antes de chamar algo de causa **de produção**, achar no log
do deploy a linha que confirma. Sem linha, não é causa — é hipótese, e se apresenta como tal.

⚠️ **Segundo achado do mesmo dia: `pnpm build` mascarava a própria falha.** O script era
`next build && cp A 2>/dev/null || true && cp B 2>/dev/null || true`. Em shell, `&&` e `||`
têm a **mesma precedência** e associam à esquerda:

```
(((next build && cpA) || true) && cpB) || true
                 ↑ falhou    ↑ vira true aqui, e de novo no fim  →  exit 0
```

Medido: com o `next.config.ts` sintaticamente quebrado, `pnpm build` devolveu **exit 0**. O
`set -e` do deploy não salva disto — o comando _teve_ sucesso. **`|| true` no fim de uma
cadeia perdoa tudo que veio antes, não só o último comando.**

## Onde script, teste e seed moram

| o quê                   | onde                                     | convenção                                                                               |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| guarda estrutural       | `__tests__/guardas/nomeDoGuarda.test.ts` | um arquivo por classe de erro; nome no indicativo do que garante                        |
| script de manutenção    | `scripts/`                               | verbo-substantivo (`fix-user-role.ts`, `reset-anvisa.ts`)                               |
| seed e migração de dado | `db/`                                    | `seed*.ts`; recusa rodar com `NODE_ENV=production`; idempotente; sem identificador real |
| helper de domínio puro  | `lib/<dominio>/`                         | sem `db`, sem `auth`, sem `next/*`                                                      |

Script novo declara no topo: o que faz · como se desfaz · se é idempotente.
