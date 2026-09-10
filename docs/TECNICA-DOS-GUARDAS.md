# A técnica dos guardas

> 🎯 **Um guarda é um teste que quebra o build quando uma CLASSE de erro reaparece** —
> não quando _aquele_ bug volta, mas quando _aquele tipo_ de bug volta, em qualquer
> lugar, inclusive em arquivo que ainda não existe.
>
> Transplantado para o repositório em 19/08/2026, do kit de documentação, para que a
> referência sobreviva à remoção da pasta do kit. Citado por
> `docs/PRINCIPIOS.md` (I · Fase 8), pela
> [árvore, ramo 09](arvore-do-conhecimento/09-testes.md) e por
> `docs/03-CHECKLIST-MESTRE.md` (o runner de teste é item de prioridade 2).

---

## 1. Os dois nomes que isto tem na literatura

| aqui          | na literatura                                                                                                                  | origem                                                    |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **guarda**    | _architecture fitness function_ — verificação objetiva e automatizada de que uma característica arquitetural ainda se sustenta | _Building Evolutionary Architecture_ — Ford, Parsons, Kua |
| **sabotagem** | _mutation testing_ — introduzir defeito deliberado para verificar se o teste falha                                             | Thoughtworks Technology Radar                             |

Vocabulário útil: o defeito introduzido é um **mutante**; se o teste falha, o mutante
foi **morto**; se todos passam, o mutante **sobreviveu**.

> 🔴 **Mutante sobrevivente = guarda que não protege nada.**

E a armadilha correlata tem nome: _assertion-free test_ / _perpetually green test_ —
teste que passa independentemente da lógica. Cobertura mede **execução**; mutation
testing mede **execução + asserção**.

---

## 2. Teste × guarda

|                    | teste                              | guarda                                           |
| ------------------ | ---------------------------------- | ------------------------------------------------ |
| pergunta           | _"esta função faz o que promete?"_ | _"alguém violou a regra em algum lugar?"_        |
| entrada            | valores                            | **o próprio código-fonte**, o schema, ou as docs |
| quebra quando      | a função muda                      | a **classe** de erro reaparece                   |
| cobre arquivo novo | não                                | **sim, sozinho**                                 |

Forma mínima:

```ts
// Guarda: toda action que muta estado exige check de escopo.
// Lê o disco — action nova entra na verificação sozinha.
const desprotegidas = arquivosDe(ACTIONS).flatMap((f) =>
  actionsDe(read(f)) // fatia por action exportada
    .filter((a) => /db\.(insert|update|delete)/.test(a.corpo))
    .filter((a) => !/verificarEscopo|verificarRole/.test(a.corpo))
    .map((a) => `${f}:${a.nome}`),
);

expect({ desprotegidas }).toEqual({ desprotegidas: [] });
```

⚠️ `expect({ nome: valor })` em vez de `expect(valor)`: quando falha, a mensagem **diz
quem** violou.

---

## 3. As três regras. Nenhuma é opcional.

### Regra 1 — Derive, não liste

Lista escrita à mão descreve o sistema do dia em que foi escrita. **Teste do
"derive":** se alguém acrescentar um caso e **esquecer** de atualizar o guarda, ele
deveria pegar sozinho. Se não pega, é lista.

Exemplo neste repo: `roleDerivaDoEnum` sai de `userRoleEnum.enumValues`, nunca de uma
união escrita à mão — que é exatamente o defeito que ele existe para pegar (8
ocorrências medidas).

### Regra 2 — Acuse na granularidade do defeito

Guarda que acusa inocente é guarda que alguém desliga. **Mas o inverso é pior e mais
comum:** guarda que busca num escopo maior que o do defeito **passa** sobre o defeito.

O padrão de falha é sempre o mesmo — perguntar _"este **arquivo** menciona X?"_ quando
o defeito acontece **por action**, **por rota** ou **por bloco**. Pergunta que resolve:
**em que unidade o defeito acontece?** Fatie nessa unidade.

### Regra 3 — Toda dispensa exige motivo escrito

```ts
/**
 * 🔴 Dispensa com motivo escrito.
 * {{por que estes casos ficam fora, e o que aconteceria se entrassem}}
 * ⚠️ Esta lista existe para ser CURTA: lista longa é onde o achado se esconde.
 */
const DISPENSADOS = [
  /* … */
];
```

---

## 4. 🔴 Provar vermelho por sabotagem — o passo que não se pula

**Um guarda que nunca foi visto falhar não é guarda. É decoração.**

```bash
pnpm test guarda.test.ts        # 1. verde no código correto
# 2. SABOTE — reintroduza o defeito que ele existe para pegar
pnpm test guarda.test.ts        # ← TEM de ficar vermelho, e acusar pelo NOME certo
git restore <arquivo>           # 3. reverta
pnpm test guarda.test.ts        # ← verde de novo
```

**Sabote o caso mais próximo do defeito real, não o mais fácil.** Sabotagem
**parcial** — tirar a proteção de **uma** action, não de todas — é a que encontra o
buraco de granularidade.

⚠️ Se o guarda passa na sabotagem, **o defeito é do guarda**. Conserte-o antes de
comemorar a correção, e escreva no topo do arquivo o parágrafo do que aconteceu.

---

## 5. Teste de vacuidade — o guarda que protege zero

O modo de falha mais silencioso: o regex para de casar, o guarda encontra **zero**
itens, e passar sobre zero é passar.

