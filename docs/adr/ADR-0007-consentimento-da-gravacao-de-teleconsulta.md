# ADR-0007 — O consentimento da gravação é do paciente, versionado e revogável

> **Status:** 📋 **proposta — escrita em 20/08/2026**, na auditoria da
> [Sprint 1](../sprints/SPRINT-1-auditoria-da-teleconsulta.md).
> **Contexto:** a auditoria encontrou que o consentimento LGPD da teleconsulta **não é pedido a
> ninguém** — `components/teleconsulta/GlobalTeleconsultaHost.tsx:83` é `useState(true)`, sem
> setter e sem tela. O campo existe no schema e é gravado sempre como aceito.
> **O dono decidiu em 20/08/2026** que _"o consentimento é essencial para gente"_, e que
> **fornecerá o texto** do que se consente.
> **Decisão proposta:** quem consente é o **paciente**, antes de qualquer captura; o registro
> guarda **quem, quando e qual versão do texto**; e existe caminho de **revogação**.
>
> 🔴 **Esta ADR não implementa nada.** Ela existe para que o desenho seja aceito antes, e para
> listar exatamente o que falta vir do dono e do Jurídico.

---

## §1 — O que a medição provou

### 1.1 O consentimento não é "armazenado sem ser exigido". Ele não é obtido

```ts
// components/teleconsulta/GlobalTeleconsultaHost.tsx:83
const [consentimentoTranscricao] = useState(true);
```

Sem setter, sem UI, sem nenhum ponto em que alguém marque uma caixa. O valor é `true` **por
construção**. E até 20/08/2026 o handler de transcrição lia o consentimento do `formData`, isto
é, **do cliente**, e gravava `consentimentoObtido: true` sem consultar o banco
(`app/api/teleconsulta/transcrever/route.ts`, corrigido no Item 11).

A LGPD, art. 5º, XII, define consentimento como _"manifestação livre, informada e inequívoca
pela qual o titular concorda com o tratamento de seus dados pessoais para uma finalidade
determinada"_. **Um `useState(true)` não é manifestação de ninguém**, e dado de saúde é dado
sensível (art. 11), cujo tratamento por consentimento exige que ele seja **específico e
destacado**.

### 1.2 Quem "consentia" era o navegador do médico, não o titular

O `GlobalTeleconsultaHost` é a tela **do médico**. O paciente — o titular do dado — nunca
participou da decisão. Isso inverte o sujeito do consentimento.

### 1.3 O que sai da plataforma é mais do que "transcrição"

Medido em `app/api/teleconsulta/transcrever/route.ts`:

⚠️ **Correção medida em 20/08/2026:** o áudio **não é armazenado em lugar nenhum**. Ele vira
buffer em memória, é enviado ao Google e descartado — não há `put()`, blob nem upload em
`transcrever/route.ts`. Só o **texto** é persistido. Portanto o consentimento não é sobre
_"gravar a consulta"_, e sim sobre **processar o áudio ao vivo** para gerar resumo. A distinção
muda o texto do consentimento, e a favor: é bem mais fácil de aceitar.

| etapa     | o que sai                                                | para quem                                |
| --------- | -------------------------------------------------------- | ---------------------------------------- |
| captura   | áudio de médico **e** paciente, mixado em 2 canais       | só memória do navegador; **não é salvo** |
| ETAPA A   | **o áudio bruto**, sem máscara nenhuma                   | **Google Speech-to-Text**                |
| ETAPA B/C | o texto, com CPF/RG/telefone/e-mail mascarados por regex | **Gemini**                               |
| ETAPA D   | a transcrição e a narrativa                              | banco, vinculadas ao prontuário          |

🔴 **São dois operadores externos, não um** — e o áudio vai ao primeiro **sem** mascaramento,
porque áudio não se mascara com regex (Item 12). Um texto de consentimento que só fale de
"transcrição" descreve menos do que o sistema faz.

### 1.4 O schema registra menos do que a LGPD pede

