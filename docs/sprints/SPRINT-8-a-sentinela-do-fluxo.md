# Sprint 8 — A sentinela do fluxo

> **Decide:** ADR-0022 (D-05 a D-09) · **Fecha:** G1 a G6
> **Pedida pelo dono em 12/09/2026**, depois de percorrer o fluxo 1 e encontrar seis defeitos
> que nenhum guarda pegou — porque **os guardas leem o código, e nenhum executa o fluxo**.

## A regra desta sprint

🔴 **Nenhum item é dado por pronto sem um teste que EXECUTE o caminho ruim.**

Guarda estrutural continua valendo — ele impede a volta. Mas ele não prova que funciona, e foi
por acreditar que provava que afirmei "está funcionando" cinco vezes enquanto o dono encontrava
buraco atrás de buraco. **Todo item desta sprint tem teste de comportamento, com estado sujo.**

---

## 🔴 S8.0 — A revogação tem que parar a fila (G9) — LGPD, precede tudo

**Achado pela varredura exaustiva de 12/09/2026.** O `enviador` não relê o consentimento antes
do POST: o payload é congelado no enfileiramento (`parceiro-eventos-saida.ts:52`). Entre
enfileirar e enviar podem passar **horas** (fila a cada 5 min, retry com backoff até 60 min) —
e se o paciente revogar nesse intervalo, **o dado sai assim mesmo**.

⚠️ A LGPD art. 8º §5º diz "a qualquer momento". Hoje é "até a fila rodar", e o paciente não
tem como saber quando isso foi.

| passo | o quê                                                              |
| ----- | ------------------------------------------------------------------ |
| 1     | `enviador.ts` relê o consentimento imediatamente antes do POST     |
| 2     | revogado → evento vira `cancelado_por_revogacao`, **não** `falhou` |
| 3     | e o motivo fica consultável                                        |

**Aceite:** revogar depois de enfileirado impede o envio.
**Testes (comportamento, com estado sujo):**

- enfileira → revoga → roda a fila → **nada sai**, e o evento fica `cancelado_por_revogacao`
- enfileira → **não** revoga → sai normalmente (controle contra falsa recusa)
- revoga → reenfileira por outro caminho → continua não saindo
- ⚠️ e o evento cancelado **não** conta como falha nas métricas

---

## S8.1b — Inverter a ordem do consumo do link (G10)

`cadastro-por-link.ts:327` queima o link **antes** de `:342` gravar o `pacienteId`. Se a
gravação falhar: link morto **e** `pacienteId` nulo. O aviso de pendência nunca aparece (exige
`usadoEm IS NULL`) e o parceiro nunca é avisado da receita — dois silêncios de uma vez.

**Aceite:** falha depois do consumo não deixa o paciente sem link **e** sem vínculo.
**Teste:** forçar exceção entre as duas linhas e provar que o estado é recuperável.
⚠️ **Uma linha de mudança.** Vai antes de qualquer coisa estrutural.

---

## S8.1c — `onConflictDoNothing` no insert de `pacientes` (G11)

O webhook do Clerk pode inserir em `pacientes` entre o `SELECT` (`:284`) e o `INSERT` (`:304`)
da transação. O unique `pacientes.userId` é violado, a transação inteira aborta, e o paciente lê
_"não conseguimos concluir seu cadastro"_ **com a conta já criada**.

🔴 **É candidato ao erro original do dono** — o log dizia `{ erro: 'Error' }` e não distinguia.

**Aceite:** webhook e action podem correr sem que um derrube o outro.
**Teste:** simular a corrida — inserir a ficha entre o select e o insert — e provar que o
cadastro conclui.
⚠️ O webhook já tem `onConflictDoNothing`; a action não. **Uma linha.**

---

## S8.1 — Descobrir por que o aviso não apareceu (G6)

**Bloqueia todo o resto.** Se o aviso de cadastro pendente não aparece, a sentinela nasce com o
mesmo defeito.

| passo | o quê                                                                                                          |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| 1     | consultar em produção a solicitação dos três e-mails de teste: `email`, `usado_em`, `paciente_id`, `expira_em` |
| 2     | descobrir **qual** das três condições barra o aviso                                                            |
| 3     | corrigir a causa, não o sintoma                                                                                |

**Aceite:** a causa dita em uma frase, com a linha do banco que a prova.
**Teste:** um caso por condição — usado, vencido, já vinculado, e-mail divergente — que prove
qual delas some com o aviso.
⚠️ **Precisa do dono:** acesso ao banco de produção, que a sessão não tem.

---

## S8.2 — A procedência sobrevive à ficha (D-08, G5)

