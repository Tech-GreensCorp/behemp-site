# ADR-0022 — Conta e ficha são dois fatos, e ninguém liga os dois

> **Status:** aceita · **Data:** 12/09/2026 · **Revisada:** 13/09/2026 (Parte VII)
> **Contexto:** o dono percorreu o fluxo 1 da Greens de ponta a ponta e ficou com uma conta
> funcionando, um painel vazio e um cadastro que não podia mais ser concluído. Nenhuma das
> peças estava quebrada. O que faltava era a ligação entre elas.

## §0 — O relato, que é o dado primário

> _"funcionou mas de um jeito estranho: eu precisei clicar no botão de sair, entrar na conta
> e aí eu fui redirecionado para área do meu usuário, mas eu não fui pra tela de confirmação
> de código do e-mail, que foi a etapa que eu parei. Eu entrei na conta e vim na área de meus
> documentos: nenhum dos documentos que eu enviei chegaram na minha conta."_

Três perguntas saem daí, e as três têm a mesma raiz.

## §1 — O que foi MEDIDO, antes de qualquer hipótese

Tudo abaixo foi medido em 12/09/2026 contra produção e contra a instância do Clerk, não
inferido do código.

### 1.1 A conta existe, e com senha

```
POST /v1/client/sign_ins  identifier=<e-mail do dono>
  status: needs_first_factor
  first factor: password
  first factor: email_code
  first factor: reset_password_email_code
```

**Ela foi criada em alguma tentativa anterior que completou a verificação.** É por isso que ele
entrou sem confirmar código nenhum: não havia código a confirmar — a conta já existia, e a
senha funcionava.

### 1.2 O link do cadastro continua ABERTO

```
GET /cadastro/<token>  →  200, "Confirme seus dados"
```

`marcarComoUtilizada` roda **depois** da ficha gravar (`cadastro-por-link.ts`, etapa 6). O
cadastro nunca chegou lá, então o token nunca foi consumido. **Os dados da Greens não se
perderam** — estão em `solicitacoes_cadastro`, esperando.

### 1.3 A ficha do painel é uma casca

`app/(auth)/redirect/page.tsx:138-144`, no fallback de sincronização:

```ts
await db.insert(pacientes).values({
  userId: novoUser.id,
  medicoId: null,
  status: 'aguardando_consulta',
  jornadaFase: 'acolhimento',
});
```

Sem CPF, sem telefone, sem endereço, sem documento. **E é exatamente o que a tela dele mostra.**

### 1.4 A materialização dos documentos tem um único gatilho

```
materializarDocumentosDoParceiro  ← chamada em 1 lugar:
  app/_actions/cadastro-por-link.ts:434
```

Ela roda **dentro** de `concluirCadastroPorLink`. Cadastro não concluído ⇒ documentos do
parceiro nunca viram linha em `documentos` ⇒ o painel diz "Faltam 4 de 4".

### 1.5 Ninguém pergunta se há cadastro pendente

`grep solicitacoesCadastro` em `app/(paciente)` e em `app/(auth)/redirect`: **zero
ocorrências**. O painel não tem como saber que existe um cadastro esperando por aquele
usuário.

> ✅ **RETIFICADO em 13/09/2026 — fechado.** `app/_actions/dashboard-paciente.ts` chama
> `situacaoDoFluxo`. A medição acima vale para 12/09; ver §34.

## §2 — As etapas, e o gap de cada uma

O cadastro por link tem **cinco** fatos, e cada um pode acontecer sem os outros:

| #   | fato                                   | onde nasce                            | pode existir sozinho?        |
| --- | -------------------------------------- | ------------------------------------- | ---------------------------- |
| 1   | **solicitação** com os dados da Greens | `POST /api/parceiros/greens/cadastro` | sim — é o estado inicial     |
| 2   | **tentativa** de cadastro no Clerk     | `signUp.create`                       | sim, e **prende o e-mail**   |
| 3   | **conta** (User do Clerk)              | status `complete`                     | sim, e foi o caso aqui       |
| 4   | **ficha** (`pacientes` + dados)        | `concluirCadastroPorLink`             | sim, vazia, pelo `/redirect` |
| 5   | **documentos materializados**          | dentro do fato 4                      | não — depende do 4           |

**O gap não está em nenhuma etapa. Está entre a 3 e a 4.**

| gap                                                                    | consequência medida                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------- |
| **G1** — a conta pode existir sem a ficha do cadastro                  | o paciente entra e vê um painel vazio                     |
| **G2** — o `/redirect` cria uma ficha **casca** ao ver conta sem ficha | o sistema passa a acreditar que o cadastro está feito     |
| **G3** — nada liga a conta de volta à solicitação pendente             | o link continua válido e **ninguém diz isso ao paciente** |
| **G4** — a materialização só roda dentro do fato 4                     | documentos que a Greens já entregou ficam invisíveis      |

⚠️ **O G2 é o mais traiçoeiro.** Ele não deixa o sistema quebrado: deixa o sistema **mentindo**.
Há uma linha em `pacientes`, então toda tela que pergunta "esse usuário tem ficha?" responde
que sim. O cadastro real fica órfão sem que nada acuse.

## §3 — Por que ele "entrou sem confirmar o código"

Não entrou. A conta já existia (§1.1) de uma tentativa anterior bem-sucedida, e ele entrou com
a senha dela. **A etapa do código não foi pulada — ela já tinha sido cumprida, noutro momento.**

O que faltou não foi verificação: foi o sistema perceber que **aquela conta tem um cadastro
pendente** e levá-lo de volta (G3).

## §4 — Por que o código "não era confirmado antes"

Duas causas distintas, as duas já corrigidas hoje, e que se somaram:

1. **`session_exists`** — o Clerk não completa um `signUp` com sessão ativa. O `create` passa,
   o `attempt` falha. Corrigido saindo da sessão antes dos dois passos.
2. **e-mail, senha e nome iam juntos no `create`** — então uma falha depois disso deixava uma
   conta sem senha utilizável. Corrigido enviando a senha no `update`, depois da verificação
   (ADR desta série; a doc do Clerk garante que `complete` = _"The user has been created"_).

⚠️ **Nenhuma das duas explica o painel vazio.** Elas explicam por que ele não conseguia
concluir; o painel vazio é o G1/G2/G4, que são de desenho, não de bug.

## §5 — A decisão

**D-01 — Conta sem ficha de cadastro é um estado RECONHECIDO, não um estado inválido.**
Ele vai acontecer: o Clerk cria conta, o webhook chega assíncrono, o paciente fecha a aba. O
erro não é ele existir — é o sistema fingir que não existe.

**D-02 — O painel pergunta se há cadastro pendente, e oferece o caminho de volta.**
Quem entra com solicitação aberta vê um aviso com o link, em vez de um painel vazio sem
explicação. Fecha o G3, e é o que o dono pediu: _"o sistema saber quando tiver faltando algo de
uma etapa e continuar a partir disso"_.

**D-03 — A ficha casca do `/redirect` continua existindo, e passa a ser DECLARADA como casca.**
Removê-la quebraria o login de quem não veio por link (o webhook do Clerk é assíncrono e pode
falhar). Mas ela não pode mais mentir: quem a cria marca que ela nasceu vazia, e quem lê sabe
distinguir "ficha preenchida" de "casca esperando cadastro". Fecha o G2.

⚠️ **Rejeitado:** deixar de criar a ficha no `/redirect`. Mede-se o custo: toda tela do
paciente assume que a linha existe, e sem ela o login quebra para quem se cadastrou por fora
do link. O remédio seria pior.

**D-04 — A materialização deixa de depender só do cadastro por link.**
Documento que a Greens entregou é fato dela, não do nosso fluxo. Quando a ficha existir e
houver solicitação com documentos não materializados, materializa. Fecha o G4.

⚠️ **Rejeitado:** materializar no `/redirect`. É caminho de login — trabalho de rede ali atrasa
toda entrada no sistema, e falha de rede viraria falha de login.

## §6 — O que fica para depois, e por quê

| item                                           | por quê                                                                 |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| apagar o `signUp` pendente que prende o e-mail | exige Backend API do Clerk e decisão sobre retenção                     |
| unificar conta e ficha num ato só              | exige sair do fluxo padrão do Clerk — medido e rejeitado hoje por custo |
| notificar quem ficou órfão antes desta ADR     | precisa de varredura no banco e decisão do dono sobre contatar paciente |

## §7 — Como se sabe que funcionou

- quem entra com solicitação aberta **vê** o caminho de volta ao cadastro
- o painel distingue ficha preenchida de casca
- documento entregue pela Greens aparece no painel mesmo que o cadastro tenha sido concluído
  por outro caminho
- e os guardas: `o-painel-diz-o-que-falta`, `a-anvisa-aproveita-o-que-ja-chegou`,
  `a-conta-nasce-na-confirmacao-do-email`, `o-cadastro-retoma-de-onde-parou`

