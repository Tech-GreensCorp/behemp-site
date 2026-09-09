# Fixtures do motor de IA clínica

**Congelados em 20/08/2026**, na Sprint 2, por exigência da
[ADR-0002](../../docs/adr/ADR-0002-ui-antes-da-inteligencia.md): a UI é construída antes de o
motor existir, e isso só é seguro se ela for construída **contra a resposta real**.

| arquivo                               | o que é                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `resposta-completa-teleconsulta.json` | **resposta real** do motor VidAI: 10 achados, 3 hipóteses ranqueadas, 18 arestas, `urgencia: "vermelho"`. Copiada sem alteração |
| `resposta-parcial-truncada.json`      | o caso de **falha parcial** (P3): nenhuma hipótese fechada, `completude.nivel: "parcial"`, `analiseIA` quase vazia              |

## Por que estes dois, e não um

Uma tela que só foi vista com a resposta completa **quebra** na primeira resposta parcial — e
resposta parcial é o caso comum, não a exceção: o próprio fixture completo traz
`completude.nivel: "parcial"` com 2 red flags não explicadas.

## `resposta-canabidiol-dor-cronica.json` — o terceiro, e o único de canabidiol

Criado em 24/08/2026, quando o dono pediu opções de medicamento por hipótese. **Não substitui os
outros dois:** eles vêm do motor real do VidAI e é isso que os torna úteis — provam que o
contrato é o de verdade. Mas são de cardiologia, e pendurar canabidiol numa hipótese de dissecção
aórtica seria clinicamente absurdo. Tela de exemplo absurda ensina a coisa errada a quem aprova.

Ele existe para exercitar **três estados** que a tela precisa saber tratar:

| hipótese                          | opções | o que exercita                                             |
| --------------------------------- | ------ | ---------------------------------------------------------- |
| slot 1 — polineuropatia diabética | **3**  | o caso cheio, no limite do contrato                        |
| slot 2 — fibromialgia             | **2**  | menos que o máximo, com ranking coerente                   |
| slot 3 — neuropatia carencial     | **0**  | ausência: quando o próximo passo é investigar, não medicar |

🔴 **O conteúdo clínico é ILUSTRATIVO e não foi validado.** `GAP-03` (origem do corpus de
canabidiol, e quem o valida clinicamente) está **aberto**. Por isso toda opção tem
`procedencia: 'inferido_ia'` e `referencia: null` — é exatamente como a tela deve mostrar algo
que o modelo produziu e nenhum farmacêutico assinou. Quando o corpus existir, o motor passa a
emitir `catalogo_validado` com referência, e a tela troca o rótulo sozinha.

**Sem nenhum campo de dose**, de propósito: `IMD-01` × `IMD-02` na ADR-0009. O guarda
`medicacao-informa-nao-prescreve` varre este arquivo e fica vermelho se um aparecer.

## O que NÃO tem aqui

**Nenhum dado pessoal.** Conferido em 20/08/2026: zero CPF, e-mail, telefone ou nome próprio.
Fixture de produto clínico com PII seria vazamento versionado — se um fixture novo precisar de
identidade, ela é inventada e óbvia (`Paciente Teste`), nunca real.

## Regra

Mock de dado do motor mora **aqui**. O guarda `sem-dado-inventado` falha se aparecer objeto
simulando resposta do motor fora deste diretório — porque mock espalhado por componente é o que
faz a tela divergir do contrato sem ninguém ver.
