# ADR-0021 — Os oito fluxos, e os webhooks que ligam as duas empresas

> **Status:** 📋 **proposta** — 10/09/2026. Escrita a pedido do dono para que **os dois lados
> possam trabalhar em paralelo**: _"deixe o seu lado pronto, inclusive o webhook, crie uma ADR
> de sprints contendo um checklist de cada um desses fluxos do seu lado e como isso se conecta
> com o da greens através dos webhooks"_.
>
> **Esta ADR é o contrato.** O que está aqui é o que a BeHemp vai construir e o que ela espera
> receber. O lado da Greens implementa contra isto, não contra conversa.

## §1 — O que os webhooks existem para resolver

Palavras do dono, e elas definem o critério de sucesso:

> _"o webhook é justamente pra evitar que o paciente fique enviando dados e documentações o
> tempo todo entre as empresas, facilitando o nosso trabalho e o deles"_

Então a régua de cada decisão abaixo é uma só: **o paciente envia cada documento UMA vez.**
Se um fluxo faz alguém reenviar RG, o fluxo está errado — não o paciente.

⚠️ **E o que NÃO é objetivo:** juntar as duas bases. Cada empresa continua dona do seu
cadastro; o que atravessa é o mínimo para o paciente não repetir trabalho, **com consentimento
dele em cada travessia**.

## §2 — Os quatro caminhos de dado entre as empresas

| #      | quem fala                     | com quem                                    | o que leva                | existe hoje?      |
| ------ | ----------------------------- | ------------------------------------------- | ------------------------- | ----------------- |
| **E1** | Greens → BeHemp               | `POST /api/parceiros/greens/cadastro`       | cadastro + documentos     | ✅ **pronto**     |
| **E2** | bot (qualquer conta) → BeHemp | `GET /api/chatpro/bot-link`                 | nome, e-mail, telefone    | ✅ **pronto**     |
| **S1** | BeHemp → Greens               | `POST /api/v1/parceiros/behemp/atualizacao` | **aviso**: ficou pronto   | ✅ **pronto**     |
| **S2** | BeHemp → Greens               | a definir com eles                          | **cadastro + documentos** | 🔴 **não existe** |

**E1, E2 e S1 estão medidos e funcionando em produção.** O que falta é o **S2** — e ele é a
peça que quatro dos oito fluxos pedem.

### 🔴 Por que o S2 não é uma extensão do S1

O S1 carrega quatro campos e diz **que** algo ficou pronto, nunca **o que**. Há guarda
impedindo o contrário (`o-aviso-ao-parceiro-nao-se-perde`), com a justificativa no teste:

> _"Quem precisa do conteúdo tem a ficha, com controle de acesso. Mandá-lo para outra empresa
> criaria uma segunda cópia sem esse controle."_

O S2 é **transferência de cadastro**: dados do paciente e documentos, para a Greens criar a
conta dele lá. É a direção inversa do E1, e muda a natureza do que trafega.

**Isso exige, antes do código:**

| #   | o quê                                               | quem decide          |
| --- | --------------------------------------------------- | -------------------- |
| 1   | base legal e contrato de operador entre as empresas | 🔴 **Jurídico**      |
| 2   | store **privado** para os documentos daqui (Item 6) | BeHemp — e vem antes |
| 3   | endpoint que recebe cadastro + documentos           | Greens               |
| 4   | retificar a ADR-0016 e o guarda                     | BeHemp               |

⚠️ **O consentimento do paciente autoriza o ato; não substitui a base legal entre as empresas.**
São coisas diferentes, e as duas são necessárias — LGPD art. 11, dado de saúde.

⚠️ **E o item 2 vem antes na ordem prática.** Enquanto os documentos daqui estiverem em store
público, qualquer URL assinada que mandarmos é teatro. O lado da Greens mediu o bucket deles e
provou que é privado (403, e não 404 — a diferença importa); nós ainda não podemos afirmar o
mesmo.

## §3 — O consentimento, e por que ele é um objeto e não uma caixinha

Ordem do dono: _"toda etapa de envio tem que ter um consentimento"_, e _"utilize o mesmo modelo
existente no formulário da greens completo, ele fez um consentimento bom lá"_.

⚠️ **Pendência declarada:** eu **não li** o texto do consentimento da Greens. Ele precisa vir
de lá — pedido no §6. Até chegar, o que fica definido é a **estrutura**, não as palavras.

**O que se grava a cada consentimento** — e o motivo de cada campo:

| campo               | por quê                                                                           |
| ------------------- | --------------------------------------------------------------------------------- |
| `paciente_id`       | quem consentiu                                                                    |
| `finalidade`        | consentimento é **específico**: "enviar à Greens para compra" não cobre outro uso |
| `versao_do_texto`   | o texto muda; quem consentiu à v1 não consentiu à v2                              |
| `texto_apresentado` | o que ele **leu**, não o que estava na tela hoje                                  |
| `concedido_em`      | quando                                                                            |
| `revogado_em`       | 🔴 **consentimento revogável é requisito**, não cortesia (LGPD art. 8º §5º)       |
| `origem`            | de qual tela partiu                                                               |

