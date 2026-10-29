# ADR-0033 — O Responsável age por vínculo provado, e o paciente dependente não é um segundo login

> **Status:** 📋 **proposta, com as regras de negócio respondidas** — 28/10/2026, a pedido de **Dryelle**
> (cartão "Role Responsável com login e vínculo a pacientes dependentes"). **Implementação parcial, ver §N.**
> As respostas de **Dryelle** a P-01 a P-15 estão em §5.1 e **valem como regra de negócio**. As decisões
> **técnicas** de §2 continuam sendo **recomendação**. A segunda rodada (P-10 a P-13) acrescentou D-12 a D-14 e
> **retratou uma afirmação do D-11**; a terceira (P-08, P-13b, P-14) acrescentou **D-15 (procuração) e D-16 (sem
> exclusão de conta)**. **Seguem abertas:** P-13b (o que falta, Jurídico) e P-18 (§5.1), e **nenhuma foi
> presumida**.
>
> **Contexto em uma linha:** uma mãe que recebe os medicamentos de dois filhos hoje não tem como entrar e agir
> por eles; os filhos estão cadastrados como pacientes comuns, e o sistema não sabe que são dependentes.
>
> **Princípios:** A (segurança e LGPD são requisito), E (decisão com alternativa rejeitada). **Fase:** 2.
> **Fundamento:** o próprio código (§1) e o padrão `garantirMedicoDoPaciente`. **Nenhuma norma externa foi
> citada**: as que precisam ser lidas antes de decidir estão listadas em §5.3, sem paráfrase de memória.