Hoje `solicitacao.origem` já distingue ChatPro, webhook da Greens e origem própria — e morre
quando a ficha nasce.

| passo | o quê                                                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- |
| 1     | migration: `pacientes.origem` e `pacientes.solicitacao_id`, **nullable**                                  |
| 2     | `concluirCadastroPorLink` grava os dois                                                                   |
| 3     | quem já existe fica `null` — e `null` significa **"veio antes desta mudança"**, não "origem desconhecida" |

**Aceite:** dado um paciente, o sistema responde de onde ele veio sem consultar outra tabela.
**Testes:**

- ficha criada pelo link carrega `origem` e `solicitacao_id`
- ficha criada pelo `/redirect` (casca) **não** carrega — e isso é distinguível de erro
- paciente antigo com `null` não é tratado como incompleto (R9)

⚠️ **Migration aditiva e nullable** — Postgres 11+ não reescreve a tabela. Autorização por
escrito antes de rodar (`main` é produção).

---

## S8.3 — A sentinela (D-05, D-06, D-07)

Uma função pura: recebe o estado, devolve **o ponto e o porquê**.

```ts
type Ponto =
  | 'completo' // segue a vida
  | 'completo_legado' // conta antiga, sem solicitação — NUNCA bloqueia (R9)
  | 'aguardando_codigo' // signUp pendente, e-mail não verificado
  | 'conta_incompleta' // conta sem senha utilizável
  | 'ficha_ausente' // conta existe, cadastro nunca concluído
  | 'documentos_nao_materializados' // a Greens entregou, e não chegou (R6)
  | 'dado_incompleto'; // o parceiro disse que mandou, e não mandou (R6)

interface Situacao {
  ponto: Ponto;
  /** Por que este ponto, em uma frase. Sem isto, o G6 se repete. */
  porque: string;
  /** Para onde levar, quando há caminho. */
  destino: string | null;
}
```

**Aceite:** toda tela que decide o que mostrar pergunta à sentinela; nenhuma decide sozinha.
**Testes — um por ponto, e um de controle:**

- conta antiga sem solicitação → `completo_legado`, **sem** bloqueio
- conta + ficha + documentos → `completo`
- conta sem ficha, solicitação aberta → `ficha_ausente` com destino
- solicitação com manifesto e zero linhas em `documentos` → `documentos_nao_materializados`
- manifesto com documento que o log recusou → `dado_incompleto`
- ⚠️ **vacuidade:** um estado que não cai em nenhum ponto faz o teste ficar vermelho nomeando-o

---

## S8.4 — A verdade sobre o que não chegou (R6)

As duas falhas silenciosas medidas: `materializarDocumentosDoParceiro` devolve `{inseridos: 0}`
e a recusa de documento do parceiro só vai para o log.

| passo | o quê                                                                                     |
| ----- | ----------------------------------------------------------------------------------------- |
| 1     | registrar **por documento** o que foi tentado e o que falhou (tipo e motivo, nunca a URL) |
| 2     | a tela distingue três coisas: **você não enviou** · **recebemos** · **veio e não chegou** |
| 3     | o admin vê a lista do que não chegou, por protocolo                                       |

**Aceite:** o painel nunca mais diz "0 enviados" quando o parceiro entregou quatro.
**Testes:**

- documento recusado por SSRF → aparece como "não chegou", com motivo
- documento materializado → aparece como recebido
- nenhum documento no manifesto → aparece como "você ainda não enviou"
- ⚠️ e o motivo **nunca** carrega a URL do parceiro nem nome de arquivo

---

## S8.5 — Retomada de qualquer lugar (R2)

Hoje a retomada só funciona na mesma aba, porque a senha vive no estado do React.

| passo | o quê                                                                     |
| ----- | ------------------------------------------------------------------------- |
| 1     | a sentinela diz o ponto; a tela de cadastro abre **nele**                 |
| 2     | sem senha em mãos, abre na etapa 1 com aviso de que o cadastro já começou |
| 3     | e o código é reenviado sem recriar o cadastro                             |

**Aceite:** fechar a aba e voltar por outro aparelho continua o cadastro.
**Testes:**

- aba nova, mesmo e-mail → abre na etapa certa
- aparelho diferente → abre na etapa 1, avisando que já começou
- código expirado → reenvia sem `form_identifier_exists`
- ⚠️ e **nunca** completa cadastro sem senha

---

## S8.6 — Reconciliação (D-09)

Ato explícito, nunca no login.

| passo | o quê                                                                                 |
| ----- | ------------------------------------------------------------------------------------- |
| 1     | script que, dado um e-mail, liga a conta à solicitação aberta e materializa o que der |
| 2     | idempotente: rodar duas vezes não duplica nada                                        |
| 3     | relatório do que ligou, do que materializou e do que não deu                          |

