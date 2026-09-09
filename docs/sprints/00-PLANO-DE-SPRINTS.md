# Plano de sprints — inteligência clínica assistida (canabidiol)

> **A ordem é por o que impede dano novo**, não por tamanho nem facilidade.
> Regra de negócio em [`../01-REGRA-DE-NEGOCIO.md`](../01-REGRA-DE-NEGOCIO.md) · decisões em
> [`../adr/`](../adr/) · fila oficial em [`../03-CHECKLIST-MESTRE.md`](../03-CHECKLIST-MESTRE.md).

**Escrito em 20/08/2026.** As sprints detalhadas existem até onde a informação alcança. As
demais estão mapeadas, **não escritas** — sprint escrita sobre suposição entrega a coisa errada
com aparência de organização.

---

## O mapa

| # | sprint | metade | estado | bloqueado por |
|---|---|---|---|---|
| **0** | [Fundação](SPRINT-0-fundacao.md): instalar, medir baseline, runner e **portão de CI** | — | ✅ escrita | nada |
| **1** | [Auditoria da teleconsulta](SPRINT-1-auditoria-da-teleconsulta.md) | — | ✅ escrita | Sprint 0 |
| **2** | [Contrato congelado + fundação do módulo](SPRINT-2-contrato-e-fundacao.md) | 1 | ✅ escrita | Sprint 0 |
| **3** | [Anamnese como baseline de acompanhamento](SPRINT-3-anamnese-assistida.md) | 1 | ✅ escrita | Sprint 2 · `GAP-12`, `GAP-13` |
| **4** | [Hipóteses e revisão humana](SPRINT-4-hipoteses-e-revisao-humana.md) | 1 | ✅ escrita | Sprint 3 · 🔴 **CFM não transcrita** |
| **5** | [Conduta, prescrição e titulação](SPRINT-5-conduta-prescricao-e-titulacao.md) | 1 | ✅ escrita | Sprint 4 · `GAP-14` · 🔴 **RDC não transcrita** |
| **6** | [Área do paciente: diário, dose e resumo](SPRINT-6-area-do-paciente.md) | 1 | ✅ escrita | Sprints 3 e 5 · `GAP-12` |
| **7** | [Exames — anexar, ver, vincular](SPRINT-7-exames.md) · **a última da Metade 1** | 1 | ✅ escrita | 🔴 **conversa do dono com o chefe** (`DO-13`) |
| 8 | Infraestrutura do motor: máquina maior, WSGI, rede privada | 2 | 🗺️ mapeada | 🔴 **AWS** (`GAP-11`) |
| 9 | Ligar anamnese e hipóteses ao motor | 2 | 🗺️ mapeada | Sprint 8 |
| 10 | RAG e corpus de canabidiol | 2 | 🗺️ mapeada | Sprint 8 · `GAP-03` |
| 11 | Exames com IA de **imagem** | 2 | 🗺️ mapeada | 🔴 **Jurídico** (`CF-01`, `GAP-06`) |
| 12 | Bateria de regressão adaptada de R1–R40 | 2 | 🗺️ mapeada | Sprints 9–11 |

### Onde exames ficou, e por quê

Exames é a **sétima** sprint, não a quinta, por decisão do dono (`DO-13`): é tópico sensível e
ele quer conversar com o chefe antes. Isso é bom pelo lado técnico também — é a única sprint da
Metade 1 cujo escopo pode encolher depois da conversa, e deixá-la por último evita construir
sobre decisão que pode mudar.

## O que se copia, e de onde

🔴 O ativo importado é a **lógica de construção** (`DO-12`), documentada em
[`../09-FRONTEND-VIDAI-MEDIDO.md`](../09-FRONTEND-VIDAI-MEDIDO.md) §1: os sete princípios e a
navegação de cada fluxo. **Não** a stack, **não** a paleta, **não** a teleconsulta — cujo design
atual da BeHemp permanece.

Toda sprint da Metade 1 cita, nos entregáveis, **qual princípio (P1–P7) ela executa**. Sprint
que não cita nenhum provavelmente está construindo tela nova em vez de transportar lógica.

## Por que esta ordem

0. **A ordem das telas segue o ciclo clínico do canabidiol**, não a ordem do VidAI: baseline
   (3) → decisão (4) → conduta e titulação (5) → acompanhamento entre consultas (6). É a mesma
   sequência que a literatura descreve — medir, decidir, titular, remedir.
1. **Sprint 0 antes de tudo** porque sem portão de CI nenhum guarda deste plano roda antes do
   deploy — e `main` é produção, com migration sem rollback.
2. **Sprint 1 antes da Metade 1** porque a teleconsulta é onde metade das telas novas vai morar,
   e ela **nunca foi usada de verdade** (`DO-02`). Ligar inteligência a um módulo de estado
   desconhecido significa não saber, na primeira falha, se a culpa é da IA ou do WebRTC.
3. **Sprint 2 antes de qualquer tela** porque é ela que congela o contrato de dados. Sem isso a
   Metade 1 desenha contra dados imaginados — o único risco real desta ordem (ADR-0002 §1.3).
4. **A Metade 2 inteira depende de terceiros** — AWS e Jurídico. Ficam em bloco próprio, para
   que a espera não pareça time parado.

## O que depende de terceiro, e o que fazemos enquanto não chega

| espera | de quem | enquanto isso |
|---|---|---|
| upgrade de RAM | **AWS** (`GAP-11`) | toda a Metade 1 — não consome a RAM que falta |
| base legal para provedores de LLM novos **e para enviar imagem clínica** | **Jurídico** (`GAP-06`, `CF-01`) | telas de exame sem a análise por IA (Sprint 5) |
| corpus de canabidiol validado | **farmacêutico**, fora da plataforma (`GAP-03`) | estrutura de ingestão, sem conteúdo |
| transcrição das normas CFM/RDC | trabalho próprio | Sprints 0–3 e 5 não dependem delas |

🔴 **As Sprints 4 e 6 tocam conduta clínica.** Nenhuma das normas que as regem foi lida ainda —
estão apenas identificadas em [`../02-CATALOGO-DE-REGRAS.md`](../02-CATALOGO-DE-REGRAS.md). A
transcrição precisa acontecer **antes** dessas duas, não depois.
