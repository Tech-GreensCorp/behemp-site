# [2026-09-28] BEHEMP — o cadastro passa a conferir a identidade na etapa 1, e alguns handoffs vão parar antes de concluir

> **Eixo B da Ponte** (`greens-corp/docs/ponte/README.md` §2). Esta mensagem **informa uma
> mudança do nosso lado e faz uma pergunta**. Ela **não muda o contrato**: nenhum payload, rota,
> cabeçalho, status HTTP ou evento foi alterado. A pergunta do fim só vira trabalho com o
> consenso dos três participantes daí.
>
> Decisão nossa: [ADR-0028](../adr/ADR-0028-a-identidade-se-confere-na-etapa-1-e-a-tela-nao-vira-oraculo.md).
> Regras de negócio: `DO-59` a `DO-68` em `docs/02-CATALOGO-DE-REGRAS.md`.
> **Estado: implementado na branch `feat/identidade-na-etapa-1`, ainda não em produção.**

## O que muda, em uma frase

Quando o paciente abre o link de continuação (`urlDeContinuacao`), a **etapa 1** do nosso
formulário passa a conferir CPF, telefone e e-mail contra quem já existe na BeHemp. Em dois casos,
o cadastro **para ali** e o paciente não conclui.

## O que NÃO muda para vocês — medido no código de vocês

| ponto                                                                                                             | onde, do lado de vocês                                     | continua igual?                                                                             |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| o `POST /api/parceiros/greens/cadastro` responde 2xx com `referralId`, `urlDeContinuacao`, `protocolo`, `reenvio` | `HandoffService.ts:486-496`                                | ✅ sim. A conferência acontece **depois**, quando o paciente abre o link                    |
| a jornada `SENT_TO_BEHEMP` (a cobrança com desconto) é gravada                                                    | `HandoffService.ts:520-528`                                | ✅ sim. O 2xx chega como antes                                                              |
| o relay do ChatPro para o `/bot-link`                                                                             | `ChatproIntakeService.ts:504-535`                          | ✅ sim. Nada mudou no `/bot-link`                                                           |
| o S1 (`receita_emitida`, `anvisa_aprovada`) e o S2 (`cadastro_transferido`)                                       | `behempValidator.ts:30`, `CadastroDoParceiroRepository.ts` | ✅ o formato é o mesmo. O que muda é que, para quem parou, **eles não chegam** (ver abaixo) |

## Os dois casos em que o paciente para

| caso                                                 | o que o paciente vê                                                                                                                                                   | o que ele faz                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| o **CPF** está na ficha de **outra conta** da BeHemp | _"Precisamos confirmar alguns dados com a nossa equipe antes de continuar"_, com o protocolo e o botão do WhatsApp **da BeHemp**. A tela **não diz** que o CPF existe | fala com o nosso suporte. O link continua válido     |
| o **telefone** é de **outra conta** da BeHemp        | o campo trava: _"Este número está em uso. Informe outro número de telefone para continuar."_, com "Entre na sua conta" e "fale com a gente pelo WhatsApp" logo abaixo | troca o número, entra na conta ou fala com o suporte |

**E um caso que continua como era:** CPF igual **com o mesmo e-mail** é a mesma pessoa voltando, a
recompra do Fluxo 3, e vai ao **login** (`DO-67`). Não para no suporte.

⚠️ **O caso que deve afetar mais o Fluxo 3 de vocês:** um paciente que voltou pela Greens com **outro
e-mail**. Do lado de vocês, `findOrCreatePatientAccount` casa pelo CPF e **reaproveita** a conta
(`MedicationRequestService.ts:532-549`). Do nosso, o mesmo CPF numa conta de outro e-mail vai ao
**suporte**. As duas empresas passam a tratar esse caso de jeitos diferentes, e de propósito:
aqui, fundir duas contas custaria a ficha clínica de alguém.

## O que vocês vão ver: nada

**Medido no código de vocês:**

- a ida do handoff é síncrona e disparada pelo clique do paciente, e _"não existe fila, então não existe 'pendente'"_ (`SaudeService.ts:49-50`);
- não achei prazo, cron nem retentativa para um handoff que não conclui;
- o que existe é o **reenvio manual** pelo admin (`HandoffService.ts:300`, `POST /behemp/reenviar/:id`).

Portanto, **para quem parou:**

- a Greens fica com o pedido em `SENT_TO_BEHEMP` e **nunca recebe** o S2, porque o S2 só sai quando o cadastro conclui, com o consentimento;
- também não recebe o S1, porque não há receita nem ANVISA sem cadastro;
- nada do lado de vocês diz **por que** aquele paciente não andou.

⚠️ **O reenvio administrativo não destrava esses casos.** O paciente volta pelo mesmo link e cai na
mesma conferência. Quem destrava é o **nosso suporte**, pelo protocolo.

## Quantos são: medido em produção em 28/09/2026

A consulta roda só com leitura e sem dado pessoal (ADR-0028 §5). Na base inteira da BeHemp:

- **1** CPF já está em duas fichas;
- **3** números de celular estão em mais de uma conta.

São no máximo umas 8 pessoas, em 145 fichas com CPF. **O impacto esperado sobre os handoffs de
vocês é pequeno**, e é por isso que recomendamos o caminho 1 abaixo.

## A pergunta para vocês — e ela não é pedido de mudança

Querem **saber** quando um handoff para na conferência?

Se sim, vemos três caminhos. **Nenhum está implementado**, e cada um depende de vocês:

| #   | caminho                                                                                                                                 | o que muda no contrato                  | o que sai da BeHemp                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **nada muda**: o nosso suporte resolve pelo protocolo, e vocês não são avisados                                                         | nada                                    | nada                                                                                                                                                                                                  |
| 2   | um **evento novo no S1**, por exemplo `cadastro_retido`, com o `referralId` e um motivo em código fechado (`conferencia_de_identidade`) | um tipo novo em `behempValidator.ts:30` | o `referralId` e o código. **Nunca** CPF, telefone, e-mail, nem **qual** dado bateu: dizer isso a outra empresa é o mesmo oráculo que a tela evita (LGPD art. 5º II e art. 46, `LGPD-06` e `LGPD-09`) |
| 3   | um **status consultável**: vocês perguntam pelo `referralId`, e respondemos em que passo o cadastro está                                | uma rota nova, assinada como o S2       | o passo, sem dado pessoal                                                                                                                                                                             |

**A nossa recomendação é o 1, por enquanto**, até o passo 0 dizer quantos casos são. Se forem
poucos, o suporte absorve. Se forem muitos, o 2 é o mais simples e reusa o trilho do S1 que
já existe.

## O que pedimos de volta

1. Se o comportamento do Fluxo 3 (CPF igual com outro e-mail vai ao suporte aqui) conflita com
   alguma promessa que a Greens faz ao paciente.
2. Qual dos três caminhos vocês preferem, **com o consenso dos três**.
3. Se existe, do lado de vocês, algum prazo ou alerta sobre pedido parado em `SENT_TO_BEHEMP` que
   eu não tenha achado no código.
