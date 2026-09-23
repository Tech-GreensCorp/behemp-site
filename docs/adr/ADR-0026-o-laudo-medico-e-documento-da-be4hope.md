# ADR-0026 — O laudo médico é documento da Be4Hope, e continua sem viajar de volta

> **Status:** 📋 proposta
> **Contexto:** desde 15/09/2026 a Greens manda o laudo como **arquivo**. Nós o baixamos, o
> guardamos no nosso blob privado — e o descartamos na hora de gravar, porque o enum
> `documento_tipo` não tem o valor. Medido em produção pelo dono em 23/09/2026: **3 laudos no
> blob, 0 linhas em `documentos`.**
> **Decisão:** `laudo_medico` vira valor do enum e passa a ser documento como os outros — **nos
> dois sentidos**. O que segura a ida não é uma lista de exclusão, é o interruptor que já existe.

## §1 — O que a medição provou

Medido em produção em 23/09/2026 pelo dono, por `psql`, somente leitura:

| fato                                         | medida                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| PostgreSQL de produção                       | **17.11**                                                                     |
| laudos baixados e guardados no nosso blob    | **3**                                                                         |
| linhas de laudo em `documentos`              | **0**                                                                         |
| RG, receita e comprovante: arquivos baixados | **10 cada**, e todos viram linha                                              |
| desde quando o laudo vem como arquivo        | **15/09/2026** (commit `4e9cfac` da Greens, que removeu o `NAO_VIAJAM` deles) |

E no código deste repositório:

| fato                                              | medida                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| valores do enum `documento_tipo`                  | **8**, nenhum é laudo                                                                             |
| onde o laudo é descartado                         | `lib/parceiros/materializar-documentos.ts:85-92` — `TRADUCAO` não o tem, e o `.filter()` o remove |
| o laudo já está no vocabulário do parceiro?       | **sim** — `lib/parceiros/documentos.ts:12` e `:34` (opcional)                                     |
| leitores de `documentos` que **não** filtram tipo | **16 de 18**                                                                                      |
| `NAO_VIAJAM` da ida                               | `lib/parceiros/documentos-que-viajam.ts:37`, hoje **inalcançável**                                |

⚠️ **O descarte acontece DEPOIS do download.** `materializarArquivos` roda no handoff
(`lib/parceiros/handoff.ts:80`); a materialização em `documentos` só acontece quando o paciente
conclui o cadastro. Entre os dois, o arquivo já está no nosso blob. Ou seja: **há documento
clínico guardado que nenhuma linha aponta** — nem o paciente o vê, nem o médico, e ninguém sabe
que ele está lá.

## §2 — As decisões

### D-01 — `laudo_medico` vira valor do enum `documento_tipo`

Um valor novo, e a tradução em `materializar-documentos.ts` passa a mapeá-lo. Nada mais no
vocabulário do parceiro muda: ele já está em `DOCUMENTOS_DO_FLUXO` e em `DOCUMENTOS_OPCIONAIS`,
então **nada passa a ser cobrado do paciente**.

**Rejeitado: guardá-lo como `documento_pessoal`.** O valor existe e a tentação é óbvia — resolve
sem migration. Mas classificaria um documento **clínico** como pessoal, e quem lesse a ficha
depois acreditaria na classificação errada. O custo de uma classificação falsa num prontuário não
é estético: é um médico decidindo com a informação errada sobre o que está olhando.

**Rejeitado: seguir descartando.** É o estado atual, e ele tem dois custos medidos. O primeiro é
que documento clínico fica em blob **sem dono** — guardado, cobrado de armazenamento, e invisível.
O segundo é que o paciente teria de **reenviar o que já enviou**, que é exatamente o atrito que o
handoff existe para remover.

### D-02 — 🔴 A migration é IRREVERSÍVEL na prática

O Postgres **não tem `ALTER TYPE ... DROP VALUE`**. Uma vez aplicado, o valor fica no enum para
sempre; desfazer exigiria recriar o tipo, reescrever toda coluna que o usa e recriar as
dependências — em produção, com dado clínico dentro.

Por isso esta decisão é ADR e não commit: **não existe "voltar atrás" barato.**

