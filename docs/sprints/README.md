# Sprints — Be4Hope / BeHemp

> Uma fatia por arquivo: **objetivo · entregáveis · critério de aceite · o que NÃO entra ·
> bloqueios**.

🔴 **Toda sprint nova entra nesta tabela NO MESMO COMMIT que a cria.**

**Atualizado em 19/09/2026 — 9 sprints em `docs/sprints/`, mais o plano.**

⚠️ **Retificação, 19/09/2026.** O cabeçalho anterior dizia _"vazia de propósito, em 20/08/2026"_
e explicava que as sprints escritas em 19–20/08 pertenciam a outro projeto e saíram do
repositório. Hoje a pasta tem **9 arquivos de sprint** (0 a 8) e o plano. A afirmação antiga
fica registrada nesta nota, junto com o ponteiro que ela trazia:
[`../05-HANDOFF-SESSAO.md`](../05-HANDOFF-SESSAO.md) §3.

| sprint | título | status conforme o arquivo | período |
| ------ | ------ | ------------------------- | ------- |
| [0](SPRINT-0-fundacao.md) | Fundação: medir o real e criar o portão | não declarado no arquivo | 20/08/2026 |
| [1](SPRINT-1-auditoria-da-teleconsulta.md) | Auditoria da teleconsulta: descobrir o que está de pé | não declarado no arquivo | 20/08/2026 |
| [2](SPRINT-2-contrato-e-fundacao.md) | Contrato de dados congelado e a fundação do módulo | não declarado no arquivo | 20/08/2026 |
| [3](SPRINT-3-anamnese-assistida.md) | Anamnese como baseline de acompanhamento | não declarado no arquivo | 20/08/2026 |
| [4](SPRINT-4-hipoteses-e-revisao-humana.md) | Hipóteses e revisão humana: a tela onde o médico decide | não declarado no arquivo — há uma seção interna _"🟡 Estado em 20/08/2026"_ | 20/08 – 25/08/2026 |
| [5](SPRINT-5-conduta-prescricao-e-titulacao.md) | Conduta, prescrição e titulação: a cadeia completa | não declarado no arquivo | 24/08 – 25/08/2026 |
| [6](SPRINT-6-area-do-paciente.md) | Área do paciente: diário, dose e resumo | não declarado no arquivo | 25/08/2026 |
| [7](SPRINT-7-exames.md) | Exames: anexar, ver e vincular (a última da Metade 1) | não declarado no arquivo | 19/08/2026 |
| [8](SPRINT-8-a-sentinela-do-fluxo.md) | A sentinela do fluxo | não declarado no arquivo | 12/09 – 13/09/2026 |

🔴 **Nenhum arquivo de sprint declara o próprio status**, e por isso a coluna diz o que diz. O
período é a data mais antiga e a mais recente **escritas dentro do arquivo** — é evidência de
quando ele foi mexido, não de execução.

### Onde o estado de execução mora hoje, e por que não está na tabela

Três documentos falam do estado das sprints, **e nenhum é o arquivo da sprint**. Ficam citados
aqui, com a data de cada um, para que ninguém os confunda com o que está acima:

| fonte | o que diz | data |
| ----- | --------- | ---- |
| [`../05-HANDOFF-SESSAO.md`](../05-HANDOFF-SESSAO.md) §1 | _"As Sprints **0, 1, 2, 3 e 4 estão feitas**"_ e _"a próxima sessão começa a Sprint 5"_ | 24/08/2026 |
| [`../03-CHECKLIST-MESTRE.md`](../03-CHECKLIST-MESTRE.md) "Fila de execução" | itens 1–7 concluídos, mapeados a S0–S5; a **S5 com 13 de 15** entregáveis; S6 e S7 ainda na fila | 24/08/2026 |
| [`00-PLANO-DE-SPRINTS.md`](00-PLANO-DE-SPRINTS.md) "O mapa" | ✅ **escrita** para 0–7, 🗺️ **mapeada** para 8–12 | 20/08/2026 |

⚠️ **`✅ escrita` não quer dizer `feita`.** No plano, a coluna descreve o **documento**, não a
execução. Ler uma pela outra é o erro mais fácil desta pasta.

⚠️ 🔴 **Existem DUAS "Sprint 8", e elas não são a mesma coisa.** O plano de 20/08 reserva o
número 8 para _"Infraestrutura do motor: máquina maior, WSGI, rede privada"_ (Metade 2, bloqueada
por `GAP-11`), e o arquivo [`SPRINT-8-a-sentinela-do-fluxo.md`](SPRINT-8-a-sentinela-do-fluxo.md),
escrito em 12–13/09, usa o mesmo número para outro assunto. **Qual das duas fica com o número 8 é
decisão do dono** — nada aqui foi renomeado. Quando a sprint
de infraestrutura do motor for escrita, ela toma o próximo número livre, e o plano é corrigido
nesse mesmo commit.

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
