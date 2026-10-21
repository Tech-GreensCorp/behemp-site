# ADR-0025 — O admin edita o perfil do médico; apagar médico fica de fora, e por quê

> **Status:** 📋 proposta
> **Contexto:** `valorConsulta` só era gravável no cadastro. Corrigir um valor errado exigia
> `UPDATE` manual no banco de produção — e é o número que
> `app/(public)/_actions/agendamento.ts:219` cobra do paciente.
> **Decisão:** a edição entra completa, validada e auditada. Delete e restore **não** entram
> agora, e esta ADR registra por quê, para ninguém reabrir a discussão com informação pior.

## §1 — O que a medição provou (23/09/2026)

Tudo abaixo foi medido no disco, com `rg`/`grep`, antes de qualquer linha ser escrita.

| fato                                          | medida                                          |
| --------------------------------------------- | ----------------------------------------------- |
| `atualizarDadosMedico` existia e era **órfã** | **0** chamadores em todo o repositório          |
| ela não gravava `valorConsulta`               | `.set()` com 4 campos, sem ele                  |
| nenhuma action de `admin-medicos.ts` auditava | **0** ocorrências de `registrarAuditoria`       |
| `medicos` tem soft delete?                    | **não** — 0 `softDeleteColumn`, 0 `deletedAt`   |
| tabelas com FK para `medicos.id`              | **18**, em 17 arquivos de `db/schema/`          |
| `verificarAdmin()` preenche `userId`?         | **não** — devolve só `clerkId`                  |
| `MedicoResumo` trazia `bio` e `ordem`?        | **não** — e a tela passaria a regravar por cima |
| tipo de inserção de `numeric` no Drizzle 0.44 | **`string`**, não `number`                      |

⚠️ **O `valorConsulta` era `z.string().optional()` nos dois caminhos.** Aceitava `"abc"`,
`"-5"` e `"10.999"` sem reclamar: `"abc"` estourava no banco, e um valor negativo entrava
inteiro na coluna que o agendamento lê para cobrar.

## §2 — As decisões

### D-01 — O valor da consulta é editável, validado e auditado

A validação recusa texto, negativo, zero, mais de duas casas decimais, `NaN`, `Infinity` e o
estouro de `numeric(10,2)` (teto de 99.999.999,99). Continua `.optional()` de propósito:
médico sem valor definido é estado legítimo, e o agendamento já recusa com mensagem própria
(`app/(public)/_actions/agendamento.ts:139`).

**Rejeitado: deixar o campo só no cadastro e corrigir por SQL.** O custo concreto é que todo
ajuste de preço vira acesso manual ao banco de produção, sem rastro de quem mudou — e este
repositório aplica migration em produção sem rollback, então abrir esse hábito é caro.

**Rejeitado: tornar o campo obrigatório na edição.** Quebraria a edição de todo médico
cadastrado antes deste commit, que é a maioria.

### D-02 — Campo ausente APAGA, e a listagem carrega o que a tela vai regravar

A action grava o formulário inteiro, não um patch — como `crm`, `bio` e `ordem` já faziam
antes desta mudança. A consequência é que `bio` e `ordem` **tiveram de entrar em
`MedicoResumo` no mesmo commit**: sem eles, abrir a edição e salvar apagaria a biografia do
médico e a posição dele na home, sem erro e sem aviso.

**Rejeitado: virar patch parcial (`undefined` = não mexe).** Aí "limpar o valor da consulta"
deixa de ter como ser expresso, e o admin não consegue desfazer o que digitou.

### D-03 — A linha do ANTES sai do banco, nunca do que o cliente mandou

`atualizarDadosMedico` lê a linha com um `SELECT` antes do `UPDATE` e usa esse snapshot como
`dadosAntes`. Se a linha não existe, responde `Médico não encontrado` em vez de dizer
"sucesso" para um update que não teve o que fazer.

**Rejeitado: montar `dadosAntes` no cliente e mandar junto.** Auditoria que confia na entrada
registra o que o cliente quis que ela registrasse — e o valor da auditoria é justamente não
depender de quem agiu.

### D-04 — 🔴 APAGAR MÉDICO NÃO ENTRA NESTA RODADA

`medicos` não tem `deletedAt` e **18 tabelas** apontam para `medicos.id`: consultas,
prescrições, evoluções, anamneses, teleconsultas, ajustes de dosagem, medidas de desfecho,
relatórios, pagamentos, autorizações da ANVISA, entre outras. Um `DELETE` real derruba
histórico clínico, que a proibição 4 do `CLAUDE.md` protege. Um soft delete exige migration
**mais** revisão das 18 leituras.

**Rejeitado: entregar o botão agora com um soft delete "simples".** O custo: 18 queries que
passariam a poder devolver médico apagado, sem nenhum teste que prove o antes e o depois — e
a que esquecer o filtro falha em silêncio, com o paciente na tela.

### D-05 — O desligamento é caso a caso, não regra fixa

Definido pelo time em 23/09/2026 e registrado aqui para não se reabrir:

| #   | pergunta              | resposta do time                                                       |
| --- | --------------------- | ---------------------------------------------------------------------- |
| 1   | apagar é regra fixa?  | **não** — opções para o admin decidir caso a caso                      |
| 2   | dá para restaurar?    | **sim**, confirmado                                                    |
| 3   | e a consulta futura?  | **avisa com 3 opções**, não cancela sozinha                            |
| 4   | e o acesso do médico? | **Clerk bloqueia automático**, com aviso em tela; só admin desbloqueia |