> ⛔ **REGRA REVOGADA EM 28/10/2026, por Dryelle, antes do primeiro teste.** Três decisões desta ADR mudaram, e o texto antigo **fica**,
> marcado, porque o caminho ensina mais que o destino:
>
> 1. **P-01** ("dependente é só menor de idade") → o dependente pode ter **qualquer idade**, inclusive maior de 18 anos.
> 2. **P-02** ("um usuário só pode ser uma coisa") → o `paciente` **também pode ser responsável**: quem faz o próprio tratamento e cuida
>    de outra pessoa continua `paciente` e responde por dependentes pelo mesmo vínculo. O papel `responsavel` segue existindo, para quem
>    **não** faz o próprio tratamento.
> 3. **Sem limite** de dependentes por responsável (não existe limite no código nem no banco: o índice único é só "um responsável ativo
>    por paciente").
>
> Efeitos: **D-02** e **D-05** retificados abaixo; a limitação da **P-10** (duas contas) e o aviso aos 18 anos da **P-11** **caem**;
> abrem-se as **P-19** e **P-20** (§5.1). Implementação em §N, "Terceira entrega".

## §1 — O que a medição provou

Medido por leitura de código e `grep` em 28/10/2026; **nada foi executado contra produção**.

- **Um papel por usuário, enum fechado.** `userRoleEnum = ['admin','medico','paciente']`
  (`db/schema/enums.ts:9`); `users.role` é `notNull` com default `paciente` (`db/schema/users.ts:15`). O papel
  viaja em `publicMetadata.role` do Clerk e é lido em `lib/auth/permissions.ts:16,39,90`.
- **Paciente exige conta própria.** `pacientes.userId` é `notNull` e `unique` (`db/schema/pacientes.ts:22-25`);
  `users.email` é `notNull` e tem índice único (`users.ts:13,21`). Hoje uma criança só existe com e-mail próprio.
- **O "responsável" que existe é texto.** `pacientes.responsavelNome` e `responsavelCpf`
  (`pacientes.ts:80-81`), preenchidos só no formulário do médico
  (`app/(medico)/medico/pacientes/novo/page.tsx:544-558`). Não dá login, não dá acesso, não é vínculo.
- **Não há ponto único que resolva "qual paciente está agindo".** Em código de produção (sem scripts, testes,
  docs e seeds), `eq(pacientes.userId, …)` aparece em **84 pontos de 50 arquivos**, e **45** deles são o join
  `pacientes → users` por esse mesmo vínculo. Arquivos por área: `app/(paciente)/_actions` 4,
  `app/_actions` 10, `app/(public)/_actions` 3, `app/(medico)/_actions` 7, `app/(admin)/_actions` 3,
  `app/api` 10, `lib` 11. As comparações explícitas de papel (`role === 'paciente'` e variantes) são **16 em 13
  arquivos**.
  ⚠️ **Retificação, 28/10/2026:** a primeira contagem desta sessão dizia "~102 pontos em 57 arquivos" e "~64 em
  30"; elas somavam seeds, scripts e leituras de metadata. A contagem acima é a do código de produção, com o
  `grep` reproduzível no §6.
- **O papel é decidido em cinco lugares independentes**, e todos têm `'paciente'` como default de conta nova:
  `lib/auth/permissions.ts:43,180,190`, `app/(auth)/redirect/page.tsx:113,160`, `app/api/auth/callback/route.ts:57`,
  `app/api/webhooks/clerk/route.ts:155`, e o layout `app/(paciente)/layout.tsx:14` (`paciente` ou `admin`).
- **O padrão certo já existe, mas para o médico.** `garantirMedicoDoPaciente` (`lib/auth/escopo-paciente.ts:54`)
  prova o vínculo e responde 404 indistinto. Para o paciente agindo por si ou por outro, **não há equivalente**.
- **A auditoria já comporta o caso.** `registrarAuditoria` (`lib/utils/audit.ts:44`) grava `userId` (quem agiu),
  `entidadeId` e `dadosDepois`: "o responsável agiu no paciente X" cabe sem coluna nova.
- **Pré-requisito já catalogado.** O **Item 83** do `04` mostra actions de paciente sem escopo de vínculo
  (`listarPacientesParaRecompra`, `buscarUsuariosChat` a qualquer logado). Um papel novo herdaria esses buracos.
- **Só uma coluna aponta para o `users` do paciente como "o paciente".** O schema local tem **19 colunas**
  que referenciam `users.id` (medido com `information_schema` no Postgres local). Tabelas de dado clínico
  (anamnese, documentos, receitas…) **não aparecem na lista**, ou seja, não têm FK para `users`; **presumo** que
  sejam chaveadas por `pacientes.id`, e **não conferi tabela a tabela**. As que seguem "quem fez" e, na conversão,
  **ficam com a conta que agiu** (o responsável): `notificacoes.user_id`, `mensagens.autor_id`,
  `mensagens_de_atendimento.autor_id`, `participantes_grupo.user_id`, `grupos_chat.criado_por`,
  `chamadas_de_atendimento.aberta_por`/`encerrada_por`, `logs_auditoria.user_id`, e os campos de consentimento do
  paciente em `teleconsultas` (`consentimento_paciente_por`, `consentimento_revogado_por`,
  `consent_teleconsulta_por`; o `consentimento_medico_por` é do médico). A única que muda de dono é
  **`pacientes.user_id`** (D-13). Restam `medicos.user_id` e as de `comunicados_assinatura` e
  `pedidos_atendimento_assistido`, que são de equipe.
- **O `/registrar-se` não coleta dado de dependente.** Pede nome, e-mail, telefone, senha, endereço e aceite
  (`app/(auth)/registrar-se/[[...sign-up]]/page.tsx:99-146`), chama `signUp.create` com
  `unsafeMetadata: { phone }` (`:291-299`) e o botão do Google vai direto ao OAuth, **sem formulário**
  (`:378-386`). O papel nasce `paciente` no webhook (`webhooks/clerk/route.ts:155`) ou no `/redirect`, e **os dois
  criam uma ficha de paciente** (`route.ts:245-257`, `redirect/page.tsx:141`): para um responsável isso **não pode
  acontecer**.
- **O bloco "dados do responsável" que a P-13 pede para ajustar está só no formulário de equipe.** É a seção
  "Responsável / Representação Legal" de `app/(medico)/medico/pacientes/novo/page.tsx:532-561` (a mesma tela serve
  `/admin/pacientes/novo`), **abaixo** dos dados do paciente, com **nome e CPF** apenas, e no mesmo cartão das
  perguntas sobre advogado. Na ficha: `[id]/page.tsx:477-478`. O cadastro por link e o `/registrar-se` **não**
  têm esse bloco.
- **O produto já promete o que esta ADR constrói.** Os Termos pedem "ter 18 anos ou mais, ou estar representado por
  responsável legal devidamente cadastrado" (`app/(public)/termos-de-uso/page.tsx:106`), a Política cita
  "consentimento expresso do responsável legal, conforme Art. 14 da LGPD"
  (`politica-de-privacidade/page.tsx:351`), e a procuração prevê o Representante Legal do menor
  (`lib/receituario/procuracao-pdf.tsx:174`). **Registro do que o repositório afirma; não conferi esses textos contra
  a lei** (§5.3).
- **Banco local:** 3 pacientes, nenhum com `data_nascimento` ou `responsavel_nome`. **Não diz nada sobre
  produção**; a consulta que responde está em §6.

## §2 — As decisões (recomendação)

### D-01 — O vínculo é uma TABELA, e é ela a fonte de verdade

`responsaveis_pacientes` (nome indicativo): `responsavel_user_id`, `paciente_id`, `parentesco`, `status`
(`ativo`, `encerrado`), `criado_em`, `encerrado_em`, `encerrado_por_user_id`, `motivo`. **Um índice único parcial
em `paciente_id` onde `status = 'ativo'`** garante **um só responsável por paciente** (P-07). Só o admin
encerra (P-07). Linha nunca é apagada: encerrar preserva a data e o motivo (proibição 4 do `CLAUDE.md`).
(Na primeira versão desta ADR havia `pendente` e `confirmado_por`; a P-03 mostrou que o vínculo nasce no cadastro,
sem etapa de confirmação, e os dois campos saíram.)

**Rejeitado: só um novo valor de enum `responsavel`, sem tabela.** O enum diz _quem a pessoa é_, não _por quem ela
responde_; sem tabela não há como dizer que a mãe responde pelos filhos A e B e não pelo C, nem guardar quando e
por quem o vínculo foi encerrado.
**Rejeitado: reaproveitar `responsavelNome`/`responsavelCpf`.** Texto não prova vínculo, não dá escopo e não tem
data de início nem de fim.

### D-02 — Existe o papel `responsavel`, e o usuário tem UM papel só (**decidido pela P-02**)

⛔ **REVOGADA EM PARTE, 28/10/2026 (Dryelle): o `paciente` também pode ser responsável.** O papel `responsavel` continua, para quem **não**
faz o próprio tratamento. Quem faz continua `paciente` e responde por dependentes pelo **mesmo vínculo**, sem segundo papel:
`PAPEIS_QUE_PODEM_RESPONDER = ['responsavel', 'paciente']` em `lib/auth/escopo-do-responsavel.ts`. É a alternativa "sem papel novo, só vínculo",
que esta decisão havia rejeitado por "só servir se a P-02 fosse acumula": agora ela vale, **ao lado** do papel. O que **prova** o acesso a
cada dependente continua sendo o **vínculo `ativo`**, não o papel: um `paciente` sem vínculo não enxerga nada que não seja dele, e **admin e
médico seguem de fora**. O texto original, abaixo, fica como o caminho:

**Dryelle, P-02:** _"o mesmo usuário pode ser só uma coisa: se é paciente, é paciente; se for responsável, ele
administra os dados do paciente."_ Logo: valor novo `responsavel` no enum `user_role` e em `Role`
(`lib/auth/permissions.ts:16`), e a mudança nos cinco lugares de §1 (`permissions.ts`, `redirect/page.tsx`,
`auth/callback/route.ts`, `webhooks/clerk/route.ts` e o layout da área). O responsável **não tem linha em
`pacientes`**: ele não é paciente.

**P-10, fechada por Dryelle:** o papel `responsavel` é para quem cuida de menores, que _"não sabem ver e-mails,
acessar nossos dados"_; **quem é maior de idade e faz o próprio tratamento continua `paciente`.** Fica como
**limitação aceita**, não como pergunta: uma pessoa que seja as duas coisas **não tem uma conta só** (cada conta
exige e-mail único) e, se abrir duas, esbarra na regra do ADR-0028 que manda "mesmo CPF em outra conta" ao
suporte. Nenhuma resposta foi dada para esse caso, e **não presumo uma**; ele deve ser contado em produção antes
de alguém depender dele (§6).

**Rejeitado: dois papéis por usuário.** `publicMetadata.role` é um valor único, lido em 5 lugares; virar lista é
reescrever a base de autorização, e a P-02 já escolheu o contrário.
**Rejeitado: sem papel novo, só vínculo.** Era a saída se a P-02 fosse "acumula". Não é.

### D-03 — UM resolvedor prova o vínculo, e nenhuma action resolve "o paciente" sozinha

Um helper em `lib/auth/` (no molde de `garantirMedicoDoPaciente`) recebe o `pacienteId` **opcional** e devolve
`{ pacienteId, userIdDoPaciente, atuaComo: 'proprio' | 'responsavel', vinculoId? }`. Sem `pacienteId`, resolve o
próprio. Com `pacienteId`, exige vínculo `ativo` do usuário logado. **404 indistinto** para "não existe" e "não é
seu". O `pacienteId` do cliente **nunca** é usado sem passar por ele (OWASP API1).

**Rejeitado: acrescentar `OR vínculo` em cada `eq(pacientes.userId, …)`.** São 84 pontos; cada um que
esquecesse seria um BOLA silencioso, e a regra ficaria em 50 arquivos em vez de um.
**Rejeitado: impersonação (o responsável entra "como" o dependente trocando a sessão do Clerk).** A auditoria
passaria a dizer que o dependente agiu, e o dependente não tem credencial. Apagaria exatamente o "quem decidiu".

### D-04 — O dependente tem registro em `users`, sem credencial, sem e-mail e sem telefone reais (**decisão técnica, a validar**)

**Dryelle, P-04 e P-09:** o dependente **não tem login, nem e-mail, "pelo menos por enquanto"**, e o único login é o
do responsável. Isso torna este ponto o mais pesado da ADR: `pacientes.userId` é `notNull` e `users.email` é
`notNull` e único, e 45 joins leem `users` do paciente (nome, e-mail).

| opção                                                         | custo                                                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **(i)** `users` sem `clerkId` e e-mail técnico não entregável | toca poucos sítios, mas **todo envio** (Brevo, ChatPro) precisa pular o endereço técnico e ir ao responsável; exige um guarda             |
| **(ii)** `pacientes.userId` passa a aceitar `null`            | corrige a raiz, mas toca os 84 pontos de §1 e **45 joins** `pacientes → users`, que passariam a perder a linha do dependente sem `userId` |
| **(iii)** o dependente usa o e-mail do responsável            | **inviável**: viola `users_email_idx` (único)                                                                                             |

**Recomendo (i)**, por ser a que mais cabe em fatias: o `users.nome` continua servindo os 45 joins, e **nenhuma
conta é criada no Clerk**, então o webhook `user.created` nem dispara. Dar login ao dependente no futuro (P-04 diz
"por enquanto") é trocar o e-mail técnico por um real e criar a conta. **Sob condições:**

1. um helper `destinatarioDoPaciente`, que devolve e-mail, telefone e canal **do responsável vigente**, e um guarda
   que derive do disco todo ponto de envio e falhe se algum destinatário puder ser o endereço técnico. Os envios que
   tocam `pacientes` são **16 arquivos** (medição heurística: arquivo que cita Brevo/ChatPro/`enviarEmail…` e
   `pacientes`), entre eles `lib/anvisa/avisar-aprovacao.ts`, `app/_actions/recompras.ts`,
   `lib/agendamento/confirmar-consulta-paga.ts` e `app/api/cron/verificar-validade-documentos/route.ts`;
2. **o acesso do admin ao paciente** (`app/_actions/acesso-do-paciente.ts`, ADR-0031) **recusa dependente**: sem
   isso, o botão "dar acesso" tentaria criar uma conta no Clerk com o e-mail técnico;
3. a lista de usuários do admin (`app/(admin)/_actions/usuarios.ts:117`, que conta `role = 'paciente'`) precisa
   distinguir dependente, para não contar criança como usuário com login.

É **recomendação**, e uma prova de conceito contra o Postgres local deve confirmá-la antes de virar decisão.

**Rejeitado: (iii).** **Rejeitado por ora: (ii)**, pelo raio de §1; volta se (i) se mostrar frágil.

### D-05 — "Dependente" é derivado do vínculo, não uma segunda coluna

⛔ **REVOGADA EM PARTE, 28/10/2026 (Dryelle): o dependente pode ter qualquer idade.** Sai a exigência de ser menor de 18 anos
(`ehMenorDeIdade` foi substituída por `dataDeNascimentoPlausivel`: a data existe, não é futura e não é anterior a 1900). A data de
nascimento **continua obrigatória**, como dado do prontuário, mas **não decide mais** quem pode ser dependente. O aviso ao admin aos 18
anos (P-11) **cai**: o dependente adulto passou a ser regra.

Dependente = paciente com vínculo `ativo`. **Dryelle, P-06:** a tela do **médico e a do admin** mostram que o
paciente é dependente e **quem é o responsável**. Paciente que parece menor (`data_nascimento` recente) **sem
vínculo** entra numa lista para o admin regularizar; **nada é convertido automaticamente** (P-13).
**`data_nascimento` passa a ser obrigatória para o dependente**: é o único dado que diz que ele é menor e quando
deixa de ser (P-11), então tem consumidor declarado.

**Rejeitado: coluna booleana `dependente`.** Duplica a informação do vínculo e permite "dependente sem
responsável", um estado que não deveria existir.
**Rejeitado: deduzir pela idade.** `data_nascimento` é opcional hoje e pode não estar preenchida.

### D-06 — A auditoria registra quem agiu e por quem, sem coluna nova

Em toda ação "em nome de": `userId` = o responsável; `entidadeId` = o recurso; `dadosDepois` leva
`atuandoComo: 'responsavel'`, `pacienteId` e `vinculoId`. Leitura de dado sensível grava `visualizar`. Um guarda
exige o campo nas actions que usam o resolvedor.

**Rejeitado: gravar o `userId` do dependente.** O registro mentiria sobre quem leu.

### D-07 — Aceite e consentimento de dependente: **é sempre do responsável** (regra de negócio, P-05)

**Dryelle, P-05:** _"sempre o responsável"_. Hoje o consentimento é "do paciente" (ADR-0007) e o `Li e concordo` é do
titular. O registro de aceite precisará dizer **de quem são os dados** (o dependente) e **quem aceitou** (o
responsável), os dois. **Não medi** como as tabelas de consentimento guardam isso hoje; é a primeira leitura da
fatia 2 antes de tocar nelas. **Em aberto para o Jurídico:** se um aceite dado pelo responsável tem a validade que
a plataforma precisa (§5.3). Esta ADR **não altera** os aceites existentes.

### D-08 — Ordem: o escopo das actions que o responsável alcança vem ANTES de abri-las

As actions de `recompras`, documentos, ANVISA, teleconsulta e pagamentos que o responsável usará passam pelo
resolvedor **antes** de o papel/vínculo existir em produção. As do Item 83 que ele alcançaria
(`listarPacientesParaRecompra`, `buscarUsuariosChat`) são **pré-requisito**, não de passagem.

⚠️ **A teleconsulta é a mais arriscada**, e a P-04/P-09 a tornam mais. O dependente não tem sessão, e o código
que autoriza a sala e a chamada decide por `role === 'paciente'` **e** `eq(pacientes.userId, user.id)`:
`lib/auth/escopo-chamada.ts:44` (devolve `null` para qualquer papel que não seja `paciente`) e `:51`,
`lib/auth/escopo-sala.ts:160-166`, e `components/teleconsulta/GlobalTeleconsultaHost.tsx:288`. **Verificado nessas
linhas:** um usuário `responsavel` seria **recusado**, e a chamada do dependente não teria a quem se dirigir. Quem
entra na sala e recebe o toque é o responsável; isso muda o escopo de sala e de chamada, e deve ter fatia própria,
com o guarda `autorizacao-tem-escopo-de-objeto` (que já cobre a teleconsulta) como rede.

### D-09 — O vínculo nasce JUNTO com o dependente, criado pelo responsável; ligar a um paciente existente é só do admin

**Dryelle, P-03:** _"o vínculo é criado quando cadastra"_. O responsável cria o registro do dependente e o vínculo
no mesmo ato, em **uma só função** (`criarDependente`) e **uma transação**. O responsável **nunca informa um
paciente que já existe** para "reivindicá-lo".

**Rejeitado: o responsável vincula um paciente existente por CPF, e-mail ou nome.** Qualquer pessoa autenticada
poderia declarar-se responsável de um paciente alheio e ler documentos e receitas dele (OWASP API1 por declaração).
A ligação de pacientes **já cadastrados** (as crianças de hoje) é só do admin (P-13).

⚠️ **Criador de ficha novo.** Há **9 pontos de inserção em `pacientes` em 8 arquivos** (`usuarios.ts:276`,
`redirect/page.tsx:141`, `(medico)/_actions/pacientes.ts:96`, `webhooks/clerk/route.ts:257`,
`cadastro-por-link.ts:521`, `documentos-paciente-self.ts:71`, `pacientes.ts:146` e `:997`, `perfil-paciente.ts:220`).
O ADR-0022 já trata "um criador de ficha a mais" como o problema que a sentinela resolve. `criarDependente` **não
pode ser o décimo ponto solto**: a sentinela e a reconciliação (`lib/fluxo/sentinela.ts`, `lib/fluxo/reconciliar.ts`)
precisam conhecer dependente, ou lerão "ficha sem conta no Clerk" como divergência.

### D-10 — O papel de quem se cadastra é uma ESCOLHA EXPLÍCITA, fechada em dois valores, e não se infere de campo vazio

**Dryelle, P-03, duas opções dadas:** _"se forem preenchidos dados de responsável, o perfil é responsável; se ficarem
vazios, é paciente normal… ou poder selecionar antes de cadastrar se é paciente ou representante"_.
**Recomendo a segunda: escolher.** O servidor aceita só `z.enum(['paciente','responsavel'])`, com `paciente` como
padrão, e **nunca** `admin` ou `medico`.

**Rejeitado: inferir o papel de os campos de responsável estarem preenchidos.** O papel é a base da autorização; um
papel que depende de um campo opcional ter sido digitado muda sozinho se alguém preencher, ou apagar, e quem se
cadastra sem querer vira responsável (ou deixa de ser) em silêncio.

**P-12, fechada por Dryelle:** a escolha fica no **`/registrar-se`**: _"crie a opção de se registrar como
responsável também e colocar o seu paciente/dependente"_ (D-14). O cadastro por link (ChatPro/Greens) **não muda**
e segue só `paciente`.

⚠️ **Retificação do conflito com o guarda `cadastro-por-link-abre-sem-conta`.** A versão anterior desta ADR dizia
que ele precisaria ser ajustado. Ele só vigia **a action do link** (`app/_actions/cadastro-por-link.ts:465`,
`role: 'paciente'` literal; teste em `…/cadastro-por-link-abre-sem-conta.test.ts:108`). Como a P-12 **não** leva a
escolha para o link, **o guarda não muda**. Se um dia o link ganhar a opção, o guarda passa a exigir o enum fechado
de dois valores, **sem remover o invariante** (quem abrisse o link não pode escolher ser admin).

⚠️ **O que `unsafeMetadata` permite e o que não.** O `/registrar-se` já grava `unsafeMetadata.phone`
(`page.tsx:296`); o Clerk deixa o **próprio usuário** reescrevê-lo depois. Logo o perfil escolhido só pode ser lido
**uma vez**, na criação da conta (webhook `user.created` ou `/redirect`), validado por enum fechado e gravado no
banco e no `publicMetadata`. **Nunca** relido a cada login: senão um paciente viraria `responsavel` editando o
próprio metadado. O papel `responsavel` **sem vínculo ativo não alcança nenhum paciente** (D-03), então o pior caso
de um papel mal escolhido é uma conta vazia, não vazamento.

### D-11 — Ordem de entrega: o vínculo precisa do papel, e a conversão vem depois da área do responsável

⛔ **Retratação, 28/10/2026.** A versão anterior afirmava que a fatia 1 entregaria "a marcação de dependente sem
tocar em login nem nos 84 pontos". **Isso era falso.** Pelo D-05 "dependente" é ter vínculo `ativo`, e o vínculo
exige um usuário `responsavel`, que exige o papel novo (D-02) **e** uma área que ele consiga abrir
(`app/(paciente)/layout.tsx:14` redireciona para `/` quem não é `paciente` ou `admin`). Não existe marcação
"sem login" com a regra que Dryelle escolheu. A ordem correta está em §7.

### D-12 — O responsável tem uma tabela própria, mínima, e `responsavelNome`/`responsavelCpf` não são apagados

O responsável **não tem linha em `pacientes`** (D-02), mas precisa guardar o **CPF** (hoje só existe em
`pacientes.responsavelCpf`) e, no vínculo, o **parentesco**. Recomendo uma tabela `responsaveis` 1:1 com `users`
(`user_id` único, `cpf`, validado por `cpfEhValido`, o mesmo de `cadastro-por-link.ts`); nome, e-mail e telefone
**reaproveitam `users`**. **Campo só com consumidor declarado** (`.claude/rules/seguranca-lgpd.md`): o consumidor
do CPF é a identificação do responsável perante o médico e a **procuração** (P-08 respondida: o documento usa o
nome dos dois, D-15). **P-16, respondida por Dryelle: _"só nome e CPF"_.** Logo `responsaveis` tem **uma coluna de dado
pessoal, `cpf`**; o nome, o e-mail e o telefone vêm de `users`. **Não há coluna** de RG, nacionalidade, estado civil,
profissão nem endereço do responsável (campo sem consumidor declarado é coleta sem finalidade), e o CPF **só sai**
para a procuração.

**P-13, "preserve os dados das crianças":** `pacientes.responsavelNome` e `responsavelCpf` **não são removidos
nem sobrescritos** (proibição 4 do `CLAUDE.md`). A tela passa a **ler do vínculo e de `responsaveis`** e a deixar
de escrevê-los; a coluna vira cópia histórica. **Rejeitado: apagar as colunas**, por perder o dado das crianças
existentes antes de qualquer conversão provar que o novo lugar está completo.

### D-13 — As contas existentes são convertidas pelo ADMIN, uma a uma, com o login de quem já responde pela criança

**Dryelle, P-13:** _"crie o login com os dados do responsável, e nele vão os dados da criança… crie alguma
funcionalidade que mostra quais são os dependentes, as contas, e clicar… muda a conta para tipo representante…
principalmente tome cuidado"_. **Confirmado por Dryelle (P-15, 28/10/2026): é uma ferramenta só do admin**, não
existe na tela do responsável. O seletor de dependentes do próprio responsável (escolher "agir por qual filho") é
outra coisa, e está em D-03 e D-14.

**Por que converter a conta existente em vez de criar uma de responsável ao lado:** hoje a criança **é** um
`users`, com o **e-mail de quem a cadastrou**, e `users.email` é único (`users.ts:21`). O responsável não pode abrir
uma segunda conta com o mesmo e-mail, e o login que ele já usa é justamente o dessa linha. Converter **muda o papel
desse mesmo login** e **tira a ficha da criança dele**.

**O que a tela mostra** (lista de _candidatos_, nunca conversão automática): conta, nome do paciente, idade
(`data_nascimento`), o responsável declarado (nome e CPF mascarado), se há login (`clerk_id`), e quantos documentos e
consultas a ficha tem. Candidata = `role = 'paciente'` **e** (menor de 18 **ou** `responsavel_nome` preenchido) —
**só para listar**; quem decide é o admin, olhando cada caso.

**O que a conversão faz, numa transação** (conta `U`, ficha `F` da criança):

1. cria `D`, um `users` sem `clerkId`, com o nome da criança e e-mail técnico (D-04), `role = 'paciente'`;
2. `UPDATE pacientes SET user_id = D.id WHERE id = F.id` — **a ficha, o `pacientes.id` e todo dado clínico não
   mudam**; só quem é o "dono de conta" da ficha;
3. `U.role = 'responsavel'`, e `U.nome` passa a ser o **nome do responsável** (hoje é o da criança), que o admin
   confirma, assim como o CPF, na própria tela — **obrigatórios**, porque `responsavel_nome` vazio é comum;
4. cria o registro em `responsaveis` e o vínculo `ativo` `U → F` com o parentesco;
5. auditoria em `logs_auditoria`, com **o estado antes** (`role`, `nome`, `pacientes.user_id`) e depois — é o que
   permite **desfazer por script**, não por botão.

**Depois da transação:** atualizar o `publicMetadata.role` e o nome no Clerk. ⚠️ **Esse é o ponto frágil.**
`obterRoleComFallback` lê o papel do **Clerk primeiro** (`permissions.ts:183-186`) e só então o banco; se o Clerk
falhar depois do commit, a conta continua `paciente` na sessão e vê uma ficha vazia. Por isso a conversão grava
`sincronizacao_pendente` e **a ação é reexecutável**: o admin vê "pendente" e repete, e a reconciliação existente
(`lib/fluxo/reconciliar.ts`) deve aprender o caso. É o mesmo problema de "conta órfã" que a ADR-0022 já resolveu para
o cadastro, e o mesmo padrão se aplica.

**Rejeitado: converter em lote por heurística (idade ou campo de responsável).** `data_nascimento` é opcional e
`responsavel_nome` é um campo livre que **pode** guardar o representante de um adulto (**não medi** se isso
acontece em produção); um lote converteria a conta errada, e conta convertida muda o que a pessoa **vê ao entrar**.
**Rejeitado: criar uma conta nova de responsável e deixar a antiga viva.** O e-mail é único: não há como; e a ficha
ficaria com dois logins.
**Rejeitado: migrar `mensagens`, `notificacoes` e consentimentos para o novo `users` da criança.** Quem escreveu e
quem aceitou foi o responsável (D-07); mover reescreveria quem fez. Eles **ficam em `U`**.
**Rejeitado: botão de desfazer.** A reversão existe por script a partir da auditoria; um botão convida a desfazer
sem ter lido a ficha.

### D-14 — `/registrar-se` ganha a escolha "paciente ou responsável", e o dependente é criado após confirmar o e-mail

Na etapa "dados" o usuário escolhe **Sou o paciente** ou **Sou responsável por um menor** (D-10). Quem escolhe
"responsável" tem o **dependente** pedido **depois** da confirmação do e-mail, quando já existe sessão, por
`criarDependente` (D-09): nome, **`data_nascimento` obrigatória** (D-05), parentesco, e o que a ficha de hoje já
pede. Pode haver **mais de um** dependente por responsável (a mãe de dois filhos); cada um tem **um** responsável
(P-07). **A ficha de paciente não é criada para o responsável**: o webhook e o `/redirect` hoje criam uma para todo
novo usuário (§1) e precisam respeitar o perfil.

⚠️ **O formulário de equipe** (`novo/page.tsx:532-561`) é ajustado como a P-13 pede: o **responsável vem primeiro**,
com e-mail, telefone, parentesco e CPF (ele é o login), e **os dados do paciente (dependente) depois**. As perguntas
sobre advogado, que hoje dividem o cartão "Responsável" com nome e CPF, **ficam fora do bloco do responsável**.
Quando a equipe cria dependente, o login criado é o **do responsável**. `garantirContaDeAcesso` (ADR-0031) parece
ser por paciente, pelo nome e pelo uso em `acesso-do-paciente.ts`, e precisaria de uma versão por responsável;
**não li o corpo dela**.

**P-14 e P-17(b), fechadas por Dryelle: _"remova isso (opção) de cadastro com Google"_ e, sobre o alcance, _"todo o
cadastro"_.** O Google **sai de todo o `/registrar-se`**, para qualquer perfil, e não só do caminho do responsável.
No `page.tsx`: o botão e o separador "ou" (no bloco da etapa `dados`, a partir de `:887`) e `handleGoogleSignUp`
(`:378-392`). **O link "já tenho conta", que mora no mesmo bloco, fica.** O cadastro de qualquer perfil passa a ser
**só por e-mail e senha**. Efeitos: a dúvida sobre `unsafeMetadata` no OAuth deixa de importar, e o furo do Item 70
(o Google não confere o "Li e concordo") **fecha para o `/registrar-se`**. Nenhum guarda cita o botão do Google;
`o-destino-do-paciente-segue-o-que-falta` lê esta página e precisa continuar verde.

⚠️ **Tirar o botão não impede o Google de criar conta, e o motivo está lido.** O login
(`app/(auth)/entrar/[[...sign-in]]/page.tsx`) usa o widget `<SignIn/>` do Clerk (`:482`, com
`socialButtonsVariant: 'iconButton'`), que aparece em "outras formas" e em todo subcaminho (`sso-callback`,
`factor-two`…; comentário em `:107-112`). Na **documentação oficial do Clerk**, lida em 28/10/2026, o `<SignIn/>` tem
a prop **`transferable`**, padrão `true`: _"whether or not sign in attempts are transferable to the sign up flow"_, e
`false` _"prevents opaque sign ups"_; a doc descreve ainda que _"if a user tries signing in, but doesn't exist, the
flow will transfer the user to the sign-up flow"_. O widget do repositório **não passa `transferable`**, logo usa o
padrão. **A doc não esclarece o que acontece com OAuth no padrão, e não diz se um provedor social pode ser só de
login:** isso **não foi testado** com um Google desconhecido.

**Recomendação:** passar `transferable={false}` ao `<SignIn/>`, para o Google continuar **entrando** quem já tem conta
e deixar de **criar** conta, e **verificar com uma conta Google inexistente num Clerk de desenvolvimento** (o
repositório já roda com chaves de desenvolvimento) antes de afirmar que funciona. **Não desligar o provedor no painel
do Clerk:** quem criou conta pelo Google (não medi quantos) perderia o acesso.

⚠️ **O servidor não confia no botão ausente:** ignora o perfil `responsavel` para conta criada por OAuth (D-10).

**Rejeitado: criar o dependente no mesmo passo da conta, antes da confirmação.** Seria gravar dado de menor sem
conta confirmada; a ordem "conta primeiro, ficha depois" já é regra deste produto (guarda
`a-conta-nasce-na-confirmacao-do-email`).

### D-15 — A procuração da ANVISA nomeia os DOIS: o dependente como outorgante, o responsável como representante legal que assina

**Dryelle, P-08: _"usa o nome dos dois"_.** O documento passa a identificar **o menor (outorgante)** e **o
responsável (representante legal)**, e a **assinatura é do responsável**, com o nome e o CPF **dele**.

**O que o código faz hoje, e por que não serve sem mudança (lido, não executado):**

- `DadosProcuracao` (`lib/receituario/procuracao-pdf.tsx:109-118`) descreve **uma pessoa**: nome, nacionalidade,
  estado civil, profissão, RG, CPF, e-mail, telefone, endereço e CEP. O texto **já prevê o caso**: _"ou, se menor, do
  Representante Legal"_ (`:174`) e a linha de assinatura _"do OUTORGANTE (ou do REPRESENTANTE LEGAL, se menor)"_
  (`:230`), mas o bloco de assinatura imprime **o mesmo** nome e CPF (`:234-235`).
- A rota (`app/api/anvisa/procuracao/route.ts:35-56`) resolve o paciente por `pacientes.userId = user.id` da
  **sessão**. Com o responsável logado não há ficha com o `userId` dele: **a rota falharia** (D-03).
- O DocuSign recebe `pacienteEmail` e `pacienteNome` como **signatário** (`lib/docusign/docusign-service.ts:194-195`
  e `:373-374`). Para o dependente isso seria o **e-mail técnico** do D-04: o envelope iria para um endereço que não
  existe. **O signatário passa a ser o responsável**, e o guarda do D-04 tem de cobrir este envio.

**Decisão:** `DadosProcuracao` ganha um bloco opcional de representante legal; quando existe vínculo `ativo`, o texto
qualifica **o menor como outorgante** e **o responsável como quem assina por ele**; o signatário do DocuSign e o
destinatário do e-mail são os do responsável. **O fluxo do paciente adulto não muda** (bloco ausente), e é provado
pelo guarda `o-pedido-de-atendimento-abre-a-procuracao` (33 casos) e a integração homônima (16), **que precisam
continuar verdes**.

⚠️ **Área protegida por hook:** `lib/receituario/` e `lib/docusign/` exigem autorização por escrito em
`.claude/autorizacoes.txt` (o arquivo já tem `lib/docusign/docusign-service.ts` autorizado para **outra** tarefa; não
vale para esta). **P-16 respondida: o representante legal entra só com nome e CPF** (a linha de assinatura já tem os dois campos,
`procuracao-pdf.tsx:234-235`). **Em aberto, para o Jurídico:**
se a procuração por representante legal tem a validade que o acesso GOV.BR exige; o texto atual a prevê, e isso **não
é prova** de que basta.

⚠️ **O que o texto imprimiria hoje para um menor (lido, não executado; P-18).** O parágrafo do OUTORGANTE
(`procuracao-pdf.tsx:154-160`) usa marcadores de campo vazio: `'[estado civil]'`, `'[profissão]'` e `RG nº [________]`, e
imprime `{dados.email}`, que a rota preenche com o e-mail do usuário (`route.ts:116,154`). Para o dependente isso
seria **um menor "[estado civil]", "[profissão]" e o e-mail técnico do D-04 num documento legal**. A rota ainda
**pergunta** nacionalidade, estado civil e profissão (`route.ts:25-27,99-101`). A recomendação é omitir o que não se
aplica ao menor e imprimir o **contato do responsável**; **como se qualifica um menor numa procuração é pergunta de
redação jurídica**, não minha (P-18).

**Rejeitado: gerar a procuração com os dados do menor e a assinatura do responsável sem nomeá-lo.** O documento
afirmaria que o menor assinou, o que é falso, e seria o responsável a ficar sem constar no papel.
**Rejeitado: enviar o envelope ao e-mail do dependente.** Não existe (D-04).

### D-16 — Só o ADMIN exclui conta: ninguém se autoexclui, a action recusa no SERVIDOR, e o admin não apaga responsável com vínculo ativo

**Dryelle, P-13b: _"o paciente/responsável não deve ter acesso a excluir conta"_; e, ao fechar a P-17(a): _"apenas
admin pode excluir contas!"_.** Vale para **todos os papéis**, inclusive o **paciente comum**, que hoje tem o botão.
É uma **mudança de comportamento de uma tela em produção**, e por isso está aqui e não escondida no papel novo.

- **Esconder o botão não basta, e o motivo está medido.** `excluirMinhaConta`
  (`app/_actions/perfil-paciente.ts:234-272`) **não tem nenhuma checagem de papel** (só `obterUsuarioAtual`, que
  autentica), **não grava auditoria** (zero chamadas de `registrarAuditoria` no arquivo), **apaga o usuário no Clerk**
  (`:251`; o código não tem como desfazer) e só então faz soft delete no banco. É uma Server Action: qualquer sessão
  a chama sem passar pela tela. **A autoexclusão sai da action** (a função recusa **qualquer** papel, ou deixa de
  existir), e o botão e o diálogo saem de `app/(paciente)/paciente/perfil/page.tsx` (botão `:848`, diálogo `:938`).
  Tem **1 chamador** e **nenhum teste**.
- **Para o responsável a autoexclusão deixaria os dependentes sem ninguém.** A action só apaga a linha `pacientes`
  cujo `userId` é o do usuário; o dependente tem **outro** `userId` (D-04) e ficaria vivo, com o vínculo `ativo`
  apontando para um responsável apagado.
- **O caminho do admin é o único que sobra, e tem um buraco.** `excluirUsuarioAdmin`
  (`app/(admin)/_actions/usuarios.ts:315`) só barra a própria conta e o último admin, e o diálogo mostra
  `resumirVinculosDoUsuario` (`:406`), que conta pelos vínculos de **médico** (`vinculosDoMedico`). Para um responsável
  mostraria zero. **Recusa** apagar responsável com vínculo `ativo` até o admin **encerrar** o vínculo (P-07: só o
  admin encerra), e o resumo passa a contá-lo.
- **A Política já publica o caminho.** Os direitos do titular estão como "**solicitar**" a eliminação, com o canal
  `privacidade@be4hope.org` (`app/(public)/politica-de-privacidade/page.tsx:262,275`). Tirar o botão **não a
  contradiz**; o pedido passa a chegar por esse canal e **o admin executa**. A promessa enganosa da tela de excluir
  (Item 74) deixa de existir junto com o botão.

**Fica em aberto (P-13b, o que sobrou), agora para TODOS os papéis:** o **processo** do pedido de eliminação (quem
recebe em `privacidade@be4hope.org`, em quanto tempo, e como o admin o registra) e **o que a plataforma faz com o
histórico clínico** quando o admin exclui. **É do Jurídico** (J-12, Item 74). Os direitos do titular são norma a ler
(§5.3), e **não citei** nenhum artigo.

**Rejeitado: só esconder o botão.** A action fica chamável.
**Rejeitado: manter a autoexclusão para o paciente comum e tirá-la só do responsável.** A resposta foi "apenas admin
pode excluir contas": duas regras para o mesmo botão deixariam a action com checagem de papel que ninguém pediu.
**Rejeitado: permitir a exclusão e soft-delete dos dependentes junto.** Apagaria prontuário de menor por um clique do
responsável, contra a proibição 4 do `CLAUDE.md`.

## §3 — O que fica rejeitado

| alternativa                                                                 | por quê                                                                                   |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| só o enum `responsavel`, sem tabela                                         | não diz _por quem_ nem guarda quando e quem encerrou o vínculo                            |
| sem papel novo, só vínculo                                                  | só serviria se a P-02 fosse "acumula"; a resposta é "não"                                 |
| o responsável vincula paciente existente                                    | qualquer logado reivindica paciente alheio (API1 por declaração)                          |
| inferir o papel de campo de responsável vazio                               | o papel é a base da autorização; não pode depender de um campo                            |
| reaproveitar `responsavelNome`/`responsavelCpf`                             | texto: sem prova, sem escopo, sem vigência                                                |
| dois papéis por usuário                                                     | `publicMetadata.role` é valor único em 5 lugares                                          |
| `OR vínculo` em cada consulta                                               | 84 pontos; cada esquecimento é um BOLA silencioso                                         |
| impersonação por sessão do Clerk                                            | a auditoria perde quem decidiu; o dependente não tem credencial                           |
| dependente com o e-mail do responsável                                      | viola `users_email_idx`                                                                   |
| `pacientes.userId` nulo agora                                               | toca 84 pontos e 45 joins; fica como plano B                                              |
| coluna `dependente` booleana                                                | duplica o vínculo; permite dependente sem responsável                                     |
| inferir dependente pela idade                                               | `data_nascimento` é opcional                                                              |
| apagar `responsavelNome`/`responsavelCpf`                                   | perde o dado das crianças antes de provar o novo lugar completo                           |
| converter contas existentes em lote por heurística                          | `data_nascimento` é opcional; converte a conta errada, e muda o que a pessoa vê ao entrar |
| conta nova de responsável ao lado da antiga                                 | `users.email` é único; a ficha ficaria com dois logins                                    |
| migrar mensagens e aceites para o `users` da criança                        | reescreve quem escreveu e quem aceitou                                                    |
| botão "desfazer conversão"                                                  | a reversão é por script, a partir da auditoria                                            |
| criar o dependente antes de confirmar o e-mail                              | grava dado de menor sem conta confirmada                                                  |
| procuração com os dados do menor e a assinatura do responsável sem nomeá-lo | afirma que o menor assinou, e o responsável não consta                                    |
| envelope do DocuSign ao e-mail do dependente                                | não existe (D-04)                                                                         |
| só esconder o botão "Excluir Minha Conta"                                   | a action não checa papel e segue chamável                                                 |
| desligar o Google no painel do Clerk                                        | quem criou conta pelo Google perderia o acesso; o login depende dele                      |
| autoexclusão para o paciente comum, só o responsável sem                    | duas regras para o mesmo botão; a resposta foi "apenas admin"                             |
| soft delete dos dependentes junto com o responsável                         | apaga prontuário de menor por um clique do responsável                                    |

## §4 — Como se prova (guardas planejados; **nenhum existe**)

Pela técnica de `docs/TECNICA-DOS-GUARDAS.md`: derivar do disco, fatiar, provar vermelho por sabotagem. **Só
entram depois da correção**, para não nascerem acusando dezenas de violações conhecidas.

- **`o-responsavel-age-so-por-vinculo-provado`** falha se uma action da área do paciente aceitar `pacienteId` do
  cliente sem o resolvedor, se o resolvedor responder 403 em vez de 404, ou se um vínculo `encerrado` ainda
  abrir acesso.
- **`o-dependente-nao-recebe-aviso-no-endereco-tecnico`** falha se algum envio (e-mail, WhatsApp) puder ter como
  destinatário o endereço técnico do D-04.
- **`a-acao-em-nome-de-registra-quem-e-por-quem`** falha se uma action que usa o resolvedor não gravar
  `atuandoComo` e `pacienteId` na auditoria.
- **`o-responsavel-so-cria-dependente-e-nunca-liga-existente`** falha se alguma action do responsável aceitar o
  identificador de um paciente que já existe para criar vínculo (D-09), e **`o-acesso-do-admin-recusa-dependente`**
  falha se `garantirContaDeAcesso` puder criar conta no Clerk para um paciente com vínculo ativo (D-04).
- **`o-papel-do-cadastro-e-um-enum-fechado`** (D-10): o perfil do `/registrar-se` só entra por
  `z.enum(['paciente','responsavel'])`, é lido **só na criação da conta** e **nunca** relido no login. Sabotagem:
  acrescentar `'admin'` ao enum, ou reler o perfil no login, tem de deixá-lo vermelho. O guarda
  `cadastro-por-link-abre-sem-conta` **não muda** (a P-12 não leva a escolha para o link).
- **`o-registrar-se-nao-cria-ficha-para-responsavel`** (D-14): falha se o webhook ou o `/redirect` inserirem em
  `pacientes` para quem tem perfil `responsavel`.
- **`a-conversao-so-troca-o-dono-da-ficha-e-nada-se-perde`** (D-13), **com Postgres real**: depois da conversão
  `pacientes.id` e as linhas clínicas são **as mesmas**; só `pacientes.user_id` mudou; `mensagens`, `notificacoes` e
  os consentimentos seguem em `U`; a auditoria tem o **antes**; rodar duas vezes não duplica `D` nem o vínculo. **Um
  controle limpo:** conta que não é candidata nem aparece na lista e recebe 404 se convertida por id.
- **`a-conversao-nao-deixa-o-clerk-para-tras`** (D-13): falha da chamada ao Clerk deixa `sincronizacao_pendente` e a
  ação reexecutável; o papel efetivo da sessão nunca fica `paciente` com o banco em `responsavel`.
- **`a-procuracao-nomeia-o-menor-e-o-responsavel`** (D-15), executando o gerador do PDF: com vínculo `ativo` o texto
  traz **os dois** nomes e a assinatura é a do responsável; sem vínculo, o PDF do adulto sai **idêntico** ao de hoje; o
  signatário do DocuSign nunca é o e-mail técnico do dependente. Sabotagem: devolver o nome do menor na assinatura tem
  de deixá-lo vermelho.
- **`so-o-admin-exclui-conta`** (D-16): nenhuma Server Action chama `clerkClient().users.deleteUser` fora de uma que
  exija `verificarAdmin()`; `excluirMinhaConta` **não existe** ou recusa **todo** papel **antes** de qualquer chamada ao
  Clerk; `excluirUsuarioAdmin` recusa responsável com vínculo `ativo`, e `resumirVinculosDoUsuario` o conta. Sabotagem:
  religar a autoexclusão, mesmo com o botão escondido, tem de deixá-lo vermelho. **Deriva do disco** (todo
  `deleteUser` de `app/` e `lib/`). ⚠️ `lib/pacientes/conta-de-acesso.ts:181,186` também o chama, para **desfazer** uma
  conta recém-criada (ADR-0031); o guarda precisa distinguir esse caso, ou nasce acusando o que está certo.
- **`o-cadastro-nao-oferece-google`** (D-14): o `/registrar-se` não contém `oauth_google`, `authenticateWithRedirect` nem
  `handleGoogleSignUp`, e o `<SignIn/>` do `/entrar` leva `transferable={false}`. Sabotagem: religar qualquer um dos dois
  tem de deixá-lo vermelho. **Só prova que o código está escrito assim**; o efeito com um Google desconhecido exige a
  verificação manual do D-14.
- **Integração (Postgres real):** dois responsáveis, três dependentes, **um controle limpo** (responsável sem
  vínculo com o paciente) que tem de receber 404 em todas as rotas; e o **segundo responsável** do mesmo
  dependente tem de ser recusado pelo índice único (P-07).

## §5 — Em aberto (**não presumido**)

### §5.1 — Regra de negócio

**Respondidas por Dryelle em 28/10/2026** (registradas como ditas; a coluna da direita diz o que mudou no desenho):

| #    | pergunta                                                     | resposta                                                                                                                       | efeito              |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------- |
| P-01 | Quem é "dependente"?                                         | ⛔ ~~Só menor de idade.~~ **REVOGADA em 28/10/2026 por Dryelle: qualquer idade, inclusive maior de 18 anos.**                  | D-05                |
| P-02 | O mesmo usuário pode ser responsável **e** paciente?         | ⛔ ~~Não: é uma coisa só.~~ **REVOGADA em 28/10/2026 por Dryelle: pode ser os dois ao mesmo tempo.**                           | D-02                |
| P-03 | Como se cria o vínculo, e quem o confirma?                   | **Nasce no cadastro.** Duas formas propostas: campos de responsável preenchidos, ou escolher antes.                            | D-09, D-10          |
| P-04 | O dependente ganha login próprio?                            | **Nunca, por enquanto.** Fica sempre gerido pelo responsável.                                                                  | D-04                |
| P-05 | Quem consente e assina por um menor?                         | **Sempre o responsável.**                                                                                                      | D-07                |
| P-06 | Médico e admin veem que é dependente e quem é o responsável? | **Os dois.**                                                                                                                   | D-05                |
| P-07 | Mais de um responsável? Quem remove?                         | **Um só por paciente, e só o admin remove.**                                                                                   | D-01 (índice único) |
| P-08 | Procuração da ANVISA (ADR-0029) para um menor                | **"Usa o nome dos dois."** O menor é o outorgante e o responsável, o representante legal que assina. Respondida em 28/10/2026. | D-15; abre a P-16   |
| P-09 | Para quem vão os avisos?                                     | **Só o responsável**; é o único login, e a criança não tem login nem e-mail.                                                   | D-04 (condição 1)   |

**Segunda rodada, respondida por Dryelle em 28/10/2026:**

| #    | pergunta                                                      | resposta                                                                                                                                                                                                                                                                                                                                                  | efeito           |
| ---- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| P-10 | Quem é responsável **e** paciente precisa de duas contas?     | ⛔ **Superada em 28/10/2026:** com a P-02 revogada, a mesma conta é as duas coisas, e a colisão de CPF do ADR-0028 deixa de existir para esse caso. (A resposta original: o papel novo é para quem cuida de menores; maior de idade que se trata continua `paciente`.)                                                                                    | D-02             |
| P-11 | O titular que faz 18 anos continua sem login?                 | ⛔ **Sem efeito em 28/10/2026:** o dependente adulto passou a ser regra, então não há "aviso aos 18". A pergunta jurídica sobre o titular adulto sem login (P-04) **continua com o Jurídico**.                                                                                                                                                            | D-05             |
| P-12 | Por qual porta o responsável se cadastra?                     | **`/registrar-se`**, com a opção de se registrar como responsável **e já informar o paciente/dependente.**                                                                                                                                                                                                                                                | D-10, D-14       |
| P-13 | O que fazer com as crianças já cadastradas e o bloco do form? | **Preservar os dados.** O login passa a ser com os dados do responsável, e o dado da criança fica nele. Ajustar o formulário (hoje dados do paciente e, abaixo, do representante). **Uma ferramenta que liste os dependentes/contas e permita, com um clique, convertê-las em conta de representante; "pense nisso"** (cuidado com as contas existentes). | D-12, D-13, D-14 |

**Abertas pelas respostas (nenhuma presumida):**

| #     | pergunta                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P-13b | **Respondida em parte, 28/10/2026:** _"o paciente/responsável não deve ter acesso a excluir conta"_ e _"apenas admin pode excluir contas!"_ (todos os papéis, D-16). **Falta:** o **processo** do pedido de eliminação por `privacidade@be4hope.org` e o que se faz com o histórico clínico na exclusão pelo admin. **Decisão do Jurídico.**                                                                                                                                                                                                                                                                                       |
| P-14  | ✅ **Fechada em 28/10/2026.** Pergunta: o cadastro com o Google para responsável. **Resposta de Dryelle: "remova isso (opção) de cadastro com Google".** Efeito: D-14, que lê isso como "o responsável só se cadastra por e-mail e senha"; o alcance está na P-17.                                                                                                                                                                                                                                                                                                                                                                 |
| P-15  | ✅ **Fechada em 28/10/2026.** Pergunta: a conversão é do **admin**, caso a caso, com revisão de nome e CPF, ou também na tela do responsável? **Resposta de Dryelle: "Sim, só do admin."** Efeito: D-13.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| P-16  | ✅ **Fechada em 28/10/2026.** Pergunta: quais dados do responsável entram na procuração (D-15), só nome e CPF ou a qualificação completa? **Resposta de Dryelle: "só nome e CPF".** Efeito: D-12 (a tabela `responsaveis` só tem `cpf`) e D-15.                                                                                                                                                                                                                                                                                                                                                                                    |
| P-17  | ✅ **Fechada em 28/10/2026.** **(a)** _"apenas admin pode excluir contas!"_, para **todos os papéis**, inclusive o paciente comum (D-16). **(b)** _"todo o cadastro"_: o Google sai de **todo o `/registrar-se`**, para qualquer perfil (D-14). A doc do Clerk mostra que isso **não basta sozinho**: ver `transferable` no D-14.                                                                                                                                                                                                                                                                                                  |
| P-18  | **Como se qualifica o MENOR na procuração (D-15)?** Hoje o parágrafo do outorgante imprime `[estado civil]`, `[profissão]` e `RG nº [________]` quando vazios, e o e-mail do usuário, que seria o e-mail técnico do dependente. Omite-se o que não se aplica a menor? O contato impresso é o do responsável? **Redação de documento legal: dono e Jurídico.**                                                                                                                                                                                                                                                                      |
| P-19  | **Dependente maior de idade: quem consente, e o que prova o vínculo? (Jurídico e dono)** O vínculo nasce da declaração do responsável, sem prova (P-03). Para um menor isso é a regra de sempre; para um **adulto**, o responsável cria o registro de uma pessoa capaz **sem que ela saiba**, e passa a ter acesso ao prontuário e aos medicamentos dela. Os Termos pedem "estar representado por responsável legal devidamente cadastrado" (`termos-de-uso/page.tsx:106`). Exige-se um documento (curatela, procuração)? O dependente adulto aceita? **Implementei como pedido, sem nenhuma trava adicional, e não presumi uma.** |
| P-20  | **Quem é só responsável e depois precisa do próprio tratamento.** Quem se cadastra como "responsável por outra pessoa" nasce com o papel `responsavel` e **sem ficha de paciente**: não tem como se tratar nessa conta. Quem é `paciente` ganha o caminho "Meus dependentes". O inverso não existe. Basta escolher "Sou o paciente" no cadastro (e cuidar de dependentes depois), ou é preciso um caminho para um `responsavel` virar paciente?                                                                                                                                                                                    |

### §5.2 — Segurança e LGPD (as três perguntas do `.claude/rules/seguranca-lgpd.md`)

1. **Quem pode ler?** O responsável com vínculo `ativo` **e** só do paciente vinculado (papel certo + id alheio é
   OWASP API1); o médico do paciente; o admin. P-06 confirma que médico e admin veem o vínculo.
2. **Quanto tempo fica?** A vigência do vínculo e o prazo de retenção do registro são **decisão do Jurídico**. O
   campo existe (`encerrado_em`) e o prazo **fica vazio**; **não se chuta o número**.
3. **O acesso é auditado?** Sim: D-06, com `visualizar` para leitura de dado sensível.

### §5.3 — Normas a ler e transcrever **antes** de decidir (não citadas)

Seguindo a regra de fundamentação do `CLAUDE.md` e o `DO-31`, cada uma vira regra citável no `02` quando lida; o
objeto e a vigência se conferem antes: o artigo da **LGPD** sobre tratamento de dados de crianças e
adolescentes; o **ECA**; o que a **CFM 2.314/2022** diz da autorização do paciente quando ele é menor; o que a
**RDC 1.015/2026** diz da importação quando o paciente é menor; e a regra de representação de incapazes, a
identificar pelo Jurídico.

## §6 — O que NÃO foi medido

- **Produção.** Quantos pacientes são menores, quantos têm `responsavel_nome`, e **quantas contas seriam
  candidatas à conversão**. Consulta de **só leitura**, sem PII, para rodar na VPS (padrão do `CLAUDE.md`; saída só
  contagens):
  `select count(*) total, count(*) filter (where p.data_nascimento > current_date - interval '18 years') menores,
count(*) filter (where p.data_nascimento is null) sem_nascimento, count(*) filter (where
nullif(p.responsavel_nome,'') is not null) com_responsavel, count(*) filter (where
nullif(p.responsavel_nome,'') is not null and nullif(p.responsavel_cpf,'') is not null) com_responsavel_e_cpf,
count(*) filter (where u.clerk_id is not null) com_login, count(*) filter (where p.data_nascimento >
current_date - interval '18 years' and nullif(p.responsavel_nome,'') is not null) menores_com_responsavel from
pacientes p join users u on u.id = p.user_id where p.deleted_at is null;`
  (Sintaxe validada contra o Postgres local em 28/10/2026; lá devolve zeros, e **não diz nada sobre produção**.)
  **A pergunta que mais importa e que o banco responde:** `menores_com_responsavel` contra `menores` e
  `sem_nascimento`. Se a maioria das crianças **não** tiver o responsável preenchido, a ferramenta de conversão
  (D-13) parte de dados incompletos, o admin digita nome e CPF caso a caso, e o custo da tela sobe.
- **A heurística de candidata do D-13** nunca foi rodada em dado real.
- **O Clerk em um ponto:** como atualizar
  `publicMetadata.role` e o nome de um usuário existente se comporta com sessão ativa dele. **Isso não foi lido na doc do Clerk.**
- **Os 84 pontos, um a um.** Os números vêm de `grep`, não de leitura de cada função; o conjunto que o
  responsável de fato alcança sai do diagnóstico por action, na fatia 4. Reproduzir:
  `grep -rE "eq\(pacientes\.userId" . --include=*.ts --include=*.tsx --exclude-dir={node_modules,.next,__tests__,docs,scripts}`
  e descontar `db/seed*`.
- **O comportamento do Clerk** e do webhook `user.created`, para o D-04: a recomendação é **não criar** conta no
  Clerk para o dependente, e isso não foi exercitado.
- **Os 16 arquivos de envio** (D-04) vêm de um filtro por texto, não de leitura: podem sobrar arquivos que não
  enviam ao paciente, ou faltar um que envia por caminho indireto.
- **As tabelas de consentimento** (D-07): não foi lido como guardam titular e quem aceitou.
- **A sentinela e a reconciliação** (D-09): sabe-se que leem `pacientes.userId`; **não** se sabe como tratam um
  paciente sem conta no Clerk.
- **A teleconsulta** (D-08): a recusa do papel `responsavel` está **lida nas linhas citadas**, não executada; e o
  canal Pusher `private-user-{userId}` vem do `AGENTS.md`, **não** foi aberto o código de entrega da chamada.
- **A procuração (D-15):** o template, a rota e o DocuSign foram **lidos, não executados**; não gerei o PDF com os
  dois nomes, e **não sei** como o GOV.BR trata a procuração por representante legal.
- **A exclusão de conta (D-16):** nada foi executado; a ausência de checagem de papel e de auditoria em
  `excluirMinhaConta` é **leitura do arquivo** (zero ocorrências por `grep`).
- **O efeito de `transferable={false}`** (D-14): li a doc oficial do `<SignIn/>`, que o descreve, mas **não testei** o
  login com um Google desconhecido, e a doc **não diz** se um provedor social pode ser só de login.
- **Quantos usuários criaram conta pelo Google** (D-14): não medi; decide o custo de qualquer mudança no login.
- **Qualquer tela.** Nada foi desenhado; a identidade visual existente se reaproveita (proibição 3).

## §7 — Fatias

A ordem mudou em 28/10/2026 (D-11): **a conversão das contas existentes depende da área do responsável**, e não o
contrário.

1. **Modelo.** Valor `responsavel` no enum (D-02), tabelas `responsaveis` (D-12) e de vínculo com o índice único
   (D-01), o resolvedor (D-03) e a auditoria (D-06), `destinatarioDoPaciente` (D-04), com um controle limpo.
   Migration **aditiva**, que exige autorização por escrito em `.claude/autorizacoes.txt`; o Item 85 registra que o
   journal tem datas fora de ordem. **Nenhuma conta muda ainda.**
2. **Área mínima do responsável e `/registrar-se`** (D-10, D-14): lista de dependentes, seletor "agir por qual
   filho", e o cadastro novo com dependente, **sem o Google** (P-14). Os 5 pontos de papel (§1) e o layout
   entram aqui.
3. **Ferramenta de conversão do admin** (D-13): lista de candidatas, diálogo com revisão de nome e CPF, transação,
   sincronização com o Clerk reexecutável, auditoria. **Só depois da fatia 2**, e **primeiro uma conta de teste
   local**, depois uma de cada vez em produção. Antes, **rodar a consulta de §6**.
4. **Formulário de equipe** (`novo/page.tsx`): responsável primeiro, dependente depois (D-14).
5. **Migração das actions**, **uma por commit**: recompras, documentos, ANVISA, pagamentos, depois do
   pré-requisito do D-08. **A teleconsulta tem fatia própria** (D-08), e a **procuração** (D-15) entra com a P-18 respondida e a autorização
   de `lib/receituario/` e `lib/docusign/`. A **retirada da autoexclusão de conta** (D-16) **não depende de nenhuma fatia**: é uma mudança pequena e independente
   (1 chamador, sem migration), pode sair antes de tudo, e deve sair **com o guarda** `so-o-admin-exclui-conta`. **O mesmo vale para tirar o Google do `/registrar-se`** (D-14),
   com o guarda `o-cadastro-nao-oferece-google` e a verificação manual com um Google inexistente.

## §N — O que a implementação ensinou

**Primeira entrega, 28/10/2026** (local, sem commit, branch `feat/papel-responsavel-e-dependentes`):

- **D-14 (Google):** removidos `handleGoogleSignUp`, o botão e o separador "ou" do `/registrar-se`, e o "já possui uma
  conta?" ficou; o `<SignIn/>` do `/entrar` passa `transferable={false}`. Conferido no navegador (nenhum "Google" no DOM, sem
  erro de console nem de servidor). Guarda `o-cadastro-nao-oferece-google` (6 casos), que nasceu vermelho e resistiu a
  8 sabotagens. **Não testado:** um Google inexistente num Clerk de desenvolvimento.