`db/schema/teleconsultas.ts` tem `consentimentoLgpd` (boolean) e `consentimentoEm` (timestamp).
**Não tem** quem consentiu, qual texto foi aceito, nem se foi revogado. Sem a versão do texto, um
`true` de hoje pode se referir a um texto que já não existe — e provar consentimento é
justamente poder mostrar **a que** a pessoa disse sim.

---

## §2 — A decisão proposta

### D-01 — Quem consente é o **paciente**, na entrada da sala

O aceite acontece na tela do paciente (`app/(paciente)/paciente/teleconsulta/[roomId]`), antes
de entrar. O médico **vê** o estado do consentimento; não o concede.

### D-02 — Antes da captura, não durante

A gravação só inicia depois do registro persistido. Já implementado em 20/08 como falha segura:
`consentimentoRegistradoRef` governa o início do `MediaRecorder`, e o handler recusa transcrição
sem consentimento no banco.

### D-03 — ✅ **O bloqueio recai sobre a IA, não sobre a consulta** (versão final)

> ⚠️ **Esta decisão mudou DUAS vezes em 20/08/2026, e as três versões ficam registradas** — a
> regra do repositório manda retificar por escrito, não reescrever a história. O caminho
> importa mais que o destino: mostra por que a versão final é a certa.

**O QUE VALE (`DO-23`, 20/08/2026):**

| o que                                            | base legal                                                                                       | aceite bloqueante?                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| a **videochamada**                               | LGPD **art. 11, II, "f"** — tutela da saúde, em procedimento realizado por profissional de saúde | **não.** A consulta nunca é negada |
| enviar **áudio ao Google** e **texto ao Gemini** | **consentimento** (art. 11, I)                                                                   | **sim — e dos dois lados**         |

O botão é **grande e destacado**, o aviso é **explícito**, e sem o aceite de **paciente e
médico** não há transcrição nem narrativa por IA. O que muda em relação à versão anterior é
**onde** o bloqueio incide.

🎯 **Por que isto protege MAIS, e não menos.** A alínea "f" do art. 11, II dispensa
consentimento para _"tutela da saúde, exclusivamente, em procedimento realizado por
profissionais de saúde"_ — e a teleconsulta **é** esse procedimento. Logo a consulta já tem base
legal, mais forte que consentimento, porque **não é revogável no meio do atendimento**. O que
não cabe na alínea "f" é mandar o áudio a uma empresa de tecnologia: isso não é procedimento de
profissional de saúde, e aí o consentimento é a base correta.

Consequência prática: o aceite fica **livre** — quem recusa continua sendo atendido —, portanto
**válido**. Com o bloqueio da consulta, o aceite seria obtido sob pena de perder o atendimento,
e consentimento não-livre é **nulo** (art. 8º, §3º). Ou seja: a versão anterior produzia um
registro de aceite que poderia não valer nada, que é o oposto do objetivo declarado pelo dono
(_"nos proteger da lgpd por completo"_).

E resolve um impedimento concreto: **o agendamento presencial não existe no código.** Medido em
20/08 — `db/schema/consultas.ts` não tem campo de modalidade, não há enum presencial × remota, e
a única menção a "presencial" no repositório é uma linha em `app/(public)/termos-de-uso`. O botão
de alternativa que o bloqueio total exigiria não teria destino. Criá-lo é sprint própria.

**Ainda vale, da versão anterior:** pedir aos **dois**. O áudio capta a voz do **médico**
também — ele é titular de dado na captura, não só operador do sistema.

#### O caminho das três versões

| #   | versão                                                   | por que mudou                                                                                                                                    |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | _"recusar não impede a consulta; só desliga a gravação"_ | o dono inverteu: queria bloqueio forte (`DO-22`)                                                                                                 |
| 2   | _"sem aceite dos dois, a sala não abre"_ (`DO-22`)       | sinalizei o risco do art. 8º, §3º; o dono pediu _"estratégia criativa e palpável"_                                                               |
| 3   | **bloqueio sobre a IA, não sobre a consulta** (`DO-23`)  | a alínea "f" do art. 11 dá base legal à consulta e deixa o consentimento onde ele é livre — e o presencial não existe para servir de alternativa |

