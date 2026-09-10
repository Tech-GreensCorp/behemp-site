---
name: metodo-guardas
description: Escreve guarda estrutural em Vitest sob __tests__/guardas/, derivado do próprio código, fatiado na granularidade do defeito, com teste de vacuidade, e prova vermelho por sabotagem antes de valer. Use ao corrigir bug, ao criar invariante que não pode ser violada, ao pedir teste que impeça uma classe de erro de voltar, ou ao dizer "escreve um teste pra isso não acontecer de novo". Não é suíte de cobertura.
---

# Escrever um guarda

Um guarda é um teste que quebra o build quando uma **classe** de erro reaparece — não
quando *aquele* bug volta, mas quando *aquele tipo* volta, em qualquer lugar, inclusive
em arquivo que ainda não existe.

**Leia `docs/TECNICA-DOS-GUARDAS.md` antes do primeiro.** O que segue é o procedimento;
a técnica e os incidentes que a originaram estão lá.

## O ciclo, na ordem

1. **Nomeie a classe**, não o caso. *"toda action que muta estado checa escopo"*, não
   *"a action X esqueceu o check"*.
2. **Escreva o teste vermelho primeiro.** Rode e **mostre a saída vermelha** — não afirme
   que estava vermelha.
3. **Derive do sistema.** O guarda lê o disco, o schema ou o enum. Se alguém acrescentar
   um caso e esquecer de atualizar o guarda, ele tem de pegar sozinho. Se não pega, é
   lista escrita à mão.
4. **Fatie na granularidade do defeito.** Em que unidade o defeito acontece? Action?
   Rota? Bloco? Fatie **nessa** unidade — nunca no arquivo, se o arquivo tem mais de uma.
5. **Acuse pelo nome:** `expect({ violacoes }).toEqual({ violacoes: [] })`, nunca
   `expect(x).toEqual([])`. A mensagem tem de dizer **quem** violou.
6. **Escreva o teste de vacuidade** — prova que o guarda enxerga algo. Regex quebrado
   encontra zero, e passar sobre zero é passar.
7. **Sabote e veja vermelho.** Reintroduza o defeito real, e a **sabotagem parcial**
   (tirar a proteção de *uma* action, não de todas) é a que encontra o buraco.
8. **Reverta e confirme verde.**
9. **Registre no topo do arquivo** que incidente originou o guarda. Guarda sem incidente
   de origem é teoria, e teoria produz falsa acusação.
10. **Acrescente a linha** na tabela *Guardas ativos* do `CLAUDE.md`, no mesmo commit.

## Comandos

🔴 **Confira o ambiente antes de prometer um comando.** O estado do repositório em
20/08/2026:

| item | estado |
|---|---|
| `node_modules` | **ausente** — rode `pnpm install` antes de qualquer coisa |
| Vitest | 🔴 **não instalado ainda.** É item de prioridade 2 do `docs/03-CHECKLIST-MESTRE.md` |
| `pnpm test` | 🔴 **não existe** no `package.json` ainda |
| único guarda existente | `bash __tests__/guardas/hooks-de-escopo.test.sh` — em bash, de propósito |

**Enquanto o runner não existe**, o guarda nasce em bash, no mesmo formato do
`hooks-de-escopo.test.sh`: casos que devem bloquear, casos de controle que devem passar, e
teste de vacuidade. Guarda que espera infraestrutura não protege nada enquanto espera.

**Depois de o runner de teste entrar:**

```bash
pnpm test                                  # suíte
pnpm test __tests__/guardas/nome.test.ts   # um guarda
```

⚠️ Não existe Jest neste projeto, e não deve entrar.

## Onde mora e como se chama

```
__tests__/guardas/nomeDoGuarda.test.ts    # um arquivo por classe de erro
```

Nome no **indicativo do que garante**: `roleDerivaDoEnum`, `decisaoHumanaObrigatoria`,
`vinculoNaoSobrescreve`. Lendo a lista de arquivos, leem-se as invariantes do sistema.

## Não está pronto enquanto

- [ ] deriva do sistema, não de lista escrita à mão
- [ ] acusa na granularidade do defeito, **e pelo nome**
- [ ] tem teste de vacuidade
- [ ] **foi visto vermelho por sabotagem** — a mais próxima do defeito real
- [ ] as dispensas, se houver, têm parágrafo de motivo
- [ ] o topo do arquivo diz que incidente o originou
- [ ] a tabela do `CLAUDE.md` foi atualizada

## Guarda de decisão

Também se escreve guarda para proteger **escolha deliberada** contra refator
bem-intencionado — não só forma. Se uma ADR rejeitou algo, o guarda impede que a
rejeição seja desfeita sem ninguém saber que era deliberada. Exemplo deste repo: **`<Table>` não entra** — são 0 usos em 65 arquivos de lista, e a decisão
de usar lista de Cards é deliberada (`docs/06-PADROES-DO-CODIGO.md` §4.4).
