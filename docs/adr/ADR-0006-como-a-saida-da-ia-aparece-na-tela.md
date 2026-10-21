# ADR-0006 — A saída da IA aparece como alternativas com confiança categórica, nunca como percentual

> **Status:** 📋 **proposta** — 20/08/2026.
> **Contexto:** o VidAI exibe confiança em **percentual** (S11: *"PAI 88%"*, em
> `AnaliseHipotesePremiumCard`). A decisão de copiar ou não isso precisa ser tomada **agora**,
> na Metade 1, porque define o layout do cartão de hipótese.
> **Decisão:** copiam-se as **N melhores alternativas** (as 3 hipóteses) e a revelação
> progressiva. **Não** se copia o percentual: a confiança aparece em faixa categórica com
> orientação de ação.

---

## §1 — O que a fonte diz

O Google PAIR orienta **não** mostrar confiança quando *"the confidence level isn't
impactful"* — diferenças granulares (85,8% × 87%) não mudam a ação — e quando *"showing
confidence could create mistrust"*, porque confiança alta enganosa induz **aceitação cega**.

Entre as formas de exibir, o guia lista **categórico** (*"High/Medium/Low buckets with clear
action guidance"*) e **N-best alternatives** (*"show multiple options to prompt user
judgment"*). O VidAI **já faz** N-best com três hipóteses — essa parte está alinhada.

Numérico, o guia condiciona a *"probability literacy"* do usuário.

## §2 — As decisões

### D-01 — Três alternativas, primeira aberta, demais fechadas

Copiado do VidAI e sustentado pelo NN/g: *"the very fact that something appears on the initial
display tells users that it's important"*.

**Rejeitado: mostrar só a hipótese principal.** É o defeito que a S10 do VidAI corrigiu — o
modelo raciocinava sobre três e a tela mostrava uma.
**Rejeitado: abrir as três.** O NN/g é explícito: se o usuário precisa abrir a maioria,
*"an accordion is not the way to go"* — mas aqui a segunda e a terceira são **secundárias por
construção**, e abrir tudo desfaz a hierarquia clínica.

### D-02 — Confiança em faixa categórica, com o que fazer em cada faixa

Três faixas, com orientação de ação escrita, nos tokens `--chart-*` existentes. Sem hex novo.

**Rejeitado: percentual, como o VidAI.** Dois motivos somados: a diferença granular não muda
conduta, e número induz precisão que o modelo não tem. Em decisão clínica, aceitação cega é o
risco mais caro.
**Rejeitado: omitir confiança.** O médico precisa saber quando desconfiar mais.

### D-03 — Toda hipótese mostra **no que se apoia**

Evidências que a sustentam, junto do cartão. O PAIR chama de *data source explanations*, e
recomenda *"partial explanations"* — o que afeta a decisão, não o funcionamento interno.

**Rejeitado: expor o raciocínio bruto (`chain_of_thought`) na tela.** É o oposto de explicação
parcial: volume sem discriminação. E, para o paciente, é proibido (P6).

### D-04 — Recusar é tão fácil quanto aceitar

Aceitar, recusar e editar têm o mesmo peso visual. Recusa **pede motivo** e vira `divergente`,
que é registro clínico.

**Rejeitado: aceitar em destaque e recusar como link discreto.** Desenho que empurra para o
aceite fabrica a aceitação cega que o PAIR alerta.

---

## §3 — O que fica rejeitado

| # | rejeitado | motivo |
|---|---|---|
| R-01 | só a hipótese principal | defeito que a S10 do VidAI corrigiu |
| R-02 | as três abertas | desfaz a hierarquia clínica |
| R-03 | confiança em percentual | granularidade não muda conduta; induz aceitação cega |
| R-04 | omitir confiança | o médico precisa saber quando desconfiar |
| R-05 | `chain_of_thought` na tela | explicação total em vez de parcial; proibido ao paciente |
| R-06 | aceitar com mais peso que recusar | o desenho fabrica viés de aceitação |

## §4 — Como se prova

| guarda | falha quando |
|---|---|
| `sem-percentual-de-confianca` | aparecer `%` ligado a confiança de modelo |
| `alternativas-presentes` | tela exibir hipótese única quando o contrato traz N |
| `recusa-com-mesmo-peso` | ação de recusar usar variante de menor destaque que aceitar |
| `sem-raciocinio-bruto` | `chain_of_thought` for renderizado em qualquer superfície |

⚠️ Os guardas nascem com a primeira tela que exibe saída de IA — Metade 1 —, mesmo que a fonte
ainda seja o fixture.

---

**Fontes.** Lida: [PAIR — Explainability + Trust](https://pair.withgoogle.com/chapter/explainability-trust/).
Localizadas e citadas pelo trecho: [NN/g — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) ·
[NN/g — Accordions on Desktop](https://www.nngroup.com/articles/accordions-on-desktop/).
Primária: `docs/sprint-IA-analise/` S10 e S11 (`AnaliseHipotesePremiumCard`, `SeletorHipoteseHITL`).

**Princípios e fase:** D-01/D-02 **L** (front-end), fase 2 · D-03/D-04 **H** (segurança e
responsabilidade), fase 6 · todos **P** (fluência com IA), fase 15.
