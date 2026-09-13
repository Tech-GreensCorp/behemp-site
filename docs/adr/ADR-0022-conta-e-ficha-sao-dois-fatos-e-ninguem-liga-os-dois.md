# ADR-0022 — Conta e ficha são dois fatos, e ninguém liga os dois

> **Status:** aceita · **Data:** 12/09/2026
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