⚠️ **`GAP-15` fica RESPONDIDO por consequência:** não é mais necessário haver via alternativa de
atendimento, porque ninguém deixa de ser atendido. A pergunta perde o efeito bloqueante.

#### As duas versões anteriores, na íntegra

**Versão 1:** _"Sem consentimento, a teleconsulta acontece normalmente — apenas sem gravação,
sem transcrição e sem narrativa por IA. Recusar atendimento médico por causa de um recurso
acessório seria pior para o paciente."_

**Versão 2 (`DO-22`):** _"temos que deixar o botão de consentimento bem grande e com bloqueio na
teleconsulta, se nem o médico e o paciente fizerem isso, não terá a teleconsulta, temos que nos
proteger da lgpd por completo"_ — palavras do dono.

### D-08 — 🔄 RETIFICAÇÃO de 20/08/2026: são **DOIS** consentimentos, não um

> ⚠️ **Esta seção corrige a D-03 depois da transcrição da CFM 2.314/2022.** A D-03 continua
> válida no que diz sobre a **IA**; o que ela **não** viu é que existe um segundo consentimento,
> de outra origem, e esse **é** bloqueante para a teleconsulta.

**O que faltou na análise da D-03.** Ela concluiu que a videochamada não precisa de aceite porque
a LGPD art. 11, II, "f" dispensa consentimento para tutela da saúde. Isso está certo **sobre a
LGPD** — e é a resposta errada para a pergunta, porque **a LGPD não é a única norma que se
aplica**. A CFM 2.314/2022, transcrita de fonte primária em 20/08, é explícita:

> _"O paciente ou seu representante legal **deverá autorizar** o atendimento por telemedicina e a
> transmissão das suas imagens e dados por meio de (termo de concordância e autorização)
> consentimento, livre e esclarecido (…) devendo fazer parte do SRES do paciente."_
> — **Art. 15** (`CFM-01`)

> _"Em todo atendimento por telemedicina deve ser assegurado consentimento **explícito**, no qual
> o paciente (…) deve estar consciente de que suas informações pessoais podem ser compartilhadas
> e sobre o seu **direito de negar** permissão para isso, **salvo em situação de emergência
> médica**."_
> — **Art. 15, parágrafo único** (`CFM-02`)

**Base legal dispensa consentimento como fundamento de tratamento de dado. Não dispensa norma
ética que exige autorização para o ato.** São exigências de origens diferentes, e as duas valem.

#### O desenho correto: dois consentimentos, com naturezas distintas

| #   | consentimento                                                            | fundamento                                             | bloqueia o quê                                            |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------- |
| 1   | **atendimento por telemedicina** — inclui a transmissão de imagem e dado | **CFM 2.314, Art. 15** (norma ética)                   | 🔴 **a teleconsulta.** Sem ele, não há atendimento remoto |
| 2   | **transcrição e análise por IA** — áudio ao Google, texto ao Gemini      | **LGPD art. 11, I** (consentimento para dado sensível) | apenas a IA. A consulta acontece sem ele                  |

🎯 **O dono estava mais certo do que eu.** A intuição de `DO-22` — _"se nem o médico e o paciente
fizerem isso, não terá a teleconsulta"_ — corresponde ao **consentimento 1**, que a CFM realmente
exige e que realmente bloqueia. O que eu contra-argumentei com a LGPD se aplica ao
**consentimento 2**, e ali o argumento continua de pé.

**E o problema da alternativa se resolve por norma, não por feature:** o Art. 19 (`CFM-08`) diz
que os serviços a distância _"jamais poderão substituir o compromisso constitucional de garantir
assistência presencial"_. Ou seja, a alternativa ao paciente que recusa **existe por obrigação
legal do serviço de saúde**, mesmo que a plataforma ainda não agende presencial (`DO-28`). O
consentimento 1 é livre porque a recusa não deixa o paciente sem atendimento — deixa sem
atendimento **remoto**.

#### O que isso exige de implementação, e ainda não existe

