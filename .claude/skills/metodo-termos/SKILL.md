---
name: metodo-termos
description: Fixa termo do domínio em docs/01-REGRA-DE-NEGOCIO.md e dá ID citável à regra em 02-CATALOGO-DE-REGRAS.md. Use ao definir vocabulário, ao discutir se dois nomes são a mesma coisa, ao encontrar o mesmo conceito com nomes diferentes no código e na fonte, ou ao registrar regra vinda de um documento de negócio.
---

# Fixar termo e regra do domínio

Dois problemas distintos, mesma skill, porque resolvê-los separado produz glossário que
ninguém cita.

## 1. Termo do domínio

Destino: `docs/01-REGRA-DE-NEGOCIO.md` — §1 (atores) e §5
(entidades).

- **Um conceito, um nome, em todo lugar:** fonte, doc, schema, UI, log. Se o PDF diz
  *"aval final"* e o brief diz *"validação final"*, escolha um, registre o sinônimo, e
  use o escolhido no código.
- **Nome de negócio ≠ nome técnico.** A tabela do §2 mantém as duas colunas; o enum usa
  o técnico, a UI usa o de negócio.
- **Termo novo não nasce no código.** Se você precisou inventar um nome para escrever a
  função, ele passa aqui primeiro.
- ⚠️ **Não renomeie o que a fonte de negócio nomeou.** Traduzir *"faixa"* para *"tier"*
  é TI alterando vocabulário de negócio, e TI não define regra de negócio.

## 2. Regra com ID citável

Destino: `docs/02-CATALOGO-DE-REGRAS.md`.

| prefixo | o que é |
|---|---|
| `ANV-nn` · `CFM-nn` · `RDC-nn` · `LGPD-nn` · `ICP-nn` | regra externa, por corpo normativo |
| `RB-nn` | regra do brief do Robô de Recrutamento |
| `CF-nn` | conflito entre as duas fontes |
| `GAP-nn` | falta insumo de negócio — diga **de quem** e **o que bloqueia** |
| `PD-nn` | pendência declarada pela própria fonte |

- **Uma regra por ID**, em uma frase, com a seção da fonte.
- **Cite o ID, nunca a paráfrase** — no commit, no comentário do código, na ADR.
- **Não invente ID.** O guarda `idDeRegraExiste` quebra o build em citação inventada.
- Lacuna vira `GAP-nn` com dono e bloqueio; **nunca** um default silencioso. Default de
  TI é proposta registrada, não decisão.

## Quando isto vira ADR

Se fixar o termo **muda uma decisão** (o conceito era outro, o modelo estava errado,
duas entidades eram uma), abra ADR. Se só nomeia o que já existe, o registro nas duas
docs basta.
