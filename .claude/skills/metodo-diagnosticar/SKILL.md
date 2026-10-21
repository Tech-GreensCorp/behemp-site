---
name: metodo-diagnosticar
description: Loop de diagnóstico com minimização e um cenário por classe de defeito, incluindo um cenário de controle limpo, antes de qualquer correção. Use ao dizer que algo está quebrado, travando, lento, intermitente ou "às vezes funciona", ou ao pedir para investigar a causa de um comportamento. Termina em causa com caminho:linha, não em hipótese.
---

# Diagnosticar antes de corrigir

**A saída desta skill é a causa, com `caminho/arquivo.ts:linha`.** Não é a correção, e
não é uma hipótese plausível.

## O loop

1. **Reproduza.** *"Se você não consegue reproduzir, como vai saber que foi corrigido?"*
   Guarde a entrada que provoca o defeito e a saída correta esperada — elas viram o teste.
2. **Minimize.** Reduza até o menor caso que ainda falha. Um cenário com quatro defeitos
   ao mesmo tempo acusa doze coisas e não diz qual regra pegou qual defeito.
3. **Meça, não opine.** Número, saída de comando, linha do log. *"Parece que"* não entra
   no diagnóstico.
4. **Bissecte.** Estreite entre o que funciona e o que não funciona — no dado, no
   caminho de código, ou no histórico (`git log -S`).
5. **Nomeie a causa** com o caminho e a linha. Se você não consegue apontar a linha,
   ainda está na hipótese.
6. **Catalogue** com `metodo-catalogar-bug`, e só então corrija.
7. **O teste nasce antes da correção**, com `metodo-guardas`.

## O ambiente de prova

- **um cenário por classe de defeito**, isolado
- **um cenário composto**, reproduzindo o caso real
- **um CONTROLE limpo**

> 🔴 **Sem o controle, verde não significa nada.** Não há como distinguir *"o dado está
> ruim"* de *"a regra está acusando demais"*.

Como ler: se o cenário que isola X **não** acusa X, a regra não existe. Se o CONTROLE
acusa qualquer coisa, a regra acusa demais.

## O estado real deste repositório — leia antes de concluir

- **Não existe suíte de produto.** O único teste é o guarda dos hooks. Não presuma que
  "os testes passam".
- **`pnpm lint` e `pnpm format:check` falham por baseline** (117 erros / 233 arquivos,
  números do `AGENTS.md`, a reconferir). Falha de lint **não** é sinal do seu defeito.
- **`node_modules` pode estar ausente.** `pnpm install` antes de qualquer conclusão sobre
  build ou teste.
- **Produção é AWS EC2 t2.small com PM2** (DT-006), não Vercel. Sintoma de memória tem
  causa conhecida: pico de build de 4,5–5 GB em 2 GB de RAM, com swap não persistido.
- **`main` é produção.** Comportamento diferente entre local e produção pode ser
  simplesmente commit não deployado.

## Quando não há como testar

Se a única forma de reproduzir é um teste raso que não exercita o defeito real, **não
escreva o teste raso**. Registre que **a arquitetura está impedindo o bug de ser
travado** — isso é o achado, e vira item de arquitetura, não de correção.