| #   | falta                                                                                                     | estado                |
| --- | --------------------------------------------------------------------------------------------------------- | --------------------- |
| 1   | tela de consentimento **de teleconsulta**, separada da de IA, bloqueando a entrada na sala                | 🔴 **não construída** |
| 2   | o aceite tem de **fazer parte do prontuário** (`CFM-01`: "SRES"), não só de uma coluna em `teleconsultas` | 🔴 não feito          |
| 3   | o texto tem de dizer que **dados podem ser compartilhados** e que **negar é um direito** (`CFM-02`)       | 🔴 falta no texto     |
| 4   | exceção de **emergência médica** (`CFM-02`)                                                               | 🔴 não modelada       |

⚠️ **O que existe hoje cobre o consentimento 2, não o 1.** A implementação de 20/08 pede aceite
para a **IA** e deixa a consulta livre. Pela CFM, falta o aceite da **teleconsulta**. Entra como
item próprio no `03` — não se corrige de passagem, porque muda o fluxo de entrada na sala.

### D-04 — O registro guarda quem, quando e **qual texto**

Campos novos em `teleconsultas`:

| campo                           | por quê                                                   |
| ------------------------------- | --------------------------------------------------------- |
| `consentimentoPor` → `users.id` | quem manifestou. Sem isto, o registro não prova nada      |
| `consentimentoVersaoTexto`      | a que a pessoa disse sim. Texto novo ⇒ consentimento novo |
| `consentimentoRevogadoEm`       | a LGPD dá direito de revogar (art. 8º, §5º)               |

⚠️ **Exige migration**, e `db/migrations/` é bloqueado por hook de propósito: `pnpm db:migrate`
roda contra produção sem rollback (Item 1). Precisa de autorização própria.

### D-05 — O texto fica **versionado no código**, não no banco

Uma constante versionada (`lib/teleconsulta/consentimento.ts`), com o texto e o identificador de
versão. Assim o texto entra por diff revisável, e o banco guarda apenas **qual versão** foi
aceita. Texto editável em runtime não é auditável.

### D-06 — Revogar apaga o que dela decorre

Revogação sem efeito é revogação de fachada. Revogar ⇒ soft delete da transcrição e da narrativa
derivadas, preservando o registro de que existiram (Proibição 3 do `CLAUDE.md`: não sobrescrever
histórico clínico). ⚠️ **Se a narrativa já virou evolução assinada pelo médico, ela é ato
clínico e não se apaga** — o que se apaga é o insumo, não o ato. **Isto precisa de confirmação
do dono e do Jurídico.**

---

## §3 — O que foi rejeitado, e por quê

| rejeitado                                             | por quê                                                                                                                        |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Deixar como está** (`useState(true)`)               | é a ausência de consentimento com aparência de consentimento — pior que a ausência declarada, porque quem lê o schema acredita |
| **O médico consente pelo paciente**                   | o titular do dado é o paciente. Consentimento por procuração tácita não é manifestação do titular                              |
| **Consentimento no cadastro, uma vez, para sempre**   | dado sensível pede finalidade **determinada** (art. 11). "Aceito tudo para sempre" não é específico nem destacado              |
| **Bloquear a consulta sem aceite**                    | tornaria o consentimento não-livre (art. 8º, §3º) e puniria o paciente. Ver D-03                                               |
| **Texto do consentimento no banco, editável em tela** | texto que muda sem diff não é auditável, e a versão aceita deixaria de ser rastreável                                          |
| **Eu escrever o texto jurídico**                      | não sou fonte de texto legal. Texto inventado é pior que texto ausente, porque quem lê acredita — regra do `CLAUDE.md`         |
| **Só desligar a transcrição e não resolver**          | foi oferecido ao dono em 20/08 e recusado: _"o consentimento é essencial para gente"_                                          |

---

## §4 — 🔴 O que falta vir de fora, para isto sair do papel

### Do dono / Jurídico — o texto e três decisões

O texto precisa cobrir **o que o código faz de fato** (§1.3), não uma versão simplificada:

1. que a consulta é **gravada** (áudio de ambos);
2. que o **áudio é enviado ao Google** para virar texto — serviço nos EUA, **sem** máscara;
3. que o **texto é enviado ao Gemini** para virar narrativa clínica, com CPF/RG/telefone/e-mail
   mascarados — mas **nome próprio não é mascarado hoje** (Item 12);
