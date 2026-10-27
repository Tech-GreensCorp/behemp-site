# ADR-0031 — O paciente cadastrado pela equipe ganha login, e o login sem código é individual

> **Status:** ✅ **implementada** — 27/10/2026, a pedido de **Dryelle**. Provada local contra o Clerk de
> desenvolvimento e um Postgres real; **nada disto foi verificado em produção** (§6).
>
> **Contexto em uma linha:** pacientes cadastrados pelo admin apareciam na tela de usuários, mas ao
> entrar recebiam _"Não foi possível encontrar o usuário"_; e alguns pacientes idosos não conseguem
> abrir o e-mail para digitar o código de verificação.
>
> **Princípios:** A (segurança e LGPD são requisito), E (decisão com alternativa rejeitada). **Fase:** 2
> (cadastro e acesso). **Fundamento:** [Clerk — Device Trust](https://clerk.com/docs/guides/secure/device-trust)
> (_"has no settings"_: só liga/desliga para a instância), tipos do `@clerk/backend` 3.7.1
> (`signInTokens.createSignInToken`, `users.verifyPassword`), OWASP API2:2023 (autenticação quebrada) e
> API4:2023 (consumo de recurso).

## §1 — A causa do primeiro problema (medida, não suposta)

`criarPaciente` (`app/_actions/pacientes.ts`, admin e médico) gravava `users` **sem `clerk_id`** e **nunca
chamava o Clerk**. A tela de usuários lê o banco; quem autentica é o Clerk. O desenho original esperava
que o paciente se cadastrasse sozinho em `/registrar-se` com o mesmo e-mail (o webhook `user.created`
religa por e-mail). Quem tenta **entrar** recebe _"não foi possível encontrar o usuário"_ — sem erro no
log, porque o banco estava certo.

**Reproduzido no navegador** contra o Clerk de desenvolvimento, com um paciente órfão do banco local,
**antes** da correção. Depois dela, o mesmo e-mail cai na tela do código.

**Segundo defeito, na mesma classe:** o e-mail era gravado como digitado. O Clerk o guarda em minúsculas e
o webhook procura por **igualdade exata** (`app/api/webhooks/clerk/route.ts:164`); `users_email_idx` é
sensível a maiúsculas. Com `Maria@x.com` no banco, o primeiro login criaria um **segundo** usuário e uma
**segunda** ficha (e notificaria os admins).

## §2 — Decisões

**D-01 — Cadastrar paciente cria o login (`lib/pacientes/conta-de-acesso.ts`).** Ordem, que é o que evita
duplicar: (1) só paciente ativo com ficha ativa; (2) e-mail em **minúsculas no banco antes** do Clerk;
(3) procura o e-mail no Clerk — se existe, **religa** (nunca recria; recusa login de outro papel e login já
ligado a outro cadastro); (4) senão cria **sem senha e sem e-mail enviado**; (5) grava o `clerk_id` com
`WHERE clerk_id IS NULL` (o webhook pode chegar primeiro); (6) se o banco falhar, o login criado é
**desfeito**. A ficha é gravada **antes**: falha do Clerk **não** desfaz o cadastro, e a resposta traz
`acessoCriado: false` + aviso.

**D-02 — Os que já estavam sem login:** diálogo "Acesso ao sistema" por paciente (chave na tela de
usuários, âmbar quando falta o login) e o botão **"Criar acessos"**, em lotes de 25, com a contagem dos
pendentes. Quem falha (e-mail inválido/duplicado) continua pendente e o motivo volta sem e-mail.

**D-03 — Login sem código, individual.** O Clerk não tem exceção por usuário. Então: flag
`loginSimplificado` no **`privateMetadata`** do Clerk (só a Backend API escreve; o cliente e o JWT não o
veem), ligado pelo admin **por paciente**, **só para `role = paciente`**, **só com senha definida**. A tela
(1ª versão: tela própria `/entrar/senha`, retificada abaixo) envia e-mail + senha ao servidor, que confere limite → banco → flag → senha
(`verifyPassword`) e só então emite um **ticket de uso único e 60 s**; o navegador o troca por sessão
(`signIn.create({ strategy: 'ticket' })`). O fluxo normal e a verificação por e-mail dos demais **não
mudam**.

**D-03 (retificada, 27/10/2026, mesmo dia) — a exceção vive na tela OFICIAL `/entrar`.** A primeira versão entregou uma
tela própria (`/entrar/senha`); a dona recusou: o paciente usa a tela de login de sempre. Dois fatos de engenharia moldaram a
saída: (1) o `<SignIn/>` do Clerk é um widget fechado, sem gancho para rodar uma checagem nossa entre o envio da senha e o
pedido do código; (2) o servidor não tem como confirmar que um cliente passou do primeiro fator (a Backend API do
`@clerk/backend` 3.7.1 não expõe tentativas de login, só `signInTokens`). Então a **raiz** `/entrar` passou a renderizar o
formulário nosso (`components/auth/formulario-de-entrada.tsx`): chama `entrarSemCodigo` primeiro; paciente liberado entra
direto pelo ticket; **qualquer recusa** segue o fluxo normal do Clerk (`signIn.create` com a senha e, se ele pedir
verificação de dispositivo, o código por e-mail — reenvio com retorno e campo limpo). Google, código por e-mail sem senha e
"esqueci a senha" continuam no widget, atrás de **"Outras formas de entrar"**, e **todo subcaminho** (`/entrar/factor-two`,
`/sso-callback`, `/reset-password`) segue com o widget. A `/entrar/senha` foi **removida**.
**Custo aceito, e dito:** a senha de TODO login passa também pelo nosso servidor (TLS), que só a usa para o paciente
liberado e a descarta. O limite (5 por e-mail, 20 por origem) agora conta tentativas de qualquer um, mas só barra o caminho
sem código: a recusa por limite cai no fluxo normal, que tem as proteções do próprio Clerk.

**D-04 — A senha.** Definida pelo admin ou **gerada no navegador dele** (`crypto.getRandomValues`,
amostragem por rejeição, 10 símbolos sem caracteres ambíguos, ~49 bits): **nenhuma resposta de API a
carrega**. Vai ao Clerk (que guarda o hash) **sem `skipPasswordChecks`** — com a senha como único fator, o
Clerk recusa a vazada. Redefinir derruba as outras sessões. A auditoria registra `senhaRedefinida: true`,
nunca a senha. Nenhum log leva e-mail ou senha.

**D-05 — Defesas da entrada.** Limite **por origem (20) e por e-mail (5) a cada 15 min**, antes de qualquer
consulta; **uma única mensagem** para toda recusa (senha errada, e-mail inexistente, sem o flag, sem login,
banido, papel divergente) — sem oráculo de quem tem a exceção. A chave do limitador usa um resumo do
e-mail, não o e-mail.

## §3 — Rejeitado, e por quê

| alternativa                                                              | por que não                                                                                                                                    |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Ler a senha do formulário do widget do Clerk (escutar o `submit` no DOM) | É raspar campo de senha de um componente de terceiro: quebra em qualquer mudança de markup e põe a credencial num caminho que ninguém projetou |
| Desligar o Device Trust na instância                                     | Tira a verificação de **todos**; o pedido é exceção individual                                                                                 |
| Coluna nova `users.login_simplificado` + migration                       | Migration em produção sem rollback, para um flag que vale **junto** da credencial. O `privateMetadata` morre com a conta e dispensa migration  |
| Criar o login só quando o paciente se cadastra                           | É o desenho que gerou o defeito                                                                                                                |
| Senha gerada no servidor e devolvida à tela                              | Faria a credencial trafegar numa resposta de API; gerar no navegador do admin evita isso                                                       |
| `skipPasswordChecks: true` (como `definirSenhaTemporaria`)               | A senha vira o único fator; aceitar `maria1234` seria pior que o código que se está tirando                                                    |
| Liberar o login sem código também para médico/admin                      | A porta mais valiosa, com um fator só. Recusado no servidor (flag, senha e entrada)                                                            |

## §4 — O que mudou de comportamento (para quem consome)

- Paciente criado pela equipe agora **tem `clerk_id`**: `decidirContato` passa a exigir **admin** para trocar
  o e-mail dele (antes só o banco mudava).
- O webhook `user.created` ainda dispara para o login criado pela equipe e **notifica os admins**
  ("novo paciente precisa de médico") — ruído, não erro (§5, achado 4).
- E-mail novo de paciente é gravado em minúsculas e comparado sem diferenciar maiúsculas.

## §5 — Achados catalogados, **não corrigidos** (CLAUDE.md: não se corrige de passagem)

1. 🔴 `app/(medico)/_actions/pacientes.ts:60` e `:120` — `criarPaciente`/`atualizarPaciente` **sem
   autenticação** em arquivo `'use server'`. Nenhum importador hoje (a tela usa `app/_actions/pacientes.ts`),
   o que reduz o alcance mas não o elimina. Perigo de mexer: baixo (apagar ou autenticar). **Item 88a.**
2. 🟠 `definirSenhaTemporaria` (`app/(admin)/_actions/usuarios.ts:652`): sem consumidor na UI, recebe o
   `clerkId` **do cliente** e usa `skipPasswordChecks: true`. **Item 88b.**
3. 🟠 O webhook casa por `eq(users.email, email)` e lê `email_addresses[0]` em `processarNovoUsuario`
   (`route.ts:164`, `:145`); `sincronizarPerfilUsuario` já usa o e-mail **principal**. Qualquer caminho que
   grave e-mail em grafia mista continua podendo duplicar. **Item 88c.**
4. ⚪ A notificação "Novo paciente registrado" (`route.ts:268`) é incondicional: dispara também para
   paciente criado pela equipe. **Item 88d.**
5. 🟠 Os hooks `.claude/hooks/*.py` **não rodam em Windows sem Python** (medido: _"Python não foi
   encontrado"_). A proteção por escrito de `autorizacoes.txt` ficou **inativa** nesta máquina. Uma edição
   minha em `app/(medico)/medico/pacientes/novo/page.tsx` (um aviso de toast) **não está** em
   `.claude/autorizacoes.txt`: precisa de aval do dono ou de reversão. **Item 88e.**

## §6 — O que foi provado, e o que **não** foi

**Provado:** reprodução do defeito no navegador; cadastro pelo formulário do admin (login verificado,
e-mail em minúsculas, 1 usuário, 1 ficha, 1 login); entrada normal por código; criar acesso, gerar e definir
senha, liberar, entrar sem código (caiu em `/paciente`), recusa de senha errada, **recusa da senha certa com o
flag desligado**, corte do limite na 6ª tentativa, redefinição (a antiga passou a ser recusada **no Clerk**),
lote com grafia mista, login pré-existente (religou, não recriou), e-mail inválido (continua pendente) e
arquivado (intacto). 24 casos de integração contra Postgres real, 32 do guarda
`o-login-sem-codigo-e-individual-e-nao-vaza` (**16 sabotagens**, a primeira rodada deixou passar uma e o
guarda foi afiado), e `next build --webpack` verde.

**Provado na tela oficial (27/10/2026, navegador, Clerk de desenvolvimento):** paciente liberado + dispositivo novo (estado do navegador limpo) entra em `/paciente` sem tela de código; o mesmo paciente com o flag desligado recebe a tela do código, erra (mensagem de código incorreto), reenvia (aviso + campo limpo) e entra com o código certo; senha errada dá "E-mail ou senha incorretos."; "Outras formas de entrar" abre o widget (Google + e-mail) e "Entrar com e-mail e senha" volta. Guarda com 35 casos, 23 sabotagens (as 7 do desenho novo, uma delas pegou um trecho que o próprio guarda lia largo demais).

**Não clicado nesta rodada:** o retorno do Google (`/entrar/sso-callback`) e "esqueci a senha" dentro do widget — só se provou que o widget renderiza e que subcaminhos o mantêm.

**Não provado:** (a) o **Device Trust da instância de produção** — o Clerk de desenvolvimento não o exigiu;
o ticket não é senha (a doc o lista fora do Device Trust), mas só a produção confirma; (b) quantos
pacientes **de produção** estão sem login (sem acesso ao Neon): o contador do botão responde; (c) o limite é
em **memória do processo** (Item 31), então um reinício o zera; (d) o build foi `--webpack` numa cópia
(o Turbopack recusa `node_modules` por junção neste ambiente).