- **D-16 (autoexclusão):** `excluirMinhaConta` não foi removida, **recusa todo papel** e não toca no Clerk nem no banco, porque
  a tela que a importa (`app/(paciente)/paciente/perfil/page.tsx`) está em **área protegida por hook** e a edição exige uma
  linha `path:` em `.claude/autorizacoes.txt`. O classificador de permissões **negou duas vezes** que eu escrevesse nesse
  arquivo (é o controle que decide o que posso editar), e eu não procurei outro caminho. Guarda `so-o-admin-exclui-conta`
  (5 casos): **2 vermelhos de propósito** (`excluirMinhaConta` existir; "Excluir Minha Conta" na tela) até a tela ser editada,
  quando a função sai. **Falta:** essa edição e a sabotagem do guarda no estado final.
- **O que a implementação ensinou.** (1) A primeira sabotagem de `transferable` saiu **verde**, e o defeito era da mutação:
  o `replace` trocava a primeira ocorrência, que estava no comentário que eu acabara de escrever. A prova só valeu depois de
  mirar a linha da prop. (2) **59 casos de guarda já falham neste ambiente (Windows)**, em 8 arquivos; medi o mesmo número numa
  cópia limpa do commit `8d9da6c` da `main`, então não são da mudança. (3) `scripts/conferir-baseline.mjs` **não mede** lint
  nem Prettier aqui (espera a saída do `pnpm`, que não está instalado); tipos deram 0. Medi à mão: o Prettier e o ESLint dos
  arquivos tocados não pioraram.