⚠️ **E há uma restrição do Postgres que decide a forma da migration.** No PG 17 (o de produção),
`ALTER TYPE ... ADD VALUE` **pode** rodar dentro de um bloco de transação, mas a documentação
oficial é explícita: _"If `ALTER TYPE ... ADD VALUE` is executed inside a transaction block, the
new value cannot be used until after the transaction has been committed."_ O `scripts/migrar.mjs`
usa o migrator do Drizzle, que envolve **todas** as migrations pendentes em **uma** transação
(`pg-core/dialect.js:60`). Logo: a migration contém **só** o `ADD VALUE`. Qualquer `INSERT`,
`UPDATE`, `DEFAULT` ou `CHECK` que use `'laudo_medico'` na mesma leva **falharia**.

**Rejeitado: pôr o `ADD VALUE` e o uso do valor na mesma migration.** Passa em teste local se o
banco estiver vazio de migrations pendentes, e quebra em produção quando não estiver — a pior
combinação possível.

### D-03 — Na IDA (Be4Hope → Greens) o laudo SAI do `NAO_VIAJAM`

🔴 **Decisão do dono em 23/09/2026**, que corrige a leitura desta ADR na primeira redação:
_"não é para estar bloqueada, já conversamos sobre isso, ela só será bloqueada após pronta e
funcional"_.

A primeira versão deste D-03 mantinha `laudo_medico` no `NAO_VIAJAM` citando o **GATE-JUR-01**.
A medição mostra que esse fundamento não se sustenta, e vale registrar o erro:

| o que eu supus                                | o que está medido                                                                                                                                                                               |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| o `NAO_VIAJAM` é o que impede o laudo de sair | **não é.** `lib/parceiros/transferencia-de-cadastro.ts:105` sai antes de qualquer documento, com `motivo: 'desligada'`, se `PARCEIRO_TRANSFERENCIA_ATIVA` não for `1` (`pode-transferir.ts:29`) |
| sem ele, dado de saúde atravessaria hoje      | **não atravessa.** Além da flag, `podeTransferir` exige consentimento com a finalidade **específica** `retorno_ao_parceiro` — art. 11, I da LGPD                                                |

➡️ **A trava é o interruptor, e ele está desligado.** O `NAO_VIAJAM` não protege nada: ele
apenas garante que, **no dia em que a flag for ligada**, o laudo fique de fora sem ninguém
lembrar por quê. É exatamente a classe de defeito que motivou esta ADR — uma exclusão órfã,
espelhando uma decisão da Greens que não existe desde 15/09/2026.

Portanto `laudo_medico` sai da lista. O mecanismo `NAO_VIAJAM` **fica**, vazio: ele é o lugar
onde um tipo que realmente não deva viajar seria declarado, e apagá-lo faria a próxima exclusão
nascer espalhada.

**Rejeitado: manter o laudo fora até o GATE-JUR-01 fechar.** Foi a minha proposta, e o dono a
recusou com razão: confunde **construir** com **ativar**. O gate governa ligar o interruptor, não
escrever o código — e deixar a funcionalidade pela metade até lá significa que, quando o Jurídico
liberar, alguém terá de lembrar de uma linha num arquivo que ninguém vai reler.

**Rejeitado: apagar o `NAO_VIAJAM` e o motivo junto.** Tiraria o único lugar declarado para
"este tipo não viaja", e a próxima exclusão viraria um `if` solto.

⚠️ **O que isto NÃO autoriza:** ligar `PARCEIRO_TRANSFERENCIA_ATIVA`. Ela continua fora, e é ela
que o GATE-JUR-01 governa.

### D-04 — Os 3 laudos já guardados NÃO são recuperados aqui

Eles continuam no blob, sem linha. Recuperá-los é **inserir linhas em produção** a partir do
manifesto de solicitações antigas — o que exige decidir a data de emissão, a validade e o que
fazer com laudo de cadastro não concluído.

**Rejeitado: fazer o backfill junto.** Misturar migration de schema com escrita de dado clínico
num único merge significa que, se a escrita estiver errada, o caminho de volta não é um `revert`
— é outro `UPDATE` em produção. É fatia própria, com aprovação do dono.

## §3 — O que fica rejeitado

