import { pgTable, text, integer, date, index, numeric } from 'drizzle-orm/pg-core';

import { baseColumns, softDeleteColumn } from './_helpers';
import { anamneses } from './anamneses';
import { consultas } from './consultas';
import { medicos } from './medicos';
import { pacientes } from './pacientes';
import { periodoContagemEnum } from './enums';

/**
 * MEDIDAS DE DESFECHO — a série temporal que dá valor ao tratamento com canabidiol.
 *
 * POR QUE ESTA TABELA EXISTE
 * [ADR-0004](../../docs/adr/ADR-0004-anamnese-e-baseline-de-acompanhamento-longitudinal.md) D-01:
 * a anamnese é **baseline repetível**, não registro único. Sem série temporal não há como
 * responder a única pergunta que importa neste tratamento — *"melhorou?"*.
 *
 * `anamneses` guarda o quadro clínico (queixa, história, hábitos), que é **estável**. Aqui ficam
 * as medidas que se **remedem** a cada retorno. Separar as duas coisas é o que evita duplicar
 * histórico familiar e alergia a cada consulta, e o que evita sobrescrever a medida anterior.
 *
 * 🔴 NADA AQUI É SOBRESCRITO. Cada remedição é uma LINHA NOVA, com data. É a Proibição 3 do
 * `CLAUDE.md` (não sobrescrever histórico clínico) e é o que o guarda cobra.
 *
 * AS CINCO MEDIDAS — escolhidas pelo dono em 20/08/2026 (`DO-24`, responde `GAP-12`):
 * dor · qualidade do sono · ansiedade/humor · qualidade de vida global · frequência de crises.
 *
 * ⚠️ As três últimas são campos novos; dor e qualidade do sono **já existem** em `anamneses` e
 * continuam lá para o registro inicial — aqui elas entram como série. A escala 0–10 das novas é
 * proposta de implementação por consistência com `anamneses.nivelDor`, não escolha clínica: se o
 * médico preferir instrumento nomeado, muda o rótulo e a faixa, não o modelo.
 */
export const medidasDesfecho = pgTable(
  'medidas_desfecho',
  {
    ...baseColumns,
    pacienteId: text('paciente_id')
      .notNull()
      .references(() => pacientes.id),
    /** A consulta em que foi medido. Nulo quando medido fora de consulta. */
    consultaId: text('consulta_id').references(() => consultas.id),
    /** A anamnese que originou esta medição — liga o baseline à série. */
    anamneseId: text('anamnese_id').references(() => anamneses.id),

    /**
     * 🔴 A DATA DA MEDIÇÃO, não a data do registro.
     * `baseColumns.createdAt` diz quando foi digitado; isto diz a que dia o valor se refere. Uma
     * medida lançada com atraso continua pertencendo ao dia em que foi observada — senão a série
     * temporal mente sobre a evolução.
     */
    medidoEm: date('medido_em').notNull(),

    // ── As cinco medidas (DO-24) ────────────────────────────────────────────────
    /** 0–10. Mesma escala de `anamneses.nivelDor`, para a série ser contínua. */
    nivelDor: integer('nivel_dor'),
    /** 0–10. Escala própria em vez do enum de `anamneses.qualidadeSono`: enum não se subtrai, e
     *  a série precisa de diferença entre t₀ e t+30d. O enum continua no registro inicial. */
    qualidadeSono: integer('qualidade_sono'),
    /** 0–10, onde 10 é o pior. Campo novo (`DO-24`). */
    nivelAnsiedade: integer('nivel_ansiedade'),
    /** 0–10, onde 10 é o melhor. Campo novo (`DO-24`). ⚠️ direção INVERSA das outras — por isso
     *  o rótulo da tela precisa dizer o sentido, e o guarda cobra que diga. */
    qualidadeVidaGlobal: integer('qualidade_vida_global'),

    /**
     * Frequência de crises/espasmos: **contagem + período juntos**.
     *
     * Fixar a janela (por semana? por mês?) seria presumir regra clínica — epilepsia e
     * espasticidade têm frequências de ordem muito diferente. Quem registra escolhe o período, e
     * a comparação entre consultas normaliza na leitura.
     */
    crisesContagem: integer('crises_contagem'),
    crisesPeriodo: periodoContagemEnum('crises_periodo'),

    // ── Sinais vitais (DO-25, responde GAP-13) ──────────────────────────────────
    /** Só PA e peso entram. Os outros 6 do VidAI ficam fora: em canabidiol ambulatorial
     *  raramente mudam conduta, e campo pessoal sem consumidor é coleta sem finalidade. */
    pressaoSistolica: integer('pressao_sistolica'),
    pressaoDiastolica: integer('pressao_diastolica'),
    /** kg, uma casa decimal. Referência de dose se expressa por kg. */
    pesoKg: numeric('peso_kg', { precision: 5, scale: 1 }),

    /** Observação livre da medição — o que o número não conta. */
    observacao: text('observacao'),

    registradoPor: text('registrado_por')
      .notNull()
      .references(() => medicos.id),
    ...softDeleteColumn,
  },
  (t) => [
    // A consulta mais comum é "a série deste paciente, em ordem" — daí o índice composto.
    index('medidas_desfecho_paciente_data_idx').on(t.pacienteId, t.medidoEm),
    index('medidas_desfecho_consulta_idx').on(t.consultaId),
    index('medidas_desfecho_anamnese_idx').on(t.anamneseId),
  ],
);
