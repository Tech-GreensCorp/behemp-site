# ADR-0017 — O bot da BeHemp oferece o link quando falta receita nossa ou ANVISA

> **Status:** 📋 **proposta** — 09/09/2026.
> **Contexto:** a [ADR-0015](ADR-0015-o-chatpro-entrega-o-link-e-o-webhook-nunca-e-verdade.md)
> resolveu **como** o link nasce e chega ao paciente, e isso está implementado e testado. Ela não
> respondeu **quando** o bot deve oferecê-lo — e sem essa resposta o fluxo do painel ou oferece
> para todo mundo, ou depende de o atendente lembrar.
> **Decisão:** o gatilho é a **ausência de receita do nosso receituário ou de autorização da
> ANVISA**. A checagem é **humana**, e a tela nunca julga o documento de ninguém.

---

## §1 — A distinção que esta ADR existe para fixar

|              | pergunta que responde                         | onde está                |
| ------------ | --------------------------------------------- | ------------------------ |
| **mecânica** | _como_ o link nasce, é entregue e é consumido | ADR-0015 ✅ implementada |
| **gatilho**  | **_quando_** o bot oferece o link             | **esta ADR**             |

Sem separar as duas, a próxima pessoa procura a regra de negócio dentro do código do cliente HTTP
— e não encontra, porque ela não é técnica.

## §2 — As decisões

### D-01 — O gatilho é a falta, não a presença

```
paciente escreve no WhatsApp da BeHemp
        │
        ├─ tem receita NOSSA vigente?  ──sim──►  caminho de recompra
        │        │ não
        ├─ tem ANVISA concluída?       ──sim──►  agenda / acompanha
        │        │ não
        ▼
   ► oferece o link único → cadastro → teleconsulta
```

Qualquer um dos dois faltando leva ao mesmo lugar: a teleconsulta. É lá que ambos se resolvem —
o médico prescreve **no nosso receituário**, e a procuração da ANVISA sai do cadastro.

**Rejeitado: oferecer o link a todo contato.** Paciente em recompra receberia um convite para
recadastro que ele não entende, e a fila de conferência encheria de gente já cadastrada.
**Rejeitado: só oferecer quando o paciente pedir.** Quem não sabe que precisa de consulta não
pede consulta.

### D-02 — 🔴 QUEM CONFERE É GENTE, NO PAINEL, DEPOIS DO ENVIO

**Decisão do dono em 09/09/2026:** a conferência é **manual, pelo site da BeHemp, após o envio de
tudo**. _"Futuramente terá uma IA ou um código orquestrado que validará isso"_ — e essa frase
está aqui para que a automação, quando vier, entre como **substituição declarada**, não como
descoberta de alguém que achou que já era automático.

**O que o bot faz:** pergunta e **encaminha**. Ele não julga documento.
**O que o sistema faz:** organiza a fila de conferência e grava **quem** decidiu, **quando** e
**o quê**.

Isso é a Proibição 2 do `CLAUDE.md` aplicada fora da IA clínica: em matéria clínica o sistema
informa, a pessoa decide, e a decisão fica registrada com nome.

**Rejeitado: o bot decidir pela resposta do paciente.** _"Você tem receita?"_ é respondido com
sinceridade por alguém que tem uma receita vencida, de outro médico, ou uma foto ilegível. A
resposta serve para **rotear**, nunca para concluir.

### D-03 — 🔴 A REGRA REAL É "RECEITA NOSSA", E A TELA NÃO DIZ ISSO

**A regra, dita pelo dono:** _"o que invalida uma receita é ela não vir do nosso receituário;
qualquer um que não é, é inválido — **porém não podemos falar isso explicitamente e não
convém**"_.

Esta ADR é documentação interna e registra a regra como ela é. **A interface não repete.** E o
motivo não é só comercial:

⚠️ **Receita de outro médico é LEGALMENTE VÁLIDA.** Ela não serve ao nosso fluxo, que é outra
coisa. Uma tela dizendo _"receita inválida"_ sobre documento legalmente válido faz **afirmação
falsa sobre o ato de outro profissional**. Isso é risco jurídico, não discrição.

| ❌ o que a tela **nunca** diz   | ✅ o que ela diz, e é verdade                                       |
| ------------------------------- | ------------------------------------------------------------------- |
| "sua receita é inválida"        | "seu documento está em análise pela nossa equipe"                   |
| "não aceitamos receita de fora" | "para seguir, você precisa de uma avaliação com um médico parceiro" |
| "este médico não é credenciado" | "vamos te encaminhar para a teleconsulta"                           |

Nenhuma frase da coluna certa mente, nenhuma julga documento de terceiro, e todas levam ao mesmo
destino — que é o que o negócio quer.

**Rejeitado: dizer "inválida".** Afirma falsidade sobre ato de outro profissional.
**Rejeitado: explicar a regra ao paciente.** É o que o dono pediu para não dizer, e a coluna da
direita entrega o mesmo resultado sem a declaração.

### D-03b — 🔴 ACRESCENTADO EM 09/09: existe uma SEGUNDA régua, e ela é dizível