```ts
it('o guarda enxerga o que precisa proteger', () => {
  expect(actionsQueMutam().length).toBeGreaterThan(3);
  expect(actionsQueMutam().map((a) => a.nome)).toContain('decidirCandidatura');
});
```

**Todo guarda que varre precisa deste teste.**

---

## 5-bis. 🔴 Pior que proteger zero: **não rodar**, com número verde ao lado

Medido neste repositório em 20/08/2026. O `banco-usa-driver-certo` importava
`@/lib/db` para testar qual driver a URL escolhe. Mas `lib/db/index.ts` **executa** ao
ser importado — lê `process.env.DATABASE_URL` e abre conexão no topo do módulo. Sem
`DATABASE_URL` no ambiente do runner, o módulo estourava antes de exportar nada.

O que o Vitest imprimiu:

```
 Test Files  1 failed | 6 passed (7)
      Tests  133 passed (133)
```

**As duas linhas são verdadeiras e a segunda engana.** Os 8 casos do guarda não
rodaram — logo não falharam, logo não entraram na contagem. `133 passed` é o número dos
_outros_ guardas. Quem lê a linha de baixo conclui que está tudo coberto.

A vacuidade (§5) é o guarda que **roda** e não encontra nada. Este é o guarda que **não
roda**, e é mais silencioso, porque a vacuidade ainda aparece como um caso passando.

**A regra:** ler `Test Files`, não `Tests`. `Test Files N failed` com contagem de casos
verde significa **arquivo que não carregou**, sempre.

**A correção estrutural:** guarda testa **decisão pura**. Se a função a testar mora num
módulo com efeito colateral, extraia a decisão para um módulo sem `process.env` e sem
import — e ponha no guarda os casos que **impedem a volta**:

```ts
const codigo = semComentarios(readFileSync('lib/db/driver.ts', 'utf8'));
it('não lê variável de ambiente', () => expect(/process\.env/.test(codigo)).toBe(false));
it('não importa nada', () => expect(codigo.match(/^\s*import\s/gm) ?? []).toHaveLength(0));
```

⚠️ E note o `semComentarios`: sem ele, esse guarda acusa **o próprio comentário** que
explica a regra — a frase _"sem `process.env`"_ contém `process.env`. É a Regra 2
(granularidade) cobrando de novo, e foi preciso um caso de controle para provar que
comentário não é violação e uso real é.

---

## 6. Guarda de duas pontas, e guarda de decisão

**Duas pontas** — lê dois lados e compara. É o único que pega **divergência**, a
classe mais cara: os dois lados estão "certos" isoladamente.
Exemplos: rota × chamada do front · campo do formulário × schema Zod · ID citado ×
catálogo de regras.

⚠️ Ponto cego lateral: se o guarda compara contra "a tela", pergunte **quantas telas
existem**.

**Guarda de decisão** — protege escolha deliberada contra refator bem-intencionado:

```ts
it('⚠️ o cálculo NÃO decide — a decisão é humana e obrigatória', () => {
  /**
   * Decisão registrada: o resultado automático não substitui a
   * decisão. Se alguém "otimizar" isto e aprovar por faixa, o registro passa a
   * atribuir a decisão a ninguém.
   * O guarda protege a decisão, não só o código.
   */
});
```

---

## 7. Checklist antes de considerar um guarda pronto

- [ ] **Deriva** do sistema, não de lista escrita à mão
- [ ] Acusa na **granularidade do defeito**, e **pelo nome**
- [ ] Tem **teste de vacuidade** provando que enxerga algo
- [ ] Foi **sabotado** e ficou vermelho — na sabotagem mais próxima do defeito real
- [ ] As dispensas, se houver, têm **parágrafo de motivo**
- [ ] O comentário no topo diz **que incidente** o originou

Se o último item estiver vazio, desconfie: guarda sem incidente de origem costuma ser
teoria, e teoria produz falsa acusação — que é o que faz alguém desligar o guarda.

---

## 8. Onde eles moram, neste repositório

```
__tests__/guardas/
  nomeDoGuarda.test.ts      um arquivo por classe de erro
```

Nome no **indicativo do que ele garante**, não do que testa: `roleDerivaDoEnum`,
`decisaoHumanaObrigatoria`, `vinculoNaoSobrescreve`. Lendo a lista de arquivos, leem-se
as invariantes do sistema.

E a tabela **Guardas ativos** do `CLAUDE.md` é o índice — mantenha-a atualizada no
mesmo commit que cria o guarda.

⚠️ **O primeiro guarda deste repositório está em bash**, não em Vitest:
`__tests__/guardas/hooks-de-escopo.test.sh`. O runner ainda não existe — o runner ainda não existe —, e
**guarda que espera infraestrutura não protege nada enquanto espera**. Migrar para Vitest na
Sprint 0, preservando os casos — em especial os três de falsa acusação.

---

## Fontes

- **Livro:** _Building Evolutionary Architecture_ — Neal Ford, Rebecca Parsons, Patrick
  Kua. Origem do conceito de _fitness function_.
- **Mutation testing** — Thoughtworks Technology Radar (técnica adotada).
- Vocabulário de mutante morto × sobrevivente: literatura corrente de mutation testing.

⚠️ As três referências acima são as que sustentam a técnica. Ferramenta de mutation
testing para TS (ex.: Stryker) automatiza parte disto — **a sabotagem manual continua
obrigatória** para os guardas, porque nenhuma ferramenta sabe qual mutação é a mais
próxima do defeito real deste projeto.
