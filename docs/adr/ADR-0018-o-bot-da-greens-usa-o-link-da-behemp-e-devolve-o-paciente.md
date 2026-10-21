# ADR-0018 — O bot da Greens usa o link da BeHemp, e devolve o paciente com o que faltava

> **Status:** 📋 **proposta** — 09/09/2026.
> **Espelho:** `greens-corp-backend/docs/adr/ADR-0028`. Esta é a **fonte do contrato**.
> **Contexto:** o WhatsApp da Greens atende paciente que quer comprar medicamento. Quando falta
> receita do nosso receituário ou autorização da ANVISA, ele precisa de teleconsulta — e quem faz
> teleconsulta é a BeHemp. Palavras do dono: _"o WhatsApp da Greens vai enviar o link que
> criaremos da BeHemp"_.
> **Decisão:** o bot da Greens entrega **o mesmo link da BeHemp**, e ao fim o paciente **volta
> para a Greens** — com receita e ANVISA já lançadas lá, automaticamente.

---

## §1 — Por que isto não é "a ADR-0017 com outro número"

|                                 | ADR-0017 (bot da BeHemp) | **esta** (bot da Greens)                                  |
| ------------------------------- | ------------------------ | --------------------------------------------------------- |
| conta do ChatPro                | a nossa                  | **a da Greens** — outra instância, outro `instance-token` |
| quem chama nosso endpoint       | painel da BeHemp         | painel da **Greens**                                      |
| UUIDs de fila e de motivo       | os nossos                | **os deles**, completamente diferentes                    |
| para onde o paciente vai no fim | fica na BeHemp           | 🔴 **volta para a Greens**                                |
| o que a Greens recebe depois    | nada                     | 🔴 **receita e ANVISA, automaticamente**                  |

As duas últimas linhas são a razão de existir esta ADR. As três primeiras são consequência de
haver **duas contas** falando com o mesmo endpoint.

## §2 — As decisões

### D-01 — Um endpoint, duas contas, origem declarada

O mesmo `/api/chatpro/bot-link` atende as duas contas. O que separa é a **origem**, gravada na
solicitação — e **cada conta tem o seu próprio segredo de intake**.

**Rejeitado: um endpoint por parceiro.** Duplicaria a lógica de normalização de telefone,
idempotência e montagem de mensagem — e, no dia de corrigir um defeito, alguém corrigiria um só.
Foi exatamente esse raciocínio que evitou o segundo mecanismo de token na ADR-0015.

**Rejeitado: o mesmo segredo para as duas contas.** Rotacionar exigiria mexer nos dois painéis ao
mesmo tempo, e vazar um comprometeria os dois.

### D-02 — 🔴 OS UUIDs DE DEPARTAMENTO E MOTIVO SÃO POR CONTA, E JÁ ESTÃO PREPARADOS

A tabela `chatpro_diretorio` guarda a tradução no **banco**, não em constante no código
(ADR-0015 D-06). A razão original era que a operação renomeia fila sem deploy — e ela resolve
este caso de graça: basta a chave incluir **de qual conta** o UUID é.

⚠️ **Sem isso, um evento da Greens seria lido com o dicionário da BeHemp.** Como são UUIDs, não
haveria erro nenhum: simplesmente não encontraria a tradução, e o relatório mostraria o
identificador cru — silenciosamente, para sempre.

### D-03 — Ao terminar, o paciente volta para a Greens

Decisão do dono: _"volta pra Greens, pois se ele veio pra Greens é porque quer um medicamento"_.

A teleconsulta e a procuração acontecem aqui; **a compra acontece lá**. Terminar na BeHemp
deixaria o paciente parado com uma receita na mão e sem saber onde usá-la.

**Rejeitado: mantê-lo na BeHemp.** Ele não veio para cá: passou por aqui.

### D-04 — 🔴 O RETORNO É AUTOMÁTICO, E É O CORAÇÃO DESTA ADR

_"Após ter tudo necessário, nosso outro webhook tem que jogar o que faltava da Greens — seja
receituário ou ANVISA — para lá automaticamente, ele já ter como comprar seu medicamento que está
na receita. **O foco é automatizar o que dá.**"_

```
receita emitida no nosso receituário  ──┐
                                         ├──► POST assinado ──► Greens
autorização da ANVISA concluída       ──┘                        pendência do pedido fecha
                                                                 paciente compra
```

