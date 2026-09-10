# Sprints — Be4Hope / BeHemp

> Uma fatia por arquivo: **objetivo · entregáveis · critério de aceite · o que NÃO entra ·
> bloqueios**.

**Vazia de propósito, em 20/08/2026.** As sprints escritas em 19–20/08 eram de um domínio que
pertence a outro projeto e saiu deste repositório — ver
[`../05-HANDOFF-SESSAO.md`](../05-HANDOFF-SESSAO.md) §3.

O histórico de fases **anteriores** deste projeto está em
[`../progresso.md`](../progresso.md) — fases 0 a 12, concluídas entre maio e agosto de 2026.

---

## O formato

```markdown
# Sprint N — {título}

> **Objetivo:** {uma frase. O que passa a ser possível quando esta sprint acaba}

**ADRs:** {as decisões que esta sprint executa}

## Entregáveis
| # | entregável | referência |

## Critério de aceite
- [ ] {verificável por comando, sempre que possível}

## Não entra
{o que fica de fora, e por quê. Corte silencioso lê-se como cobertura total}

## Bloqueios
{o que depende de terceiro, e o que fazemos enquanto não chega}
```

## As três regras

1. **Ordem por o que impede dano novo**, não por tamanho ou facilidade.
2. **Todo item declara "Bloqueado por"** — outro item, resposta de terceiro, ou nada.
3. **O que depende de terceiro fica em seção própria**, com *o que fazemos enquanto não chega*.
   Misturar faz parecer que o time está parado quando está esperando.