🔴 **Sem `revogado_em` não é consentimento — é autorização perpétua.** E sem
`versao_do_texto` + `texto_apresentado`, não há como provar a que ele disse sim.

⚠️ **O envio lê o consentimento, nunca o supõe.** Um envio que acontece porque "o paciente
clicou em algum momento" é o que transforma consentimento em formalidade.

## §4 — Os oito fluxos, e o que cada um exige da BeHemp

Legenda: ✅ pronto · 🟡 parcial · 🔴 falta · ⏸️ adiado por decisão

### GREENS 1 — sem ANVISA, veio do **formulário** da Greens

| #   | passo                                             | estado     |
| --- | ------------------------------------------------- | ---------- |
| 1   | chega por E1, assinado                            | ✅         |
| 2   | documentos vêm junto e são re-hospedados          | ✅         |
| 3   | cria a conta                                      | ✅         |
| 4   | tela só com **código + senha** (confirma o resto) | ✅         |
| 5   | vai direto para a procuração                      | ✅         |
| 6   | documentos já preenchidos                         | ✅         |
| 7   | notificação por e-mail, celular e sistema         | ⏸️ Item 29 |
| 8   | ANVISA aprovada volta por S1                      | ✅         |

**Nada a construir** além do passo 7.

### GREENS 2 — sem receita, veio do **bot** da Greens

| #   | passo                                         | estado                         |
| --- | --------------------------------------------- | ------------------------------ |
| 1   | link entregue por E2                          | ✅                             |
| 2   | formulário com os dados básicos               | ✅                             |
| 3   | pendências como aviso                         | ✅                             |
| 3b  | pergunta a ANVISA, com anexo                  | ✅                             |
| 4   | vai para o agendamento                        | ✅                             |
| 5   | receita volta por S1, **com consentimento**   | 🟡 aviso ✅ · consentimento 🔴 |
| 5b  | aviso pós-receita com botão para a procuração | 🔴                             |

### GREENS 3 — recompra (tem tudo)

| #   | passo                                                   | estado                 |
| --- | ------------------------------------------------------- | ---------------------- |
| 1   | link com **dois botões**: já tenho conta / não tenho    | 🔴 tela de escolha     |
| 2   | com conta → login · sem conta → **formulário completo** | 🔴 formulário completo |

### GREENS 4 — paciente novo, sem nada

| #   | passo                                       | estado            |
| --- | ------------------------------------------- | ----------------- |
| 1   | link do **formulário completo**             | 🔴                |
| 2   | preenche tudo, com senha e código           | 🟡 etapas existem |
| 3   | vai para o agendamento                      | ✅                |
| 4   | aviso com ação rápida para a procuração     | 🔴                |
| 5   | pergunta se **consente** em enviar à Greens | 🔴 S2             |

### BEHEMP 1 — sem ANVISA

Usa o formulário **básico**.

| #   | passo                                     | estado                                |
| --- | ----------------------------------------- | ------------------------------------- |
| 1   | link por E2                               | ✅                                    |
| 2   | vai para a procuração                     | 🟡 **falta perguntar se tem receita** |
| 3   | consentimento → S2 cria a conta na Greens | 🔴                                    |

⚠️ O passo 2 não funciona hoje: sem saber que ele tem receita, o destino vira o agendamento.
A correção é a **mesma pergunta** que já fazemos pela ANVISA.

### BEHEMP 2 — sem receita

Usa o formulário **completo**.

| #   | passo                            | estado |
| --- | -------------------------------- | ------ |
| 1   | link por E2, formulário completo | 🔴     |
| 2   | vai para o agendamento           | ✅     |
| 3   | pendências com aviso             | ✅     |
| 4   | consentimento → S2               | 🔴     |

### BEHEMP 3 — não tem nenhum dos dois

Usa o formulário **completo**.

| #   | passo                                                | estado |
| --- | ---------------------------------------------------- | ------ |
| 1   | link por E2, formulário completo                     | 🔴     |
| 2   | vai para o agendamento                               | ✅     |
| 3   | ao finalizar, aviso da ANVISA + oferta da procuração | 🔴     |
| 4   | consentimento → S2                                   | 🔴     |

### BEHEMP 4 — paciente novo, sem nada

| #   | passo                                           | estado |
| --- | ----------------------------------------------- | ------ |
| 1   | link do formulário completo, pelo bot da BeHemp | 🔴     |
| 2   | preenche tudo, com senha e código               | 🟡     |
| 3   | vai para o agendamento                          | ✅     |
| 4   | aviso com ação rápida para a procuração         | 🔴     |
| 5   | pergunta se consente em enviar à Greens         | 🔴 S2  |

## §5 — As cinco peças, e em que ordem