**O gatilho é o documento ficar pronto**, não o paciente pedir. Ele veio comprar; se precisar
voltar para avisar que a receita saiu, a automação não serviu para nada.

Usa o **mesmo canal de volta** desenhado na
[ADR-0016](ADR-0016-o-cadastro-da-greens-chega-por-back-channel-e-so-o-token-viaja.md) D-09 —
não se inventa um segundo. Muda só o que dispara: lá é o cadastro que veio do formulário, aqui é
o que veio do WhatsApp. **O paciente é o mesmo, e o retorno também.**

**Rejeitado: canal de volta próprio para este fluxo.** Duas rotas fazendo a mesma coisa divergem
na primeira correção.
**Rejeitado: esperar o paciente avisar.** É o oposto de automatizar o que dá.

### D-05 — O gatilho é o mesmo da ADR-0017, e a conferência também é humana

Falta receita nossa **ou** falta ANVISA → oferece o link. Quem confere é gente, no painel da
BeHemp, depois do envio (ADR-0017 D-02).

E vale igual a regra de linguagem da **ADR-0017 D-03**: a tela **nunca** diz que a receita de
outro médico é inválida — porque legalmente ela é válida, e afirmar o contrário é falso. Diz que
está em análise e encaminha para a avaliação.

⚠️ **Isto vale nos dois lados.** Se a tela da Greens disser "receita inválida", o problema é o
mesmo — e é a Greens quem fala com o paciente primeiro.

---

## §3 — O que fica rejeitado

| #    | rejeitado                                      | motivo                                                         |
| ---- | ---------------------------------------------- | -------------------------------------------------------------- |
| R-01 | endpoint separado por parceiro                 | duplica a lógica; correção entra num só                        |
| R-02 | mesmo segredo para as duas contas              | rotação acoplada, vazamento compartilhado                      |
| R-03 | dicionário de UUID único, sem a conta na chave | evento da Greens lido com o dicionário errado, **em silêncio** |
| R-04 | o paciente terminar na BeHemp                  | ele veio comprar, e a compra é lá                              |
| R-05 | canal de volta próprio deste fluxo             | divergiria do canal da ADR-0016 na primeira correção           |
| R-06 | esperar o paciente avisar que a receita saiu   | é o oposto de automatizar o que dá                             |
| R-07 | a tela (aqui ou lá) dizer "receita inválida"   | afirmação falsa sobre documento legalmente válido              |

## §4 — Como se prova

| guarda                                  | fica vermelho quando                                       |
| --------------------------------------- | ---------------------------------------------------------- |
| `cada-conta-do-chatpro-tem-seu-segredo` | as duas contas passarem a usar a mesma variável de segredo |
| `diretorio-do-chatpro-e-por-conta`      | a tradução de UUID perder a conta da chave                 |
| `origem-da-solicitacao-e-declarada`     | uma solicitação nascer sem dizer de qual parceiro veio     |
| `retorno-usa-o-canal-unico`             | nascer uma segunda rota de retorno para a Greens           |

## §5 — O que precisa existir antes

| #   | pré-requisito                                                   | dono                                  |
| --- | --------------------------------------------------------------- | ------------------------------------- |
| 1   | ADR-0016 implementada — o **canal de volta** é dela             | nós                                   |
| 2   | Credenciais da conta de ChatPro **da Greens**                   | dono                                  |
| 3   | O fluxo no painel **da Greens** apontando para o nosso endpoint | dono                                  |
| 4   | Mapear os UUIDs de fila e motivo **daquela conta**              | automático, pelo `ServicoDeDiretorio` |

**Fontes.** ADR-0015 (mecânica, implementada e testada) · ADR-0016 D-09 (o canal de volta) ·
ADR-0017 D-02 e D-03 (conferência humana e linguagem da tela) · `MAPA-DE-CAMPOS.md` do
`greens-corp`, medido contra a instância real: **6 departamentos e 11 motivos**, todos UUID de
conta — inclusive `d3457174-…` = _"Aguardando Autorização Anvisa"_, que é literalmente o estado
que este fluxo existe para resolver.

**Princípios e fase:** D-01/D-02/D-05 **A** (arquitetura, não duplicar), fase 3 · D-03 **B**
(caminho do usuário), fase 6 · D-04 **D** (regra e automação), fase 7.