**Segunda entrega, 28/10/2026** (local, sem commit, mesma branch). ⚠️ **Retifica a primeira:** a tela do perfil foi editada depois da
autorização por escrito, a função provisória saiu e `so-o-admin-exclui-conta` está **5 de 5 verde**.

- **Modelo (D-01, D-02, D-12).** Valor `responsavel` em `user_role`, enum `vinculo_responsavel_status`, tabelas `responsaveis` (só `cpf`)
  e `responsaveis_pacientes`, com o **índice único parcial** `responsaveis_pacientes_ativo_unq`. Migration **`0055`**, gerada pelo
  `drizzle-kit` (SQL conferido: só criação aditiva, o `when` do journal é posterior ao marco de produção). **Aplicada só no banco local.**
- **Acesso (D-02, D-10).** `Role` e `verificarResponsavel`; `lib/auth/perfil-da-conta.ts` (função pura, fechada em dois valores, ignora OAuth,
  lida só na **criação** da conta no webhook e no `/redirect`); o webhook e o `/redirect` só criam ficha para `paciente`; o login leva o
  responsável a `/responsavel`.
- **Resolvedor e criação (D-03, D-09).** `lib/auth/escopo-do-responsavel.ts` (404 indistinto, papel lido do banco, vínculo ativo);
  `lib/dependentes/criar-dependente.ts` (**única** porta que cria vínculo, numa `dbTransacional()`); `app/_actions/dependentes.ts` (Zod,
  menor de 18 anos, CPF, auditoria sem dado pessoal). **A action não recebe `pacienteId`.**
