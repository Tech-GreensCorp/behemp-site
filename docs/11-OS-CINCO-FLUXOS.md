# Os cinco fluxos — Greens e BeHemp

> 🔴 **Documento vivo.** O dono mantém os fluxos; esta cópia acompanha. Quando ele mandar uma
> versão nova, **o texto dos fluxos se substitui** e a coluna de estado se remede — nunca o
> contrário. Criado em 10/09/2026 a pedido dele: _"salve eles em um documento e conforme eu
> atualizar você atualiza ele em paralelo"_.
>
> **A fonte dos fluxos é o dono. A fonte do estado é o código.** Nenhuma linha da coluna
> "estado" entra sem ter sido medida.

## Como ler

| marca | quer dizer                                 |
| ----- | ------------------------------------------ |
| ✅    | existe e foi medido                        |
| 🟡    | existe em parte — a coluna diz o que falta |
| 🔴    | não existe                                 |
| ⏸️    | adiado por decisão registrada              |

---

# FLUXO GREENS

## Fluxo Greens 1 — paciente **sem ANVISA** vindo da Greens

| #   | passo                                                              | estado | medido                                                                 |
| --- | ------------------------------------------------------------------ | ------ | ---------------------------------------------------------------------- |
| 1   | não tem ANVISA e veio do link da Greens                            | ✅     | `POST /api/parceiros/greens/cadastro`, HMAC — 9 protocolos em produção |
| 2   | documentos e dados que ele preenche são enviados para a BeHemp     | ✅     | contrato aceita arquivo desde 10/09; baixa com allowlist e re-hospeda  |
| 3   | BeHemp ao receber documentos cria a conta dele                     | ✅     | `app/_actions/cadastro-por-link.ts`                                    |
| 4   | envio do código no e-mail e tela para receber **o código + senha** | 🟡     | 🔴 **a tela pede TUDO de novo** — nome, CPF, telefone, e-mail          |
| 5   | direcionado direto para a procuração da ANVISA                     | ✅     | `destinoDepoisDoCadastro` → `/paciente/anvisa`                         |
| 6   | documentos e dados já preenchidos pelo sistema                     | ✅     | viram linha em `documentos`, que a tela da ANVISA lê                   |
| 7   | aprovado ou rejeitado → notificação e-mail, celular e no sistema   | ⏸️     | só o sistema (Pusher). **Item 29**, adiado pelo dono                   |
| 8   | se aprovado, a ANVISA é enviada para a Greens automaticamente      | ✅     | `notificarParceiro({ tipo: 'anvisa_aprovada' })`                       |

### 🔴 O que falta no passo 4, e por que importa

O paciente **já preencheu nome, CPF, telefone e e-mail no formulário da Greens** — é de lá que
esses dados vêm. Pedir tudo de novo aqui é fazer o trabalho duas vezes, e é onde se perde gente.

**Ele só precisa de duas coisas:** o código que chegou no e-mail, e a senha que vai criar.

A tela hoje não distingue de onde o paciente veio. Precisa: quando o handoff já trouxe os
dados, mostrar apenas **código + senha**, com os demais confirmados em modo de leitura — o
paciente **vê** o que a Greens mandou (e pode corrigir se estiver errado), mas não digita.

## Fluxo Greens 2 — paciente **sem receita médica / inválida** vindo da Greens

| #   | passo                                                                       | estado | medido                                                      |
| --- | --------------------------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| 1   | ChatPro **da Greens** envia o link do site da BeHemp                        | 🟡     | endpoint pronto; **falta o bloco no diagrama do bot deles** |
| 2   | mesmo link de formulário, com os dados básicos da pessoa                    | ✅     | `/cadastro/<token>`                                         |
| 3   | dados restantes ficam pendentes como aviso                                  | ✅     | `pendenciasDe` — a tela mostra o que falta                  |
| 3b  | **pergunta se já tem a ANVISA; se tiver, anexa ali mesmo**                  | ✅     | 10/09 — a declaração é gravada mesmo sem arquivo            |
| 4   | encaminha direto para agendar a primeira consulta                           | ✅     | `destinoDepoisDoCadastro` → `/agendamento`                  |
| 5   | receita feita pelo médico e enviada à Greens, com aviso **e consentimento** | 🟡     | aviso ✅ (`receita_emitida`); **consentimento 🔴**          |
| 5b  | **depois da receita, aviso com botão para a procuração**                    | 🔴     | a declaração já está gravada; falta o aviso                 |

⚠️ **O "consentimento" do passo 5 é requisito novo** (versão de 10/09/2026). O aviso hoje sai
automático quando a receita é emitida. Se o envio passa a depender de um ato do paciente, o
gatilho muda: deixa de ser "receita emitida" e passa a ser "paciente consentiu". Isso é decisão
de produto e precisa de ADR.

---

# FLUXO BEHEMP

## Fluxo BeHemp 1 — paciente **sem ANVISA** vindo da BeHemp