4. que a transcrição **fica no prontuário**;
5. **por quanto tempo fica** — 🔴 prazo de retenção é decisão jurídica, e o campo existe vazio
   até ela existir (regra das três perguntas em `.claude/rules/seguranca-lgpd.md`).

E três decisões:

| #   | pergunta                                                            | por que não posso decidir                                   |
| --- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | consentimento **único** ou **separado** (gravar × enviar à IA)?     | granularidade de finalidade é decisão de produto e jurídica |
| 2   | prazo de **retenção** da gravação e da transcrição                  | é decisão jurídica; não se chuta número                     |
| 3   | revogação apaga a **evolução clínica** já assinada, ou só o insumo? | é regra de negócio clínica (D-06)                           |

### Do Jurídico — base legal dos operadores

Google STT e Gemini recebem dado de saúde. Base legal e contrato de operador são decisão do
Jurídico (`CF-01`, `GAP-06`), não de TI. **O consentimento do paciente não substitui o contrato
de operador** — são obrigações distintas.

🔴 **E há um terceiro operador, decidido em 20/08/2026: a Cloudflare** (`DO-21`, TURN da
videochamada — [ADR-0008](ADR-0008-turn-contratado-para-a-midia-da-teleconsulta.md)). Duas
pendências bloqueantes, registradas também no `03` e no `04`:

| #   | pendência                                                                                            | de quem      | sem isso                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------- |
| 1   | **criar a conta** na Cloudflare e provisionar `CLOUDFLARE_TURN_KEY_ID` e `CLOUDFLARE_TURN_API_TOKEN` | dono / infra | a chamada usa só STUN; conexão que precise de retransmissão **falha**, com aviso na tela |
| 2   | **assinar o DPA da Cloudflare** antes de qualquer consulta real passar por lá                        | **Jurídico** | operador sem contrato — o mesmo defeito que a substituição do TURN público veio corrigir |

⚠️ **A Cloudflare não lê a mídia** (o vídeo chega cifrado por DTLS), mas **vê o IP** de médico e
paciente. IP é dado pessoal, logo ela **é operadora** — e não deixa de ser por não ver conteúdo.
A pendência 2 não é formalidade.

---

## §5 — Como se prova

| guarda                            | falha quando                                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `consentimento-e-do-paciente`     | a gravação puder iniciar sem registro persistido, ou o aceite for gravado a partir de afirmação do cliente |
| `consentimento-versionado`        | um aceite for gravado sem a versão do texto, ou o texto mudar sem mudar a versão                           |
| `revogacao-tem-efeito`            | revogar deixar transcrição ou narrativa legíveis                                                           |
| `consentimento-bloqueia-a-sala`   | a sala abrir sem aceite dos **dois** lados (`DO-22`), ou o bloqueio depender só do cliente                 |
| `texto-de-consentimento-revisado` | o texto ainda for o rascunho não revisado juridicamente — **impede o deploy**, de propósito                |

✅ **IMPLEMENTADO em 20/08/2026** como `consentimento-governa-a-ia-nao-a-consulta` — **20
casos**, com **7 sabotagens provadas vermelhas**. Três delas sobreviveram na primeira rodada,
por erro de granularidade do próprio guarda (procurava o nome do campo no arquivo, não na
expressão de decisão); o registro está no topo do arquivo do guarda.

Cobre as duas metades da decisão: que a **IA** é bloqueada sem os dois aceites, **e** que a
**consulta não é** — este segundo grupo existe para que a reversão a `DO-22` não passe sem
decisão escrita.

⚠️ **Os guardas de revogação com efeito (D-06) não entram antes da implementação.** Guarda para violação conhecida e não
corrigida nasce vermelho e fica vermelho — e guarda permanentemente vermelho é guarda que
alguém desliga (`.claude/rules/seguranca-lgpd.md`).

**Já em vigor desde 20/08/2026**, sem depender desta ADR: o handler recusa transcrição sem
consentimento no banco, e a gravação não inicia sem registro (`consentimentoRegistradoRef`).
Coberto pelo guarda `autorizacao-tem-escopo-de-objeto`.