## §8 — Princípio e fase

Princípio **C** (o sistema informa, não esconde) e **H** (estado parcial é estado, e se declara).
Fase 7 — integração entre empresas.

> 🔴 **RETIFICADO em 13/09/2026 — as três glosas acima são INVENTADAS.** Medido em
> `docs/PRINCIPIOS.md`: **C** é _Ambientes e CI/CD_, **H** é _Segurança_, e a **fase 7** é _Erros
> e resiliência_. O número da fase estava certo; a descrição, não — que é o jeito mais fácil de
> alguém acreditar. O princípio correto para esta parte é **D** (Tratamento de erros, resiliência
> e HTTP). A atribuição completa, decisão por decisão, está no §35.1.

---

# PARTE II — A sentinela e a procedência

> **Acrescentado em 12/09/2026**, depois de o dono percorrer o fluxo 1 inteiro e apontar o que
> a Parte I não cobria. Ele aprovou os cinco entendimentos abaixo e acrescentou quatro.

## §9 — O que está aprovado, nas palavras do dono

Estes cinco foram escritos por mim, lidos e **confirmados** por ele ("entendeu exatamente
correto"). Ficam aqui como contrato, não como resumo:

| #      | o requisito                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------- |
| **R1** | o fluxo tem que sobreviver ao **caminho ruim**, não só ao feliz                                      |
| **R2** | o sistema tem que saber **em que etapa** o paciente parou — e **retomar dali**, não recomeçar        |
| **R3** | nenhum estado intermediário pode virar armadilha: conta pela metade fica **bloqueada e recuperável** |
| **R4** | a criação entre os dois sistemas tem que ser **rastreável de ponta a ponta**                         |
| **R5** | o estudo dos modos de falha por etapa vira ADR **e** sprints com testes                              |

E os quatro que ele acrescentou:

| #      | o requisito                                                                     | nas palavras dele                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R6** | **verdade sobre o dado que não chegou**                                         | _"é importante que o sistema reconheça e seja verdadeiro quando os dados não chegarem ao fluxo da BeHemp"_                                         |
| **R7** | **procedência**: o sistema sabe de onde o paciente veio                         | _"se ele veio do link do ChatPro, se veio do webhook do site da Greens (se veio ou não veio os documentos), ou se veio do próprio site da BeHemp"_ |
| **R8** | uma **sentinela** que monitora e entrega a tela certa                           | _"o certo é criarmos uma sentinela que é capaz de monitorar isso e entregar a tela certa para cada usuário"_                                       |
| **R9** | **conta antiga não é bloqueada**; conta nova pelos formulários carrega o status | _"usuários antigos que já possuem a conta criada não terão esse bloqueio"_                                                                         |

⚠️ **R6 é o mais exigente, e é o que a Parte I errou.** Não basta não quebrar: a tela tem de
**dizer** que o dado não chegou. O painel dele mostrava "0 enviados" — o que é verdade sobre o
banco e **mentira sobre o mundo**, porque a Greens tinha entregado quatro documentos.

## §10 — A procedência JÁ EXISTE, e morre antes de chegar ao paciente

Medido em 12/09/2026, e é a melhor notícia desta ADR:

```ts
// db/schema/enums.ts:330
export const solicitacaoCadastroOrigemEnum = pgEnum('solicitacao_cadastro_origem', [
  'painel_admin',
  'chatpro_bot',
  'chatpro_start',
  'chatpro_start_nao_verificado',
  'chatpro_webhook',
  'greens_handoff',
]);
```

**O enum cobre exatamente os três casos que o dono pediu no R7** — ChatPro, webhook da Greens,
e origem própria. O comentário dele no schema já dizia por quê: _"distinguir a origem não é
telemetria: é o que permite responder 'por que este paciente não recebeu o link' sem
adivinhar"_.

🔴 **E `pacientes` não tem nenhuma coluna de origem.** Medido: `grep origem db/schema/pacientes.ts`
não devolve coluna nenhuma. A procedência nasce na solicitação, é usada durante o cadastro, e
**morre ali**. Depois disso, um paciente vindo da Greens é indistinguível de um que se cadastrou
sozinho — e é por isso que nenhuma tela sabe que há documentos esperando.

**G5 — a procedência não sobrevive à criação da ficha.**

> ✅ **RETIFICADO em 13/09/2026 — fechado pelo S8.2.** `db/schema/pacientes.ts:107,117` tem
> `origem` e `solicitacaoId` (migration `0042`). Ver §34.

## §11 — O que falta medir, e que eu NÃO vou supor

Registrado como pendência aberta, porque afirmar sem medir foi o erro do dia:

**G6 — o aviso de cadastro pendente não apareceu na tela do dono.** Ele subiu em produção
(deploy `0147e294`) e a tela dele seguiu mostrando só o aviso da ANVISA. Três hipóteses, nenhuma
verificada:

1. o e-mail da solicitação não casa exatamente com o da conta (caixa, espaço, ou endereço
   diferente — ele usou três);
2. a solicitação já tem `pacienteId` preenchido, e a condição a exclui;
3. defeito no meu código.

⚠️ **Exige acesso ao banco de produção, que não tenho daqui.** Fica como primeiro item da
sprint — e a lição: um aviso que depende de três condições precisa de um jeito de saber **qual**
delas o barrou. Hoje ele só some.

> ✅ **RETIFICADO no mesmo dia — contornado pelo D-16.** O acesso não veio; o instrumento sim.
> `GET /api/fluxo/situacao` responde o ponto **e o porquê** sem tocar no banco de produção.

## §12 — A decisão: a sentinela

**D-05 — Existe UMA função que responde "em que ponto do fluxo esta pessoa está".**

Não uma tela, não um componente: uma função pura, que recebe o estado e devolve o ponto. Todas
as telas perguntam a ela; nenhuma decide por conta própria.

```
    conta?  ficha?  documentos?  solicitação aberta?
                      │
                 [ sentinela ]
                      │
        ┌─────────────┼─────────────┐
     retomar      continuar      seguir
   (etapa X)      (o que falta)   (tudo certo)
```

**Por que uma função e não uma tela:** hoje a decisão está espalhada — `/redirect` decide papel,
`destinoDepoisDoCadastro` decide destino, o painel decide avisos, e nenhum deles vê o quadro
inteiro. Foi assim que a ficha casca do `/redirect` (G2) passou a mentir para todos os outros.

**D-06 — A sentinela responde com o PONTO e o PORQUÊ, nunca só com um booleano.**
`{ ponto: 'aguardando_codigo', porque: 'signUp pendente e e-mail não verificado' }`. Sem o
porquê, o G6 se repete: a tela some e ninguém sabe qual condição a barrou.

**D-07 — Conta ANTIGA passa pela sentinela e sai por um ramo próprio** (R9). Ela não tem
solicitação, não tem procedência, e **não pode ser bloqueada** — o ponto dela é `completo_legado`.
Sem esse ramo, a sentinela trataria todo paciente pré-existente como cadastro pela metade.

**D-08 — A procedência passa a viver no paciente** (R7, fecha o G5). A ficha guarda de onde ela
veio e qual solicitação a originou. É o que permite a uma tela saber que há documentos da Greens
esperando — hoje, ninguém sabe.

**D-09 — A reconciliação é um ato explícito, não um efeito colateral.** Para quem já ficou órfão
(os três e-mails de teste), existe um caminho que liga a conta à solicitação e materializa o que
chegou. O dono já concluiu isto sozinho: _"o máximo que eu possa fazer é ver a reconciliação"_.

⚠️ **Rejeitado: reconciliar automaticamente no login.** É trabalho de rede e escrita no caminho
de entrada — mesma razão pela qual materializar no `/redirect` foi rejeitado (§5, D-04). Falha
de rede viraria falha de login.

## §13 — Os modos de falha, etapa por etapa

O estudo que o R1 e o R5 pedem. Cada linha é um estado que **acontece**, não um exercício.

| #   | etapa                           | o que pode falhar                                              | hoje                                           | com a sentinela                                              |
| --- | ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| 1   | Greens cria a solicitação       | assinatura inválida, documento recusado (SSRF, 403, sem HTTPS) | recusa e loga                                  | igual — já é o certo                                         |
| 1b  | documento do parceiro não baixa | `origem_nao_autorizada`, `http_403` — **medido no log**        | manifesto diz que veio, arquivo não existe     | ponto **dado_incompleto**, e a tela diz **qual** faltou (R6) |
| 2   | paciente abre o link            | link expirado, já usado, token inválido                        | mensagem certa                                 | igual                                                        |
| 3   | `signUp.create`                 | e-mail já tem conta; sessão de outro                           | tratado hoje                                   | ponto **conta_existente** ou **sessao_alheia**               |
| 4   | código do e-mail                | expira, chega tarde, aba fecha, troca de aparelho              | retomada **só na mesma aba** (senha em estado) | ponto **aguardando_codigo**, retomável de qualquer lugar     |
| 5   | `update` completa a conta       | rede cai entre verificar e completar                           | cadastro pendente sem conta                    | ponto **conta_incompleta**, com caminho                      |
| 6   | ficha grava                     | exceção pós-transação                                          | preserva o cadastro (corrigido hoje)           | ponto **ficha_gravada_parcial**                              |
| 7   | materialização                  | link do parceiro expirou, MIME recusado                        | **silenciosa** — `{inseridos: 0}`              | ponto **documentos_nao_materializados** (R6)                 |
| 8   | transferência S2                | sem consentimento, trava desligada                             | não enfileira, loga `info`                     | visível ao paciente e ao admin                               |

> ⚠️ **RETIFICADA A LINHA 4 em 13/09/2026.** Ela prometia _"retomável de qualquer lugar"_.
> Medido: retomar com o formulário zerado **gravaria ficha vazia**, porque a confirmação do
> código chama `gravarFicha()`, que lê anexos, consentimento e respostas clínicas do estado do
> React. O que se entrega é retomada de qualquer lugar **refazendo a etapa 1**, com a tela
> dizendo o que aconteceu. Ver §33.3 e o D-17.

🔴 **As linhas 1b e 7 são o R6 inteiro.** As duas falham em silêncio hoje, e as duas produzem
exatamente o que o dono viu: o sistema afirmando "0 documentos" enquanto quatro tinham sido
entregues. **Não basta não quebrar — tem que dizer.**

## §14 — O que isto NÃO resolve

- **não recupera** documento cujo link do parceiro já expirou; recupera a **informação** de que
  ele existiu e não chegou
- **não desfaz** os três e-mails de teste já quebrados — para eles vale a reconciliação (D-09), e
  o teste do fluxo real pede e-mail novo, como o próprio dono concluiu
- **não cria** verificação de e-mail própria; a conta continua nascendo no Clerk, na confirmação
  (medido e decidido hoje)

---

# PARTE III — A investigação exaustiva

> **Acrescentado em 12/09/2026**, depois de o dono recusar a Parte II por ela ter parado cedo:
> _"o suficiente nunca é suficiente se ele já não teve todas as formas de pesquisa e busca de
> dados possíveis"_. A regra que saiu disso está no `CLAUDE.md`, e esta parte é a primeira
> aplicação dela.

## §15 — Correlação com a literatura (pergunta 4 da regra)

Duas coisas que eu vinha tratando como problema nosso **têm nome, e solução conhecida**.

### 15.1 O fluxo entre as empresas é uma SAGA distribuída

O padrão descreve exatamente o que temos: _"uma transação que abrange vários serviços como uma
sequência de transações locais, cada uma commitando no seu próprio serviço e publicando um
evento que dispara o passo seguinte"_.

🔴 **E o nosso é o pior dos dois estilos.** A literatura separa **coreografia** (cada serviço
reage a eventos) de **orquestração** (um coordenador central manda). O nosso é coreografia —
e **sem compensação**: quando um passo falha, nada desfaz nem marca os anteriores.

> _"Quando um passo falha, a saga executa transações compensatórias para desfazer os passos já
> completados… Um passo de compensação é uma ação nova com significado de negócio: estornar,
> liberar estoque, enviar evento de correção, ou **marcar a requisição como cancelada**."_

**Nós não temos nenhuma das três.** O cadastro do dono ficou parado no meio: a Greens acha que
enviou, a BeHemp tem a solicitação aberta, a conta existe, a ficha não, e ninguém marca nada.

#### 🔴 RETIFICAÇÃO, no mesmo dia: "orquestração ganha" estava errado pela metade

Escrevi acima, numa primeira leitura, que **orquestração ganha**. Aprofundando a pesquisa — o
passo 3 da regra do `CLAUDE.md`, julgar em vez de copiar — a literatura diz o contrário para
metade do problema:

> _"Coreografia pode ser mais adequada para preservar independência e alinhamento se os
> serviços pertencem a **times ou organizações diferentes**, enquanto orquestração pode ser
> mais conveniente se pertencem ao **mesmo time ou organização**."_

**Greens e BeHemp são duas empresas.** Pelo critério da literatura, a integração entre elas
**deve continuar coreografada** — e é o que já é: eventos assinados, cada lado reagindo ao seu.
Trocar isso por um orquestrador central criaria acoplamento entre organizações que hoje não
existe, e daria a uma empresa controle sobre o fluxo da outra.

E a mesma fonte dá a saída: _"Você pode usar uma abordagem **híbrida**, com partes da saga
coreografadas e outras orquestradas, conforme o contexto."_

**D-10 (retificado) — Híbrido, com a fronteira na empresa.**

| onde                      | estilo                         | por quê                                                                                     |
| ------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| **entre** Greens e BeHemp | **coreografia** — como já é    | organizações diferentes; independência é requisito, não acidente                            |
| **dentro** da BeHemp      | **orquestração** — a sentinela | mesmo time; e é um fluxo _stateful_ e crítico, onde a literatura diz que orquestração vence |

🔴 **A sentinela é o orquestrador de DENTRO, e só dele.** Ela não manda na Greens nem pergunta
nada a ela: lê o que já chegou e responde em que passo **o nosso lado** está. É o que o R8
pediu — e a fronteira é o que impede a solução de virar acoplamento entre empresas.

⚠️ **O que a coreografia entre as empresas ainda não tem é compensação** (§15.1). Isso continua
valendo, e não exige orquestrador: é o evento de correção que falta — _"marcar a requisição como
cancelada"_ — e ele vai na direção BeHemp → Greens, pelo mesmo canal assinado de hoje.

**Fonte:** [Saga Orchestration vs Choreography — Temporal](https://temporal.io/blog/to-choreograph-or-orchestrate-your-saga-that-is-the-question) ·
[Choreography vs Orchestration — trade-offs](https://dev.to/aloknecessary/saga-orchestration-vs-choreography-making-the-right-trade-off-in-event-driven-systems-5fmm)

### 15.2 O estado do dono tem nome: ORPHANED ACCOUNT

> _"Contas de usuário são consideradas órfãs quando não têm contraparte numa fonte autoritativa
> externa… Contas órfãs são identificadas durante a RECONCILIAÇÃO."_

E a prática estabelecida é reconciliação **periódica** contra a fonte autoritativa, não
correção manual caso a caso.

**Aqui a fonte autoritativa é `solicitacoes_cadastro`** — o que a Greens mandou. A conta no
Clerk é o _account_. Ligar os dois é literalmente o que a literatura chama de reconciliação.

⚠️ **Isto confirma o D-09 e muda o peso dele:** reconciliação não é um script de emergência
para os três e-mails de teste. É uma rotina que o sistema precisa ter para sempre.

**Fontes lidas:** [Saga pattern — microservices.io](https://microservices.io/patterns/data/saga.html) ·
[Saga — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga) ·
[Identity Reconciliation — OpenIAM](https://www.openiam.com/workforce-identity-concepts/identity-lifecycle-management/reconciliation) ·
[Reconcile orphaned accounts — Google Cloud](https://docs.cloud.google.com/architecture/identity/reconciling-orphaned-managed-user-accounts)

## §16 — SETE criadores de ficha, sete estados diferentes (G7)

Medido em 12/09/2026 — e é a causa estrutural do G2, que a Parte I só tinha descrito.

| quem cria `pacientes`                      | campos que grava                              |
| ------------------------------------------ | --------------------------------------------- |
| `app/(auth)/redirect/page.tsx`             | `userId`, `medicoId`, `status`, `jornadaFase` |
| `app/(medico)/_actions/pacientes.ts`       | `medicoId`, `dataNascimento`, `cpf`, `status` |
| `app/_actions/perfil-paciente.ts`          | `userId`                                      |
| `app/_actions/documentos-paciente-self.ts` | `userId`, `status`, `jornadaFase`             |
| `app/_actions/pacientes.ts`                | `dataNascimento`, `cpf`, `genero`             |
| `app/_actions/cadastro-por-link.ts`        | `userId` (+ os demais no mesmo bloco)         |
| `app/api/webhooks/clerk/route.ts`          | `medicoId`, `status`, `jornadaFase`           |

🔴 **Sete pontos, sete conjuntos de campos, e NENHUM marca que a ficha nasceu incompleta.**
Depois que a linha existe, toda tela que pergunta "tem ficha?" recebe sim — e não há como
distinguir a ficha do cadastro completo da casca criada no login.

**G7 — não existe o conceito de "ficha completa".** É o que permite ao G2 mentir, e é por isso
que remover só o criador do `/redirect` (o rejeitado do §5) não resolveria: sobrariam seis.

> ⚠️ **RETIFICADO em 13/09/2026 — parcial, E O PARCIAL É DE PROPÓSITO.** Hoje **1 dos 7** grava
> procedência (`cadastro-por-link.ts`). Os outros seis continuam sem — e é o que o D-11 quis:
> `origem IS NULL` **é** a declaração de que a ficha nasceu de lado. O que faltava era o
> documento dizer que o nulo carrega significado. Ver §34.

**D-11 — A ficha declara se está completa, e quem a completou.** Não um booleano solto: a
mesma coluna de procedência do D-08 responde as duas perguntas — de onde veio e por qual
caminho nasceu. Uma ficha sem procedência é uma ficha que nasceu de lado.

## §17 — Nenhuma varredura existe (G8)

Medido:

```
scripts/       — nenhum script de reconciliação
app/api/cron/  — verificar-recompra-medicamentos
                 verificar-revisoes-dosagem
                 verificar-validade-documentos
grep solicitacoesCadastro em app/api/cron e app/api/parceiros — ZERO
```

O único agendamento que toca o fluxo do parceiro é `filas.yml`, a cada 5 minutos, e ele só
**esvazia eventos de saída**. Ninguém olha para trás.

**G8 — solicitação parada não é vista por ninguém, nunca.** Ela expira em 7 dias e continua no
banco, sem que nada a marque como perdida nem avise quem a criou. Do lado da Greens, o pedido
fica esperando um cadastro que já não pode acontecer (§13, linha 5).

⚠️ **É exatamente o que a literatura de reconciliação resolve com varredura periódica** — e o
que a saga resolveria com uma compensação: _"marcar a requisição como cancelada"_.

### 15.3 🔴 E o passo 4: adotar saga DENTRO de casa nos deixaria PIORES

O quarto trabalho da regra do `CLAUDE.md` é julgar se o padrão nos deixa melhores — ou só mais
parecidos com o mercado. Aqui a resposta é **não adotar**, e a literatura dá o critério:

> _"A melhor opção é frequentemente **evitar transações distribuídas inteiramente**, movendo as
> escritas relacionadas para um único serviço… Se você não está de fato numa arquitetura de
> microsserviços, pergunte se consegue mover as escritas relacionadas para um serviço só. Essa
> abordagem mantém as propriedades ACID sem a complexidade da saga."_

> _"Use sagas quando precisa manter dados consistentes entre serviços que **têm bancos
> próprios**, e consegue conviver com consistência eventual."_

**Medido:** dentro da BeHemp, `users`, `pacientes`, `documentos`, `consentimentos` e
`solicitacoes_cadastro` vivem **no mesmo Postgres**. Não há serviço separado, não há banco
próprio, não há nada a distribuir. **Saga aqui seria complexidade sem o problema que ela
resolve** — e traria junto a pior parte dela: _"falta de rollback automático e de isolamento…
o desenvolvedor precisa implementar contramedidas de design"_.

**D-12 — Dentro de casa: transação e máquina de estados. Saga só na fronteira.**

| camada            | o padrão certo                                   | por quê                                                                    |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| entre as empresas | **saga coreografada** (o que já é) + compensação | bancos diferentes, empresas diferentes, consistência eventual é inevitável |
| dentro da BeHemp  | **transação** + **máquina de estados**           | um banco só; ACID está disponível e é mais forte que qualquer compensação  |

🔴 **Isto muda o que a sentinela É.** Ela não é um orquestrador de saga — é a **máquina de
estados** que lê o estado consolidado de um banco só e diz em que ponto a pessoa está. Mais
simples, mais barata, e sem o débito que a saga cobra.

⚠️ **E acende um alerta sobre o que já temos.** Os passos pós-transação do
`concluirCadastroPorLink` — anexos, consentimento, materialização — estão **fora** da transação,
cada um com o seu `catch`. Isso é, de fato, uma saga caseira dentro de um banco que suporta
ACID. Foi decisão consciente (_"anexo que falha não desfaz cadastro que deu certo"_) e continua
defensável: são efeitos externos (upload em blob, rede), que não pertencem a uma transação de
banco. **Mas o que falta é a outra metade da saga: quando um deles falha, nada marca.** É o G7
e o R6 pelo mesmo caminho.

⚠️ **Um dado que a literatura dá e que vale como aviso:** _"sagas coreografadas são simples de
começar, e difíceis de depurar a partir de cinco passos"_. O nosso fluxo tem **exatamente cinco
fatos** (§2). Estamos no limite onde o padrão começa a cobrar.

**Fontes lidas:** [The limits of the Saga pattern — Uwe Friedrichsen](https://www.ufried.com/blog/limits_of_saga_pattern/) ·
[Distributed Transactions: The Trade-Off Most Miss](https://medium.com/beyond-localhost/distributed-transactions-the-trade-off-most-miss-a10da4f47053)

---

# PARTE IV — O outro lado (pergunta 2 da regra)

> Varredura do repositório `greens-corp` em 12/09/2026. É a pergunta que eu não tinha feito:
> **examinei o que vem do outro lado?** As respostas mudam o desenho, e duas delas são graves.

## §18 — Vocabulário: o que chamamos de S2 lá se chama E1

Primeira coisa que a varredura corrigiu, e vale registrar para não errarmos nas conversas:

| nós chamamos                              | eles chamam  | direção                                |
| ----------------------------------------- | ------------ | -------------------------------------- |
| **S2 / handoff** (cadastro indo para nós) | **E1 (ida)** | Greens → BeHemp                        |
| —                                         | **S2**       | BeHemp → Greens (cadastro entrando lá) |

Fonte: `greens-corp-backend/src/modules/parceiros/behemp/BehempController.ts:14-17`.

## §19 — O contrato real da ida, medido no código deles

`HandoffService.ts:233-249` — **sete campos**, e nenhum a mais:

```
nomeCompleto · email · telefone · cpf · pedidoDoParceiro · documentos · urlDeRetorno
```

Assinatura (`assinatura.ts`): `HMAC-SHA256` sobre `` `${eventoId}.${timestamp}.${corpoCru}` ``,
timestamp em **segundos**, janela ±300 s, `eventoId` = `medicationRequest.id` — **estável por
encaminhamento**, que é a chave de idempotência deles.

⚠️ **O `eventoId` estável é bom para nós e vale preservar:** reenvio do mesmo encaminhamento
chega com o mesmo id, e o nosso índice já trata como reentrega.

## §20 — O que eu suspeitei e ESTAVA ERRADO (medido, não suposto)

Duas hipóteses minhas que a varredura derrubou. Ficam escritas porque supor sem medir foi o
erro do dia.

### 20.1 O e-mail divergente NÃO explica o G6

A varredura achou que **a Greens envia o e-mail cru** — `medicationRequestValidator.ts:57-59`
aceita `" Joao@Gmail.COM "` sem `trim` nem `toLowerCase`. Pareceu a causa do aviso não aparecer.

**Não é.** Nós normalizamos nas **duas** pontas de entrada:

```
app/api/parceiros/greens/cadastro/route.ts:43   z.string().trim().toLowerCase().email()
lib/parceiros/handoff.ts:119                    entrada.email?.trim().toLowerCase() || null
```

🔴 **Mas o achado continua valendo como risco do lado deles:** quem casar paciente por e-mail
sem normalizar vai divergir de nós. Já está no §12 do documento-ponte como coisa a avisar.

### 20.2 A URL de documento expirando em 1 h NÃO nos atinge

Eles assinam URLs S3 com **TTL de 1 hora** (`HandoffService.ts:193`), e o paciente tem **7 dias**
para abrir o link. Pareceu buraco garantido.

**Não é**, porque baixamos na **entrada**, não no cadastro: `handoff.ts:157,186` chamam
`manifestoComArquivos` durante o handoff, dentro da janela. O comentário do nosso código já
dizia (`handoff.ts:85`): _"baixado e re-hospedado aqui, e o paciente não precisa reenviar"_.

⚠️ **E isso decide uma coisa que estava aberta:** a materialização em background que o §12 do
documento-ponte propõe **não pode** buscar na URL do parceiro depois — ela já estaria morta.
Tem de partir do que re-hospedamos.

## §21 — O que o outro lado NÃO tem, e que muda o nosso desenho

| #      | achado no lado deles                                                                                            | onde                                                  | o que significa para nós                                                                         |
| ------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **X1** | **falha na ida não persiste nada** — `behempJourney` fica `NONE`, só `logger.error`, e o log some a cada deploy | `HandoffService.ts:386-408`, `:290-292`               | se o POST falhar, **nem eles nem nós** sabemos que existiu um paciente. Não há o que reconciliar |
| **X2** | **paciente que nunca conclui: nada acontece** — `SENT_TO_BEHEMP` para sempre, sem timeout, sem expiração        | `schema.prisma:1362-1364`                             | o pedido fica aberto lá indefinidamente. **Só nós podemos avisar**                               |
| **X3** | **nenhuma reconciliação, nenhum cron toca a integração** — `grep -ril behemp src/jobs/` vazio                   | 12 crons, nenhum do parceiro                          | a varredura tem de ser **nossa**; esperar por eles é esperar por nada                            |
| **X4** | a saúde deles é **agregada**: dá para ver que 40 foram e 3 voltaram, **não quais 37** faltam                    | `SaudeService.ts:195-199`                             | eles não conseguem nos dizer quem parou. A lista tem de sair do nosso lado                       |
| **X5** | **sem retry, sem fila** na ida — o único retry é um botão no navegador do paciente                              | `SaudeService.ts:50`, `PatientIntakeFlow.tsx:599-612` | um handoff perdido **só volta se o paciente clicar**. Se ele fechou a aba, acabou                |

🔴 **X2 + X3 + X4 juntos dizem uma coisa só: do lado deles, o paciente que para no meio é
invisível por construção.** Não é descuido — é ausência de mecanismo. Qualquer aviso sobre
cadastro parado tem de nascer aqui.

**D-13 — A compensação da saga (§15.1) sai da BeHemp para a Greens, e é nossa responsabilidade.**
Quando a sentinela detectar cadastro abandonado, o evento de correção — _"marcar a requisição
como cancelada"_ — viaja pelo canal assinado que já existe. Eles não têm como descobrir sozinhos.

⚠️ **Exige acordo com a Greens:** o validador deles hoje aceita só `receita_emitida` e
`anvisa_aprovada` (`behempValidator.ts:30`). Um tipo novo é mudança dos dois lados. Entra no §12
do documento-ponte como proposta, não como fato.

## §22 — O que achamos do lado deles e é problema DELES (comunicar, não corrigir)

Registrado aqui porque afeta o fluxo do paciente, e porque o §12 do documento-ponte é o canal.

| #      | achado                                                                                                                                                    | gravidade                             |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Y1** | o S2 **nunca marca `CAME_FROM_BEHEMP`** — e a jornada é o insumo do roteamento de gateway e do desconto. Todo paciente vindo de nós cai no gateway errado | 🔴 afeta cobrança                     |
| **Y2** | `behempReferralId` **sem `@unique`**, e a volta usa `findFirst` — colisão aplica o evento no pedido errado, em silêncio                                   | 🔴 já catalogado como R8 lá, e adiado |
| **Y3** | **S2 sem allowlist configurada aceita o cadastro e descarta 100% dos documentos sem erro**                                                                | 🔴 silencioso                         |
| **Y4** | `503` para "2xx sem referralId" faz a tela oferecer "tentar de novo" para um erro que retry nunca resolve                                                 | 🟠 paciente em loop                   |
| **Y5** | a ADR-0027 deles diz que o envio automático foi **rejeitado**; o código envia automático desde 11/09                                                      | 🟠 doc mente                          |
| **Y6** | `window.location.href = data.urlDeContinuacao` sem conferir origem                                                                                        | 🟠 confiam na URL que mandamos        |

⚠️ **O Y6 é sobre nós:** eles consomem a URL que **a BeHemp** devolve, sem validar. Se o nosso
lado for comprometido, o paciente deles vai para onde mandarmos. Não é defeito nosso, mas a
confiança é — e vale dizer a eles.

---

# PARTE V — Os modos de falha do nosso lado (perguntas 5 e 6)

> Varredura exaustiva do fluxo em 12/09/2026. **22 falhas silenciosas** e **14 gaps**. Aqui
> ficam os que mudam decisão; a lista inteira está no §24.

## §23 — 🔴 O achado mais grave, e ele é de LGPD

**G9 — revogar o consentimento NÃO impede o envio de um evento já enfileirado.**

Medido:

```
lib/parceiros/enviador.ts        — nenhuma releitura de consentimento antes do POST
db/schema/parceiro-eventos-saida.ts:52 — `payload` é jsonb, congelado no enfileiramento
```

O consentimento é conferido **uma vez**, quando o evento entra na fila. O `enviador` pega o
payload gravado e envia. **Entre os dois momentos o paciente pode revogar — e o dado sai assim
mesmo.**

⚠️ **A LGPD art. 8º §5º diz que a revogação é "a qualquer momento".** Um consentimento que só
vale até o evento entrar na fila não é revogável a qualquer momento: é revogável até a fila
rodar, e o paciente não tem como saber quando isso foi.

⚠️ **E a janela não é teórica.** A fila anda por GitHub Actions a cada 5 minutos
(`filas.yml:26`), com retry de até 6 tentativas e backoff até 60 minutos (`enviador.ts:17,57`).
Um evento pode sair **horas** depois de enfileirado.

🔴 **Isto é mais urgente que tudo o mais desta ADR.** Não é experiência ruim: é dado de saúde
saindo da empresa sem autorização válida.

**D-14 — O enviador relê o consentimento imediatamente antes do POST, e recusa se foi
revogado.** O evento vira `cancelado_por_revogacao`, não `falhou` — a diferença importa para
quem lê a fila depois.

⚠️ **Custo aceito:** uma consulta a mais por evento enviado. Barato perto do que evita.

## §24 — Os outros gaps, em ordem de risco ao paciente

| #       | gap                                                               | onde                                    | por que importa                                                                                                                                                                        |
| ------- | ----------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G10** | o link é **queimado antes** de o `pacienteId` ser gravado         | `cadastro-por-link.ts:327` vs `:342`    | se a gravação seguinte falhar: link morto **e** `pacienteId` nulo. O aviso de pendência nunca aparece (exige `usadoEm IS NULL`) e o parceiro nunca é avisado da receita                |
| **G11** | corrida webhook × transação viola o unique de `pacientes.userId`  | `:304` sem `onConflictDoNothing`        | o webhook do Clerk insere entre o `SELECT` e o `INSERT` → transação aborta → paciente lê "não conseguimos concluir" **com a conta já criada**. É um candidato ao erro original do dono |
| **G12** | eventos presos em `enviando`/`processando` **para sempre**        | `enviador.ts:136`, `processador.ts:117` | não existe reaper. Crash ou deploy no meio do lote e "receita pronta" some                                                                                                             |
| **G13** | "cadastro concluído" com documentos, consentimento ou S2 perdidos | `cadastro-por-link.ts:500-502`          | é a decisão de hoje (preservar o cadastro), mas **nenhuma tela mostra o que faltou**                                                                                                   |
| **G14** | webhook do Clerk sem idempotência por `svix-id`                   | `webhooks/clerk/route.ts`               | reentrega duplica notificação e **sobrescreve o `clerkId`** de um usuário existente                                                                                                    |
| **G15** | crons do `vercel.json` **nunca rodam** e são _fail-open_          | `vercel.json:3-17`                      | validade de documento e revisão de dosagem nunca avisam; e sem `CRON_SECRET` o endpoint é público                                                                                      |
| **G16** | solicitação nunca usada fica **para sempre**                      | `enums.ts:348`                          | o status `expirada` nunca é atribuído, não há expurgo: nome, e-mail, CPF e blobs ficam indefinidamente                                                                                 |
| **G17** | `solicitacoes_cadastro.pacienteId` **sem FK**                     | `solicitacoes-cadastro.ts:209`          | ponteiro morto silencioso                                                                                                                                                              |
| **G18** | painel vazio **sem erro**                                         | `paciente/page.tsx:109-111`             | a action falha, `dados` fica `null`, e a tela renderiza vazia sem mensagem — foi o que o dono viu                                                                                      |
| **G19** | `laudo_medico` sem destino no enum                                | `anexo-do-cadastro.ts:79`               | o laudo enviado **desaparece** da ficha                                                                                                                                                |

⚠️ **O G18 explica metade do relato do dono.** Ele viu painel vazio; nós nunca soubemos se foi
ausência de dado ou falha da consulta. **São coisas diferentes, e a tela mostrava a mesma
coisa** — que é exatamente o R6.

## §25 — Onde o silêncio é decisão e onde é descuido

A varredura achou **22 falhas silenciosas**. Elas não são todas iguais, e tratá-las igual seria
errado:

| categoria                                   | exemplos                                                                                             | o que fazer                                      |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **silêncio deliberado e correto**           | `enfileirarTransferencia` não lança (derrubaria o cadastro); `registrarAuditoria` não falha a action | **manter** — e está documentado no código        |
| **silêncio deliberado, informação perdida** | materialização devolve `{inseridos:0}`; anexo devolve `false`                                        | **manter o não-lançar, registrar o motivo** (R6) |
| **silêncio por descuido**                   | `catch {}` no revogar (`consentimento.ts:143`); webhook engolindo tudo                               | **corrigir**                                     |

🔴 **A regra que sai:** não lançar é decisão legítima; **não registrar não é**. Toda falha
engolida tem de deixar rastro consultável — senão o sistema não tem como responder "o que deu
errado com este paciente", que é a pergunta que o dono fez o dia inteiro.

## §26 — O que isto muda na Sprint 8

A ordem da sprint estava errada. Com os achados:

| ordem         | item                                                     | por quê mudou                                           |
| ------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| **0 (novo)**  | **G9 — revogação vs fila**                               | LGPD. Precede tudo                                      |
| 1             | G6 — por que o aviso não apareceu                        | inalterado, ainda bloqueia a sentinela                  |
| **1b (novo)** | **G10 — inverter a ordem do consumo do link**            | uma linha, e fecha um estado irrecuperável              |
| **1c (novo)** | **G11 — `onConflictDoNothing` no insert de `pacientes`** | uma linha, e é candidato ao erro original               |
| 2             | S8.2 procedência                                         | inalterado                                              |
| 3             | S8.3 sentinela                                           | agora é **máquina de estados**, não orquestrador (D-12) |
| 4             | S8.4 verdade sobre o que não chegou                      | ganhou o G18: distinguir ausência de falha              |
| **4b (novo)** | **G12 — reaper de `enviando`/`processando`**             | sem ele, a fila perde evento em silêncio                |
| 5             | S8.5 retomada                                            | inalterado                                              |
| 6             | S8.6 reconciliação                                       | e agora com fundamento: §15.2                           |

⚠️ **Os itens 1b e 1c são de uma linha cada e fecham buracos graves.** Vão antes de qualquer
coisa estrutural — é o oposto de começar pela arquitetura.

---

# PARTE VI — O planejamento, e como ele fecha as quatro portas

> **Escrito em 13/09/2026**, a pedido do dono, depois de ele informar a peça que faltava:
> **quatro caminhos diferentes chegam na mesma tela** `/cadastro/[token]`.

## §27 — As quatro portas, e como cada uma se identifica hoje

| a porta                                                | grava origem?                    | onde                           |
| ------------------------------------------------------ | -------------------------------- | ------------------------------ |
| 1. link automático do ChatPro (requisição externa)     | ✅ `chatpro_bot`                 | `lib/chatpro/solicitacao.ts`   |
| 2. redirect do formulário da Greens                    | ✅ `greens_handoff`              | `lib/parceiros/handoff.ts`     |
| 3. link do admin em solicitação de medicação           | ⚠️ **só pelo default da coluna** | `solicitacoes-cadastro.ts:132` |
| 4. link do ChatPro da BeHemp (paciente sem procuração) | ✅ `chatpro_start`               | `lib/chatpro/solicitacao.ts`   |

🔴 **A porta 3 funciona por acidente.** Ninguém grava `painel_admin` — ela cai no `default()` da
coluna. Se alguém mudar esse default amanhã, **todo link de admin passa a mentir sobre de onde
veio**. E `chatpro_webhook` existe no enum e ninguém grava: valor morto.

**Isso não é detalhe:** todo o planejamento depende de saber de onde o paciente veio. Uma porta
que só acerta por omissão é uma porta que vai errar.

**G20 — a porta do admin não declara a própria origem.**
**Decisão do dono, 13/09/2026:** _"sim, deve gravar"_. Vira o **D-15**.

## §28 — O problema em uma frase

**A BeHemp trata "conta criada" e "cadastro concluído" como se fossem a mesma coisa — e não
são.** Entre os dois existe um vão onde o paciente cai, e ninguém olha para dentro dele.

Foi exatamente onde o dono caiu: conta funcionando, painel vazio, documentos invisíveis, e o
link ainda válido. **As três coisas verdadeiras ao mesmo tempo, e nenhuma tela ligando uma à
outra.**

## §29 — O plano, em três movimentos

### Movimento 1 — Tapar os buracos que já estão sangrando

Três itens, **dois deles de uma linha**. Antes de qualquer arquitetura.

| item      | o quê                              | por que primeiro                                                                                                                                                                 |
| --------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S8.0**  | a revogação tem que parar a fila   | o consentimento é conferido ao enfileirar, e o enviador **não relê**. Entre os dois passam horas. Revogar nesse intervalo não impede o envio — e a LGPD diz "a qualquer momento" |
| **S8.1b** | inverter duas linhas               | o link é queimado **antes** de gravar o `pacienteId`. Falha ali e o paciente perde o link **e** o vínculo — some o aviso de pendência **e** o retorno ao parceiro, de uma vez    |
| **S8.1c** | uma linha de `onConflictDoNothing` | o webhook do Clerk pode inserir a ficha no meio da transação e abortá-la inteira. **É candidato ao erro que o dono viu**                                                         |

### Movimento 2 — Fazer o sistema saber de onde você veio e onde você está

**S8.2 — a procedência sobrevive.** Hoje a origem morre quando a ficha nasce: depois disso, um
paciente da Greens é indistinguível de quem se cadastrou sozinho. Vira coluna em `pacientes`,
junto com o id da solicitação. **E é aqui que as quatro portas entram** — cada uma grava a sua,
inclusive a 3.

**S8.3 — a sentinela.** Uma função que responde _"em que ponto do fluxo esta pessoa está, e por
quê"_. Todas as telas perguntam a ela; nenhuma decide sozinha — que é como a ficha casca do
`/redirect` passou a mentir para todas as outras.

⚠️ **A pesquisa mudou o que ela é** (§15.3). Eu ia construir um "orquestrador de saga". A
literatura mostrou que saga serve para bancos separados, e dentro da BeHemp está tudo num
Postgres só. **É uma máquina de estados** — mais simples e mais barata.

### Movimento 3 — Verdade e recuperação

| item     | o quê                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **S8.4** | dizer o que **não chegou**. Hoje a tela mostra "0 documentos" tanto quando o paciente não enviou quanto quando a Greens enviou e não chegou. São coisas diferentes, e a tela dizia a mesma — foi o que o fez parar |
| **S8.5** | retomar de qualquer lugar. Hoje só funciona na mesma aba                                                                                                                                                           |
| **S8.6** | reconciliação — o ato que liga conta e solicitação para quem já ficou órfão                                                                                                                                        |

## §30 — Como isso se encaixa nos quatro fluxos

| fluxo                         | o que ele precisa                                                              | o que o plano entrega                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| **1 — sem ANVISA, da Greens** | documentos já preenchidos na tela da ANVISA; notificação; envio automático     | **S8.2** (a ficha sabe que veio da Greens) + **S8.4** (se um documento não chegou, **diz**) |
| **2 — sem receita**           | pendências como aviso; vai ao agendamento; receita volta com consentimento     | **S8.0** — é aqui que a receita vai para a Greens, e é aqui que a revogação tem de valer    |
| **3 — recompra**              | receber o paciente **já roteado** pela Greens                                  | **S8.3** — a sentinela confirma o que a Greens supôs, e corrige quando ela errar            |
| **4 — paciente novo**         | formulário completo; agendamento; aviso da ANVISA depois; consentimento no fim | **S8.5** (retomar) + **S8.3** (o aviso da ANVISA aparece no momento certo, não sempre)      |

#### 🔴 RETIFICAÇÃO do fluxo 3, 13/09/2026 — a escolha é DELES, não nossa

Escrevi acima, numa primeira versão, que o fluxo 3 precisava de _"dois caminhos: tem conta /
não tem"_ do nosso lado. **Errado.** Correção do dono:

> _"isso é feito dentro da Greens, não da BeHemp, no fluxo 3"_ — e, sobre a tela de escolha:
> _"isso já existe lá"_.

**A tela dos dois botões é da Greens, e já está pronta lá.** Quando o paciente chega aqui, ele
**já foi roteado**: ou veio para o login, ou veio para o cadastro. A BeHemp não escolhe — recebe.

⚠️ **E isto resolve uma pendência aberta desde 12/09:** a tela `/acesso` da BeHemp (a P4 do
`docs/11`, marcada "feita" e sem nenhuma navegação apontando para ela) **duplica** o que já
existe do outro lado. Fica como está — decisão do dono: _"se você já fez, deixa lá"_ —, mas
**sai da lista de coisas a ligar**, e o `docs/11` precisa dizer que a P4 é responsabilidade da
Greens.

🔴 **O que continua sendo nosso no fluxo 3, e é onde a sentinela entra:** a Greens roteia com o
que ela sabe — e ela **não sabe** se o cadastro daqui foi concluído. Um paciente que ela mandar
para o login pode ter conta **sem ficha** (o vão do §28). A sentinela é quem confirma o
roteamento dela e corrige quando ele estiver errado.

🔴 **O que é comum aos quatro:** todos chegam na mesma tela, todos podem parar no meio, e hoje
**nenhum deles sabe dizer onde parou**. A sentinela é a peça que serve aos quatro — **não é uma
por fluxo**.

## §31 — Por que isso resolve, e não só remedia

Os seis defeitos achados em 12/09 eram sintomas do mesmo vão: destino 404, documentos
invisíveis, sessão trocada, conta sem senha, aviso que não aparece, painel vazio. Cada um tinha
correção própria — e eu fui corrigindo um por um, enquanto o dono achava o seguinte.

**A sentinela ataca a causa:** se existe uma função que sabe em que ponto a pessoa está, nenhuma
tela precisa adivinhar — e **a próxima porta de entrada que criarem já nasce coberta**.

## §32 — 🔴 Sem banco e sem VPS: o S8.1 muda de forma

**Restrição do dono, 13/09/2026:** _"eu não tenho acesso ao banco de produção agora nem à VPS e
não vou conseguir; temos que contornar isso"_.

O S8.1 dependia de consultar a solicitação em produção para descobrir **qual** das três condições
barra o aviso. Sem banco, ele para — e ele **bloqueia a sentinela**.

**D-16 — Constrói-se o instrumento, em vez de esperar o acesso.**

É a mesma lição que o `%3F` cobrou caro em 11/09: duas correções falharam por adivinhação, e o
que resolveu foi criar `GET /api/chatpro/eco` e **perguntar ao servidor o que ele via**. O
comentário que ficou no módulo diz: _"eu gastei dois deploys porque não havia como perguntar ao
servidor o que ele via. O instrumento custou menos que a segunda tentativa."_

**O que muda no S8.1:**

| antes                            | agora                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------- |
| consultar o banco de produção    | rota de diagnóstico **autenticada** que responde por que o aviso não apareceu |
| descobrir qual condição barrou   | a própria função devolve **o motivo**, e a rota o expõe                       |
| depende de acesso que não existe | depende de um deploy, que já temos                                            |

⚠️ **E isto não é contorno temporário — é o D-06 antecipado.** A sentinela já ia ter de
responder "o ponto **e o porquê**". Construir o porquê agora, pelo instrumento, é construir a
metade da sentinela antes dela.

**Regras do instrumento**, iguais às da rota de eco: exige o mesmo segredo, tem limite de
requisição, **não ecoa cabeçalho nem corpo**, e nunca devolve dado pessoal — só o **fato** de
cada condição ter passado ou não.

---

# PARTE VII — A revisão do documento inteiro

> **Escrita em 13/09/2026**, a pedido do dono: _"eu quero que você revise todo documento da ADR
> do jeito que o `@CLAUDE.md` orienta, para que nós possamos finalizar esse fluxo"_.
>
> Não é releitura: é o documento medido contra o código, item por item, com as seis perguntas.
> **A precedência nº 1 diz que o código vence a doc** — então onde os dois divergem, quem muda é
> a doc. Exceto onde o código divergiu de uma decisão já tomada: aí quem muda é o código, e os
> dois casos abaixo são disso.

## §33 — O que a revisão ACHOU, e que não era releitura

### 33.1 🔴 O D-14 estava escrito e não implementado

O D-14 decidiu, com todas as letras: _"o evento vira `cancelado_por_revogacao`, não `falhou` — a
diferença importa para quem lê a fila depois"_. A migration `0043` foi autorizada pelo dono
**para isso**.

Medido em 13/09: `cancelado_por_revogacao` existia em `db/schema/enums.ts` e em **zero** arquivos
de `lib/` ou `app/`. O enviador chamava `marcarFalha`.

⚠️ **É a mesma classe que esta ADR nomeia no §27** sobre o `chatpro_webhook`: _"existe no enum e
ninguém grava: valor morto"_. Eu escrevi aquele parágrafo e cometi o mesmo defeito quatro seções
depois.

**Três consequências, e nenhuma é de rótulo:**

| #   | o que `falhou` causa                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **mente para quem investiga** — quem abre a fila procurando o que não chegou persegue um envio que não devia ter saído, junto de falhas reais |
| 2   | **convida a reenviar** — o reaper que o G12 pede pegaria este evento e tentaria de novo contra uma decisão do titular                         |
| 3   | **apaga a prova** — "vocês pararam quando ele revogou?" precisa de resposta no banco, não numa linha de log que some no deploy                |

**Corrigido**: `marcarCancelado` grava o status próprio, e o `enviarLote` conta `cancelados`
separado de `falharam` — somar repetiria o erro uma camada acima, com o cron dizendo "3 falharam"
sobre três pacientes que exerceram um direito.

### 33.2 🔴 E o guarda CONGELAVA esse defeito

`a-revogacao-para-a-fila` afirmava `expect(bloco).toMatch(/marcarFalha/)`. Ele ficava **verde
porque o código contrariava o D-14**, e ficou vermelho quando a correção chegou — o sinal
invertido.

⚠️ **Mesma classe do `o-destino-do-paciente-segue-o-que-falta`**, que comparava destinos com uma
lista fixa contendo os dois 404. **A regra que sai, e que vale para todo guarda:** medir a
**propriedade**, nunca o **nome do método** que a produz.

🔴 **E a sabotagem achou um terceiro defeito meu no mesmo guarda:** `toMatch(/ultimoErro:/)`
sobrevivia a `ultimoErro: 'cancelado'` — um literal fixo, sem motivo nenhum, com 40 cancelamentos
indistinguíveis no banco. **Existir não é carregar.** É a mesma classe da segunda retratação do
`CLAUDE.md`, onde `toBeTruthy()` checava que o campo existisse em vez de o valor ser válido.

### 33.3 🔴 O S8.5 — e por que a correção óbvia produziria o G2

O dono declarou pendência real: _"retomar da mesma aba deve funcionar em todas as instâncias"_. A
retomada dependia de `Boolean(senha)` no estado do React, o que a prendia à mesma aba. A correção
óbvia seria pedir a senha na etapa do código e pular para lá.

🔴 **Medido antes de mexer, e é o que inverte a decisão:** confirmar o código **não termina no
Clerk**. Ele chama `gravarFicha()`, que monta a ficha inteira a partir do estado do React —
`anexos`, `finalidadesConsentidas`, `jaFazTratamento`, `temAnvisa`, `temReceita`,
`tratamentoAtual`. Pular para a etapa do código com o estado zerado gravaria ficha **sem
documento, sem consentimento e sem as respostas clínicas**, e queimaria o link de uso único.

⚠️ **Ou seja: a correção ingênua do S8.5 produziria a FICHA CASCA (G2) pelo caminho principal,
com o paciente lendo "pronto".** O defeito que esta ADR inteira existe para fechar, entrando pela
porta da correção dele.

**A senha não era condição por ser senha — era proxy para "o formulário inteiro está em mãos".**

⛔ **Rejeitado: persistir o formulário no navegador.** `File` de documento clínico não é
serializável, e senha em `localStorage`/`sessionStorage` é o que a regra de segurança proíbe.
Persistir para conveniência sairia mais caro que o problema.

**D-17 — A retomada exige o formulário em mãos, e quando não o tem, DIZ.**

O comportamento já estava certo: sem formulário, fica na etapa 1, e ao enviar de novo o
`pendenteDoMesmoEmail` reconhece o cadastro e só reenvia o código. **O defeito era o silêncio** —
o paciente voltava, via a etapa 1 do zero e concluía que tinha perdido tudo.

Agora a tela diz os dois lados: o que sobreviveu (o cadastro, o código reenviado) e o que não (os
documentos, que precisam voltar). **Avisar só a boa notícia faria o paciente chegar ao fim sem os
arquivos** — que é como a ficha casca nasce.

⚠️ **Retifica o §13, linha 4**, que prometia _"ponto `aguardando_codigo`, retomável de qualquer
lugar"_. Retomável de qualquer lugar **com o formulário zerado** é uma ficha vazia. O que se
entrega é: retomável de qualquer lugar, **refazendo a etapa 1**, com o sistema dizendo o que
aconteceu.

### 33.4 A chave do Clerk: a pergunta estava errada

O dono informou que a `CLERK_SECRET_KEY` está nos secrets do GitHub. Duas medições fecham o
assunto, e a segunda é a que importa:

1. **Secret do GitHub não é legível.** `GET /repos/.../actions/secrets/CLERK_SECRET_KEY` devolve
   `{"name":"CLERK_SECRET_KEY","created_at":…}` — nome e datas, valor nenhum. É write-only por
   construção.
2. 🔴 **E não serviria.** A doc do Clerk: _"Production keys (`pk_live_`and`sk*live*`) only work
   with your configured production domain. This means localhost won't work with production
   keys"_, com o erro literal _"Clerk: Production Keys are only allowed for domain
   'your-domain.com'"\_.

**O que serve é uma chave de DESENVOLVIMENTO** (`sk_test_`/`pk_test_`), que toda aplicação do
Clerk tem de graça, numa instância separada — _"a Development instance… allowing HTTP connections"_.

⚠️ **Registrado como o que é: um bloqueio de acesso, não um bloqueio técnico.** E o
`NEXT_PUBLIC_CLERK_API_URL` existe (default `https://api.clerk.com`, _"sets the Clerk API URL for
debugging"_) — é o caminho para um duplo local, se a instância de desenvolvimento não vier.

**Fontes:** [Using production keys in development — Clerk](https://clerk.com/docs/guides/development/troubleshooting/using-production-keys-in-development) ·
[Clerk environment variables](https://clerk.com/docs/guides/development/clerk-environment-variables) ·
[Managing environments](https://clerk.com/docs/guides/development/managing-environments)

## §34 — O que a implementação tornou obsoleto no documento

Medido em 13/09 contra o código. **A doc mentia em quatro pontos** — todos por estar desatualizada,
não por estar errada quando foi escrita.

| §           | o que a ADR afirma                                                        | o que o código mostra hoje                                        | estado                                     |
| ----------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| **1.5**     | _"`grep solicitacoesCadastro` em `app/(paciente)`: **zero** ocorrências"_ | `app/_actions/dashboard-paciente.ts` chama `situacaoDoFluxo`      | ✅ fechado pelo S8.3/S8.4                  |
| **10**      | _"`pacientes` **não tem** nenhuma coluna de origem"_                      | `db/schema/pacientes.ts:107,117` — `origem` e `solicitacaoId`     | ✅ fechado pelo S8.2 (migration `0042`)    |
| **16**      | _"sete criadores, e **NENHUM** marca que a ficha nasceu incompleta"_      | 1 de 7 grava `origem` (`cadastro-por-link.ts`); os outros 6 não   | ⚠️ **parcial — e o `null` é que responde** |
| **11 (G6)** | _"exige acesso ao banco de produção, que não tenho daqui"_                | `app/api/fluxo/situacao/route.ts` responde o ponto **e o porquê** | ✅ contornado pelo D-16                    |

🔴 **O §16 merece leitura, porque "parcial" aqui é de propósito e a ADR não dizia.** Seis
criadores continuam sem gravar procedência — e é isso que o D-11 quis: _"uma ficha sem procedência
é uma ficha que nasceu de lado"_. `origem IS NULL` **é** a declaração de casca. O que faltava era
o documento dizer que o nulo carrega significado, em vez de parecer campo não preenchido.

### 34.1 O D-15 foi implementado por TIPAGEM, não por gravação

O §27 diz que a porta 3 _"funciona por acidente… cai no `default()` da coluna"_. Continua verdade
sobre o default — mas a decisão foi cumprida por um caminho mais forte que gravar um literal:
`lib/chatpro/solicitacao.ts` deriva `type Origem` do **próprio enum** e a torna obrigatória, então
**a porta 3 não consegue nascer sem declarar de onde veio**. Ela ainda não existe como tela.

⚠️ **Falha fechada por tipo vale mais que gravação correta**: gravação se esquece no código novo,
tipo não compila.

## §35 — Onde a ADR desobedecia ao próprio `CLAUDE.md`

A revisão virou o documento contra as regras que ele mesmo invoca. Três achados.

### 35.1 🔴 Princípio e fase citados com glosa INVENTADA

A §8 escreve: _"Princípio **C** (o sistema informa, não esconde) e **H** (estado parcial é estado,
e se declara). Fase 7 — integração entre empresas."_

Medido em `docs/PRINCIPIOS.md`:

| citado | a glosa que escrevi                     | o que **é**             |
| ------ | --------------------------------------- | ----------------------- |
| C      | "o sistema informa, não esconde"        | **Ambientes e CI/CD**   |
| H      | "estado parcial é estado, e se declara" | **Segurança**           |
| Fase 7 | "integração entre empresas"             | **Erros e resiliência** |

⚠️ **É exatamente o que o `CLAUDE.md` proíbe** na seção de fundamentação: _"não inventar
fundamento"_ e conferir o **objeto** antes de citar. Eu inventei três glosas que soavam certas —
e a fase 7 estava certa pelo número e errada pela descrição, que é o jeito mais fácil de alguém
acreditar.

**Retificado, com os princípios reais:**

| decisões                 | princípio                                       | por quê                                                         |
| ------------------------ | ----------------------------------------------- | --------------------------------------------------------------- |
| D-01…D-07, D-12, D-17    | **D** — Tratamento de erros, resiliência e HTTP | é o assunto da ADR: estado parcial, modo de falha, recuperação  |
| D-08, D-11, D-15         | **F** — Banco de dados e arquitetura de dados   | procedência e completude são modelagem, não tela                |
| D-09, D-13, D-16         | **D** + **C** — Ambientes e CI/CD               | reconciliação e instrumento são rotina de operação              |
| **D-14**                 | **H** — Segurança                               | LGPD art. 8º §5º: é dado de saúde saindo sem autorização válida |
| todos os guardas citados | **I** — Testes automatizados e qualidade        | a classe, não o caso                                            |

**Fase 7 — Erros e resiliência**, cujo grupo no roadmap é justamente **D**. O número estava certo
desde o começo; só a descrição era inventada.

### 35.2 As perguntas 1 e 3 da regra não tinham dono no documento

A Parte III declara a pergunta 4, a Parte IV a pergunta 2, a Parte V as perguntas 5 e 6. **As
perguntas 1 (_"examinei todo o escopo do código?"_) e 3 (_"segui a lógica do começo ao fim?"_)
não tinham seção.**

Não é formalidade: foi por elas que os dois achados do §33 escaparam. O D-14 não implementado é
pergunta 1 — **o escopo do código incluía conferir se a decisão virou linha**. E o S8.5 é
pergunta 3: seguir a lógica até o fim mostrou que a confirmação do código **continua** em
`gravarFicha()`, que é onde a correção óbvia quebraria.

**Esta Parte VII é a resposta às duas.**

### 35.3 A definição de saga veio de blog, não da fonte canônica

O §15.1 abre com a definição do padrão citando **Temporal** e **dev.to**. A ordem de autoridade do
`CLAUDE.md` põe blog de engenharia **abaixo** de autor canônico — e as fontes canônicas estavam
citadas quatro parágrafos depois, no §15.2, como "fontes lidas": microservices.io (Chris
Richardson, que nomeou o padrão) e o Azure Architecture Center.

⚠️ **A decisão não muda** — coreografia entre empresas, orquestração dentro, e o D-12 continua de
pé. Mas a hierarquia da citação estava invertida, e quem lê a ADR para decidir de novo tem de
saber qual fonte pesa.

## §36 — O estado real de cada decisão, medido

**A tabela que faltava.** Sem ela, quem lê a ADR não distingue decidido de feito — e foi assim
que o D-14 passou.

| decisão  | o que decide                                        | estado em 13/09/2026                                                    |
| -------- | --------------------------------------------------- | ----------------------------------------------------------------------- |
| D-01     | conta sem ficha é estado reconhecido                | ✅ na sentinela (`lib/fluxo/sentinela.ts`)                              |
| D-02     | o painel pergunta se há cadastro pendente           | ✅ `dashboard-paciente.ts`                                              |
| D-03     | a ficha casca se declara como casca                 | ⚠️ **parcial** — `origem IS NULL` a declara; nenhuma tela lê isso ainda |
| D-04     | materialização deixa de depender do link            | ⚠️ **pendente** — segue com gatilho único                               |
| D-05     | uma função responde o ponto do fluxo                | ✅ `situacaoDoFluxo`                                                    |
| D-06     | responde o ponto **e o porquê**                     | ✅ campo `porque`, com guarda por ramo                                  |
| D-07     | conta antiga sai por ramo próprio                   | ✅ `completo_legado`, antes de cobrar documento                         |
| D-08     | a procedência vive no paciente                      | ✅ migration `0042`                                                     |
| D-09     | reconciliação é ato explícito                       | ❌ **S8.6, não começou**                                                |
| D-10     | híbrido, fronteira na empresa                       | ✅ é o desenho vigente                                                  |
| D-11     | a ficha declara se está completa                    | ⚠️ **parcial** — ver §34, o nulo é a declaração                         |
| D-12     | transação dentro, saga só na fronteira              | ✅ sentinela é máquina de estados                                       |
| D-13     | a compensação sai daqui para a Greens               | ❌ **pendente — exige acordo** (tipo novo no validador deles)           |
| D-14     | revogação vira status próprio                       | ✅ **corrigido nesta revisão** (§33.1)                                  |
| D-15     | a porta do admin declara a origem                   | ✅ por tipagem (§34.1)                                                  |
| D-16     | constrói-se o instrumento                           | ✅ `GET /api/fluxo/situacao`                                            |
| **D-17** | **retomada exige formulário, e diz quando não tem** | ✅ **desta revisão** (§33.3)                                            |

🔴 **O que sobra, em ordem:** D-09 (reconciliação, S8.6) · D-04 (materialização) · D-13 (acordo
com a Greens). Os dois primeiros são nossos e cabem na sprint; o terceiro depende de conversa.

## §37 — O que esta revisão NÃO fez

- **não rodou o fluxo de ponta a ponta** — falta a chave de desenvolvimento do Clerk (§33.4), e
  sem ela nenhuma tela com sessão renderiza localmente. O que se provou aqui foi por leitura de
  código, medição e guarda; **não por execução do caminho do paciente**
- **não mexeu nos seis criadores de ficha** que não gravam procedência — é escopo próprio, e o
  nulo já significa o que precisa significar
- **não corrigiu os achados do lado da Greens** (Y1…Y6) — continuam para comunicar, não corrigir