- **Dependente sem e-mail (D-04, condição 1).** `users` técnico `dependente-<id>@dependente.invalid` (TLD reservado), sem `clerkId`;
  `lib/email/destinatarios-tecnicos.ts` embrulha as **quatro** fábricas de `BrevoClient` e descarta o endereço técnico.
- **Telas.** `/responsavel` (lista e formulário, reaproveitando `Card`, `Input`, `Label`, `Button`); `/registrar-se` com "Sou o paciente /
  Sou responsável por um menor": o responsável não pede endereço de paciente e **não chama** `atualizarPerfilCompletoPaciente` (que cria ficha).
- **Provas.** Integração `o-responsavel-age-so-por-vinculo-provado` (**17 casos**, Postgres real, com controle limpo): **6 sabotagens vermelhas**.
  Guardas `o-papel-de-responsavel-e-fechado-e-age-por-vinculo` (**16**) e `o-dependente-nao-recebe-aviso-no-endereco-tecnico` (**10**):
  **13 sabotagens vermelhas**. `tsc` 0 erros; `next build` saída 0, com `/responsavel` na tabela de rotas. A suíte tem as **mesmas 59 falhas**
  que a `main` tem neste ambiente e nenhuma nova.
- **Dois defeitos meus achados no caminho.** (1) Dois casos do guarda do papel nasceram vermelhos por **defeito do guarda** (esperava lista vazia
  onde o único leitor legítimo é a própria função; e um regex casava `erro: string` dos tipos): corrigidos antes de valer. (2) Um erro de tipo do mock.