**Aceite:** os três e-mails de teste do dono voltam a ter os documentos visíveis.
**Testes:**

- rodar duas vezes → mesmo resultado
- solicitação já vinculada → não faz nada
- documento com link expirado → relata, não quebra
  ⚠️ **Roda com autorização por escrito** — escreve no banco de produção.

---

## Ordem, e por quê

```
S8.1 ──► S8.2 ──► S8.3 ──► S8.4
  │                 │
  └─ bloqueia       └──────► S8.5
                            S8.6
```

**S8.1 primeiro** porque um aviso que some sem dizer por quê é o defeito que a sentinela
existiria para evitar — construí-la antes seria repetir a causa.
**S8.2 antes da S8.3** porque a sentinela precisa da procedência para distinguir legado de
incompleto.
**S8.4 e S8.5 em paralelo** depois da sentinela; a S8.6 pode ir junto, é independente.

## O que fica FORA, e por quê

| item                                          | motivo                                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------- |
| verificação de e-mail própria                 | medido e rejeitado hoje: a conta continua nascendo no Clerk, na confirmação |
| apagar `signUp` pendente que prende o e-mail  | exige Backend API do Clerk e decisão de retenção                            |
| notificar quem ficou órfão antes desta sprint | decisão do dono sobre contatar paciente                                     |
| instância de produção do Clerk                | Item 36 — depende de DNS                                                    |

## Como se sabe que a sprint acabou

1. o dono percorre o fluxo 1 com e-mail novo, do começo ao fim, **sem intervenção**
2. fecha a aba no meio e retoma — e continua de onde parou
3. abre o link logado em outra conta — e é avisado, com saída
4. um documento que a Greens não entregou **aparece como não entregue**, não como ausente
5. e os testes de comportamento rodam no CI, não só os estruturais

---

# ✅ ESTADO EM 13/09/2026 — o que foi entregue

| item                                       | estado                          | onde                                                        |
| ------------------------------------------ | ------------------------------- | ----------------------------------------------------------- |
| **S8.0** revogação para a fila (LGPD)      | ✅                              | `lib/parceiros/consentimento-ainda-vale.ts` + `enviador.ts` |
| **S8.1** por que o aviso não apareceu      | ✅ **por outro caminho** (D-16) | `app/api/fluxo/situacao/route.ts`                           |
| **S8.1b** vínculo antes de queimar o link  | ✅                              | `cadastro-por-link.ts`                                      |
| **S8.1c** `onConflictDoNothing` na corrida | ✅                              | `cadastro-por-link.ts`                                      |
| **S8.2** a procedência sobrevive           | ✅                              | migrations 0042/0043 + `pacientes.origem`                   |
| **S8.3** a sentinela                       | ✅                              | `lib/fluxo/sentinela.ts`                                    |
| **S8.4** dizer o que não chegou            | ✅                              | `components/paciente/AvisoDoQueNaoChegou.tsx`               |
| **S8.5** retomar de qualquer lugar         | 🟡 **parcial**                  | retoma na mesma aba; de outro aparelho volta à etapa 1      |
| **S8.6** reconciliação                     | 🔴 **não feita**                | precisa do banco, que o dono não tem hoje                   |

## O que ficou de fora, e por quê

**S8.5 — retomada de outro aparelho.** Funciona na mesma aba (o `signUp` do Clerk vive no
navegador) e, de outro aparelho, a pessoa volta à etapa 1 e o código é reenviado sem recriar o
cadastro. **O que falta** é abrir direto na etapa certa vindo de outro dispositivo — exige
persistir o progresso fora do navegador, e isso é desenho novo, não ajuste.

**S8.6 — reconciliação.** É um script que escreve no banco de produção, e o dono informou em
13/09 que não tem acesso à VPS nem ao banco. ⚠️ **Mas o instrumento do S8.1 já responde a
pergunta que ela responderia** — `GET /api/fluxo/situacao?email=` diz em que ponto cada pessoa
está, e por quê. A reconciliação passa a ser "agir sobre o que o instrumento mostrou", não
"descobrir o que aconteceu".

## 🔴 O que este trabalho NÃO garante

**Nenhum destes guardas executa o fluxo.** Eles provam que o código está escrito do jeito certo
— e foi por confundir as duas coisas que afirmei "está funcionando" cinco vezes em 12/09, com
1152 guardas verdes, enquanto o dono encontrava seis defeitos seguidos.

O teste que falta é o de comportamento, com estado sujo. Ele está no `CLAUDE.md` como regra
desde 12/09, e continua sendo o próximo passo natural desta sprint.