🔴 **NENHUMA DAS QUATRO ESTÁ NO CÓDIGO.** Isto é decisão **registrada**, não implementada —
inclusive a restauração, que está confirmada como requisito e não existe em lugar nenhum.
As quatro são o escopo da próxima rodada, e quem for implementá-las começa por esta tabela.

### D-06 — A linha da lista deixa de ser um link inteiro

O `DataRow` com `href` embrulha a linha num `<Link>`; um botão dentro dele seria `<button>`
dentro de `<a>` — conteúdo interativo aninhado, HTML inválido, e o clique sobe para o link e
navega. O padrão do próprio produto para linha com ação é **não ter `href`**: ver
`app/(paciente)/paciente/documentos/page.tsx:245`, onde a linha tem "Ver" e "Baixar" e nenhum
`href` de linha. "Ver" e "Editar" ficam explícitos em `trailing`.

**Rejeitado: manter o `href` e usar `stopPropagation` no botão.** Funciona na prática e é
comum, mas continua HTML inválido e quebra a navegação por teclado — e o repositório já tinha
resolvido isto de outro jeito.

### D-07 — O modo de edição só mostra o que a action escreve

Foto, nome e senha ficam **fora** do modo de edição, porque `atualizarDadosMedico` não os
toca. Um campo de foto que aceita upload e não muda a foto é a tela mentindo, e mentira de
tela é pior que campo ausente: quem usa acredita que salvou.

## §3 — O que fica rejeitado

| alternativa                                    | por quê                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| `DELETE` real em `medicos`                     | derruba histórico clínico por 18 FKs                               |
| soft delete sem revisar as 18 leituras         | médico apagado reaparece em tela que ninguém conferiu              |
| `dadosAntes` vindo do cliente                  | auditoria registra o que o cliente quis                            |
| patch parcial na edição                        | impede limpar um campo                                             |
| `valorConsulta` obrigatório                    | quebra a edição de todo médico já cadastrado                       |
| linha inteira como `<Link>` com botão dentro   | `<button>` dentro de `<a>`; o padrão do produto é linha sem `href` |
| mostrar foto/nome/senha na edição              | a action não os grava — a tela afirmaria o que não acontece        |
| corrigir preço por `UPDATE` manual em produção | sem rastro de quem mudou, num banco que não tem rollback           |

## §4 — Como se prova

`__tests__/integracao/o-valor-da-consulta-se-edita-e-fica-registrado.test.ts` — **14 casos
que EXECUTAM a action** contra um Postgres real, com o Clerk duplado. Fica **fora do portão**
(`vitest.config.mts` exclui `__tests__/integracao/`), como os demais: exigem Docker, e um
portão que falha em máquina sem Docker é um portão que alguém desliga.

```
docker start behemp-pg || docker run -d --name behemp-pg \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=behemp -p 5544:5432 postgres:16
DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp npx drizzle-kit push --force
DATABASE_URL=postgresql://postgres:local@localhost:5544/behemp \
  npx vitest run --config vitest.integracao.mts
```

O que cada caso trava: o valor é gravado · aceita número e string · a edição vira linha de
auditoria com o antes e o depois · a auditoria aponta para o admin da sessão · limpar o campo
apaga · campo omitido apaga · a listagem devolve `bio` e `ordem` · cinco valores inválidos são
recusados **com a causa na tela** · médico inexistente não vira sucesso · quem não é admin não
edita e não deixa rastro.

**Provado vermelho por sete sabotagens**, aplicadas ao código e revertidas: tirar
`valorConsulta` do `.set()` (5 casos caem) · remover `registrarAuditoria` (2) · tirar o teto de
`numeric(10,2)` (1) · transformar o portão do médico inexistente em nada (1) · trocar
`dadosAntes` pelo depois (1) · tirar `bio`/`ordem` da query (1) · parar de exigir admin (1).

🔴 **Uma sabotagem sobreviveu na primeira versão do teste** — sem o teto de `numeric(10,2)` o
Postgres recusa o `UPDATE` e o resultado é `sucesso: false` **igual ao da recusa do Zod**. O
caso foi fatiado pela **mensagem**. O que muda é o que o admin lê: `Valor acima do máximo
permitido (99.999.999,99)` contra `Erro interno ao atualizar médico`, e o log de produção, que
sem o teto enche de `DrizzleQueryError` com a query e os valores inline.

⚠️ **O que NÃO está provado:** a tela. O standalone sobe e responde, mas toda página morre em
`@clerk/nextjs: Missing publishableKey` — `grep -c CLERK .env` dá **0**. É o limite já medido
em 13/09/2026 e registrado no `CLAUDE.md`. O formulário precisa de olho humano depois do
deploy.

## §5 — O que a implementação ensinou

Três defeitos só apareceram porque o código foi **executado**, e nenhum deles seria pego por
guarda estrutural:

1. **`const` não sofre hoisting.** `valorDaConsulta` ficou declarado depois do primeiro uso.
   Erro de ordem, invisível na leitura do diff.
2. **`numeric` sem `mode` insere `string` no Drizzle 0.44**, e o schema passou a entregar
   `number` por causa do `.transform()`. `toFixed(2)` casa com `numeric(10,2)`.
3. **Faltava o teto da coluna.** `1e9` passava no Zod; o Postgres respondia `numeric field
overflow`; o admin lia "Erro interno".

E uma lição de assinatura: com `.transform()` no schema, `z.infer` deixa de ser a **entrada** —
ele é a saída. As actions recebem `z.input<typeof schema>`, senão o formulário teria de mandar
`number` num campo que o navegador entrega como string.