**O que NÃO foi feito (e por quê):**

- **A conversão das contas existentes (D-13)** e o **formulário de equipe** (D-14): dependem desta área e seguem pendentes.
- **`destinatarioDoPaciente`:** o aviso do dependente hoje **simplesmente não sai**; **não** vai ao responsável (P-09). O filtro só impede o envio
  ao endereço que não existe.
- **Migrar as actions do paciente** (recompra, documentos, ANVISA, pagamentos), a **teleconsulta** (recusa `responsavel` em
  `lib/auth/escopo-chamada.ts` e `escopo-sala.ts`) e a **procuração** (P-18): o responsável **vê e cadastra** dependentes, mas ainda **não age por eles**.
- **D-16, o resto:** `excluirUsuarioAdmin` ainda não recusa apagar responsável com vínculo ativo, e `resumirVinculosDoUsuario` não o conta.
- **`app/(paciente)/layout.tsx`** (área protegida, sem autorização) manda um `responsavel` que digite `/paciente` para `/`, em vez de `/responsavel`.
- **O admin não é avisado** de um responsável novo (a notificação "novo paciente" só sai para paciente).
- **Sem endereço de entrega** para quem recebe os medicamentos: o responsável não informa endereço, e o do dependente não é pedido no formulário.
  É decisão do **dono** (a recompra, fatia 5).