A auditoria do `greens-corp` registrou o que faltava aqui: **a receita vence em 30 dias** —
RDC 1.015/2026, em vigor desde 04/05/2026, para produto com até 0,2 % de THC, verificado em fonte
do Conselho Federal de Farmácia. E, palavras da auditoria, _"nada no sistema sabe que uma receita
expira"_.

São **dois** motivos independentes para faltar receita válida, e eles têm naturezas diferentes:

| #   | motivo                        | natureza                         | a tela pode dizer? |
| --- | ----------------------------- | -------------------------------- | ------------------ |
| 1   | não veio do nosso receituário | **comercial**                    | **não** — ver D-03 |
| 2   | **passou de 30 dias**         | **regulatória** (RDC 1.015/2026) | **sim**            |

🔴 **O motivo 2 pode e deve ser dito**, e isso não contradiz a D-03. _"Sua receita está vencida"_
é fato objetivo, é regra pública, e **não julga o médico que a emitiu**. O que a D-03 proíbe é
afirmar falsidade sobre documento legalmente válido — e uma receita vencida não é válida para
dispensação, por norma, não por escolha nossa.

⚠️ **Consequência prática:** o gatilho deixa de ter dois estados e passa a ter três.

```
tem receita?
  ├─ não tem                        → link (silencioso quanto ao motivo)
  ├─ tem, mas venceu (>30 dias)     → link + "sua receita está vencida"  ← DIZÍVEL
  └─ tem, vigente, de fora          → link (silencioso quanto ao motivo)
```

**Rejeitado: tratar os dois motivos igual.** Esconder o vencimento seria esconder uma informação
que ajuda o paciente e que ele pode conferir sozinho na própria receita.

**Rejeitado: implementar a checagem de 30 dias agora.** O sistema não guarda a data de emissão da
receita de fora, e a conferência é humana (D-02). Isto entra como **requisito do campo** quando a
conferência for automatizada — está registrado no §5.

### D-04 — Paciente que já tem conta não recebe convite de cadastro

O link cria conta. Quem já tem cai no reconhecimento da
[ADR-0016](ADR-0016-o-cadastro-da-greens-chega-por-back-channel-e-so-o-token-viaja.md) D-07:
a tela diz que a conta existe e leva ao login.

**Rejeitado: bloquear o link para quem já tem conta.** O bot não sabe quem é antes de perguntar à
API, e a tela resolve isso melhor que um travamento no fluxo do painel.

### D-05 — Falha do endpoint transfere para humano, e isso já está pronto

Comportamento herdado da ADR-0015: status não-2xx dispara a _"Ação em caso de falha"_ do painel,
que transfere o atendimento para uma pessoa. **O paciente nunca vê erro.**

---

## §3 — O que fica rejeitado

| #    | rejeitado                                           | motivo                                                                |
| ---- | --------------------------------------------------- | --------------------------------------------------------------------- |
| R-01 | oferecer o link a todo contato                      | enche a fila de conferência de gente já cadastrada                    |
| R-02 | só oferecer quando o paciente pedir                 | quem não sabe que precisa, não pede                                   |
| R-03 | o bot decidir a validade pela resposta do paciente  | resposta sincera não é conferência                                    |
| R-04 | regra automática de validade agora                  | é conferência humana até existir a IA/orquestração                    |
| R-05 | a tela dizer "receita inválida"                     | afirmação falsa sobre documento legalmente válido                     |
| R-06 | explicar ao paciente que só aceitamos receita nossa | o dono pediu para não dizer; há frase verdadeira equivalente          |
| R-08 | esconder também o **vencimento** da receita         | é fato objetivo e público; esconder tira do paciente algo que o ajuda |
| R-09 | implementar a régua de 30 dias agora                | não há data de emissão guardada, e a conferência é humana             |
| R-07 | bloquear o link para quem já tem conta              | a tela resolve melhor que o painel                                    |

## §4 — Como se prova

| guarda                                   | fica vermelho quando                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `a-tela-nao-julga-receita-de-fora`       | aparecer na interface "inválida", "não aceita", "não credenciado" ou equivalente sobre documento do paciente |
| `conferencia-de-receita-tem-dono-humano` | a validade passar a ser decidida por regra automática sem registro de quem decidiu                           |
| `gatilho-do-bot-mora-num-lugar-so`       | a condição "falta receita ou ANVISA" for reescrita em segundo lugar                                          |

## §5 — O que fica de fora, declarado

**A automação da conferência.** O dono declarou que virá — _"futuramente terá uma IA ou um código
orquestrado"_ — e **não é esta ADR**. Quando vier, entra como decisão própria, com o registro de
quem decide quando o modelo erra, exatamente como a Proibição 2 exige.

**Fontes.** Mecânica e comportamento do painel: ADR-0015 e `docs/chatpro/COMO-CONECTAR-NO-PAINEL.md`,
medidos contra a integração em produção do `greens-corp`. Regra de negócio: decisão do dono em
09/09/2026, transcrita acima. Linguagem de tela: Proibição 2 do `CLAUDE.md` (o sistema informa, a
pessoa decide) e `docs/02-CATALOGO-DE-REGRAS.md` para o que é ato médico.

**Princípios e fase:** D-01/D-04 **B** (produto e caminho do usuário), fase 6 · D-02 **D** (regra
e resiliência), fase 7 · D-03 **E** (comunicação e verdade da interface), fase 6.