| #   | passo                                                                                                                      | estado | medido                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------- |
| 1   | ChatPro manda o link do formulário com as informações básicas                                                              | ✅     | `/api/chatpro/bot-link` — provado em produção |
| 2   | formulário preenchido → área de procuração da ANVISA                                                                       | ✅     | mesma regra de destino do fluxo Greens 1      |
| 3   | com consentimento do paciente e recomendação do médico, **a Greens recebe os dados + documentação e cria a conta dele lá** | 🔴     | **não existe**                                |

## Fluxo BeHemp 2 — paciente **sem receita**

| #   | passo                                                                                | estado | medido                  |
| --- | ------------------------------------------------------------------------------------ | ------ | ----------------------- |
| 1   | ChatPro envia o mesmo link de formulário                                             | ✅     | `/api/chatpro/bot-link` |
| 2   | formulário preenchido → área de agendamento                                          | ✅     | `/agendamento`          |
| 3   | dados faltantes ficam pendentes com aviso                                            | ✅     | `pendenciasDe`          |
| 4   | consentimento + recomendação → **Greens recebe dados + documentação e cria a conta** | 🔴     | **não existe**          |

## Fluxo BeHemp 3 — paciente **não possui nenhum dos dois**

| #   | passo                                                                                      | estado | medido                                      |
| --- | ------------------------------------------------------------------------------------------ | ------ | ------------------------------------------- |
| 1   | ChatPro envia formulário da BeHemp **idêntico ao da Greens**                               | 🔴     | o nosso formulário **não coleta documento** |
| 2   | preenche e é encaminhado para o agendamento                                                | ✅     | `/agendamento`                              |
| 3   | ao finalizar o agendamento, é avisado que não tem ANVISA e perguntado se quer a procuração | 🔴     | **não existe**                              |
| 4   | consentimento + recomendação → **Greens recebe dados + documentação e cria a conta**       | 🔴     | **não existe**                              |

---

# 🔴 A peça grande que falta: o caminho BeHemp → Greens **com dados**

Aparece nos **três** fluxos BeHemp, e é a mesma em todos.

## O que existe hoje, e por que não serve para isto

O aviso que sai daqui carrega **quatro campos**:

```json
{ "referralId": "…", "tipo": "receita_emitida", "protocolo": "…", "ocorridoEm": "…" }
```

Ele diz **que** algo ficou pronto — nunca **o que**. Há um guarda que impede o contrário
(`o-aviso-ao-parceiro-nao-se-perde`): `cpf`, `medicament`, `dosagem`, `posologia`, `cid` e
`diagnostic` são recusados no payload, com a justificativa escrita no teste:

> _"Quem precisa do conteúdo tem a ficha, com controle de acesso. Mandá-lo para outra empresa
> criaria uma segunda cópia sem esse controle."_

O que os fluxos BeHemp pedem é **outra coisa**: mandar dados do paciente e documentos para a
Greens **criar a conta dele lá**. Não é aviso — é transferência de cadastro, na direção
inversa do handoff que já existe.

## O que isso exige, e o que não é decisão de TI

| #   | peça                                                             | quem decide     |
| --- | ---------------------------------------------------------------- | --------------- |
| 1   | **base legal e contrato de operador** entre as duas empresas     | 🔴 **Jurídico** |
| 2   | botão de consentimento — texto, momento, e o que fica registrado | dono + Jurídico |
| 3   | endpoint na Greens que recebe cadastro + documentos              | Greens          |
| 4   | envio assinado daqui, com o segredo de saída                     | BeHemp          |
| 5   | retificar a ADR-0016 e o guarda, que hoje **proíbem** isso       | BeHemp          |

⚠️ **O item 1 é bloqueante e não é técnico.** O `.claude/rules/seguranca-lgpd.md` é explícito:
_"Serviço externo novo, com dado pessoal, exige base legal e contrato de operador. É decisão do
Jurídico, não de TI."_ São dados de saúde — LGPD art. 11.

O consentimento do paciente (item 2) **autoriza o ato**; ele não substitui a base legal entre
as empresas. As duas coisas são necessárias, e são diferentes.

## O que dá para adiantar sem esperar o Jurídico

- o **botão e o registro do consentimento** — quem consentiu, quando, para quê, e a versão do
  texto. Registrar consentimento nunca é o problema; enviar dado sem base é
- o **endpoint e a assinatura**, prontos e **desligados** por variável de ambiente
- o **desenho do payload**: exatamente quais campos, para o Jurídico avaliar algo concreto em
  vez de uma pergunta abstrata

---

# O que ficou pendente, com o registro

| item                                          | onde                                       |
| --------------------------------------------- | ------------------------------------------ |
| notificação da ANVISA por e-mail e WhatsApp   | `04-LISTA-DE-AFAZERES` Item 29             |
| TURN da Cloudflare                            | `ADR-0020` §3 — adiado pelo chefe          |
| os 3 crons antigos, desligados de propósito   | `03-CHECKLIST-MESTRE`, 10/09               |
| store público dos documentos                  | `04-LISTA-DE-AFAZERES` Item 6              |
| `laudo_medico` sem tipo equivalente na tabela | `lib/parceiros/materializar-documentos.ts` |