- **`/responsavel` não foi visto com uma sessão real do Clerk.** Foi compilado (build de produção) e a lógica foi provada no banco, mas **ninguém
  abriu a tela logado**; o cadastro de um responsável real (o perfil indo no `unsafeMetadata` até o webhook) também **não foi exercitado**.
- **A migration `0055` em produção** roda no deploy, sem rollback.

**Terceira entrega, 28/10/2026** (local, sem commit, mesma branch): a **mudança de regra** de Dryelle, antes do primeiro teste dela.

- **Idade (P-01 revogada).** `ehMenorDeIdade` saiu; entrou `dataDeNascimentoPlausivel` (existe, não é futura, não é anterior a 1900).
  A action, o formulário (campo de data de 1900 até hoje) e os textos deixaram de dizer "menor".
- **Papel (P-02 revogada).** O resolvedor aceita `responsavel` **e** `paciente` (`PAPEIS_QUE_PODEM_RESPONDER`); o layout de `/responsavel` deixa
  o `paciente` entrar, com o link "Minha área" de volta; o menu do paciente ganhou "Meus dependentes"; o cadastro diz "Sou responsável por
  outra pessoa". **Admin e médico seguem recusados.**
- **Sem limite.** Não havia limite no código nem no banco; agora há um teste com **4** dependentes de idades de 2 a 78 anos.
- **Sem migration nova.** Nada mudou no banco.
- **Provas.** Integração (**20 casos**, Postgres real): maior de idade; mais de 2 dependentes; um `paciente` que é responsável **e** não abre o
  dependente alheio; médico e admin recusados. Guarda (**21 casos**). **5 sabotagens que trazem a regra antiga de volta** (só `responsavel`
  responde, `admin` passa a responder, volta a exigir menor, limite de 2, data futura aceita), **todas vermelhas**. Suíte: as **mesmas 59 falhas**
  antigas e nenhuma nova; `tsc` 0 erros. **Não** rodei o `next build` de novo depois desta mudança.
