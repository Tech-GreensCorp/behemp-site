# Sprint 3 — Anamnese como baseline de acompanhamento

> **Objetivo:** quando esta sprint acabar, o médico registra uma avaliação inicial completa e,
> no retorno, **remede só o que muda** — vendo o valor anterior ao lado do novo.

**ADRs:** [ADR-0004](../adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) (toda) ·
[ADR-0002](../adr/ADR-0002-ui-antes-da-inteligencia.md) D-03/D-04 · [ADR-0003](../adr/ADR-0003-a-ui-importada-nasce-no-sistema-visual-da-behemp.md).

**Princípios do VidAI executados:** P1 (revisão humana), P7 (retomada por deep link), P4 (o que
aparece por padrão sinaliza importância).
**Divergência deliberada:** não é wizard linear — ADR-0004 D-02, com o motivo.

## Entregáveis

| #   | entregável                                                                                                     | referência    |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Tela de **primeira avaliação**: seções na página + trilha lateral com progresso, todas visíveis desde o início | ADR-0004 D-02 |
| 2   | Tela de **retorno**: só medidas repetíveis + o que mudou, com **valor anterior ao lado**                       | ADR-0004 D-01 |
| 3   | Schema de **medida datada e repetível**, ligada ao paciente e à consulta                                       | ADR-0004 D-01 |
| 4   | Reuso integral dos campos que já existem em `anamneses` — nada é recriado                                      | ADR-0004 §1.2 |
| 5   | Controles numéricos por grandeza: `−`/`+`, faixa plausível, faixa normal, sinal de perigo                      | ADR-0004 D-05 |
| 6   | Auto-save por seção + retomada por `?continuar=&secao=`                                                        | P7            |
| 7   | Bloco opcional de sinais vitais, com os campos que o `GAP-13` definir                                          | ADR-0004 D-04 |
| 8   | Estado da revisão visível, com o rótulo de espera pelo médico                                                  | P1            |
| 9   | Lugar da IA presente, com estado vazio explicando o que virá — **sem botão inerte**                            | ADR-0002 D-04 |

## Critério de aceite

**Executada em 20/08/2026.** ADR-0004 aprovada, `GAP-12` e `GAP-13` respondidos, e duas decisões
novas do dono incorporadas: o **rastreio do uso** (`DO-26`) e o **primeiro uso como caminho de
primeira classe** (`DO-27`).

- [~] registrar, sair no meio, voltar pelo deep link — ⚠️ **parcial.** O deep link `?secao=`
  funciona e a trilha lateral navega, mas **rascunho de campo não preenchido não é salvo**:
  cada bloco (medidas, rastreio) salva por conta própria, e o que não foi salvo se perde ao
  sair. Auto-save de rascunho exigiria tabela de draft — não construída, catalogada
- [x] no retorno, o valor anterior de cada medida aparece ao lado do campo — com a variação já
      interpretada como melhora ou piora, **inclusive nas escalas invertidas**
- [x] `rg` prova que nenhuma atualização sobrescreve medida anterior — o guarda tem caso por
      tabela, e a sabotagem `1-update-em-medida` fica vermelha
- [x] valor fora da faixa plausível é sinalizado; derivado nunca é digitado — faixa aplicada nos
      **dois** caminhos de entrada (botões e digitação), e validada **de novo no servidor**
- [~] quatro estados · claro e escuro · telefone · teclado — ⚠️ **verificado por leitura, não por
  execução.** Só tokens de tema (nada hex fora do tom escuro da teleconsulta), grid
  responsivo, `aria-*` e foco nativo preservado. **Sem credenciais de desenvolvimento
  (`GAP-09`) nada foi visto rodando** — e isso não se declara verde sem ver
- [x] nenhum arquivo passa de 400 linhas — o maior é `RastreioUso.tsx` com **376**, depois de
      extrair as listas de opção para `opcoes-rastreio.ts`
- [x] Zod + papel + **escopo de objeto** + auditoria em toda action — o guarda cobra função por
      função, e a leitura de dado clínico registra `acao: 'visualizar'`
- [x] médico não abre anamnese de paciente que não é dele — `garantirMedicoDoPaciente` conjunga
      `pacientes.medicoId`; erro indistinto de "não existe", para não virar oráculo de enumeração

### O que foi construído

| arquivo                                         | o que é                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `db/schema/medidas-desfecho.ts`                 | a série: 5 medidas + 2 vitais, com **data da medição** distinta da data do registro |
| `db/schema/rastreio-uso-cannabis.ts`            | o rastreio de `DO-26` + `DO-27`, com adesão                                         |
| `app/_actions/anamnese-baseline.ts`             | 5 actions, todas com escopo de objeto e auditoria                                   |
| `components/ia-clinica/ControleMedida.tsx`      | o controle de D-05, com as faixas declaradas **uma** vez                            |
| `components/ia-clinica/FormMedidas.tsx`         | as 5 medidas + vitais opcionais, com valor anterior ao lado                         |
| `components/ia-clinica/RastreioUso.tsx`         | a ramificação em três caminhos                                                      |
| `components/ia-clinica/SerieDeMedidas.tsx`      | a evolução, **sem gráfico** — com 2 pontos, tabela mostra mais                      |
| `.../ia-clinica/anamnese/[pacienteId]/page.tsx` | os dois modos: primeira avaliação × retorno                                         |

Guarda `anamnese-e-serie-nao-sobrescrita` — **23 casos, 10 sabotagens provadas vermelhas.** Uma
sobreviveu na primeira rodada: o clamp de faixa existia em **dois** caminhos de entrada, e o
guarda procurava no arquivo em vez de por função — removê-lo da digitação passava batido.

### O que ficou de fora, e por quê

- **Auto-save de rascunho.** Exige tabela de draft e política de expiração de dado clínico
  parcial. Não inventado — catalogado.
- **Gráfico da série.** `recharts` está no projeto, mas com 2 ou 3 pontos um gráfico sugere
  tendência onde não há. Entra quando a série tiver densidade.
- **Migration aplicada.** Gerada como `0019_cheerful_ricochet`, **não aplicada** — condição
  expressa do dono. As telas compilam e não gravam até ela rodar.

## Não entra

Chamada ao motor · hipóteses · conduta · qualquer tela de exame · qualquer tela do paciente.

## Bloqueios

`GAP-12` (quais escalas de desfecho) e `GAP-13` (quais vitais) — ambos com o médico. Enquanto não
vierem, construir com `nivelDor` e `qualidadeSono`, que **já existem** no schema e já são medidas
de desfecho de canabidiol.