As 8 listas acima colapsam em **cinco peças**. Construir as cinco fecha os oito fluxos.

| #      | peça                                          | fecha                        | tamanho                   | depende de                  |
| ------ | --------------------------------------------- | ---------------------------- | ------------------------- | --------------------------- |
| **P1** | **pergunta "já tem receita?"**                | BeHemp 1                     | pequeno — o padrão existe | nada                        |
| **P2** | **aviso pós-consulta com ação rápida**        | G2·5b, G4·4, B3·3, B4·4      | médio                     | nada                        |
| **P3** | **formulário completo** com documentos        | G3, G4, B2, B3, B4           | grande                    | nada                        |
| **P4** | **tela de escolha** (tenho conta / não tenho) | G3                           | pequeno                   | nada                        |
| **P5** | **S2 — envio à Greens com consentimento**     | G4·5, B1·3, B2·4, B3·4, B4·5 | grande                    | 🔴 Jurídico + store privado |

**A ordem proposta, e o motivo:**

1. **P1** — menor de todas, e destrava um fluxo inteiro
2. **P3** — destrava cinco fluxos; sem ela, G3, G4, B2, B3 e B4 não começam
3. **P4** — pequena, e depende da P3 existir para ter para onde mandar
4. **P2** — destrava quatro, e a parte difícil já está feita (a declaração fica gravada)
5. **P5** — por último **não** por ser difícil, mas porque **não é falta de código**

⚠️ **A P5 pode ser construída em paralelo e ficar desligada**, com o endpoint pronto e uma
variável de ambiente vazia. O que não pode é ser **ligada** antes do Jurídico. Isso permite que
o lado da Greens implemente o receptor deles sem esperar por nós.

## §6 — O que a BeHemp precisa da Greens

Em ordem de bloqueio:

1. 🔴 **O texto do consentimento** do formulário completo deles — o dono mandou reusar, e eu
   não li. Precisamos do texto e da versão.
2. 🔴 **O contrato do S2**: para onde mandamos cadastro + documentos, com quais campos, e qual
   resposta esperar. Pela regra que os dois lados adotaram — **quem recebe define o formato** —
   este contrato é deles.
3. ⚠️ **O bloco de Requisição externa no bot deles** (E2), com o
   `CHATPRO_INTAKE_SECRET_GREENS`. Sem ele, Greens 2, 3 e 4 não começam.
4. ⚠️ **Confirmar o manifesto por fluxo.** É o `documentos` do E1 que faz os fluxos divergirem
   aqui: sem ele consideramos que falta tudo, e todo paciente cai no agendamento.

## §7 — O que fica decidido, e o que fica rejeitado

### D-01 — O destino do paciente sai do que FALTA, não do fluxo declarado

Nenhum lado manda "este é o fluxo 3". A BeHemp deriva o destino do manifesto e das respostas
do paciente. **Rejeitado: um campo `fluxo` no contrato.** Fluxo é rótulo de conversa; o que
decide é o estado dos documentos, e ele muda durante o processo.

### D-02 — O consentimento é objeto versionado e revogável, nunca um booleano

**Rejeitado: `consentiu: true` na tabela do paciente.** Não guarda a que ele consentiu, nem
quando, nem permite revogar — e revogação é direito, não recurso.

### D-03 — A pergunta só existe quando ninguém já respondeu

Quem veio do formulário do parceiro já declarou lá. **Rejeitado: perguntar sempre "para
confirmar".** Confirmar o que ele acabou de responder é desconfiar dele, e custa desistência.

### D-04 — O envio à Greens é enfileirado, nunca síncrono

Como o S1 já é. **Rejeitado: `fetch` direto no clique do consentimento.** Com a Greens fora do
ar, o paciente veria um erro por algo que não é problema dele — e o dado se perderia.

### D-05 — O formulário completo é UM, com as seções que o caso exige

**Rejeitado: um formulário por fluxo.** Cinco fluxos pedem "o completo"; cinco telas divergem
na primeira mudança. A tela mostra o que falta e esconde o que já veio — que é o que ela já faz
com a pergunta da ANVISA.

## §8 — Princípios e fase

§2 **J** (integridade de fila) fase 8 · §3 **A** (LGPD é requisito) fase 0 · §5 **L**
(front-end) fase 2 · D-04 **N** (operação) fase 12.

## §9 — Fontes

- `docs/adr/ADR-0016` — o handoff, a assinatura e por que o aviso não leva conteúdo
- `docs/adr/ADR-0018` — duas contas de ChatPro, identificadas pelo segredo
- `.claude/rules/seguranca-lgpd.md` — base legal e contrato de operador são do Jurídico
- `docs/11-OS-SETE-FLUXOS.md` — o estado medido de cada passo (**a ser renomeado para oito**)
- LGPD art. 8º §5º (revogação) e art. 11 (dado sensível) — **via o catálogo `02`**, não lidos
  na fonte primária nesta rodada