| alternativa                                             | por quê                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------- |
| guardar o laudo como `documento_pessoal`                | classifica documento clínico como pessoal, e a ficha passa a mentir        |
| seguir descartando                                      | blob sem dono, e o paciente reenvia o que já enviou                        |
| `ADD VALUE` + uso do valor na mesma migration           | no PG 17 falha dentro da transação única do migrator                       |
| remover o `NAO_VIAJAM` da ida agora                     | manda dado de saúde entre empresas com o **GATE-JUR-01 aberto**            |
| recuperar os 3 laudos neste mesmo merge                 | escrita de dado clínico em produção sem caminho de volta barato            |
| acrescentar `laudo_medico` só à lista paralela de tipos | `lib/utils/validade.ts` já está com 5 de 8; uma sexta lista paralela piora |

## §4 — Como se prova

`__tests__/integracao/o-laudo-medico-vira-documento.test.ts` — casos que **EXECUTAM** a
materialização e o plano de envio contra um Postgres real. Fora do portão, como os demais de
`__tests__/integracao/` (exigem Docker).

O que travam: um manifesto com `laudo_medico` **com arquivo** vira linha em `documentos` com o
tipo novo · `documento_identidade` continua virando `rg` (não regrediu) · o plano da **ida**
passa a **incluir** o laudo · nada sai enquanto `PARCEIRO_TRANSFERENCIA_ATIVA` não for `1` · a
tela mostra **"Laudo médico"**, não o valor cru.

E a migration se prova no Postgres local antes de qualquer deploy: aplicada, o enum passa a ter
**9** valores; aplicada de novo, não faz nada.

## §5 — Quem passa a ver o laudo, e isso é desejado

**16 dos 18 leitores de `documentos` não filtram tipo.** Uma linha `laudo_medico` aparece, a
partir deste merge, em:

| onde                                               | o que acontece                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `app/_actions/dashboard-paciente.ts:188`           | soma no contador "total de documentos"                              |
| `app/_actions/documentos-paciente-self.ts:183`     | aparece na tela de documentos do paciente                           |
| `app/(paciente)/paciente/perfil/page.tsx:710`      | aparece no perfil                                                   |
| 🟢 `app/(medico)/_actions/prontuario-vivo.ts:200`  | **entra no prontuário do médico**                                   |
| `lib/fluxo/reconciliar.ts:183`, `sentinela.ts:193` | comparam por `urlBlob` — o laudo deixa de parecer não-materializado |
| `app/(medico)/_actions/documentos.ts:124/157/181`  | lista e conta                                                       |

🟢 **O prontuário é o ponto, não o efeito colateral.** O laudo é o que sustenta a avaliação
clínica na teleconsulta; ele aparecer ali para o médico é a razão de o dono ter decidido que o
laudo deve chegar. Os demais são consequência aceita: contadores sobem em 1 e uma linha a mais
aparece nas listas — nenhuma tela quebra, porque os rótulos usam `?? tipoKey` e ganham a entrada
`laudo_medico` neste mesmo commit.

⚠️ **Validade:** `lib/documentos/validade.ts:32` recebe `string` e tem `default` de 100 anos, e é
para lá que o laudo cai — laudo não vence. `TIPOS_RENOVAVEIS` do cron não o inclui, então ele não
gera alerta de vencimento. Nenhum dos dois precisa mudar.

## §6 — O que a implementação ensinou

_A escrever depois do merge._

Fica registrado desde já o que esta ADR **errou na primeira redação**, porque o caminho ensina
mais que o destino: eu mantive o laudo fora da ida citando o GATE-JUR-01, sem ter medido que a
transferência inteira já está atrás de `PARCEIRO_TRANSFERENCIA_ATIVA`. O gate é real e continua
aberto — ele apenas não governa o que eu disse que governava. **Citar um bloqueio verdadeiro para
justificar a coisa errada é pior que não citar nada**, porque quem lê confere que o gate existe e
para de conferir o resto.

⚠️ E um ponto que continua **aberto**: o motivo `'tipo_nao_suportado_la'`, que o ramo devolveria,
a Greens removeu do vocabulário dela em 15/09/2026. Com o laudo saindo do `NAO_VIAJAM` a lista
fica vazia e o motivo deixa de ser emitido — mas ele continua declarado em `MotivoSemArquivo`,
e é valor que o outro lado não reconhece mais. Alinhar o vocabulário é conversa entre os dois
repositórios, não mudança unilateral.