- **Os testes antigos acusaram a mudança**, como devem: dois casos afirmavam "maior de idade é recusado" e "quem não é `responsavel` é recusado".
  Foram reescritos para a regra nova, e não removidos.
- **Risco que a regra nova abre, registrado na P-19:** o dependente adulto pode ser cadastrado **por declaração**, sem prova e sem o aceite
  dele. Implementei como pedido, **sem trava**.

**Quarta entrega, 29/10/2026** (local, sem commit, mesma branch): o responsável **age** pelo dependente, e cada dependente tem a sua área.

- **Cadastro do dependente reaproveita o do admin.** O schema e o mapeamento de `criarPaciente` foram extraídos para `lib/pacientes/ficha.ts`
  (`criarPacienteSchema`, `camposDaFicha`), porque um arquivo `'use server'` só exporta função assíncrona. A action da equipe e `criarDependente`
  usam o **mesmo** mapeamento. Os campos internos da associação (médico, status, etc.) **não** entram no formulário do responsável e são
  descartados no servidor (lista literal no teste, não a do código). **Decisão do dono em aberto:** se o responsável deve ou não preencher algum deles.
- **Uma área por dependente.** `/responsavel/dependentes/[pacienteId]/{,medicamentos,documentos,solicitacoes,consultas}`: toda página passa por
  `carregarDependente` (resolvedor, 404 indistinto), as leituras de `lib/dependentes/leituras.ts` recebem **só** `pacienteId` e a página diz de quem é.
  Sem dependente, o painel não mostra "Sua jornada" nem pendências; com dependente, "Jornada de {nome}". O menu lateral lista os dependentes e,
  com um aberto, as seções **dele** (`lib/dependentes/menu.ts`, função pura testada).
- **Agir por vínculo.** Recompra em nome do dependente (`solicitarRecompraManual` com `pacienteId`, provado pelo vínculo; BOLA fechado) e
  `escopo-documento` passou a chamar o resolvedor (antes tinha a própria consulta, uma segunda regra). Documentos vão por metadado, nunca `urlBlob`.
- **Técnicos fora de listas.** `buscarUsuariosChat` exclui `@dependente.invalid`. **Admin: pendente** (abaixo).
- **Admin cria responsável:** `criarResponsavelAdmin` e `DialogoCriarResponsavel` existem. **Não ligados à tela**, pelo hook de escopo.
- **Provas.** Integração (Postgres real): `o-responsavel-age-so-por-vinculo-provado` (25), `o-responsavel-pede-e-le-so-do-dependente-dele` (12),
  `o-admin-cadastra-responsavel` (18). Guarda `as-telas-do-responsavel-nao-misturam-dependentes` (19). 18 sabotagens vermelhas. Rodando a integração
  inteira: 395 passam e 2 falham (`o-comunicado-so-assina-quem-o-docusign-confirma`, 502 de `lerDocumentoPrivado`, arquivo que não toquei; **não** rodei o
  mesmo teste no commit limpo). Suíte: as mesmas 59 falhas antigas. `tsc` 0; Prettier e ESLint não pioraram nos arquivos tocados.

**Admin, entregue depois da autorização por escrito de Dryelle (29/10/2026):** botão "Novo responsável" ao lado de "Novo paciente" e em Usuários; papel, filtro e KPI "Responsáveis"; o `users` técnico do dependente fora da lista e das contagens; `excluirUsuarioAdmin` recusa apagar quem tem vínculo ativo (a contagem mora em `contarDependentesAtivos`, em `escopo-do-responsavel.ts`, para a leitura do vínculo ficar num lugar só — o guarda do resolvedor acusou a primeira versão, que lia a tabela no arquivo do admin). Integração `o-admin-lista-responsaveis-sem-os-dependentes-tecnicos` (11 casos): 6 sabotagens vermelhas, uma delas (contar o vínculo de qualquer responsável) sobreviveu à primeira rodada e ganhou o caso 11. Integração inteira: 405 passam, 2 falham (comunicado, 502 do storage privado, arquivo não tocado).

**Ainda não feito:** a tela **nunca foi vista com uma sessão real do Clerk**; teleconsulta, ANVISA e procuração para dependente; aviso de
`destinatarioDoPaciente` ao responsável; ferramenta do admin para encerrar vínculo; conversão D-13; endereço de entrega; `next build` depois desta entrega.

**Quinta entrega, 29/10/2026** (local, sem commit, mesma branch): a primeira rodada de teste de Dryelle com sessão real.

- **"Solicitações" dava erro.** Causa medida no log do servidor: `column recompras.solicitante_id does not exist`. O **banco de desenvolvimento local estava defasado** do schema (a coluna existe no schema, mas **nenhuma migration a cria** — achado de classe conhecida: as migrations não rodam do zero). Corrigido com `drizzle-kit push` **só no banco local** (alvo conferido como `localhost:5433` antes). **Produção não foi tocada.** ⚠️ Fica catalogado: `solicitante_id` sem migration (produção deve tê-la por `push`).
- **"Minha área de paciente" aparecia para quem só é responsável.** Causa medida no Clerk de desenvolvimento: a conta tinha `unsafeMetadata.perfil = responsavel` e banco `responsavel`, mas **`publicMetadata.role = paciente`**. Origem: `obterRoleComFallback` (`lib/auth/permissions.ts`) gravava o **default `paciente`** no Clerk quando ainda não havia linha no banco (sem webhook local, o `/redirect` cria a linha depois). Como o `publicMetadata` é lido **primeiro**, o papel errado ficava fixo. **Corrigido:** sem linha no banco, não se grava nada no Clerk. E o menu agora decide por **ter ficha de paciente** (`temFichaDePaciente`), não pelo papel. ⚠️ **A conta de teste já estava com o papel errado no Clerk e não foi alterada** (é escrita num sistema externo); ela continua entrando como `paciente` no Clerk até o papel ser reaplicado pelo admin (Usuários → editar papel).
- **Admin.** A tela "Pacientes" virou **"Pacientes e responsáveis"**, com duas abas; a de pacientes marca **quem tem responsável** (e esconde o e-mail técnico do dependente); a de responsáveis lista cada um com os dependentes (cada um abre a ficha), CPF mascarado e busca. `listarResponsaveisAdmin` lê o vínculo fora do resolvedor — o guarda foi ajustado com a razão escrita (é listagem, o admin vê todos).
- **"Novo responsável".** Máscaras de CPF e telefone (`lib/validacao/mascaras.ts`); **e-mail de boas-vindas** (sem a senha) enviado depois de gravar, e falha de e-mail não desfaz o cadastro. **Não existe hoje o fluxo "o responsável clica e define a senha"**: o projeto inteiro (médico, admin, paciente) funciona com a senha definida pelo admin e passada por outro canal, e foi mantido; o e-mail orienta usar "Esqueci minha senha" na tela de entrada, **o que não foi exercitado** (Clerk de desenvolvimento).
- **Dados do dependente.** Tela refeita: só o que foi informado, em quatro grupos, com CPF e datas formatados e uma linha "Não informado: …".
- **Pendente, por hook de escopo:** tirar "Nome/CPF do Responsável" da tela de **novo paciente** (`app/(medico)/medico/pacientes/novo/page.tsx`, compartilhada com o admin). A linha `path:` não pôde ser escrita (o classificador bloqueia escrita em `.claude/autorizacoes.txt`).
- **Provas.** Integração: admin 23 casos, cadastro 21; guarda novo `as-mascaras-e-o-email-do-responsavel` (30). 9 sabotagens vermelhas (uma sobreviveu e ganhou caso). `next build` saída 0. Suíte: as mesmas 59 falhas antigas. **Nenhuma tela logada foi vista** (o painel do navegador não tem sessão e senha não se digita).
- **Atualização, mesmo dia (visual).** (1) **Abas coladas no cartão:** causa medida no navegador — o `-mb-px` do `<nav>` (e qualquer `mb-*`) **vence o `space-y-6` do layout** (o `space-y` do Tailwind 4 tem especificidade zero), então a folga era 0 (com `mb-2`, 8 px). O `<nav>` ficou sem margem inferior e o encaixe da linha ativa passou para os links; folga medida: **24 px**. (2) **Painel inicial redesenhado** (`components/responsavel/painel-do-dependente.tsx`): cabeçalho com avatar, parentesco, idade e situação; jornada (2/3) ao lado da **próxima consulta** em destaque; cartões de medicamento (com revisão), documentos e ANVISA, cada um com o caminho da seção; **solicitações recentes** (até 3, só do dependente) e **atalhos** com o id dele. Os quatro números antigos, que ficavam espremidos em meia coluna e cortavam o texto, deixaram de ser usados no painel. Nenhuma leitura nova: reaproveita `resumoDoDependente` e `listarRecomprasDoDependente`. Cada bloco continua identificado pelo nome e **nada é somado entre dependentes**. ⚠️ **Prova visual:** os componentes foram renderizados com dados de exemplo e medidos num navegador com o CSS real do servidor (a fonte ali é a reserva, não a do produto); a tela **logada** continua sem ter sido vista.
