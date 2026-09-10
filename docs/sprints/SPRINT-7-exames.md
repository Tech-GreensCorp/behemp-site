# Sprint 7 — Exames: anexar, ver e vincular (a última da Metade 1)

> **Objetivo:** quando esta sprint acabar, exame se anexa em **store privado**, se vincula à
> consulta e aparece na linha do tempo do paciente — **sem nenhuma análise por IA**.

> 🔴 **É a última tela da Metade 1, por decisão do dono:** *"como exames é tópico sensível ele
> será a última tela que criaremos, focaremos nas outras e no final eu discuto com meu chefe
> como vamos proceder em relação a isso"* (`DO-13`).

**ADRs:** [ADR-0002](../adr/ADR-0002-ui-antes-da-inteligencia.md) D-05 ·
[ADR-0003](../adr/ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md).

## Entregáveis

| # | entregável | referência |
|---|---|---|
| 1 | Upload de exame em **store PRIVADO**, com entrega por rota autenticada | `.claude/rules/seguranca-lgpd.md` |
| 2 | Validação de tamanho, MIME e permissão **no servidor** | idem |
| 3 | Padrão **dispara-e-acompanha** (`202` + acompanhamento) já no upload, mesmo sem IA | P2 |
| 4 | Visualização do documento, com layout lado a lado a partir de `xl` quando fizer sentido | `09` §3 |
| 5 | Vincular exame a consulta e a paciente | `db/schema/exames.ts` |
| 6 | Linha do tempo de exames do paciente | P7 |
| 7 | Marca buscável no ponto onde a análise por IA entraria | ADR-0002 D-06 |

## Critério de aceite

- [ ] 🔴 nenhum upload novo aponta para store público — `rg` prova
- [ ] URL de arquivo sensível não aparece em log, e-mail, notificação nem em tela de quem não pode ler
- [ ] usuário sem vínculo com o paciente **não** baixa o arquivo, mesmo com a URL
- [ ] arquivo além do tamanho ou com MIME errado é recusado **no servidor**
- [ ] visualizar exame registra auditoria com `acao: 'visualizar'`
- [ ] quatro estados · dois temas · telefone

## Não entra

- 🛑 **Toda e qualquer análise por IA de imagem.** Dual-Motor, ABCDE, laudo automático, viewer
  com sobreposição de achado. Fica para a Metade 2, e **bloqueada** por `CF-01` e `GAP-06`.
- Corrigir os 10+ uploads públicos que já existem (Item 6) — autorização própria.

## Bloqueios

| bloqueio | de quem | situação |
|---|---|---|
| 🔴 conversa do dono com o chefe sobre como proceder com exames | dono (`DO-13`) | **esta sprint só começa depois dela** |
| enviar imagem clínica a provedor externo | Jurídico (`CF-01`, `GAP-06`) | bloqueia a Metade 2, não esta sprint |

⚠️ **`CF-01` está aberto:** incluir exames com IA reverte uma recusa de 19/08/2026, cujo motivo
— *imagem não se mascara* — continua válido. Esta sprint **não** o resolve; ela entrega a parte
que não depende dele.
