# ADR-0013 — O mapa de urgência mora num lugar só, e o quarto nível não vem de `urgencia`

> **Status:** ✅ **aceita** — 25/08/2026.
> **Contexto:** o `DO-42` pediu gatilhos de urgência na tela. Ao medir o contrato para
> implementar, o número que eu havia escrito não bateu: eu dizia **7→4**, e o contrato sustenta
> **7→3**. O quarto nível que eu descrevia veio do VidAI, não daqui.
> **Decisão:** um mapa único, derivado do contrato, com **3 níveis vindos de `UrgenciaAnalise`**
> e um **4º derivado de `red_flags_nao_explicadas`** (`DO-51`).

---

## §1 — O que a medição achou

`lib/ia-clinica/contrato.ts:69-76` declara **sete** valores:

```
UrgenciaAnalise = 'verde' | 'amarelo' | 'vermelho' | 'normal' | 'atencao' | 'critico' | 'ok'
```

São **dois vocabulários para a mesma coisa** — um de cor, um de estado — e não sete graus. O
próprio contrato confirma em outro ponto: `nivel_urgencia?: 'normal' | 'atencao' | 'critico'`
(`contrato.ts:339`) tem **três**.

🔴 **Portanto o quarto nível não existe em `UrgenciaAnalise`.** O "código roxo" que eu havia
descrito é do VidAI (`docs/09-FRONTEND-VIDAI-MEDIDO.md` §2), e eu o repeti sem conferir o nosso
contrato — o mesmo erro de método da retratação das contagens de guarda: **copiar um número em
vez de medi-lo**.

## §2 — As decisões

### D-01 — O mapa é uma constante única, derivada do contrato

```
verde · ok · normal        → rotina
amarelo · atencao          → atenção
vermelho · critico         → emergência
```

**Por que num lugar só.** Se duas telas mapearem por conta própria, elas divergem — e as duas
continuam plausíveis, porque nenhuma quebra. É exatamente o custo que o `LIMIAR_THC_PERCENTUAL`
evitou na Sprint 5, e o guarda cobra o mesmo aqui.

**Rejeitado: `switch` em cada componente.** É a forma que produz divergência silenciosa.

**Rejeitado: reduzir `UrgenciaAnalise` a 3 valores no contrato.** O contrato é produzido pelo
motor, não por nós — e a Sprint 2 congelou que ele é a **única fonte**. Adaptar o contrato à tela
inverteria a dependência.

### D-02 — O 4º nível é **derivado**, e a origem é declarada (`DO-51`)

> 🟣 **crítico** = (`vermelho` ou `critico`) **e** `red_flags_nao_explicadas > 0`

`red_flags_nao_explicadas` já existe em `contrato.ts:249`. O nível não é inventado: é uma
**conjunção de dois campos que o motor já produz**.

**Por que isso importa clinicamente.** Emergência com achado grave **não explicado** é uma
situação diferente de emergência com tudo explicado — e é exatamente a situação em que o `DO-42`
quer o gatilho: _"evitar que medicamentos errados sejam prescritos (…) por falta desses
gatilhos"_.

**Rejeitado: um 4º valor novo em `UrgenciaAnalise`.** O motor não o produz; ele nasceria sempre
vazio, e um nível que nunca acende é pior que nível nenhum — dá falsa sensação de cobertura.

**Rejeitado: elevar por red flag sozinha, sem emergência.** Red flag não explicada num quadro de
rotina é motivo de **investigar**, não de alarme máximo. Alarme que dispara demais é alarme que
se ignora.

### D-03 — Valor fora do contrato **denuncia**, não cai nem assume o mais brando

Se chegar um valor de urgência que o contrato não declara, a tela mostra o valor cru com aviso de
desconhecido — o mesmo desenho que a ADR-0009 §4 adotou para procedência.

**Rejeitado: cair para `rotina` no `default`.** Seria afirmar "sem urgência" a partir de um valor
que ninguém entendeu — a pior das saídas numa tela cuja função é alertar.

### D-04 — Cor só de `--chart-*`

Nenhum hex novo (proibição nº 3). `--chart-2` rotina · `--chart-4` atenção · `--chart-5`
emergência · `--chart-3` crítico.

---

## §3 — O que fica rejeitado

| #    | rejeitado                                 | motivo                                                      |
| ---- | ----------------------------------------- | ----------------------------------------------------------- |
| R-01 | `switch` de urgência em cada componente   | divergência silenciosa entre telas                          |
| R-02 | reduzir `UrgenciaAnalise` a 3 no contrato | inverteria a dependência: o motor é a fonte                 |
| R-03 | 4º valor novo em `UrgenciaAnalise`        | o motor não o produz; nível que nunca acende engana         |
| R-04 | elevar por red flag sem emergência        | alarme que dispara demais é alarme que se ignora            |
| R-05 | `default` caindo para `rotina`            | afirmaria "sem urgência" a partir de valor não compreendido |
| R-06 | hex novo para as cores dos níveis         | proibição nº 3 — o sistema visual está fechado              |

## §4 — Como se prova

| guarda                    | fica vermelho quando                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `urgencia-tem-um-mapa-so` | um segundo mapa aparecer fora de `lib/ia-clinica/urgencia.ts`, ou um valor do contrato ficar sem nível |
| cobertura do contrato     | `UrgenciaAnalise` ganhar valor novo que o mapa não cobre — o caso nomeia o valor                       |
| `default` denuncia        | valor desconhecido cair para `rotina` em vez de avisar                                                 |
| sem hex novo              | cor de nível deixar de sair de `--chart-*`                                                             |

---

**Fontes.** Primárias **medidas** neste repositório: `lib/ia-clinica/contrato.ts:69-76`, `:249`,
`:339`. Decisão do dev: `DO-51`, 25/08/2026, escolhida entre 3 opções comparadas. Contexto do
`DO-42` em `docs/02-CATALOGO-DE-REGRAS.md`. Padrão de 4 níveis do VidAI em
`docs/09-FRONTEND-VIDAI-MEDIDO.md` §2 — **origem do meu erro**, registrada para que ninguém a
copie de novo sem medir.

**Princípios e fase:** D-01 **A** (arquitetura — uma fonte por regra), fase 3 · D-02 **D** (regra
e resiliência), fase 7 · D-03 **D** + **P** (revisão crítica do que a máquina afirma), fase 7 ·
D-04 **L** (front-end), fase 2.
