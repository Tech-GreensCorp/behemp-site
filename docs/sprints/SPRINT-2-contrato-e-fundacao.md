# Sprint 2 — Contrato de dados congelado e a fundação do módulo

> **Objetivo:** quando esta sprint acabar, **nenhuma tela da Metade 1 precisará imaginar um
> campo**. O formato de tudo que a IA vai devolver está versionado no repositório, com exemplo
> real, e a casa do módulo existe.

**ADRs:** [ADR-0002](../adr/ADR-0002-ui-antes-da-inteligencia.md) D-02 e D-06 ·
[ADR-0003](../adr/ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md) D-01 e D-07.

**Princípios executados:** P2 (dispara-e-acompanha) e P3 (falha parcial) entram já no contrato —
o formato precisa **prever** a resposta parcial, senão a tela não terá como mostrá-la.

## Entregáveis

| #   | entregável                                                                                                                              | referência              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Contrato TypeScript do que a IA devolve, derivado de `src/types/` (495 linhas) + as 17 rotas de `main.py`                               | `09` §1 · ADR-0002 §1.2 |
| 2   | **Fixtures de resposta real**, incluindo `teleconsulta-grafo-sca.json` (561 linhas) e ao menos **um caso de resposta parcial/truncada** | P3                      |
| 3   | Enum de status HITL — `em_andamento`, `aguardando_validacao`, `concluido` — em `db/schema/enums.ts`                                     | P1 · `01` §3            |
| 4   | Enum de validação clínica — `validado`, `divergente`                                                                                    | P5                      |
| 5   | Casa do módulo em **`app/(medico)`** (`DO-11`), seguindo a estrutura das áreas existentes                                               | `06` §3                 |
| 6   | `ActionResult` declarada **uma vez** para o módulo e importada — não a 11ª cópia                                                        | `06` §5                 |
| 7   | Marca buscável em todo ponto que **vai** chamar o motor na Metade 2                                                                     | ADR-0002 D-06           |
| 8   | Entrada no sidebar do médico, seguindo `NAV_GROUPS` de `medico-sidebar.tsx`                                                             | `06` §3                 |

## Critério de aceite

**Executada em 20/08/2026. Os 8 entregáveis e os 6 critérios, cumpridos.**

- [x] `rg FRONTEIRA_MOTOR_IA` lista os pontos de integração — e o guarda cobra que a marca esteja
      **usada** no código, não só declarada: constante sem uso não produz lista nenhuma
- [x] nenhum componente declara tipo próprio para dado do motor — `lib/ia-clinica/contrato.ts` é a
      única fonte, e o guarda varre `components/` e `lib/` procurando mock fora de `__fixtures__/`
- [x] o fixture parcial existe e **carrega sem erro** no contrato — `resposta-parcial-truncada.json`:
      zero hipóteses, `confianca` ausente, `completude.nivel: "parcial"`
- [x] os dois enums existem, com migration gerada — `0018_nifty_xavin.sql` traz os 2 `CREATE TYPE`
      **e** as 7 colunas de consentimento da Sprint 1. SQL + snapshot + journal juntos.
      ⚠️ **gerada, não aplicada** — `db:migrate` roda no deploy, quando o dono mandar
- [x] `pnpm build` passa — exit 0, e a rota `/medico/ia-clinica` aparece no manifesto
- [x] a navegação chega ao módulo (`medico-sidebar.tsx`, grupo _Atendimento_), e quem não é
      `medico` nem `admin` **não** chega — pela checagem de `app/(medico)/layout.tsx`, que o
      módulo herda. Sem segunda checagem própria: duas regras de acesso divergem

### O que a medição do contrato de origem revelou

| achado                                                                                                                                         | consequência                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `parcial: boolean` **e** `completude.nivel` dizem a mesma coisa, e **divergem no fixture real** (`parcial: false` com `completude: "parcial"`) | virou o helper `grafoEstaParcial()`, que lê os dois. Uma tela que leia só `parcial` mostraria "completo" sobre um grafo com 2 red flags não explicadas |
| `urgencia` tem **7 valores** para 3–4 níveis — semáforo e severidade misturados                                                                | preservado como está: normalizar quebraria a leitura de resposta real. A normalização é da camada de apresentação                                      |
| o motor **já emite** `confianca_evidencia` (`alta`/`media`/`baixa`)                                                                            | a ADR-0006 **não é divergência** do contrato de origem: é escolher, entre dois campos que o motor produz, o que pode ir para a tela                    |
| a rota devolve **envelope** `{grafo, blocos, analiseIA}`, não o grafo na raiz                                                                  | quem programar contra o grafo direto quebra na integração — o guarda tem caso para isso                                                                |

### O que ficou de fora, e por quê

As telas de conteúdo (Sprints 3–7) **não** foram construídas. Cada uma depende de decisão que
não foi tomada: ADR-0004, 0005 e 0006 em proposta, e `GAP-12`/`GAP-13`/`GAP-14` sem resposta.
Construí-las agora seria **presumir regra de negócio** — Proibição 4 do `CLAUDE.md`. A página do
módulo diz isso na tela, fatia por fatia, em vez de fingir que está pronta.

## Não entra

- Qualquer chamada ao motor. Zero. É a fronteira da ADR-0002.
- Telas de conteúdo — são as sprints 3 em diante.
- Tabelas de domínio (hipóteses, análises). Entram na sprint que as usa, para não nascer schema sem consumidor.
- `progress`, `collapsible`, `react-markdown` (ADR-0003 D-02).

## Bloqueios

Nenhum de terceiro. Depende só da Sprint 0.

⚠️ **Se esta sprint for pulada, o risco da ADR-0002 §1.3 se materializa**: telas desenhadas
contra dado imaginado, e retrabalho exatamente nas telas de decisão clínica.
